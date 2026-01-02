'use client'

import { Search } from 'lucide-react'

interface SearchTriggerProps {
    onClick: () => void
}

export default function SearchTrigger({ onClick }: SearchTriggerProps) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-3 rounded-lg bg-white/80 backdrop-blur-sm border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-white hover:border-gray-300 hover:shadow-sm transition-all duration-200 group min-w-[240px]"
        >
            <Search className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
            <span className="flex-1 text-left text-gray-400">Search...</span>
            <kbd className="inline-flex items-center gap-0.5 px-2 py-0.5 text-xs font-mono bg-gray-100 border border-gray-200 rounded text-gray-500">
                Ctrl+K
            </kbd>
        </button>
    )
}
