'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, X, CheckCircle, XCircle } from 'lucide-react'

interface RemoveDomainModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    domainName: string
    priceCharged: number
    daysSinceAdded: number
    isRefundable: boolean
}

export default function RemoveDomainModal({
    isOpen,
    onClose,
    onConfirm,
    domainName,
    priceCharged,
    daysSinceAdded,
    isRefundable
}: RemoveDomainModalProps) {
    const [confirmText, setConfirmText] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)

    const requiredText = isRefundable ? 'REFUND' : 'REMOVE'
    const isConfirmEnabled = confirmText.toUpperCase() === requiredText

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setConfirmText('')
            setIsProcessing(false)
        }
    }, [isOpen])

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose()
            }
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [isOpen, onClose])

    const handleConfirm = async () => {
        if (!isConfirmEnabled) return
        setIsProcessing(true)
        await onConfirm()
        setIsProcessing(false)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative w-full max-w-md transform rounded-xl bg-white shadow-2xl transition-all">
                    {/* Header */}
                    <div className={`flex items-center gap-3 rounded-t-xl px-6 py-4 ${isRefundable ? 'bg-green-50' : 'bg-red-50'
                        }`}>
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isRefundable ? 'bg-green-100' : 'bg-red-100'
                            }`}>
                            {isRefundable ? (
                                <CheckCircle className="h-6 w-6 text-green-600" />
                            ) : (
                                <AlertTriangle className="h-6 w-6 text-red-600" />
                            )}
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900">
                                Remove Domain
                            </h3>
                            <p className={`text-sm ${isRefundable ? 'text-green-700' : 'text-red-700'}`}>
                                {isRefundable ? '✓ Eligible for refund' : '✕ No refund available'}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="px-6 py-5">
                        {/* Domain info */}
                        <div className="mb-4 rounded-lg bg-gray-50 p-4">
                            <p className="text-sm text-gray-500">Domain to remove:</p>
                            <p className="mt-1 text-lg font-semibold text-gray-900">{domainName}</p>
                            <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                                <span>Price: ${priceCharged.toFixed(2)}</span>
                                <span>•</span>
                                <span>Added {daysSinceAdded} days ago</span>
                            </div>
                        </div>

                        {/* Consequences */}
                        <div className="mb-5">
                            <p className="mb-2 text-sm font-medium text-gray-700">What will happen:</p>
                            <ul className="space-y-2 text-sm text-gray-600">
                                <li className="flex items-start gap-2">
                                    <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                                    <span>Certificate auto-renewal will <strong>STOP</strong></span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                                    <span>Existing certificates remain valid until their expiry date</span>
                                </li>
                                {isRefundable ? (
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                                        <span className="text-green-700">
                                            <strong>${priceCharged.toFixed(2)} will be credited</strong> back to your account
                                        </span>
                                    </li>
                                ) : (
                                    <li className="flex items-start gap-2">
                                        <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                                        <span className="text-red-700">
                                            <strong>No refund</strong> - beyond 30-day refund window
                                        </span>
                                    </li>
                                )}
                                <li className="flex items-start gap-2">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                                    <span>This action <strong>cannot be undone</strong></span>
                                </li>
                            </ul>
                        </div>

                        {/* Confirmation input */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700">
                                Type <span className={`font-bold ${isRefundable ? 'text-green-600' : 'text-red-600'}`}>
                                    {requiredText}
                                </span> to confirm:
                            </label>
                            <input
                                type="text"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder={requiredText}
                                className={`mt-2 w-full rounded-lg border px-4 py-2.5 text-center text-lg font-mono tracking-widest transition-colors ${confirmText === ''
                                        ? 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                        : isConfirmEnabled
                                            ? 'border-green-500 bg-green-50 text-green-700 focus:ring-2 focus:ring-green-500'
                                            : 'border-red-300 bg-red-50 text-red-700'
                                    } focus:outline-none`}
                                autoComplete="off"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 rounded-b-xl border-t border-gray-100 bg-gray-50 px-6 py-4">
                        <button
                            onClick={onClose}
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!isConfirmEnabled || isProcessing}
                            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-all focus:outline-none focus:ring-2 ${isRefundable
                                    ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500 disabled:bg-green-300'
                                    : 'bg-red-600 hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300'
                                } disabled:cursor-not-allowed`}
                        >
                            {isProcessing ? (
                                <span className="flex items-center gap-2">
                                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Processing...
                                </span>
                            ) : (
                                isRefundable ? 'Remove & Refund' : 'Remove Domain'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
