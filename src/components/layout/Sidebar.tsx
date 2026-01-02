'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard,
    Users,
    CreditCard,
    FileText,
    Shield,
    Globe,
    CalendarClock,
    Award
} from 'lucide-react'

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Clients', href: '/clients', icon: Users },
    { name: 'Subscriptions', href: '/subscriptions', icon: CalendarClock },
    { name: 'Domains', href: '/domains', icon: Globe },
    { name: 'Certificates', href: '/certificates', icon: Award },
    { name: 'Transactions', href: '/transactions', icon: CreditCard },
    { name: 'Statements', href: '/statements', icon: FileText },
    { name: 'Audit Logs', href: '/audit-logs', icon: Shield },
]

export default function Sidebar() {
    const pathname = usePathname()

    return (
        <div className="flex h-screen w-64 flex-col bg-[#0a1227]">
            {/* KICA Logo */}
            <div className="flex h-20 items-center justify-center border-b border-white/5 px-6">
                <Image
                    src="/logo-kica.svg"
                    alt="KICA"
                    width={120}
                    height={40}
                    className="object-contain"
                />
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-3 py-4">
                {navigation.map((item) => {
                    const isActive = pathname.startsWith(item.href)
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`
                                group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
                                ${isActive
                                    ? 'bg-[#2d56c2] text-white shadow-lg shadow-blue-500/20'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }
                            `}
                        >
                            <item.icon
                                className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-white'
                                    }`}
                            />
                            {item.name}
                        </Link>
                    )
                })}
            </nav>

            {/* Powered by Sectigo */}
            <div className="border-t border-white/5 p-4">
                <div className="flex flex-col items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
                    <span className="text-[10px] uppercase tracking-wider font-normal text-gray-400">Powered by</span>
                    <Image
                        src="/logo-sectigo-reversed.png"
                        alt="Sectigo"
                        width={100}
                        height={30}
                        className="object-contain opacity-90 hover:opacity-100 transition-opacity"
                    />
                </div>
            </div>
        </div>
    )
}

