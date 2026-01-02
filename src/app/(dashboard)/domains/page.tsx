'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Globe, Search, Shield, Users, ChevronUp, ChevronDown, Filter, MoreVertical, Copy, ChevronLeft, ChevronRight, X, Download, Eye, Award, Clock, CheckCircle, XCircle, Asterisk } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'

interface Domain {
    id: string
    domain_name: string
    domain_type: 'single' | 'wildcard'
    status: 'active' | 'pending' | 'suspended' | 'inactive'
    validation_status: 'validated' | 'pending' | 'failed'
    created_at: string
    // Relations
    client_id: string
    client_name: string
    client_company: string | null
    acme_account_id: string
    acme_account_status: string
    // Certificate stats
    certificate_count: number
    issuance_date: string | null
    expiry_date: string | null
}

type SortField = 'domain_name' | 'created_at' | 'expiry_date' | 'certificate_count'
type SortDirection = 'asc' | 'desc'

const ITEMS_PER_PAGE = 10

export default function DomainsPage() {
    const [domains, setDomains] = useState<Domain[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [sortField, setSortField] = useState<SortField>('created_at')
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
    const [currentPage, setCurrentPage] = useState(1)
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)
    const [menuPosition, setMenuPosition] = useState<'bottom' | 'top'>('bottom')
    const [showFilterPanel, setShowFilterPanel] = useState(false)
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [filterType, setFilterType] = useState<string>('all')
    const [filterValidation, setFilterValidation] = useState<string>('all')
    const [filterHasCerts, setFilterHasCerts] = useState<string>('all')
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
        async function fetchDomains() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Step 1: Get all client IDs for this partner
            const { data: clientsData } = await supabase
                .from('clients')
                .select('id')
                .eq('partner_id', user.id)

            if (!clientsData || clientsData.length === 0) {
                setLoading(false)
                return
            }

            const clientIds = clientsData.map(c => c.id)

            // Step 2: Get all ACME account IDs for these clients
            const { data: accountsData } = await supabase
                .from('acme_accounts')
                .select('id, status, client_id')
                .in('client_id', clientIds)

            if (!accountsData || accountsData.length === 0) {
                setLoading(false)
                return
            }

            const accountIds = accountsData.map(a => a.id)
            const accountMap = new Map(accountsData.map(a => [a.id, a]))

            // Step 3: Get all clients data for reference
            const { data: clientsFullData } = await supabase
                .from('clients')
                .select('id, name, company_name')
                .in('id', clientIds)

            const clientMap = new Map(clientsFullData?.map(c => [c.id, c]) || [])

            // Step 4: Fetch domains with certificates
            const { data, error } = await supabase
                .from('domains')
                .select(`
                    *,
                    certificates(id, status_code, status_desc, valid_not_before, valid_not_after)
                `)
                .in('acme_account_id', accountIds)
                .order('added_at', { ascending: false })

            if (error) {
                console.error('Error fetching domains:', error)
                setLoading(false)
                return
            }

            // Transform data
            const transformed = (data || []).map(domain => {
                const account = accountMap.get(domain.acme_account_id)
                const client = account ? clientMap.get(account.client_id) : null
                const certs = domain.certificates || []
                // Status code 6 = Valid in Sectigo
                const activeCerts = certs.filter((c: { status_code: number }) => c.status_code === 6)

                // Find earliest issuance and latest expiry
                const issuanceDates = activeCerts
                    .map((c: { valid_not_before: string }) => c.valid_not_before)
                    .filter(Boolean)
                    .sort()
                const expiryDates = activeCerts
                    .map((c: { valid_not_after: string }) => c.valid_not_after)
                    .filter(Boolean)
                    .sort()
                    .reverse()

                return {
                    id: domain.id,
                    domain_name: domain.domain_name,
                    domain_type: domain.domain_type || 'single',
                    status: domain.status || 'active',
                    validation_status: domain.validation_status || 'pending',
                    created_at: domain.added_at || domain.created_at,
                    client_id: client?.id || '',
                    client_name: client?.name || 'Unknown',
                    client_company: client?.company_name || null,
                    acme_account_id: account?.id || '',
                    acme_account_status: account?.status || 'unknown',
                    certificate_count: activeCerts.length,
                    issuance_date: issuanceDates[0] || null,
                    expiry_date: expiryDates[0] || null,
                }
            })

            setDomains(transformed)
            setLoading(false)
        }

        fetchDomains()
    }, [supabase])

    // Calculate summary stats
    const summaryStats = {
        totalDomains: domains.length,
        activeDomains: domains.filter(d => d.status === 'active').length,
        totalCertificates: domains.reduce((sum, d) => sum + d.certificate_count, 0),
        expiringSoon: domains.filter(d => {
            if (!d.expiry_date) return false
            const days = Math.ceil((new Date(d.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            return days > 0 && days <= 30
        }).length,
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
        filterType !== 'all',
        filterValidation !== 'all',
        filterHasCerts !== 'all'
    ].filter(Boolean).length

    // Clear all filters
    const clearFilters = () => {
        setFilterStatus('all')
        setFilterType('all')
        setFilterValidation('all')
        setFilterHasCerts('all')
        setCurrentPage(1)
    }

    // Export to CSV
    const exportToCSV = () => {
        const headers = ['Domain', 'Type', 'Client', 'Status', 'Validation', 'Certificates', 'Issuance Date', 'Expiry Date']
        const rows = filteredDomains.map(d => [
            d.domain_name,
            d.domain_type,
            d.client_name,
            d.status,
            d.validation_status,
            d.certificate_count.toString(),
            d.issuance_date ? new Date(d.issuance_date).toLocaleDateString() : '',
            d.expiry_date ? new Date(d.expiry_date).toLocaleDateString() : ''
        ])

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `domains_export_${new Date().toISOString().split('T')[0]}.csv`
        link.click()
    }

    // Filter and sort domains
    const filteredDomains = domains
        .filter(domain => {
            // Search filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase()
                const matchesSearch = (
                    domain.domain_name?.toLowerCase().includes(term) ||
                    domain.client_name?.toLowerCase().includes(term) ||
                    domain.client_company?.toLowerCase().includes(term)
                )
                if (!matchesSearch) return false
            }

            // Status filter
            if (filterStatus !== 'all' && domain.status !== filterStatus) return false

            // Type filter
            if (filterType !== 'all' && domain.domain_type !== filterType) return false

            // Validation filter
            if (filterValidation !== 'all' && domain.validation_status !== filterValidation) return false

            // Has certificates filter
            if (filterHasCerts === 'with' && domain.certificate_count === 0) return false
            if (filterHasCerts === 'without' && domain.certificate_count > 0) return false

            return true
        })
        .sort((a, b) => {
            let comparison = 0
            switch (sortField) {
                case 'domain_name':
                    comparison = a.domain_name.localeCompare(b.domain_name)
                    break
                case 'created_at':
                    comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    break
                case 'expiry_date':
                    const aExp = a.expiry_date ? new Date(a.expiry_date).getTime() : 0
                    const bExp = b.expiry_date ? new Date(b.expiry_date).getTime() : 0
                    comparison = aExp - bExp
                    break
                case 'certificate_count':
                    comparison = a.certificate_count - b.certificate_count
                    break
            }
            return sortDirection === 'asc' ? comparison : -comparison
        })

    // Pagination
    const totalPages = Math.ceil(filteredDomains.length / ITEMS_PER_PAGE)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const paginatedDomains = filteredDomains.slice(startIndex, startIndex + ITEMS_PER_PAGE)

    // Copy domain to clipboard
    const copyDomain = async (domainName: string) => {
        await navigator.clipboard.writeText(domainName)
        setOpenMenuId(null)
    }

    // Get status badge styles
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-[#00d57b]'
            case 'pending':
                return 'bg-orange-100 text-[#f26722]'
            case 'suspended':
                return 'bg-red-100 text-[#e53935]'
            default:
                return 'bg-gray-100 text-gray-600'
        }
    }

    // Get validation badge
    const getValidationBadge = (status: string) => {
        switch (status) {
            case 'validated':
                return { icon: CheckCircle, color: 'text-[#00d57b]', bg: 'bg-green-50', label: 'Valid' }
            case 'pending':
                return { icon: Clock, color: 'text-[#f26722]', bg: 'bg-orange-50', label: 'Pending' }
            case 'failed':
                return { icon: XCircle, color: 'text-[#e53935]', bg: 'bg-red-50', label: 'Failed' }
            default:
                return { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-50', label: 'Unknown' }
        }
    }

    // Get domain type badge
    const getDomainTypeBadge = (type: string) => {
        if (type === 'wildcard') {
            return { color: 'text-[#f26722]', bg: 'bg-orange-50', label: 'Wildcard' }
        }
        return { color: 'text-[#2d56c2]', bg: 'bg-blue-50', label: 'Single' }
    }

    // Handle opening menu with position detection
    const handleOpenMenu = (domainId: string, rowIndex: number) => {
        const isNearBottom = rowIndex >= paginatedDomains.length - 2
        setMenuPosition(isNearBottom ? 'top' : 'bottom')
        setOpenMenuId(openMenuId === domainId ? null : domainId)
    }

    // Format expiry days
    const getExpiryStatus = (expiryDate: string | null) => {
        if (!expiryDate) return null
        const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
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
                        <h1 className="text-2xl font-bold text-gray-900">Domains</h1>
                        <p className="text-gray-500">Manage your domains and SSL certificates</p>
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
                    <h1 className="text-2xl font-bold text-gray-900">Domains</h1>
                    <p className="text-gray-500">Manage your domains and SSL certificates</p>
                </div>
                <div className="flex items-center gap-3">
                    {domains.length > 0 && (
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
            {domains.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                    <div className="rounded-lg bg-white p-4 shadow">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-blue-100 p-2">
                                <Globe className="h-5 w-5 text-[#2d56c2]" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Total Domains</p>
                                <p className="text-2xl font-semibold text-gray-900">{summaryStats.totalDomains}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-lg bg-white p-4 shadow">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-green-100 p-2">
                                <CheckCircle className="h-5 w-5 text-[#00d57b]" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Active Domains</p>
                                <p className="text-2xl font-semibold text-gray-900">{summaryStats.activeDomains}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-lg bg-white p-4 shadow">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-purple-100 p-2">
                                <Award className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Certificates</p>
                                <p className="text-2xl font-semibold text-gray-900">{summaryStats.totalCertificates}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-lg bg-white p-4 shadow">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-orange-100 p-2">
                                <Clock className="h-5 w-5 text-[#f26722]" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Expiring Soon</p>
                                <p className="text-2xl font-semibold text-gray-900">{summaryStats.expiringSoon}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Search Bar with Filter Button */}
            {domains.length > 0 && (
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by domain or client name..."
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
                                        <option value="pending">Pending</option>
                                        <option value="suspended">Suspended</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>

                                {/* Type Filter */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Domain Type
                                    </label>
                                    <select
                                        value={filterType}
                                        onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1) }}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="all">All Types</option>
                                        <option value="single">Single</option>
                                        <option value="wildcard">Wildcard</option>
                                    </select>
                                </div>

                                {/* Validation Filter */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Validation
                                    </label>
                                    <select
                                        value={filterValidation}
                                        onChange={(e) => { setFilterValidation(e.target.value); setCurrentPage(1) }}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="all">All Validation</option>
                                        <option value="validated">Validated</option>
                                        <option value="pending">Pending</option>
                                        <option value="failed">Failed</option>
                                    </select>
                                </div>

                                {/* Has Certificates Filter */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Certificates
                                    </label>
                                    <select
                                        value={filterHasCerts}
                                        onChange={(e) => { setFilterHasCerts(e.target.value); setCurrentPage(1) }}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="all">All Domains</option>
                                        <option value="with">With Certificates</option>
                                        <option value="without">Without Certificates</option>
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
                    {filterType !== 'all' && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
                            Type: {filterType}
                            <button onClick={() => { setFilterType('all'); setCurrentPage(1) }} className="ml-2 hover:text-blue-600">
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    )}
                    {filterValidation !== 'all' && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
                            Validation: {filterValidation}
                            <button onClick={() => { setFilterValidation('all'); setCurrentPage(1) }} className="ml-2 hover:text-blue-600">
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    )}
                    {filterHasCerts !== 'all' && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
                            {filterHasCerts === 'with' ? 'Has Certificates' : 'No Certificates'}
                            <button onClick={() => { setFilterHasCerts('all'); setCurrentPage(1) }} className="ml-2 hover:text-blue-600">
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    )}
                </div>
            )}

            {/* Table */}
            <div className="overflow-hidden rounded-lg bg-white shadow">
                {domains.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="mx-auto h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center">
                            <Globe className="h-8 w-8 text-blue-500" />
                        </div>
                        <h3 className="mt-4 text-lg font-medium text-gray-900">No Domains Yet</h3>
                        <p className="mt-2 text-gray-500 max-w-sm mx-auto">
                            Domains will appear here once added through ACME accounts.
                        </p>
                    </div>
                ) : filteredDomains.length === 0 ? (
                    <div className="p-12 text-center">
                        <Search className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-4 text-lg font-medium text-gray-900">No domains found</h3>
                        <p className="mt-2 text-gray-500">
                            {searchTerm
                                ? `No domains match "${searchTerm}". Try a different search term.`
                                : 'No domains match the selected filters.'
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
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100 bg-gray-50"
                                        onClick={() => handleSort('domain_name')}
                                    >
                                        <div className="flex items-center">
                                            Domain
                                            <SortIndicator field="domain_name" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 bg-gray-50">
                                        Type
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 bg-gray-50">
                                        Client
                                    </th>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100 bg-gray-50"
                                        onClick={() => handleSort('certificate_count')}
                                    >
                                        <div className="flex items-center">
                                            Certificates
                                            <SortIndicator field="certificate_count" />
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
                                            Created
                                            <SortIndicator field="created_at" />
                                        </div>
                                    </th>
                                    <th className="relative px-6 py-3 bg-gray-50">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {paginatedDomains.map((domain, index) => {
                                    const typeBadge = getDomainTypeBadge(domain.domain_type)
                                    const validationBadge = getValidationBadge(domain.validation_status)
                                    const ValidationIcon = validationBadge.icon
                                    const expiryStatus = getExpiryStatus(domain.expiry_date)

                                    return (
                                        <tr
                                            key={domain.id}
                                            className="hover:bg-gray-50 transition-colors"
                                        >
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <div className="flex items-center">
                                                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${typeBadge.bg}`}>
                                                        {domain.domain_type === 'wildcard' ? (
                                                            <Asterisk className={`h-5 w-5 ${typeBadge.color}`} />
                                                        ) : (
                                                            <Globe className={`h-5 w-5 ${typeBadge.color}`} />
                                                        )}
                                                    </div>
                                                    <div className="ml-3">
                                                        <div className="font-medium text-gray-900">
                                                            {domain.domain_name}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeBadge.bg} ${typeBadge.color}`}>
                                                    {typeBadge.label}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <Link
                                                    href={`/clients/${domain.client_id}`}
                                                    className="text-sm text-gray-900 hover:text-blue-600"
                                                >
                                                    {domain.client_name}
                                                </Link>
                                                {domain.client_company && (
                                                    <p className="text-xs text-gray-500">{domain.client_company}</p>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <div className="flex items-center">
                                                    <Award className="mr-1.5 h-4 w-4 text-gray-400" />
                                                    <span className="font-medium text-gray-900">{domain.certificate_count}</span>
                                                    <span className="ml-1 text-gray-500 text-sm">active</span>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadge(domain.status)}`}>
                                                    {domain.status}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                                                {new Date(domain.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                                                <div className="flex items-center justify-end">
                                                    <div className="relative" ref={openMenuId === domain.id ? menuRef : null}>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleOpenMenu(domain.id, index)
                                                            }}
                                                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                                                        >
                                                            <MoreVertical className="h-4 w-4" />
                                                        </button>

                                                        {openMenuId === domain.id && (
                                                            <div className={`absolute right-0 z-10 w-48 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 ${menuPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
                                                                }`}>
                                                                <div className="py-1">
                                                                    <Link
                                                                        href={`/certificates?domain=${domain.id}`}
                                                                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                    >
                                                                        <Eye className="mr-3 h-4 w-4 text-gray-400" />
                                                                        View Certificates
                                                                    </Link>
                                                                    <Link
                                                                        href={`/clients/${domain.client_id}`}
                                                                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                    >
                                                                        <Users className="mr-3 h-4 w-4 text-gray-400" />
                                                                        View Client
                                                                    </Link>
                                                                    <Link
                                                                        href={`/clients/${domain.client_id}/accounts/${domain.acme_account_id}`}
                                                                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                    >
                                                                        <Shield className="mr-3 h-4 w-4 text-gray-400" />
                                                                        View ACME Account
                                                                    </Link>
                                                                    <button
                                                                        onClick={() => copyDomain(domain.domain_name)}
                                                                        className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                    >
                                                                        <Copy className="mr-3 h-4 w-4 text-gray-400" />
                                                                        Copy Domain
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
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
                        <div className="text-sm text-gray-500">
                            Showing {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredDomains.length)} of {filteredDomains.length} domains
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <span className="text-sm text-gray-700">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
