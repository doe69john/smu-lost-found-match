#!/bin/bash

SUPABASE_URL="https://oxubfeizhswsrczchtkr.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94dWJmZWl6aHN3c3JjemNodGtyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDAxOTEyNCwiZXhwIjoyMDc1NTk1MTI0fQ.3BlQv51vWNOl2VL04oYSN3b9qyo3_ABG61BseWxoHZ4"

# Use one of your existing lost items for testing
LOST_ITEM_ID="67f5be29-f8a7-45e3-832c-6417af0f81bb"  # AirPods Pro 2
MATCH_COUNT=4

echo "=== Testing Email Notification System ==="
echo ""
echo "This will send a test notification email for:"
echo "  Lost Item ID: $LOST_ITEM_ID"
echo "  Match Count: $MATCH_COUNT"
echo ""

# Get the user email for this lost item
echo "Fetching user information..."
USER_INFO=$(curl -s "${SUPABASE_URL}/rest/v1/lost_items?id=eq.${LOST_ITEM_ID}&select=user_id,brand,model,profiles:user_id(email,full_name)" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}")

echo "User Info: $USER_INFO" | jq '.'
echo ""

# Call the notification function
echo "Sending test notification email..."
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  "${SUPABASE_URL}/functions/v1/send-match-notification" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -d "{\"lostItemId\": \"$LOST_ITEM_ID\", \"matchCount\": $MATCH_COUNT}")

http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
body=$(echo "$response" | grep -v "HTTP_STATUS")

echo ""
echo "HTTP Status: $http_status"
echo "Response:"
echo "$body" | jq '.' 2>/dev/null || echo "$body"

echo ""
if [ "$http_status" = "200" ]; then
  echo "✅ Test email sent successfully!"
  echo "Check your inbox for the notification email."
else
  echo "❌ Failed to send email. Check the response above for details."
fi
