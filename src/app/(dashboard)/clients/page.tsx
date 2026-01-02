'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, User, Building2, Mail, Search, Shield, Users, Globe, ChevronUp, ChevronDown, Filter, MoreVertical, Pencil, FileText, Copy, ChevronLeft, ChevronRight, X, Download, Eye, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'

interface Client {
    id: string
    name: string
    company_name: string | null
    email: string | null
    client_type: 'organization' | 'personal'
    status: string
    created_at: string
    ov_anchor_number: string | null
    // ACME Account stats
    acme_total: number
    acme_active: number
    acme_suspended: number
    acme_inactive: number
    // Domain stats
    domain_active: number
    domain_total: number
    domain_wildcard: number
}

type SortField = 'name' | 'created_at' | 'domain_active'
type SortDirection = 'asc' | 'desc'

const ITEMS_PER_PAGE = 10

export default function ClientsPage() {
    const [clients, setClients] = useState<Client[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [sortField, setSortField] = useState<SortField>('created_at')
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
    const [currentPage, setCurrentPage] = useState(1)
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)
    const [menuPosition, setMenuPosition] = useState<'bottom' | 'top'>('bottom')
    const [showFilterPanel, setShowFilterPanel] = useState(false)
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [filterHasDomains, setFilterHasDomains] = useState<string>('all')
    const [filterType, setFilterType] = useState<'all' | 'personal' | 'organization'>('all')
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
        async function fetchClients() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Fetch clients with ACME accounts, domains, and organization anchors
            const { data, error } = await supabase
                .from('clients')
                .select(`
                    *,
                    acme_accounts(
                        id,
                        status,
                        domains(id, status, domain_type)
                    ),
                    organization_anchors(
                        id,
                        ov_anchor_order_number,
                        is_active,
                        expires_at
                    )
                `)
                .eq('partner_id', user.id)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error fetching clients:', error)
                setLoading(false)
                return
            }

            // Transform data to include stats
            const transformed = (data || []).map(client => {
                const accounts = client.acme_accounts || []
                const acmeActive = accounts.filter((a: { status: string }) => a.status === 'active').length
                const acmeSuspended = accounts.filter((a: { status: string }) => a.status === 'suspended').length
                const acmeInactive = accounts.filter((a: { status: string }) => a.status === 'inactive').length

                // Flatten all domains from all accounts
                const allDomains = accounts.flatMap((a: { domains: Array<{ status: string; domain_type: string }> }) => a.domains || [])
                const activeDomains = allDomains.filter((d: { status: string }) => d.status === 'active')
                const wildcardDomains = activeDomains.filter((d: { domain_type: string }) => d.domain_type === 'wildcard')

                // Get active anchor for OV Pre-Validation
                const anchors = client.organization_anchors || []
                const activeAnchor = anchors.find((a: { is_active: boolean }) => a.is_active)

                return {
                    ...client,
                    acme_total: accounts.length,
                    acme_active: acmeActive,
                    acme_suspended: acmeSuspended,
                    acme_inactive: acmeInactive,
                    domain_active: activeDomains.length,
                    domain_total: allDomains.length,
                    domain_wildcard: wildcardDomains.length,
                    ov_anchor_number: activeAnchor?.ov_anchor_order_number || null,
                }
            })

            setClients(transformed)
            setLoading(false)
        }

        fetchClients()
    }, [supabase])

    // Calculate summary stats
    const summaryStats = {
        totalClients: clients.length,
        personalCount: clients.filter(c => !c.company_name).length,
        organizationCount: clients.filter(c => c.company_name).length,
        totalAccounts: clients.reduce((sum, c) => sum + c.acme_total, 0),
        totalDomains: clients.reduce((sum, c) => sum + c.domain_total, 0),
    }

    // Handle sorting
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
        setCurrentPage(1) // Reset to first page on sort
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

    // Get initials from name
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 2)
    }

    // Count active filters
    const activeFilterCount = [
        filterStatus !== 'all',
        filterHasDomains !== 'all',
        filterType !== 'all'
    ].filter(Boolean).length

    // Clear all filters
    const clearFilters = () => {
        setFilterStatus('all')
        setFilterHasDomains('all')
        setFilterType('all')
        setCurrentPage(1)
    }

    // Export to CSV
    const exportToCSV = () => {
        const headers = ['Name', 'Email', 'Organization', 'ACME Accounts', 'Active Domains', 'Status', 'Created']
        const rows = filteredClients.map(client => [
            client.name,
            client.email || '',
            client.company_name || 'Personal Account',
            client.acme_total.toString(),
            client.domain_active.toString(),
            client.status,
            new Date(client.created_at).toLocaleDateString()
        ])

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `clients_export_${new Date().toISOString().split('T')[0]}.csv`
        link.click()
    }

    // Filter and sort clients
    const filteredClients = clients
        .filter(client => {
            // Search filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase()
                const matchesSearch = (
                    client.name?.toLowerCase().includes(term) ||
                    client.company_name?.toLowerCase().includes(term) ||
                    client.email?.toLowerCase().includes(term)
                )
                if (!matchesSearch) return false
            }

            // Status filter
            if (filterStatus !== 'all' && client.status !== filterStatus) {
                return false
            }

            // Has domains filter
            if (filterHasDomains === 'with' && client.domain_active === 0) {
                return false
            }
            if (filterHasDomains === 'without' && client.domain_active > 0) {
                return false
            }

            // Client Type filter
            if (filterType !== 'all' && client.client_type !== filterType) {
                return false
            }

            return true
        })
        .sort((a, b) => {
            let comparison = 0
            switch (sortField) {
                case 'name':
                    comparison = a.name.localeCompare(b.name)
                    break
                case 'created_at':
                    comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    break
                case 'domain_active':
                    comparison = a.domain_active - b.domain_active
                    break
            }
            return sortDirection === 'asc' ? comparison : -comparison
        })

    // Pagination
    const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const paginatedClients = filteredClients.slice(startIndex, startIndex + ITEMS_PER_PAGE)

    // Copy email to clipboard
    const copyEmail = async (email: string) => {
        await navigator.clipboard.writeText(email)
        setOpenMenuId(null)
    }

    // Get status badge styles
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-[#00d57b]'
            case 'suspended':
                return 'bg-amber-100 text-amber-700'
            case 'terminated':
                return 'bg-red-100 text-red-700'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    // Handle opening menu with position detection
    const handleOpenMenu = (clientId: string, rowIndex: number) => {
        const isNearBottom = rowIndex >= paginatedClients.length - 2
        setMenuPosition(isNearBottom ? 'top' : 'bottom')
        setOpenMenuId(openMenuId === clientId ? null : clientId)
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
                        <p className="text-gray-500">Manage your clients and their ACME accounts</p>
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
                    <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
                    <p className="text-gray-500">Manage your clients and their ACME accounts</p>
                </div>
                <div className="flex items-center gap-3">
                    {clients.length > 0 && (
                        <button
                            onClick={exportToCSV}
                            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </button>
                    )}
                    <Link
                        href="/clients/new"
                        className="inline-flex items-center rounded-lg bg-[#2d56c2] px-4 py-2 text-sm font-medium text-white hover:bg-[#254aa8]"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Client
                    </Link>
                </div>
            </div>

            {/* Summary Cards */}
            {clients.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <button
                        onClick={() => {
                            clearFilters()
                            setSearchTerm('')
                        }}
                        className="rounded-lg bg-white p-4 shadow border border-transparent hover:border-[#00d57b] hover:shadow-lg transition-all duration-300 cursor-pointer text-left hover:-translate-y-1"
                    >
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-blue-100 p-2">
                                <Users className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Total Clients</p>
                                <p className="text-2xl font-semibold text-gray-900">{summaryStats.totalClients}</p>
                            </div>
                        </div>
                    </button>
                    <button
                        onClick={() => {
                            setFilterType('organization')
                            setFilterStatus('all')
                            setFilterHasDomains('all')
                            setCurrentPage(1)
                        }}
                        className="rounded-lg bg-white p-4 shadow border border-transparent hover:border-[#00d57b] hover:shadow-lg transition-all duration-300 cursor-pointer text-left hover:-translate-y-1"
                    >
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-indigo-100 p-2">
                                <Building2 className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Organization</p>
                                <p className="text-2xl font-semibold text-gray-900">{summaryStats.organizationCount}</p>
                            </div>
                        </div>
                    </button>
                    <button
                        onClick={() => {
                            setFilterType('personal')
                            setFilterStatus('all')
                            setFilterHasDomains('all')
                            setCurrentPage(1)
                        }}
                        className="rounded-lg bg-white p-4 shadow border border-transparent hover:border-[#00d57b] hover:shadow-lg transition-all duration-300 cursor-pointer text-left hover:-translate-y-1"
                    >
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-purple-100 p-2">
                                <User className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Personal Account</p>
                                <p className="text-2xl font-semibold text-gray-900">{summaryStats.personalCount}</p>
                            </div>
                        </div>
                    </button>
                </div>
            )}

            {/* Search Bar with Filter Button */}
            {clients.length > 0 && (
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, company, or email..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value)
                                setCurrentPage(1) // Reset to first page on search
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
                                        onChange={(e) => {
                                            setFilterStatus(e.target.value)
                                            setCurrentPage(1)
                                        }}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="all">All Status</option>
                                        <option value="active">Active</option>
                                        <option value="suspended">Suspended</option>
                                        <option value="terminated">Terminated</option>
                                    </select>
                                </div>

                                {/* Has Domains Filter */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Active Domains
                                    </label>
                                    <select
                                        value={filterHasDomains}
                                        onChange={(e) => {
                                            setFilterHasDomains(e.target.value)
                                            setCurrentPage(1)
                                        }}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="all">All Clients</option>
                                        <option value="with">With Active Domains</option>
                                        <option value="without">Without Active Domains</option>
                                    </select>
                                </div>

                                {/* Client Type Filter */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Client Type
                                    </label>
                                    <select
                                        value={filterType}
                                        onChange={(e) => {
                                            setFilterType(e.target.value as 'all' | 'personal' | 'organization')
                                            setCurrentPage(1)
                                        }}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="all">All Types</option>
                                        <option value="personal">Personal Account</option>
                                        <option value="organization">Organization</option>
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
                            <button
                                onClick={() => { setFilterStatus('all'); setCurrentPage(1) }}
                                className="ml-2 hover:text-blue-600"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    )}
                    {filterHasDomains !== 'all' && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
                            {filterHasDomains === 'with' ? 'Has Active Domains' : 'No Active Domains'}
                            <button
                                onClick={() => { setFilterHasDomains('all'); setCurrentPage(1) }}
                                className="ml-2 hover:text-blue-600"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    )}
                    {filterType !== 'all' && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
                            Type: {filterType === 'personal' ? 'Personal' : 'Organization'}
                            <button
                                onClick={() => { setFilterType('all'); setCurrentPage(1) }}
                                className="ml-2 hover:text-blue-600"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    )}
                </div>
            )}

            {/* Table */}
            <div className="overflow-hidden rounded-lg bg-white shadow">
                {clients.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="mx-auto h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center">
                            <Users className="h-8 w-8 text-blue-500" />
                        </div>
                        <h3 className="mt-4 text-lg font-medium text-gray-900">No Clients Yet</h3>
                        <p className="mt-2 text-gray-500 max-w-sm mx-auto">
                            Add your first client to start issuing SSL/TLS certificates through ACME.
                        </p>
                        <Link
                            href="/clients/new"
                            className="mt-6 inline-flex items-center rounded-lg bg-[#2d56c2] px-4 py-2 text-sm font-medium text-white hover:bg-[#254aa8]"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Client
                        </Link>
                    </div>
                ) : filteredClients.length === 0 ? (
                    <div className="p-12 text-center">
                        <Search className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-4 text-lg font-medium text-gray-900">No clients found</h3>
                        <p className="mt-2 text-gray-500">
                            {searchTerm
                                ? `No clients match "${searchTerm}". Try a different search term.`
                                : 'No clients match the selected filters.'
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
                                        onClick={() => handleSort('name')}
                                    >
                                        <div className="flex items-center">
                                            Name
                                            <SortIndicator field="name" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 bg-gray-50">
                                        Organization
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 bg-gray-50">
                                        OV Pre-Validation
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 bg-gray-50">
                                        ACME Accounts
                                    </th>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100 bg-gray-50"
                                        onClick={() => handleSort('domain_active')}
                                    >
                                        <div className="flex items-center">
                                            Active Domains
                                            <SortIndicator field="domain_active" />
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
                                {paginatedClients.map((client, index) => (
                                    <tr
                                        key={client.id}
                                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                                        onClick={() => window.location.href = `/clients/${client.id}`}
                                    >
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <div className="flex items-center">
                                                {/* Avatar with Initials */}
                                                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-medium text-sm ${client.company_name
                                                    ? 'bg-indigo-100 text-indigo-700'
                                                    : 'bg-teal-100 text-teal-700'
                                                    }`}>
                                                    {getInitials(client.name)}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="font-medium text-gray-900 hover:text-blue-600">
                                                        {client.name}
                                                    </div>
                                                    {client.email && (
                                                        <p className="text-sm text-gray-500 flex items-center">
                                                            <Mail className="mr-1 h-3 w-3" />
                                                            {client.email}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                                            {client.company_name ? (
                                                <span className="text-gray-900">{client.company_name}</span>
                                            ) : (
                                                <span className="text-gray-400 italic">Personal Account</span>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                                            {client.client_type === 'personal' || !client.company_name ? (
                                                <span className="text-gray-400 italic">Personal Account</span>
                                            ) : client.ov_anchor_number ? (
                                                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                                    Validated
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                                                    <AlertTriangle className="mr-1 h-3 w-3" />
                                                    Pending Validation
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <div className="flex items-center text-sm">
                                                    <Shield className="mr-1.5 h-4 w-4 text-gray-400" />
                                                    <span className="font-medium text-gray-900">{client.acme_total}</span>
                                                    <span className="ml-1 text-gray-500">Account{client.acme_total !== 1 ? 's' : ''}</span>
                                                </div>
                                                {client.acme_total > 0 && (
                                                    <span className="mt-0.5 text-xs text-gray-500">
                                                        {client.acme_active} active
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <div className="flex items-center text-sm">
                                                    <Globe className="mr-1.5 h-4 w-4 text-gray-400" />
                                                    <span className="font-medium text-gray-900">{client.domain_active}</span>
                                                    <span className="ml-1 text-gray-500">Active</span>
                                                </div>
                                                <span className="mt-0.5 text-xs text-gray-500">
                                                    {client.domain_total} registered
                                                </span>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadge(client.status)}`}>
                                                {client.status}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                                            {new Date(client.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end">
                                                {/* More Menu */}
                                                <div className="relative" ref={openMenuId === client.id ? menuRef : null}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleOpenMenu(client.id, index)
                                                        }}
                                                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                                                    >
                                                        <MoreVertical className="h-4 w-4" />
                                                    </button>

                                                    {openMenuId === client.id && (
                                                        <div className={`absolute right-0 z-10 w-56 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 ${menuPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
                                                            }`}>
                                                            <div className="py-1">
                                                                <Link
                                                                    href={`/clients/${client.id}/accounts/new`}
                                                                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                >
                                                                    <Plus className="mr-3 h-4 w-4 text-gray-400" />
                                                                    Create ACME Account
                                                                </Link>
                                                                <Link
                                                                    href={`/clients/${client.id}`}
                                                                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                >
                                                                    <Eye className="mr-3 h-4 w-4 text-gray-400" />
                                                                    View Details
                                                                </Link>
                                                                <Link
                                                                    href={`/clients/${client.id}/edit`}
                                                                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                >
                                                                    <Pencil className="mr-3 h-4 w-4 text-gray-400" />
                                                                    Edit Client
                                                                </Link>
                                                                <Link
                                                                    href={`/transactions?client_id=${client.id}`}
                                                                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                >
                                                                    <FileText className="mr-3 h-4 w-4 text-gray-400" />
                                                                    View Transactions
                                                                </Link>
                                                                {client.email && (
                                                                    <button
                                                                        onClick={() => copyEmail(client.email!)}
                                                                        className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                    >
                                                                        <Copy className="mr-3 h-4 w-4 text-gray-400" />
                                                                        Copy Email
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
                        <div className="text-sm text-gray-500">
                            Showing {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredClients.length)} of {filteredClients.length} clients
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
