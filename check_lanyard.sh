#!/bin/bash

SUPABASE_URL="https://oxubfeizhswsrczchtkr.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94dWJmZWl6aHN3c3JjemNodGtyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDAxOTEyNCwiZXhwIjoyMDc1NTk1MTI0fQ.3BlQv51vWNOl2VL04oYSN3b9qyo3_ABG61BseWxoHZ4"

LANYARD_ID="004b0c96-9501-419b-b7f2-92673282ffda"

echo "=== SMU Lanyard Lost Item ==="
curl -s "${SUPABASE_URL}/rest/v1/lost_items?id=eq.${LANYARD_ID}&select=id,brand,model,matching_status,created_at" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.'

echo ""
echo "=== Matches for SMU Lanyard ==="
curl -s "${SUPABASE_URL}/rest/v1/matches?lost_item_id=eq.${LANYARD_ID}&select=*" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.'

echo ""
echo "=== Recent Found Items (Accessories) ==="
curl -s "${SUPABASE_URL}/rest/v1/found_items?category=eq.Accessories&order=created_at.desc&limit=3&select=id,brand,model,location_found,date_found,created_at" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.'

echo ""
echo "=== All Recent Matches (Last 10) ==="
curl -s "${SUPABASE_URL}/rest/v1/matches?order=created_at.desc&limit=10&select=lost_item_id,found_item_id,confidence_score,created_at" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.'
