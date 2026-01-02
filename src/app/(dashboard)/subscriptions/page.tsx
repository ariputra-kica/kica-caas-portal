'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { CalendarClock, Search, Shield, Users, Globe, ChevronUp, ChevronDown, Filter, MoreVertical, Copy, ChevronLeft, ChevronRight, X, Download, Eye, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'

interface Subscription {
    id: string
    account_name: string
    certificate_type: 'DV' | 'OV'
    subscription_years: number
    status: 'pending_start' | 'active' | 'suspended' | 'expired' | 'terminated'
    start_date: string | null
    end_date: string | null
    eab_key_id: string
    created_at: string
    // Relations
    client_id: string
    client_name: string
    client_company: string | null
    // Stats
    domain_count: number
}

type SortField = 'account_name' | 'domain_count' | 'created_at' | 'start_date' | 'end_date'
type SortDirection = 'asc' | 'desc'

const ITEMS_PER_PAGE = 10

export default function SubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [sortField, setSortField] = useState<SortField>('end_date')
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc') // Soonest expiring first
    const [currentPage, setCurrentPage] = useState(1)
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)
    const [menuPosition, setMenuPosition] = useState<'bottom' | 'top'>('bottom')
    const [showFilterPanel, setShowFilterPanel] = useState(false)
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [filterCertType, setFilterCertType] = useState<string>('all')
    const [filterYears, setFilterYears] = useState<string>('all')
    const [filterExpiry, setFilterExpiry] = useState<string>('all')
    const menuRef = useRef<HTMLDivElement>(null)
    const filterRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null)
            }
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setShowFilterPanel(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        async function fetchSubscriptions() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Step 1: Get all client IDs for this partner
            const { data: clientsData } = await supabase
                .from('clients')
                .select('id, name, company_name')
                .eq('partner_id', user.id)

            if (!clientsData || clientsData.length === 0) {
                setLoading(false)
                return
            }

            const clientIds = clientsData.map(c => c.id)
            const clientMap = new Map(clientsData.map(c => [c.id, c]))

            // Step 2: Get all ACME accounts for these clients
            const { data, error } = await supabase
                .from('acme_accounts')
                .select(`
                    *,
                    domains(id)
                `)
                .in('client_id', clientIds)
                .order('end_date', { ascending: true, nullsFirst: false })

            if (error) {
                console.error('Error fetching subscriptions:', error)
                setLoading(false)
                return
            }

            // Transform data
            const transformed = (data || []).map(account => {
                const client = clientMap.get(account.client_id)
                const domains = account.domains || []

                return {
                    id: account.id,
                    account_name: account.account_name || 'Unnamed Account',
                    certificate_type: account.certificate_type || 'DV',
                    subscription_years: account.subscription_years || 1,
                    status: account.status || 'pending_start',
                    start_date: account.start_date,
                    end_date: account.end_date,
                    eab_key_id: account.eab_key_id || '',
                    created_at: account.created_at,
                    client_id: account.client_id,
                    client_name: client?.name || 'Unknown',
                    client_company: client?.company_name || null,
                    domain_count: domains.length,
                }
            })

            setSubscriptions(transformed)
            setLoading(false)
        }

        fetchSubscriptions()
    }, [supabase])

    // Calculate summary stats
    const summaryStats = {
        total: subscriptions.length,
        active: subscriptions.filter(s => s.status === 'active').length,
        expiringSoon: subscriptions.filter(s => {
            if (!s.end_date || s.status !== 'active') return false
            const days = Math.ceil((new Date(s.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            return days > 0 && days <= 30
        }).length,
        suspended: subscriptions.filter(s => s.status === 'suspended').length,
    }

    // Handle sorting
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
        setCurrentPage(1)
    }

    // Render sort indicator
    const SortIndicator = ({ field }: { field: SortField }) => {
        if (sortField !== field) {
            return <ChevronUp className="ml-1 h-3 w-3 text-gray-300" />
        }
        return sortDirection === 'asc'
            ? <ChevronUp className="ml-1 h-3 w-3 text-gray-600" />
            : <ChevronDown className="ml-1 h-3 w-3 text-gray-600" />
    }

    // Count active filters
    const activeFilterCount = [
        filterStatus !== 'all',
        filterCertType !== 'all',
        filterYears !== 'all',
        filterExpiry !== 'all'
    ].filter(Boolean).length

    // Clear all filters
    const clearFilters = () => {
        setFilterStatus('all')
        setFilterCertType('all')
        setFilterYears('all')
        setFilterExpiry('all')
        setCurrentPage(1)
    }

    // Export to CSV
    const exportToCSV = () => {
        const headers = ['Account Name', 'Client', 'Certificate Type', 'Domains', 'Status', 'Start Date', 'Expiry Date']
        const rows = filteredSubscriptions.map(s => [
            s.account_name,
            s.client_name,
            s.certificate_type,
            s.domain_count.toString(),
            s.status,
            s.start_date ? new Date(s.start_date).toLocaleDateString() : '-',
            s.end_date ? new Date(s.end_date).toLocaleDateString() : '-'
        ])

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `subscriptions_export_${new Date().toISOString().split('T')[0]}.csv`
        link.click()
    }

    // Filter and sort subscriptions
    const filteredSubscriptions = subscriptions
        .filter(subscription => {
            // Search filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase()
                const matchesSearch = (
                    subscription.account_name?.toLowerCase().includes(term) ||
                    subscription.client_name?.toLowerCase().includes(term) ||
                    subscription.eab_key_id?.toLowerCase().includes(term)
                )
                if (!matchesSearch) return false
            }

            // Status filter
            if (filterStatus !== 'all' && subscription.status !== filterStatus) return false

            // Certificate type filter
            if (filterCertType !== 'all' && subscription.certificate_type !== filterCertType) return false

            // Subscription years filter
            if (filterYears !== 'all' && subscription.subscription_years.toString() !== filterYears) return false

            // Expiry window filter
            if (filterExpiry !== 'all' && subscription.end_date && subscription.status === 'active') {
                const days = Math.ceil((new Date(subscription.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                if (filterExpiry === 'expiring' && !(days > 0 && days <= 30)) return false
                if (filterExpiry === 'healthy' && (days <= 30 || days < 0)) return false
            } else if (filterExpiry !== 'all') {
                return false
            }

            return true
        })
        .sort((a, b) => {
            let comparison = 0
            switch (sortField) {
                case 'account_name':
                    comparison = a.account_name.localeCompare(b.account_name)
                    break
                case 'domain_count':
                    comparison = a.domain_count - b.domain_count
                    break
                case 'created_at':
                    const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0
                    const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0
                    comparison = aCreated - bCreated
                    break
                case 'start_date':
                    const aStart = a.start_date ? new Date(a.start_date).getTime() : 0
                    const bStart = b.start_date ? new Date(b.start_date).getTime() : 0
                    comparison = aStart - bStart
                    break
                case 'end_date':
                    const aEnd = a.end_date ? new Date(a.end_date).getTime() : 0
                    const bEnd = b.end_date ? new Date(b.end_date).getTime() : 0
                    comparison = aEnd - bEnd
                    break
            }
            return sortDirection === 'asc' ? comparison : -comparison
        })

    // Pagination
    const totalPages = Math.ceil(filteredSubscriptions.length / ITEMS_PER_PAGE)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const paginatedSubscriptions = filteredSubscriptions.slice(startIndex, startIndex + ITEMS_PER_PAGE)

    // Copy EAB Key to clipboard
    const copyEabKey = async (eabKeyId: string) => {
        await navigator.clipboard.writeText(eabKeyId)
        setOpenMenuId(null)
    }

    // Get status badge styles
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-[#00d57b]'
            case 'pending_start':
                return 'bg-orange-100 text-[#f26722]'
            case 'suspended':
                return 'bg-red-100 text-[#e53935]'
            case 'expired':
            case 'terminated':
                return 'bg-gray-100 text-gray-600'
            default:
                return 'bg-gray-100 text-gray-600'
        }
    }

    // Get certificate type badge
    const getCertTypeBadge = (type: string) => {
        if (type === 'OV') {
            return { color: 'text-[#f26722]', bg: 'bg-orange-50', label: 'OV' }
        }
        return { color: 'text-[#2d56c2]', bg: 'bg-blue-50', label: 'DV' }
    }

    // Handle opening menu with position detection
    const handleOpenMenu = (subId: string, rowIndex: number) => {
        const isNearBottom = rowIndex >= paginatedSubscriptions.length - 2
        setMenuPosition(isNearBottom ? 'top' : 'bottom')
        setOpenMenuId(openMenuId === subId ? null : subId)
    }

    // Format expiry status
    const getExpiryStatus = (endDate: string | null, status: string) => {
        if (!endDate || status !== 'active') return null
        const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        if (days < 0) return { label: 'Expired', color: 'text-[#e53935]', urgent: true }
        if (days <= 7) return { label: `${days}d`, color: 'text-[#e53935]', urgent: true }
        if (days <= 30) return { label: `${days}d`, color: 'text-[#f26722]', urgent: true }
        return null
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">ACME Subscriptions</h1>
                        <p className="text-gray-500">Manage your ACME Account Subscriptions</p>
                    </div>
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">ACME Subscriptions</h1>
                    <p className="text-gray-500">Manage your ACME Account Subscriptions</p>
                </div>
                <div className="flex items-center gap-3">
                    {subscriptions.length > 0 && (
                        <button
                            onClick={exportToCSV}
                            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            {subscriptions.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                    <button
                        onClick={() => {
                            clearFilters()
                            setSearchTerm('')
                            setCurrentPage(1)
                        }}
                        className="rounded-lg bg-white p-4 shadow border border-transparent hover:border-[#00d57b] hover:shadow-lg transition-all duration-300 cursor-pointer text-left hover:-translate-y-1"
                    >
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-blue-100 p-2">
                                <CalendarClock className="h-5 w-5 text-[#2d56c2]" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Total Subscriptions</p>
                                <p className="text-2xl font-semibold text-gray-900">{summaryStats.total}</p>
                            </div>
                        </div>
                    </button>
                    <button
                        onClick={() => {
                            setFilterStatus('active')
                            setFilterCertType('all')
                            setFilterYears('all')
                            setFilterExpiry('all')
                            setCurrentPage(1)
                        }}
                        className="rounded-lg bg-white p-4 shadow border border-transparent hover:border-[#00d57b] hover:shadow-lg transition-all duration-300 cursor-pointer text-left hover:-translate-y-1"
                    >
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-green-100 p-2">
                                <CheckCircle className="h-5 w-5 text-[#00d57b]" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Active Subscriptions</p>
                                <p className="text-2xl font-semibold text-gray-900">{summaryStats.active}</p>
                            </div>
                        </div>
                    </button>
                    <button
                        onClick={() => {
                            setFilterStatus('all')
                            setFilterCertType('all')
                            setFilterYears('all')
                            setFilterExpiry('expiring')
                            setCurrentPage(1)
                        }}
                        className="rounded-lg bg-white p-4 shadow border border-transparent hover:border-[#00d57b] hover:shadow-lg transition-all duration-300 cursor-pointer text-left hover:-translate-y-1"
                    >
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-orange-100 p-2">
                                <AlertTriangle className="h-5 w-5 text-[#f26722]" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Expiring Soon</p>
                                <p className="text-2xl font-semibold text-gray-900">{summaryStats.expiringSoon}</p>
                            </div>
                        </div>
                    </button>
                    <button
                        onClick={() => {
                            setFilterStatus('suspended')
                            setFilterCertType('all')
                            setFilterYears('all')
                            setFilterExpiry('all')
                            setCurrentPage(1)
                        }}
                        className="rounded-lg bg-white p-4 shadow border border-transparent hover:border-[#00d57b] hover:shadow-lg transition-all duration-300 cursor-pointer text-left hover:-translate-y-1"
                    >
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-red-100 p-2">
                                <XCircle className="h-5 w-5 text-[#e53935]" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Suspended</p>
                                <p className="text-2xl font-semibold text-gray-900">{summaryStats.suspended}</p>
                            </div>
                        </div>
                    </button>
                </div>
            )}

            {/* Search Bar with Filter Button */}
            {subscriptions.length > 0 && (
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by ACME Account Name, Client, or EAB Key ID.."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value)
                                setCurrentPage(1)
                            }}
                            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <div className="relative" ref={filterRef}>
                        <button
                            onClick={() => setShowFilterPanel(!showFilterPanel)}
                            className={`inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium ${activeFilterCount > 0
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <Filter className="mr-2 h-4 w-4" />
                            Filter
                            {activeFilterCount > 0 && (
                                <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {/* Filter Panel */}
                        {showFilterPanel && (
                            <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg bg-white p-4 shadow-lg ring-1 ring-black ring-opacity-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-medium text-gray-900">Filters</h3>
                                    {activeFilterCount > 0 && (
                                        <button
                                            onClick={clearFilters}
                                            className="text-sm text-blue-600 hover:text-blue-800"
                                        >
                                            Clear all
                                        </button>
                                    )}
                                </div>

                                {/* Status Filter */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Status
                                    </label>
                                    <select
                                        value={filterStatus}
                                        onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1) }}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="all">All Status</option>
                                        <option value="active">Active</option>
                                        <option value="pending_start">Pending</option>
                                        <option value="suspended">Suspended</option>
                                        <option value="expired">Expired</option>
                                        <option value="terminated">Terminated</option>
                                    </select>
                                </div>

                                {/* Certificate Type Filter */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Certificate Type
                                    </label>
                                    <select
                                        value={filterCertType}
                                        onChange={(e) => { setFilterCertType(e.target.value); setCurrentPage(1) }}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="all">All Types</option>
                                        <option value="DV">DV</option>
                                        <option value="OV">OV</option>
                                    </select>
                                </div>

                                {/* Subscription Length Filter */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Subscription Length
                                    </label>
                                    <select
                                        value={filterYears}
                                        onChange={(e) => { setFilterYears(e.target.value); setCurrentPage(1) }}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="all">All</option>
                                        <option value="1">1 Year</option>
                                        <option value="2">2 Years</option>
                                        <option value="3">3 Years</option>
                                    </select>
                                </div>

                                {/* Expiry Window Filter */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Expiry Window
                                    </label>
                                    <select
                                        value={filterExpiry}
                                        onChange={(e) => { setFilterExpiry(e.target.value); setCurrentPage(1) }}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="all">All</option>
                                        <option value="expiring">Expiring (&lt; 30 days)</option>
                                        <option value="healthy">Healthy (&gt; 30 days)</option>
                                    </select>
                                </div>

                                <button
                                    onClick={() => setShowFilterPanel(false)}
                                    className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                                >
                                    Apply Filters
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Active Filters Tags */}
            {activeFilterCount > 0 && (
                <div className="flex flex-wrap gap-2">
                    {filterStatus !== 'all' && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
                            Status: {filterStatus}
                            <button onClick={() => { setFilterStatus('all'); setCurrentPage(1) }} className="ml-2 hover:text-blue-600">
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    )}
                    {filterCertType !== 'all' && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
                            Type: {filterCertType}
                            <button onClick={() => { setFilterCertType('all'); setCurrentPage(1) }} className="ml-2 hover:text-blue-600">
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    )}
                    {filterYears !== 'all' && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
                            Length: {filterYears} year(s)
                            <button onClick={() => { setFilterYears('all'); setCurrentPage(1) }} className="ml-2 hover:text-blue-600">
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    )}
                    {filterExpiry !== 'all' && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
                            Expiry: {filterExpiry === 'expiring' ? 'Expiring Soon' : 'Healthy'}
                            <button onClick={() => { setFilterExpiry('all'); setCurrentPage(1) }} className="ml-2 hover:text-blue-600">
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    )}
                </div>
            )}

            {/* Table */}
            <div className="overflow-hidden rounded-lg bg-white shadow">
                {subscriptions.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="mx-auto h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center">
                            <CalendarClock className="h-8 w-8 text-blue-500" />
                        </div>
                        <h3 className="mt-4 text-lg font-medium text-gray-900">No Subscriptions Yet</h3>
                        <p className="mt-2 text-gray-500 max-w-sm mx-auto">
                            Subscriptions will appear here once ACME accounts are created for clients.
                        </p>
                    </div>
                ) : filteredSubscriptions.length === 0 ? (
                    <div className="p-12 text-center">
                        <Search className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-4 text-lg font-medium text-gray-900">No subscriptions found</h3>
                        <p className="mt-2 text-gray-500">
                            {searchTerm
                                ? `No subscriptions match "${searchTerm}". Try a different search term.`
                                : 'No subscriptions match the selected filters.'
                            }
                        </p>
                        <button
                            onClick={() => { setSearchTerm(''); clearFilters() }}
                            className="mt-4 text-sm text-blue-600 hover:text-blue-800"
                        >
                            Clear all filters
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 sticky top-0 z-10">
                                    <tr>
                                        <th
                                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100 bg-gray-50"
                                            onClick={() => handleSort('account_name')}
                                        >
                                            <div className="flex items-center">
                                                ACME Account Name
                                                <SortIndicator field="account_name" />
                                            </div>
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 bg-gray-50">
                                            Client
                                        </th>
                                        <th
                                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100 bg-gray-50"
                                            onClick={() => handleSort('domain_count')}
                                        >
                                            <div className="flex items-center">
                                                Domains
                                                <SortIndicator field="domain_count" />
                                            </div>
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 bg-gray-50">
                                            Status
                                        </th>
                                        <th
                                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100 bg-gray-50"
                                            onClick={() => handleSort('created_at')}
                                        >
                                            <div className="flex items-center">
                                                Created Date
                                                <SortIndicator field="created_at" />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100 bg-gray-50"
                                            onClick={() => handleSort('start_date')}
                                        >
                                            <div className="flex items-center">
                                                Start Date
                                                <SortIndicator field="start_date" />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100 bg-gray-50"
                                            onClick={() => handleSort('end_date')}
                                        >
                                            <div className="flex items-center">
                                                Expiry Date
                                                <SortIndicator field="end_date" />
                                            </div>
                                        </th>
                                        <th className="relative px-6 py-3 bg-gray-50">
                                            <span className="sr-only">Actions</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {paginatedSubscriptions.map((subscription, index) => {
                                        const certTypeBadge = getCertTypeBadge(subscription.certificate_type)
                                        const expiryStatus = getExpiryStatus(subscription.end_date, subscription.status)

                                        return (
                                            <tr
                                                key={subscription.id}
                                                className="hover:bg-gray-50 transition-colors"
                                            >
                                                <td className="whitespace-nowrap px-6 py-4">
                                                    <div className="flex items-center">
                                                        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${certTypeBadge.bg}`}>
                                                            <Shield className={`h-5 w-5 ${certTypeBadge.color}`} />
                                                        </div>
                                                        <div className="ml-3">
                                                            <div className="font-medium text-gray-900">
                                                                <Link
                                                                    href={`/clients/${subscription.client_id}/accounts/${subscription.id}`}
                                                                    className="hover:text-blue-600 transition-colors"
                                                                >
                                                                    {subscription.account_name}
                                                                </Link>
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${certTypeBadge.bg} ${certTypeBadge.color}`}>
                                                                    {certTypeBadge.label} · {subscription.subscription_years}yr
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4">
                                                    <Link
                                                        href={`/clients/${subscription.client_id}`}
                                                        className="text-sm text-gray-900 hover:text-blue-600"
                                                    >
                                                        {subscription.client_name}
                                                    </Link>
                                                    {subscription.client_company && (
                                                        <p className="text-xs text-gray-500">{subscription.client_company}</p>
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4">
                                                    <div className="flex items-center">
                                                        <Globe className="mr-1.5 h-4 w-4 text-gray-400" />
                                                        <span className="font-medium text-gray-900">{subscription.domain_count}</span>
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4">
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadge(subscription.status)}`}>
                                                        {subscription.status === 'pending_start' ? 'Pending' : subscription.status}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                                                    {new Date(subscription.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                                                    {subscription.start_date
                                                        ? new Date(subscription.start_date).toLocaleDateString()
                                                        : '-'
                                                    }
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4 text-sm">
                                                    {subscription.end_date ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-gray-500">
                                                                {new Date(subscription.end_date).toLocaleDateString()}
                                                            </span>
                                                            {expiryStatus && (
                                                                <span className={`text-xs font-medium ${expiryStatus.color}`}>
                                                                    {expiryStatus.label}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                                                    <div className="flex items-center justify-end">
                                                        <div className="relative" ref={openMenuId === subscription.id ? menuRef : null}>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleOpenMenu(subscription.id, index)
                                                                }}
                                                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                                                            >
                                                                <MoreVertical className="h-4 w-4" />
                                                            </button>

                                                            {openMenuId === subscription.id && (
                                                                <div className={`absolute right-0 z-10 w-56 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 ${menuPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
                                                                    }`}>
                                                                    <div className="py-1">
                                                                        <Link
                                                                            href={`/clients/${subscription.client_id}/accounts/${subscription.id}`}
                                                                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                        >
                                                                            <Shield className="mr-3 h-4 w-4 text-gray-400" />
                                                                            Add Domains
                                                                        </Link>
                                                                        <button
                                                                            onClick={() => copyEabKey(subscription.eab_key_id)}
                                                                            className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                        >
                                                                            <Copy className="mr-3 h-4 w-4 text-gray-400" />
                                                                            Copy EAB Key ID
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
                                <div className="flex flex-1 justify-between sm:hidden">
                                    <button
                                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                        disabled={currentPage === 1}
                                        className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                        disabled={currentPage === totalPages}
                                        className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        Next
                                    </button>
                                </div>
                                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-sm text-gray-700">
                                            Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                                            <span className="font-medium">
                                                {Math.min(startIndex + ITEMS_PER_PAGE, filteredSubscriptions.length)}
                                            </span>{' '}
                                            of <span className="font-medium">{filteredSubscriptions.length}</span> results
                                        </p>
                                    </div>
                                    <div>
                                        <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
                                            <button
                                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                                disabled={currentPage === 1}
                                                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                                            >
                                                <ChevronLeft className="h-5 w-5" />
                                            </button>
                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${page === currentPage
                                                        ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                                                        : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {page}
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                                disabled={currentPage === totalPages}
                                                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                                            >
                                                <ChevronRight className="h-5 w-5" />
                                            </button>
                                        </nav>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
