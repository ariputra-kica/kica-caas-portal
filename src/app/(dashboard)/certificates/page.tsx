'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
    Award,
    Search,
    Filter,
    ChevronUp,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    MoreVertical,
    Copy,
    Eye,
    X,
    Download,
    Shield,
    Clock,
    AlertTriangle,
    CheckCircle
} from 'lucide-react'
import { useEffect, useState, useRef } from 'react'

interface Certificate {
    id: string
    order_number: string | null
    certificate_id: string | null
    serial_number: string | null
    valid_not_before: string | null
    valid_not_after: string | null
    status_code: number | null
    status_desc: string | null
    synced_at: string | null
    created_at: string
    // Nested domain data
    domain_name: string
    domain_type: string
    domain_id: string
    // Nested client data
    client_id: string
    client_name: string
    company_name: string | null
    // ACME Account
    account_id: string
    account_name: string
}

type SortField = 'valid_not_after' | 'valid_not_before' | 'synced_at' | 'created_at'
type SortDirection = 'asc' | 'desc'

const ITEMS_PER_PAGE = 10

// Status code mapping from Sectigo
const STATUS_MAP: Record<number, { label: string; color: string }> = {
    6: { label: 'Valid', color: 'bg-[#00d57b]/10 text-[#00d57b]' },
    8: { label: 'Revoked', color: 'bg-[#e83131]/10 text-[#e83131]' },
    9: { label: 'Pending', color: 'bg-[#f57c14]/10 text-[#f57c14]' },
}

export default function CertificatesPage() {
    const [certificates, setCertificates] = useState<Certificate[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [sortField, setSortField] = useState<SortField>('created_at')
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
    const [currentPage, setCurrentPage] = useState(1)
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)
    const [menuPosition, setMenuPosition] = useState<'bottom' | 'top'>('bottom')
    const [showFilterPanel, setShowFilterPanel] = useState(false)
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [filterClient, setFilterClient] = useState<string>('all')
    const [filterExpiring, setFilterExpiring] = useState(false)
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
        async function fetchCertificates() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Fetch certificates with nested domain, acme_account, and client data
            const { data, error } = await supabase
                .from('certificates')
                .select(`
                    *,
                    domains(
                        id,
                        domain_name,
                        domain_type,
                        acme_accounts(
                            id,
                            account_name,
                            clients(
                                id,
                                name,
                                company_name,
                                partner_id
                            )
                        )
                    )
                `)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error fetching certificates:', error)
                setLoading(false)
                return
            }

            // Transform and filter data for current partner
            const transformed = (data || [])
                .filter(cert => {
                    const domain = cert.domains
                    const account = domain?.acme_accounts
                    const client = account?.clients
                    return client?.partner_id === user.id
                })
                .map(cert => {
                    const domain = cert.domains
                    const account = domain?.acme_accounts
                    const client = account?.clients

                    return {
                        id: cert.id,
                        order_number: cert.order_number,
                        certificate_id: cert.certificate_id,
                        serial_number: cert.serial_number,
                        valid_not_before: cert.valid_not_before,
                        valid_not_after: cert.valid_not_after,
                        status_code: cert.status_code,
                        status_desc: cert.status_desc,
                        synced_at: cert.synced_at,
                        created_at: cert.created_at,
                        domain_name: domain?.domain_name || 'Unknown',
                        domain_type: domain?.domain_type || 'single',
                        domain_id: domain?.id || '',
                        client_id: client?.id || '',
                        client_name: client?.name || 'Unknown',
                        company_name: client?.company_name || null,
                        account_id: account?.id || '',
                        account_name: account?.account_name || 'Unknown',
                    }
                })

            setCertificates(transformed)
            setLoading(false)
        }

        fetchCertificates()
    }, [supabase])

    // Get unique clients for filter dropdown
    const uniqueClients = [...new Map(
        certificates.map(c => [c.client_id, { id: c.client_id, name: c.client_name }])
    ).values()]

    // Calculate summary stats
    const summaryStats = {
        total: certificates.length,
        valid: certificates.filter(c => c.status_code === 6).length,
        expiringSoon: certificates.filter(c => {
            if (!c.valid_not_after) return false
            const daysLeft = Math.ceil((new Date(c.valid_not_after).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            return daysLeft > 0 && daysLeft <= 30
        }).length,
        revoked: certificates.filter(c => c.status_code === 8).length,
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

    // Get status badge
    const getStatusBadge = (statusCode: number | null) => {
        const status = statusCode !== null ? STATUS_MAP[statusCode] : null
        if (!status) {
            return { label: 'Unknown', color: 'bg-gray-100 text-gray-600' }
        }
        return status
    }

    // Get days until expiry
    const getDaysUntilExpiry = (expiryDate: string | null) => {
        if (!expiryDate) return null
        const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        return days
    }

    // Count active filters
    const activeFilterCount = [
        filterStatus !== 'all',
        filterClient !== 'all',
        filterExpiring
    ].filter(Boolean).length

    // Clear all filters
    const clearFilters = () => {
        setFilterStatus('all')
        setFilterClient('all')
        setFilterExpiring(false)
        setCurrentPage(1)
    }

    // Copy to clipboard
    const copyToClipboard = async (text: string) => {
        await navigator.clipboard.writeText(text)
        setOpenMenuId(null)
    }

    // Export to CSV
    const exportToCSV = () => {
        const headers = ['Certificate ID', 'Serial Number', 'Domain', 'Client', 'Status', 'Issued', 'Expires', 'Days Left']
        const rows = filteredCertificates.map(cert => {
            const daysLeft = getDaysUntilExpiry(cert.valid_not_after)
            return [
                cert.certificate_id || '',
                cert.serial_number || '',
                cert.domain_name,
                cert.client_name,
                getStatusBadge(cert.status_code).label,
                cert.valid_not_before ? new Date(cert.valid_not_before).toLocaleDateString() : '',
                cert.valid_not_after ? new Date(cert.valid_not_after).toLocaleDateString() : '',
                daysLeft !== null ? daysLeft.toString() : ''
            ]
        })

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `certificates_export_${new Date().toISOString().split('T')[0]}.csv`
        link.click()
    }

    // Filter and sort certificates
    const filteredCertificates = certificates
        .filter(cert => {
            // Search filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase()
                const matchesSearch = (
                    cert.certificate_id?.toLowerCase().includes(term) ||
                    cert.serial_number?.toLowerCase().includes(term) ||
                    cert.domain_name?.toLowerCase().includes(term) ||
                    cert.client_name?.toLowerCase().includes(term)
                )
                if (!matchesSearch) return false
            }

            // Status filter
            if (filterStatus !== 'all') {
                const statusCode = parseInt(filterStatus)
                if (cert.status_code !== statusCode) return false
            }

            // Client filter
            if (filterClient !== 'all' && cert.client_id !== filterClient) {
                return false
            }

            // Expiring soon filter
            if (filterExpiring) {
                const daysLeft = getDaysUntilExpiry(cert.valid_not_after)
                if (daysLeft === null || daysLeft > 30 || daysLeft <= 0) return false
            }

            return true
        })
        .sort((a, b) => {
            let comparison = 0
            const aValue = a[sortField]
            const bValue = b[sortField]

            if (aValue && bValue) {
                comparison = new Date(aValue).getTime() - new Date(bValue).getTime()
            } else if (aValue) {
                comparison = 1
            } else if (bValue) {
                comparison = -1
            }

            return sortDirection === 'asc' ? comparison : -comparison
        })

    // Pagination
    const totalPages = Math.ceil(filteredCertificates.length / ITEMS_PER_PAGE)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const paginatedCertificates = filteredCertificates.slice(startIndex, startIndex + ITEMS_PER_PAGE)

    // Handle opening menu with position detection
    const handleOpenMenu = (certId: string, rowIndex: number) => {
        const isNearBottom = rowIndex >= paginatedCertificates.length - 2
        setMenuPosition(isNearBottom ? 'top' : 'bottom')
        setOpenMenuId(openMenuId === certId ? null : certId)
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Certificates</h1>
                        <p className="text-gray-500">View and manage SSL/TLS certificates</p>
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
                    <h1 className="text-2xl font-bold text-gray-900">Certificates</h1>
                    <p className="text-gray-500">View and manage SSL/TLS certificates</p>
                </div>
                <div className="flex items-center gap-3">
                    {certificates.length > 0 && (
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
            {certificates.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                    <div className="rounded-lg bg-white p-4 shadow">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-blue-100 p-2">
                                <Award className="h-5 w-5 text-[#2d56c2]" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Total Certificates</p>
                                <p className="text-2xl font-semibold text-gray-900">{summaryStats.total}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-lg bg-white p-4 shadow">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-[#00d57b]/10 p-2">
                                <CheckCircle className="h-5 w-5 text-[#00d57b]" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Valid</p>
                                <p className="text-2xl font-semibold text-gray-900">{summaryStats.valid}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-lg bg-white p-4 shadow">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-[#f57c14]/10 p-2">
                                <Clock className="h-5 w-5 text-[#f57c14]" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Expiring Soon</p>
                                <p className="text-2xl font-semibold text-gray-900">{summaryStats.expiringSoon}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-lg bg-white p-4 shadow">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-[#e83131]/10 p-2">
                                <AlertTriangle className="h-5 w-5 text-[#e83131]" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Revoked</p>
                                <p className="text-2xl font-semibold text-gray-900">{summaryStats.revoked}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Search Bar with Filter Button */}
            {certificates.length > 0 && (
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by certificate ID, serial number, or domain..."
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
                                        onChange={(e) => {
                                            setFilterStatus(e.target.value)
                                            setCurrentPage(1)
                                        }}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="all">All Status</option>
                                        <option value="6">Valid</option>
                                        <option value="8">Revoked</option>
                                        <option value="9">Pending</option>
                                    </select>
                                </div>

                                {/* Client Filter */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Client
                                    </label>
                                    <select
                                        value={filterClient}
                                        onChange={(e) => {
                                            setFilterClient(e.target.value)
                                            setCurrentPage(1)
                                        }}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="all">All Clients</option>
                                        {uniqueClients.map(client => (
                                            <option key={client.id} value={client.id}>{client.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Expiring Soon Filter */}
                                <div className="mb-4">
                                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={filterExpiring}
                                            onChange={(e) => {
                                                setFilterExpiring(e.target.checked)
                                                setCurrentPage(1)
                                            }}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        Expiring within 30 days
                                    </label>
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
                            Status: {getStatusBadge(parseInt(filterStatus)).label}
                            <button
                                onClick={() => { setFilterStatus('all'); setCurrentPage(1) }}
                                className="ml-2 hover:text-blue-600"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    )}
                    {filterClient !== 'all' && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
                            Client: {uniqueClients.find(c => c.id === filterClient)?.name}
                            <button
                                onClick={() => { setFilterClient('all'); setCurrentPage(1) }}
                                className="ml-2 hover:text-blue-600"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    )}
                    {filterExpiring && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
                            Expiring Soon
                            <button
                                onClick={() => { setFilterExpiring(false); setCurrentPage(1) }}
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
                {certificates.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="mx-auto h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center">
                            <Award className="h-8 w-8 text-blue-500" />
                        </div>
                        <h3 className="mt-4 text-lg font-medium text-gray-900">No Certificates Yet</h3>
                        <p className="mt-2 text-gray-500 max-w-sm mx-auto">
                            Certificates will appear here once they are issued through ACME.
                        </p>
                    </div>
                ) : filteredCertificates.length === 0 ? (
                    <div className="p-12 text-center">
                        <Search className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-4 text-lg font-medium text-gray-900">No certificates found</h3>
                        <p className="mt-2 text-gray-500">
                            {searchTerm
                                ? `No certificates match "${searchTerm}". Try a different search term.`
                                : 'No certificates match the selected filters.'
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
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 bg-gray-50">
                                        Certificate
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 bg-gray-50">
                                        Domain
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 bg-gray-50">
                                        Client
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 bg-gray-50">
                                        Status
                                    </th>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100 bg-gray-50"
                                        onClick={() => handleSort('valid_not_before')}
                                    >
                                        <div className="flex items-center">
                                            Issued
                                            <SortIndicator field="valid_not_before" />
                                        </div>
                                    </th>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100 bg-gray-50"
                                        onClick={() => handleSort('valid_not_after')}
                                    >
                                        <div className="flex items-center">
                                            Expires
                                            <SortIndicator field="valid_not_after" />
                                        </div>
                                    </th>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100 bg-gray-50"
                                        onClick={() => handleSort('synced_at')}
                                    >
                                        <div className="flex items-center">
                                            Last Synced
                                            <SortIndicator field="synced_at" />
                                        </div>
                                    </th>
                                    <th className="relative px-6 py-3 bg-gray-50">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {paginatedCertificates.map((cert, index) => {
                                    const status = getStatusBadge(cert.status_code)
                                    const daysLeft = getDaysUntilExpiry(cert.valid_not_after)
                                    const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30
                                    const isExpired = daysLeft !== null && daysLeft <= 0

                                    return (
                                        <tr
                                            key={cert.id}
                                            className="hover:bg-gray-50 transition-colors"
                                        >
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-sm text-gray-900">
                                                            {cert.certificate_id ? cert.certificate_id.slice(0, 16) + '...' : 'N/A'}
                                                        </span>
                                                        {cert.certificate_id && (
                                                            <button
                                                                onClick={() => copyToClipboard(cert.certificate_id!)}
                                                                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                                                                title="Copy Certificate ID"
                                                            >
                                                                <Copy className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-gray-500 font-mono">
                                                        SN: {cert.serial_number ? cert.serial_number.slice(0, 12) + '...' : 'N/A'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-gray-900">{cert.domain_name}</span>
                                                    {cert.domain_type === 'wildcard' && (
                                                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                                                            Wildcard
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm">
                                                <Link
                                                    href={`/clients/${cert.client_id}`}
                                                    className="text-gray-900 hover:text-[#2d56c2]"
                                                >
                                                    {cert.client_name}
                                                </Link>
                                                {cert.company_name && (
                                                    <p className="text-xs text-gray-500">{cert.company_name}</p>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${status.color}`}>
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                                                {cert.valid_not_before
                                                    ? new Date(cert.valid_not_before).toLocaleDateString()
                                                    : 'N/A'
                                                }
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm text-gray-900">
                                                        {cert.valid_not_after
                                                            ? new Date(cert.valid_not_after).toLocaleDateString()
                                                            : 'N/A'
                                                        }
                                                    </span>
                                                    {daysLeft !== null && (
                                                        <span className={`text-xs ${isExpired
                                                            ? 'text-[#e83131]'
                                                            : isExpiringSoon
                                                                ? 'text-[#f57c14]'
                                                                : 'text-gray-500'
                                                            }`}>
                                                            {isExpired
                                                                ? 'Expired'
                                                                : `${daysLeft} days left`
                                                            }
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                                                {cert.synced_at
                                                    ? new Date(cert.synced_at).toLocaleDateString()
                                                    : 'Never'
                                                }
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                                                <div className="relative" ref={openMenuId === cert.id ? menuRef : null}>
                                                    <button
                                                        onClick={() => handleOpenMenu(cert.id, index)}
                                                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                                                    >
                                                        <MoreVertical className="h-4 w-4" />
                                                    </button>

                                                    {openMenuId === cert.id && (
                                                        <div className={`absolute right-0 z-10 w-48 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 ${menuPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
                                                            }`}>
                                                            <div className="py-1">
                                                                <Link
                                                                    href={`/clients/${cert.client_id}`}
                                                                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                >
                                                                    <Eye className="mr-3 h-4 w-4 text-gray-400" />
                                                                    View Client
                                                                </Link>
                                                                {cert.certificate_id && (
                                                                    <button
                                                                        onClick={() => copyToClipboard(cert.certificate_id!)}
                                                                        className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                    >
                                                                        <Copy className="mr-3 h-4 w-4 text-gray-400" />
                                                                        Copy Certificate ID
                                                                    </button>
                                                                )}
                                                                {cert.serial_number && (
                                                                    <button
                                                                        onClick={() => copyToClipboard(cert.serial_number!)}
                                                                        className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                    >
                                                                        <Copy className="mr-3 h-4 w-4 text-gray-400" />
                                                                        Copy Serial Number
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
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
                            Showing {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredCertificates.length)} of {filteredCertificates.length} certificates
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
