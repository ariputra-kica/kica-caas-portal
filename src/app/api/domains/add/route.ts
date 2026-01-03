import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSectigoClient } from '@/lib/sectigo'
import { isSectigoError } from '@/lib/sectigo-types'

/**
 * POST /api/domains/add
 * Add domain to Sectigo ACME account
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { acmeAccountID, domainName, transactionId } = body

        if (!acmeAccountID || !domainName || !transactionId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        // Use service role for database access
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Call Sectigo API
        const client = getSectigoClient()
        const response = await client.addDomain({
            acmeAccountID,
            domainName
        })

        // Check if error
        if (isSectigoError(response)) {
            const errorMsg = (response as { errorMessage?: string }).errorMessage || 'Unknown error'

            // Update transaction to failed
            await supabase
                .from('transactions')
                .update({ status: 'failed', description: `Failed: ${errorMsg}` })
                .eq('id', transactionId)

            return NextResponse.json(
                { success: false, error: errorMsg },
                { status: 400 }
            )
        }

        // Success - update transaction
        await supabase
            .from('transactions')
            .update({ status: 'success' })
            .eq('id', transactionId)

        return NextResponse.json({
            success: true,
            data: response
        })

    } catch (error) {
        console.error('[Add Domain API] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
