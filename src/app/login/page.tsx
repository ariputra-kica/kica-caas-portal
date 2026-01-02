'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Mail, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import Image from 'next/image'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [shake, setShake] = useState(false)
    const [success, setSuccess] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    // Clear shake animation after it plays
    useEffect(() => {
        if (shake) {
            const timer = setTimeout(() => setShake(false), 500)
            return () => clearTimeout(timer)
        }
    }, [shake])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError(error.message)
            setShake(true)
            setLoading(false)
        } else {
            setSuccess(true)
            // Delay redirect for success animation
            setTimeout(() => {
                router.push('/dashboard')
            }, 1200)
        }
    }

    return (
        <>
            {/* CSS Keyframe Animations */}
            <style jsx global>{`
                @keyframes logo-glow {
                    0%, 100% { filter: drop-shadow(0 0 8px rgba(255, 130, 0, 0.3)); }
                    50% { filter: drop-shadow(0 0 20px rgba(255, 130, 0, 0.6)); }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
                    20%, 40%, 60%, 80% { transform: translateX(4px); }
                }
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                @keyframes success-scale {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.02); }
                    100% { transform: scale(0.98); opacity: 0.8; }
                }
                @keyframes success-check {
                    0% { transform: scale(0); opacity: 0; }
                    50% { transform: scale(1.2); }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-logo-glow { animation: logo-glow 3s ease-in-out infinite; }
                .animate-shake { animation: shake 0.5s ease-in-out; }
                .animate-shimmer { 
                    background: linear-gradient(90deg, #FF8200 0%, #ffb366 50%, #FF8200 100%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite; 
                }
                .animate-success { animation: success-scale 0.8s ease-out forwards; }
                .animate-check { animation: success-check 0.5s ease-out forwards; }
            `}</style>

            <div className="flex min-h-screen items-center justify-center bg-[#0a1227] relative overflow-hidden py-12">
                {/* Spotlight Effect Background */}
                <div className="absolute inset-0 pointer-events-none">
                    <div
                        className="absolute inset-0 opacity-[0.4]"
                        style={{
                            background: 'radial-gradient(circle at 50% 50%, #1e2a4a 0%, #0a1227 100%)'
                        }}
                    />
                </div>

                {/* Background Pattern (Dot Grid) */}
                <div className="absolute inset-0 opacity-[0.07] pointer-events-none">
                    <div className="absolute inset-0" style={{
                        backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                        backgroundSize: '40px 40px'
                    }} />
                </div>

                {/* Login Card with Glass Enhancement */}
                <div
                    className={`relative w-full max-w-md space-y-8 rounded-2xl p-8 mb-16 backdrop-blur-xl bg-white/[0.02] overflow-hidden ${shake ? 'animate-shake' : ''} ${success ? 'animate-success' : ''}`}
                    style={{
                        boxShadow: '0 10px 30px -5px rgba(0,0,0,0.2), 0 20px 60px -10px rgba(0,0,0,0.15), 0 30px 90px -15px rgba(0,0,0,0.1), inset 0 1px 0 0 rgba(255,255,255,0.05)',
                    }}
                >
                    {/* Glass effect via shadow only - no border to avoid clipping issues */}

                    {/* Success Overlay */}
                    {success && (
                        <div className="absolute -inset-8 rounded-2xl bg-[#0a1227]/95 flex items-center justify-center z-10">
                            <div className="text-center">
                                <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto animate-check" />
                                <p className="text-green-400 font-semibold mt-4 text-lg">Login Successful!</p>
                                <p className="text-green-400/70 text-sm mt-1">Redirecting to dashboard...</p>
                            </div>
                        </div>
                    )}

                    {/* KICA Logo with Glow Pulse */}
                    <div className={`text-center space-y-4 relative ${success ? 'opacity-0' : ''}`}>
                        <div className="flex justify-center">
                            <Image
                                src="/logo-kica.svg"
                                alt="KICA"
                                width={180}
                                height={60}
                                className="object-contain animate-logo-glow"
                                priority
                            />
                        </div>
                        <div>
                            <p className="text-base font-medium text-gray-300 tracking-tight">Certificate as a Service Partner Portal</p>
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className={`mt-8 space-y-6 relative ${success ? 'opacity-0' : ''}`}>
                        {error && (
                            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 text-center">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="email" className="block text-sm font-semibold text-white/90">
                                    Email address
                                </label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#FF8200] transition-colors">
                                        <Mail size={18} />
                                    </div>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full rounded-xl border border-white/5 bg-white/[0.03] pl-11 pr-4 py-3.5 text-white placeholder-gray-600 focus:border-[#FF8200] focus:outline-none focus:ring-1 focus:ring-[#FF8200] transition-all"
                                        placeholder="partner@example.com"
                                        disabled={loading || success}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="password" className="block text-sm font-semibold text-white/90">
                                    Password
                                </label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#FF8200] transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full rounded-xl border border-white/5 bg-white/[0.03] pl-11 pr-12 py-3.5 text-white placeholder-gray-600 focus:border-[#FF8200] focus:outline-none focus:ring-1 focus:ring-[#FF8200] transition-all"
                                        placeholder="••••••••"
                                        disabled={loading || success}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                        disabled={loading || success}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Forgot Password Link */}
                        <div className="flex justify-end">
                            <a
                                href="#"
                                className="text-sm text-gray-400 hover:text-[#FF8200] transition-colors"
                                onClick={(e) => {
                                    e.preventDefault()
                                    // TODO: Implement forgot password flow
                                    alert('Forgot password functionality coming soon!')
                                }}
                            >
                                Forgot password?
                            </a>
                        </div>

                        {/* Submit Button with Shimmer Loading */}
                        <button
                            type="submit"
                            disabled={loading || success}
                            className={`group relative flex w-full items-center justify-center rounded-xl px-4 py-4 font-bold text-[#0a1227] shadow-lg shadow-orange-500/20 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:ring-offset-2 focus:ring-offset-[#0a1227] disabled:cursor-not-allowed transition-all duration-200 ${loading ? 'animate-shimmer' : 'bg-[#FF8200] hover:bg-[#ff9526] hover:scale-[1.02] active:scale-[0.98]'}`}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Authenticating...
                                </>
                            ) : (
                                'Sign in to Portal'
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className={`mt-8 pt-6 space-y-6 text-center ${success ? 'opacity-0' : ''}`}>
                        <div className="flex flex-col items-center gap-2 opacity-80 hover:opacity-100 transition-opacity cursor-default">
                            <span className="text-[10px] uppercase tracking-wider font-normal text-gray-300">Powered by</span>
                            <Image
                                src="/logo-sectigo-reversed.png"
                                alt="Sectigo"
                                width={70}
                                height={24}
                                className="object-contain"
                            />
                        </div>
                        <p className="text-xs text-gray-500">
                            &copy; {new Date().getFullYear()} KICA Inc. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </>
    )
}

