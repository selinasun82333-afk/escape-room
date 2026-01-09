// ============================================================================
// EDGE FUNCTION: join-team
// ============================================================================
// Handles team joining with join code validation (no auth required)
// Returns a session token for the player to store in localStorage
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface JoinTeamRequest {
  event_id: string
  join_code: string
  display_name: string
}

interface JoinTeamResponse {
  success: boolean
  message: string
  session_token?: string
  team_id?: string
  team_name?: string
  event_name?: string
  member_id?: string
  is_captain?: boolean
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Use service role for all operations (no user auth required)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Parse request body
    const { event_id, join_code, display_name }: JoinTeamRequest = await req.json()

    if (!event_id || !join_code || !display_name) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required fields: event_id, join_code, display_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate display name
    const trimmedName = display_name.trim()
    if (trimmedName.length < 1 || trimmedName.length > 50) {
      return new Response(
        JSON.stringify({ success: false, message: 'Display name must be 1-50 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get event
    const { data: event } = await supabase
      .from('events')
      .select('id, name, status, max_team_size, allow_late_join')
      .eq('id', event_id)
      .single()

    if (!event) {
      return new Response(
        JSON.stringify({ success: false, message: 'Event not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check event status
    const allowedStatuses = ['scheduled']
    if (event.allow_late_join) {
      allowedStatuses.push('active', 'paused')
    }

    if (!allowedStatuses.includes(event.status)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: event.status === 'active' || event.status === 'paused'
            ? 'Event has already started and late joining is not allowed'
            : `Cannot join event in '${event.status}' status`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find team by join code (case-insensitive)
    const { data: team } = await supabase
      .from('teams')
      .select('id, name, is_active')
      .eq('event_id', event_id)
      .ilike('join_code', join_code.toUpperCase())
      .single()

    if (!team) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid join code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!team.is_active) {
      return new Response(
        JSON.stringify({ success: false, message: 'Team is no longer active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Count current members
    const { count: memberCount } = await supabase
      .from('team_members')
      .select('id', { count: 'exact' })
      .eq('team_id', team.id)

    if (event.max_team_size && memberCount && memberCount >= event.max_team_size) {
      return new Response(
        JSON.stringify({ success: false, message: 'Team is full' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if this is the first member (make them captain)
    const isCaptain = memberCount === 0

    // Add member with generated session token
    const { data: newMember, error: insertError } = await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        display_name: trimmedName,
        is_captain: isCaptain,
        is_online: true
      })
      .select('id, session_token')
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to join team' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log analytics
    await supabase.from('analytics_events').insert({
      event_id,
      team_id: team.id,
      session_token: newMember.session_token,
      event_type: 'member_joined',
      payload: {
        display_name: trimmedName,
        is_captain: isCaptain,
        member_number: (memberCount || 0) + 1
      }
    })

    const response: JoinTeamResponse = {
      success: true,
      message: `Welcome to team "${team.name}"!`,
      session_token: newMember.session_token,
      team_id: team.id,
      team_name: team.name,
      event_name: event.name,
      member_id: newMember.id,
      is_captain: isCaptain
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
