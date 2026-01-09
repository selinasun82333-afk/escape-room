-- ============================================
-- SEED DATA FOR DEVELOPMENT
-- Escape Room Platform
-- ============================================

-- Note: Run this after schema.sql and rls_policies.sql
-- This creates sample data for testing

-- ============================================
-- SAMPLE ADMIN USER
-- ============================================

-- First, create a user in Supabase Auth (via dashboard or API)
-- Then the trigger will create the profile automatically
-- For testing, manually insert a profile:

INSERT INTO profiles (id, user_id, display_name, role) VALUES 
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Admin User', 'admin'),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Player One', 'player'),
  ('33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'Player Two', 'player'),
  ('44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'Player Three', 'player')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SAMPLE EVENT
-- ============================================

INSERT INTO events (
  id,
  admin_id,
  title,
  description,
  status,
  timer_duration_seconds,
  max_hints_per_team,
  max_team_size,
  base_points_per_stage,
  time_bonus_enabled
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'The Mystery Mansion',
  'Escape from the haunted mansion before time runs out! Solve puzzles, find clues, and work together to unlock the secrets within.',
  'published',
  3600, -- 1 hour
  5,
  6,
  100,
  true
);

-- ============================================
-- SAMPLE STAGES
-- ============================================

INSERT INTO stages (id, event_id, title, description, order_index, entry_code, puzzle_type, puzzle_data, correct_answer, max_points) VALUES 
(
  'bbbbbbbb-0001-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'The Entrance Hall',
  'You stand in the grand entrance hall. A portrait on the wall seems to hold a secret...',
  1,
  'ENTRY1',
  'text',
  '{"question": "What year is shown in the portrait frame?", "image_url": "/puzzles/entrance-hall.jpg"}'::JSONB,
  '1888',
  100
),
(
  'bbbbbbbb-0002-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'The Library',
  'Ancient books line the walls. One book is slightly out of place...',
  2,
  'LIBR42',
  'text',
  '{"question": "What is the title of the misplaced book?", "hint": "Look for the spine that does not match"}'::JSONB,
  'MIDNIGHT',
  150
),
(
  'bbbbbbbb-0003-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'The Study',
  'A desk with scattered papers. The combination to the safe must be here somewhere...',
  3,
  'STUDY7',
  'numeric',
  '{"question": "Enter the 4-digit combination", "safe_image": "/puzzles/safe.jpg"}'::JSONB,
  '7392',
  200
),
(
  'bbbbbbbb-0004-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'The Secret Passage',
  'A hidden door reveals a dark passage. Strange symbols mark the walls...',
  4,
  'PASS99',
  'text',
  '{"question": "Decode the symbol sequence", "symbols": ["moon", "star", "sun", "???"]}'::JSONB,
  'MOON',
  200
),
(
  'bbbbbbbb-0005-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'The Final Chamber',
  'You''ve reached the final room. One last puzzle stands between you and freedom!',
  5,
  'FINAL0',
  'text',
  '{"question": "Speak the magic word to escape", "riddle": "I am not alive, but I grow; I do not have lungs, but I need air; I do not have a mouth, but water kills me. What am I?"}'::JSONB,
  'FIRE',
  300
);

-- ============================================
-- SAMPLE HINTS
-- ============================================

-- Stage 1 hints
INSERT INTO hints (stage_id, order_index, content, penalty_seconds, penalty_points) VALUES 
('bbbbbbbb-0001-bbbb-bbbb-bbbbbbbbbbbb', 1, 'Look at the bottom right corner of the portrait.', 30, 10),
('bbbbbbbb-0001-bbbb-bbbb-bbbbbbbbbbbb', 2, 'The year is in the 1800s.', 60, 20),
('bbbbbbbb-0001-bbbb-bbbb-bbbbbbbbbbbb', 3, 'The answer is 1888.', 120, 50);

-- Stage 2 hints
INSERT INTO hints (stage_id, order_index, content, penalty_seconds, penalty_points) VALUES 
('bbbbbbbb-0002-bbbb-bbbb-bbbbbbbbbbbb', 1, 'All books are sorted alphabetically except one.', 30, 10),
('bbbbbbbb-0002-bbbb-bbbb-bbbbbbbbbbbb', 2, 'The misplaced book starts with M.', 60, 20),
('bbbbbbbb-0002-bbbb-bbbb-bbbbbbbbbbbb', 3, 'The answer is MIDNIGHT.', 120, 50);

-- Stage 3 hints
INSERT INTO hints (stage_id, order_index, content, penalty_seconds, penalty_points) VALUES 
('bbbbbbbb-0003-bbbb-bbbb-bbbbbbbbbbbb', 1, 'Look at the dates circled on the calendar.', 30, 10),
('bbbbbbbb-0003-bbbb-bbbb-bbbbbbbbbbbb', 2, 'Add up the circled dates: 7 + 3 + 9 + 2', 60, 20),
('bbbbbbbb-0003-bbbb-bbbb-bbbbbbbbbbbb', 3, 'The combination is 7392.', 120, 50);

-- Stage 4 hints  
INSERT INTO hints (stage_id, order_index, content, penalty_seconds, penalty_points) VALUES 
('bbbbbbbb-0004-bbbb-bbbb-bbbbbbbbbbbb', 1, 'The pattern repeats in reverse.', 30, 10),
('bbbbbbbb-0004-bbbb-bbbb-bbbbbbbbbbbb', 2, 'Moon, Star, Sun... then back to?', 60, 20),
('bbbbbbbb-0004-bbbb-bbbb-bbbbbbbbbbbb', 3, 'The answer is MOON.', 120, 50);

-- Stage 5 hints
INSERT INTO hints (stage_id, order_index, content, penalty_seconds, penalty_points) VALUES 
('bbbbbbbb-0005-bbbb-bbbb-bbbbbbbbbbbb', 1, 'Think about natural elements.', 30, 10),
('bbbbbbbb-0005-bbbb-bbbb-bbbbbbbbbbbb', 2, 'It needs oxygen to survive.', 60, 20),
('bbbbbbbb-0005-bbbb-bbbb-bbbbbbbbbbbb', 3, 'The answer is FIRE.', 120, 50);

-- ============================================
-- SAMPLE TEAMS
-- ============================================

INSERT INTO teams (id, event_id, name, join_code, color) VALUES 
('cccccccc-0001-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Team Alpha', 'ALPHA001', '#ef4444'),
('cccccccc-0002-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Team Beta', 'BETA0002', '#3b82f6'),
('cccccccc-0003-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Team Gamma', 'GAMMA003', '#22c55e');

-- ============================================
-- SAMPLE TEAM MEMBERS
-- ============================================

INSERT INTO team_members (team_id, profile_id, is_captain) VALUES 
('cccccccc-0001-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', true),
('cccccccc-0002-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', true),
('cccccccc-0003-cccc-cccc-cccccccccccc', '44444444-4444-4444-4444-444444444444', true);

-- ============================================
-- SAMPLE TEAM PROGRESS (initialized)
-- ============================================

-- Team Alpha progress
INSERT INTO team_progress (team_id, stage_id, status) VALUES 
('cccccccc-0001-cccc-cccc-cccccccccccc', 'bbbbbbbb-0001-bbbb-bbbb-bbbbbbbbbbbb', 'unlocked'),
('cccccccc-0001-cccc-cccc-cccccccccccc', 'bbbbbbbb-0002-bbbb-bbbb-bbbbbbbbbbbb', 'locked'),
('cccccccc-0001-cccc-cccc-cccccccccccc', 'bbbbbbbb-0003-bbbb-bbbb-bbbbbbbbbbbb', 'locked'),
('cccccccc-0001-cccc-cccc-cccccccccccc', 'bbbbbbbb-0004-bbbb-bbbb-bbbbbbbbbbbb', 'locked'),
('cccccccc-0001-cccc-cccc-cccccccccccc', 'bbbbbbbb-0005-bbbb-bbbb-bbbbbbbbbbbb', 'locked');

-- Team Beta progress
INSERT INTO team_progress (team_id, stage_id, status) VALUES 
('cccccccc-0002-cccc-cccc-cccccccccccc', 'bbbbbbbb-0001-bbbb-bbbb-bbbbbbbbbbbb', 'unlocked'),
('cccccccc-0002-cccc-cccc-cccccccccccc', 'bbbbbbbb-0002-bbbb-bbbb-bbbbbbbbbbbb', 'locked'),
('cccccccc-0002-cccc-cccc-cccccccccccc', 'bbbbbbbb-0003-bbbb-bbbb-bbbbbbbbbbbb', 'locked'),
('cccccccc-0002-cccc-cccc-cccccccccccc', 'bbbbbbbb-0004-bbbb-bbbb-bbbbbbbbbbbb', 'locked'),
('cccccccc-0002-cccc-cccc-cccccccccccc', 'bbbbbbbb-0005-bbbb-bbbb-bbbbbbbbbbbb', 'locked');

-- Team Gamma progress
INSERT INTO team_progress (team_id, stage_id, status) VALUES 
('cccccccc-0003-cccc-cccc-cccccccccccc', 'bbbbbbbb-0001-bbbb-bbbb-bbbbbbbbbbbb', 'unlocked'),
('cccccccc-0003-cccc-cccc-cccccccccccc', 'bbbbbbbb-0002-bbbb-bbbb-bbbbbbbbbbbb', 'locked'),
('cccccccc-0003-cccc-cccc-cccccccccccc', 'bbbbbbbb-0003-bbbb-bbbb-bbbbbbbbbbbb', 'locked'),
('cccccccc-0003-cccc-cccc-cccccccccccc', 'bbbbbbbb-0004-bbbb-bbbb-bbbbbbbbbbbb', 'locked'),
('cccccccc-0003-cccc-cccc-cccccccccccc', 'bbbbbbbb-0005-bbbb-bbbb-bbbbbbbbbbbb', 'locked');

-- ============================================
-- REFRESH MATERIALIZED VIEW
-- ============================================

REFRESH MATERIALIZED VIEW leaderboard;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify data was inserted
-- SELECT 'Events' as table_name, COUNT(*) as count FROM events
-- UNION ALL SELECT 'Stages', COUNT(*) FROM stages
-- UNION ALL SELECT 'Hints', COUNT(*) FROM hints
-- UNION ALL SELECT 'Teams', COUNT(*) FROM teams
-- UNION ALL SELECT 'Team Members', COUNT(*) FROM team_members
-- UNION ALL SELECT 'Team Progress', COUNT(*) FROM team_progress;

