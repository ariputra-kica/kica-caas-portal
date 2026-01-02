'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader2, Building2, User, CheckCircle } from 'lucide-react'
import Link from 'next/link'

export default function NewClientPage() {
    const [name, setName] = useState('')
    const [companyName, setCompanyName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [toast, setToast] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClient()

    const [clientType, setClientType] = useState<'personal' | 'organization'>('personal')

    // Email validation
    const isValidEmail = (emailStr: string) => {
        if (!emailStr) return true // Empty is OK (optional)
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            setError('You must be logged in to create a client')
            setLoading(false)
            return
        }

        // Use state directly
        // const clientType = companyName ? 'organization' : 'personal'

        const { error: insertError } = await supabase
            .from('clients')
            .insert({
                partner_id: user.id,
                name,
                company_name: companyName || null,
                client_type: clientType,
                email: email || null,
                phone: phone || null,
                status: 'active'
            })

        if (insertError) {
            setError(insertError.message)
            setLoading(false)
        } else {
            // Show toast and delay redirect
            setToast(`✅ Client "${name}" created successfully!`)
            setTimeout(() => router.push('/clients'), 1500)
        }
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            {/* Header */}
            <div className="flex items-center space-x-4">
                <Link
                    href="/clients"
                    className="rounded-lg p-2 hover:bg-gray-100"
                >
                    <ArrowLeft className="h-5 w-5 text-gray-500" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Add Client</h1>
                    <p className="text-gray-500">Create a new client account</p>
                </div>
            </div>

            {/* Form */}
            <div className="rounded-lg bg-white p-6 shadow">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {/* Name */}
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                            Contact Name / PIC Name *
                        </label>
                        <input
                            id="name"
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="John Doe"
                            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    {/* Client Type Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Client Type
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setClientType('personal')}
                                className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${clientType === 'personal'
                                    ? 'border-teal-500 bg-teal-50 text-teal-700 ring-1 ring-teal-500'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                    }`}
                            >
                                <User className="h-4 w-4" />
                                Personal / Individual
                            </button>
                            <button
                                type="button"
                                onClick={() => setClientType('organization')}
                                className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${clientType === 'organization'
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                    }`}
                            >
                                <Building2 className="h-4 w-4" />
                                Organization / Corporate
                            </button>
                        </div>
                    </div>

                    {/* Company Name */}
                    <div>
                        <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
                            {clientType === 'organization' ? 'Organization Name *' : 'Company Reference (Optional)'}
                            <span className="ml-2 text-xs text-gray-400">
                                {clientType === 'organization' ? '(Required for OV)' : '(For reference only)'}
                            </span>
                        </label>
                        <input
                            id="companyName"
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            required={clientType === 'organization'}
                            placeholder={clientType === 'organization' ? "PT Example Corp" : "Optional company name"}
                            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="contact@example.com"
                            className={`mt-1 block w-full rounded-lg border bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 ${email && !isValidEmail(email)
                                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                                }`}
                        />
                        {email && !isValidEmail(email) && (
                            <p className="mt-1 text-sm text-red-600">Please enter a valid email address</p>
                        )}
                    </div>

                    {/* Phone */}
                    <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                            Phone
                        </label>
                        <input
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+62 812 3456 7890"
                            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    {/* Info Box */}
                    <div className="rounded-lg bg-amber-50 p-4">
                        <p className="text-sm text-amber-800">
                            <strong>Note:</strong> For OV ACME accounts, additional organization details
                            (company registration, address, etc.) will be required for OV Pre-Validation.
                        </p>
                    </div>

                    {/* Submit */}
                    <div className="flex justify-end space-x-4">
                        <Link
                            href="/clients"
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={loading || !name || (!!email && !isValidEmail(email))}
                            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create Client'
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Toast Notification */}
            {toast && (
                <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-white shadow-lg animate-in slide-in-from-bottom-5">
                    <CheckCircle className="h-5 w-5" />
                    {toast}
                </div>
            )}
        </div>
    )
}

