# Quick Setup Guide - Email Notifications

## Step-by-Step Instructions

### Step 1: Check Resend API Key (Terminal)

Open your **terminal** and run:

```bash
supabase secrets list | grep RESEND_API_KEY
```

You should see:
```
RESEND_API_KEY | [some hash value]
```

✅ If you see it, continue to Step 2.
❌ If not found, set it first:

```bash
supabase secrets set RESEND_API_KEY=your_resend_api_key_here
```

---

### Step 2: Apply Email Notification SQL (Supabase Dashboard)

1. **Open Supabase SQL Editor:**
   👉 https://supabase.com/dashboard/project/oxubfeizhswsrczchtkr/sql/new

2. **Copy the SQL:**
   - The SQL is already in your clipboard!
   - Or manually copy from: `setup_email_notifications.sql`

3. **Paste and Run:**
   - Paste into the SQL editor
   - Click the **"Run"** button (or press Cmd/Ctrl + Enter)

4. **Expected Output:**
   ```
   NOTICE: ✅ Email notification system configured successfully!
   NOTICE: Users will now receive emails when matches are found for their lost items.
   ```

---

### Step 3: Verify Setup (Supabase SQL Editor)

In the same SQL editor, run this verification query:

```sql
-- Check if the notification function exists
SELECT
  'send_match_notification function' as component,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = 'send_match_notification'
    )
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status;
```

Or copy from `verify_email_setup.sql` and run the full verification.

Expected: All components should show **✅ EXISTS**

---

### Step 4: Test Email Notification (Terminal)

Back in your **terminal**, run:

```bash
./test_email_notification.sh
```

Expected output:
```
✅ Test email sent successfully!
Check your inbox for the notification email.
```

---

## Troubleshooting

### ❌ "pg_net extension MISSING"

If verification shows pg_net is missing, run this first:

1. Go to SQL Editor
2. Paste and run:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;

GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA net TO postgres, anon, authenticated, service_role;
```

Then re-run `setup_email_notifications.sql`

---

### ❌ "Failed to send email"

Check that RESEND_API_KEY is set correctly:

```bash
# In terminal
supabase secrets list | grep RESEND_API_KEY
```

If missing, set it:

```bash
supabase secrets set RESEND_API_KEY=re_YourKeyHere
```

---

### ❌ Email not received

1. Check spam folder
2. Verify the user has an email in the profiles table:

```sql
-- In SQL Editor
SELECT email, full_name
FROM profiles
WHERE id = (
  SELECT user_id
  FROM lost_items
  WHERE id = '67f5be29-f8a7-45e3-832c-6417af0f81bb'
);
```

3. Check Edge Function logs:
   👉 https://supabase.com/dashboard/project/oxubfeizhswsrczchtkr/functions

---

## Summary

**Terminal Commands** (bash):
- `supabase secrets list` - Check secrets
- `./test_email_notification.sh` - Test emails

**SQL Editor** (SQL queries):
- `setup_email_notifications.sql` - Apply notification system
- `verify_email_setup.sql` - Verify components exist

**DO NOT** run terminal commands in the SQL Editor!
**DO NOT** run SQL queries in the terminal!

---

## What You're Setting Up

```
Matches Created → Database Trigger → Edge Function → Email Sent
```

Once setup is complete, users will automatically receive emails when matches are found for their lost items!
