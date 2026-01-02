import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Plus, Shield, Building2, User, Mail, Phone, Calendar, Globe, DollarSign } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getClient(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data: client, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .eq('partner_id', user.id)
        .single()

    if (error || !client) return null

    // Get ACME accounts
    const { data: accounts } = await supabase
        .from('acme_accounts')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false })

    // Get account IDs for stats
    const accountIds = (accounts || []).map(a => a.id)

    // Get domain count across all accounts
    let domainCount = 0
    if (accountIds.length > 0) {
        const { count } = await supabase
            .from('domains')
            .select('*', { count: 'exact', head: true })
            .in('acme_account_id', accountIds)
            .eq('status', 'active')
        domainCount = count || 0
    }

    // Get total spend from transactions
    let totalSpend = 0
    if (accountIds.length > 0) {
        const { data: transactions } = await supabase
            .from('transactions')
            .select('type, amount')
            .in('acme_account_id', accountIds)
            .eq('status', 'success')

        if (transactions) {
            transactions.forEach(tx => {
                if (tx.type === 'add_domain') totalSpend += tx.amount || 0
                if (tx.type === 'refund') totalSpend -= tx.amount || 0
            })
        }
    }

    return {
        client,
        accounts: accounts || [],
        stats: {
            accountCount: accounts?.length || 0,
            domainCount,
            totalSpend
        }
    }
}

export default async function ClientDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const data = await getClient(id)

    if (!data) {
        notFound()
    }

    const { client, accounts, stats } = data

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link
                        href="/clients"
                        className="rounded-lg p-2 hover:bg-gray-100"
                    >
                        <ArrowLeft className="h-5 w-5 text-gray-500" />
                    </Link>
                    <div className="flex items-center space-x-4">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${client.company_name
                            ? 'bg-indigo-100'
                            : 'bg-teal-100'
                            }`}>
                            {client.company_name ? (
                                <Building2 className="h-6 w-6 text-indigo-600" />
                            ) : (
                                <User className="h-6 w-6 text-teal-600" />
                            )}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
                            {client.company_name && (
                                <span className="text-sm text-gray-600">{client.company_name}</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href={`/clients/${id}/edit`}
                        className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Edit
                    </Link>
                    <Link
                        href={`/clients/${id}/accounts/new`}
                        className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Create ACME Account
                    </Link>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-white p-4 shadow">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-purple-100 p-2">
                            <Shield className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">ACME Accounts</p>
                            <p className="text-xl font-semibold text-gray-900">{stats.accountCount}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-lg bg-white p-4 shadow">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-indigo-100 p-2">
                            <Globe className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Active Domains</p>
                            <p className="text-xl font-semibold text-gray-900">{stats.domainCount}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-lg bg-white p-4 shadow">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-green-100 p-2">
                            <DollarSign className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total Spend</p>
                            <p className="text-xl font-semibold text-gray-900">${stats.totalSpend.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Unified Info Section */}
            <div className="rounded-lg bg-white p-6 shadow">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                    {/* Organization Name */}
                    <div>
                        <h4 className="text-sm font-medium text-gray-500">Organization</h4>
                        <p className="mt-1 text-lg font-medium text-gray-900">
                            {client.company_name || <span className="text-gray-400">Not specified</span>}
                        </p>
                    </div>
                    {/* Email */}
                    <div>
                        <h4 className="text-sm font-medium text-gray-500">Email</h4>
                        <p className="mt-1 flex items-center text-gray-900">
                            <Mail className="mr-2 h-4 w-4 text-gray-400" />
                            {client.email || <span className="text-gray-400">Not provided</span>}
                        </p>
                    </div>
                    {/* Phone */}
                    <div>
                        <h4 className="text-sm font-medium text-gray-500">Phone</h4>
                        <p className="mt-1 flex items-center text-gray-900">
                            <Phone className="mr-2 h-4 w-4 text-gray-400" />
                            {client.phone || <span className="text-gray-400">Not provided</span>}
                        </p>
                    </div>
                    {/* Status & Created */}
                    <div>
                        <h4 className="text-sm font-medium text-gray-500">Status</h4>
                        <div className="mt-1 flex items-center gap-3">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${client.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                                }`}>
                                {client.status}
                            </span>
                            <span className="flex items-center text-sm text-gray-500">
                                <Calendar className="mr-1 h-4 w-4" />
                                {new Date(client.created_at).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ACME Accounts Table */}
            <div className="rounded-lg bg-white shadow">
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                    <div>
                        <h3 className="text-lg font-medium text-gray-900">ACME Accounts</h3>
                        <p className="text-sm text-gray-500">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>

                {accounts.length === 0 ? (
                    <div className="p-12 text-center">
                        <Shield className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-4 text-lg font-medium text-gray-900">No ACME accounts yet</h3>
                        <p className="mt-2 text-gray-500">Create an ACME account to start issuing certificates.</p>
                        <Link
                            href={`/clients/${id}/accounts/new`}
                            className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Create ACME Account
                        </Link>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Account Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Type
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Started At
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Expires At
                                </th>
                                <th className="relative px-6 py-3">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {accounts.map((account) => {
                                const daysRemaining = account.end_date
                                    ? Math.ceil((new Date(account.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                                    : null

                                return (
                                    <tr key={account.id} className="hover:bg-gray-50">
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <Link
                                                href={`/clients/${id}/accounts/${account.id}`}
                                                className="font-medium text-gray-900 hover:text-blue-600"
                                            >
                                                {account.account_name || `Account ${account.id.slice(0, 8)}`}
                                            </Link>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${account.certificate_type === 'DV'
                                                ? 'bg-sky-100 text-sky-700'
                                                : 'bg-violet-100 text-violet-700'
                                                }`}>
                                                {account.certificate_type} Certificate
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${account.status === 'active'
                                                ? 'bg-green-100 text-green-800'
                                                : account.status === 'pending_start'
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : 'bg-red-100 text-red-800'
                                                }`}>
                                                {account.status}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                                            {account.start_date
                                                ? new Date(account.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                                                : <span className="text-gray-400">-</span>
                                            }
                                        </td>
                                        <td className="px-6 py-4">
                                            {account.end_date ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-gray-600">
                                                        {new Date(account.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                    {daysRemaining !== null && daysRemaining < 90 && (
                                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${daysRemaining < 30 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                            {daysRemaining}d
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                                            <Link
                                                href={`/clients/${id}/accounts/${account.id}`}
                                                className="text-blue-600 hover:text-blue-900"
                                            >
                                                Manage
                                            </Link>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
