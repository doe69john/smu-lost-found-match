-- Allow users to update the status of their own lost and found items when claiming
-- This is needed when they claim a match

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can update their own lost items" ON public.lost_items;
DROP POLICY IF EXISTS "Users can update their own found items" ON public.found_items;

-- Create policy to allow users to update their own lost items
CREATE POLICY "Users can update their own lost items"
ON public.lost_items
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own found items
CREATE POLICY "Users can update their own found items"
ON public.found_items
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
