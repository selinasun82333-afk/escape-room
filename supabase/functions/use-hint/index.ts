// ============================================================================
// EDGE FUNCTION: use-hint
// ============================================================================
// Consumes a hint for the team and returns the hint content
// Uses session token for player identification (no auth required)
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-token',
}

interface UseHintRequest {
  team_id: string
  hint_id: string
}

interface UseHintResponse {
  success: boolean
  message: string
  hint_content?: string
  hint_title?: string
  remaining_hints?: number
  point_penalty?: number
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
    const { team_id, hint_id }: UseHintRequest = await req.json()

    if (!team_id || !hint_id) {
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

    // Get team info
    const { data: team } = await supabase
      .from('teams')
      .select(`
        id,
        event_id,
        hints_remaining,
        is_active,
        events (
          status
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
    if (event.status !== 'active' && event.status !== 'paused') {
      return new Response(
        JSON.stringify({ success: false, message: 'Event is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if hint already used - if so, return content without penalty
    const { data: existingUsage } = await supabase
      .from('hint_usage')
      .select('id')
      .eq('team_id', team_id)
      .eq('hint_id', hint_id)
      .single()

    if (existingUsage) {
      // Return the hint content again (already used, no penalty)
      const { data: hint } = await supabase
        .from('hints')
        .select('title, content, point_penalty')
        .eq('id', hint_id)
        .single()

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Hint already revealed',
          hint_content: hint?.content,
          hint_title: hint?.title,
          remaining_hints: team.hints_remaining,
          point_penalty: 0 // No penalty for re-viewing
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use the can_use_hint function for validation
    const { data: canUse } = await supabase
      .rpc('can_use_hint', { p_team_id: team_id, p_hint_id: hint_id })

    if (!canUse) {
      // Determine specific reason
      if (team.hints_remaining <= 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'No hints remaining',
            remaining_hints: 0
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Cannot use this hint (stage may not be active)'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get hint info (can_use_hint already validated stage is active)
    const { data: hint } = await supabase
      .from('hints')
      .select(`
        id,
        title,
        content,
        point_penalty,
        stage_id
      `)
      .eq('id', hint_id)
      .single()

    if (!hint) {
      return new Response(
        JSON.stringify({ success: false, message: 'Hint not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get team progress for this stage
    const { data: progress } = await supabase
      .from('team_progress')
      .select('id, started_at, hint_penalties')
      .eq('team_id', team_id)
      .eq('stage_id', hint.stage_id)
      .single()

    if (!progress) {
      return new Response(
        JSON.stringify({ success: false, message: 'Progress record not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate time in stage
    const timeInStageSeconds = progress.started_at
      ? Math.floor((Date.now() - new Date(progress.started_at).getTime()) / 1000)
      : 0

    // Record hint usage
    await supabase.from('hint_usage').insert({
      team_id,
      hint_id,
      requested_by_session: sessionToken,
      time_in_stage_seconds: timeInStageSeconds
    })

    // Update team progress with hint penalty
    await supabase
      .from('team_progress')
      .update({
        hint_penalties: (progress.hint_penalties || 0) + hint.point_penalty
      })
      .eq('id', progress.id)

    // Note: hints_remaining is decremented by trigger

    // Log analytics
    await supabase.from('analytics_events').insert({
      event_id: team.event_id,
      team_id,
      stage_id: hint.stage_id,
      session_token: sessionToken,
      event_type: 'hint_revealed',
      payload: {
        hint_id,
        time_in_stage_seconds: timeInStageSeconds,
        point_penalty: hint.point_penalty,
        requested_by: member.display_name
      }
    })

    const response: UseHintResponse = {
      success: true,
      message: 'Hint revealed',
      hint_content: hint.content,
      hint_title: hint.title,
      remaining_hints: team.hints_remaining - 1,
      point_penalty: hint.point_penalty
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
