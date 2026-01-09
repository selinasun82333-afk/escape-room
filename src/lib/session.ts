// ============================================================================
// SESSION MANAGEMENT
// ============================================================================
// Handles player session storage and retrieval using localStorage
// No authentication required - session token identifies the player
// ============================================================================

import type { PlayerSession, JoinTeamResponse } from '../types/database.types'

const SESSION_KEY = 'escape_room_session'

// ============================================================================
// SESSION STORAGE
// ============================================================================

/**
 * Save player session to localStorage
 */
export function saveSession(response: JoinTeamResponse): PlayerSession | null {
  if (!response.success || !response.session_token) {
    return null
  }

  const session: PlayerSession = {
    sessionToken: response.session_token,
    teamId: response.team_id!,
    teamName: response.team_name!,
    eventId: '', // Will be set from context
    eventName: response.event_name!,
    memberId: response.member_id!,
    displayName: '', // Will be set from join form
    isCaptain: response.is_captain || false,
    joinedAt: new Date().toISOString(),
  }

  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return session
  } catch (e) {
    console.error('Failed to save session:', e)
    return null
  }
}

/**
 * Create and save a full session (used after join-team call)
 */
export function createSession(data: {
  sessionToken: string
  teamId: string
  teamName: string
  eventId: string
  eventName: string
  memberId: string
  displayName: string
  isCaptain: boolean
}): PlayerSession {
  const session: PlayerSession = {
    ...data,
    joinedAt: new Date().toISOString(),
  }

  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch (e) {
    console.error('Failed to save session:', e)
  }

  return session
}

/**
 * Get current session from localStorage
 */
export function getSession(): PlayerSession | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (!stored) return null

    const session = JSON.parse(stored) as PlayerSession
    
    // Validate required fields
    if (!session.sessionToken || !session.teamId) {
      clearSession()
      return null
    }

    return session
  } catch (e) {
    console.error('Failed to read session:', e)
    clearSession()
    return null
  }
}

/**
 * Clear session from localStorage
 */
export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch (e) {
    console.error('Failed to clear session:', e)
  }
}

/**
 * Check if a session exists
 */
export function hasSession(): boolean {
  return getSession() !== null
}

/**
 * Update session display name
 */
export function updateSessionDisplayName(displayName: string): void {
  const session = getSession()
  if (session) {
    session.displayName = displayName
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch (e) {
      console.error('Failed to update session:', e)
    }
  }
}

// ============================================================================
// SESSION TOKEN HEADER
// ============================================================================

/**
 * Get headers for API requests that require session authentication
 */
export function getSessionHeaders(): Record<string, string> {
  const session = getSession()
  if (!session) {
    return {}
  }

  return {
    'x-session-token': session.sessionToken,
  }
}

/**
 * Get session token for API requests
 */
export function getSessionToken(): string | null {
  const session = getSession()
  return session?.sessionToken || null
}

// ============================================================================
// SESSION VALIDATION
// ============================================================================

/**
 * Check if session is valid for a specific team
 */
export function isSessionValidForTeam(teamId: string): boolean {
  const session = getSession()
  return session?.teamId === teamId
}

/**
 * Check if session is valid for a specific event
 */
export function isSessionValidForEvent(eventId: string): boolean {
  const session = getSession()
  return session?.eventId === eventId
}

// ============================================================================
// SESSION EVENTS
// ============================================================================

type SessionEventType = 'session_created' | 'session_cleared' | 'session_updated'
type SessionEventCallback = (session: PlayerSession | null) => void

const sessionListeners: Map<string, SessionEventCallback> = new Map()

/**
 * Subscribe to session changes
 */
export function onSessionChange(
  id: string,
  callback: SessionEventCallback
): () => void {
  sessionListeners.set(id, callback)
  
  // Return unsubscribe function
  return () => {
    sessionListeners.delete(id)
  }
}

/**
 * Emit session change event
 */
function emitSessionChange(session: PlayerSession | null): void {
  sessionListeners.forEach((callback) => {
    try {
      callback(session)
    } catch (e) {
      console.error('Session listener error:', e)
    }
  })
}

// ============================================================================
// STORAGE EVENT LISTENER
// ============================================================================

// Listen for changes from other tabs
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === SESSION_KEY) {
      const session = event.newValue ? JSON.parse(event.newValue) : null
      emitSessionChange(session)
    }
  })
}

