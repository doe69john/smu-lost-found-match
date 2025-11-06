-- Fix the match notification trigger to properly send emails
-- The previous version only sent email if match_count = 1, which failed for multiple matches

CREATE OR REPLACE FUNCTION public.trigger_notification_on_match_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_count INT;
  lost_item_status TEXT;
  notification_sent BOOLEAN;
BEGIN
  -- Get the current status of the lost item
  SELECT matching_status INTO lost_item_status
  FROM public.lost_items
  WHERE id = NEW.lost_item_id;

  -- Only send notification if:
  -- 1. The lost item matching is completed
  -- 2. This is a new match (not an update)
  IF lost_item_status = 'completed' AND TG_OP = 'INSERT' THEN

    -- Check if we've already sent a notification for this lost item
    -- by checking if any match has a notification_sent flag
    -- For now, we'll use a simpler approach: always send on first completion

    -- Count total matches for this lost item BEFORE this insert
    SELECT COUNT(*) INTO match_count
    FROM public.matches
    WHERE lost_item_id = NEW.lost_item_id
      AND id != NEW.id; -- Exclude the current match being inserted

    -- Only send notification if this is the FIRST match (count was 0 before this)
    IF match_count = 0 THEN
      -- Wait a brief moment for other matches to be inserted (same batch)
      PERFORM pg_sleep(2);

      -- Re-count matches after waiting to get the final count
      SELECT COUNT(*) INTO match_count
      FROM public.matches
      WHERE lost_item_id = NEW.lost_item_id;

      -- Send notification with accurate count
      PERFORM send_match_notification(NEW.lost_item_id, match_count);

      RAISE NOTICE 'Notification sent for lost_item_id: % with % matches', NEW.lost_item_id, match_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_notification_on_match_complete() IS 'Sends email notification when the first match is created for a lost item';
