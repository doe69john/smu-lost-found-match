#!/bin/bash

# Test script for the match-lost-item Edge Function
# Usage: ./test.sh <lost_item_id>

set -e

# Configuration
SUPABASE_URL="https://oxubfeizhswsrczchtkr.supabase.co"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if lost item ID is provided
if [ -z "$1" ]; then
    print_error "Lost item ID is required"
    echo "Usage: $0 <lost_item_id>"
    echo ""
    echo "Example:"
    echo "  $0 123e4567-e89b-12d3-a456-426614174000"
    echo ""
    echo "Or set SUPABASE_SERVICE_ROLE_KEY environment variable:"
    echo "  export SUPABASE_SERVICE_ROLE_KEY=your-key-here"
    echo "  $0 <lost_item_id>"
    exit 1
fi

LOST_ITEM_ID="$1"

# Check if service role key is set
if [ -z "$SERVICE_ROLE_KEY" ]; then
    print_error "SUPABASE_SERVICE_ROLE_KEY environment variable is not set"
    echo ""
    echo "Set it with:"
    echo "  export SUPABASE_SERVICE_ROLE_KEY=your-key-here"
    echo ""
    echo "Or pass it directly:"
    echo "  SUPABASE_SERVICE_ROLE_KEY=your-key $0 $LOST_ITEM_ID"
    exit 1
fi

print_info "Testing matching service for lost item: $LOST_ITEM_ID"

# Check if the lost item exists
print_info "Checking if lost item exists..."
LOST_ITEM=$(curl -s -X GET \
    "$SUPABASE_URL/rest/v1/lost_items?id=eq.$LOST_ITEM_ID&select=*" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY")

if [ "$(echo "$LOST_ITEM" | jq '. | length')" -eq 0 ]; then
    print_error "Lost item not found with ID: $LOST_ITEM_ID"
    exit 1
fi

print_info "Lost item found:"
echo "$LOST_ITEM" | jq '.[0] | {id, description, category, matching_status, image_metadata}'

# Call the Edge Function
print_info "Calling match-lost-item Edge Function..."
RESPONSE=$(curl -s -X POST \
    "$SUPABASE_URL/functions/v1/match-lost-item" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"lostItemId\":\"$LOST_ITEM_ID\"}")

# Check if the response is valid JSON
if ! echo "$RESPONSE" | jq . > /dev/null 2>&1; then
    print_error "Invalid JSON response from Edge Function"
    echo "$RESPONSE"
    exit 1
fi

# Check for errors in response
if echo "$RESPONSE" | jq -e '.error' > /dev/null; then
    print_error "Edge Function returned an error:"
    echo "$RESPONSE" | jq .
    exit 1
fi

print_info "Edge Function response:"
echo "$RESPONSE" | jq .

# Fetch and display the matches
print_info "Fetching matches from database..."
MATCHES=$(curl -s -X GET \
    "$SUPABASE_URL/rest/v1/matches?lost_item_id=eq.$LOST_ITEM_ID&select=*,found_items(id,description,category)" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY")

MATCH_COUNT=$(echo "$MATCHES" | jq '. | length')

if [ "$MATCH_COUNT" -eq 0 ]; then
    print_warning "No matches found in database"
else
    print_info "Found $MATCH_COUNT match(es):"
    echo "$MATCHES" | jq '.[] | {
        confidence_score,
        status,
        found_item: .found_items.description,
        category: .found_items.category
    }'
fi

# Check the updated matching_status
print_info "Checking updated matching status..."
UPDATED_STATUS=$(curl -s -X GET \
    "$SUPABASE_URL/rest/v1/lost_items?id=eq.$LOST_ITEM_ID&select=matching_status" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" | jq -r '.[0].matching_status')

print_info "Matching status: $UPDATED_STATUS"

if [ "$UPDATED_STATUS" = "completed" ]; then
    print_info "✅ Matching service completed successfully!"
elif [ "$UPDATED_STATUS" = "failed" ]; then
    print_error "❌ Matching service failed"
    exit 1
else
    print_warning "⚠️  Matching status: $UPDATED_STATUS"
fi
