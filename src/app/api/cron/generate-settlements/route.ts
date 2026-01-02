import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// API route to manually trigger settlement generation
// POST /api/cron/generate-settlements
// Protected by CRON_SECRET environment variable

export async function POST(request: Request) {
    try {
        // Verify cron secret for security
        const authHeader = request.headers.get('authorization')
        const expectedSecret = process.env.CRON_SECRET

        if (!expectedSecret) {
            return NextResponse.json(
                { error: 'CRON_SECRET not configured' },
                { status: 500 }
            )
        }

        if (authHeader !== `Bearer ${expectedSecret}`) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Initialize Supabase client with service role key (bypass RLS)
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false
                }
            }
        )

        // Call the PostgreSQL function
        const { data, error } = await supabase.rpc('generate_monthly_settlements')

        if (error) {
            console.error('Settlement generation failed:', error)
            return NextResponse.json(
                { error: 'Failed to generate settlements', details: error.message },
                { status: 500 }
            )
        }

        // data is array with single row: { partner_count, settlement_count, skipped_zero }
        const result = data?.[0] || { partner_count: 0, settlement_count: 0, skipped_zero: 0 }

        return NextResponse.json({
            success: true,
            message: 'Settlement generation completed',
            summary: {
                partners_processed: result.partner_count,
                settlements_created: result.settlement_count,
                skipped_zero_amount: result.skipped_zero
            },
            timestamp: new Date().toISOString()
        })

    } catch (error) {
        console.error('Unexpected error in settlement generation:', error)
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}

// GET endpoint for health check
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        endpoint: 'Settlement Generation Cron',
        info: 'Use POST with Authorization: Bearer <CRON_SECRET>'
    })
}
