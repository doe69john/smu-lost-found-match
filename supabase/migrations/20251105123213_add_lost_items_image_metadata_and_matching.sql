-- Add image_metadata column to lost_items table
ALTER TABLE public.lost_items
  ADD COLUMN IF NOT EXISTS image_metadata JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.lost_items.image_metadata IS 'Array of uploaded image descriptors (path, original filename, metadata).';

-- Create function to invoke the matching Edge Function
-- NOTE: Replace YOUR_SERVICE_ROLE_KEY_HERE with your actual Supabase service role key
CREATE OR REPLACE FUNCTION public.invoke_matching_service(lost_item_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Make async HTTP request to the Edge Function
  -- Using pg_net extension for HTTP requests
  PERFORM
    net.http_post(
      url := 'https://oxubfeizhswsrczchtkr.supabase.co/functions/v1/match-lost-item',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE'
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

-- Create trigger function that fires after lost_item insert
CREATE OR REPLACE FUNCTION public.trigger_match_on_lost_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger matching for active items with images
  -- Check if image_metadata is a non-empty JSON array
  IF NEW.status = 'active'
     AND NEW.image_metadata IS NOT NULL
     AND jsonb_typeof(NEW.image_metadata) = 'array'
     AND jsonb_array_length(NEW.image_metadata::jsonb) > 0 THEN
    -- Invoke the matching service asynchronously
    PERFORM invoke_matching_service(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on lost_items INSERT
DROP TRIGGER IF EXISTS on_lost_item_inserted ON public.lost_items;
CREATE TRIGGER on_lost_item_inserted
  AFTER INSERT ON public.lost_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_match_on_lost_item_insert();

-- Add matching_status column to track matching progress
ALTER TABLE public.lost_items
  ADD COLUMN IF NOT EXISTS matching_status TEXT DEFAULT 'pending' CHECK (matching_status IN ('pending', 'processing', 'completed', 'failed'));

COMMENT ON COLUMN public.lost_items.matching_status IS 'Status of the AI matching process for this item.';

-- Create index on image_metadata for better query performance
CREATE INDEX IF NOT EXISTS idx_lost_items_image_metadata ON public.lost_items USING GIN (image_metadata);
CREATE INDEX IF NOT EXISTS idx_found_items_image_metadata ON public.found_items USING GIN (image_metadata);

-- Create index on matching_status for filtering
CREATE INDEX IF NOT EXISTS idx_lost_items_matching_status ON public.lost_items (matching_status);
