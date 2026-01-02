/**
 * Email Service using Resend
 * 
 * Usage:
 *   import { sendSettlementNotification } from '@/lib/email'
 *   await sendSettlementNotification({ to: 'partner@example.com', ... })
 */

import { Resend } from 'resend'

// Lazy initialization to prevent build-time errors when API key is not set
let _resend: Resend | null = null

function getResend(): Resend | null {
    if (!process.env.RESEND_API_KEY) {
        return null
    }
    if (!_resend) {
        _resend = new Resend(process.env.RESEND_API_KEY)
    }
    return _resend
}

// Default sender - update with your verified domain
const FROM_EMAIL = process.env.EMAIL_FROM || 'KICA Portal <noreply@kica.id>'

interface EmailResult {
    success: boolean
    id?: string
    error?: string
}

/**
 * Send a raw email
 */
export async function sendEmail({
    to,
    subject,
    html,
    text
}: {
    to: string | string[]
    subject: string
    html: string
    text?: string
}): Promise<EmailResult> {
    const resendClient = getResend()
    if (!resendClient) {
        console.warn('[Email] RESEND_API_KEY not set, skipping email')
        return { success: false, error: 'API key not configured' }
    }

    try {
        const { data, error } = await resendClient.emails.send({
            from: FROM_EMAIL,
            to: Array.isArray(to) ? to : [to],
            subject,
            html,
            text
        })

        if (error) {
            console.error('[Email] Send failed:', error)
            return { success: false, error: error.message }
        }

        console.log('[Email] Sent:', data?.id)
        return { success: true, id: data?.id }
    } catch (err) {
        console.error('[Email] Error:', err)
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
}

// ============================================
// Pre-built Email Templates
// ============================================

/**
 * Send settlement notification to partner
 */
export async function sendSettlementNotification({
    to,
    partnerName,
    settlementPeriod,
    totalAmount,
    dueDate,
    portalUrl
}: {
    to: string
    partnerName: string
    settlementPeriod: string
    totalAmount: string
    dueDate: string
    portalUrl: string
}): Promise<EmailResult> {
    const subject = `[KICA] Settlement Available - ${settlementPeriod}`

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2d56c2; margin: 0;">KICA CaaS Portal</h1>
    </div>
    
    <p>Dear ${partnerName},</p>
    
    <p>Your settlement for <strong>${settlementPeriod}</strong> is now available for review.</p>
    
    <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%;">
            <tr>
                <td style="color: #6b7280;">Settlement Period:</td>
                <td style="text-align: right; font-weight: 600;">${settlementPeriod}</td>
            </tr>
            <tr>
                <td style="color: #6b7280;">Total Amount:</td>
                <td style="text-align: right; font-weight: 600; color: #2d56c2;">${totalAmount}</td>
            </tr>
            <tr>
                <td style="color: #6b7280;">Due Date:</td>
                <td style="text-align: right; font-weight: 600;">${dueDate}</td>
            </tr>
        </table>
    </div>
    
    <p>Please log in to the portal to review and confirm your settlement.</p>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="${portalUrl}/statements" 
           style="background: #2d56c2; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            View Settlement
        </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">
        If you have any questions, please contact our support team.
    </p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        © ${new Date().getFullYear()} KICA Indonesia. All rights reserved.
    </p>
</body>
</html>
    `

    return sendEmail({ to, subject, html })
}

/**
 * Send subscription created notification
 */
export async function sendSubscriptionCreatedNotification({
    to,
    partnerName,
    subscriptionName,
    certificateType,
    subscriptionYears,
    eabKeyId,
    serverUrl
}: {
    to: string
    partnerName: string
    subscriptionName: string
    certificateType: string
    subscriptionYears: number
    eabKeyId: string
    serverUrl: string
}): Promise<EmailResult> {
    const subject = `[KICA] New Subscription Created - ${subscriptionName}`

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2d56c2; margin: 0;">KICA CaaS Portal</h1>
    </div>
    
    <p>Dear ${partnerName},</p>
    
    <p>Your new ACME subscription has been created successfully! 🎉</p>
    
    <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #166534;">Subscription Details</h3>
        <table style="width: 100%;">
            <tr>
                <td style="color: #6b7280; padding: 4px 0;">Name:</td>
                <td style="text-align: right; font-weight: 600;">${subscriptionName}</td>
            </tr>
            <tr>
                <td style="color: #6b7280; padding: 4px 0;">Type:</td>
                <td style="text-align: right; font-weight: 600;">${certificateType}</td>
            </tr>
            <tr>
                <td style="color: #6b7280; padding: 4px 0;">Duration:</td>
                <td style="text-align: right; font-weight: 600;">${subscriptionYears} Year${subscriptionYears > 1 ? 's' : ''}</td>
            </tr>
        </table>
    </div>
    
    <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #92400e;">⚠️ Important: ACME Configuration</h3>
        <p style="margin: 0 0 10px 0; color: #78350f;">Your EAB credentials are available in the portal. Use them to configure your ACME client:</p>
        <table style="width: 100%; font-family: monospace; font-size: 13px;">
            <tr>
                <td style="color: #78350f;">Server URL:</td>
            </tr>
            <tr>
                <td style="background: #fffbeb; padding: 8px; border-radius: 4px; word-break: break-all;">${serverUrl}</td>
            </tr>
            <tr>
                <td style="color: #78350f; padding-top: 10px;">EAB Key ID:</td>
            </tr>
            <tr>
                <td style="background: #fffbeb; padding: 8px; border-radius: 4px;">${eabKeyId}</td>
            </tr>
        </table>
        <p style="margin: 15px 0 0 0; color: #78350f; font-size: 13px;">
            <strong>Note:</strong> For security, the EAB HMAC Key is only shown in the portal.
        </p>
    </div>
    
    <p><strong>Next Steps:</strong></p>
    <ol>
        <li>Add domains to your subscription in the portal</li>
        <li>Configure your ACME client with the EAB credentials</li>
        <li>Start issuing certificates!</li>
    </ol>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        © ${new Date().getFullYear()} KICA Indonesia. All rights reserved.
    </p>
</body>
</html>
    `

    return sendEmail({ to, subject, html })
}

/**
 * Send subscription expiring reminder
 */
export async function sendExpirationReminder({
    to,
    partnerName,
    subscriptionName,
    expirationDate,
    daysRemaining,
    portalUrl
}: {
    to: string
    partnerName: string
    subscriptionName: string
    expirationDate: string
    daysRemaining: number
    portalUrl: string
}): Promise<EmailResult> {
    const urgency = daysRemaining <= 7 ? '🚨 URGENT' : daysRemaining <= 14 ? '⚠️ Warning' : '📅 Reminder'
    const subject = `[KICA] ${urgency}: Subscription Expiring - ${subscriptionName}`

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2d56c2; margin: 0;">KICA CaaS Portal</h1>
    </div>
    
    <p>Dear ${partnerName},</p>
    
    <div style="background: ${daysRemaining <= 7 ? '#fef2f2' : '#fffbeb'}; border: 1px solid ${daysRemaining <= 7 ? '#fecaca' : '#fcd34d'}; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
        <p style="font-size: 48px; margin: 0;">${daysRemaining}</p>
        <p style="color: ${daysRemaining <= 7 ? '#b91c1c' : '#92400e'}; margin: 0; font-weight: 600;">days remaining</p>
    </div>
    
    <p>Your subscription <strong>${subscriptionName}</strong> will expire on <strong>${expirationDate}</strong>.</p>
    
    <p>To ensure uninterrupted certificate issuance, please renew your subscription before the expiration date.</p>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="${portalUrl}/subscriptions" 
           style="background: #2d56c2; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            Renew Subscription
        </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        © ${new Date().getFullYear()} KICA Indonesia. All rights reserved.
    </p>
</body>
</html>
    `

    return sendEmail({ to, subject, html })
}

/**
 * Send account suspended notification
 */
export async function sendAccountSuspendedNotification({
    to,
    partnerName,
    subscriptionName,
    reason
}: {
    to: string
    partnerName: string
    subscriptionName: string
    reason?: string
}): Promise<EmailResult> {
    const subject = `[KICA] Account Suspended - ${subscriptionName}`

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2d56c2; margin: 0;">KICA CaaS Portal</h1>
    </div>
    
    <p>Dear ${partnerName},</p>
    
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #b91c1c;">⚠️ Subscription Suspended</h3>
        <p style="margin: 0; color: #7f1d1d;">
            Your subscription <strong>${subscriptionName}</strong> has been suspended.
        </p>
        ${reason ? `<p style="margin: 10px 0 0 0; color: #7f1d1d;">Reason: ${reason}</p>` : ''}
    </div>
    
    <p><strong>What this means:</strong></p>
    <ul>
        <li>You cannot add new domains to this subscription</li>
        <li>Existing certificates will continue to work until they expire</li>
        <li>Certificate renewals may fail</li>
    </ul>
    
    <p>If you believe this was done in error, please contact our support team immediately.</p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        © ${new Date().getFullYear()} KICA Indonesia. All rights reserved.
    </p>
</body>
</html>
    `

    return sendEmail({ to, subject, html })
}
