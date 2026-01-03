'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Eye, EyeOff, Copy, Check, Plus, Globe, Trash2, Calculator, Calendar, Clock, AlertTriangle, MoreVertical, Pause, Play, Power } from 'lucide-react'
import RemoveDomainModal from '@/components/RemoveDomainModal'

// Default prices (fallback if tier pricing fails)
const DEFAULT_PRICE_SINGLE = 50
const DEFAULT_PRICE_WILDCARD = 150

export default function AcmeAccountDetailPage({
    params,
}: {
    params: Promise<{ id: string; accountId: string }>
}) {
    const { id: clientId, accountId } = use(params)
    const [account, setAccount] = useState<{
        id: string
        account_name: string
        certificate_type: string
        status: string
        subscription_years: number
        eab_key_id: string
        eab_hmac_key: string
        server_url: string
        created_at: string
        start_date: string | null
        end_date: string | null
        acme_account_id: string
    } | null>(null)
    const [domains, setDomains] = useState<Array<{
        id: string
        domain_name: string
        domain_type: string
        status: string
        billing_type: string
        added_at: string
        price_charged: number
        removed_at?: string | null
        refund_transaction_id?: string | null
    }>>([])
    const [certificates, setCertificates] = useState<Array<{
        id: string
        domain_id: string
        domain_name: string
        order_number: string | null
        certificate_id: string | null
        serial_number: string | null
        valid_not_before: string | null
        valid_not_after: string | null
        status_code: number | null
        status_desc: string | null
        synced_at: string | null
    }>>([])
    const [clientName, setClientName] = useState('')
    const [showEabKey, setShowEabKey] = useState(false)
    const [copied, setCopied] = useState<string | null>(null)
    const [domainInput, setDomainInput] = useState('')
    const [addingDomain, setAddingDomain] = useState(false)
    const [loading, setLoading] = useState(true)
    const [showRemovedDomains, setShowRemovedDomains] = useState(false)

    // Tier pricing state
    const [tierPricing, setTierPricing] = useState<{
        dv_single: number
        dv_wildcard: number
        ov_single: number
        ov_wildcard: number
    } | null>(null)

    // Modal state for remove domain
    const [removeModalOpen, setRemoveModalOpen] = useState(false)
    const [domainToRemove, setDomainToRemove] = useState<{
        id: string
        domain_name: string
        added_at: string
        price_charged: number
        daysSinceAdded: number
        isRefundable: boolean
    } | null>(null)

    // Account management state
    const [showAccountMenu, setShowAccountMenu] = useState(false)
    const [accountActionLoading, setAccountActionLoading] = useState(false)
    const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)

    const supabase = createClient()

    // Parse domains from textarea and calculate pricing based on tier
    const parseDomains = (input: string): { domain: string; type: 'single' | 'wildcard'; price: number }[] => {
        const raw = input.split(/[\s,]+/).filter(d => d.trim())
        const certType = account?.certificate_type || 'DV'

        return raw.map(d => {
            const isWildcard = d.startsWith('*.')
            let price: number

            if (tierPricing) {
                if (certType === 'OV') {
                    price = isWildcard ? tierPricing.ov_wildcard : tierPricing.ov_single
                } else {
                    price = isWildcard ? tierPricing.dv_wildcard : tierPricing.dv_single
                }
            } else {
                // Fallback to defaults
                price = isWildcard ? DEFAULT_PRICE_WILDCARD : DEFAULT_PRICE_SINGLE
            }

            return {
                domain: d.trim().toLowerCase(),
                type: isWildcard ? 'wildcard' : 'single',
                price
            }
        })
    }

    const parsedDomains = parseDomains(domainInput)
    const totalPrice = parsedDomains.reduce((sum, d) => sum + d.price, 0)

    useEffect(() => {
        const fetchData = async () => {
            // Fetch account
            const { data: accountData } = await supabase
                .from('acme_accounts')
                .select('*')
                .eq('id', accountId)
                .single()

            if (accountData) {
                setAccount(accountData)
            }

            // Fetch domains (include all for audit trail)
            const { data: domainsData } = await supabase
                .from('domains')
                .select('*')
                .eq('acme_account_id', accountId)
                .order('added_at', { ascending: false })

            if (domainsData) {
                setDomains(domainsData)
            }

            // Fetch client name
            const { data: clientData } = await supabase
                .from('clients')
                .select('name')
                .eq('id', clientId)
                .single()

            if (clientData) {
                setClientName(clientData.name)
            }

            // Fetch tier pricing based on partner's pricing_class
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: partnerData } = await supabase
                    .from('partners')
                    .select('pricing_class')
                    .eq('id', user.id)
                    .single()

                const pricingClass = partnerData?.pricing_class || 'STANDARD'

                const { data: pricingData } = await supabase
                    .from('pricing_tiers')
                    .select('dv_single_annual, dv_wildcard_annual, ov_single_annual, ov_wildcard_annual')
                    .eq('tier_code', pricingClass)
                    .eq('is_active', true)
                    .single()

                if (pricingData) {
                    setTierPricing({
                        dv_single: Number(pricingData.dv_single_annual),
                        dv_wildcard: Number(pricingData.dv_wildcard_annual),
                        ov_single: Number(pricingData.ov_single_annual),
                        ov_wildcard: Number(pricingData.ov_wildcard_annual)
                    })
                }
            }

            // Fetch certificates for this account's domains
            const { data: certificatesData } = await supabase
                .from('certificates')
                .select(`
                    *,
                    domains!inner(
                        domain_name,
                        acme_account_id
                    )
                `)
                .eq('domains.acme_account_id', accountId)
                .order('created_at', { ascending: false })

            if (certificatesData) {
                const transformed = certificatesData.map(cert => ({
                    id: cert.id,
                    domain_id: cert.domain_id,
                    domain_name: (cert.domains as any).domain_name,
                    order_number: cert.order_number,
                    certificate_id: cert.certificate_id,
                    serial_number: cert.serial_number,
                    valid_not_before: cert.valid_not_before,
                    valid_not_after: cert.valid_not_after,
                    status_code: cert.status_code,
                    status_desc: cert.status_desc,
                    synced_at: cert.synced_at
                }))
                setCertificates(transformed)
            }

            setLoading(false)
        }

        fetchData()
    }, [accountId, clientId, supabase])

    const copyToClipboard = async (text: string, field: string) => {
        await navigator.clipboard.writeText(text)
        setCopied(field)
        setTimeout(() => setCopied(null), 2000)

        // Log audit
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            await supabase.from('audit_logs').insert({
                actor_id: user.id,
                action: 'reveal_eab_key',
                target_type: 'acme_account',
                target_id: accountId,
                details: { field }
            })
        }
    }

    const handleAddDomains = async (e: React.FormEvent) => {
        e.preventDefault()
        if (parsedDomains.length === 0) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // ============================================================
        // CREDIT CHECK: Only applies to DEPOSIT payment type
        // Post-Paid partners have trust-based billing (no limit)
        // ============================================================

        const estimatedCost = parsedDomains.reduce((sum, d) => sum + d.price, 0)

        // Get partner's payment type and credit limit
        const { data: partner } = await supabase
            .from('partners')
            .select('payment_type, credit_limit')
            .eq('id', user.id)
            .single()

        const paymentType = partner?.payment_type || 'post_paid'

        // Only check credit limit for DEPOSIT payment type
        if (paymentType === 'deposit') {
            // Get current usage from transactions (including reserved)
            const { data: usageData } = await supabase
                .from('transactions')
                .select('type, amount, status')
                .eq('partner_id', user.id)
                .in('status', ['success', 'pending_api'])

            let currentUsage = 0
            usageData?.forEach(tx => {
                if (tx.type === 'add_domain') currentUsage += tx.amount || 0
                if (tx.type === 'refund') currentUsage -= tx.amount || 0
            })

            const creditLimit = partner?.credit_limit || 0
            const availableLimit = creditLimit - currentUsage

            // REJECT if insufficient credit (deposit users only)
            if (estimatedCost > availableLimit) {
                alert(
                    `❌ Insufficient Credit Limit\n\n` +
                    `Required: $${estimatedCost.toFixed(2)}\n` +
                    `Available: $${availableLimit.toFixed(2)}\n\n` +
                    `Please contact KICA to increase your credit limit.`
                )
                return
            }
        }
        // For post_paid: No credit check - trust-based billing

        // Credit check passed, proceed with domain addition
        setAddingDomain(true)

        const results: { domain: string; success: boolean; error?: string }[] = []

        for (const domainInfo of parsedDomains) {
            // ============================================================
            // PHASE 1: RESERVE - Create pending records before API call
            // ============================================================

            // Insert domain with pending status
            const { data: domainData, error: domainError } = await supabase
                .from('domains')
                .insert({
                    acme_account_id: accountId,
                    domain_name: domainInfo.domain,
                    domain_type: domainInfo.type,
                    billing_type: 'paid',
                    status: 'pending',  // Will become 'active' on success
                    price_charged: domainInfo.price
                })
                .select()
                .single()

            if (domainError || !domainData) {
                results.push({ domain: domainInfo.domain, success: false, error: 'Failed to create domain record' })
                continue
            }

            // Insert transaction with pending_api status (RESERVE credit)
            const { data: txData, error: txError } = await supabase
                .from('transactions')
                .insert({
                    partner_id: user.id,
                    acme_account_id: accountId,
                    domain_id: domainData.id,
                    type: 'add_domain',
                    description: `Adding domain: ${domainInfo.domain}`,
                    amount: domainInfo.price,
                    status: 'pending_api'  // Credit is now RESERVED
                })
                .select()
                .single()

            if (txError || !txData) {
                // Rollback domain
                await supabase.from('domains').delete().eq('id', domainData.id)
                results.push({ domain: domainInfo.domain, success: false, error: 'Failed to create transaction' })
                continue
            }

            // ============================================================
            // PHASE 2: EXECUTE - Call Sectigo API via server endpoint
            // ============================================================

            try {
                // Call server-side API endpoint (not direct Sectigo client)
                const apiResponse = await fetch('/api/domains/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        acmeAccountID: account?.acme_account_id || '',
                        domainName: domainInfo.domain,
                        transactionId: txData.id
                    })
                })

                const apiData = await apiResponse.json()

                // ============================================================
                // PHASE 3: Handle API response
                // ============================================================

                if (!apiData.success) {
                    // API returned error - already rolled back in API route
                    await supabase
                        .from('domains')
                        .update({ status: 'failed' })
                        .eq('id', domainData.id)

                    results.push({ domain: domainInfo.domain, success: false, error: apiData.error })
                    continue
                }

                // SUCCESS - Update domain status
                const response = apiData.data
                const orderNumber = response?.orderNumber?.toString() || null

                // Update domain with active status and order number
                await supabase
                    .from('domains')
                    .update({
                        status: 'active',
                        sectigo_order_number: orderNumber
                    })
                    .eq('id', domainData.id)

                // Update UI
                setDomains(prev => [{
                    ...domainData,
                    status: 'active',
                    sectigo_order_number: orderNumber
                }, ...prev])

                // Log audit
                await supabase.from('audit_logs').insert({
                    actor_id: user.id,
                    action: 'add_domain',
                    target_type: 'domain',
                    target_id: domainData.id,
                    details: {
                        domain_name: domainInfo.domain,
                        price: domainInfo.price,
                        sectigo_order_number: orderNumber
                    }
                })

                results.push({ domain: domainInfo.domain, success: true })

            } catch (apiError) {
                // Network error or exception - mark as failed
                console.error('Sectigo API error:', apiError)

                await supabase
                    .from('transactions')
                    .update({
                        status: 'failed',
                        description: `API Error: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`
                    })
                    .eq('id', txData.id)

                await supabase
                    .from('domains')
                    .update({ status: 'failed' })
                    .eq('id', domainData.id)

                results.push({ domain: domainInfo.domain, success: false, error: 'API connection failed' })
            }
        }

        // ============================================================
        // ACCOUNT REACTIVATION LOGIC
        // If first successful domain added to pending_start or inactive account,
        // activate the account and set billing cycle dates
        // ============================================================
        const successCount = results.filter(r => r.success).length
        const shouldActivate = successCount > 0 &&
            (account?.status === 'pending_start' || account?.status === 'inactive')

        if (shouldActivate) {
            const previousStatus = account?.status
            const previousStartDate = account?.start_date
            const previousEndDate = account?.end_date

            const startDate = new Date()
            const endDate = new Date(startDate)
            endDate.setFullYear(endDate.getFullYear() + (account?.subscription_years || 1))

            const { error: activateError } = await supabase
                .from('acme_accounts')
                .update({
                    status: 'active',
                    start_date: startDate.toISOString(),
                    end_date: endDate.toISOString()
                })
                .eq('id', accountId)

            if (!activateError) {
                // Update local state
                setAccount(prev => prev ? {
                    ...prev,
                    status: 'active',
                    start_date: startDate.toISOString(),
                    end_date: endDate.toISOString()
                } : null)

                // Log account activation/reactivation
                const isReactivation = previousStatus === 'inactive'
                await supabase.from('audit_logs').insert({
                    actor_id: user.id,
                    action: isReactivation ? 'account_reactivated' : 'account_activated',
                    target_type: 'acme_account',
                    target_id: accountId,
                    details: {
                        previous_status: previousStatus,
                        new_status: 'active',
                        previous_start_date: previousStartDate,
                        previous_end_date: previousEndDate,
                        new_start_date: startDate.toISOString(),
                        new_end_date: endDate.toISOString(),
                        triggered_by_domain: results.find(r => r.success)?.domain,
                        subscription_years: account?.subscription_years || 1
                    }
                })
            }
        }

        // Show results summary
        const failedCount = results.filter(r => !r.success).length
        if (failedCount > 0) {
            const failedDomains = results.filter(r => !r.success).map(r => `• ${r.domain}: ${r.error}`).join('\n')
            alert(`⚠️ Some domains failed to add:\n\n${failedDomains}\n\n${successCount} domain(s) added successfully.`)
        }

        setDomainInput('')
        setAddingDomain(false)
    }

    // ============================================================
    // PRIORITY #2: 30-DAY REFUND LOGIC
    // If domain removed within 30 days, create refund transaction
    // ============================================================
    const openRemoveModal = (domain: {
        id: string
        domain_name: string
        added_at: string
        price_charged: number
    }) => {
        const addedAt = new Date(domain.added_at)
        const now = new Date()
        const daysSinceAdded = Math.floor((now.getTime() - addedAt.getTime()) / (1000 * 60 * 60 * 24))
        const isRefundable = daysSinceAdded <= 30

        setDomainToRemove({
            ...domain,
            daysSinceAdded,
            isRefundable
        })
        setRemoveModalOpen(true)
    }

    const handleConfirmRemove = async () => {
        if (!domainToRemove) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // ============================================================
        // VALIDATION: Find original add_domain transaction
        // ============================================================
        const { data: originalTx, error: txFetchError } = await supabase
            .from('transactions')
            .select('id, status, amount, sectigo_order_number')
            .eq('domain_id', domainToRemove.id)
            .eq('type', 'add_domain')
            .single()

        if (txFetchError || !originalTx) {
            console.error('Failed to find original transaction:', txFetchError)
            alert('Error: Cannot find original add_domain transaction for this domain.')
            return
        }

        // STATUS VALIDATION: Block if original tx is FAILED or PENDING
        if (originalTx.status === 'failed' || originalTx.status === 'pending') {
            alert(`Cannot refund: Original transaction status is "${originalTx.status}". Only successful transactions can be refunded.`)
            return
        }

        // DUPLICATE CHECK: Ensure no existing refund for this domain
        if (domainToRemove.isRefundable) {
            const { data: existingRefund } = await supabase
                .from('transactions')
                .select('id')
                .eq('domain_id', domainToRemove.id)
                .eq('type', 'refund')
                .single()

            if (existingRefund) {
                alert('Error: This domain has already been refunded.')
                return
            }
        }

        // ============================================================
        // ATOMIC OPERATION: Remove domain + Create refund transaction
        // ============================================================
        const removedAt = new Date().toISOString()

        // Step 1: Soft delete domain (mark as removed with timestamp)
        const { error: updateError } = await supabase
            .from('domains')
            .update({
                status: 'removed',
                removed_at: removedAt
            })
            .eq('id', domainToRemove.id)

        if (updateError) {
            console.error('Failed to remove domain:', updateError)
            alert('Failed to remove domain. Please try again.')
            return
        }

        // Step 2: Create refund transaction with link to original
        let refundTxId: string | null = null
        if (domainToRemove.isRefundable && domainToRemove.price_charged > 0) {
            const { data: refundTx, error: txError } = await supabase
                .from('transactions')
                .insert({
                    partner_id: user.id,
                    acme_account_id: accountId,
                    domain_id: domainToRemove.id,
                    type: 'refund',
                    description: `Refund for removed domain: ${domainToRemove.domain_name} (within 30-day window)`,
                    amount: domainToRemove.price_charged,
                    status: 'success',
                    related_transaction_id: originalTx.id,  // LINK to original transaction
                    sectigo_order_number: originalTx.sectigo_order_number  // SAME order number for reconciliation
                })
                .select('id')
                .single()

            if (txError) {
                console.error('Failed to create refund transaction:', txError)
                // Domain already removed, but refund failed - log this as critical
                await supabase.from('audit_logs').insert({
                    actor_id: user.id,
                    action: 'refund_failed',
                    target_type: 'transaction',
                    target_id: originalTx.id,
                    details: {
                        error: txError.message,
                        domain_name: domainToRemove.domain_name,
                        amount: domainToRemove.price_charged
                    }
                })
            } else {
                refundTxId = refundTx?.id || null

                // Update original transaction status to 'refunded'
                await supabase
                    .from('transactions')
                    .update({ status: 'refunded' })
                    .eq('id', originalTx.id)

                // Update domain with refund transaction link
                await supabase
                    .from('domains')
                    .update({ refund_transaction_id: refundTxId })
                    .eq('id', domainToRemove.id)
            }
        }

        // ============================================================
        // AUDIT LOGGING: Record refund action with full details
        // ============================================================
        await supabase.from('audit_logs').insert({
            actor_id: user.id,
            action: domainToRemove.isRefundable ? 'refund_domain' : 'remove_domain',
            target_type: 'domain',
            target_id: domainToRemove.id,
            details: {
                domain_name: domainToRemove.domain_name,
                days_since_added: domainToRemove.daysSinceAdded,
                refunded: domainToRemove.isRefundable,
                refund_amount: domainToRemove.isRefundable ? domainToRemove.price_charged : 0,
                original_transaction_id: originalTx.id,
                refund_transaction_id: refundTxId,
                triggered_by: user.email || user.id
            }
        })

        // ============================================================
        // ACME ACCOUNT LIFECYCLE: Check if account should become inactive
        // ============================================================
        // Count remaining active domains for this account
        const { count: remainingDomains } = await supabase
            .from('domains')
            .select('*', { count: 'exact', head: true })
            .eq('acme_account_id', accountId)
            .eq('status', 'active')

        // If no more active domains, reset account to inactive state
        if (remainingDomains === 0) {
            const previousStatus = account?.status
            const previousStartDate = account?.start_date
            const previousEndDate = account?.end_date

            // Update ACME account: status → inactive, dates → NULL
            const { error: accountUpdateError } = await supabase
                .from('acme_accounts')
                .update({
                    status: 'inactive',
                    start_date: null,
                    end_date: null
                })
                .eq('id', accountId)

            if (accountUpdateError) {
                console.error('Failed to update ACME account status:', accountUpdateError)
            } else {
                // Log the account status change
                await supabase.from('audit_logs').insert({
                    actor_id: user.id,
                    action: 'account_deactivated',
                    target_type: 'acme_account',
                    target_id: accountId,
                    details: {
                        reason: 'All domains removed/refunded',
                        previous_status: previousStatus,
                        new_status: 'inactive',
                        previous_start_date: previousStartDate,
                        previous_end_date: previousEndDate,
                        dates_reset: true,
                        triggered_by_domain: domainToRemove.domain_name
                    }
                })

                // ============================================================
                // ABUSE DETECTION: Check for excessive refund patterns
                // ============================================================
                const thirtyDaysAgo = new Date()
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

                const { count: recentRefundCount } = await supabase
                    .from('transactions')
                    .select('*', { count: 'exact', head: true })
                    .eq('acme_account_id', accountId)
                    .eq('type', 'refund')
                    .eq('status', 'success')
                    .gte('created_at', thirtyDaysAgo.toISOString())

                if (recentRefundCount && recentRefundCount >= 3) {
                    // Flag as high risk in audit log
                    await supabase.from('audit_logs').insert({
                        actor_id: user.id,
                        action: 'high_risk_refund_pattern',
                        target_type: 'acme_account',
                        target_id: accountId,
                        details: {
                            refund_count_30_days: recentRefundCount,
                            alert_level: 'HIGH',
                            message: 'This account has had 3+ refunds in the last 30 days. Manual review recommended.',
                            account_status: 'inactive'
                        }
                    })
                }

                // Update local account state
                setAccount(prev => prev ? {
                    ...prev,
                    status: 'inactive',
                    start_date: null,
                    end_date: null
                } : null)
            }
        }

        // Update UI - remove from list and close modal
        setDomains(prev => prev.filter(d => d.id !== domainToRemove.id))
        setRemoveModalOpen(false)
        setDomainToRemove(null)
    }

    // Account management actions (suspend/unsuspend/deactivate)
    const handleAccountAction = async (action: 'suspend' | 'unsuspend' | 'deactivate') => {
        if (!account) return

        setAccountActionLoading(true)
        setShowAccountMenu(false)

        try {
            const response = await fetch('/api/subscriptions/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountId: account.id,
                    acmeAccountId: account.acme_account_id,
                    action
                })
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Action failed')
            }

            // Update local state
            const newStatus = action === 'suspend' ? 'suspended'
                : action === 'unsuspend' ? 'active'
                    : 'terminated'

            setAccount(prev => prev ? { ...prev, status: newStatus } : null)

            // Refresh from DB to ensure sync
            const { data } = await supabase
                .from('acme_accounts')
                .select('status')
                .eq('id', account.id)
                .single()

            if (data) {
                setAccount(prev => prev ? { ...prev, status: data.status } : null)
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Action failed')
        } finally {
            setAccountActionLoading(false)
            setShowDeactivateConfirm(false)
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center p-12">Loading...</div>
    }

    if (!account) {
        notFound()
    }

    // Calculate days remaining
    const daysRemaining = account.end_date
        ? Math.ceil((new Date(account.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center space-x-4">
                <Link
                    href={`/clients/${clientId}`}
                    className="rounded-lg p-2 hover:bg-gray-100"
                >
                    <ArrowLeft className="h-5 w-5 text-gray-500" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {account.account_name || 'ACME Account'}
                    </h1>
                    <p className="text-gray-500">{clientName}</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    {/* Subscription Period */}
                    {account.status === 'active' && account.start_date && (
                        <div className="flex items-center gap-3 text-sm">
                            <div className="flex items-center text-gray-500">
                                <Calendar className="mr-1.5 h-4 w-4" />
                                <span>Started: {new Date(account.start_date).toLocaleDateString('id-ID')}</span>
                            </div>
                            {account.end_date && (
                                <div className={`flex items-center ${daysRemaining && daysRemaining < 30 ? 'text-red-600' : 'text-gray-500'}`}>
                                    <Clock className="mr-1.5 h-4 w-4" />
                                    <span>Expires: {new Date(account.end_date).toLocaleDateString('id-ID')}</span>
                                    {daysRemaining !== null && daysRemaining < 90 && (
                                        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${daysRemaining < 30 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {daysRemaining} days left
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${account.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : account.status === 'pending_start'
                            ? 'bg-yellow-100 text-yellow-800'
                            : account.status === 'suspended'
                                ? 'bg-orange-100 text-orange-800'
                                : account.status === 'inactive'
                                    ? 'bg-gray-100 text-gray-800'
                                    : 'bg-red-100 text-red-800'
                        }`}>
                        {account.status}
                    </span>

                    {/* Account Actions Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowAccountMenu(!showAccountMenu)}
                            disabled={accountActionLoading}
                            className="rounded-lg p-2 hover:bg-gray-100 disabled:opacity-50"
                        >
                            {accountActionLoading ? (
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                            ) : (
                                <MoreVertical className="h-5 w-5 text-gray-500" />
                            )}
                        </button>

                        {showAccountMenu && (
                            <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5">
                                {account.status !== 'suspended' && account.status !== 'terminated' && (
                                    <button
                                        onClick={() => handleAccountAction('suspend')}
                                        className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        <Pause className="mr-3 h-4 w-4 text-orange-500" />
                                        Suspend Subscription
                                    </button>
                                )}
                                {account.status === 'suspended' && (
                                    <button
                                        onClick={() => handleAccountAction('unsuspend')}
                                        className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        <Play className="mr-3 h-4 w-4 text-green-500" />
                                        Unsuspend Subscription
                                    </button>
                                )}
                                {account.status !== 'terminated' && (
                                    <>
                                        <div className="my-1 border-t border-gray-100" />
                                        <button
                                            onClick={() => {
                                                setShowAccountMenu(false)
                                                setShowDeactivateConfirm(true)
                                            }}
                                            className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                        >
                                            <Power className="mr-3 h-4 w-4" />
                                            Deactivate (Permanent)
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Deactivate Confirmation Modal */}
            {showDeactivateConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                        <div className="flex items-center gap-3 text-red-600">
                            <Power className="h-6 w-6" />
                            <h3 className="text-lg font-semibold">Deactivate Subscription</h3>
                        </div>
                        <p className="mt-4 text-gray-600">
                            Are you sure you want to <strong>permanently deactivate</strong> this subscription?
                        </p>
                        <p className="mt-2 text-sm text-red-600">
                            ⚠️ This action cannot be undone. The ACME account will be deactivated at Sectigo.
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeactivateConfirm(false)}
                                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleAccountAction('deactivate')}
                                disabled={accountActionLoading}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                {accountActionLoading ? 'Deactivating...' : 'Yes, Deactivate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Inactive Account Warning */}
            {account.status === 'inactive' && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                    <div className="flex items-start gap-3">
                        <div className="rounded-full bg-amber-100 p-2">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <h4 className="font-medium text-amber-800">Account Inactive</h4>
                            <p className="mt-1 text-sm text-amber-700">
                                This account has no active domains. Certificate issuance is disabled.
                                Add a new domain to reactivate the account and enable certificate issuance using the credentials below.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* EAB Credentials */}
            <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="text-lg font-medium text-gray-900">EAB Credentials</h3>
                <p className="mt-1 text-sm text-gray-500">
                    Use these credentials to configure your ACME client (certbot, acme.sh, etc.)
                </p>

                <div className="mt-4 space-y-4">
                    {/* EAB Key ID */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">EAB Key ID</label>
                        <div className="mt-1 flex items-center space-x-2">
                            <code className="flex-1 rounded-lg bg-gray-100 px-4 py-3 font-mono text-sm text-gray-900">
                                {account.eab_key_id}
                            </code>
                            <button
                                onClick={() => copyToClipboard(account.eab_key_id, 'eab_key_id')}
                                className="rounded-lg p-2 hover:bg-gray-100"
                                title="Copy"
                            >
                                {copied === 'eab_key_id' ? (
                                    <Check className="h-5 w-5 text-green-600" />
                                ) : (
                                    <Copy className="h-5 w-5 text-gray-500" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* EAB HMAC Key */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">EAB HMAC Key</label>
                        <div className="mt-1 flex items-center space-x-2">
                            <code className="flex-1 rounded-lg bg-gray-100 px-4 py-3 font-mono text-sm text-gray-900">
                                {showEabKey ? account.eab_hmac_key : '••••••••••••••••••••••••••••••••'}
                            </code>
                            <button
                                onClick={() => setShowEabKey(!showEabKey)}
                                className="rounded-lg p-2 hover:bg-gray-100"
                                title={showEabKey ? 'Hide' : 'Show'}
                            >
                                {showEabKey ? (
                                    <EyeOff className="h-5 w-5 text-gray-500" />
                                ) : (
                                    <Eye className="h-5 w-5 text-gray-500" />
                                )}
                            </button>
                            <button
                                onClick={() => copyToClipboard(account.eab_hmac_key, 'eab_hmac_key')}
                                className="rounded-lg p-2 hover:bg-gray-100"
                                title="Copy"
                            >
                                {copied === 'eab_hmac_key' ? (
                                    <Check className="h-5 w-5 text-green-600" />
                                ) : (
                                    <Copy className="h-5 w-5 text-gray-500" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Server URL */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">ACME Server URL</label>
                        <div className="mt-1 flex items-center space-x-2">
                            <code className="flex-1 rounded-lg bg-gray-100 px-4 py-3 font-mono text-sm text-gray-900">
                                {account.server_url}
                            </code>
                            <button
                                onClick={() => copyToClipboard(account.server_url, 'server_url')}
                                className="rounded-lg p-2 hover:bg-gray-100"
                                title="Copy"
                            >
                                {copied === 'server_url' ? (
                                    <Check className="h-5 w-5 text-green-600" />
                                ) : (
                                    <Copy className="h-5 w-5 text-gray-500" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Certbot Command */}
                <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700">Certbot Command Example</label>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-green-400">
                        {`certbot certonly --server ${account.server_url} \\
  --eab-kid ${account.eab_key_id} \\
  --eab-hmac-key ${showEabKey ? account.eab_hmac_key : '<YOUR_HMAC_KEY>'} \\
  -d example.com`}
                    </pre>
                </div>
            </div>

            {/* Domains */}
            <div className="rounded-lg bg-white shadow">
                <div className="border-b border-gray-200 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">Domains</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Add domains to enable certificate issuance. Single domain: ${DEFAULT_PRICE_SINGLE}/year, Wildcard: ${DEFAULT_PRICE_WILDCARD}/year
                            </p>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input
                                type="checkbox"
                                checked={showRemovedDomains}
                                onChange={(e) => setShowRemovedDomains(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            Show removed/refunded
                        </label>
                    </div>
                </div>

                {/* Add Domain Form */}
                <form onSubmit={handleAddDomains} className="border-b border-gray-200 px-6 py-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Add Domains
                            <span className="ml-2 text-xs text-gray-400">(separate with space, comma, or new line)</span>
                        </label>
                        <textarea
                            value={domainInput}
                            onChange={(e) => setDomainInput(e.target.value)}
                            placeholder="example.com, *.example.com&#10;another-domain.com"
                            rows={3}
                            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    {/* Price Preview */}
                    {parsedDomains.length > 0 && (
                        <div className="mt-3 rounded-lg bg-blue-50 p-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center text-sm text-blue-800">
                                    <Calculator className="mr-2 h-4 w-4" />
                                    <span>
                                        {parsedDomains.length} domain{parsedDomains.length > 1 ? 's' : ''} to add:
                                    </span>
                                </div>
                                <span className="font-semibold text-blue-900">${totalPrice.toFixed(2)}/year</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {parsedDomains.map((d, i) => (
                                    <span
                                        key={i}
                                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${d.type === 'wildcard'
                                            ? 'bg-purple-100 text-purple-800'
                                            : 'bg-blue-100 text-blue-800'
                                            }`}
                                    >
                                        {d.domain} (${d.price})
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mt-3 flex justify-end">
                        <button
                            type="submit"
                            disabled={addingDomain || parsedDomains.length === 0}
                            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            {addingDomain ? 'Adding...' : `Add ${parsedDomains.length > 0 ? parsedDomains.length : ''} Domain${parsedDomains.length !== 1 ? 's' : ''}`}
                        </button>
                    </div>
                </form>

                {/* Domains List */}
                {domains.filter(d => showRemovedDomains || (d.status !== 'removed' && d.status !== 'failed')).length === 0 ? (
                    <div className="p-12 text-center">
                        <Globe className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-4 text-lg font-medium text-gray-900">
                            {showRemovedDomains ? 'No domains yet' : 'No active domains'}
                        </h3>
                        <p className="mt-2 text-gray-500">
                            {showRemovedDomains
                                ? 'Add domains above to start issuing certificates.'
                                : 'Add domains above or enable "Show removed" to see history.'}
                        </p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Domain
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Type
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Price
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Refund Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Added
                                </th>
                                <th className="relative px-6 py-3">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {domains
                                .filter(d => showRemovedDomains || (d.status !== 'removed' && d.status !== 'failed'))
                                .map((domain) => {
                                    // Calculate refund eligibility
                                    const addedAt = new Date(domain.added_at)
                                    const now = new Date()
                                    const daysSinceAdded = Math.floor((now.getTime() - addedAt.getTime()) / (1000 * 60 * 60 * 24))
                                    const daysUntilNonRefundable = 30 - daysSinceAdded
                                    const isRefundable = daysSinceAdded <= 30
                                    const isRemoved = domain.status === 'removed'
                                    const isFailed = domain.status === 'failed'
                                    const isRefunded = isRemoved && !!domain.refund_transaction_id

                                    return (
                                        <tr key={domain.id} className={`${isRemoved || isFailed ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}`}>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <div className="flex items-center">
                                                    <Globe className={`mr-2 h-5 w-5 ${isRemoved ? 'text-gray-300' : 'text-gray-400'}`} />
                                                    <span className={`font-medium ${isRemoved ? 'text-gray-400 line-through' : isFailed ? 'text-gray-400' : 'text-gray-900'}`}>
                                                        {domain.domain_name}
                                                    </span>
                                                    {isRefunded && (
                                                        <span className="ml-2 inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                                                            Refunded
                                                        </span>
                                                    )}
                                                    {isRemoved && !isRefunded && (
                                                        <span className="ml-2 inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">
                                                            Removed
                                                        </span>
                                                    )}
                                                    {isFailed && (
                                                        <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                                            Failed
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${domain.domain_type === 'wildcard'
                                                    ? 'bg-purple-100 text-purple-800'
                                                    : 'bg-blue-100 text-blue-800'
                                                    }`}>
                                                    {domain.domain_type}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                                                ${domain.price_charged?.toFixed(2) || '0.00'}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                {isRefunded ? (
                                                    <Link
                                                        href={`/transactions?highlight=${domain.refund_transaction_id}`}
                                                        className="inline-flex items-center rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-200"
                                                    >
                                                        ✓ Refund Complete
                                                        <span className="ml-1">🔗</span>
                                                    </Link>
                                                ) : isRemoved ? (
                                                    <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-600">
                                                        No Refund
                                                    </span>
                                                ) : isFailed ? (
                                                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                                                        N/A
                                                    </span>
                                                ) : isRefundable ? (
                                                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                                                        ✓ Refundable ({daysUntilNonRefundable}d left)
                                                    </span>
                                                ) : (
                                                    <span
                                                        className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 cursor-help"
                                                        title="Domains older than 30 days are not eligible for refund per KICA policy."
                                                    >
                                                        Non-Refundable
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <div className="text-gray-900">
                                                    {new Date(domain.added_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </div>
                                                {domain.removed_at && (
                                                    <div className="text-xs text-gray-400">
                                                        {isRefunded ? 'Refunded' : 'Removed'}: {new Date(domain.removed_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-right">
                                                {!isRemoved && !isFailed && (
                                                    <button
                                                        onClick={() => openRemoveModal(domain)}
                                                        className="text-red-600 hover:text-red-900"
                                                        title={isRefundable ? "Remove (with refund)" : "Remove (no refund)"}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {isRefunded && (
                                                    <Link
                                                        href={`/transactions?highlight=${domain.refund_transaction_id}`}
                                                        className="text-purple-600 hover:text-purple-900"
                                                        title="View refund transaction"
                                                    >
                                                        🔗
                                                    </Link>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Certificates Section */}
            <div className="rounded-lg bg-white shadow">
                <div className="border-b border-gray-200 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">Certificates</h3>
                            <p className="text-sm text-gray-500">Issued certificates for this account</p>
                        </div>
                        {certificates.length > 0 && (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                                {certificates.length} Certificate{certificates.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                </div>

                {certificates.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <h4 className="mt-4 text-base font-medium text-gray-900">No Certificates Yet</h4>
                        <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
                            Certificates will appear here after they are issued via ACME.
                            Use the EAB credentials above to configure your ACME client.
                        </p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Domain
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Serial Number
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Valid From
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Expires
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Days Left
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {certificates.map((cert) => {
                                const expiryDate = cert.valid_not_after ? new Date(cert.valid_not_after) : null
                                const daysLeft = expiryDate ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
                                const isExpired = daysLeft !== null && daysLeft < 0
                                const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30

                                return (
                                    <tr key={cert.id} className="hover:bg-gray-50">
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <div className="flex items-center">
                                                <Globe className="mr-2 h-5 w-5 text-gray-400" />
                                                <span className="font-medium text-gray-900">{cert.domain_name}</span>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${isExpired
                                                ? 'bg-red-100 text-red-800'
                                                : isExpiringSoon
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : 'bg-green-100 text-green-800'
                                                }`}>
                                                {isExpired ? 'Expired' : cert.status_desc || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-xs text-gray-600">
                                                {cert.serial_number || 'N/A'}
                                            </code>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                                            {cert.valid_not_before
                                                ? new Date(cert.valid_not_before).toLocaleDateString('id-ID', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })
                                                : 'N/A'}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                                            {cert.valid_not_after
                                                ? new Date(cert.valid_not_after).toLocaleDateString('id-ID', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })
                                                : 'N/A'}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            {daysLeft !== null ? (
                                                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${isExpired
                                                    ? 'bg-red-100 text-red-700'
                                                    : isExpiringSoon
                                                        ? 'bg-yellow-100 text-yellow-700'
                                                        : 'bg-green-100 text-green-700'
                                                    }`}>
                                                    {isExpired ? `Expired ${Math.abs(daysLeft)}d ago` : `${daysLeft} days`}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">N/A</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Remove Domain Modal */}
            <RemoveDomainModal
                isOpen={removeModalOpen}
                onClose={() => {
                    setRemoveModalOpen(false)
                    setDomainToRemove(null)
                }}
                onConfirm={handleConfirmRemove}
                domainName={domainToRemove?.domain_name || ''}
                priceCharged={domainToRemove?.price_charged || 0}
                daysSinceAdded={domainToRemove?.daysSinceAdded || 0}
                isRefundable={domainToRemove?.isRefundable || false}
            />
        </div>
    )
}
