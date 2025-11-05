-- Fix RLS policy for found_items to allow viewing matched items
-- Users should be able to see found_items that match their lost items

-- First, create a security definer function to check if a found item is matched to user's lost item
-- This function runs with elevated privileges to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.user_can_view_found_item(found_item_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this found item is matched to any of the user's lost items
  RETURN EXISTS (
    SELECT 1
    FROM matches m
    INNER JOIN lost_items li ON m.lost_item_id = li.id
    WHERE m.found_item_id = found_item_uuid
    AND li.user_id = auth.uid()
  );
END;
$$;

-- Drop any existing policies
DROP POLICY IF EXISTS "Users can view their own found items" ON public.found_items;
DROP POLICY IF EXISTS "Users can view their own found items and matched items" ON public.found_items;

-- Create a new policy that allows viewing:
-- 1. Their own found items
-- 2. Found items that match their lost items (via security definer function)
CREATE POLICY "Users can view their own found items and matched items"
ON public.found_items
FOR SELECT
USING (
  auth.uid() = user_id
  OR
  public.user_can_view_found_item(id)
);
