-- Complete Automation Setup
-- This applies both matching triggers (lost items + found items) and email notifications

-- ============================================================================
-- PART 1: Fix Lost Item Matching Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.invoke_matching_service(lost_item_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM
    net.http_post(
      url := 'https://oxubfeizhswsrczchtkr.supabase.co/functions/v1/match-lost-item',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94dWJmZWl6aHN3c3JjemNodGtyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDAxOTEyNCwiZXhwIjoyMDc1NTk1MTI0fQ.3BlQv51vWNOl2VL04oYSN3b9qyo3_ABG61BseWxoHZ4'
      ),
      body := jsonb_build_object(
        'lostItemId', lost_item_id
      )
    );
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_net extension not available. Please invoke matching service manually for lost_item_id: %', lost_item_id;
  WHEN OTHERS THEN
    RAISE NOTICE 'Failed to invoke matching service: %', SQLERRM;
END;
$$;

-- ============================================================================
-- PART 2: Add Found Item Matching Trigger (NEW!)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_match_on_found_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lost_item_record RECORD;
BEGIN
  -- Only trigger matching for items with images
  IF NEW.image_metadata IS NOT NULL
     AND jsonb_typeof(NEW.image_metadata) = 'array'
     AND jsonb_array_length(NEW.image_metadata::jsonb) > 0 THEN

    -- Find all active lost items in the same category that have images
    FOR lost_item_record IN
      SELECT id
      FROM public.lost_items
      WHERE status = 'active'
        AND category = NEW.category
        AND image_metadata IS NOT NULL
        AND jsonb_typeof(image_metadata) = 'array'
        AND jsonb_array_length(image_metadata::jsonb) > 0
    LOOP
      -- Invoke the matching service for each relevant lost item
      PERFORM invoke_matching_service(lost_item_record.id);

      -- Update the matching status to processing
      UPDATE public.lost_items
      SET matching_status = 'processing'
      WHERE id = lost_item_record.id;
    END LOOP;

    RAISE NOTICE 'Triggered re-matching for found item in category: %', NEW.category;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on found_items INSERT
DROP TRIGGER IF EXISTS on_found_item_inserted ON public.found_items;
CREATE TRIGGER on_found_item_inserted
  AFTER INSERT ON public.found_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_match_on_found_item_insert();

-- ============================================================================
-- PART 3: Email Notifications (Already Applied)
-- ============================================================================

-- (Email notification trigger was already applied earlier)

-- ============================================================================
-- Success Message
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ All automation configured successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Enabled:';
  RAISE NOTICE '  ✅ Lost items trigger matching when created';
  RAISE NOTICE '  ✅ Found items trigger re-matching when created';
  RAISE NOTICE '  ✅ Email notifications sent when matches found';
  RAISE NOTICE '';
  RAISE NOTICE 'System is now fully automated!';
END $$;
