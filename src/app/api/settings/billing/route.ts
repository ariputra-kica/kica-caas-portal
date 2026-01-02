import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/settings/billing
// Update billing_preferences table
export async function PATCH(request: Request) {
    try {
        const supabase = await createClient()

        // Verify authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()

        // Whitelist allowed fields
        const allowedFields = [
            'billing_email',
            'billing_phone',
            'auto_confirm_statement',
            'statement_reviewer_email',
            'notify_on_expiry',
            'notify_on_new_client',
            'notify_monthly_report'
        ]

        // Filter body to only include allowed fields
        const updates: Record<string, unknown> = {}
        for (const field of allowedFields) {
            if (field in body) {
                updates[field] = body[field]
            }
        }

        // Add updated timestamp
        updates.updated_at = new Date().toISOString()

        // Update billing preferences
        const { error: updateError } = await supabase
            .from('billing_preferences')
            .update(updates)
            .eq('partner_id', user.id)

        if (updateError) {
            console.error('Failed to update billing preferences:', updateError)
            return NextResponse.json(
                { error: 'Failed to update billing preferences' },
                { status: 500 }
            )
        }

        // Audit log
        await supabase.from('audit_logs').insert({
            actor_id: user.id,
            action: 'update_billing_preferences',
            target_type: 'billing_preferences',
            target_id: user.id,
            details: {
                updated_fields: Object.keys(updates).filter(k => k !== 'updated_at')
            }
        })

        return NextResponse.json({
            success: true,
            message: 'Billing preferences updated successfully'
        })

    } catch (error) {
        console.error('Billing preferences update error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
