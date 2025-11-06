-- Fix the matching service invocation function with correct service role key
-- This replaces the placeholder in the previous migration

CREATE OR REPLACE FUNCTION public.invoke_matching_service(lost_item_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Make async HTTP request to the Edge Function with proper authentication
  -- Using pg_net extension for HTTP requests
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
