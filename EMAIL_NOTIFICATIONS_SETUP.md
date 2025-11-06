# Email Notifications Setup Guide

## Overview

Automatic email notifications are sent to users when matches are found for their lost items. The system uses Supabase Edge Functions and the Resend email service.

## How It Works

```
┌──────────────────┐
│ Matches Created  │
│ for Lost Item    │
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────┐
│ Trigger: on_match_inserted     │
│ (waits for batch completion)   │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Function: send_match_notification│
│ (calls Edge Function)          │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Edge Function:                 │
│ send-match-notification        │
│ - Fetches user email           │
│ - Sends email via Resend       │
└────────────────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Email Delivered to User Inbox │
│ with link to dashboard         │
└────────────────────────────────┘
```

## Email Content

The notification email includes:

- ✅ **Subject**: "Match Found for Your Lost [Item]"
- ✅ **Content**: Number of matches found
- ✅ **Call-to-Action**: Direct link to dashboard to view matches
- ✅ **Branding**: SMU Lost & Found styling
- ✅ **Responsive Design**: Mobile-friendly HTML email

**No sensitive details** are included in the email - users must click through to the dashboard to view match details.

## Setup Instructions

### 1. Apply Database Trigger

The email notification trigger needs to be added to your database.

#### Option A: Supabase Dashboard SQL Editor
1. Go to [SQL Editor](https://supabase.com/dashboard/project/oxubfeizhswsrczchtkr/sql/new)
2. Copy contents of `setup_email_notifications.sql`
3. Paste and click "Run"

#### Option B: Copy to clipboard and paste
```bash
cat setup_email_notifications.sql | pbcopy
```

Then paste into Supabase SQL Editor.

### 2. Verify Resend API Key

Check that the Resend API key is configured:

```bash
supabase secrets list | grep RESEND_API_KEY
```

If not set, add it:

```bash
supabase secrets set RESEND_API_KEY=your_resend_api_key_here
```

### 3. Configure Email Domain (Production)

For production, you'll need to:

1. Verify your domain with Resend
2. Update the `from` address in [send-match-notification/index.ts:97](supabase/functions/send-match-notification/index.ts#L97):

```typescript
from: 'SMU Lost & Found <noreply@yourdomain.com>',
```

For testing, Resend provides a default sandbox domain.

### 4. Set App URL

Ensure the APP_URL is set correctly for the dashboard links:

```bash
# For development
supabase secrets set APP_URL=http://localhost:5173

# For production
supabase secrets set APP_URL=https://your-production-domain.com
```

## Testing

### Manual Test

Run the test script to send a test notification:

```bash
./test_email_notification.sh
```

This will:
1. Use an existing lost item from your database
2. Send a test email to the item owner
3. Display the response and email delivery status

### End-to-End Test

1. Create a new lost item via the UI (with images)
2. Wait for matching to complete
3. Check your email inbox for the notification

If matches are found, you should receive an email within ~5 seconds.

## Notification Logic

### When Emails Are Sent

Emails are sent when:
- ✅ A new match is created (INSERT on matches table)
- ✅ The lost item's matching status is 'completed'
- ✅ This is the first match in the batch (to avoid duplicate emails)

Emails are NOT sent when:
- ❌ Lost item is already claimed
- ❌ Match is updated (only INSERT triggers notification)
- ❌ Lost item matching is still in progress

### Batch Handling

The trigger waits 2 seconds after the first match to allow all matches in the batch to be inserted. This ensures:
- Only ONE email per matching session
- Accurate match count in the email
- Better user experience (no spam)

## Database Functions

### `send_match_notification(lost_item_id UUID, match_count INT)`

Calls the Edge Function to send the email notification.

**Parameters:**
- `lost_item_id`: UUID of the lost item
- `match_count`: Number of matches found

**Behavior:**
- Makes async HTTP POST to Edge Function
- Runs with SECURITY DEFINER (elevated privileges)
- Fails gracefully (logs error, doesn't block)

### `trigger_notification_on_match_complete()`

Trigger function that determines when to send notifications.

**Logic:**
1. Check if lost item matching is completed
2. Only process on INSERT (not UPDATE)
3. Wait for batch completion (2 second delay on first match)
4. Count total matches
5. Call `send_match_notification()`

## Edge Function

### `send-match-notification`

**Location:** [supabase/functions/send-match-notification/index.ts](supabase/functions/send-match-notification/index.ts)

**Responsibilities:**
1. Fetch lost item details from database
2. Fetch user email from profiles table
3. Build HTML email with dashboard link
4. Send via Resend API
5. Return success/error response

**Environment Variables:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
- `APP_URL` - Frontend app URL for dashboard links
- `RESEND_API_KEY` - Resend API key for sending emails

## Troubleshooting

### No emails received?

1. **Check Resend API Key:**
   ```bash
   supabase secrets list | grep RESEND_API_KEY
   ```

2. **Check function logs:**
   Go to [Functions Dashboard](https://supabase.com/dashboard/project/oxubfeizhswsrczchtkr/functions) and view logs for `send-match-notification`

3. **Check database trigger:**
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'on_match_inserted';
   ```

4. **Test manually:**
   ```bash
   ./test_email_notification.sh
   ```

### Emails going to spam?

- Verify your domain with Resend
- Add SPF and DKIM records to your domain
- Use a proper `from` address (not the sandbox)

### Multiple emails sent?

The trigger has built-in duplicate prevention:
- Only the first match in a batch triggers the wait
- Subsequent matches in the same batch are ignored
- Check function logs to verify behavior

### Wrong match count in email?

The trigger waits 2 seconds to count all matches. If matches are inserted very slowly (>2 seconds apart), the count might be inaccurate. Consider:
- Increasing the wait time in the trigger
- Checking Edge Function performance

## Email Template Customization

To customize the email template, edit [send-match-notification/index.ts:98-160](supabase/functions/send-match-notification/index.ts#L98-L160).

The template uses inline CSS for maximum email client compatibility.

**Current styling:**
- Purple gradient header (#6366f1 to #8b5cf6)
- Clean, modern design
- Mobile-responsive
- Single call-to-action button

## Rate Limiting

No rate limiting is currently implemented. Consider adding:

1. **Per-user limits:** Max X notifications per hour
2. **Cooldown period:** Don't send another notification if one was sent in the last Y minutes
3. **Global limits:** Max notifications per minute across all users

Implementation would be in the database trigger function.

## Cost Considerations

### Resend Pricing
- Free tier: 3,000 emails/month
- Pro: $20/month for 50,000 emails
- Check current usage: [Resend Dashboard](https://resend.com/dashboard)

### Edge Function Pricing
- First 2M requests free
- $2 per additional 1M requests
- Each notification = 1 request

### Optimization Tips
- Don't send notifications for items already claimed
- Batch notifications if appropriate
- Only send for high-confidence matches (future enhancement)

## Future Enhancements

Potential improvements:

1. **Digest emails:** Send daily summary instead of instant notifications
2. **Match quality threshold:** Only notify for high-confidence matches (e.g., >70%)
3. **User preferences:** Allow users to opt-out or customize notification frequency
4. **SMS notifications:** Add SMS option via Twilio
5. **In-app notifications:** Show notifications in the app UI
6. **Rich email content:** Include match preview images (requires careful privacy handling)

## Files Reference

**Edge Function:**
- [supabase/functions/send-match-notification/index.ts](supabase/functions/send-match-notification/index.ts)

**Migration:**
- [supabase/migrations/20251106000002_add_match_notification_trigger.sql](supabase/migrations/20251106000002_add_match_notification_trigger.sql)

**Setup Scripts:**
- [setup_email_notifications.sql](setup_email_notifications.sql) - Apply trigger to database
- [test_email_notification.sh](test_email_notification.sh) - Test email delivery

## Support

If emails aren't working:

1. Run `./test_email_notification.sh` to test manually
2. Check Edge Function logs in Supabase Dashboard
3. Verify Resend API key is valid
4. Check spam folder
5. Verify user email exists in profiles table
