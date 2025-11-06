# Matching Automation Setup Guide

## Overview

This document explains the fully automated matching system for the SMU Lost & Found platform.

## How Automated Matching Works

### When a Lost Item is Created

1. User submits a lost item with images
2. Database trigger `on_lost_item_inserted` fires
3. Function `invoke_matching_service()` calls the Edge Function
4. Edge Function compares the lost item against ALL found items in database
5. Matches are created and user can view them in dashboard

### When a Found Item is Created ✨ NEW

1. User submits a found item with images
2. Database trigger `on_found_item_inserted` fires
3. Function finds ALL active lost items in the same category
4. For each relevant lost item, `invoke_matching_service()` is called
5. Edge Function re-matches those lost items against the new found item
6. New matches are created and users are notified

## Architecture

```
┌─────────────────┐
│  Lost Item      │
│  Created        │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Trigger: on_lost_item_inserted  │
│ Function: invoke_matching_service│
└────────┬────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│ Edge Function: match-lost-item           │
│ - Analyzes images with Vision API        │
│ - Calculates metadata similarity         │
│ - Creates matches (60% image, 40% meta)  │
└──────────────────────────────────────────┘

┌─────────────────┐
│  Found Item     │
│  Created        │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│ Trigger: on_found_item_inserted          │
│ Function: trigger_match_on_found_item... │
│ - Finds all active lost items (same cat) │
│ - Calls invoke_matching_service for each │
└────────┬─────────────────────────────────┘
         │
         ▼
   [Same Edge Function as above]
```

## Setup Instructions

### 1. Apply Database Triggers

The SQL for both triggers has been copied to your clipboard. Apply it using one of these methods:

#### Option A: Supabase Dashboard (Recommended)
1. Go to [SQL Editor](https://supabase.com/dashboard/project/oxubfeizhswsrczchtkr/sql/new)
2. Paste the contents (already in clipboard)
3. Click "Run"

#### Option B: Command Line (if psql installed)
```bash
psql "postgresql://postgres.oxubfeizhswsrczchtkr:$SUPABASE_DB_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres" -f apply_all_fixes.sql
```

### 2. Verify Setup

Test that both triggers work:

```bash
# Test lost item trigger (already working)
./trigger_matching.sh

# Test found item trigger (after applying fixes)
# Create a new found item via the UI and check that
# existing lost items get re-matched
```

## Matching Algorithm

### Scoring Breakdown

**With Vision API (Current Setup):**
- 60% Image Similarity (Google Cloud Vision API)
  - Web entities detection
  - Label annotations
  - Dominant color matching
- 40% Metadata Similarity
  - Model match (50% weight) - CRITICAL
  - Category match (20% weight)
  - Brand match (20% weight)
  - Color match (15% weight)
  - Location similarity (10% weight)
  - Date proximity (10% weight)

**Score Boosting:**
- Exact model match: Minimum 60% confidence
- Partial model match: Minimum 50% confidence
- Category + brand match: Minimum 30% confidence

### Threshold
- Minimum 15% similarity required to be considered a match
- Top 5 matches are saved per lost item

## Configuration

### Required Environment Variables

Set via `supabase secrets set`:

```bash
GOOGLE_CLOUD_VISION_API_KEY=your_api_key_here
SUPABASE_URL=https://oxubfeizhswsrczchtkr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Database Functions

1. **invoke_matching_service(lost_item_id UUID)**
   - Calls the Edge Function via pg_net
   - Requires pg_net extension
   - Uses service role authentication

2. **trigger_match_on_lost_item_insert()**
   - Fires after INSERT on lost_items
   - Only processes items with images and status='active'

3. **trigger_match_on_found_item_insert()** ✨ NEW
   - Fires after INSERT on found_items
   - Finds all active lost items in same category
   - Triggers re-matching for each relevant lost item

## Troubleshooting

### Matching Not Working?

1. **Check matching_status:**
   ```sql
   SELECT id, matching_status FROM lost_items ORDER BY created_at DESC LIMIT 10;
   ```

2. **Check function logs:**
   ```bash
   # View Edge Function logs in Supabase Dashboard
   https://supabase.com/dashboard/project/oxubfeizhswsrczchtkr/functions
   ```

3. **Manually trigger matching:**
   ```bash
   ./trigger_matching.sh
   ```

### Low Confidence Scores?

- Ensure Vision API key is set correctly
- Check image quality and size
- Verify metadata (brand, model) is filled in correctly
- Review matching algorithm weights in [match-lost-item/index.ts](supabase/functions/match-lost-item/index.ts:478-488)

## Utility Scripts

- `check_items.sh` - View lost/found items and matches from database
- `trigger_matching.sh` - Manually trigger matching for specific lost items
- `test_vision_api.sh` - Test Vision API integration and scoring
- `apply_triggers.sh` - Instructions to apply database triggers

## Migration Files

All migrations in `supabase/migrations/` are essential for the system:

- `20251009141856_*.sql` - Core tables (profiles, lost_items, found_items, matches)
- `20251009143659_*.sql` - Security (RLS policies)
- `20251009152000_*.sql` - Security offices table
- `20251105123213_*.sql` - Image metadata and lost item trigger
- `20251105_allow_*.sql` - RLS for claiming functionality
- `20251105_fix_*.sql` - RLS fixes for viewing matches
- `20251106000000_fix_matching_trigger.sql` - Fixes API key in trigger
- `20251106000001_add_found_item_matching_trigger.sql` - Adds found item trigger

## Performance Considerations

### Found Item Trigger Optimization

The found item trigger only re-matches lost items in the SAME CATEGORY to avoid performance issues:

```sql
WHERE status = 'active'
  AND category = NEW.category  -- Only same category
  AND image_metadata IS NOT NULL
```

For a typical category with ~10-20 active lost items, this means:
- 10-20 Edge Function calls per found item
- ~5-10 seconds total processing time
- Matches appear within seconds of found item creation

### Scaling Considerations

If you have >50 active lost items per category:
- Consider batching the matching calls
- Add rate limiting
- Use a queue system (e.g., pg_cron for scheduled batches)

## Next Steps

1. ✅ Apply the database triggers using `apply_all_fixes.sql`
2. ✅ Test by creating a new found item and verifying matches appear
3. Consider adding email notifications when matches are found
4. Monitor function logs for any errors

## Support

For issues or questions:
- Check the troubleshooting section above
- Review Edge Function logs in Supabase Dashboard
- Use the diagnostic scripts to debug matching issues
