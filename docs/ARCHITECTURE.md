# Escape Room Platform - System Architecture

## Overview

A real-time, event-based escape room platform supporting multiple teams per event with synchronized game state, admin-controlled timers, and comprehensive analytics.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + TypeScript |
| State Management | Zustand + Supabase Realtime |
| Styling | Tailwind CSS |
| Backend | Supabase (PostgreSQL + Edge Functions) |
| Auth | Supabase Auth (Magic Link for teams, Email/Password for admins) |
| Real-time | Supabase Realtime (Postgres Changes + Broadcast) |

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────┐          ┌─────────────────────┐                 │
│   │   Admin Dashboard   │          │   Team Play View    │                 │
│   │  - Event Management │          │  - Stage Display    │                 │
│   │  - Timer Control    │          │  - Code Entry       │                 │
│   │  - Live Monitoring  │          │  - Hint Requests    │                 │
│   │  - Analytics        │          │  - Team Chat        │                 │
│   └──────────┬──────────┘          └──────────┬──────────┘                 │
│              │                                │                             │
└──────────────┼────────────────────────────────┼─────────────────────────────┘
               │                                │
               ▼                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│   │  Supabase Auth  │  │ Supabase        │  │ Edge Functions  │            │
│   │  - Admin users  │  │ Realtime        │  │ - validate_code │            │
│   │  - Team tokens  │  │ - Timer sync    │  │ - use_hint      │            │
│   │                 │  │ - State changes │  │ - start_event   │            │
│   └────────┬────────┘  │ - Broadcasts    │  │ - end_event     │            │
│            │           └────────┬────────┘  └────────┬────────┘            │
│            │                    │                    │                      │
│            ▼                    ▼                    ▼                      │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                    PostgreSQL Database                          │      │
│   │                    + Row Level Security                         │      │
│   └─────────────────────────────────────────────────────────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Entities

### 1. Events
Top-level container for an escape room session (e.g., "Corporate Team Building - Jan 2026")

### 2. Stages
Sequential puzzles/challenges within an event (ordered)

### 3. Teams
Groups of players participating in an event

### 4. Team Members
Individual players within a team

### 5. Team Progress
Real-time state of a team's progress through stages

### 6. Hints
Pre-configured hints per stage with usage tracking

### 7. Analytics Events
Granular tracking of all game actions

---

## Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Event     │────▶│    Stages    │────▶│    Hints     │
│   Created    │     │   Defined    │     │  Configured  │
└──────────────┘     └──────────────┘     └──────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Teams     │────▶│ Team Members │────▶│   Join via   │
│  Registered  │     │   Join Team  │     │  Magic Link  │
└──────────────┘     └──────────────┘     └──────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Admin Starts │────▶│ Timer Begins │────▶│ Teams Play   │
│    Event     │     │  (Realtime)  │     │   Stages     │
└──────────────┘     └──────────────┘     └──────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Code Entry  │────▶│   Validate   │────▶│   Progress   │
│  (QR/Manual) │     │ Edge Function│     │   Updated    │
└──────────────┘     └──────────────┘     └──────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│              Analytics Logged (all actions)              │
└──────────────────────────────────────────────────────────┘
```

---

## Real-time Synchronization Strategy

### Channel Structure

```typescript
// Global event channel (timer, event state)
`event:${event_id}`

// Team-specific channel (progress, hints)
`team:${team_id}`

// Admin monitoring channel
`admin:${event_id}`
```

### Subscription Topics

| Channel | Event Type | Payload | Subscribers |
|---------|------------|---------|-------------|
| `event:{id}` | `timer_tick` | `{ remaining_seconds }` | All teams in event |
| `event:{id}` | `event_state` | `{ status, paused_at }` | All teams + admin |
| `team:{id}` | `progress` | `{ stage_id, completed_at }` | Team members |
| `team:{id}` | `hint_used` | `{ hint_id, stage_id }` | Team members |
| `admin:{id}` | `team_update` | `{ team_id, progress }` | Admin dashboard |

### Timer Implementation

The global timer is **server-authoritative** with **client-side calculation**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TIMER SYNC STRATEGY                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. CLIENT CALCULATION (every 1 second)                                     │
│     ─────────────────────────────────────                                   │
│     remaining = duration - (now - started_at) + accumulated_pause           │
│     → Smooth countdown, no network dependency                               │
│                                                                             │
│  2. SERVER SYNC (every 10 seconds)                                          │
│     ────────────────────────────────                                        │
│     POST /functions/v1/timer-sync { event_id }                              │
│     → Corrects client drift, calculates latency offset                      │
│     → If drift > 2 seconds, force re-sync                                   │
│                                                                             │
│  3. REALTIME EVENTS (on state change)                                       │
│     ─────────────────────────────────                                       │
│     Subscribe to events table changes                                       │
│     → Instant update when admin starts/pauses/resumes/ends                  │
│                                                                             │
│  4. LATENCY COMPENSATION                                                    │
│     ──────────────────────                                                  │
│     serverTimeOffset = clientTime - (serverTime + roundTripTime/2)          │
│     → All calculations use adjusted time                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Timer Calculation Formula:**
```
elapsed = (now - started_at) - accumulated_pause_seconds
remaining = max(0, duration_seconds - elapsed)

If paused:
  elapsed = (paused_at - started_at) - accumulated_pause_seconds
```

**Why This Approach?**
- ❌ Broadcasting every second = expensive, high bandwidth
- ✅ Client calculation = smooth, no flickering
- ✅ Periodic sync = accurate, low bandwidth
- ✅ Realtime events = instant state changes

---

## Authentication Strategy

### Admin Users (Supabase Auth)
- Email/password authentication via Supabase Auth
- Role stored in `profiles.role = 'admin'` or `'organizer'`
- Full access to event management and analytics

### Team Members (Session-Based, No Auth Required)
- **No login required** - players join with event_id + join_code
- Session token generated on join, stored in `localStorage`
- Token passed via `x-session-token` header to Edge Functions
- Session persists until cleared or localStorage is wiped

### How Team Join Works
```
1. Player enters: event_id + join_code + display_name
2. Edge Function validates join_code against team
3. Creates team_member record with generated session_token
4. Returns session_token to client
5. Client stores in localStorage
6. All subsequent requests include x-session-token header
```

### Session Storage
```typescript
// Stored in localStorage
{
  sessionToken: "uuid",
  teamId: "uuid",
  teamName: "Team Alpha",
  eventId: "uuid",
  eventName: "Corporate Challenge",
  memberId: "uuid",
  displayName: "John",
  isCaptain: true,
  joinedAt: "2026-01-09T..."
}
```

---

## Security Model (RLS Overview)

### Access Pattern: Admin vs Player

| Table | Admin (Auth) | Player (Anon + Session) |
|-------|--------------|-------------------------|
| events | CRUD | Read (public active events) |
| stages | CRUD | Read (public, no unlock_code exposed) |
| teams | CRUD | Read (public for leaderboard) |
| team_members | CRUD | Read (public), Insert via Edge Function |
| team_progress | Read all | Read (public), Update via Edge Function |
| hints | CRUD | Read metadata only, content via Edge Function |
| hint_usage | Read all | Read (own team), Insert via Edge Function |
| code_attempts | Read all | Insert via Edge Function |
| analytics_events | Read all | Insert via Edge Function |

### Why Session Tokens?
- **Simpler UX**: No login friction for players
- **Shared devices**: Multiple players can join on same device
- **Privacy**: No email required from players
- **Security**: Tokens are UUID, validated server-side by Edge Functions

### What's Protected
- `stages.unlock_code` - Never exposed to client, validated server-side
- `hints.content` - Protected via RLS + secure view/function
- `code_attempts` - Only organizers can view (analytics)

### Hint Content Protection

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      HINT CONTENT ACCESS CONTROL                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ❌ Direct SELECT on hints table                                            │
│     → RLS blocks non-admin access                                           │
│                                                                             │
│  ✅ v_team_hints view                                                       │
│     → Returns content = NULL until hint is used                             │
│     → Checks hint_usage table for team+hint                                 │
│                                                                             │
│  ✅ get_team_hints(team_id, stage_id?) function                             │
│     → Same logic, returns typed result                                      │
│                                                                             │
│  ✅ use-hint Edge Function                                                  │
│     → Validates can_use_hint()                                              │
│     → Inserts hint_usage record                                             │
│     → Returns content in response                                           │
│                                                                             │
│  Frontend Flow:                                                             │
│  1. Query v_team_hints → see titles, penalties, is_used flags               │
│  2. User clicks "Use Hint" → call use-hint Edge Function                    │
│  3. Response includes content → display to user                             │
│  4. Re-query v_team_hints → content now visible for that hint               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Edge Functions

All Edge Functions use service role to bypass RLS. Player actions require `x-session-token` header.

### 1. `join-team`
Join a team using event_id + join_code (no auth required).

```typescript
// Input (POST body)
{ event_id: string, join_code: string, display_name: string }

// Logic
1. Validate event exists and is joinable
2. Find team by join_code (case-insensitive)
3. Check team capacity
4. Create team_member with generated session_token
5. Log analytics event

// Output
{ 
  success: boolean, 
  session_token: string,  // Store in localStorage!
  team_id: string,
  team_name: string,
  member_id: string,
  is_captain: boolean 
}
```

### 2. `validate-code`
Validates QR/manual code entry for stage completion.

```typescript
// Headers
x-session-token: <session_token>

// Input (POST body)
{ team_id: string, stage_id: string, code: string }

// Logic
1. Validate session_token belongs to team_id
2. Verify event is active
3. Verify stage is active for team
4. Validate code matches stage.unlock_code
5. Update team_progress, unlock next stage
6. Log analytics event

// Output
{ success: boolean, next_stage_id?: string, points_earned?: number, is_final_stage?: boolean }
```

### 3. `use-hint`
Consumes a hint for the team.

```typescript
// Headers
x-session-token: <session_token>

// Input (POST body)
{ team_id: string, hint_id: string }

// Logic
1. Validate session_token belongs to team_id
2. Check hints_remaining > 0
3. Verify hint belongs to team's active stage
4. Insert hint_usage record
5. Decrement team hint counter (via trigger)
6. Log analytics event

// Output
{ success: boolean, hint_content?: string, hint_title?: string, remaining_hints: number }
```

### 4. `event-control`
Admin-only function for event lifecycle (requires Supabase Auth).

```typescript
// Headers
Authorization: Bearer <supabase_jwt>

// Input (POST body)
{ event_id: string, action: 'start' | 'pause' | 'resume' | 'end' | 'reset' }

// Logic
1. Verify caller is admin/organizer via JWT
2. Execute action (update event status/timestamps)
3. Initialize team progress on 'start'
4. Log analytics event

// Output
{ success: boolean, event_status: string, remaining_seconds?: number }
```

### 5. `timer-sync`
Returns authoritative timer state for client synchronization.

```typescript
// Input (POST body)
{ event_id: string }

// Output
{
  success: boolean,
  server_time: number,        // Unix timestamp in ms
  status: string,
  duration_seconds: number,
  started_at: string | null,
  paused_at: string | null,
  accumulated_pause_seconds: number,
  remaining_seconds: number,
  elapsed_seconds: number,
  is_running: boolean
}
```

---

## Analytics Events Tracked

| Event Type | Data Captured |
|------------|---------------|
| `event_started` | event_id, started_at |
| `event_paused` | event_id, paused_at, elapsed |
| `event_ended` | event_id, ended_at, completion_stats |
| `team_joined` | team_id, event_id, member_count |
| `stage_started` | team_id, stage_id, timestamp |
| `stage_completed` | team_id, stage_id, duration, attempts |
| `code_attempt` | team_id, stage_id, code, success |
| `hint_requested` | team_id, stage_id, hint_id |
| `hint_revealed` | team_id, hint_id, time_in_stage |

---

## Scalability Considerations

### Connection Pooling
- Supabase handles connection pooling via PgBouncer
- Real-time connections are WebSocket-based

### Rate Limiting
- Code validation: 1 attempt per second per team
- Hint requests: 1 per 5 seconds per team

### Data Retention
- Active events: Full real-time sync
- Completed events: Analytics preserved, real-time disabled
- Archival: Events older than 1 year moved to cold storage

---

## File Structure (Frontend - Preview)

```
src/
├── lib/
│   ├── supabase.ts          # Supabase client config
│   ├── realtime.ts          # Real-time subscription hooks
│   └── api/
│       ├── events.ts        # Event CRUD operations
│       ├── teams.ts         # Team management
│       ├── stages.ts        # Stage operations
│       └── analytics.ts     # Analytics queries
├── stores/
│   ├── gameStore.ts         # Zustand store for game state
│   ├── timerStore.ts        # Timer synchronization
│   └── authStore.ts         # Auth state
├── hooks/
│   ├── useEvent.ts
│   ├── useTeam.ts
│   ├── useTimer.ts
│   └── useAnalytics.ts
├── pages/
│   ├── admin/
│   │   ├── Dashboard.tsx
│   │   ├── EventManager.tsx
│   │   ├── LiveMonitor.tsx
│   │   └── Analytics.tsx
│   └── play/
│       ├── Lobby.tsx
│       ├── Stage.tsx
│       └── Results.tsx
└── components/
    ├── admin/
    └── play/
```

---

## Next Steps

1. ✅ Architecture design (this document)
2. ⬜ Database schema (SQL migrations)
3. ⬜ RLS policies
4. ⬜ Edge Functions
5. ⬜ Frontend implementation
