# Row Level Security (RLS) Strategy

## Overview

This document details the Row Level Security policies for the Escape Room Platform with a **simplified authentication model**:

- **Admins/Organizers**: Use Supabase Auth (email/password)
- **Players**: No auth required - use session tokens stored in localStorage

---

## Authentication Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ADMIN PATH (Supabase Auth)              PLAYER PATH (Session Token)        │
│  ─────────────────────────               ──────────────────────────         │
│                                                                             │
│  ┌─────────────┐                        ┌─────────────┐                     │
│  │   Login     │                        │   Join      │                     │
│  │  (email/pw) │                        │ (code only) │                     │
│  └──────┬──────┘                        └──────┬──────┘                     │
│         │                                      │                            │
│         ▼                                      ▼                            │
│  ┌─────────────┐                        ┌─────────────┐                     │
│  │ Supabase    │                        │ Edge Func   │                     │
│  │ Auth JWT    │                        │ join-team   │                     │
│  └──────┬──────┘                        └──────┬──────┘                     │
│         │                                      │                            │
│         ▼                                      ▼                            │
│  ┌─────────────┐                        ┌─────────────┐                     │
│  │ auth.uid()  │                        │ session_    │                     │
│  │ in RLS      │                        │ token UUID  │                     │
│  └─────────────┘                        └──────┬──────┘                     │
│                                                │                            │
│                                                ▼                            │
│                                         ┌─────────────┐                     │
│                                         │ localStorage│                     │
│                                         │ (client)    │                     │
│                                         └─────────────┘                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## User Roles

| Role | Authentication | Access Level |
|------|----------------|--------------|
| **Admin** | Supabase Auth (JWT) | Full platform CRUD |
| **Organizer** | Supabase Auth (JWT) | Own events CRUD |
| **Player** | Session Token (header) | Own team read + actions via Edge Functions |
| **Anonymous** | None | Read public data (leaderboards, events) |

---

## Access Matrix by Table

### Public Read Access (Anon Role)

These tables allow anonymous SELECT for active/public events:

| Table | What's Readable | What's Hidden |
|-------|-----------------|---------------|
| `events` | All fields for scheduled/active/completed | Draft events |
| `stages` | name, description, instructions, order_index | `unlock_code` (validated server-side) |
| `hints` | id, title, order_index, point_penalty | `content` (returned via Edge Function) |
| `teams` | All fields for active events | - |
| `team_members` | display_name, is_captain, is_online | `session_token` |
| `team_progress` | All fields | - |
| `hint_usage` | All fields | - |
| `v_leaderboard` | All fields | - |

### Protected Tables (Admin/Organizer Only)

| Table | Access |
|-------|--------|
| `profiles` | Own profile or admin |
| `code_attempts` | Event organizers only (analytics) |
| `analytics_events` | Event organizers only |

### Write Access

| Table | Who Can Write | How |
|-------|---------------|-----|
| `team_members` | Anyone | Via `join-team` Edge Function |
| `team_progress` | Team members | Via `validate-code` Edge Function |
| `hint_usage` | Team members | Via `use-hint` Edge Function |
| `code_attempts` | Team members | Via `validate-code` Edge Function |
| `analytics_events` | Anyone | Via Edge Functions |

---

## RLS Policy Summary

### Events
```sql
-- Anyone can read active events
SELECT: status IN ('scheduled', 'active', 'paused', 'completed')

-- Admins see all (including drafts)
SELECT: is_admin(auth.uid())

-- Organizers see their own drafts
SELECT: created_by = auth.uid()

-- Only admin/organizer can create
INSERT: role IN ('admin', 'organizer')

-- Only owner/admin can modify
UPDATE/DELETE: is_event_organizer(auth.uid(), id)
```

### Stages
```sql
-- Public read for active events
SELECT: event.status IN ('scheduled', 'active', 'paused', 'completed')

-- IMPORTANT: unlock_code is in the row but client should NOT display it
-- Validation happens server-side in validate-code Edge Function
```

### Hints
```sql
-- Anyone can read hint metadata for active events
SELECT: event.status IN ('active', 'paused', 'completed')

-- IMPORTANT: content field is readable but should only be shown
-- AFTER the hint is used (check hint_usage table)
-- Or use the use-hint Edge Function which handles this
```

### Teams & Team Members
```sql
-- Public read for leaderboards
SELECT: event.status IN ('scheduled', 'active', 'paused', 'completed')

-- Insert via Edge Function only
INSERT: TRUE  -- Controlled by join-team function
```

### Team Progress
```sql
-- Public read for live updates
SELECT: event.status IN ('active', 'paused', 'completed')

-- Managed by Edge Functions
INSERT/UPDATE: TRUE  -- Controlled by validate-code function
```

---

## Edge Function Security Model

Since players don't have Supabase Auth, all player actions go through Edge Functions:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EDGE FUNCTION SECURITY                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Client Request                                                             │
│  ┌──────────────────────────────────────────────┐                          │
│  │ POST /functions/v1/validate-code             │                          │
│  │ Headers:                                      │                          │
│  │   x-session-token: abc-123-def               │                          │
│  │ Body:                                         │                          │
│  │   { team_id, stage_id, code }                │                          │
│  └──────────────────────────────────────────────┘                          │
│                         │                                                   │
│                         ▼                                                   │
│  Edge Function                                                              │
│  ┌──────────────────────────────────────────────┐                          │
│  │ 1. Extract x-session-token from headers      │                          │
│  │ 2. Query: SELECT * FROM team_members         │                          │
│  │           WHERE session_token = ?            │                          │
│  │           AND team_id = ?                    │                          │
│  │ 3. If no match → 403 Forbidden               │                          │
│  │ 4. If match → proceed with service role      │                          │
│  └──────────────────────────────────────────────┘                          │
│                         │                                                   │
│                         ▼                                                   │
│  Database (Service Role - bypasses RLS)                                     │
│  ┌──────────────────────────────────────────────┐                          │
│  │ - Validate unlock_code                       │                          │
│  │ - Update team_progress                       │                          │
│  │ - Insert code_attempts                       │                          │
│  │ - Insert analytics_events                    │                          │
│  └──────────────────────────────────────────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Session Token Security

### Token Generation
- UUID v4 generated by PostgreSQL `uuid_generate_v4()`
- Created when player joins team via `join-team` Edge Function
- Stored in `team_members.session_token` column

### Token Storage (Client)
```typescript
// localStorage key
'escape_room_session'

// Stored data
{
  sessionToken: "550e8400-e29b-41d4-a716-446655440000",
  teamId: "...",
  teamName: "...",
  // ... other metadata
}
```

### Token Validation (Server)
```sql
-- In Edge Functions
SELECT id, team_id, display_name 
FROM team_members 
WHERE session_token = $1 
  AND team_id = $2;
```

### Security Properties
| Property | Status |
|----------|--------|
| Entropy | 122 bits (UUID v4) |
| Guessability | ~5.3 × 10^36 combinations |
| Expiration | None (persists until cleared) |
| Revocation | Delete team_member row |
| Scope | Single team only |

---

## Attack Vector Analysis

### 1. Session Token Brute Force
**Risk**: Low - UUID has 122 bits of entropy
**Mitigation**: Rate limiting on Edge Functions

### 2. Session Token Theft
**Risk**: Medium - localStorage is accessible to XSS
**Mitigation**: 
- Token only valid for specific team
- Clear session on logout
- HttpOnly cookies could be used for higher security (future)

### 3. Join Code Enumeration
**Risk**: Low - 6-char codes have 2.1B combinations per event
**Mitigation**: Rate limiting, codes scoped to events

### 4. Viewing Other Team's Progress
**Risk**: Low - Progress is public for leaderboard
**Impact**: Intentional - leaderboard shows all teams

### 5. Manipulating Own Progress
**Risk**: None - All progress updates via Edge Functions
**Mitigation**: Server validates codes, calculates points

### 6. Accessing Hint Content Early
**Risk**: Low - Content readable in RLS but controlled by UI
**Mitigation**: 
- UI only shows hints after use-hint call
- use-hint deducts from budget
- Even if seen early, still costs a hint to "officially" use

### 7. Admin Impersonation
**Risk**: None - Admin actions require Supabase JWT
**Mitigation**: event-control function verifies auth.uid()

---

## Realtime Security

### Channel Access
Realtime subscriptions respect RLS policies:

```typescript
// Anyone can subscribe to public data
supabase.channel('public:events')
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'events',
    filter: 'status=in.(active,paused)'
  }, handler)

// Team progress is public (for leaderboard)
supabase.channel('public:team_progress')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'team_progress'
  }, handler)
```

### What's Broadcast
- Event status changes (timer start/pause/end)
- Team progress updates
- Team member join/leave
- Leaderboard changes

---

## Permissions Quick Reference

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PERMISSIONS MATRIX                              │
├───────────────────┬─────────┬───────────┬─────────┬─────────────────────────┤
│ Action            │ Admin   │ Organizer │ Player  │ Anonymous               │
├───────────────────┼─────────┼───────────┼─────────┼─────────────────────────┤
│ View events       │ All     │ Own+Public│ Public  │ Public                  │
│ Create event      │ ✓       │ ✓         │ ✗       │ ✗                       │
│ Start/stop event  │ ✓       │ Own       │ ✗       │ ✗                       │
│ Create team       │ ✓       │ Own event │ ✗       │ ✗                       │
│ Join team         │ ✓       │ ✓         │ ✓       │ ✗ (need session)        │
│ Submit code       │ ✗       │ ✗         │ ✓       │ ✗                       │
│ Use hint          │ ✗       │ ✗         │ ✓       │ ✗                       │
│ View leaderboard  │ ✓       │ ✓         │ ✓       │ ✓                       │
│ View analytics    │ ✓       │ Own event │ ✗       │ ✗                       │
└───────────────────┴─────────┴───────────┴─────────┴─────────────────────────┘
```

---

## Testing RLS

### Test Anonymous Access
```sql
-- Should return active events only
SET ROLE anon;
SELECT * FROM events;

-- Should return stages for active events
SELECT s.* FROM stages s
JOIN events e ON e.id = s.event_id
WHERE e.status = 'active';

-- Reset
RESET ROLE;
```

### Test Admin Access
```sql
-- Set JWT claim
SET request.jwt.claims = '{"sub": "admin-user-uuid"}';

-- Should return all events including drafts
SELECT * FROM events;

-- Should allow INSERT
INSERT INTO events (name, created_by) VALUES ('Test', 'admin-user-uuid');

RESET request.jwt.claims;
```
