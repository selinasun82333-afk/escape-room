// ============================================================================
// EDGE FUNCTION: timer-sync
// ============================================================================
// Provides authoritative timer state for client synchronization
// Clients calculate time locally and sync periodically to correct drift
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-token',
}

interface TimerSyncRequest {
  event_id: string
}

interface TimerSyncResponse {
  success: boolean
  server_time: number // Unix timestamp in ms
  event_id: string
  status: string
  duration_seconds: number
  started_at: string | null
  paused_at: string | null
  accumulated_pause_seconds: number
  remaining_seconds: number
  elapsed_seconds: number
  is_running: boolean
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

    // Parse request body
    const { event_id }: TimerSyncRequest = await req.json()

    if (!event_id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing event_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get event timer state
    const { data: event, error } = await supabase
      .from('events')
      .select('id, status, duration_seconds, started_at, paused_at, accumulated_pause_seconds')
      .eq('id', event_id)
      .single()

    if (error || !event) {
      return new Response(
        JSON.stringify({ success: false, message: 'Event not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate timer values server-side
    const now = Date.now()
    let elapsedSeconds = 0
    let remainingSeconds = event.duration_seconds
    let isRunning = false

    if (event.started_at) {
      const startedAt = new Date(event.started_at).getTime()
      
      if (event.status === 'paused' && event.paused_at) {
        // Timer is paused - calculate elapsed up to pause point
        const pausedAt = new Date(event.paused_at).getTime()
        elapsedSeconds = Math.floor((pausedAt - startedAt) / 1000) - event.accumulated_pause_seconds
      } else if (event.status === 'active') {
        // Timer is running
        elapsedSeconds = Math.floor((now - startedAt) / 1000) - event.accumulated_pause_seconds
        isRunning = true
      } else if (event.status === 'completed') {
        // Event ended - show 0
        elapsedSeconds = event.duration_seconds
      }

      remainingSeconds = Math.max(0, event.duration_seconds - elapsedSeconds)
    }

    const response: TimerSyncResponse = {
      success: true,
      server_time: now,
      event_id: event.id,
      status: event.status,
      duration_seconds: event.duration_seconds,
      started_at: event.started_at,
      paused_at: event.paused_at,
      accumulated_pause_seconds: event.accumulated_pause_seconds,
      remaining_seconds: remainingSeconds,
      elapsed_seconds: elapsedSeconds,
      is_running: isRunning
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

