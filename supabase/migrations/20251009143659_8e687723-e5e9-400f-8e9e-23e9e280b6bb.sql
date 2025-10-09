-- Fix security issue: Remove public read access to lost_items and found_items
-- Users should only see their own items and matches through the matches table

-- Drop the existing public SELECT policies
DROP POLICY IF EXISTS "Anyone can view active lost items" ON public.lost_items;
DROP POLICY IF EXISTS "Anyone can view active found items" ON public.found_items;

-- Create new restricted SELECT policies
-- Users can only view their own lost items
CREATE POLICY "Users can view their own lost items"
ON public.lost_items
FOR SELECT
USING (auth.uid() = user_id);

-- Users can only view their own found items
CREATE POLICY "Users can view their own found items"
ON public.found_items
FOR SELECT
USING (auth.uid() = user_id);

-- Note: Matches table already has proper RLS policy that allows users
-- to view matches for items they own, so the confidential matching system
-- will continue to work correctly