#!/bin/bash

SUPABASE_URL="https://oxubfeizhswsrczchtkr.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94dWJmZWl6aHN3c3JjemNodGtyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDAxOTEyNCwiZXhwIjoyMDc1NTk1MTI0fQ.3BlQv51vWNOl2VL04oYSN3b9qyo3_ABG61BseWxoHZ4"

echo "=== Fetching Lost Items ==="
curl -s "${SUPABASE_URL}/rest/v1/lost_items?select=id,category,brand,model,color,location_lost,date_lost,matching_status,image_metadata&order=created_at.desc&limit=10" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.'

echo ""
echo "=== Fetching Found Items ==="
curl -s "${SUPABASE_URL}/rest/v1/found_items?select=id,category,brand,model,color,location_found,date_found,status,image_metadata&status=neq.claimed&order=created_at.desc&limit=10" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.'

echo ""
echo "=== Fetching Matches ==="
curl -s "${SUPABASE_URL}/rest/v1/matches?select=*&order=created_at.desc&limit=10" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.'
