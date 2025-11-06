-- Add automatic matching trigger for found items
-- When a new found item is created, re-run matching for all relevant lost items

-- Create trigger function that fires after found_item insert
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
    -- and re-run matching for them
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

COMMENT ON FUNCTION public.trigger_match_on_found_item_insert() IS 'Automatically re-runs matching for all relevant lost items when a new found item is created';
