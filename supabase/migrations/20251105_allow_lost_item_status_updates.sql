-- Allow users to update the status of their own lost items
-- This is needed when they claim a match

-- Check if the policy already exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'lost_items'
        AND policyname = 'Users can update their own lost items'
    ) THEN
        -- Policy doesn't exist, so the existing one might be more restrictive
        -- Drop and recreate with proper permissions
        DROP POLICY IF EXISTS "Users can update their own lost items" ON public.lost_items;

        CREATE POLICY "Users can update their own lost items"
        ON public.lost_items
        FOR UPDATE
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;
