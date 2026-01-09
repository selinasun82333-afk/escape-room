// ============================================================================
// EDGE FUNCTION: event-control
// ============================================================================
// Admin functions for event lifecycle: start, pause, resume, end
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type EventAction = 'start' | 'pause' | 'resume' | 'end' | 'reset'

interface EventControlRequest {
  event_id: string
  action: EventAction
  options?: {
    reset_teams?: boolean
    extend_seconds?: number
  }
}

interface EventControlResponse {
  success: boolean
  message: string
  event_status?: string
  started_at?: string
  remaining_seconds?: number
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const authHeader = req.headers.get('Authorization')!
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    )

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { event_id, action, options }: EventControlRequest = await req.json()

    if (!event_id || !action) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user is event organizer or admin
    const { data: event } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single()

    if (!event) {
      return new Response(
        JSON.stringify({ success: false, message: 'Event not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check authorization
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'
    const isOrganizer = event.created_by === user.id

    if (!isAdmin && !isOrganizer) {
      return new Response(
        JSON.stringify({ success: false, message: 'Not authorized to control this event' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let response: EventControlResponse

    switch (action) {
      case 'start':
        response = await handleStart(supabaseAdmin, event, user.id)
        break
      case 'pause':
        response = await handlePause(supabaseAdmin, event, user.id)
        break
      case 'resume':
        response = await handleResume(supabaseAdmin, event, user.id)
        break
      case 'end':
        response = await handleEnd(supabaseAdmin, event, user.id)
        break
      case 'reset':
        response = await handleReset(supabaseAdmin, event, user.id, options?.reset_teams)
        break
      default:
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ============================================================================
// ACTION HANDLERS
// ============================================================================

async function handleStart(
  supabase: any,
  event: any,
  userId: string
): Promise<EventControlResponse> {
  if (event.status !== 'scheduled' && event.status !== 'draft') {
    return {
      success: false,
      message: `Cannot start event in '${event.status}' status`
    }
  }

  const now = new Date().toISOString()

  // Update event status
  await supabase
    .from('events')
    .update({
      status: 'active',
      started_at: now,
      paused_at: null,
      accumulated_pause_seconds: 0
    })
    .eq('id', event.id)

  // Initialize progress for all teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .eq('event_id', event.id)
    .eq('is_active', true)

  for (const team of teams || []) {
    await supabase.rpc('initialize_team_progress', { p_team_id: team.id })
  }

  // Log analytics
  await supabase.from('analytics_events').insert({
    event_id: event.id,
    user_id: userId,
    event_type: 'event_started',
    payload: { started_at: now }
  })

  return {
    success: true,
    message: 'Event started',
    event_status: 'active',
    started_at: now,
    remaining_seconds: event.duration_seconds
  }
}

async function handlePause(
  supabase: any,
  event: any,
  userId: string
): Promise<EventControlResponse> {
  if (event.status !== 'active') {
    return {
      success: false,
      message: `Cannot pause event in '${event.status}' status`
    }
  }

  const now = new Date().toISOString()

  await supabase
    .from('events')
    .update({
      status: 'paused',
      paused_at: now
    })
    .eq('id', event.id)

  // Calculate remaining time
  const elapsed = Math.floor(
    (Date.now() - new Date(event.started_at).getTime()) / 1000
  ) - event.accumulated_pause_seconds
  const remaining = Math.max(0, event.duration_seconds - elapsed)

  // Log analytics
  await supabase.from('analytics_events').insert({
    event_id: event.id,
    user_id: userId,
    event_type: 'event_paused',
    payload: { paused_at: now, elapsed_seconds: elapsed }
  })

  return {
    success: true,
    message: 'Event paused',
    event_status: 'paused',
    remaining_seconds: remaining
  }
}

async function handleResume(
  supabase: any,
  event: any,
  userId: string
): Promise<EventControlResponse> {
  if (event.status !== 'paused') {
    return {
      success: false,
      message: `Cannot resume event in '${event.status}' status`
    }
  }

  // Calculate pause duration
  const pauseDuration = Math.floor(
    (Date.now() - new Date(event.paused_at).getTime()) / 1000
  )
  const newAccumulated = event.accumulated_pause_seconds + pauseDuration

  await supabase
    .from('events')
    .update({
      status: 'active',
      paused_at: null,
      accumulated_pause_seconds: newAccumulated
    })
    .eq('id', event.id)

  // Calculate remaining time
  const elapsed = Math.floor(
    (Date.now() - new Date(event.started_at).getTime()) / 1000
  ) - newAccumulated
  const remaining = Math.max(0, event.duration_seconds - elapsed)

  // Log analytics
  await supabase.from('analytics_events').insert({
    event_id: event.id,
    user_id: userId,
    event_type: 'event_resumed',
    payload: { pause_duration_seconds: pauseDuration }
  })

  return {
    success: true,
    message: 'Event resumed',
    event_status: 'active',
    remaining_seconds: remaining
  }
}

async function handleEnd(
  supabase: any,
  event: any,
  userId: string
): Promise<EventControlResponse> {
  if (event.status === 'completed' || event.status === 'archived') {
    return {
      success: false,
      message: `Event already in '${event.status}' status`
    }
  }

  const now = new Date().toISOString()

  await supabase
    .from('events')
    .update({
      status: 'completed',
      ended_at: now,
      paused_at: null
    })
    .eq('id', event.id)

  // Calculate final stats
  const { data: stats } = await supabase
    .from('v_event_stats')
    .select('*')
    .eq('event_id', event.id)
    .single()

  // Log analytics
  await supabase.from('analytics_events').insert({
    event_id: event.id,
    user_id: userId,
    event_type: 'event_ended',
    payload: {
      ended_at: now,
      total_teams: stats?.total_teams || 0,
      finished_teams: stats?.finished_teams || 0
    }
  })

  return {
    success: true,
    message: 'Event ended',
    event_status: 'completed',
    remaining_seconds: 0
  }
}

async function handleReset(
  supabase: any,
  event: any,
  userId: string,
  resetTeams: boolean = false
): Promise<EventControlResponse> {
  // Reset event to scheduled state
  await supabase
    .from('events')
    .update({
      status: 'scheduled',
      started_at: null,
      paused_at: null,
      ended_at: null,
      accumulated_pause_seconds: 0
    })
    .eq('id', event.id)

  // Delete all progress records
  await supabase
    .from('team_progress')
    .delete()
    .eq('stage_id', supabase.from('stages').select('id').eq('event_id', event.id))

  // Actually, better approach - delete via teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .eq('event_id', event.id)

  const teamIds = teams?.map((t: any) => t.id) || []

  if (teamIds.length > 0) {
    // Delete progress
    await supabase
      .from('team_progress')
      .delete()
      .in('team_id', teamIds)

    // Delete hint usage
    await supabase
      .from('hint_usage')
      .delete()
      .in('team_id', teamIds)

    // Delete code attempts
    await supabase
      .from('code_attempts')
      .delete()
      .in('team_id', teamIds)

    // Reset team state
    await supabase
      .from('teams')
      .update({
        total_points: 0,
        current_stage_index: 0,
        started_at: null,
        finished_at: null,
        hints_remaining: event.hints_per_team
      })
      .eq('event_id', event.id)
  }

  if (resetTeams) {
    // Delete all teams and members
    await supabase
      .from('teams')
      .delete()
      .eq('event_id', event.id)
  }

  return {
    success: true,
    message: resetTeams ? 'Event reset (teams cleared)' : 'Event reset',
    event_status: 'scheduled',
    remaining_seconds: event.duration_seconds
  }
}

