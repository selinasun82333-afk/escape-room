# Database Setup Guide

## Overview

This directory contains all SQL files needed to set up the Escape Room Platform database in Supabase.

## Files

| File | Purpose |
|------|---------|
| `schema.sql` | Core database tables, types, indexes, views, and triggers |
| `rls_policies.sql` | Row Level Security policies for authorization |
| `functions.sql` | RPC functions for game logic |
| `seed.sql` | Sample data for development/testing |

## Setup Instructions

### Option 1: Supabase Dashboard (Recommended for Quick Start)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Execute files in this order:
   1. `schema.sql`
   2. `rls_policies.sql`
   3. `functions.sql`
   4. `seed.sql` (optional, for development)

### Option 2: Supabase CLI (Recommended for Production)

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Push schema to database
supabase db push
```

### Option 3: Migration Files

For proper version control, create migration files:

```bash
# Create migrations directory
mkdir -p supabase/migrations

# Create timestamped migration files
# 20240101000000_initial_schema.sql
# 20240101000001_rls_policies.sql
# 20240101000002_functions.sql

# Apply migrations
supabase db push
```

## Enable Realtime

After running the schema, enable realtime for required tables:

```sql
-- Run in SQL Editor
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE team_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE hint_usage;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
```

## Verify Setup

Run these queries to verify tables were created:

```sql
-- Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Check functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION';
```

## Schema Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              ESCAPE ROOM PLATFORM                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐                                 │
│   │profiles │───>│  teams  │───>│team_    │                                 │
│   │         │    │         │    │members  │                                 │
│   └─────────┘    └────┬────┘    └─────────┘                                 │
│        │              │                                                      │
│        │              │                                                      │
│        v              v                                                      │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐                  │
│   │ events  │───>│ stages  │───>│  hints  │───>│hint_    │                  │
│   │         │    │         │    │         │    │usage    │                  │
│   └─────────┘    └────┬────┘    └─────────┘    └─────────┘                  │
│                       │                                                      │
│                       v                                                      │
│                  ┌─────────┐    ┌───────────────┐                            │
│                  │team_    │    │analytics_     │                            │
│                  │progress │    │events         │                            │
│                  └─────────┘    └───────────────┘                            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Key Relationships

| Parent | Child | Relationship |
|--------|-------|--------------|
| `profiles` | `events` | Admin creates events |
| `events` | `teams` | Multiple teams per event |
| `events` | `stages` | Multiple stages per event |
| `teams` | `team_members` | Multiple members per team |
| `stages` | `hints` | Multiple hints per stage |
| `teams` + `stages` | `team_progress` | Progress tracking |
| `teams` + `hints` | `hint_usage` | Hint tracking |

## RLS Policy Summary

| Table | Select | Insert | Update | Delete |
|-------|--------|--------|--------|--------|
| `profiles` | All users | Trigger only | Own profile | - |
| `events` | Published + own | Admins | Event admin | Event admin (draft) |
| `stages` | Participants + admin | Event admin | Event admin | Event admin |
| `hints` | Revealed + admin | Event admin | Event admin | Event admin |
| `teams` | Participants + public | Anyone (published) | Captain + admin | Event admin |
| `team_members` | Team + admin | Self only | - | Self + admin |
| `team_progress` | Team + admin | Admin only | Team + admin | - |
| `hint_usage` | Team + admin | Team members | - | - |
| `analytics_events` | Event admin | Functions only | - | - |

## Troubleshooting

### "permission denied" errors

1. Check RLS policies are applied
2. Verify user has correct role in `profiles.role`
3. Ensure auth token is being sent with requests

### Realtime not working

1. Verify table is added to `supabase_realtime` publication
2. Check Realtime is enabled in project settings
3. Ensure client is subscribed to correct channel

### Timer issues

1. Timer calculations are server-side - check `get_remaining_time()` function
2. Ensure `timer_started_at` and `timer_paused_at` are set correctly
3. Check for timezone issues (all times should be UTC)

## Backup & Restore

```bash
# Export data
supabase db dump -f backup.sql

# Restore data
supabase db reset
psql -h db.your-project.supabase.co -U postgres -d postgres -f backup.sql
```

## Performance Considerations

1. **Indexes** are created on frequently queried columns
2. **Materialized view** `leaderboard` should be refreshed after progress updates
3. **Analytics table** may need partitioning for high-volume events
4. Consider **pg_cron** for scheduled tasks (leaderboard refresh, event archival)

