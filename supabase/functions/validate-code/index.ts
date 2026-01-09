// ============================================================================
// EDGE FUNCTION: validate-code
// ============================================================================
// Validates QR/manual code entry and advances team progress
// Uses session token for player identification (no auth required)
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-token',
}

interface ValidateCodeRequest {
  team_id: string
  stage_id: string
  code: string
}

interface ValidateCodeResponse {
  success: boolean
  message: string
  next_stage_id?: string
  points_earned?: number
  time_bonus?: number
  is_final_stage?: boolean
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    // Get session token from header
    const sessionToken = req.headers.get('x-session-token')
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing session token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { team_id, stage_id, code }: ValidateCodeRequest = await req.json()

    if (!team_id || !stage_id || !code) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate session token belongs to this team
    const { data: member } = await supabase
      .from('team_members')
      .select('id, display_name')
      .eq('session_token', sessionToken)
      .eq('team_id', team_id)
      .single()

    if (!member) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid session for this team' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update last active timestamp
    await supabase
      .from('team_members')
      .update({ last_active_at: new Date().toISOString(), is_online: true })
      .eq('id', member.id)

    // Get team and event info
    const { data: team } = await supabase
      .from('teams')
      .select(`
        id,
        event_id,
        is_active,
        events (
          id,
          status,
          started_at,
          duration_seconds
        )
      `)
      .eq('id', team_id)
      .single()

    if (!team || !team.is_active) {
      return new Response(
        JSON.stringify({ success: false, message: 'Team not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const event = team.events as any
    if (event.status !== 'active') {
      return new Response(
        JSON.stringify({ success: false, message: 'Event is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get stage info
    const { data: stage } = await supabase
      .from('stages')
      .select('id, unlock_code, order_index, base_points, time_bonus_enabled, event_id')
      .eq('id', stage_id)
      .single()

    if (!stage || stage.event_id !== team.event_id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid stage' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get team's progress for this stage
    const { data: progress } = await supabase
      .from('team_progress')
      .select('*')
      .eq('team_id', team_id)
      .eq('stage_id', stage_id)
      .single()

    if (!progress || progress.status !== 'active') {
      return new Response(
        JSON.stringify({ success: false, message: 'Stage not active for this team' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate time in stage
    const timeInStageSeconds = progress.started_at 
      ? Math.floor((Date.now() - new Date(progress.started_at).getTime()) / 1000)
      : 0

    // Log the attempt
    await supabase.from('code_attempts').insert({
      team_id,
      stage_id,
      submitted_code: code,
      is_correct: code.toUpperCase() === stage.unlock_code.toUpperCase(),
      submitted_by_session: sessionToken,
      time_in_stage_seconds: timeInStageSeconds
    })

    // Validate the code (case-insensitive)
    if (code.toUpperCase() !== stage.unlock_code.toUpperCase()) {
      // Update attempt count
      await supabase
        .from('team_progress')
        .update({ 
          attempt_count: progress.attempt_count + 1,
          last_attempt_at: new Date().toISOString()
        })
        .eq('id', progress.id)

      // Log analytics
      await supabase.from('analytics_events').insert({
        event_id: team.event_id,
        team_id,
        stage_id,
        session_token: sessionToken,
        event_type: 'code_attempt_failed',
        payload: { 
          attempt_number: progress.attempt_count + 1,
          submitted_by: member.display_name
        }
      })

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Incorrect code' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Code is correct! Calculate points and time bonus
    let timeBonus = 0
    if (stage.time_bonus_enabled && timeInStageSeconds < 300) {
      // Bonus for completing in under 5 minutes
      timeBonus = Math.max(0, Math.floor((300 - timeInStageSeconds) / 6))
    }

    const pointsEarned = stage.base_points

    // Update current stage progress
    await supabase
      .from('team_progress')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        attempt_count: progress.attempt_count + 1,
        points_earned: pointsEarned,
        time_bonus: timeBonus
      })
      .eq('id', progress.id)

    // Get next stage
    const { data: nextStage } = await supabase
      .from('stages')
      .select('id, order_index')
      .eq('event_id', team.event_id)
      .gt('order_index', stage.order_index)
      .order('order_index', { ascending: true })
      .limit(1)
      .single()

    let isFinalStage = false

    if (nextStage) {
      // Unlock next stage
      await supabase
        .from('team_progress')
        .update({
          status: 'active',
          unlocked_at: new Date().toISOString(),
          started_at: new Date().toISOString()
        })
        .eq('team_id', team_id)
        .eq('stage_id', nextStage.id)
    } else {
      // This was the final stage - team finished!
      isFinalStage = true
      await supabase
        .from('teams')
        .update({
          finished_at: new Date().toISOString()
        })
        .eq('id', team_id)
    }

    // Log analytics
    await supabase.from('analytics_events').insert({
      event_id: team.event_id,
      team_id,
      stage_id,
      session_token: sessionToken,
      event_type: 'stage_completed',
      payload: {
        duration_seconds: timeInStageSeconds,
        attempts: progress.attempt_count + 1,
        points_earned: pointsEarned,
        time_bonus: timeBonus,
        completed_by: member.display_name
      }
    })

    if (nextStage) {
      await supabase.from('analytics_events').insert({
        event_id: team.event_id,
        team_id,
        stage_id: nextStage.id,
        session_token: sessionToken,
        event_type: 'stage_unlocked',
        payload: {}
      })
    }

    const response: ValidateCodeResponse = {
      success: true,
      message: isFinalStage ? 'Congratulations! You completed the escape room!' : 'Stage completed!',
      next_stage_id: nextStage?.id,
      points_earned: pointsEarned,
      time_bonus: timeBonus,
      is_final_stage: isFinalStage
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
