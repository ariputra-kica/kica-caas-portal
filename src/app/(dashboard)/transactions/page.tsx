'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CreditCard, ArrowUpRight, ArrowDownRight, User, Shield, Hash, ExternalLink, Globe, Search, Download } from 'lucide-react'
import Link from 'next/link'

// Generate transaction reference from ID and date
function generateTxRef(id: string, createdAt: string): string {
    const date = new Date(createdAt)
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
    const shortId = id.slice(0, 6).toUpperCase()
    return `TXN-${dateStr}-${shortId}`
}

interface Transaction {
    id: string
    transaction_ref: string | null
    type: string
    description: string
    amount: number
    status: string
    created_at: string
    sectigo_order_number: string | null
    domain_id: string | null
    acme_account_id: string | null
    related_transaction_id: string | null  // Link to original transaction
    domains: { domain_name: string } | null
    acme_accounts: { account_name: string; client_id: string } | null
}

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [clientsMap, setclientsMap] = useState<Record<string, { name: string; company_name: string | null }>>({})
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const searchParams = useSearchParams()
    const filterClientId = searchParams.get('client_id')

    const supabase = createClient()

    useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Get transactions with acme_accounts and domains
            // Use !inner or specify FK to avoid PGRST201 ambiguity error
            const { data: txData, error: txError } = await supabase
                .from('transactions')
                .select(`
                    *,
                    domains!domain_id(domain_name),
                    acme_accounts!acme_account_id(account_name, client_id)
                `)
                .eq('partner_id', user.id)
                .order('created_at', { ascending: false })
                .limit(100)

            console.log('DEBUG Transactions:', { userId: user.id, txData, txError })

            if (txData) {
                setTransactions(txData)

                // Get unique client_ids
                const clientIds = [...new Set(
                    txData.map(t => t.acme_accounts?.client_id).filter(Boolean)
                )]

                if (clientIds.length > 0) {
                    const { data: clients } = await supabase
                        .from('clients')
                        .select('id, name, company_name')
                        .in('id', clientIds)

                    if (clients) {
                        const map = clients.reduce((acc, eu) => {
                            acc[eu.id] = { name: eu.name, company_name: eu.company_name }
                            return acc
                        }, {} as Record<string, { name: string; company_name: string | null }>)
                        setclientsMap(map)
                    }
                }
            }

            setLoading(false)
        }

        fetchData()
    }, [supabase])

    // Filter transactions based on search query
    const filteredTransactions = transactions.filter(tx => {
        // Filter by Client ID if present in URL
        if (filterClientId && tx.acme_accounts?.client_id !== filterClientId) {
            return false
        }

        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return (
            tx.domains?.domain_name?.toLowerCase().includes(query) ||
            tx.description?.toLowerCase().includes(query) ||
            tx.type?.toLowerCase().includes(query) ||
            (tx.transaction_ref || generateTxRef(tx.id, tx.created_at)).toLowerCase().includes(query)
        )
    })

    // Calculate totals (add_domain minus refunds) - ONLY SUCCESS
    const totalAdded = transactions
        .filter(t => t.type === 'add_domain' && t.status === 'success')
        .reduce((sum, t) => sum + (t.amount || 0), 0)

    const totalRefunded = transactions
        .filter(t => t.type === 'refund' && t.status === 'success')
        .reduce((sum, t) => sum + (t.amount || 0), 0)

    const netAmount = totalAdded - totalRefunded

    if (loading) {
        return <div className="flex items-center justify-center p-12">Loading...</div>
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
                <p className="text-gray-500">View all your billing transactions</p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div className="rounded-lg bg-white p-6 shadow">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 rounded-md bg-blue-500 p-3">
                            <CreditCard className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-5">
                            <p className="text-sm text-gray-500">Net This Month</p>
                            <p className="text-2xl font-bold text-gray-900">${netAmount.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-lg bg-white p-6 shadow">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 rounded-md bg-green-500 p-3">
                            <ArrowUpRight className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-5">
                            <p className="text-sm text-gray-500">Domains Added</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {transactions.filter(t => t.type === 'add_domain' && t.status === 'success').length}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="rounded-lg bg-white p-6 shadow">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 rounded-md bg-red-500 p-3">
                            <ArrowDownRight className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-5">
                            <p className="text-sm text-gray-500">Refunds</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {transactions.filter(t => t.type === 'refund').length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search & Export */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by domain, description, or transaction ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    {searchQuery && (
                        <span className="text-sm text-gray-500">
                            {filteredTransactions.length} of {transactions.length} transactions
                        </span>
                    )}
                </div>
                <button
                    onClick={() => {
                        // Export CSV with filter-aware data
                        const headers = ['Transaction ID', 'Date', 'Type', 'Domain', 'Status', 'Sectigo Order', 'Related TX ID', 'Amount']
                        const rows = filteredTransactions.map(tx => [
                            tx.transaction_ref || generateTxRef(tx.id, tx.created_at),
                            new Date(tx.created_at).toISOString().split('T')[0],
                            tx.type,
                            tx.domains?.domain_name || '',
                            tx.status,
                            tx.sectigo_order_number || '',
                            tx.related_transaction_id || '',
                            tx.amount.toFixed(2)
                        ])

                        const csvContent = [headers, ...rows]
                            .map(row => row.map(cell => `"${cell}"`).join(','))
                            .join('\n')

                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
                        const url = URL.createObjectURL(blob)
                        const link = document.createElement('a')
                        link.href = url
                        link.download = `kica-transactions-${new Date().toISOString().split('T')[0]}.csv`
                        link.click()
                        URL.revokeObjectURL(url)
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    <Download className="h-4 w-4" />
                    Export CSV
                </button>
            </div>

            {/* Transactions Table */}
            <div className="overflow-hidden rounded-lg bg-white shadow">
                {filteredTransactions.length === 0 ? (
                    <div className="p-12 text-center">
                        <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-4 text-lg font-medium text-gray-900">
                            {searchQuery ? 'No matching transactions' : 'No transactions yet'}
                        </h3>
                        <p className="mt-2 text-gray-500">
                            {searchQuery ? 'Try a different search term.' : 'Transactions will appear here as you add domains.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Transaction ID
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Date
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Domain
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Client / Account
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Type
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Sectigo Order
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Related To
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Amount
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {filteredTransactions.map((tx) => {
                                    const acmeAccount = tx.acme_accounts
                                    const client = acmeAccount?.client_id
                                        ? clientsMap[acmeAccount.client_id]
                                        : null
                                    const txRef = tx.transaction_ref || generateTxRef(tx.id, tx.created_at)

                                    // Find related transaction reference for display
                                    const relatedTx = tx.related_transaction_id
                                        ? transactions.find(t => t.id === tx.related_transaction_id)
                                        : null
                                    const relatedTxRef = relatedTx
                                        ? (relatedTx.transaction_ref || generateTxRef(relatedTx.id, relatedTx.created_at))
                                        : null

                                    return (
                                        <tr key={tx.id} id={`tx-${tx.id}`} className="hover:bg-gray-50 transition-colors duration-300">
                                            <td className="whitespace-nowrap px-4 py-4">
                                                <div className="flex items-center">
                                                    <Hash className="mr-1.5 h-4 w-4 text-gray-400" />
                                                    <code className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-700">
                                                        {txRef}
                                                    </code>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500">
                                                {new Date(tx.created_at).toLocaleString('id-ID', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </td>
                                            <td className="px-4 py-4">
                                                {tx.domains?.domain_name ? (
                                                    <Link
                                                        href={`/clients/${acmeAccount?.client_id}/accounts/${tx.acme_account_id}`}
                                                        className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
                                                    >
                                                        <Globe className="mr-1.5 h-4 w-4" />
                                                        {tx.domains.domain_name}
                                                    </Link>
                                                ) : (
                                                    <span className="text-sm text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col gap-1">
                                                    {client && (
                                                        <Link
                                                            href={`/clients/${acmeAccount?.client_id}`}
                                                            className="flex items-center text-sm font-medium text-gray-900 hover:text-blue-600"
                                                        >
                                                            <User className="mr-1.5 h-4 w-4 text-gray-400" />
                                                            {client.company_name || client.name}
                                                        </Link>
                                                    )}
                                                    {acmeAccount && (
                                                        <span className="flex items-center text-xs text-gray-500">
                                                            <Shield className="mr-1.5 h-3 w-3 text-gray-400" />
                                                            {acmeAccount.account_name || 'ACME Account'}
                                                        </span>
                                                    )}
                                                    {!client && !acmeAccount && (
                                                        <span className="text-sm text-gray-400">-</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4">
                                                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${tx.type === 'add_domain'
                                                    ? 'bg-green-100 text-green-800'
                                                    : tx.type === 'refund'
                                                        ? 'bg-red-100 text-red-800'
                                                        : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {tx.type === 'add_domain' ? 'Add Domain' : tx.type === 'refund' ? 'Refund' : tx.type}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4">
                                                {tx.sectigo_order_number ? (
                                                    <div className="flex items-center">
                                                        <code className="rounded bg-blue-50 px-2 py-0.5 text-xs font-mono text-blue-700">
                                                            {tx.sectigo_order_number}
                                                        </code>
                                                        <ExternalLink className="ml-1 h-3 w-3 text-gray-400" />
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4">
                                                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${tx.status === 'success'
                                                    ? 'bg-green-100 text-green-800'
                                                    : tx.status === 'pending'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : tx.status === 'refunded'
                                                            ? 'bg-purple-100 text-purple-800'
                                                            : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {tx.status}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4">
                                                {relatedTxRef ? (
                                                    <button
                                                        onClick={() => {
                                                            const row = document.getElementById(`tx-${tx.related_transaction_id}`)
                                                            if (row) {
                                                                row.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                                                row.classList.add('bg-yellow-50')
                                                                setTimeout(() => row.classList.remove('bg-yellow-50'), 2000)
                                                            }
                                                        }}
                                                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                                    >
                                                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                        </svg>
                                                        {relatedTxRef}
                                                    </button>
                                                ) : (
                                                    <span className="text-sm text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-medium">
                                                <span className={tx.type === 'refund' ? 'text-red-600' : 'text-gray-900'}>
                                                    {tx.type === 'refund' ? '-' : ''}${(tx.amount || 0).toFixed(2)}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

