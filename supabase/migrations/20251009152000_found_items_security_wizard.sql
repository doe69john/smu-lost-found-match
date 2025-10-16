-- Create table of campus security offices
CREATE TABLE IF NOT EXISTS public.security_offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.security_offices ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated users can view security offices"
  ON public.security_offices
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Service role can manage security offices"
  ON public.security_offices
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER IF NOT EXISTS update_security_offices_updated_at
  BEFORE UPDATE ON public.security_offices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.security_offices (name, location)
VALUES
  ('Main Security Desk', 'Student Center, Level 1'),
  ('North Campus Security Post', 'North Garage Lobby'),
  ('Library Security Office', 'University Library, Ground Floor')
ON CONFLICT DO NOTHING;

-- Extend found_items with drop-off tracking and image metadata
ALTER TABLE public.found_items
  ADD COLUMN IF NOT EXISTS drop_off_office_id UUID REFERENCES public.security_offices(id),
  ADD COLUMN IF NOT EXISTS drop_off_confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS image_metadata JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.found_items
SET image_metadata = CASE
  WHEN image_url IS NOT NULL THEN jsonb_build_array(jsonb_build_object('path', image_url))
  ELSE '[]'::jsonb
END
WHERE image_metadata IS NULL OR jsonb_typeof(image_metadata) IS DISTINCT FROM 'array';

COMMENT ON COLUMN public.found_items.image_metadata IS 'Array of uploaded image descriptors (path, original filename, metadata).';
COMMENT ON COLUMN public.found_items.drop_off_office_id IS 'Security office that received the item.';
COMMENT ON COLUMN public.found_items.drop_off_confirmed_at IS 'Timestamp when the reporter confirmed the security handoff.';
