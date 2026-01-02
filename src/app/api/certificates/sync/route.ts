import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSectigoClient } from '@/lib/sectigo'
import { isSectigoError } from '@/lib/sectigo-types'

/**
 * POST /api/certificates/sync
 * 
 * Manual sync certificates from Sectigo GETLASTORDER API
 * Simple version - just syncs without complex error handling
 */
export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get all active domains
        const { data: domains } = await supabase
            .from('domains')
            .select('id, domain_name, acme_account_id, acme_accounts(acme_account_id, clients(partner_id))')
            .eq('status', 'active')

        if (!domains || domains.length === 0) {
            return NextResponse.json({ success: true, synced: 0, message: 'No domains to sync' })
        }

        const sectigoClient = getSectigoClient()
        let synced = 0

        for (const domain of domains) {
            try {
                const acctArray = domain.acme_accounts as any
                const acctData = Array.isArray(acctArray) ? acctArray[0] : acctArray
                const clientArray = acctData?.clients as any
                const clientData = Array.isArray(clientArray) ? clientArray[0] : clientArray

                if (clientData?.partner_id !== user.id) continue
                if (!acctData?.acme_account_id) continue

                const response = await sectigoClient.getLastOrder({
                    acmeAccountID: acctData.acme_account_id,
                    domainName: domain.domain_name
                })

                if (isSectigoError(response) || !response.certificate) continue

                const cert = response.certificate
                await supabase.from('certificates').upsert({
                    domain_id: domain.id,
                    order_number: cert.orderNumber?.toString() || null,
                    certificate_id: cert.certificateId || null,
                    serial_number: cert.serialNumber || null,
                    valid_not_before: cert.validNotBefore || null,
                    valid_not_after: cert.validNotAfter || null,
                    status_code: cert.statusCode || null,
                    status_desc: cert.statusDesc || null,
                    synced_at: new Date().toISOString()
                }, { onConflict: 'domain_id' })

                synced++
            } catch (err) {
                console.error(`Sync error for ${domain.domain_name}:`, err)
            }
        }

        return NextResponse.json({ success: true, synced, total: domains.length })
    } catch (error) {
        console.error('Sync error:', error)
        return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
    }
}
