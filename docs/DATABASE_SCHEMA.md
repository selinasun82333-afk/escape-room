# Database Schema Documentation

## Entity-Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    ESCAPE ROOM PLATFORM                                  │
│                                    Database Schema v1.0                                  │
└─────────────────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │   profiles   │
    ├──────────────┤         ┌────────────────┐
    │ id (PK)      │◀────────│ auth.users(id) │
    │ email        │         └────────────────┘
    │ display_name │
    │ role         │──────────────────────────────────────────────────────────┐
    │ avatar_url   │                                                          │
    └──────┬───────┘                                                          │
           │                                                                  │
           │ created_by                                                       │
           ▼                                                                  │
    ┌──────────────────────────┐          ┌────────────────────────┐         │
    │         events           │          │        stages          │         │
    ├──────────────────────────┤          ├────────────────────────┤         │
    │ id (PK)                  │───1:N───▶│ id (PK)                │         │
    │ name                     │          │ event_id (FK)          │         │
    │ description              │          │ order_index            │         │
    │ slug                     │          │ name                   │         │
    │ created_by (FK)          │          │ description            │         │
    │ organization_name        │          │ instructions           │         │
    │ duration_seconds         │          │ unlock_code ━━━━━━━━━━━━━━━━━━━━┓│
    │ max_teams                │          │ unlock_code_hint       │        ││
    │ max_team_size            │          │ qr_code_data           │        ││
    │ hints_per_team           │          │ estimated_minutes      │        ││
    │ allow_late_join          │          │ time_limit_seconds     │        ││
    │ status                   │          │ base_points            │        ││
    │ scheduled_start          │          │ time_bonus_enabled     │        ││
    │ started_at               │          └───────────┬────────────┘        ││
    │ paused_at                │                      │                     ││
    │ accumulated_pause_secs   │                      │ 1:N                 ││
    │ ended_at                 │                      ▼                     ││
    └──────────┬───────────────┘          ┌────────────────────────┐        ││
               │                          │         hints          │        ││
               │                          ├────────────────────────┤        ││
               │ 1:N                      │ id (PK)                │        ││
               │                          │ stage_id (FK)          │        ││
               ▼                          │ order_index            │        ││
    ┌──────────────────────────┐          │ title                  │        ││
    │         teams            │          │ content ━━━━━━━━━━━━━━━━━━━━━━━┓││
    ├──────────────────────────┤          │ point_penalty          │       │││
    │ id (PK)                  │          └───────────┬────────────┘       │││
    │ event_id (FK)            │                      │                    │││
    │ name                     │                      │                    │││
    │ join_code ━━━━━━━━━━━━━━━━━━━━━━━━┓             │                    │││
    │ color                    │        ┃             │                    │││
    │ hints_remaining          │        ┃             │                    │││
    │ total_points             │        ┃             │                    │││
    │ current_stage_index      │        ┃             │                    │││
    │ registered_at            │        ┃             │                    │││
    │ started_at               │        ┃             │                    │││
    │ finished_at              │        ┃             │                    │││
    │ is_active                │        ┃             │                    │││
    │ disqualified             │        ┃             │                    │││
    └──────────┬───────────────┘        ┃             │                    │││
               │                        ┃             │                    │││
      ┌────────┴─────────┬──────────────┃─────────────┤                    │││
      │                  │              ┃             │                    │││
      │ 1:N              │ 1:N          ┃             │ 1:N                │││
      ▼                  ▼              ▽             ▼                    │││
┌───────────────┐ ┌─────────────────┐ ┌────────────────────────┐          │││
│ team_members  │ │ team_progress   │ │      hint_usage        │          │││
├───────────────┤ ├─────────────────┤ ├────────────────────────┤          │││
│ id (PK)       │ │ id (PK)         │ │ id (PK)                │◀━━━━━━━━━┛││
│ team_id (FK)  │ │ team_id (FK)    │ │ team_id (FK)           │           ││
│ user_id (FK)  │ │ stage_id (FK)   │ │ hint_id (FK)           │           ││
│ display_name  │ │ status          │ │ requested_by (FK)      │           ││
│ email         │ │ unlocked_at     │ │ used_at                │           ││
│ is_captain    │ │ started_at      │ │ time_in_stage_seconds  │           ││
│ joined_at     │ │ completed_at    │ └────────────────────────┘           ││
│ last_active   │ │ attempt_count   │                                      ││
│ is_online     │ │ last_attempt_at │ ┌────────────────────────┐           ││
└───────────────┘ │ points_earned   │ │    code_attempts       │           ││
        │         │ time_bonus      │ ├────────────────────────┤           ││
        │         │ hint_penalties  │ │ id (PK)                │           ││
        │         └─────────────────┘ │ team_id (FK)           │           ││
        │                             │ stage_id (FK)          │◀━━━━━━━━━━┛│
        │                             │ submitted_code         │            │
        │                             │ is_correct             │            │
        │                             │ submitted_by (FK)      │            │
        │                             │ attempted_at           │            │
        │                             │ time_in_stage_seconds  │            │
        │                             └────────────────────────┘            │
        │                                                                   │
        │         ┌────────────────────────────────────────────┐            │
        │         │           analytics_events                 │            │
        │         ├────────────────────────────────────────────┤            │
        └────────▶│ id (PK)                                    │◀───────────┘
                  │ event_id (FK, nullable)                    │
                  │ team_id (FK, nullable)                     │
                  │ stage_id (FK, nullable)                    │
                  │ user_id (FK, nullable)                     │
                  │ event_type                                 │
                  │ payload (JSONB)                            │
                  │ occurred_at                                │
                  │ session_id                                 │
                  │ ip_address                                 │
                  │ user_agent                                 │
                  └────────────────────────────────────────────┘

━━━━ Sensitive data (encrypted/protected)
──── Foreign key relationship
1:N  One-to-many relationship
```

---

## Table Details

### Core Tables

| Table | Description | Row Count Estimate |
|-------|-------------|-------------------|
| `profiles` | User accounts (extends auth.users) | Hundreds |
| `events` | Escape room sessions | Tens to hundreds |
| `stages` | Puzzles within events | 5-15 per event |
| `hints` | Help content per stage | 1-5 per stage |
| `teams` | Participating groups | 5-50 per event |
| `team_members` | Players in teams | 2-6 per team |
| `team_progress` | Stage completion tracking | teams × stages |
| `hint_usage` | Hint consumption records | Variable |
| `code_attempts` | All code submissions | High volume |
| `analytics_events` | Granular event log | Very high volume |

---

## Indexes Strategy

### Primary Indexes (Auto-created)
- All `id` columns (UUID PRIMARY KEY)

### Foreign Key Indexes
```sql
idx_events_created_by        ON events(created_by)
idx_stages_event             ON stages(event_id)
idx_hints_stage              ON hints(stage_id)
idx_teams_event              ON teams(event_id)
idx_team_members_team        ON team_members(team_id)
idx_team_members_user        ON team_members(user_id)
idx_team_progress_team       ON team_progress(team_id)
idx_team_progress_stage      ON team_progress(stage_id)
idx_hint_usage_team          ON hint_usage(team_id)
idx_code_attempts_team       ON code_attempts(team_id)
```

### Query-Optimized Indexes
```sql
idx_events_status            ON events(status)
idx_events_scheduled         ON events(scheduled_start) WHERE status = 'scheduled'
idx_events_slug              ON events(slug) WHERE slug IS NOT NULL [UNIQUE]
idx_stages_order             ON stages(event_id, order_index)
idx_teams_join_code          ON teams(join_code)
idx_teams_active             ON teams(event_id, is_active) WHERE is_active = TRUE
idx_team_members_online      ON team_members(team_id, is_online) WHERE is_online = TRUE
idx_team_progress_status     ON team_progress(team_id, status)
idx_analytics_composite      ON analytics_events(event_id, event_type, occurred_at)
```

---

## Enum Types

### `event_status`
| Value | Description |
|-------|-------------|
| `draft` | Event being configured |
| `scheduled` | Ready to start, teams can register |
| `active` | Timer running, game in progress |
| `paused` | Timer paused by admin |
| `completed` | Event finished |
| `archived` | Moved to cold storage |

### `stage_status`
| Value | Description |
|-------|-------------|
| `locked` | Not yet accessible to team |
| `active` | Team currently working on this |
| `completed` | Successfully finished |
| `skipped` | Admin override skip |

### `user_role`
| Value | Description |
|-------|-------------|
| `admin` | Platform administrator |
| `organizer` | Can create/manage events |
| `player` | Team member |

---

## Key Constraints

### Unique Constraints
```sql
(event_id, order_index)    ON stages      -- Stage ordering
(stage_id, order_index)    ON hints       -- Hint ordering
(event_id, name)           ON teams       -- Team names per event
(event_id, join_code)      ON teams       -- Join codes per event
(team_id, user_id)         ON team_members -- One membership per user per team
(team_id, stage_id)        ON team_progress -- One progress record per team per stage
(team_id, hint_id)         ON hint_usage  -- Hint used once per team
```

### Check Constraints
```sql
duration_seconds > 0                       ON events
hints_per_team >= 0                        ON events
max_team_size > 0                          ON events
base_points >= 0                           ON stages
point_penalty >= 0                         ON hints
hints_remaining >= 0                       ON teams
total_points >= 0                          ON teams
attempt_count >= 0                         ON team_progress
```

---

## Cascading Deletes

| Parent | Child | Behavior |
|--------|-------|----------|
| events | stages | CASCADE |
| events | teams | CASCADE |
| stages | hints | CASCADE |
| stages | team_progress | CASCADE |
| teams | team_members | CASCADE |
| teams | team_progress | CASCADE |
| teams | hint_usage | CASCADE |
| teams | code_attempts | CASCADE |
| profiles | events | RESTRICT |
| profiles | team_members | SET NULL |

---

## Trigger Summary

| Trigger | Table | Event | Action |
|---------|-------|-------|--------|
| `trg_update_team_points` | team_progress | INSERT/UPDATE | Recalculate team total_points |
| `trg_update_hints_remaining` | hint_usage | INSERT | Decrement team hints_remaining |
| `trg_events_updated_at` | events | UPDATE | Set updated_at = NOW() |
| `trg_stages_updated_at` | stages | UPDATE | Set updated_at = NOW() |
| `trg_teams_updated_at` | teams | UPDATE | Set updated_at = NOW() |
| `trg_team_progress_updated_at` | team_progress | UPDATE | Set updated_at = NOW() |

---

## Views Summary

### `v_leaderboard`
Real-time leaderboard with rankings.
- Filters: active, non-disqualified teams
- Ranking: points DESC, finish time ASC, stage index DESC

### `v_event_stats`
Aggregated event statistics.
- Team counts (total, finished, active)
- Member counts (total, online)
- Hint usage totals
- Average completion time

### `v_stage_analytics`
Per-stage performance metrics.
- Completion counts and timing
- Attempt statistics
- Hint usage by stage

---

## Storage Estimates

| Table | Row Size (avg) | Per Event (10 teams × 10 stages) |
|-------|---------------|----------------------------------|
| events | 500 bytes | 500 bytes |
| stages | 400 bytes | 4 KB |
| hints | 500 bytes | 15 KB |
| teams | 300 bytes | 3 KB |
| team_members | 200 bytes | 10 KB |
| team_progress | 200 bytes | 20 KB |
| hint_usage | 100 bytes | 5 KB |
| code_attempts | 150 bytes | 15 KB |
| analytics_events | 300 bytes | 50 KB |

**Total per event: ~125 KB** (excluding analytics, which grows with usage)

