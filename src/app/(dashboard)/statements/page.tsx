'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, AlertCircle, CheckCircle2, Clock, Download, Search, ChevronDown, X, Hash, Calendar, DollarSign } from 'lucide-react'

interface Settlement {
    id: string
    period_start: string
    period_end: string
    total_amount: number
    status: string
    confirmed_at: string | null
    escalated_at: string | null
    invoiced_at: string | null
    invoice_number: string | null
    discrepancy_note: string | null
    admin_resolution_note: string | null
    created_at: string
    partner_id: string
}

interface Transaction {
    id: string
    type: string
    description: string
    amount: number
    status: string
    created_at: string
    domains: { domain_name: string } | null
    acme_accounts: { account_name: string; end_date: string | null } | null
}

// Format period as "November 2024"
function formatPeriod(periodStart: string): string {
    const date = new Date(periodStart)
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// Generate transaction reference from ID and date
function generateTxRef(id: string, createdAt: string): string {
    const date = new Date(createdAt)
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
    const shortId = id.slice(0, 6).toUpperCase()
    return `TXN-${dateStr}-${shortId}`
}

export default function StatementsPage() {
    const [settlements, setSettlements] = useState<Settlement[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null)
    const [settlementTransactions, setSettlementTransactions] = useState<Transaction[]>([])
    const [showModal, setShowModal] = useState(false)
    const [modalLoading, setModalLoading] = useState(false)
    const [discrepancyNote, setDiscrepancyNote] = useState('')
    const [showDiscrepancyForm, setShowDiscrepancyForm] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)

    const supabase = createClient()

    // Import Server Action
    const { confirmSettlementAction } = require('@/app/actions/settlements')

    // Calculate current month usage
    const [currentMonthUsage, setCurrentMonthUsage] = useState(0)
    const [unpaidCount, setUnpaidCount] = useState(0)
    const [unpaidTotal, setUnpaidTotal] = useState(0)

    useEffect(() => {
        fetchSettlements()
        fetchCurrentMonthUsage()
    }, [])

    async function fetchSettlements() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
            .from('settlements')
            .select('*')
            .eq('partner_id', user.id)
            .order('period_start', { ascending: false })

        if (data) {
            setSettlements(data)
            // Count unpaid (not 'paid' status)
            const unpaid = data.filter(s => s.status !== 'paid')
            setUnpaidCount(unpaid.length)
            setUnpaidTotal(unpaid.reduce((sum, s) => sum + (s.total_amount || 0), 0))
        }
        setLoading(false)
    }

    async function fetchCurrentMonthUsage() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const now = new Date()
        const billingCycleStart = new Date(now.getFullYear(), now.getMonth(), 1)

        const { data: transactions } = await supabase
            .from('transactions')
            .select('type, amount')
            .eq('partner_id', user.id)
            .in('status', ['success', 'pending_api'])
            .gte('created_at', billingCycleStart.toISOString())

        if (transactions) {
            const usage = transactions.reduce((sum, tx) => {
                if (tx.type === 'add_domain') return sum + (tx.amount || 0)
                if (tx.type === 'refund') return sum - (tx.amount || 0)
                return sum
            }, 0)
            setCurrentMonthUsage(usage)
        }
    }

    async function openSettlementDetail(settlement: Settlement) {
        setSelectedSettlement(settlement)
        setShowModal(true)
        setModalLoading(true)
        setShowDiscrepancyForm(false)
        setDiscrepancyNote('')

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Fetch transactions for this settlement period
        const { data } = await supabase
            .from('transactions')
            .select(`
                *,
                domains!domain_id(domain_name),
                acme_accounts!acme_account_id(account_name, end_date)
            `)
            .eq('partner_id', user.id)
            .gte('created_at', settlement.period_start)
            .lte('created_at', new Date(new Date(settlement.period_end).getTime() + 86400000).toISOString()) // Add 1 day to include end date
            .eq('status', 'success')
            .order('created_at', { ascending: false })

        setSettlementTransactions(data || [])
        setModalLoading(false)
    }

    async function confirmSettlement() {
        if (!selectedSettlement) return
        setActionLoading(true)

        // Use Server Action to bypass RLS
        const result = await confirmSettlementAction(selectedSettlement.id)

        if (result.success) {
            setShowModal(false)
            fetchSettlements()
        } else {
            console.error('Confirmation failed:', result.error)
            alert('Failed to confirm settlement: ' + result.error)
        }
        setActionLoading(false)
    }

    async function reportDiscrepancy() {
        if (!selectedSettlement || !discrepancyNote.trim()) return
        setActionLoading(true)

        const { error } = await supabase
            .from('settlements')
            .update({
                status: 'escalated',
                discrepancy_note: discrepancyNote,
                escalated_at: new Date().toISOString()
            })
            .eq('id', selectedSettlement.id)

        if (!error) {
            setShowModal(false)
            fetchSettlements()
        }
        setActionLoading(false)
    }

    // Filter settlements by status
    const filteredSettlements = settlements.filter(s => {
        if (statusFilter === 'all') return true
        return s.status === statusFilter
    })

    // Get status badge styling
    function getStatusBadge(status: string) {
        switch (status) {
            case 'draft':
                return { bg: 'bg-orange-100', text: 'text-[#f57c14]', label: 'Draft' }
            case 'escalated':
                return { bg: 'bg-red-100', text: 'text-[#e83131]', label: 'Escalated' }
            case 'confirmed':
                return { bg: 'bg-blue-100', text: 'text-[#2d56c2]', label: 'Confirmed' }
            case 'invoiced':
                return { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Invoiced' }
            case 'paid':
                return { bg: 'bg-green-100', text: 'text-[#00d57b]', label: 'Paid' }
            default:
                return { bg: 'bg-gray-100', text: 'text-gray-700', label: status }
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center p-12">Loading...</div>
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Statements</h1>
                <p className="text-gray-500">Monthly billing settlements and invoices</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="rounded-lg bg-white p-6 shadow">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 rounded-md bg-blue-500 p-3">
                            <DollarSign className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-5">
                            <p className="text-sm text-gray-500">Current Month Usage</p>
                            <p className="text-2xl font-bold text-gray-900">${currentMonthUsage.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-lg bg-white p-6 shadow">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 rounded-md bg-orange-500 p-3">
                            <FileText className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-5">
                            <p className="text-sm text-gray-500">Unpaid Invoices</p>
                            <p className="text-2xl font-bold text-gray-900">{unpaidCount} (${unpaidTotal.toFixed(2)})</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-4 pr-10 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                        <option value="all">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="escalated">Escalated</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="invoiced">Invoiced</option>
                        <option value="paid">Paid</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                {statusFilter !== 'all' && (
                    <span className="text-sm text-gray-500">
                        {filteredSettlements.length} of {settlements.length} statements
                    </span>
                )}
            </div>

            {/* Settlements Table */}
            <div className="overflow-hidden rounded-lg bg-white shadow">
                {filteredSettlements.length === 0 ? (
                    <div className="p-12 text-center">
                        <FileText className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-4 text-lg font-medium text-gray-900">
                            {statusFilter !== 'all' ? 'No matching statements' : 'No statements yet'}
                        </h3>
                        <p className="mt-2 text-gray-500">
                            {statusFilter !== 'all' ? 'Try a different filter.' : 'Monthly statements will appear here at the end of each billing cycle.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Period</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Total Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Invoice #</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Created</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {filteredSettlements.map((settlement) => {
                                    const badge = getStatusBadge(settlement.status)
                                    return (
                                        <tr key={settlement.id} className="hover:bg-gray-50">
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <div className="flex items-center">
                                                    <Calendar className="mr-2 h-4 w-4 text-gray-400" />
                                                    <span className="font-medium text-gray-900">{formatPeriod(settlement.period_start)}</span>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge.bg} ${badge.text}`}>
                                                    {badge.label}
                                                </span>
                                                {settlement.admin_resolution_note && (
                                                    <span className="ml-2 text-xs text-blue-600">(Updated)</span>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <span className="text-lg font-semibold text-gray-900">${(settlement.total_amount || 0).toFixed(2)}</span>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                                                {settlement.invoice_number || '-'}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                                                {new Date(settlement.created_at).toLocaleDateString('id-ID', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-right">
                                                <button
                                                    onClick={() => openSettlementDetail(settlement)}
                                                    className="text-sm font-medium text-[#2d56c2] hover:text-blue-800"
                                                >
                                                    View Details
                                                </button>
                                                {settlement.status === 'invoiced' && (
                                                    <button className="ml-4 text-sm font-medium text-gray-600 hover:text-gray-800">
                                                        <Download className="inline h-4 w-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Settlement Detail Modal */}
            {showModal && selectedSettlement && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-screen items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
                        <div className="relative w-full max-w-4xl rounded-lg bg-white shadow-xl">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between border-b p-6">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">
                                        Statement: {formatPeriod(selectedSettlement.period_start)}
                                    </h2>
                                    <p className="mt-1 text-sm text-gray-500">
                                        {new Date(selectedSettlement.period_start).toLocaleDateString()} - {new Date(selectedSettlement.period_end).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    {(() => {
                                        const badge = getStatusBadge(selectedSettlement.status)
                                        return (
                                            <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${badge.bg} ${badge.text}`}>
                                                {badge.label}
                                            </span>
                                        )
                                    })()}
                                    <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                            </div>

                            {/* Admin Resolution Note (if exists) */}
                            {selectedSettlement.admin_resolution_note && (
                                <div className="mx-6 mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                                    <p className="text-sm font-medium text-blue-800">Admin Resolution:</p>
                                    <p className="mt-1 text-sm text-blue-700">{selectedSettlement.admin_resolution_note}</p>
                                </div>
                            )}

                            {/* Modal Body - Transactions Table */}
                            <div className="max-h-96 overflow-y-auto p-6">
                                {modalLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <span className="text-gray-500">Loading transactions...</span>
                                    </div>
                                ) : settlementTransactions.length === 0 ? (
                                    <div className="py-12 text-center text-gray-500">
                                        No transactions in this period
                                    </div>
                                ) : (
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Transaction ID</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Domain</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">ACME Account</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Expiry</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {settlementTransactions.map((tx: any) => {
                                                const domain = Array.isArray(tx.domains) ? tx.domains[0] : tx.domains
                                                const account = Array.isArray(tx.acme_accounts) ? tx.acme_accounts[0] : tx.acme_accounts
                                                return (
                                                    <tr key={tx.id}>
                                                        <td className="whitespace-nowrap px-4 py-2">
                                                            <code className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-700">
                                                                {generateTxRef(tx.id, tx.created_at)}
                                                            </code>
                                                        </td>
                                                        <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                                                            {new Date(tx.created_at).toLocaleDateString('id-ID', {
                                                                month: 'short',
                                                                day: 'numeric'
                                                            })}
                                                        </td>
                                                        <td className="px-4 py-2 text-sm text-gray-900">
                                                            {domain?.domain_name || '-'}
                                                        </td>
                                                        <td className="px-4 py-2 text-sm text-gray-500">
                                                            {account?.account_name || '-'}
                                                        </td>
                                                        <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                                                            {account?.end_date
                                                                ? new Date(account.end_date).toLocaleDateString('id-ID', {
                                                                    year: 'numeric',
                                                                    month: 'short',
                                                                    day: 'numeric'
                                                                })
                                                                : '-'
                                                            }
                                                        </td>
                                                        <td className="whitespace-nowrap px-4 py-2 text-right text-sm font-medium">
                                                            <span className={tx.type === 'refund' ? 'text-[#00d57b]' : 'text-gray-900'}>
                                                                {tx.type === 'refund' ? '+' : '-'}${(tx.amount || 0).toFixed(2)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Summary Footer */}
                            <div className="border-t bg-gray-50 px-6 py-4">
                                <div className="flex justify-end">
                                    <div className="text-right">
                                        <p className="text-sm text-gray-500">Total Amount</p>
                                        <p className="text-2xl font-bold text-gray-900">${(selectedSettlement.total_amount || 0).toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Actions */}
                            {selectedSettlement.status === 'draft' && (
                                <div className="border-t p-6">
                                    {!showDiscrepancyForm ? (
                                        <div className="flex justify-end gap-3">
                                            <button
                                                onClick={() => setShowDiscrepancyForm(true)}
                                                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-[#e83131] hover:bg-red-50"
                                            >
                                                Report Discrepancy
                                            </button>
                                            <button
                                                onClick={confirmSettlement}
                                                disabled={actionLoading}
                                                className="rounded-lg bg-[#00d57b] px-6 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
                                            >
                                                {actionLoading ? 'Processing...' : 'Confirm Settlement'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">
                                                    Describe the discrepancy:
                                                </label>
                                                <textarea
                                                    value={discrepancyNote}
                                                    onChange={(e) => setDiscrepancyNote(e.target.value)}
                                                    rows={3}
                                                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                                                    placeholder="Please describe what you believe is incorrect in this settlement..."
                                                />
                                            </div>
                                            <div className="flex justify-end gap-3">
                                                <button
                                                    onClick={() => setShowDiscrepancyForm(false)}
                                                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={reportDiscrepancy}
                                                    disabled={actionLoading || !discrepancyNote.trim()}
                                                    className="rounded-lg bg-[#e83131] px-6 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                                >
                                                    {actionLoading ? 'Submitting...' : 'Submit Discrepancy Report'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Invoiced - Download Button */}
                            {selectedSettlement.status === 'invoiced' && (
                                <div className="border-t p-6">
                                    <div className="flex justify-end">
                                        <button className="inline-flex items-center gap-2 rounded-lg bg-[#2d56c2] px-6 py-2 text-sm font-medium text-white hover:bg-blue-700">
                                            <Download className="h-4 w-4" />
                                            Download Invoice
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Escalated - Waiting for admin */}
                            {selectedSettlement.status === 'escalated' && (
                                <div className="border-t p-6">
                                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                                        <div className="flex items-center gap-2">
                                            <AlertCircle className="h-5 w-5 text-[#f57c14]" />
                                            <p className="text-sm font-medium text-[#f57c14]">Discrepancy Under Review</p>
                                        </div>
                                        <p className="mt-2 text-sm text-gray-600">
                                            Your discrepancy report is being reviewed by our team. You will be notified once resolved.
                                        </p>
                                        {selectedSettlement.discrepancy_note && (
                                            <p className="mt-2 text-sm text-gray-500">
                                                <strong>Your note:</strong> {selectedSettlement.discrepancy_note}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
