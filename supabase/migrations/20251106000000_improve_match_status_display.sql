-- Migration to improve match status display
-- This adds a view to track actual match counts alongside matching_status

-- Create a helper function to get match count for a lost item
CREATE OR REPLACE FUNCTION public.get_match_count(lost_item_id_param UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.matches
  WHERE lost_item_id = lost_item_id_param
    AND status = 'pending';
$$;

COMMENT ON FUNCTION public.get_match_count IS 'Returns the count of pending matches for a given lost item';

-- Add index on matches table to speed up count queries
CREATE INDEX IF NOT EXISTS idx_matches_lost_item_status
  ON public.matches (lost_item_id, status);

COMMENT ON INDEX idx_matches_lost_item_status IS 'Index to improve performance of match count queries';
