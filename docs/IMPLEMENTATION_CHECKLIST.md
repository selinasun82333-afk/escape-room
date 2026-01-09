# Implementation Checklist

## Phase 1: Architecture & Schema ✅

### Completed
- [x] System architecture document (`docs/ARCHITECTURE.md`)
- [x] Database schema migration (`supabase/migrations/001_initial_schema.sql`)
- [x] RLS policies migration (`supabase/migrations/002_rls_policies.sql`)
- [x] Database schema documentation (`docs/DATABASE_SCHEMA.md`)
- [x] RLS strategy documentation (`docs/RLS_STRATEGY.md`)
- [x] TypeScript types (`src/types/database.types.ts`)
- [x] Edge Function: validate-code (`supabase/functions/validate-code/index.ts`)
- [x] Edge Function: use-hint (`supabase/functions/use-hint/index.ts`)
- [x] Edge Function: event-control (`supabase/functions/event-control/index.ts`)
- [x] Edge Function: join-team (`supabase/functions/join-team/index.ts`)
- [x] Edge Function: timer-sync (`supabase/functions/timer-sync/index.ts`)
- [x] Timer sync client library (`src/lib/timer.ts`)
- [x] Secure hint view: v_team_hints (content hidden until used)
- [x] Secure hint functions: get_team_hints(), get_hint_content(), can_use_hint()

---

## Phase 2: Supabase Setup (Next)

### Database
- [ ] Create Supabase project
- [ ] Run migrations in order:
  1. `001_initial_schema.sql`
  2. `002_rls_policies.sql`
- [ ] Verify all tables, views, and functions created
- [ ] Test RLS policies with different user roles

### Edge Functions
- [ ] Deploy `validate-code` function
- [ ] Deploy `use-hint` function
- [ ] Deploy `event-control` function
- [ ] Deploy `join-team` function
- [ ] Configure environment variables
- [ ] Test all functions with Postman/curl

### Authentication
- [ ] Enable email/password auth for admins only
- [ ] Configure auth redirect URLs
- [ ] No auth needed for players (session-based)

### Realtime
- [ ] Verify realtime is enabled for required tables
- [ ] Test subscription latency
- [ ] Configure channel authorization

---

## Phase 3: Frontend Foundation

### Project Setup
- [ ] Initialize Vite + React + TypeScript
- [ ] Configure Tailwind CSS
- [ ] Set up Zustand stores
- [ ] Configure Supabase client
- [ ] Set up React Router

### Core Hooks
- [ ] `useAdminAuth` - Admin authentication (Supabase Auth)
- [ ] `usePlayerSession` - Player session from localStorage
- [ ] `useEvent` - Event data and state
- [ ] `useTeam` - Team data and members
- [ ] `useTimer` - Synchronized countdown
- [ ] `useStage` - Current stage progress
- [ ] `useLeaderboard` - Real-time rankings

### API Layer
- [ ] `lib/supabase.ts` - Client configuration
- [ ] `lib/session.ts` - Session management (localStorage) ✅
- [ ] `lib/api/events.ts` - Event CRUD
- [ ] `lib/api/teams.ts` - Team operations
- [ ] `lib/api/stages.ts` - Stage queries
- [ ] `lib/api/analytics.ts` - Analytics queries

---

## Phase 4: Player Interface

### Join Flow (No Login Required)
- [ ] Join page with event_id + join_code + display_name
- [ ] Session storage after successful join
- [ ] Return to session if already joined

### Game Play
- [ ] Lobby/waiting room
- [ ] Stage display component
- [ ] Code entry (manual + QR scanner)
- [ ] Hint request modal
- [ ] Team status sidebar
- [ ] Global timer display
- [ ] Stage completion animation
- [ ] Final results screen

### Real-time Features
- [ ] Team member presence
- [ ] Progress sync across devices
- [ ] Timer synchronization
- [ ] Stage transition notifications

---

## Phase 5: Admin Dashboard

### Authentication
- [ ] Admin login (email/password)
- [ ] Role verification

### Event Management
- [ ] Event list (with status filters)
- [ ] Create event wizard
- [ ] Edit event settings
- [ ] Stage builder (drag & drop ordering)
- [ ] Hint editor per stage
- [ ] Team management (create, invite codes)

### Live Control
- [ ] Start/pause/resume/end controls
- [ ] Timer display and adjustment
- [ ] Team progress overview
- [ ] Live leaderboard
- [ ] Send announcements (broadcast)
- [ ] Disqualify/reinstate teams

### Analytics
- [ ] Event summary dashboard
- [ ] Per-stage analytics
- [ ] Team performance comparison
- [ ] Hint usage patterns
- [ ] Time distribution charts
- [ ] Export reports (CSV/PDF)

---

## Phase 6: Polish & Launch

### QR Code Features
- [ ] QR code generator for stages
- [ ] Printable QR sheets for organizers
- [ ] QR scanner in player app

### Mobile Optimization
- [ ] Responsive layouts
- [ ] Touch-friendly controls
- [ ] PWA support (offline indicator)

### Error Handling
- [ ] Network error recovery
- [ ] Reconnection logic
- [ ] Graceful degradation

### Testing
- [ ] Unit tests for utilities
- [ ] Integration tests for API
- [ ] E2E tests for critical flows
- [ ] Load testing for real-time features

### Documentation
- [ ] User guide for players
- [ ] Admin manual
- [ ] API documentation
- [ ] Deployment guide

---

## File Structure Created

```
escape/
├── docs/
│   ├── ARCHITECTURE.md          # System overview
│   ├── DATABASE_SCHEMA.md       # ERD and table details
│   ├── RLS_STRATEGY.md          # Security policies
│   └── IMPLEMENTATION_CHECKLIST.md  # This file
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql   # Tables, views, functions
│   │   └── 002_rls_policies.sql     # Row level security
│   └── functions/
│       ├── validate-code/index.ts   # Code submission (session token)
│       ├── use-hint/index.ts        # Hint consumption (session token)
│       ├── event-control/index.ts   # Timer control (admin JWT)
│       ├── join-team/index.ts       # Team registration (no auth)
│       └── timer-sync/index.ts      # Timer state for client sync
└── src/
    ├── lib/
    │   ├── session.ts               # Session management (localStorage)
    │   └── timer.ts                 # Timer sync manager + utilities
    └── types/
        └── database.types.ts        # TypeScript definitions
```

---

## Quick Start Commands

```bash
# 1. Link to Supabase project
npx supabase link --project-ref YOUR_PROJECT_REF

# 2. Push migrations
npx supabase db push

# 3. Deploy Edge Functions
npx supabase functions deploy validate-code
npx supabase functions deploy use-hint
npx supabase functions deploy event-control
npx supabase functions deploy join-team
npx supabase functions deploy timer-sync

# 4. Generate fresh TypeScript types
npx supabase gen types typescript --local > src/types/database.types.ts
```

---

## Environment Variables Needed

```env
# Supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Edge Functions (set in Supabase dashboard)
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

