import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSectigoClient } from '@/lib/sectigo'
import { isSectigoError } from '@/lib/sectigo-types'
import { sendSubscriptionCreatedNotification } from '@/lib/email'

/**
 * POST /api/subscriptions/create
 * 
 * Creates a new ACME subscription by:
 * 1. Calling Sectigo PREREGISTER API to get EAB credentials
 * 2. Storing the account in our database
 * 3. Sending confirmation email to partner
 * 
 * Note: Subscription period STARTS when first domain is added (not now)
 */
export async function POST(request: Request) {
    try {
        const supabase = await createClient()

        // Verify authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { clientId, accountName, certificateType, subscriptionYears, serverUrl } = body

        // Validate required fields
        if (!clientId || !accountName || !certificateType || !subscriptionYears || !serverUrl) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        // Verify client belongs to this partner
        const { data: client, error: clientError } = await supabase
            .from('clients')
            .select('id, partner_id, name')
            .eq('id', clientId)
            .single()

        if (clientError || !client) {
            return NextResponse.json(
                { error: 'Client not found' },
                { status: 404 }
            )
        }

        if (client.partner_id !== user.id) {
            return NextResponse.json(
                { error: 'Access denied' },
                { status: 403 }
            )
        }

        // Get partner info for email notification
        // Note: Email is from auth.users (user.email), partners table only has company_name
        const { data: partner, error: partnerError } = await supabase
            .from('partners')
            .select('company_name')
            .eq('id', user.id)
            .single()

        console.log('[Email Debug] Partner query:', {
            userId: user.id,
            userEmail: user.email,
            partner,
            error: partnerError?.message
        })

        // Call Sectigo PREREGISTER API
        const sectigoClient = getSectigoClient()
        const preregisterResponse = await sectigoClient.preregister({
            serverUrl,
            years: subscriptionYears as 1 | 2 | 3
        })

        // Check for Sectigo API error
        if (isSectigoError(preregisterResponse)) {
            console.error('[Sectigo Error]', preregisterResponse)
            return NextResponse.json(
                { error: `Sectigo API Error: ${preregisterResponse.errorMessage}` },
                { status: 500 }
            )
        }

        // Extract account info from response
        const accountInfo = preregisterResponse.Accounts[0]
        if (!accountInfo) {
            return NextResponse.json(
                { error: 'No account returned from Sectigo' },
                { status: 500 }
            )
        }

        // Insert into database
        const { data: newAccount, error: insertError } = await supabase
            .from('acme_accounts')
            .insert({
                client_id: clientId,
                account_name: accountName,
                certificate_type: certificateType,
                subscription_years: subscriptionYears,
                server_url: serverUrl,
                status: 'pending_start',
                acme_account_id: accountInfo.acmeAccountID,
                eab_key_id: accountInfo.eabMACIDb64url,
                eab_hmac_key: accountInfo.eabMACKeyb64url,
                // start_date and end_date remain NULL until first domain is added
            })
            .select()
            .single()

        if (insertError) {
            console.error('[DB Insert Error]', insertError)
            return NextResponse.json(
                { error: 'Failed to save subscription' },
                { status: 500 }
            )
        }

        // Audit log
        await supabase.from('audit_logs').insert({
            actor_id: user.id,
            action: 'create_subscription',
            target_type: 'acme_account',
            target_id: newAccount.id,
            details: {
                client_id: clientId,
                certificate_type: certificateType,
                subscription_years: subscriptionYears,
                acme_account_id: accountInfo.acmeAccountID
            }
        })

        // Send confirmation email (non-blocking)
        if (user.email) {
            sendSubscriptionCreatedNotification({
                to: user.email,
                partnerName: partner?.company_name || 'Partner',
                subscriptionName: accountName,
                certificateType: certificateType,
                subscriptionYears: subscriptionYears,
                eabKeyId: accountInfo.eabMACIDb64url,
                serverUrl: serverUrl
            }).catch(err => {
                console.error('[Email Error] Failed to send subscription notification:', err)
            })
        }

        return NextResponse.json({
            success: true,
            subscriptionId: newAccount.id,
            acmeAccountId: accountInfo.acmeAccountID
        })

    } catch (error) {
        console.error('Subscription creation error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
