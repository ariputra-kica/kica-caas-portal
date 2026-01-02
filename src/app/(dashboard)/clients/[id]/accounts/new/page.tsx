'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader2, Shield, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import Link from 'next/link'

interface ClientData {
    name: string
    company_name: string | null
    organization_anchors: Array<{
        id: string
        ov_anchor_order_number: string
        is_active: boolean
        expires_at: string | null
    }>
}

export default function NewAcmeAccountPage() {
    const [accountName, setAccountName] = useState('')
    const [certificateType, setCertificateType] = useState<'DV' | 'OV'>('DV')
    const [subscriptionYears, setSubscriptionYears] = useState(1)
    const [serverUrl, setServerUrl] = useState('https://acme.sectigo.com/v2/DV')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [clientName, setClientName] = useState('')
    const [clientData, setClientData] = useState<ClientData | null>(null)
    const [fetchingClient, setFetchingClient] = useState(true)

    const router = useRouter()
    const params = useParams()
    const supabase = createClient()
    const clientId = params.id as string

    // Derive OV eligibility from client data
    const isOrganization = clientData?.company_name ? true : false
    const activeAnchor = clientData?.organization_anchors?.find(a => a.is_active)
    const hasValidatedOV = !!activeAnchor
    const canSelectOV = isOrganization && hasValidatedOV

    useEffect(() => {
        // Fetch client with organization anchors
        const fetchClient = async () => {
            const { data, error } = await supabase
                .from('clients')
                .select(`
                    name,
                    company_name,
                    organization_anchors(
                        id,
                        ov_anchor_order_number,
                        is_active,
                        expires_at
                    )
                `)
                .eq('id', clientId)
                .single()

            if (data) {
                setClientName(data.name)
                setClientData(data as ClientData)
            }
            setFetchingClient(false)
        }
        fetchClient()
    }, [clientId, supabase])

    // Update server URL when certificate type changes
    useEffect(() => {
        if (certificateType === 'OV') {
            setServerUrl('https://acme.sectigo.com/v2/OV')
        } else {
            setServerUrl('https://acme.sectigo.com/v2/DV')
        }
    }, [certificateType])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            setError('You must be logged in')
            setLoading(false)
            return
        }

        try {
            // Call server-side API to create ACME account with Sectigo
            const response = await fetch('/api/subscriptions/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId,
                    accountName,
                    certificateType,
                    subscriptionYears,
                    serverUrl
                })
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to create subscription')
            }

            router.push(`/clients/${clientId}`)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred')
            setLoading(false)
        }
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            {/* Header */}
            <div className="flex items-center space-x-4">
                <Link
                    href={`/clients/${clientId}`}
                    className="rounded-lg p-2 hover:bg-gray-100"
                >
                    <ArrowLeft className="h-5 w-5 text-gray-500" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">New Subscription</h1>
                    <p className="text-gray-500">For {clientName}</p>
                </div>
            </div>

            {/* Info Banner */}
            <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-200 p-4">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                    <p><strong>Subscription period starts</strong> when you add the first domain.</p>
                    <p className="mt-1">Creating a subscription now reserves your ACME credentials without any charges yet.</p>
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

                    {/* Subscription Name */}
                    <div>
                        <label htmlFor="accountName" className="block text-sm font-medium text-gray-700">
                            Subscription Name *
                        </label>
                        <input
                            id="accountName"
                            type="text"
                            required
                            value={accountName}
                            onChange={(e) => setAccountName(e.target.value)}
                            placeholder="Production DV Subscription"
                            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">A friendly name to identify this subscription</p>
                    </div>

                    {/* Certificate Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Subscription Type
                        </label>
                        <div className="mt-2 grid grid-cols-2 gap-4">
                            {/* DV Option */}
                            <button
                                type="button"
                                onClick={() => setCertificateType('DV')}
                                className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 ${certificateType === 'DV'
                                    ? 'border-blue-600 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <Shield className={`h-8 w-8 ${certificateType === 'DV' ? 'text-blue-600' : 'text-gray-400'
                                    }`} />
                                <span className={`mt-2 font-medium ${certificateType === 'DV' ? 'text-blue-600' : 'text-gray-700'}`}>
                                    DV
                                </span>
                                <span className="mt-1 text-xs text-gray-500">Domain Validation</span>
                            </button>

                            {/* OV Option */}
                            <button
                                type="button"
                                onClick={() => canSelectOV && setCertificateType('OV')}
                                disabled={!canSelectOV}
                                className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 ${certificateType === 'OV'
                                    ? 'border-green-600 bg-green-50'
                                    : canSelectOV
                                        ? 'border-gray-200 hover:border-green-300'
                                        : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                                    }`}
                            >
                                <Shield className={`h-8 w-8 ${certificateType === 'OV' ? 'text-green-600' : canSelectOV ? 'text-gray-400' : 'text-gray-300'
                                    }`} />
                                <span className={`mt-2 font-medium ${certificateType === 'OV' ? 'text-green-600' : canSelectOV ? 'text-gray-700' : 'text-gray-400'
                                    }`}>
                                    OV
                                </span>
                                <span className="mt-1 text-xs text-gray-500">Organization Validation</span>
                                {!isOrganization && (
                                    <span className="mt-1 text-xs text-amber-600">Personal Account</span>
                                )}
                                {isOrganization && !hasValidatedOV && (
                                    <span className="mt-1 text-xs text-amber-600">Requires OV Pre-Validation</span>
                                )}
                                {hasValidatedOV && (
                                    <span className="mt-1 flex items-center text-xs text-green-600">
                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                        Validated
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* OV Status Message */}
                        {isOrganization && !hasValidatedOV && (
                            <div className="mt-3 flex items-start rounded-lg bg-amber-50 p-3 text-sm">
                                <AlertTriangle className="mr-2 h-5 w-5 flex-shrink-0 text-amber-500" />
                                <div className="text-amber-700">
                                    <strong>OV Pre-Validation Required</strong>
                                    <p className="mt-1">
                                        To create OV ACME accounts, this organization needs to complete OV Pre-Validation first.
                                        Please contact KICA support to initiate the validation process.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Subscription Period */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Subscription Period
                        </label>
                        <div className="mt-2 grid grid-cols-3 gap-4">
                            {[1, 2, 3].map((years) => (
                                <button
                                    key={years}
                                    type="button"
                                    onClick={() => setSubscriptionYears(years)}
                                    className={`rounded-lg border-2 p-3 text-center ${subscriptionYears === years
                                        ? 'border-blue-600 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <div className={`font-medium ${subscriptionYears === years ? 'text-blue-600' : 'text-gray-700'}`}>
                                        {years} Year{years > 1 ? 's' : ''}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Info Box */}
                    <div className="rounded-lg bg-blue-50 p-4">
                        <h4 className="font-medium text-blue-800">What happens next?</h4>
                        <ul className="mt-2 list-inside list-disc text-sm text-blue-700">
                            <li>ACME account will be created with Sectigo</li>
                            <li>You&apos;ll receive EAB credentials</li>
                            <li>Add domains to start issuing certificates</li>
                        </ul>
                    </div>

                    {/* Submit */}
                    <div className="flex justify-end space-x-4">
                        <Link
                            href={`/clients/${clientId}`}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={loading || !accountName}
                            className="inline-flex items-center rounded-lg bg-[#2d56c2] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#234a9f] disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating Subscription...
                                </>
                            ) : (
                                'Create Subscription'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
