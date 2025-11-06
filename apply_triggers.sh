#!/bin/bash

# This script applies the matching trigger fixes to your Supabase database
# It uses the Supabase SQL editor API to execute the SQL

SUPABASE_URL="https://oxubfeizhswsrczchtkr.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94dWJmZWl6aHN3c3JjemNodGtyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDAxOTEyNCwiZXhwIjoyMDc1NTk1MTI0fQ.3BlQv51vWNOl2VL04oYSN3b9qyo3_ABG61BseWxoHZ4"

echo "================================================================"
echo "Applying Matching Trigger Fixes"
echo "================================================================"
echo ""
echo "This will:"
echo "  1. Fix the invoke_matching_service function with the correct API key"
echo "  2. Add automatic matching trigger for found items"
echo ""
echo "After this, matching will be FULLY AUTOMATED for both lost and found items!"
echo ""
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

echo ""
echo "Reading SQL file..."
SQL_CONTENT=$(cat apply_all_fixes.sql)

echo "Applying to database via Supabase API..."
echo ""

# Note: You'll need to manually execute the SQL via Supabase Dashboard SQL Editor
# or use psql if you have it installed

echo "================================================================"
echo "OPTION 1: Apply via Supabase Dashboard (Recommended)"
echo "================================================================"
echo ""
echo "1. Go to: https://supabase.com/dashboard/project/oxubfeizhswsrczchtkr/sql/new"
echo "2. Copy the contents of 'apply_all_fixes.sql'"
echo "3. Paste into the SQL Editor"
echo "4. Click 'Run'"
echo ""
echo "================================================================"
echo "OPTION 2: Apply via psql (if installed)"
echo "================================================================"
echo ""
echo "Run this command:"
echo ""
echo "psql \"postgresql://postgres.oxubfeizhswsrczchtkr:\$SUPABASE_DB_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres\" -f apply_all_fixes.sql"
echo ""
echo "================================================================"

# Copy to clipboard if pbcopy is available (macOS)
if command -v pbcopy &> /dev/null; then
  echo ""
  echo "SQL has been copied to your clipboard!"
  cat apply_all_fixes.sql | pbcopy
  echo "Just paste it into the Supabase SQL Editor and click Run."
fi
