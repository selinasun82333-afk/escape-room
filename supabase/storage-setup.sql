-- ========================================
-- Supabase Storage Setup for Webtoon Images
-- ========================================
-- Run this in Supabase SQL Editor to set up the storage bucket

-- 1. Create the storage bucket (if not exists)
-- Note: Buckets are typically created via the Supabase Dashboard UI
-- Go to: Storage -> New bucket -> Name: "webtoons" -> Public bucket: ON

-- 2. Storage policies for the webtoons bucket
-- Allow anyone to view/download images (public read)
CREATE POLICY "Public read access for webtoons" ON storage.objects
FOR SELECT 
USING (bucket_id = 'webtoons');

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload webtoons" ON storage.objects
FOR INSERT 
WITH CHECK (bucket_id = 'webtoons');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update webtoons" ON storage.objects
FOR UPDATE 
USING (bucket_id = 'webtoons');

-- Allow authenticated users to delete images
CREATE POLICY "Authenticated users can delete webtoons" ON storage.objects
FOR DELETE 
USING (bucket_id = 'webtoons');

-- ========================================
-- ALTERNATIVE: Allow anonymous uploads (if not using auth)
-- ========================================
-- If you want to allow anonymous uploads (no authentication required):

-- DROP POLICY IF EXISTS "Authenticated users can upload webtoons" ON storage.objects;
-- CREATE POLICY "Anyone can upload webtoons" ON storage.objects
-- FOR INSERT 
-- WITH CHECK (bucket_id = 'webtoons');

-- DROP POLICY IF EXISTS "Authenticated users can update webtoons" ON storage.objects;
-- CREATE POLICY "Anyone can update webtoons" ON storage.objects
-- FOR UPDATE 
-- USING (bucket_id = 'webtoons');

-- DROP POLICY IF EXISTS "Authenticated users can delete webtoons" ON storage.objects;
-- CREATE POLICY "Anyone can delete webtoons" ON storage.objects
-- FOR DELETE 
-- USING (bucket_id = 'webtoons');

