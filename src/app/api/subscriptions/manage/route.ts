import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSectigoClient } from '@/lib/sectigo'
import { isSectigoError } from '@/lib/sectigo-types'
import { sendAccountSuspendedNotification } from '@/lib/email'

/**
 * POST /api/subscriptions/manage
 * 
 * Manage subscription status (suspend/unsuspend/deactivate)
 * Calls Sectigo API and updates local database
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
        const { accountId, acmeAccountId, action } = body

        // Validate inputs
        if (!accountId || !acmeAccountId || !action) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        if (!['suspend', 'unsuspend', 'deactivate'].includes(action)) {
            return NextResponse.json(
                { error: 'Invalid action' },
                { status: 400 }
            )
        }

        // Verify account belongs to this user's client and get partner info for email
        const { data: account, error: accountError } = await supabase
            .from('acme_accounts')
            .select(`
                id,
                status,
                account_name,
                clients!inner (
                    partner_id,
                    partners!inner (
                        email,
                        company_name
                    )
                )
            `)
            .eq('id', accountId)
            .single()

        if (accountError || !account) {
            return NextResponse.json(
                { error: 'Account not found' },
                { status: 404 }
            )
        }

        const clientData = account.clients as unknown as {
            partner_id: string
            partners: { email: string; company_name: string }
        }
        if (clientData.partner_id !== user.id) {
            return NextResponse.json(
                { error: 'Access denied' },
                { status: 403 }
            )
        }

        // Call Sectigo API
        const sectigoClient = getSectigoClient()
        let response: Awaited<ReturnType<typeof sectigoClient.suspendAccount>> | undefined

        switch (action) {
            case 'suspend':
                response = await sectigoClient.suspendAccount({ acmeAccountID: acmeAccountId })
                break
            case 'unsuspend':
                response = await sectigoClient.unsuspendAccount({ acmeAccountID: acmeAccountId })
                break
            case 'deactivate':
                response = await sectigoClient.deactivateAccount({ acmeAccountID: acmeAccountId })
                break
        }

        if (!response || isSectigoError(response)) {
            console.error('[Sectigo Error]', response)
            return NextResponse.json(
                { error: response ? `Sectigo API Error: ${response.errorMessage}` : 'Unknown error' },
                { status: 500 }
            )
        }

        // Map action to status
        const newStatus = action === 'suspend' ? 'suspended'
            : action === 'unsuspend' ? 'active'
                : 'terminated'

        // Update local database
        const { error: updateError } = await supabase
            .from('acme_accounts')
            .update({ status: newStatus })
            .eq('id', accountId)

        if (updateError) {
            console.error('[DB Update Error]', updateError)
            return NextResponse.json(
                { error: 'Failed to update status' },
                { status: 500 }
            )
        }

        // Audit log
        await supabase.from('audit_logs').insert({
            actor_id: user.id,
            action: `subscription_${action}`,
            target_type: 'acme_account',
            target_id: accountId,
            details: {
                acme_account_id: acmeAccountId,
                new_status: newStatus
            }
        })

        // Send email notification for suspend action (non-blocking)
        if (action === 'suspend') {
            sendAccountSuspendedNotification({
                to: clientData.partners.email,
                partnerName: clientData.partners.company_name || 'Partner',
                subscriptionName: account.account_name || 'Subscription',
                reason: 'Suspended by account owner'
            }).catch(err => {
                console.error('[Email Error] Failed to send suspend notification:', err)
            })
        }

        return NextResponse.json({
            success: true,
            newStatus
        })

    } catch (error) {
        console.error('Account management error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
