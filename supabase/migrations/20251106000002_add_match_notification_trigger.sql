-- Add automatic email notification trigger when matches are created
-- Sends email to lost item owner when matches are found

-- Create function to invoke the notification Edge Function
CREATE OR REPLACE FUNCTION public.send_match_notification(lost_item_id_param UUID, match_count_param INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Make async HTTP request to the notification Edge Function
  PERFORM
    net.http_post(
      url := 'https://oxubfeizhswsrczchtkr.supabase.co/functions/v1/send-match-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94dWJmZWl6aHN3c3JjemNodGtyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDAxOTEyNCwiZXhwIjoyMDc1NTk1MTI0fQ.3BlQv51vWNOl2VL04oYSN3b9qyo3_ABG61BseWxoHZ4'
      ),
      body := jsonb_build_object(
        'lostItemId', lost_item_id_param,
        'matchCount', match_count_param
      )
    );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Failed to send notification: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.send_match_notification(UUID, INT) IS 'Sends email notification to lost item owner when matches are found';

-- Create trigger function that fires after match insert
-- Only sends notification when matches complete for a lost item
CREATE OR REPLACE FUNCTION public.trigger_notification_on_match_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_count INT;
  lost_item_status TEXT;
BEGIN
  -- Get the current status of the lost item
  SELECT matching_status INTO lost_item_status
  FROM public.lost_items
  WHERE id = NEW.lost_item_id;

  -- Only send notification if:
  -- 1. The lost item matching is completed
  -- 2. This is a new match (not an update)
  IF lost_item_status = 'completed' AND TG_OP = 'INSERT' THEN

    -- Count total matches for this lost item
    SELECT COUNT(*) INTO match_count
    FROM public.matches
    WHERE lost_item_id = NEW.lost_item_id;

    -- Only send notification if this is the FIRST match being inserted
    -- (to avoid sending multiple emails for the same batch)
    IF match_count = 1 THEN
      -- Wait a brief moment for other matches to be inserted (same batch)
      PERFORM pg_sleep(2);

      -- Re-count matches after waiting
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

-- Create trigger on matches INSERT
DROP TRIGGER IF EXISTS on_match_inserted ON public.matches;
CREATE TRIGGER on_match_inserted
  AFTER INSERT ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notification_on_match_complete();

COMMENT ON FUNCTION public.trigger_notification_on_match_complete() IS 'Sends email notification when matches are created for a lost item';
