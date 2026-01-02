'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
    Search,
    Users,
    Shield,
    Globe,
    Navigation,
    X,
    Loader2,
    Command
} from 'lucide-react'

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
    navigation: SearchResult[]
}

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResults | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    // Flatten results for keyboard navigation
    const flatResults = results ? [
        ...results.clients.map(r => ({ ...r, category: 'Clients' })),
        ...results.accounts.map(r => ({ ...r, category: 'ACME Accounts' })),
        ...results.domains.map(r => ({ ...r, category: 'Domains' })),
        ...results.navigation.map(r => ({ ...r, category: 'Navigation' })),
    ] : []

    // Global keyboard shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setIsOpen(prev => !prev)
            }
            if (e.key === 'Escape') {
                setIsOpen(false)
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus()
            setQuery('')
            setResults(null)
            setSelectedIndex(0)
        }
    }, [isOpen])

    // Debounced search
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(() => {
        if (query.length < 2) {
            setResults(null)
            return
        }

        setIsLoading(true)
        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current)
        }

        searchTimeout.current = setTimeout(async () => {
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

        return () => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current)
            }
        }
    }, [query])

    // Navigate to selected result
    const navigateTo = useCallback((href: string) => {
        setIsOpen(false)
        router.push(href)
    }, [router])

    // Keyboard navigation within results
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
            case 'Navigation': return <Navigation className="w-4 h-4" />
            default: return <Search className="w-4 h-4" />
        }
    }

    // Get category color
    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'Clients': return 'text-blue-600 bg-blue-100'
            case 'ACME Accounts': return 'text-purple-600 bg-purple-100'
            case 'Domains': return 'text-emerald-600 bg-emerald-100'
            case 'Navigation': return 'text-gray-600 bg-gray-100'
            default: return 'text-gray-600 bg-gray-100'
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={() => setIsOpen(false)}
            />

            {/* Modal */}
            <div className="relative min-h-screen flex items-start justify-center p-4 pt-[15vh]">
                <div
                    className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Search Header */}
                    <div className="flex items-center border-b border-gray-200 px-4">
                        <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Search clients, accounts, domains..."
                            className="flex-1 px-4 py-4 text-base text-gray-900 placeholder-gray-500 focus:outline-none"
                        />
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                        ) : query && (
                            <button
                                onClick={() => setQuery('')}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        )}
                    </div>

                    {/* Results */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {query.length < 2 ? (
                            // Hint state
                            <div className="px-4 py-8 text-center">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
                                    <Command className="w-6 h-6 text-gray-400" />
                                </div>
                                <p className="text-sm text-gray-500 mb-1">
                                    Quick Search
                                </p>
                                <p className="text-xs text-gray-400">
                                    Type at least 2 characters to search
                                </p>
                            </div>
                        ) : flatResults.length > 0 ? (
                            // Results list
                            <div className="py-2">
                                {flatResults.map((result, index) => {
                                    // Show category header
                                    const showHeader = index === 0 ||
                                        flatResults[index - 1].category !== result.category

                                    return (
                                        <div key={`${result.category}-${result.id}`}>
                                            {showHeader && (
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                    {result.category}
                                                </div>
                                            )}
                                            <button
                                                onClick={() => navigateTo(result.href)}
                                                className={`
                                                    w-full flex items-center gap-3 px-4 py-3 text-left
                                                    transition-colors duration-100
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
                        ) : !isLoading && (
                            // No results
                            <div className="px-4 py-8 text-center">
                                <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">
                                    No results found for &quot;{query}&quot;
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-200 px-4 py-2 flex items-center justify-between text-xs text-gray-400">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono">↑↓</kbd>
                                navigate
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono">↵</kbd>
                                select
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono">esc</kbd>
                                close
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
