// ============================================
// Application Constants
// Escape Room Platform
// ============================================

// ============================================
// TIMER
// ============================================

export const TIMER = {
  /** Default event duration in seconds (1 hour) */
  DEFAULT_DURATION: 3600,
  
  /** Minimum allowed duration (5 minutes) */
  MIN_DURATION: 300,
  
  /** Maximum allowed duration (4 hours) */
  MAX_DURATION: 14400,
  
  /** Client-side sync interval in milliseconds */
  SYNC_INTERVAL: 30000,
  
  /** Warning threshold in seconds (5 minutes remaining) */
  WARNING_THRESHOLD: 300,
  
  /** Critical threshold in seconds (1 minute remaining) */
  CRITICAL_THRESHOLD: 60,
} as const;

// ============================================
// TEAMS
// ============================================

export const TEAMS = {
  /** Default max team size */
  DEFAULT_MAX_SIZE: 6,
  
  /** Minimum team size */
  MIN_SIZE: 1,
  
  /** Maximum team size */
  MAX_SIZE: 20,
  
  /** Join code length */
  JOIN_CODE_LENGTH: 8,
  
  /** Available team colors */
  COLORS: [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#6b7280', // gray
  ],
} as const;

// ============================================
// STAGES
// ============================================

export const STAGES = {
  /** Entry code length */
  ENTRY_CODE_LENGTH: 6,
  
  /** Default points per stage */
  DEFAULT_POINTS: 100,
  
  /** Maximum points per stage */
  MAX_POINTS: 1000,
  
  /** Supported puzzle types */
  PUZZLE_TYPES: [
    'text',
    'numeric',
    'multiple_choice',
    'sequence',
    'cipher',
    'image',
  ],
} as const;

// ============================================
// HINTS
// ============================================

export const HINTS = {
  /** Default max hints per team per event */
  DEFAULT_MAX_PER_TEAM: 5,
  
  /** Maximum hints allowed per team */
  MAX_PER_TEAM: 20,
  
  /** Default time penalty in seconds */
  DEFAULT_PENALTY_SECONDS: 60,
  
  /** Default points penalty */
  DEFAULT_PENALTY_POINTS: 10,
} as const;

// ============================================
// REALTIME CHANNELS
// ============================================

export const CHANNELS = {
  /** Event updates (timer, status) */
  event: (eventId: string) => `event:${eventId}`,
  
  /** Team updates (progress, hints) */
  team: (teamId: string) => `team:${teamId}`,
  
  /** Admin broadcasts */
  adminBroadcast: (eventId: string) => `event:${eventId}:admin`,
  
  /** Leaderboard updates */
  leaderboard: (eventId: string) => `event:${eventId}:leaderboard`,
} as const;

// ============================================
// ROUTES
// ============================================

export const ROUTES = {
  // Public
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  JOIN: '/join',
  JOIN_WITH_CODE: (code: string) => `/join/${code}`,
  
  // Player
  GAME: (eventId: string) => `/game/${eventId}`,
  STAGE: (eventId: string, stageId: string) => `/game/${eventId}/stage/${stageId}`,
  STAGE_BY_CODE: (eventId: string, code: string) => `/game/${eventId}/enter/${code}`,
  
  // Admin
  ADMIN: '/admin',
  ADMIN_EVENTS: '/admin/events',
  ADMIN_EVENT: (eventId: string) => `/admin/events/${eventId}`,
  ADMIN_EVENT_EDIT: (eventId: string) => `/admin/events/${eventId}/edit`,
  ADMIN_ANALYTICS: (eventId: string) => `/admin/events/${eventId}/analytics`,
} as const;

// ============================================
// ANALYTICS EVENT TYPES
// ============================================

export const ANALYTICS_EVENTS = {
  // Team lifecycle
  TEAM_CREATED: 'team_created',
  PLAYER_JOINED: 'player_joined',
  
  // Game progress
  STAGE_STARTED: 'stage_started',
  STAGE_COMPLETED: 'stage_completed',
  WRONG_ANSWER: 'wrong_answer',
  
  // Hints
  HINT_REVEALED: 'hint_revealed',
  
  // Navigation
  QR_SCANNED: 'qr_scanned',
  
  // Timer
  TIMER_STARTED: 'timer_started',
  TIMER_PAUSED: 'timer_paused',
  TIMER_RESUMED: 'timer_resumed',
  EVENT_ENDED: 'event_ended',
} as const;

// ============================================
// ERROR MESSAGES
// ============================================

export const ERRORS = {
  // Auth
  NOT_AUTHENTICATED: 'You must be logged in to perform this action.',
  NOT_AUTHORIZED: 'You are not authorized to perform this action.',
  
  // Events
  EVENT_NOT_FOUND: 'Event not found.',
  EVENT_NOT_ACTIVE: 'This event is not currently active.',
  EVENT_NOT_ACCEPTING_TEAMS: 'This event is not accepting new teams.',
  
  // Teams
  TEAM_NOT_FOUND: 'Team not found.',
  INVALID_JOIN_CODE: 'Invalid join code.',
  ALREADY_IN_TEAM: 'You are already in a team for this event.',
  TEAM_FULL: 'This team is full.',
  LATE_JOIN_NOT_ALLOWED: 'Late joining is not allowed for this event.',
  
  // Stages
  STAGE_NOT_FOUND: 'Stage not found.',
  STAGE_LOCKED: 'This stage is not yet accessible.',
  INVALID_ENTRY_CODE: 'Invalid entry code.',
  PREVIOUS_STAGE_INCOMPLETE: 'Complete the previous stage first.',
  
  // Timer
  TIME_EXPIRED: 'Time has expired.',
  TIMER_NOT_RUNNING: 'Timer is not running.',
  TIMER_NOT_PAUSED: 'Timer is not paused.',
  
  // Hints
  HINT_LIMIT_REACHED: 'You have used all available hints.',
  NO_MORE_HINTS: 'No more hints available for this stage.',
  
  // Generic
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
} as const;

// ============================================
// LOCAL STORAGE KEYS
// ============================================

export const STORAGE_KEYS = {
  /** Current team ID */
  CURRENT_TEAM: 'escape_room_team_id',
  
  /** Current event ID */
  CURRENT_EVENT: 'escape_room_event_id',
  
  /** Theme preference */
  THEME: 'escape_room_theme',
  
  /** Sound preference */
  SOUND_ENABLED: 'escape_room_sound',
} as const;

