# Lost & Found Matching Service - Setup Guide

This guide walks you through deploying the AI-powered matching service that automatically compares lost items against found items using Google Cloud Vision API.

## Overview

When a user reports a lost item with images:
1. The item is inserted into the `lost_items` table
2. A database trigger fires and calls the `match-lost-item` Edge Function
3. The Edge Function analyzes the lost item's images using Google Cloud Vision API
4. It compares against all active found items with images
5. Top matches are inserted into the `matches` table with confidence scores

---

## Prerequisites

1. **Supabase CLI** installed: [https://supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli)
2. **Google Cloud Account** with Vision API enabled
3. **Supabase project** (already set up at `oxubfeizhswsrczchtkr.supabase.co`)

---

## Step 1: Set Up Google Cloud Vision API

### 1.1 Enable the Vision API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project `smu-lost-and-found-matcher` (or create a new project)
3. Navigate to **APIs & Services → Library**
4. Search for "Cloud Vision API"
5. Click **Enable**

### 1.2 Create an API Key

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → API Key**
3. Copy the API key (you'll need this later)
4. (Optional) Click **Restrict Key** and limit it to Cloud Vision API only

### 1.3 Verify Service Account (Already Done)

The service account credentials are already in `supabase/.env`:
```json
{
  "type": "service_account",
  "project_id": "smu-lost-and-found-matcher",
  "client_email": "smu-lost-and-found@smu-lost-and-found-matcher.iam.gserviceaccount.com",
  ...
}
```

---

## Step 2: Apply Database Migration

### 2.1 Link Supabase Project

```bash
# Navigate to project directory
cd /path/to/smu-lost-found-match

# Link to your Supabase project
supabase link --project-ref oxubfeizhswsrczchtkr
```

### 2.2 Apply the Migration

```bash
# Run the new migration
supabase db push

# Or if using the Supabase dashboard:
# Copy the contents of supabase/migrations/20251105123213_add_lost_items_image_metadata_and_matching.sql
# and run it in the SQL Editor
```

This migration will:
- Add `image_metadata` JSONB column to `lost_items`
- Add `matching_status` column to track matching progress
- Create database functions and triggers
- Create indexes for performance

---

## Step 3: Enable pg_net Extension (Required for Triggers)

The database trigger uses `pg_net` to call the Edge Function asynchronously.

### 3.1 Enable pg_net

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant permissions
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA net TO postgres, anon, authenticated, service_role;
```

### 3.2 Configure Database Settings

```sql
-- Set Supabase URL for the trigger to use
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://oxubfeizhswsrczchtkr.supabase.co';

-- Set service role key (replace with your actual key)
ALTER DATABASE postgres SET app.settings.supabase_service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE';
```

To get your service role key:
1. Go to Supabase Dashboard → Settings → API
2. Copy the `service_role` key (secret!)

---

## Step 4: Deploy the Edge Function

### 4.1 Login to Supabase CLI

```bash
supabase login
```

### 4.2 Deploy the Function

```bash
# Deploy the match-lost-item function
supabase functions deploy match-lost-item
```

### 4.3 Set Environment Variables

```bash
# Set the Google Cloud Vision API Key
supabase secrets set GOOGLE_CLOUD_VISION_API_KEY=your-api-key-here

# Verify secrets are set
supabase secrets list
```

The function will also automatically have access to:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLOUD_VISION_CREDENTIALS` (from your project settings)

---

## Step 5: Test the Matching Service

### 5.1 Manual Test

Test the Edge Function directly:

```bash
curl -X POST https://oxubfeizhswsrczchtkr.supabase.co/functions/v1/match-lost-item \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"lostItemId":"SOME_LOST_ITEM_UUID"}'
```

### 5.2 End-to-End Test

1. **Create a found item** with images through the UI or API:
   ```bash
   # POST to /rest/v1/found_items
   # Include image_metadata field with at least one image
   ```

2. **Create a lost item** with images through the UI or API:
   ```bash
   # POST to /rest/v1/lost_items
   # Include image_metadata field with at least one image
   ```

3. **Check the matches table**:
   ```sql
   SELECT
     m.*,
     l.description as lost_description,
     f.description as found_description
   FROM matches m
   JOIN lost_items l ON m.lost_item_id = l.id
   JOIN found_items f ON m.found_item_id = f.id
   ORDER BY m.created_at DESC
   LIMIT 10;
   ```

4. **Check the matching_status**:
   ```sql
   SELECT id, description, matching_status, created_at
   FROM lost_items
   ORDER BY created_at DESC
   LIMIT 10;
   ```

### 5.3 View Logs

```bash
# View Edge Function logs
supabase functions logs match-lost-item

# View real-time logs
supabase functions logs match-lost-item --tail
```

---

## Step 6: Monitor and Troubleshoot

### Common Issues

**1. Trigger not firing**
```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_lost_item_inserted';

-- Check if pg_net is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_net';
```

**2. Edge Function not receiving requests**
```bash
# Check function logs
supabase functions logs match-lost-item --tail

# Verify the function is deployed
supabase functions list
```

**3. Vision API errors**
- Verify API is enabled in Google Cloud Console
- Check billing is enabled
- Verify API key is correct: `supabase secrets list`
- Check quota limits

**4. No matches found**
- Verify found items have images in `image_metadata`
- Check that found items have status = 'active'
- Lower the threshold in the Edge Function (currently 0.3)

### Monitoring Queries

```sql
-- Check matching performance
SELECT
  matching_status,
  COUNT(*) as count
FROM lost_items
GROUP BY matching_status;

-- View recent matches with scores
SELECT
  l.description as lost_item,
  f.description as found_item,
  m.confidence_score,
  m.status,
  m.created_at
FROM matches m
JOIN lost_items l ON m.lost_item_id = l.id
JOIN found_items f ON m.found_item_id = f.id
ORDER BY m.created_at DESC
LIMIT 20;

-- Average matching time (if you add timing)
SELECT
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds
FROM lost_items
WHERE matching_status = 'completed';
```

---

## Step 7: (Optional) Improve Matching Algorithm

You can tune the matching algorithm by editing `supabase/functions/match-lost-item/index.ts`:

### Adjust Weights

```typescript
// Line ~174: Image vs Metadata weight
const finalScore = imageScore * 0.6 + metadataScore * 0.4

// Line ~130-145: Feature weights in image similarity
totalScore += entityScore * 0.4  // Web entities
totalScore += labelScore * 0.4   // Labels
totalScore += colorSimilarity * 0.2  // Colors
```

### Change Match Threshold

```typescript
// Line ~203: Minimum confidence score
if (finalScore > 0.3) {  // Change 0.3 to your preferred threshold
  matches.push({ foundItem, score: finalScore })
}
```

### Adjust Number of Results

```typescript
// Line ~208: Number of top matches to return
const topMatches = matches.slice(0, 5)  // Change 5 to your preference
```

After making changes, redeploy:
```bash
supabase functions deploy match-lost-item
```

---

## Architecture Diagram

```
┌─────────────┐
│   Frontend  │
│  (Vue.js)   │
└──────┬──────┘
       │ POST /rest/v1/lost_items
       │ (with image_metadata)
       ▼
┌─────────────────────┐
│  Supabase Database  │
│   (PostgreSQL)      │
└──────┬──────────────┘
       │ Trigger fires on INSERT
       │
       ▼
┌─────────────────────┐
│  Database Function  │
│ invoke_matching_    │
│     service()       │
└──────┬──────────────┘
       │ HTTP POST via pg_net
       │
       ▼
┌─────────────────────────────┐
│   Edge Function             │
│  match-lost-item            │
│                             │
│  1. Fetch lost item         │
│  2. Fetch all found items   │
│  3. Call Vision API ────────┼──┐
│  4. Calculate similarity    │  │
│  5. Insert matches          │  │
└──────┬──────────────────────┘  │
       │                          │
       │ INSERT into matches      │
       ▼                          │
┌─────────────────────┐          │
│  Matches Table      │          │
│  (Results stored)   │          │
└─────────────────────┘          │
                                  │
                        ┌─────────▼────────┐
                        │  Google Cloud    │
                        │   Vision API     │
                        └──────────────────┘
```

---

## Next Steps

1. **Test with real data**: Upload actual lost and found items
2. **Monitor matching quality**: Review confidence scores and adjust algorithm
3. **Add user notifications**: Notify users when high-confidence matches are found
4. **Create UI for matches**: Show users their potential matches
5. **Add retry logic**: Handle transient failures gracefully

---

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Vision API Docs**: https://cloud.google.com/vision/docs
- **Edge Functions**: https://supabase.com/docs/guides/functions

For issues, check the Edge Function logs:
```bash
supabase functions logs match-lost-item --tail
```
