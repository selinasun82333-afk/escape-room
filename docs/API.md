# Escape Room Platform - API Reference

## Overview

All API operations use Supabase client methods. Authentication is handled via Supabase Auth.

---

## Authentication

### Sign Up (Admin)
```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'admin@example.com',
  password: 'secure_password',
  options: {
    data: {
      display_name: 'Admin Name',
      role: 'admin'
    }
  }
});
```

### Sign In
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});
```

### Magic Link (Players)
```typescript
const { data, error } = await supabase.auth.signInWithOtp({
  email: 'player@example.com',
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`
  }
});
```

### Get Current User
```typescript
const { data: { user } } = await supabase.auth.getUser();
```

---

## Events

### List Published Events
```typescript
const { data, error } = await supabase
  .from('events')
  .select('*')
  .in('status', ['published', 'active'])
  .order('scheduled_start_at', { ascending: true });
```

### Get Event Details
```typescript
const { data, error } = await supabase
  .from('events')
  .select(`
    *,
    stages (
      id,
      title,
      description,
      order_index,
      entry_code,
      max_points
    )
  `)
  .eq('id', eventId)
  .single();
```

### Create Event (Admin)
```typescript
const { data, error } = await supabase
  .from('events')
  .insert({
    title: 'My Escape Room',
    description: 'A thrilling adventure...',
    timer_duration_seconds: 3600,
    max_hints_per_team: 5,
    max_team_size: 6
  })
  .select()
  .single();
```

### Update Event (Admin)
```typescript
const { data, error } = await supabase
  .from('events')
  .update({
    title: 'Updated Title',
    status: 'published'
  })
  .eq('id', eventId)
  .select()
  .single();
```

---

## Timer Control (Admin)

### Start Timer
```typescript
const { data, error } = await supabase.rpc('start_timer', {
  p_event_id: eventId
});
// Returns: { status: 'active', started_at: '2024-...' }
```

### Pause Timer
```typescript
const { data, error } = await supabase.rpc('pause_timer', {
  p_event_id: eventId
});
// Returns: { paused: true, remaining_seconds: 2400 }
```

### Resume Timer
```typescript
const { data, error } = await supabase.rpc('resume_timer', {
  p_event_id: eventId
});
// Returns: { resumed: true, remaining_seconds: 2400 }
```

### End Event
```typescript
const { data, error } = await supabase.rpc('end_event', {
  p_event_id: eventId
});
// Returns: { status: 'completed' }
```

### Get Remaining Time
```typescript
const { data, error } = await supabase.rpc('get_remaining_time', {
  p_event_id: eventId
});
// Returns: 2400 (seconds)
```

---

## Teams

### Create Team
```typescript
const { data, error } = await supabase.rpc('create_team', {
  p_event_id: eventId,
  p_team_name: 'Team Alpha'
});
// Returns: { team_id: '...', join_code: 'ALPHA001' }
```

### Join Team
```typescript
const { data, error } = await supabase.rpc('join_team', {
  p_join_code: 'ALPHA001'
});
// Returns: { team_id: '...', team_name: 'Team Alpha', event_id: '...' }
```

### Get Team Details
```typescript
const { data, error } = await supabase
  .from('teams')
  .select(`
    *,
    team_members (
      id,
      is_captain,
      joined_at,
      profile:profiles (
        id,
        display_name,
        avatar_url
      )
    )
  `)
  .eq('id', teamId)
  .single();
```

### Leave Team
```typescript
const { data, error } = await supabase
  .from('team_members')
  .delete()
  .eq('team_id', teamId)
  .eq('profile_id', profileId);
```

---

## Stages

### List Event Stages
```typescript
const { data, error } = await supabase
  .from('stages')
  .select(`
    id,
    title,
    description,
    order_index,
    entry_code,
    puzzle_type,
    max_points
  `)
  .eq('event_id', eventId)
  .order('order_index');
```

### Create Stage (Admin)
```typescript
const { data, error } = await supabase
  .from('stages')
  .insert({
    event_id: eventId,
    title: 'The Library',
    description: 'Find the hidden book...',
    order_index: 2,
    puzzle_type: 'text',
    puzzle_data: { question: 'What is the book title?' },
    correct_answer: 'MIDNIGHT',
    max_points: 100
  })
  .select()
  .single();
```

### Validate Entry Code (QR Scan)
```typescript
const { data, error } = await supabase.rpc('validate_entry_code', {
  p_team_id: teamId,
  p_entry_code: 'LIBR42'
});
// Returns: { stage_id: '...', stage_title: 'The Library', stage_order: 2, status: 'unlocked' }
```

### Submit Answer
```typescript
const { data, error } = await supabase.rpc('submit_answer', {
  p_team_id: teamId,
  p_stage_id: stageId,
  p_answer: 'MIDNIGHT'
});
// Returns: { correct: true, attempts: 1, points_earned: 100, next_stage_id: '...' }
```

---

## Progress

### Get Team Progress
```typescript
const { data, error } = await supabase
  .from('team_progress')
  .select('*')
  .eq('team_id', teamId);
```

### Get Progress for Specific Stage
```typescript
const { data, error } = await supabase
  .from('team_progress')
  .select('*')
  .eq('team_id', teamId)
  .eq('stage_id', stageId)
  .single();
```

---

## Hints

### Get Available Hints (Admin view)
```typescript
const { data, error } = await supabase
  .from('hints')
  .select('*')
  .eq('stage_id', stageId)
  .order('order_index');
```

### Get Revealed Hints (Player view)
```typescript
const { data, error } = await supabase
  .from('hint_usage')
  .select(`
    *,
    hint:hints (
      id,
      content,
      order_index,
      penalty_seconds
    )
  `)
  .eq('team_id', teamId);
```

### Reveal Hint
```typescript
const { data, error } = await supabase.rpc('reveal_hint', {
  p_team_id: teamId,
  p_stage_id: stageId
});
// Returns: {
//   hint_id: '...',
//   hint_content: 'Look at the portrait...',
//   hint_order: 1,
//   penalty_seconds: 30,
//   total_hints_used: 1,
//   hints_remaining: 4
// }
```

### Create Hint (Admin)
```typescript
const { data, error } = await supabase
  .from('hints')
  .insert({
    stage_id: stageId,
    order_index: 1,
    content: 'Look at the bottom of the painting.',
    penalty_seconds: 30,
    penalty_points: 10
  })
  .select()
  .single();
```

---

## Leaderboard

### Get Event Leaderboard
```typescript
const { data, error } = await supabase.rpc('get_leaderboard', {
  p_event_id: eventId
});
// Returns: [
//   { rank: 1, team_id: '...', team_name: 'Alpha', total_points: 450, stages_completed: 4 },
//   { rank: 2, team_id: '...', team_name: 'Beta', total_points: 300, stages_completed: 3 },
//   ...
// ]
```

---

## Analytics (Admin)

### Get Stage Analytics
```typescript
const { data, error } = await supabase.rpc('get_stage_analytics', {
  p_event_id: eventId
});
// Returns: [
//   {
//     stage_id: '...',
//     title: 'Stage 1',
//     order_index: 1,
//     teams_attempted: 10,
//     teams_completed: 8,
//     completion_rate: 80.0,
//     avg_completion_seconds: 245.5,
//     avg_attempts: 2.3,
//     hint_usage_rate: 30.0
//   },
//   ...
// ]
```

### Query Raw Analytics
```typescript
const { data, error } = await supabase
  .from('analytics_events')
  .select('*')
  .eq('event_id', eventId)
  .eq('event_type', 'stage_completed')
  .order('created_at', { ascending: false });
```

---

## Real-time Subscriptions

### Subscribe to Event Updates (Timer)
```typescript
const channel = supabase
  .channel(`event:${eventId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'events',
      filter: `id=eq.${eventId}`
    },
    (payload) => {
      console.log('Event updated:', payload.new);
      // Update local timer state
    }
  )
  .subscribe();

// Cleanup
channel.unsubscribe();
```

### Subscribe to Team Progress
```typescript
const channel = supabase
  .channel(`team:${teamId}`)
  .on(
    'postgres_changes',
    {
      event: '*', // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'team_progress',
      filter: `team_id=eq.${teamId}`
    },
    (payload) => {
      console.log('Progress updated:', payload);
    }
  )
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'hint_usage',
      filter: `team_id=eq.${teamId}`
    },
    (payload) => {
      console.log('Hint revealed:', payload.new);
    }
  )
  .subscribe();
```

### Subscribe to Leaderboard
```typescript
// Note: Leaderboard is a materialized view, subscribe to team_progress instead
const channel = supabase
  .channel(`leaderboard:${eventId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'team_progress'
    },
    async () => {
      // Re-fetch leaderboard
      const { data } = await supabase.rpc('get_leaderboard', { p_event_id: eventId });
      // Update UI
    }
  )
  .subscribe();
```

---

## Error Handling

All Supabase operations return `{ data, error }`. Always check for errors:

```typescript
const { data, error } = await supabase.rpc('submit_answer', { ... });

if (error) {
  // Handle specific error messages
  switch (error.message) {
    case 'Time has expired':
      // Show time expired modal
      break;
    case 'Stage is not accessible':
      // Redirect to correct stage
      break;
    default:
      // Show generic error
      console.error('Error:', error.message);
  }
  return;
}

// Use data
console.log('Answer result:', data);
```

---

## Type Safety

Use the generated types with Supabase client:

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Event, Team, TeamProgress } from '@/lib/types';

// Create typed client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Queries are now typed
const { data } = await supabase
  .from('events')
  .select('*')
  .single();

// data is typed as Event | null
```

