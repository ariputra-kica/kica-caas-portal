'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Building2, Shield, Bell, FileText, User, Lock, Eye, EyeOff, Loader2, Check, AlertCircle, Plus, Trash2, Globe } from 'lucide-react'

type Tab = 'profile' | 'account' | 'security' | 'billing' | 'notifications'

interface PartnerData {
    company_name: string
    partner_type: string
    payment_mode: string
    pricing_class: string
    status: string
}

interface BillingPreferences {
    billing_email: string
    billing_phone: string | null
    auto_confirm_statement: boolean
    statement_reviewer_email: string | null
    notify_on_expiry: boolean
    notify_on_new_client: boolean
    notify_monthly_report: boolean
}

interface IpWhitelistEntry {
    id: string
    ip_address: string
    ip_type: 'single' | 'cidr'
    description: string | null
    created_at: string
}

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('profile')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

    // Partner data
    const [partner, setPartner] = useState<PartnerData | null>(null)
    const [companyName, setCompanyName] = useState('')

    // Billing preferences
    const [billingPrefs, setBillingPrefs] = useState<BillingPreferences | null>(null)

    // Password change
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)

    // IP Whitelist
    const [ipWhitelist, setIpWhitelist] = useState<IpWhitelistEntry[]>([])
    const [newIpAddress, setNewIpAddress] = useState('')
    const [newIpDescription, setNewIpDescription] = useState('')
    const [addingIp, setAddingIp] = useState(false)
    const [deletingIpId, setDeletingIpId] = useState<string | null>(null)

    const supabase = createClient()

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            console.log('No user found')
            setLoading(false)
            return
        }

        console.log('Fetching data for user:', user.id)

        // Fetch partner data
        const { data: partnerData, error: partnerError } = await supabase
            .from('partners')
            .select('company_name, partner_type, payment_mode, pricing_class, status')
            .eq('id', user.id)
            .single()

        console.log('Partner data:', partnerData, 'Error:', partnerError)

        if (partnerData) {
            setPartner(partnerData)
            setCompanyName(partnerData.company_name)
        }

        // Fetch billing preferences
        const { data: billingData, error: billingError } = await supabase
            .from('billing_preferences')
            .select('*')
            .eq('partner_id', user.id)
            .single()

        console.log('Billing data:', billingData, 'Error:', billingError)

        if (billingData) {
            setBillingPrefs(billingData)
        } else if (billingError && billingError.code === 'PGRST116') {
            // No billing preferences found - create default
            console.log('No billing preferences found, will need to insert defaults')
        }

        // Fetch IP whitelist
        await fetchIpWhitelist()

        setLoading(false)
    }

    const fetchIpWhitelist = async () => {
        const response = await fetch('/api/settings/ip-whitelist')
        if (response.ok) {
            const result = await response.json()
            setIpWhitelist(result.data || [])
        }
    }

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message })
        setTimeout(() => setToast(null), 5000)
    }

    const handleSaveProfile = async () => {
        if (!companyName.trim()) {
            showToast('error', 'Company name cannot be empty')
            return
        }

        setSaving(true)
        const response = await fetch('/api/settings/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company_name: companyName })
        })

        if (response.ok) {
            showToast('success', 'Company name updated successfully')
            await fetchData()
        } else {
            showToast('error', 'Failed to update company name')
        }
        setSaving(false)
    }

    const handleSaveBilling = async () => {
        if (!billingPrefs) return

        setSaving(true)
        const response = await fetch('/api/settings/billing', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(billingPrefs)
        })

        if (response.ok) {
            showToast('success', 'Billing preferences updated successfully')
        } else {
            showToast('error', 'Failed to update billing preferences')
        }
        setSaving(false)
    }

    const handleChangePassword = async () => {
        if (!newPassword || !currentPassword) {
            showToast('error', 'Please fill in all password fields')
            return
        }

        if (newPassword !== confirmPassword) {
            showToast('error', 'New passwords do not match')
            return
        }

        if (newPassword.length < 8) {
            showToast('error', 'Password must be at least 8 characters')
            return
        }

        setSaving(true)
        const response = await fetch('/api/settings/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
        })

        if (response.ok) {
            showToast('success', 'Password updated successfully')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        } else {
            const data = await response.json()
            showToast('error', data.error || 'Failed to update password')
        }
        setSaving(false)
    }

    const handleAddIp = async () => {
        if (!newIpAddress.trim()) {
            showToast('error', 'Please enter an IP address')
            return
        }

        setAddingIp(true)
        const response = await fetch('/api/settings/ip-whitelist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ip_address: newIpAddress.trim(),
                description: newIpDescription.trim() || null
            })
        })

        if (response.ok) {
            showToast('success', 'IP address added to whitelist')
            setNewIpAddress('')
            setNewIpDescription('')
            await fetchIpWhitelist()
        } else {
            const data = await response.json()
            showToast('error', data.error || 'Failed to add IP')
        }
        setAddingIp(false)
    }

    const handleDeleteIp = async (id: string) => {
        setDeletingIpId(id)
        const response = await fetch(`/api/settings/ip-whitelist?id=${id}`, {
            method: 'DELETE'
        })

        if (response.ok) {
            showToast('success', 'IP address removed from whitelist')
            await fetchIpWhitelist()
        } else {
            showToast('error', 'Failed to remove IP')
        }
        setDeletingIpId(null)
    }

    const tabs = [
        { id: 'profile' as Tab, label: 'Company Profile', icon: Building2 },
        { id: 'account' as Tab, label: 'Account', icon: User },
        { id: 'security' as Tab, label: 'Security', icon: Shield },
        { id: 'billing' as Tab, label: 'Billing', icon: FileText },
        { id: 'notifications' as Tab, label: 'Notifications', icon: Bell },
    ]

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#2d56c2]" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-500">Manage your account settings and preferences</p>
            </div>

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg ${toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                    {toast.type === 'success' ? (
                        <Check className="h-5 w-5" />
                    ) : (
                        <AlertCircle className="h-5 w-5" />
                    )}
                    <span className="font-medium">{toast.message}</span>
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {tabs.map((tab) => {
                        const Icon = tab.icon
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors ${activeTab === tab.id
                                    ? 'border-[#2d56c2] text-[#2d56c2]'
                                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                    }`}
                            >
                                <Icon className="h-5 w-5" />
                                {tab.label}
                            </button>
                        )
                    })}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="rounded-lg bg-white p-6 shadow">
                {activeTab === 'profile' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">Company Information</h3>
                            <p className="text-sm text-gray-500">Update your company details</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Company Name</label>
                            <input
                                type="text"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-[#2d56c2] focus:outline-none focus:ring-1 focus:ring-[#2d56c2]"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Partner Type</label>
                            <div className="mt-1 flex items-center gap-2">
                                <input
                                    type="text"
                                    value={partner?.partner_type || ''}
                                    disabled
                                    className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-gray-500 cursor-not-allowed"
                                />
                                <Lock className="h-5 w-5 text-gray-400" />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">Contact KICA to change partner type</p>
                        </div>

                        <button
                            onClick={handleSaveProfile}
                            disabled={saving}
                            className="flex items-center gap-2 rounded-lg bg-[#2d56c2] px-4 py-2 text-white hover:bg-[#234a9f] disabled:opacity-50"
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            Save Changes
                        </button>
                    </div>
                )}

                {activeTab === 'account' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">Account Details</h3>
                            <p className="text-sm text-gray-500">View your account information</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Payment Type</label>
                                <div className="mt-1 flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={partner?.payment_mode === 'postpaid' ? 'Post-Paid (Trust-Based)' : partner?.payment_mode || ''}
                                        disabled
                                        className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-gray-500 cursor-not-allowed"
                                    />
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Pricing Tier</label>
                                <div className="mt-1 flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={partner?.pricing_class || ''}
                                        disabled
                                        className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-gray-500 cursor-not-allowed"
                                    />
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    Your pricing is tailored based on your partnership tier with KICA
                                </p>
                            </div>

                            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                                <p className="text-sm text-blue-800">
                                    <strong>Note:</strong> To modify payment type or pricing tier, please contact KICA support.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">Change Password</h3>
                            <p className="text-sm text-gray-500">Update your account password</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Current Password</label>
                                <div className="relative mt-1">
                                    <input
                                        type={showCurrentPassword ? 'text' : 'password'}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className="block w-full rounded-lg border border-gray-300 px-4 py-2 pr-10 focus:border-[#2d56c2] focus:outline-none focus:ring-1 focus:ring-[#2d56c2]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                                    >
                                        {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">New Password</label>
                                <div className="relative mt-1">
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="block w-full rounded-lg border border-gray-300 px-4 py-2 pr-10 focus:border-[#2d56c2] focus:outline-none focus:ring-1 focus:ring-[#2d56c2]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                                    >
                                        {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-[#2d56c2] focus:outline-none focus:ring-1 focus:ring-[#2d56c2]"
                                />
                            </div>

                            <button
                                onClick={handleChangePassword}
                                disabled={saving}
                                className="flex items-center gap-2 rounded-lg bg-[#2d56c2] px-4 py-2 text-white hover:bg-[#234a9f] disabled:opacity-50"
                            >
                                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                Update Password
                            </button>
                        </div>

                        <div className="border-t pt-6">
                            <h4 className="text-sm font-medium text-gray-900">Multi-Factor Authentication</h4>
                            <div className="mt-2 flex items-center gap-2">
                                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">
                                    ❌ Disabled
                                </span>
                                <Lock className="h-5 w-5 text-gray-400" />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">Contact KICA admin to enable MFA for your account</p>
                        </div>

                        {/* IP Whitelist Section */}
                        <div className="border-t pt-6">
                            <div className="mb-4">
                                <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                    <Globe className="h-4 w-4" />
                                    IP Whitelist
                                </h4>
                                <p className="text-xs text-gray-500 mt-1">
                                    Restrict API access to specific IP addresses (optional)
                                </p>
                            </div>

                            {/* Add new IP form */}
                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    value={newIpAddress}
                                    onChange={(e) => setNewIpAddress(e.target.value)}
                                    placeholder="192.168.1.1 or 10.0.0.0/24"
                                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#2d56c2] focus:outline-none focus:ring-1 focus:ring-[#2d56c2]"
                                />
                                <input
                                    type="text"
                                    value={newIpDescription}
                                    onChange={(e) => setNewIpDescription(e.target.value)}
                                    placeholder="Description (optional)"
                                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#2d56c2] focus:outline-none focus:ring-1 focus:ring-[#2d56c2]"
                                />
                                <button
                                    onClick={handleAddIp}
                                    disabled={addingIp || !newIpAddress.trim()}
                                    className="flex items-center gap-1 rounded-lg bg-[#2d56c2] px-3 py-2 text-sm text-white hover:bg-[#234a9f] disabled:opacity-50"
                                >
                                    {addingIp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    Add
                                </button>
                            </div>

                            {/* IP List */}
                            {ipWhitelist.length > 0 ? (
                                <div className="space-y-2">
                                    {ipWhitelist.map((ip) => (
                                        <div
                                            key={ip.id}
                                            className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`rounded px-2 py-0.5 text-xs font-medium ${ip.ip_type === 'cidr'
                                                        ? 'bg-purple-100 text-purple-700'
                                                        : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {ip.ip_type === 'cidr' ? 'CIDR' : 'IPv4'}
                                                </span>
                                                <span className="font-mono text-sm text-gray-900">{ip.ip_address}</span>
                                                {ip.description && (
                                                    <span className="text-sm text-gray-500">— {ip.description}</span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleDeleteIp(ip.id)}
                                                disabled={deletingIpId === ip.id}
                                                className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                                            >
                                                {deletingIpId === ip.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center">
                                    <Globe className="mx-auto h-8 w-8 text-gray-400" />
                                    <p className="mt-2 text-sm text-gray-500">No IP addresses whitelisted</p>
                                    <p className="text-xs text-gray-400">All IPs are currently allowed</p>
                                </div>
                            )}

                            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                                <p className="text-xs text-amber-800">
                                    <strong>Note:</strong> IP filtering is not yet enforced on API requests. This is for future implementation.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'billing' && billingPrefs && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">Monthly Statement Workflow</h3>
                            <p className="text-sm text-gray-500">Configure how you receive and confirm statements</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Statement Reviewer Email</label>
                                <input
                                    type="email"
                                    value={billingPrefs.statement_reviewer_email || ''}
                                    onChange={(e) => setBillingPrefs({ ...billingPrefs, statement_reviewer_email: e.target.value })}
                                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-[#2d56c2] focus:outline-none focus:ring-1 focus:ring-[#2d56c2]"
                                    placeholder="reviewer@company.com"
                                />
                                <p className="mt-1 text-xs text-gray-500">This email receives the draft statement on the 1st of each month</p>
                            </div>

                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={billingPrefs.auto_confirm_statement}
                                    onChange={(e) => setBillingPrefs({ ...billingPrefs, auto_confirm_statement: e.target.checked })}
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-[#2d56c2] focus:ring-[#2d56c2]"
                                />
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Auto-confirm after 3 days</label>
                                    <p className="text-xs text-gray-500">
                                        If unchecked, manual confirmation is required before invoice generation
                                    </p>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h4 className="text-sm font-medium text-gray-900 mb-4">Billing Contact</h4>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Billing Email</label>
                                        <input
                                            type="email"
                                            value={billingPrefs.billing_email}
                                            onChange={(e) => setBillingPrefs({ ...billingPrefs, billing_email: e.target.value })}
                                            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-[#2d56c2] focus:outline-none focus:ring-1 focus:ring-[#2d56c2]"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Billing Phone</label>
                                        <input
                                            type="tel"
                                            value={billingPrefs.billing_phone || ''}
                                            onChange={(e) => setBillingPrefs({ ...billingPrefs, billing_phone: e.target.value })}
                                            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-[#2d56c2] focus:outline-none focus:ring-1 focus:ring-[#2d56c2]"
                                            placeholder="+62xxx"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleSaveBilling}
                                disabled={saving}
                                className="flex items-center gap-2 rounded-lg bg-[#2d56c2] px-4 py-2 text-white hover:bg-[#234a9f] disabled:opacity-50"
                            >
                                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                Save Billing Settings
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'notifications' && billingPrefs && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">Email Notifications</h3>
                            <p className="text-sm text-gray-500">Manage your notification preferences</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={billingPrefs.notify_on_expiry}
                                    onChange={(e) => setBillingPrefs({ ...billingPrefs, notify_on_expiry: e.target.checked })}
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-[#2d56c2] focus:ring-[#2d56c2]"
                                />
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Certificate expiry alerts</label>
                                    <p className="text-xs text-gray-500">Receive notifications 30 days and 7 days before certificate expiration</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={billingPrefs.notify_on_new_client}
                                    onChange={(e) => setBillingPrefs({ ...billingPrefs, notify_on_new_client: e.target.checked })}
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-[#2d56c2] focus:ring-[#2d56c2]"
                                />
                                <div>
                                    <label className="text-sm font-medium text-gray-700">New client registered</label>
                                    <p className="text-xs text-gray-500">Get notified when a new client is added to your account</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={billingPrefs.notify_monthly_report}
                                    onChange={(e) => setBillingPrefs({ ...billingPrefs, notify_monthly_report: e.target.checked })}
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-[#2d56c2] focus:ring-[#2d56c2]"
                                />
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Monthly usage reports</label>
                                    <p className="text-xs text-gray-500">Receive a monthly summary of your certificate usage and spending</p>
                                </div>
                            </div>

                            <button
                                onClick={handleSaveBilling}
                                disabled={saving}
                                className="flex items-center gap-2 rounded-lg bg-[#2d56c2] px-4 py-2 text-white hover:bg-[#234a9f] disabled:opacity-50"
                            >
                                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                Save Preferences
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
