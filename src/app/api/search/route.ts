import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.toLowerCase() || ''

    if (!query || query.length < 2) {
        return NextResponse.json({ results: [] })
    }

    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Search clients
    const { data: clients } = await supabase
        .from('clients')
        .select('id, name, company_name')
        .eq('partner_id', user.id)
        .or(`name.ilike.%${query}%,company_name.ilike.%${query}%`)
        .limit(5)

    // Search ACME accounts
    const { data: accounts } = await supabase
        .from('acme_accounts')
        .select('id, account_name, clients!inner(id, name, partner_id)')
        .eq('clients.partner_id', user.id)
        .ilike('account_name', `%${query}%`)
        .limit(5)

    // Search domains
    const { data: domains } = await supabase
        .from('domains')
        .select('id, domain_name, acme_account_id, acme_accounts!inner(id, clients!inner(id, partner_id))')
        .eq('acme_accounts.clients.partner_id', user.id)
        .ilike('domain_name', `%${query}%`)
        .limit(5)

    // Search certificates
    const { data: certificates } = await supabase
        .from('certificates')
        .select('id, certificate_id, serial_number, domains!inner(domain_name, acme_accounts!inner(id, clients!inner(id, partner_id)))')
        .eq('domains.acme_accounts.clients.partner_id', user.id)
        .or(`certificate_id.ilike.%${query}%,serial_number.ilike.%${query}%`)
        .limit(5)

    // Build categorized results
    const results = {
        clients: (clients || []).map(c => ({
            id: c.id,
            title: c.name,
            subtitle: c.company_name || 'Individual',
            href: `/clients/${c.id}`,
        })),
        accounts: (accounts || []).map(a => {
            const client = Array.isArray(a.clients) ? a.clients[0] : a.clients
            return {
                id: a.id,
                title: a.account_name,
                subtitle: client?.name || '',
                href: `/clients/${client?.id}/accounts/${a.id}`,
            }
        }),
        domains: (domains || []).map(d => {
            const account = Array.isArray(d.acme_accounts) ? d.acme_accounts[0] : d.acme_accounts
            const client = account ? (Array.isArray(account.clients) ? account.clients[0] : account.clients) : null
            return {
                id: d.id,
                title: d.domain_name,
                subtitle: 'Domain',
                href: client && account ? `/clients/${client.id}/accounts/${account.id}` : '#',
            }
        }),
        certificates: (certificates || []).map(c => {
            const domain = Array.isArray(c.domains) ? c.domains[0] : c.domains
            return {
                id: c.id,
                title: c.certificate_id || c.serial_number || 'Certificate',
                subtitle: domain?.domain_name || 'Certificate',
                href: `/certificates`,
            }
        }),
        navigation: getNavigationResults(query),
    }

    return NextResponse.json({ results })
}

// Static navigation items
function getNavigationResults(query: string) {
    const navItems = [
        { title: 'Dashboard', href: '/dashboard', keywords: ['dashboard', 'home', 'overview'] },
        { title: 'Clients', href: '/clients', keywords: ['clients', 'customers', 'users'] },
        { title: 'Subscriptions', href: '/subscriptions', keywords: ['subscriptions', 'plans'] },
        { title: 'Domains', href: '/domains', keywords: ['domains', 'ssl'] },
        { title: 'Certificates', href: '/certificates', keywords: ['certificates', 'ssl', 'tls', 'certs'] },
        { title: 'Transactions', href: '/transactions', keywords: ['transactions', 'billing', 'payments'] },
        { title: 'Statements', href: '/statements', keywords: ['statements', 'invoices', 'billing'] },
        { title: 'Audit Logs', href: '/audit-logs', keywords: ['audit', 'logs', 'history', 'activity'] },
        { title: 'Settings', href: '/settings', keywords: ['settings', 'preferences', 'config'] },
    ]

    return navItems
        .filter(item =>
            item.title.toLowerCase().includes(query) ||
            item.keywords.some(k => k.includes(query))
        )
        .map(item => ({
            id: item.href,
            title: item.title,
            subtitle: 'Navigation',
            href: item.href,
        }))
        .slice(0, 3)
}
