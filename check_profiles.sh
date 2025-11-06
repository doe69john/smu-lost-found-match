#!/bin/bash

SUPABASE_URL="https://oxubfeizhswsrczchtkr.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94dWJmZWl6aHN3c3JjemNodGtyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDAxOTEyNCwiZXhwIjoyMDc1NTk1MTI0fQ.3BlQv51vWNOl2VL04oYSN3b9qyo3_ABG61BseWxoHZ4"

LOST_ITEM_ID="67f5be29-f8a7-45e3-832c-6417af0f81bb"

echo "=== Checking Lost Item ==="
curl -s "${SUPABASE_URL}/rest/v1/lost_items?id=eq.${LOST_ITEM_ID}&select=id,user_id,brand,model,category" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.'

echo ""
echo "=== Checking if Profile Exists ==="
USER_ID=$(curl -s "${SUPABASE_URL}/rest/v1/lost_items?id=eq.${LOST_ITEM_ID}&select=user_id" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq -r '.[0].user_id')

echo "User ID: $USER_ID"
echo ""

if [ "$USER_ID" != "null" ] && [ -n "$USER_ID" ]; then
  echo "=== Checking Profile for User ==="
  curl -s "${SUPABASE_URL}/rest/v1/profiles?id=eq.${USER_ID}&select=id,email,full_name" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.'
else
  echo "❌ Could not find user_id"
fi

echo ""
echo "=== Checking Auth Users ==="
curl -s "${SUPABASE_URL}/rest/v1/rpc/get_user_email" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"${USER_ID}\"}" 2>&1 | head -5
