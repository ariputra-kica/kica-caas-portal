'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Shield, Plus, Globe, Key, Trash2, Filter, ExternalLink, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface AuditLog {
    id: string
    action: string
    target_type: string | null
    target_id: string | null
    details: Record<string, unknown> | null
    ip_address: string | null
    created_at: string
}

// Format action name to human readable
function formatAction(action: string): string {
    const actionMap: Record<string, string> = {
        'reveal_eab_key': 'Revealed EAB Key',
        'add_domain': 'Added Domain',
        'remove_domain': 'Removed Domain',
        'refund_domain': 'Refund Processed',
        'create_client': 'Created Client',
        'create_account': 'Created Account',
        'account_activated': 'Account Activated',
        'account_reactivated': 'Account Reactivated',
        'account_deactivated': 'Account Deactivated',
        'high_risk_refund_pattern': '⚠️ High Risk Alert',
        'login': 'Logged In',
    }
    return actionMap[action] || action.replace(/_/g, ' ')
}

// Format details to human readable
function formatDetails(details: Record<string, unknown> | null): string {
    if (!details) return '-'

    const parts: string[] = []

    if (details.domain_name) {
        parts.push(`Domain: ${details.domain_name}`)
    }
    if (details.price !== undefined) {
        parts.push(`Price: $${details.price}`)
    }
    if (details.refund_amount !== undefined) {
        parts.push(`Refunded: $${details.refund_amount}`)
    }
    if (details.transaction_id) {
        parts.push(`TX: ${(details.transaction_id as string).slice(0, 8)}...`)
    }
    if (details.name) {
        parts.push(`Name: ${details.name}`)
    }
    if (details.reason) {
        parts.push(`Reason: ${details.reason}`)
    }
    if (details.new_status) {
        parts.push(`New Status: ${details.new_status}`)
    }
    if (details.alert_level) {
        parts.push(`⚠️ ${details.alert_level}`)
    }
    if (details.message) {
        parts.push(`${details.message}`)
    }

    return parts.length > 0 ? parts.join(' | ') : '-'
}

const actionColors: Record<string, string> = {
    'reveal_eab_key': 'bg-yellow-100 text-yellow-800',
    'add_domain': 'bg-green-100 text-green-800',
    'remove_domain': 'bg-red-100 text-red-800',
    'refund_domain': 'bg-purple-100 text-purple-800',
    'create_client': 'bg-blue-100 text-blue-800',
    'create_account': 'bg-indigo-100 text-indigo-800',
    'account_activated': 'bg-emerald-100 text-emerald-800',
    'account_reactivated': 'bg-green-100 text-green-800',
    'account_deactivated': 'bg-orange-100 text-orange-800',
    'high_risk_refund_pattern': 'bg-red-100 text-red-800',
    'login': 'bg-gray-100 text-gray-800',
}

const ActionIcon = ({ action }: { action: string }) => {
    switch (action) {
        case 'reveal_eab_key':
            return <Key className="h-4 w-4" />
        case 'add_domain':
            return <Plus className="h-4 w-4" />
        case 'remove_domain':
        case 'refund_domain':
            return <Trash2 className="h-4 w-4" />
        case 'create_client':
        case 'create_account':
            return <Plus className="h-4 w-4" />
        case 'account_activated':
        case 'account_reactivated':
            return <CheckCircle className="h-4 w-4" />
        case 'account_deactivated':
            return <AlertCircle className="h-4 w-4" />
        case 'high_risk_refund_pattern':
            return <AlertTriangle className="h-4 w-4" />
        default:
            return <Shield className="h-4 w-4" />
    }
}

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([])
    const [loading, setLoading] = useState(true)
    const [actionFilter, setActionFilter] = useState<string>('all')
    const supabase = createClient()

    useEffect(() => {
        async function fetchLogs() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('actor_id', user.id)
                .order('created_at', { ascending: false })
                .limit(100)

            if (error) {
                console.error('Error fetching audit logs:', error)
            }
            setLogs(data || [])
            setLoading(false)
        }
        fetchLogs()
    }, [supabase])

    // Get unique action types for filter
    const actionTypes = Array.from(new Set(logs.map(l => l.action)))

    // Filter logs
    const filteredLogs = actionFilter === 'all'
        ? logs
        : logs.filter(l => l.action === actionFilter)

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
                    <p className="text-gray-500">Track all security-sensitive actions</p>
                </div>
                <div className="rounded-lg bg-white p-12 shadow text-center">
                    <div className="animate-pulse">Loading...</div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
                <p className="text-gray-500">Track all security-sensitive actions</p>
            </div>

            {/* Info Banner */}
            <div className="rounded-lg bg-blue-50 p-4">
                <div className="flex items-center">
                    <Shield className="h-5 w-5 text-blue-600" />
                    <p className="ml-3 text-sm text-blue-700">
                        All sensitive actions are logged for security and compliance purposes.
                        Logs are retained for 1 year and cannot be deleted.
                    </p>
                </div>
            </div>

            {/* Filter */}
            {logs.length > 0 && (
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-gray-400" />
                        <select
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            className="rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="all">All Actions ({logs.length})</option>
                            {actionTypes.map(action => (
                                <option key={action} value={action}>
                                    {formatAction(action)} ({logs.filter(l => l.action === action).length})
                                </option>
                            ))}
                        </select>
                    </div>
                    {actionFilter !== 'all' && (
                        <span className="text-sm text-gray-500">
                            Showing {filteredLogs.length} of {logs.length} logs
                        </span>
                    )}
                </div>
            )}

            {/* Audit Logs Table */}
            <div className="overflow-hidden rounded-lg bg-white shadow">
                {filteredLogs.length === 0 ? (
                    <div className="p-12 text-center">
                        <Shield className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-4 text-lg font-medium text-gray-900">
                            {actionFilter !== 'all' ? 'No matching logs' : 'No audit logs yet'}
                        </h3>
                        <p className="mt-2 text-gray-500">
                            {actionFilter !== 'all' ? 'Try a different filter.' : 'Actions will be logged as you use the system.'}
                        </p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Timestamp
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Action
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Target
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Details
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    IP Address
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {filteredLogs.map((log) => {
                                const details = log.details as Record<string, unknown> | null
                                const transactionId = details?.transaction_id as string | undefined

                                return (
                                    <tr key={log.id} className="hover:bg-gray-50">
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                                            {new Date(log.created_at).toLocaleString('id-ID', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${actionColors[log.action] || 'bg-gray-100 text-gray-800'
                                                }`}>
                                                <ActionIcon action={log.action} />
                                                {formatAction(log.action)}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                                            {log.target_type && (
                                                <span className="inline-flex items-center gap-1.5">
                                                    {log.target_type === 'acme_account' && <Shield className="h-4 w-4 text-gray-400" />}
                                                    {log.target_type === 'domain' && <Globe className="h-4 w-4 text-gray-400" />}
                                                    <span className="capitalize">{log.target_type.replace(/_/g, ' ')}</span>
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            <div className="flex items-center gap-2">
                                                <span>{formatDetails(details)}</span>
                                                {transactionId && (
                                                    <Link
                                                        href={`/transactions?highlight=${transactionId}`}
                                                        className="text-blue-600 hover:text-blue-800"
                                                        title="View Transaction"
                                                    >
                                                        <ExternalLink className="h-3 w-3" />
                                                    </Link>
                                                )}
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                                            {log.ip_address || (
                                                <span className="text-gray-400 italic">Not captured</span>
                                            )}
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


