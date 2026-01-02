import Sidebar from '@/components/layout/Sidebar'
import DashboardClient from '@/components/DashboardClient'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function getPartnerName() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data: partner } = await supabase
        .from('partners')
        .select('company_name')
        .eq('id', user.id)
        .single()

    return partner?.company_name || null
}

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const partnerName = await getPartnerName()

    return (
        <div className="flex h-screen bg-[#F8FAFC]">
            <Sidebar />
            <DashboardClient partnerName={partnerName || undefined}>{children}</DashboardClient>
        </div>
    )
}

