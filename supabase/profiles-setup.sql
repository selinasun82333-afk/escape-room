-- ========================================
-- Profiles Table Setup for Admin Role Management
-- ========================================
-- Run this in Supabase SQL Editor

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    role text DEFAULT 'user',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Policies for profiles table
-- Allow users to read their own profile
CREATE POLICY "Users can view own profile" ON profiles
FOR SELECT USING (auth.uid() = id);

-- Allow users to update their own profile (except role)
CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE USING (auth.uid() = id);

-- Allow service role to manage all profiles
CREATE POLICY "Service role can manage all profiles" ON profiles
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 4. Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'user');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- Set admin role for specific user
-- ========================================
-- Replace 'selina@escape.com' with your admin email

-- Option 1: Update existing profile
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'selina@escape.com';

-- Option 2: If profile doesn't exist, insert it manually
-- First, get the user ID from auth.users
-- INSERT INTO profiles (id, email, role)
-- SELECT id, email, 'admin' 
-- FROM auth.users 
-- WHERE email = 'selina@escape.com'
-- ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- ========================================
-- Quick Admin Setup (Run this if above doesn't work)
-- ========================================
DO $$
DECLARE
    admin_user_id uuid;
BEGIN
    -- Get user ID for admin email
    SELECT id INTO admin_user_id FROM auth.users WHERE email = 'selina@escape.com';
    
    IF admin_user_id IS NOT NULL THEN
        -- Insert or update profile with admin role
        INSERT INTO profiles (id, email, role)
        VALUES (admin_user_id, 'selina@escape.com', 'admin')
        ON CONFLICT (id) DO UPDATE SET role = 'admin';
        
        RAISE NOTICE 'Admin role set for selina@escape.com';
    ELSE
        RAISE NOTICE 'User selina@escape.com not found in auth.users';
    END IF;
END $$;

-- Verify admin setup
SELECT * FROM profiles WHERE role = 'admin';

