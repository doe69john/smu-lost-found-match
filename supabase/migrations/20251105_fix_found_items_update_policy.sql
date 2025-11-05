-- Fix RLS policy for found_items to allow status updates when claiming
-- The issue: found_items are created by one user but need to be claimed by another user
-- Solution: Allow updates if the found item is part of a confirmed match with the user's lost item

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Users can update their own found items" ON public.found_items;

-- Create policy to allow users to update found items in two scenarios:
-- 1. They own the found item
-- 2. The found item is matched to their lost item (for claiming)
CREATE POLICY "Users can update their own or matched found items"
ON public.found_items
FOR UPDATE
USING (
  auth.uid() = user_id
  OR
  -- Allow update if this found item is matched to user's lost item
  EXISTS (
    SELECT 1
    FROM matches m
    INNER JOIN lost_items li ON m.lost_item_id = li.id
    WHERE m.found_item_id = found_items.id
    AND li.user_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = user_id
  OR
  -- Allow update if this found item is matched to user's lost item
  EXISTS (
    SELECT 1
    FROM matches m
    INNER JOIN lost_items li ON m.lost_item_id = li.id
    WHERE m.found_item_id = found_items.id
    AND li.user_id = auth.uid()
  )
);
