'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, Loader2, Users, Shield, Globe, Navigation, Settings, LogOut, ChevronDown, Award } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface SearchResult {
    id: string
    title: string
    subtitle: string
    href: string
}

interface SearchResults {
    clients: SearchResult[]
    accounts: SearchResult[]
    domains: SearchResult[]
    certificates: SearchResult[]
    navigation: SearchResult[]
}

interface DashboardClientProps {
    children: React.ReactNode
    partnerName?: string
}

export default function DashboardClient({ children, partnerName }: DashboardClientProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResults | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const avatarRef = useRef<HTMLDivElement>(null)
    const router = useRouter()
    const supabase = createClient()

    // Time-aware greeting
    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Good Morning'
        if (hour < 18) return 'Good Afternoon'
        return 'Good Evening'
    }

    // Flatten results for keyboard navigation
    const flatResults = results ? [
        ...results.clients.map(r => ({ ...r, category: 'Clients' })),
        ...results.accounts.map(r => ({ ...r, category: 'ACME Accounts' })),
        ...results.domains.map(r => ({ ...r, category: 'Domains' })),
        ...results.certificates.map(r => ({ ...r, category: 'Certificates' })),
        ...results.navigation.map(r => ({ ...r, category: 'Navigation' })),
    ] : []

    // Global keyboard shortcut - changed to /
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check if user is typing in an input/textarea
            const target = e.target as HTMLElement
            const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

            // "/" shortcut only when not typing
            if (e.key === '/' && !isTyping) {
                e.preventDefault()
                setIsExpanded(true)
                setTimeout(() => inputRef.current?.focus(), 100)
            }
            if (e.key === 'Escape') {
                if (isExpanded) closeSearch()
                if (isAvatarMenuOpen) setIsAvatarMenuOpen(false)
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isExpanded, isAvatarMenuOpen])

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                closeSearch()
            }
            if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
                setIsAvatarMenuOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Close search
    const closeSearch = () => {
        setIsExpanded(false)
        setQuery('')
        setResults(null)
        setSelectedIndex(0)
    }

    // Handle logout
    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    // Debounced search
    useEffect(() => {
        if (query.length < 2) {
            setResults(null)
            return
        }

        setIsLoading(true)
        const timeout = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
                const data = await res.json()
                setResults(data.results)
                setSelectedIndex(0)
            } catch (error) {
                console.error('Search error:', error)
            } finally {
                setIsLoading(false)
            }
        }, 200)

        return () => clearTimeout(timeout)
    }, [query])

    // Navigate to result
    const navigateTo = (href: string) => {
        closeSearch()
        router.push(href)
    }

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex(prev => Math.min(prev + 1, flatResults.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex(prev => Math.max(prev - 1, 0))
        } else if (e.key === 'Enter' && flatResults[selectedIndex]) {
            e.preventDefault()
            navigateTo(flatResults[selectedIndex].href)
        }
    }

    // Get category icon
    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'Clients': return <Users className="w-4 h-4" />
            case 'ACME Accounts': return <Shield className="w-4 h-4" />
            case 'Domains': return <Globe className="w-4 h-4" />
            case 'Certificates': return <Award className="w-4 h-4" />
            case 'Navigation': return <Navigation className="w-4 h-4" />
            default: return <Search className="w-4 h-4" />
        }
    }

    // Get category color
    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'Clients': return 'text-blue-600 bg-blue-50'
            case 'ACME Accounts': return 'text-purple-600 bg-purple-50'
            case 'Domains': return 'text-emerald-600 bg-emerald-50'
            case 'Certificates': return 'text-amber-600 bg-amber-50'
            case 'Navigation': return 'text-gray-600 bg-gray-100'
            default: return 'text-gray-600 bg-gray-100'
        }
    }

    // Get initials from partner name
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header - h-20 to align with sidebar logo separator */}
            <header className="flex-shrink-0 h-20 bg-white/80 backdrop-blur-sm border-b border-gray-200/50 flex items-center justify-between px-8 relative z-40">

                {/* Left: Empty space for balance */}
                <div className="flex-1" />

                {/* Center: Search */}
                <div ref={searchRef} className="relative">
                    <div
                        className={`
                            flex items-center gap-3 rounded-lg border bg-white shadow-sm
                            transition-all duration-300 ease-out
                            ${isExpanded
                                ? 'w-[500px] border-[#2d56c2] ring-2 ring-[#2d56c2]/20'
                                : 'w-[280px] border-gray-200 hover:border-gray-300 cursor-pointer'
                            }
                        `}
                        onClick={() => {
                            if (!isExpanded) {
                                setIsExpanded(true)
                                setTimeout(() => inputRef.current?.focus(), 100)
                            }
                        }}
                    >
                        <Search className={`ml-3 h-4 w-4 flex-shrink-0 transition-colors ${isExpanded ? 'text-[#2d56c2]' : 'text-gray-400'}`} />

                        {isExpanded ? (
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Search clients, accounts, domains..."
                                className="flex-1 py-2.5 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none bg-transparent"
                                autoComplete="off"
                            />
                        ) : (
                            <span className="flex-1 py-2.5 text-sm text-gray-400">Search...</span>
                        )}

                        {isExpanded && isLoading && (
                            <Loader2 className="mr-3 w-4 h-4 text-gray-400 animate-spin" />
                        )}

                        {isExpanded && query && !isLoading && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setQuery('')
                                    inputRef.current?.focus()
                                }}
                                className="mr-2 p-1 hover:bg-gray-100 rounded"
                            >
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        )}

                        {!isExpanded && (
                            <kbd className="mr-3 inline-flex items-center px-2 py-0.5 text-xs font-mono bg-gray-100 border border-gray-200 rounded text-gray-400">
                                /
                            </kbd>
                        )}
                    </div>

                    {/* Dropdown Results */}
                    {isExpanded && (query.length >= 2 || flatResults.length > 0) && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="max-h-[400px] overflow-y-auto">
                                {flatResults.length > 0 ? (
                                    <div className="py-2">
                                        {flatResults.map((result, index) => {
                                            const showHeader = index === 0 ||
                                                flatResults[index - 1].category !== result.category

                                            return (
                                                <div key={`${result.category}-${result.id}`}>
                                                    {showHeader && (
                                                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                                                            {result.category}
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => navigateTo(result.href)}
                                                        onMouseEnter={() => setSelectedIndex(index)}
                                                        className={`
                                                            w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                                                            ${selectedIndex === index
                                                                ? 'bg-[#2d56c2] text-white'
                                                                : 'hover:bg-gray-50 text-gray-900'
                                                            }
                                                        `}
                                                    >
                                                        <span className={`
                                                            flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
                                                            ${selectedIndex === index
                                                                ? 'bg-white/20 text-white'
                                                                : getCategoryColor(result.category)
                                                            }
                                                        `}>
                                                            {getCategoryIcon(result.category)}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-sm font-medium truncate ${selectedIndex === index ? 'text-white' : 'text-gray-900'
                                                                }`}>
                                                                {result.title}
                                                            </p>
                                                            <p className={`text-xs truncate ${selectedIndex === index ? 'text-blue-200' : 'text-gray-500'
                                                                }`}>
                                                                {result.subtitle}
                                                            </p>
                                                        </div>
                                                        <span className={`text-xs ${selectedIndex === index ? 'text-blue-200' : 'text-gray-400'
                                                            }`}>
                                                            ↵
                                                        </span>
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : isLoading ? (
                                    <div className="px-4 py-6 text-center">
                                        <Loader2 className="w-6 h-6 text-gray-400 animate-spin mx-auto mb-2" />
                                        <p className="text-sm text-gray-500">Searching...</p>
                                    </div>
                                ) : query.length >= 2 && (
                                    <div className="px-4 py-6 text-center">
                                        <Search className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                                        <p className="text-sm text-gray-500">
                                            No results for &quot;{query}&quot;
                                        </p>
                                    </div>
                                )}
                            </div>

                            {flatResults.length > 0 && (
                                <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-4 text-xs text-gray-400 bg-gray-50">
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono">↑↓</kbd>
                                        navigate
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono">↵</kbd>
                                        select
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono">esc</kbd>
                                        close
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right: Greeting + Avatar */}
                <div className="flex-1 flex items-center justify-end gap-4">
                    <span className="text-sm text-gray-600">
                        {getGreeting()}, <span className="font-medium text-gray-900">{partnerName || 'Partner'}</span>
                    </span>

                    {/* Avatar with Dropdown */}
                    <div ref={avatarRef} className="relative">
                        <button
                            onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}
                            className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2d56c2] to-[#1e3a8a] flex items-center justify-center text-white text-sm font-semibold shadow-md">
                                {getInitials(partnerName || 'Partner')}
                            </div>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isAvatarMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {isAvatarMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="py-1">
                                    <Link
                                        href="/settings"
                                        onClick={() => setIsAvatarMenuOpen(false)}
                                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <Settings className="w-4 h-4 text-gray-500" />
                                        Settings
                                    </Link>
                                    <hr className="my-1 border-gray-100" />
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Log out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <div className="p-8">{children}</div>
            </main>
        </div>
    )
}
