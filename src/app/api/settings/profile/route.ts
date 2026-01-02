import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/settings/profile
// Update company_name ONLY - strict whitelist to prevent unauthorized field updates
export async function PATCH(request: Request) {
    try {
        const supabase = await createClient()

        // Verify authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()

        // STRICT WHITELIST: Only allow company_name
        // Explicitly reject forbidden fields
        const forbiddenFields = ['payment_type', 'credit_limit', 'pricing_class', 'status', 'partner_type']
        const hasForbiddenField = forbiddenFields.some(field => field in body)

        if (hasForbiddenField) {
            console.warn(`[SECURITY] Attempt to modify forbidden field by user ${user.id}`)
            return NextResponse.json(
                { error: 'Forbidden field in request body' },
                { status: 403 }
            )
        }

        // Validate company_name
        if (!body.company_name || typeof body.company_name !== 'string') {
            return NextResponse.json(
                { error: 'company_name is required and must be a string' },
                { status: 400 }
            )
        }

        if (body.company_name.trim().length === 0) {
            return NextResponse.json(
                { error: 'company_name cannot be empty' },
                { status: 400 }
            )
        }

        // Get old value for audit log
        const { data: currentPartner } = await supabase
            .from('partners')
            .select('company_name')
            .eq('id', user.id)
            .single()

        const oldCompanyName = currentPartner?.company_name

        // Update partners table with ONLY company_name
        const { error: updateError } = await supabase
            .from('partners')
            .update({
                company_name: body.company_name.trim(),
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id)

        if (updateError) {
            console.error('Failed to update profile:', updateError)
            return NextResponse.json(
                { error: 'Failed to update profile' },
                { status: 500 }
            )
        }

        // Audit log
        await supabase.from('audit_logs').insert({
            actor_id: user.id,
            action: 'update_profile',
            target_type: 'partner',
            target_id: user.id,
            details: {
                field: 'company_name',
                old_value: oldCompanyName,
                new_value: body.company_name.trim()
            }
        })

        return NextResponse.json({
            success: true,
            message: 'Company name updated successfully'
        })

    } catch (error) {
        console.error('Profile update error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
