-- Verify Email Notification Setup
-- Run this AFTER applying setup_email_notifications.sql

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

-- Check if the trigger function exists
SELECT
  'trigger_notification_on_match_complete function' as component,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = 'trigger_notification_on_match_complete'
    )
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status;

-- Check if the trigger exists
SELECT
  'on_match_inserted trigger' as component,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'on_match_inserted'
    )
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status;

-- Check if pg_net extension is available (needed for HTTP calls)
SELECT
  'pg_net extension' as component,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_extension
      WHERE extname = 'pg_net'
    )
    THEN '✅ INSTALLED'
    ELSE '❌ MISSING - Run setup_matching.sql first'
  END as status;
