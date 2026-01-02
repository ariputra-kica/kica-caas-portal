'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export async function confirmSettlementAction(settlementId: string) {
    try {
        // Initialize Supabase Admin Client
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                }
            }
        )

        // Perform Update
        const { error } = await supabase
            .from('settlements')
            .update({
                status: 'confirmed',
                confirmed_at: new Date().toISOString()
            })
            .eq('id', settlementId)

        if (error) {
            console.error('Server Action Error:', error)
            return { success: false, error: error.message }
        }

        revalidatePath('/statements')
        return { success: true }

    } catch (error) {
        console.error('Unexpected error:', error)
        return { success: false, error: 'Internal server error' }
    }
}
