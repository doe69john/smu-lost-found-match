#!/bin/bash

SUPABASE_URL="https://oxubfeizhswsrczchtkr.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94dWJmZWl6aHN3c3JjemNodGtyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDAxOTEyNCwiZXhwIjoyMDc1NTk1MTI0fQ.3BlQv51vWNOl2VL04oYSN3b9qyo3_ABG61BseWxoHZ4"

# Lost items that need matching
LOST_ITEMS=(
  "67f5be29-f8a7-45e3-832c-6417af0f81bb"  # AirPods Pro 2 (KGC Library)
  "af40856c-b292-4bb0-a871-36ab425bc60b"  # University Concession Card
  "20f73582-6a57-40cf-8433-0bcdb652a716"  # iPhone 17 Pro Max
  "19c48c4a-0e2e-4ae2-bdb2-34ea82f33a36"  # Galaxy Buds 3
)

echo "=== Triggering Matching Service for Lost Items ==="

for lost_item_id in "${LOST_ITEMS[@]}"; do
  echo ""
  echo "Triggering matching for: $lost_item_id"

  response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    "${SUPABASE_URL}/functions/v1/match-lost-item" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -d "{\"lostItemId\": \"$lost_item_id\"}")

  http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
  body=$(echo "$response" | grep -v "HTTP_STATUS")

  echo "Status: $http_status"
  echo "Response: $body" | jq '.' 2>/dev/null || echo "$body"

  # Wait a bit between requests to avoid rate limiting
  sleep 2
done

echo ""
echo "=== Done ==="
