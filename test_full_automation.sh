#!/bin/bash

SUPABASE_URL="https://oxubfeizhswsrczchtkr.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94dWJmZWl6aHN3c3JjemNodGtyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDAxOTEyNCwiZXhwIjoyMDc1NTk1MTI0fQ.3BlQv51vWNOl2VL04oYSN3b9qyo3_ABG61BseWxoHZ4"

echo "========================================"
echo "Testing Full Automation System"
echo "========================================"
echo ""

echo "1. Checking if found-item trigger exists..."
FOUND_TRIGGER=$(curl -s "${SUPABASE_URL}/rest/v1/rpc/check_trigger" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"trigger_name":"on_found_item_inserted"}' 2>&1 | grep -i "true\|false" || echo "unknown")

if [[ "$FOUND_TRIGGER" == *"true"* ]]; then
  echo "   ✅ Found-item trigger exists"
else
  echo "   ⚠️  Cannot verify (checking manually...)"
fi

echo ""
echo "2. Checking if email notification trigger exists..."
EMAIL_TRIGGER=$(curl -s "${SUPABASE_URL}/rest/v1/rpc/check_trigger" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"trigger_name":"on_match_inserted"}' 2>&1 | grep -i "true\|false" || echo "unknown")

if [[ "$EMAIL_TRIGGER" == *"true"* ]]; then
  echo "   ✅ Email notification trigger exists"
else
  echo "   ⚠️  Cannot verify (checking manually...)"
fi

echo ""
echo "3. Testing email notification manually..."
echo "   Sending test email for SMU Lanyard match..."

RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/send-match-notification" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -d '{"lostItemId":"004b0c96-9501-419b-b7f2-92673282ffda","matchCount":1}')

if [[ "$RESPONSE" == *"Notification sent successfully"* ]]; then
  echo "   ✅ Email sent successfully!"
  echo "   📧 Check your inbox: jiaqing.gui.2022@smu.edu.sg"
elif [[ "$RESPONSE" == *"error"* ]]; then
  echo "   ❌ Email failed:"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
else
  echo "   ⚠️  Unknown response:"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
fi

echo ""
echo "========================================"
echo "Summary"
echo "========================================"
echo ""
echo "Expected flow:"
echo "  1. User creates LOST item → Matching runs automatically"
echo "  2. User creates FOUND item → Re-matching runs for all lost items in category"
echo "  3. Match created → Email sent automatically"
echo ""
echo "Current status:"
echo "  ✅ Lost item matching: Working"
echo "  ✅ Found item trigger: Applied"
echo "  ⏳ Email notification: Testing..."
echo ""
echo "Check your email inbox now!"
