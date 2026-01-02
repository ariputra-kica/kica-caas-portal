import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSectigoClient } from '@/lib/sectigo'
import { isSectigoError } from '@/lib/sectigo-types'

/**
 * POST /api/cron/zombie-sweeper
 * 
 * Vercel Cron job that runs every 10 minutes to recover stuck transactions.
 * 
 * Problem: If server crashes after calling Sectigo API but before saving response,
 * the transaction gets stuck in 'pending' status with balance reserved forever.
 * 
 * Solution: 
 * 1. Find transactions stuck in 'pending' for > 10 minutes
 * 2. Verify with Sectigo if domain actually exists (LISTDOMAINS)
 * 3. Fallback: Check GETLASTORDER if LISTDOMAINS cache is stale
 * 4. Commit (SUCCESS) or Rollback (FAILED) accordingly
 * 
 * Security: Protected by CRON_SECRET header
 */
export async function POST(request: Request) {
    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        console.log('[Zombie Sweeper] Unauthorized request')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Zombie Sweeper] Starting sweep...')

    try {
        // Use service role for database access
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Find stuck transactions (pending > 10 minutes old)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

        const { data: zombies, error: queryError } = await supabase
            .from('transactions')
            .select(`
                id,
                acme_account_id,
                domain_id,
                amount,
                created_at,
                domains!transactions_domain_id_fkey (
                    domain_name,
                    acme_accounts!inner (
                        acme_account_id
                    )
                )
            `)
            .eq('status', 'pending')
            .eq('type', 'add_domain')
            .lt('created_at', tenMinutesAgo)
            .limit(50) // Process in batches

        if (queryError) {
            console.error('[Zombie Sweeper] Query error:', queryError)
            return NextResponse.json({ error: 'Database query failed' }, { status: 500 })
        }

        if (!zombies || zombies.length === 0) {
            console.log('[Zombie Sweeper] No stuck transactions found')
            return NextResponse.json({
                success: true,
                message: 'No stuck transactions',
                swept: 0
            })
        }

        console.log(`[Zombie Sweeper] Found ${zombies.length} stuck transactions`)

        const sectigoClient = getSectigoClient()
        let committed = 0
        let rolledBack = 0
        let errors = 0

        for (const tx of zombies) {
            try {
                // Handle join result (returns array or single object)
                const domainsResult = tx.domains as Array<{
                    domain_name: string
                    acme_accounts: Array<{ acme_account_id: string }> | null
                }> | null

                const domainData = Array.isArray(domainsResult) ? domainsResult[0] : domainsResult
                const acmeAccount = domainData?.acme_accounts?.[0]

                if (!domainData || !acmeAccount) {
                    console.warn(`[Zombie Sweeper] Skipping tx ${tx.id}: Missing domain/account data`)
                    errors++
                    continue
                }

                const domainName = domainData.domain_name
                const sectigoAccountId = acmeAccount.acme_account_id

                console.log(`[Zombie Sweeper] Checking: ${domainName}`)

                // Primary verification: LISTDOMAINS
                let domainExists = await sectigoClient.verifyDomainExists(
                    sectigoAccountId,
                    domainName
                )

                // Fallback verification: GETLASTORDER (if LISTDOMAINS cache is stale)
                if (!domainExists) {
                    const orderResponse = await sectigoClient.getLastOrder({
                        acmeAccountID: sectigoAccountId,
                        domainName: domainName
                    })

                    if (!isSectigoError(orderResponse) &&
                        orderResponse.certificate?.statusCode === 2) {
                        // statusCode 2 = Issued
                        domainExists = true
                        console.log(`[Zombie Sweeper] Found via GETLASTORDER: ${domainName}`)
                    }
                }

                if (domainExists) {
                    // COMMIT: Domain exists in Sectigo, finalize as success
                    const { error: updateError } = await supabase
                        .from('transactions')
                        .update({ status: 'success' })
                        .eq('id', tx.id)

                    if (!updateError) {
                        committed++
                        console.log(`[Zombie Sweeper] COMMITTED: ${domainName}`)

                        // Audit log
                        await supabase.from('audit_logs').insert({
                            actor_id: null, // System action
                            action: 'zombie_commit',
                            target_type: 'transaction',
                            target_id: tx.id,
                            details: { domain_name: domainName, reason: 'Found in Sectigo' }
                        })
                    }
                } else {
                    // ROLLBACK: Domain not in Sectigo, mark as failed
                    const { error: updateError } = await supabase
                        .from('transactions')
                        .update({ status: 'failed' })
                        .eq('id', tx.id)

                    if (!updateError) {
                        rolledBack++
                        console.log(`[Zombie Sweeper] ROLLED BACK: ${domainName}`)

                        // TODO: Refund reserved balance if using pre-paid
                        // This would require updating partner balance

                        // Audit log
                        await supabase.from('audit_logs').insert({
                            actor_id: null,
                            action: 'zombie_rollback',
                            target_type: 'transaction',
                            target_id: tx.id,
                            details: { domain_name: domainName, reason: 'Not found in Sectigo' }
                        })
                    }
                }
            } catch (txError) {
                console.error(`[Zombie Sweeper] Error processing tx ${tx.id}:`, txError)
                errors++
            }
        }

        const summary = {
            success: true,
            swept: zombies.length,
            committed,
            rolledBack,
            errors,
            timestamp: new Date().toISOString()
        }

        console.log('[Zombie Sweeper] Complete:', summary)
        return NextResponse.json(summary)

    } catch (error) {
        console.error('[Zombie Sweeper] Fatal error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// Also allow GET for manual testing (with same auth)
export async function GET(request: Request) {
    return POST(request)
}
