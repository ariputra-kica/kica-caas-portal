import { createClient } from '@/lib/supabase/server'
import { Users, Shield, Globe, Award, Clock, CreditCard, Wallet } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function getStats() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    // Get partner data
    const { data: partner } = await supabase
        .from('partners')
        .select('*')
        .eq('id', user.id)
        .single()

    // Get counts
    const { count: clientCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('partner_id', user.id)

    const { count: accountCount } = await supabase
        .from('acme_accounts')
        .select('*, clients!inner(*)', { count: 'exact', head: true })
        .eq('clients.partner_id', user.id)

    const { count: domainCount } = await supabase
        .from('domains')
        .select('*, acme_accounts!inner(*, clients!inner(*))', { count: 'exact', head: true })
        .eq('acme_accounts.clients.partner_id', user.id)


    // Get certificate count - simplified query
    // First get all domain IDs for this partner
    const { data: partnerDomains } = await supabase
        .from('domains')
        .select('id, acme_accounts!inner(*, clients!inner(*))')
        .eq('acme_accounts.clients.partner_id', user.id)

    const domainIds = partnerDomains?.map(d => d.id) || []

    const { count: certificateCount } = await supabase
        .from('certificates')
        .select('*', { count: 'exact', head: true })
        .in('domain_id', domainIds)


    // Calculate billing cycle start and end (current month)
    const now = new Date()
    const billingCycleStart = new Date(now.getFullYear(), now.getMonth(), 1) // First day of month
    const billingCycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0) // Last day of month

    // Calculate actual credit usage from transactions IN CURRENT BILLING CYCLE
    // Separate tracking for Purchases vs Refunds for transparency
    const { data: transactions } = await supabase
        .from('transactions')
        .select('type, amount, status, created_at')
        .eq('partner_id', user.id)
        .in('status', ['success', 'pending_api'])  // Include reserved (pending_api)
        .gte('created_at', billingCycleStart.toISOString())
        .lte('created_at', billingCycleEnd.toISOString())

    let totalPurchases = 0     // Total add_domain amounts this month
    let totalRefunds = 0       // Total refund amounts this month
    let reservedCredit = 0     // Pending API amounts

    if (transactions) {
        for (const tx of transactions) {
            if (tx.type === 'add_domain') {
                if (tx.status === 'pending_api') {
                    reservedCredit += tx.amount || 0
                } else {
                    totalPurchases += tx.amount || 0
                }
            } else if (tx.type === 'refund') {
                totalRefunds += tx.amount || 0
            }
        }
    }

    // Net Used = Purchases - Refunds (can be negative if refunds exceed purchases)
    const netUsed = totalPurchases - totalRefunds

    // Payment type determines if credit limit applies
    const paymentType = partner?.payment_type || 'post_paid'
    const creditLimit = paymentType === 'deposit' ? (partner?.credit_limit || 0) : null

    // billingCycleStart and billingCycleEnd already declared above

    // Get recent activity (last 5 actions)
    const { data: recentActivity } = await supabase
        .from('audit_logs')
        .select('id, action, target_type, details, created_at')
        .eq('actor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

    // Get expiring subscriptions (ACME accounts expiring within 60 days)
    const sixtyDaysFromNow = new Date()
    sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60)

    const { data: expiringAccounts } = await supabase
        .from('acme_accounts')
        .select(`
            id,
            account_name,
            end_date,
            status,
            clients!inner(id, name, company_name, partner_id)
        `)
        .eq('clients.partner_id', user.id)
        .not('end_date', 'is', null)
        .lte('end_date', sixtyDaysFromNow.toISOString())
        .gt('end_date', new Date().toISOString())
        .order('end_date', { ascending: true })
        .limit(5)

    // Get recent transactions for Transaction History (last 5)
    const { data: recentTransactions } = await supabase
        .from('transactions')
        .select(`
            id,
            type,
            amount,
            status,
            created_at,
            domains!domain_id(domain_name, domain_type),
            acme_accounts!acme_account_id(account_name, certificate_type)
        `)
        .eq('partner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

    return {
        partner,
        stats: {
            clients: clientCount || 0,
            accounts: accountCount || 0,
            domains: domainCount || 0,
            certificates: certificateCount || 0,
            totalPurchases: totalPurchases,
            totalRefunds: totalRefunds,
            netUsed: netUsed,
            creditReserved: reservedCredit,
            creditLimit: creditLimit,
            paymentType: paymentType,
            billingCycleEnd: billingCycleEnd.toISOString(),
        },
        recentActivity: recentActivity || [],
        expiringAccounts: expiringAccounts || [],
        recentTransactions: recentTransactions || []
    }
}

// Helper functions for activity display
function getActivityIcon(action: string): string {
    const icons: Record<string, string> = {
        'add_domain': '🟢',
        'remove_domain': '🔴',
        'refund_domain': '🟡',
        'create_account': '🔵',
        'create_client': '👤',
        'reveal_eab_key': '🔑',
    }
    return icons[action] || '📌'
}

function formatActivityMessage(action: string, details: Record<string, unknown>): string {
    switch (action) {
        case 'add_domain':
            return `Added domain: ${details.domain_name || 'unknown'}`
        case 'remove_domain':
            return `Removed domain: ${details.domain_name || 'unknown'}`
        case 'refund_domain':
            return `Refund processed: $${details.refund_amount || details.amount || '?'}`
        case 'create_account':
            return `Created ACME account`
        case 'create_client':
            return `Added Client: ${details.name || 'unknown'}`
        case 'reveal_eab_key':
            return `Viewed EAB credentials`
        default:
            return action.replace(/_/g, ' ')
    }
}

function formatRelativeTime(dateStr: string): string {
    const now = new Date()
    const then = new Date(dateStr)
    const diffMs = now.getTime() - then.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`
    return `${Math.floor(diffMins / 1440)} days ago`
}

export default async function DashboardPage() {
    const data = await getStats()

    if (!data) {
        return <div>Loading...</div>
    }

    const { partner, stats, recentActivity, expiringAccounts, recentTransactions } = data

    // Trust-based billing: No credit percentage calculations for post_paid
    const isPostPaid = stats.paymentType === 'post_paid'
    const hasNetCreditBack = stats.netUsed < 0  // Refunds exceed purchases

    // Format billing cycle end date
    const billingCycleEndDate = new Date(stats.billingCycleEnd)
    const formattedBillingEnd = billingCycleEndDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    })

    const statCards = [
        {
            name: 'Clients',
            subtitle: 'Total Clients',
            value: stats.clients,
            icon: Users,
            color: 'bg-[#2d56c2]',
            trend: null,
            trendUp: false,
            isPrimary: false
        },
        {
            name: 'Subscriptions',
            subtitle: 'Active ACME Accounts',
            value: stats.accounts,
            icon: Shield,
            color: 'bg-purple-500',
            trend: null,
            trendUp: false,
            isPrimary: false
        },
        {
            name: 'Domains',
            subtitle: 'Active Domains',
            value: stats.domains,
            icon: Globe,
            color: 'bg-[#2d56c2]',
            trend: null,
            trendUp: false,
            isPrimary: true  // Primary card with Royal Blue full background
        },
        {
            name: 'Certificates',
            subtitle: 'Active Certificates',
            value: stats.certificates,
            icon: Award,
            color: 'bg-emerald-500',
            trend: null,
            trendUp: false,
            isPrimary: false
        },
    ]

    // Time-aware greeting
    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Good Morning'
        if (hour < 18) return 'Good Afternoon'
        return 'Good Evening'
    }

    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat) => (
                    <div
                        key={stat.name}
                        className={`overflow-hidden rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 ${stat.isPrimary
                            ? 'bg-gradient-to-br from-[#2d56c2] to-[#1e3a8a]'
                            : 'bg-gradient-to-br from-white to-gray-50/80 border border-white/50'
                            }`}
                    >
                        <div className="p-5">
                            <div className="flex items-center">
                                <div className={`flex-shrink-0 rounded-xl ${stat.isPrimary ? 'bg-white/20' : stat.color} p-3`}>
                                    <stat.icon className={`h-6 w-6 ${stat.isPrimary ? 'text-white' : 'text-white'}`} />
                                </div>
                                <div className="ml-4 w-0 flex-1">
                                    <dl>
                                        <dt className={`truncate text-sm font-medium ${stat.isPrimary ? 'text-blue-100' : 'text-gray-500'}`}>
                                            {stat.name}
                                        </dt>
                                        <dd className={`text-2xl font-bold ${stat.isPrimary ? 'text-white' : 'text-gray-900'}`}>
                                            {stat.value}
                                        </dd>
                                        {stat.trend && (
                                            <dd className={`text-xs font-medium mt-1 ${stat.isPrimary ? 'text-green-300' : 'text-emerald-600'}`}>
                                                ↑ {stat.trend}
                                            </dd>
                                        )}
                                        {stat.subtitle && (
                                            <dd className={`text-sm ${stat.isPrimary ? 'text-blue-200' : 'text-gray-500'}`}>{stat.subtitle}</dd>
                                        )}
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Current Billing Cycle & Transaction History - 2 Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* LEFT: Current Billing Cycle - Trust-Based Design */}
                <div className="rounded-xl bg-white/80 backdrop-blur-sm p-5 shadow-lg shadow-gray-200/50 border border-white/50">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-gray-900">Current Billing Cycle</h3>
                        <span className="text-xs text-gray-500 bg-blue-50 px-2 py-1 rounded-full">
                            Ends {formattedBillingEnd}
                        </span>
                    </div>

                    {/* Main Amount Display */}
                    <div className="text-center py-6 bg-gradient-to-br from-blue-50 to-white rounded-xl mb-4">
                        <p className="text-sm text-gray-500 mb-1">Total Unbilled Amount</p>
                        <p className={`text-4xl font-extrabold tracking-tight ${hasNetCreditBack ? 'text-emerald-600' : 'text-[#2d56c2]'}`}>
                            ${Math.abs(stats.netUsed).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        {hasNetCreditBack && (
                            <p className="text-xs text-emerald-600 mt-1">Credit balance (refunds exceed charges)</p>
                        )}
                    </div>

                    {/* Breakdown */}
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                            <span className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#2d56c2]" />
                                <span className="text-gray-600">Purchases</span>
                            </span>
                            <span className="font-semibold text-gray-900">${stats.totalPurchases.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                            <span className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-purple-500" />
                                <span className="text-gray-600">Refunds</span>
                            </span>
                            <span className="font-semibold text-purple-600">-${stats.totalRefunds.toFixed(2)}</span>
                        </div>
                        {stats.creditReserved > 0 && (
                            <div className="flex items-center justify-between py-2">
                                <span className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                                    <span className="text-gray-600">Pending</span>
                                </span>
                                <span className="font-semibold text-amber-600">${stats.creditReserved.toFixed(2)}</span>
                            </div>
                        )}
                    </div>

                    {/* Info Footer */}
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <p className="text-xs text-blue-700">
                            <strong>Monthly Settlement:</strong> Your usage will be invoiced at the end of each billing cycle.
                        </p>
                    </div>
                </div>

                {/* RIGHT: Transaction History */}
                <div className="rounded-xl bg-white/80 backdrop-blur-sm p-5 shadow-lg shadow-gray-200/50 border border-white/50">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-gray-900">Transaction History</h3>
                        <a href="/transactions" className="text-xs text-[#2d56c2] hover:underline font-medium">View All</a>
                    </div>

                    {/* Transaction List */}
                    <div className="space-y-3">
                        {recentTransactions.length > 0 ? (
                            recentTransactions.map((tx: any) => {
                                const isRefund = tx.type === 'refund'
                                const domain = Array.isArray(tx.domains) ? tx.domains[0] : tx.domains
                                const account = Array.isArray(tx.acme_accounts) ? tx.acme_accounts[0] : tx.acme_accounts
                                const isWildcard = domain?.domain_type === 'wildcard'
                                const isOV = account?.certificate_type === 'OV'

                                return (
                                    <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isRefund ? 'bg-purple-100' : isOV ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                                                {isRefund ? (
                                                    <CreditCard className="w-4 h-4 text-purple-600" />
                                                ) : isWildcard ? (
                                                    <Globe className="w-4 h-4 text-[#2d56c2]" />
                                                ) : (
                                                    <Shield className={`w-4 h-4 ${isOV ? 'text-emerald-600' : 'text-[#2d56c2]'}`} />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {isRefund ? 'Refund' : domain?.domain_name || 'Domain Added'}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {isOV ? 'Organization Validation' : 'Domain Validation'} • {account?.account_name || 'ACME'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-semibold ${isRefund ? 'text-[#00d57b]' : 'text-gray-900'}`}>
                                                {isRefund ? '+' : '-'}${(tx.amount || 0).toFixed(2)}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {formatRelativeTime(tx.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <div className="py-6 text-center">
                                <CreditCard className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">No recent transactions</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Actions & Recent Activity */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Quick Actions */}
                <div className="rounded-xl bg-white/80 backdrop-blur-sm p-6 shadow-lg shadow-gray-200/50 border border-white/50">
                    <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <a
                            href="/clients/new"
                            className="group flex flex-col items-center justify-center rounded-xl bg-gradient-to-br from-white to-gray-50 p-5 text-center shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                        >
                            <div className="rounded-full bg-blue-50 p-3 group-hover:bg-[#FF8200]/10 transition-colors">
                                <Users className="h-6 w-6 text-[#2d56c2] group-hover:text-[#FF8200] transition-colors" />
                            </div>
                            <span className="mt-3 block text-sm font-semibold text-gray-900">
                                Add Client
                            </span>
                        </a>
                        <a
                            href="/transactions"
                            className="group flex flex-col items-center justify-center rounded-xl bg-gradient-to-br from-white to-gray-50 p-5 text-center shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                        >
                            <div className="rounded-full bg-emerald-50 p-3 group-hover:bg-[#FF8200]/10 transition-colors">
                                <CreditCard className="h-6 w-6 text-emerald-600 group-hover:text-[#FF8200] transition-colors" />
                            </div>
                            <span className="mt-3 block text-sm font-semibold text-gray-900">
                                Transactions
                            </span>
                        </a>
                        <a
                            href="/audit-logs"
                            className="group flex flex-col items-center justify-center rounded-xl bg-gradient-to-br from-white to-gray-50 p-5 text-center shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                        >
                            <div className="rounded-full bg-purple-50 p-3 group-hover:bg-[#FF8200]/10 transition-colors">
                                <Shield className="h-6 w-6 text-purple-600 group-hover:text-[#FF8200] transition-colors" />
                            </div>
                            <span className="mt-3 block text-sm font-semibold text-gray-900">
                                Audit Logs
                            </span>
                        </a>
                    </div>
                </div>

                {/* Subscription Expiring Soon */}
                <div className="rounded-xl bg-white/80 backdrop-blur-sm p-6 shadow-lg shadow-gray-200/50 border border-white/50">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">⏰ Subscriptions Expiring Soon</h3>
                        <Clock className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="mt-4 space-y-3">
                        {expiringAccounts.length > 0 ? (
                            expiringAccounts.map((account) => {
                                const endDate = new Date(account.end_date)
                                const now = new Date()
                                const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                                const urgencyColor = daysLeft <= 7 ? 'text-red-600 bg-red-50' : daysLeft <= 30 ? 'text-amber-600 bg-amber-50' : 'text-blue-600 bg-blue-50'
                                const dotColor = daysLeft <= 7 ? 'bg-red-500' : daysLeft <= 30 ? 'bg-amber-500' : 'bg-blue-500'
                                const client = Array.isArray(account.clients) ? account.clients[0] : account.clients

                                return (
                                    <Link
                                        key={account.id}
                                        href={`/clients`}
                                        className="flex items-center justify-between rounded-lg p-3 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`h-2 w-2 rounded-full ${dotColor}`} />
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{account.account_name}</p>
                                                <p className="text-xs text-gray-500">{client?.company_name || 'Individual'}</p>
                                            </div>
                                        </div>
                                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${urgencyColor}`}>
                                            {daysLeft} days
                                        </span>
                                    </Link>
                                )
                            })
                        ) : (
                            <div className="text-center py-6">
                                <Shield className="mx-auto h-8 w-8 text-green-300" />
                                <p className="mt-2 text-sm text-green-600">All subscriptions healthy</p>
                                <p className="text-xs text-gray-500">No expirations in the next 60 days</p>
                            </div>
                        )}
                    </div>
                    {expiringAccounts.length > 0 && (
                        <Link
                            href="/clients"
                            className="mt-4 block text-center text-sm text-amber-600 hover:text-amber-800"
                        >
                            Manage accounts →
                        </Link>
                    )}
                </div>

                {/* Certificate Expiry Alerts - Coming Soon */}
                <div className="rounded-xl bg-white/80 backdrop-blur-sm p-6 shadow-lg shadow-gray-200/50 border border-white/50">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">🔐 Certificate Expiry Alerts</h3>
                        <span className="text-xs bg-[#2d56c2]/10 text-[#2d56c2] px-2.5 py-1 rounded-full font-medium">Coming Soon</span>
                    </div>
                    <div className="mt-4 text-center py-8">
                        <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                            <Globe className="h-6 w-6 text-gray-400" />
                        </div>
                        <p className="mt-3 text-sm font-medium text-gray-900">Certificate Monitoring</p>
                        <p className="mt-1 text-xs text-gray-500">
                            Automatic SSL/TLS certificate expiry tracking will be available in the next update.
                        </p>
                        <div className="mt-4 inline-flex items-center gap-1 text-xs text-blue-600">
                            <span>🚧</span>
                            <span>Integration in progress</span>
                        </div>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="rounded-xl bg-white/80 backdrop-blur-sm p-6 shadow-lg shadow-gray-200/50 border border-white/50">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                        <Clock className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="mt-4 space-y-3">
                        {recentActivity.length > 0 ? (
                            recentActivity.map((activity) => (
                                <div key={activity.id} className="flex items-start gap-3 rounded-lg p-2 hover:bg-gray-50">
                                    <span className="text-lg">{getActivityIcon(activity.action)}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-900 truncate">
                                            {formatActivityMessage(activity.action, activity.details || {})}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {formatRelativeTime(activity.created_at)}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-6">
                                <Clock className="mx-auto h-8 w-8 text-gray-300" />
                                <p className="mt-2 text-sm text-gray-500">No recent activity</p>
                            </div>
                        )}
                    </div>
                    {recentActivity.length > 0 && (
                        <Link
                            href="/audit-logs"
                            className="mt-4 block text-center text-sm text-blue-600 hover:text-blue-800"
                        >
                            View all activity →
                        </Link>
                    )}
                </div>
            </div>
        </div >
    )
}

