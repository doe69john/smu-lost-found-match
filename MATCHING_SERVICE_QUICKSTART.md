# Matching Service - Quick Start

## TL;DR - Deploy in 5 Minutes

```bash
# 1. Enable pg_net extension (run in Supabase SQL Editor)
CREATE EXTENSION IF NOT EXISTS pg_net;

# 2. Apply database migration
supabase db push

# 3. Deploy Edge Function
supabase functions deploy match-lost-item

# 4. Set Google Vision API key
supabase secrets set GOOGLE_CLOUD_VISION_API_KEY=your-api-key

# 5. Configure database settings (run in SQL Editor)
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://oxubfeizhswsrczchtkr.supabase.co';
ALTER DATABASE postgres SET app.settings.supabase_service_role_key = 'YOUR_SERVICE_ROLE_KEY';
```

Done! Now when users report lost items with images, the system will automatically find matches.

---

## How It Works

```
User reports lost item with photo
        ↓
Database INSERT trigger fires
        ↓
Edge Function called automatically
        ↓
Vision API analyzes images
        ↓
Compares against all found items
        ↓
Top matches saved to database
```

---

## Test It

### Option 1: Use the test script
```bash
export SUPABASE_SERVICE_ROLE_KEY=your-key
./supabase/functions/match-lost-item/test.sh <lost-item-id>
```

### Option 2: Manual cURL
```bash
curl -X POST https://oxubfeizhswsrczchtkr.supabase.co/functions/v1/match-lost-item \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"lostItemId":"your-uuid-here"}'
```

### Option 3: Through the UI
1. Create a found item with images
2. Create a lost item with images
3. Check the `matches` table

---

## View Results

```sql
-- See all matches
SELECT
  l.description as lost_item,
  f.description as found_item,
  m.confidence_score,
  m.status
FROM matches m
JOIN lost_items l ON m.lost_item_id = l.id
JOIN found_items f ON m.found_item_id = f.id
ORDER BY m.confidence_score DESC;

-- Check matching status
SELECT id, description, matching_status
FROM lost_items
ORDER BY created_at DESC
LIMIT 10;
```

---

## Troubleshooting

### Trigger not firing?
```sql
-- Check trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_lost_item_inserted';

-- Check pg_net is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_net';
```

### No matches found?
- Check if found items have images: `SELECT id, description FROM found_items WHERE jsonb_array_length(image_metadata) > 0;`
- Verify Vision API key: `supabase secrets list`
- Lower threshold in Edge Function (default is 30%)

### View logs
```bash
supabase functions logs match-lost-item --tail
```

---

## Get Google Vision API Key

1. Go to https://console.cloud.google.com/
2. Select project "smu-lost-and-found-matcher"
3. Enable "Cloud Vision API"
4. Go to Credentials → Create API Key
5. Copy the key and run: `supabase secrets set GOOGLE_CLOUD_VISION_API_KEY=your-key`

---

## Files Created

- `supabase/migrations/20251105123213_add_lost_items_image_metadata_and_matching.sql` - Database schema
- `supabase/functions/match-lost-item/index.ts` - Matching algorithm
- `supabase/functions/match-lost-item/README.md` - Detailed documentation
- `supabase/functions/match-lost-item/test.sh` - Test script
- `MATCHING_SERVICE_SETUP.md` - Full setup guide

---

## What Changed

### Database
- `lost_items.image_metadata` - JSONB column added (matches `found_items`)
- `lost_items.matching_status` - Tracks matching progress (pending/processing/completed/failed)
- New trigger fires on `lost_items` INSERT
- New indexes for performance

### Frontend
- No changes needed! Frontend already sends `image_metadata` correctly

### New Edge Function
- `match-lost-item` - Compares images using Vision API
- Returns top 5 matches with confidence scores
- Stores results in `matches` table

---

## Matching Algorithm

**Image Similarity (60% weight)**
- Web entities: 40%
- Labels: 40%
- Dominant colors: 20%

**Metadata Similarity (40% weight)**
- Category, brand, model, color comparison

**Threshold**: 30% minimum confidence
**Results**: Top 5 matches per lost item

---

## Need Help?

See the full guide: [MATCHING_SERVICE_SETUP.md](./MATCHING_SERVICE_SETUP.md)
