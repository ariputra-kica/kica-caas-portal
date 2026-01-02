import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/settings/password
// Change user password via Supabase Auth
export async function POST(request: Request) {
    try {
        const supabase = await createClient()

        // Verify authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { current_password, new_password } = body

        // Validation
        if (!current_password || !new_password) {
            return NextResponse.json(
                { error: 'current_password and new_password are required' },
                { status: 400 }
            )
        }

        if (new_password.length < 8) {
            return NextResponse.json(
                { error: 'New password must be at least 8 characters' },
                { status: 400 }
            )
        }

        // Verify current password by attempting to sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email || '',
            password: current_password
        })

        if (signInError) {
            return NextResponse.json(
                { error: 'Current password is incorrect' },
                { status: 401 }
            )
        }

        // Update password using Supabase Auth API
        const { error: updateError } = await supabase.auth.updateUser({
            password: new_password
        })

        if (updateError) {
            console.error('Failed to update password:', updateError)
            return NextResponse.json(
                { error: 'Failed to update password' },
                { status: 500 }
            )
        }

        // Audit log
        await supabase.from('audit_logs').insert({
            actor_id: user.id,
            action: 'change_password',
            target_type: 'auth_user',
            target_id: user.id,
            details: {
                message: 'Password updated successfully'
            }
        })

        return NextResponse.json({
            success: true,
            message: 'Password updated successfully'
        })

    } catch (error) {
        console.error('Password update error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
