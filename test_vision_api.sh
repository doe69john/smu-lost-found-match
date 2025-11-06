#!/bin/bash

SUPABASE_URL="https://oxubfeizhswsrczchtkr.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94dWJmZWl6aHN3c3JjemNodGtyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDAxOTEyNCwiZXhwIjoyMDc1NTk1MTI0fQ.3BlQv51vWNOl2VL04oYSN3b9qyo3_ABG61BseWxoHZ4"

# Test with the Galaxy Buds (should be an easy match)
LOST_ITEM_ID="19c48c4a-0e2e-4ae2-bdb2-34ea82f33a36"

echo "=== Testing Vision API with Galaxy Buds 3 ==="
echo "Lost Item ID: $LOST_ITEM_ID"
echo ""

# First, delete any existing matches for this item to test fresh
echo "Cleaning up old matches..."
curl -s -X DELETE "${SUPABASE_URL}/rest/v1/matches?lost_item_id=eq.${LOST_ITEM_ID}" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"

echo ""
echo "Triggering matching service..."
echo ""

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  "${SUPABASE_URL}/functions/v1/match-lost-item" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -d "{\"lostItemId\": \"$LOST_ITEM_ID\"}")

http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
body=$(echo "$response" | grep -v "HTTP_STATUS")

echo "HTTP Status: $http_status"
echo ""
echo "Response:"
echo "$body" | jq '.' 2>/dev/null || echo "$body"

echo ""
echo "=== Checking matches ==="
curl -s "${SUPABASE_URL}/rest/v1/matches?lost_item_id=eq.${LOST_ITEM_ID}&select=*" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq '.'
