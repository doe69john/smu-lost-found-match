# Match Lost Item Edge Function

This Supabase Edge Function implements AI-powered matching between lost and found items using Google Cloud Vision API.

## How It Works

1. **Triggered by Database**: When a new lost item is inserted into the `lost_items` table with images, a database trigger automatically calls this Edge Function.

2. **Image Analysis**: The function uses Google Cloud Vision API to analyze:
   - Web entities (objects detected in the image)
   - Labels (general categories and descriptors)
   - Dominant colors

3. **Comparison**: Compares the lost item image against all active found items:
   - **Image Similarity** (60% weight): Uses Vision API analysis to compare visual features
   - **Metadata Similarity** (40% weight): Compares category, brand, model, and color

4. **Matching Results**: Creates match records in the `matches` table with confidence scores (0.00 to 1.00)

## Configuration

### Required Environment Variables

Set these in your Supabase project dashboard (Settings → Edge Functions):

```bash
SUPABASE_URL=https://oxubfeizhswsrczchtkr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GOOGLE_CLOUD_VISION_CREDENTIALS={"type":"service_account",...}
GOOGLE_CLOUD_VISION_API_KEY=your-api-key
```

### Google Cloud Vision API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Cloud Vision API**
3. Create an API key:
   - Go to **APIs & Services → Credentials**
   - Click **Create Credentials → API Key**
   - Copy the API key
4. Set the `GOOGLE_CLOUD_VISION_API_KEY` environment variable in Supabase

## Deployment

```bash
# Deploy the Edge Function
supabase functions deploy match-lost-item

# Set environment variables
supabase secrets set GOOGLE_CLOUD_VISION_API_KEY=your-api-key
```

## Testing

You can test the function manually:

```bash
curl -X POST https://oxubfeizhswsrczchtkr.supabase.co/functions/v1/match-lost-item \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"lostItemId":"uuid-of-lost-item"}'
```

## Response Format

Success response:
```json
{
  "message": "Matching completed successfully",
  "matchesFound": 3,
  "matches": [
    {
      "lost_item_id": "uuid",
      "found_item_id": "uuid",
      "confidence_score": 0.85,
      "status": "pending"
    }
  ]
}
```

## Algorithm Details

### Image Similarity (0-1 score)
- **Web Entities** (40%): Jaccard similarity of detected objects
- **Labels** (40%): Jaccard similarity of image labels
- **Colors** (20%): RGB distance of dominant colors

### Metadata Similarity (0-1 score)
- **Category**: Exact match = 1.0
- **Brand**: Exact match = 1.0, partial match = 0.5
- **Model**: Exact match = 1.0, partial match = 0.5
- **Color**: Exact match = 1.0, partial match = 0.5

### Final Score
```
final_score = (image_similarity * 0.6) + (metadata_similarity * 0.4)
```

Only matches with score > 0.3 (30%) are saved to the database.
Top 5 matches are returned.

## Troubleshooting

**No matches found**:
- Check if there are active found items with images
- Verify Vision API key is set correctly
- Check logs: `supabase functions logs match-lost-item`

**Vision API errors**:
- Ensure API is enabled in Google Cloud Console
- Check API key permissions
- Verify billing is enabled for the Google Cloud project

**Database trigger not firing**:
- Check if `pg_net` extension is installed
- Verify trigger is created: `SELECT * FROM pg_trigger WHERE tgname LIKE '%lost_item%';`
