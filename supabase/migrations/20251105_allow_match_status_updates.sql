-- Allow users to update match status for their own lost items
-- This enables the "claim" functionality where users can confirm a match

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can update matches for their lost items" ON public.matches;

-- Create policy to allow users to update match status for their lost items
CREATE POLICY "Users can update matches for their lost items"
ON public.matches
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.lost_items
    WHERE id = matches.lost_item_id
    AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.lost_items
    WHERE id = matches.lost_item_id
    AND user_id = auth.uid()
  )
);
