// ============================================================================
// TIMER SYNCHRONIZATION
// ============================================================================
// Client-side timer with server sync for accuracy
// 
// Strategy:
// 1. Client calculates time locally every second (smooth UX)
// 2. Sync with server every 10 seconds to correct drift
// 3. Realtime subscription for state changes (start/pause/resume/end)
// 4. Network latency compensation on sync
// ============================================================================

import type { EventStatus } from '../types/database.types'

// ============================================================================
// TYPES
// ============================================================================

export interface TimerState {
  eventId: string
  status: EventStatus
  durationSeconds: number
  startedAt: string | null
  pausedAt: string | null
  accumulatedPauseSeconds: number
  remainingSeconds: number
  elapsedSeconds: number
  isRunning: boolean
  lastSyncAt: number
  serverTimeOffset: number // Client time - Server time (for latency compensation)
}

export interface TimerSyncResponse {
  success: boolean
  server_time: number
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

// ============================================================================
// TIMER CALCULATOR
// ============================================================================

/**
 * Calculate remaining time from event state
 * This runs client-side every second
 */
export function calculateRemainingTime(state: TimerState): {
  remaining: number
  elapsed: number
  isRunning: boolean
} {
  if (!state.startedAt) {
    return {
      remaining: state.durationSeconds,
      elapsed: 0,
      isRunning: false
    }
  }

  const now = Date.now() - state.serverTimeOffset // Adjusted for server time
  const startedAt = new Date(state.startedAt).getTime()

  let elapsed: number

  if (state.status === 'paused' && state.pausedAt) {
    // Timer is paused - calculate elapsed up to pause point
    const pausedAt = new Date(state.pausedAt).getTime()
    elapsed = Math.floor((pausedAt - startedAt) / 1000) - state.accumulatedPauseSeconds
  } else if (state.status === 'active') {
    // Timer is running
    elapsed = Math.floor((now - startedAt) / 1000) - state.accumulatedPauseSeconds
  } else if (state.status === 'completed') {
    elapsed = state.durationSeconds
  } else {
    elapsed = 0
  }

  const remaining = Math.max(0, state.durationSeconds - elapsed)
  
  return {
    remaining,
    elapsed,
    isRunning: state.status === 'active' && remaining > 0
  }
}

/**
 * Format seconds as MM:SS or HH:MM:SS
 */
export function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Format seconds as human readable (e.g., "5 min 30 sec")
 */
export function formatTimeReadable(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)

  return parts.join(' ')
}

// ============================================================================
// SYNC MANAGER
// ============================================================================

export class TimerSyncManager {
  private state: TimerState
  private syncInterval: number | null = null
  private tickInterval: number | null = null
  private onTick: (state: TimerState) => void
  private onStateChange: (state: TimerState) => void
  private supabaseUrl: string
  private supabaseAnonKey: string
  
  // Sync settings
  private readonly SYNC_INTERVAL_MS = 10000 // Sync every 10 seconds
  private readonly TICK_INTERVAL_MS = 1000  // Update every second
  private readonly MAX_DRIFT_MS = 2000      // Re-sync if drift > 2 seconds

  constructor(options: {
    eventId: string
    supabaseUrl: string
    supabaseAnonKey: string
    onTick: (state: TimerState) => void
    onStateChange: (state: TimerState) => void
  }) {
    this.supabaseUrl = options.supabaseUrl
    this.supabaseAnonKey = options.supabaseAnonKey
    this.onTick = options.onTick
    this.onStateChange = options.onStateChange
    
    this.state = {
      eventId: options.eventId,
      status: 'scheduled',
      durationSeconds: 0,
      startedAt: null,
      pausedAt: null,
      accumulatedPauseSeconds: 0,
      remainingSeconds: 0,
      elapsedSeconds: 0,
      isRunning: false,
      lastSyncAt: 0,
      serverTimeOffset: 0
    }
  }

  /**
   * Start the timer sync manager
   */
  async start(): Promise<void> {
    // Initial sync
    await this.sync()

    // Start periodic sync
    this.syncInterval = setInterval(() => {
      this.sync()
    }, this.SYNC_INTERVAL_MS) as unknown as number

    // Start local tick
    this.tickInterval = setInterval(() => {
      this.tick()
    }, this.TICK_INTERVAL_MS) as unknown as number
  }

  /**
   * Stop the timer sync manager
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }
  }

  /**
   * Sync with server
   */
  async sync(): Promise<void> {
    try {
      const requestTime = Date.now()
      
      const response = await fetch(`${this.supabaseUrl}/functions/v1/timer-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseAnonKey
        },
        body: JSON.stringify({ event_id: this.state.eventId })
      })

      const responseTime = Date.now()
      const data: TimerSyncResponse = await response.json()

      if (!data.success) {
        console.error('Timer sync failed:', data)
        return
      }

      // Calculate network latency and server time offset
      const roundTripTime = responseTime - requestTime
      const estimatedServerTime = data.server_time + (roundTripTime / 2)
      const serverTimeOffset = Date.now() - estimatedServerTime

      const previousStatus = this.state.status

      // Update state
      this.state = {
        ...this.state,
        status: data.status as EventStatus,
        durationSeconds: data.duration_seconds,
        startedAt: data.started_at,
        pausedAt: data.paused_at,
        accumulatedPauseSeconds: data.accumulated_pause_seconds,
        remainingSeconds: data.remaining_seconds,
        elapsedSeconds: data.elapsed_seconds,
        isRunning: data.is_running,
        lastSyncAt: Date.now(),
        serverTimeOffset
      }

      // Notify if state changed
      if (previousStatus !== data.status) {
        this.onStateChange(this.state)
      }

    } catch (error) {
      console.error('Timer sync error:', error)
    }
  }

  /**
   * Local tick - calculate time client-side
   */
  private tick(): void {
    if (!this.state.isRunning) {
      this.onTick(this.state)
      return
    }

    const { remaining, elapsed, isRunning } = calculateRemainingTime(this.state)
    
    // Check for significant drift
    const drift = Math.abs(remaining - this.state.remainingSeconds)
    if (drift > this.MAX_DRIFT_MS / 1000) {
      // Re-sync if drift is too high
      this.sync()
    }

    this.state = {
      ...this.state,
      remainingSeconds: remaining,
      elapsedSeconds: elapsed,
      isRunning
    }

    this.onTick(this.state)

    // Check if timer just ended
    if (remaining === 0 && isRunning === false && this.state.status === 'active') {
      this.sync() // Sync to get final state
    }
  }

  /**
   * Handle realtime event state change
   */
  handleRealtimeUpdate(payload: {
    status: EventStatus
    started_at: string | null
    paused_at: string | null
    accumulated_pause_seconds: number
  }): void {
    const previousStatus = this.state.status

    this.state = {
      ...this.state,
      status: payload.status,
      startedAt: payload.started_at,
      pausedAt: payload.paused_at,
      accumulatedPauseSeconds: payload.accumulated_pause_seconds
    }

    // Recalculate times
    const { remaining, elapsed, isRunning } = calculateRemainingTime(this.state)
    this.state.remainingSeconds = remaining
    this.state.elapsedSeconds = elapsed
    this.state.isRunning = isRunning

    if (previousStatus !== payload.status) {
      this.onStateChange(this.state)
    }

    this.onTick(this.state)
  }

  /**
   * Get current state
   */
  getState(): TimerState {
    return { ...this.state }
  }

  /**
   * Force sync now
   */
  forceSync(): Promise<void> {
    return this.sync()
  }
}

// ============================================================================
// TIMER HOOKS HELPERS
// ============================================================================

/**
 * Get urgency level based on remaining time
 */
export function getTimerUrgency(remainingSeconds: number): 'normal' | 'warning' | 'critical' {
  if (remainingSeconds <= 60) return 'critical'      // Last minute
  if (remainingSeconds <= 300) return 'warning'      // Last 5 minutes
  return 'normal'
}

/**
 * Get progress percentage
 */
export function getTimerProgress(elapsedSeconds: number, durationSeconds: number): number {
  if (durationSeconds === 0) return 0
  return Math.min(100, (elapsedSeconds / durationSeconds) * 100)
}

