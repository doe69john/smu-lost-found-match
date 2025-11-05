-- Remove matches where the model names are completely different
-- This cleans up matches created before the model mismatch filter was added

-- Delete matches where:
-- 1. Both items have model names
-- 2. The models share no common words (indicating they're different items)
-- 3. Examples: "AirPods Pro 2" vs "140W USB-C Charger"

DELETE FROM matches
WHERE id IN (
  SELECT m.id
  FROM matches m
  INNER JOIN lost_items li ON m.lost_item_id = li.id
  INNER JOIN found_items fi ON m.found_item_id = fi.id
  WHERE
    -- Both have model names
    li.model IS NOT NULL
    AND fi.model IS NOT NULL
    -- Models are not similar (no substring match)
    AND LOWER(li.model) NOT LIKE '%' || LOWER(fi.model) || '%'
    AND LOWER(fi.model) NOT LIKE '%' || LOWER(li.model) || '%'
    -- Match score is below 60% (not high confidence)
    AND m.confidence_score < 0.6
);

-- Log the cleanup
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Removed % bad matches with mismatched model names', deleted_count;
END $$;
