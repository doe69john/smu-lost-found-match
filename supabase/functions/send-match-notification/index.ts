// Supabase Edge Function for sending match notification emails
// This function sends an email to the lost item owner when matches are found

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

interface NotificationRequest {
  lostItemId: string
  matchCount: number
}

serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const { lostItemId, matchCount } = await req.json() as NotificationRequest

    if (!lostItemId) {
      return new Response(JSON.stringify({ error: 'lostItemId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:5173'
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch the lost item
    const { data: lostItem, error: lostError } = await supabase
      .from('lost_items')
      .select('id, brand, model, category, user_id')
      .eq('id', lostItemId)
      .single()

    if (lostError || !lostItem) {
      console.error('Failed to fetch lost item:', lostError)
      return new Response(
        JSON.stringify({ error: 'Lost item not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get user email and name from auth.users using admin API
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
      lostItem.user_id
    )

    if (userError || !userData?.user) {
      console.error('Failed to fetch user:', userError)
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const userEmail = userData.user.email
    const userName = userData.user.user_metadata?.full_name ||
                     userData.user.user_metadata?.name ||
                     'there'

    if (!userEmail) {
      console.error('User email not found for lost item:', lostItemId)
      return new Response(
        JSON.stringify({ error: 'User email not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Build item description
    const itemDescription = [lostItem.brand, lostItem.model]
      .filter(Boolean)
      .join(' ') || lostItem.category

    // Construct the dashboard URL
    const dashboardUrl = `${appUrl}/dashboard`

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'SMU Lost & Found <onboarding@resend.dev>',
        to: [userEmail],
        subject: `Match Found for Your Lost ${itemDescription}`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Match Found</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Potential Match Found!</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${userName},</p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      Great news! We found <strong>${matchCount} potential ${matchCount === 1 ? 'match' : 'matches'}</strong> for your lost item:
    </p>

    <div style="background: #f9fafb; border-left: 4px solid #6366f1; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 18px; font-weight: 600; color: #1f2937;">
        ${itemDescription}
      </p>
    </div>

    <p style="font-size: 16px; margin-bottom: 25px;">
      Click the button below to view the ${matchCount === 1 ? 'match' : 'matches'} and see if ${matchCount === 1 ? 'it\'s' : 'any are'} your item.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${dashboardUrl}"
         style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(99, 102, 241, 0.25);">
        View Matches
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      If you've already found your item, you can ignore this email or update your item status in the dashboard.
    </p>

  </div>

  <div style="text-align: center; margin-top: 20px; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 5px 0;">SMU Lost & Found</p>
    <p style="margin: 5px 0;">Singapore Management University</p>
    <p style="margin: 5px 0;">
      <a href="${appUrl}" style="color: #6366f1; text-decoration: none;">Visit Portal</a>
    </p>
  </div>

</body>
</html>
        `,
      }),
    })

    if (!emailResponse.ok) {
      const error = await emailResponse.text()
      console.error('Failed to send email:', error)
      return new Response(
        JSON.stringify({
          error: 'Failed to send email',
          details: error
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const emailResult = await emailResponse.json()
    console.log('Email sent successfully:', emailResult)

    return new Response(
      JSON.stringify({
        message: 'Notification sent successfully',
        emailId: emailResult.id,
        sentTo: userEmail,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in notification service:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
