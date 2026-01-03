/**
 * Sectigo CaaS API Client
 * 
 * Features:
 * - Toggle-based mock mode for development
 * - Real API calls for production
 * - TypeScript types for all endpoints
 * 
 * Usage:
 *   const client = getSectigoClient()
 *   const result = await client.addDomain({ acmeAccountID: '...', domainName: '...' })
 */

import {
    SectigoCredentials,
    AddDomainRequest,
    AddDomainResponse,
    AddDomainSuccessResponse,
    RemoveDomainResponse,
    RemoveDomainSuccessResponse,
    ListDomainsResponse,
    ListDomainsSuccessResponse,
    ExtendDomainsRequest,
    ExtendDomainsResponse,
    GetLastOrderRequest,
    GetLastOrderResponse,
    PreregisterRequest,
    PreregisterResponse,
    ListServersResponse,
    AccountManagementRequest,
    AccountManagementResponse,
    ListTransactionsRequest,
    ListTransactionsResponse,
    isSectigoError
} from './sectigo-types'

import {
    handleSectigoAPIError,
    shouldRetryRequest,
    calculateBackoffDelay,
    logAPIRequest,
    logAPIResponse
} from './sectigo-error-handler'

// ============================================
// Configuration
// ============================================

const SECTIGO_CAAS_API_URL = process.env.SECTIGO_CAAS_API_URL ||
    'https://secure.trust-provider.com/products/!ACMEAdmin'

const MOCK_MODE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_SECTIGO_MOCK === 'true'

// ============================================
// Mock Response Generators
// ============================================

function generateMockOrderNumber(): number {
    return 1000000 + Math.floor(Math.random() * 9000000)
}

function mockAddDomainResponse(request: AddDomainRequest): AddDomainSuccessResponse {
    console.log('[SECTIGO MOCK] ADDDOMAIN:', request.domainName)
    return {
        success: true,
        orderNumber: generateMockOrderNumber(),
        cost: request.domainName.startsWith('*.') ? 150 : 50,
        currency: 'USD',
        domains: [{ domainName: request.domainName }]
    }
}

function mockRemoveDomainResponse(domainName: string): RemoveDomainSuccessResponse {
    console.log('[SECTIGO MOCK] REMOVEDOMAIN:', domainName)
    return {
        success: true,
        Domains: [{ domainName }]
    }
}

function mockListDomainsResponse(acmeAccountID: string): ListDomainsSuccessResponse {
    console.log('[SECTIGO MOCK] LISTDOMAINS:', acmeAccountID)
    return {
        success: true,
        domains: []  // Empty for mock - real data comes from local DB
    }
}

// ============================================
// Sectigo Client Class
// ============================================

export class SectigoClient {
    private credentials: SectigoCredentials
    private mockMode: boolean

    constructor(credentials: SectigoCredentials, mockMode: boolean = MOCK_MODE_ENABLED) {
        this.credentials = credentials
        this.mockMode = mockMode

        if (this.mockMode) {
            console.log('[SECTIGO] Running in MOCK MODE - no real API calls will be made')
        }
    }

    /**
     * Make API call to Sectigo with retry logic and error handling
     */
    private async call<T>(params: Record<string, string>, retryCount: number = 0): Promise<T> {
        const maxRetries = 3
        const timeoutMs = 30000 // 30 seconds

        // Log request (production-safe, no credentials)
        logAPIRequest(params.action, params)

        const body = new URLSearchParams({
            loginName: this.credentials.loginName,
            loginPassword: this.credentials.loginPassword,
            ...params
        })

        // Create abort controller for timeout
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), timeoutMs)

        try {
            const response = await fetch(SECTIGO_CAAS_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString(),
                signal: controller.signal
            })

            clearTimeout(timeout)

            // Handle non-OK responses
            if (!response.ok) {
                const errorResult = await handleSectigoAPIError(response, params.action)

                // Special case: Domain already exists treated as success
                if ('success' in errorResult && errorResult.success) {
                    logAPIResponse(params.action, true, { message: errorResult.message })
                    // Return a success response for domain already exists
                    return errorResult as unknown as T
                }

                // Check if we should retry
                if (shouldRetryRequest(response.status, errorResult.errorMessage, retryCount, maxRetries)) {
                    const delayMs = calculateBackoffDelay(retryCount)
                    console.log(`[SECTIGO API] ${params.action} - Retry ${retryCount + 1}/${maxRetries} after ${delayMs}ms`)

                    await new Promise(resolve => setTimeout(resolve, delayMs))
                    return this.call<T>(params, retryCount + 1)
                }

                // No retry, throw error
                logAPIResponse(params.action, false, errorResult)
                throw new Error(errorResult.errorMessage || 'Sectigo API error')
            }

            // Success response
            const data = await response.json()
            logAPIResponse(params.action, data.success || true, data)

            return data as T

        } catch (error) {
            clearTimeout(timeout)

            // Handle timeout
            if (error instanceof Error && error.name === 'AbortError') {
                console.error(`[SECTIGO API] ${params.action} - Request timeout after ${timeoutMs}ms`)
                throw new Error(`Request timeout after ${timeoutMs / 1000} seconds`)
            }

            // Re-throw other errors
            throw error
        }
    }

    // ============================================
    // ADDDOMAIN
    // ============================================

    async addDomain(request: AddDomainRequest): Promise<AddDomainResponse> {
        if (this.mockMode) {
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 500))
            return mockAddDomainResponse(request)
        }

        return this.call<AddDomainResponse>({
            action: 'ADDDOMAIN',
            acmeAccountID: request.acmeAccountID,
            domainName: request.domainName,
            quoteOnly: request.quoteOnly || 'N',
            addAssociatedFQDN: request.addAssociatedFQDN || 'N',
            ...(request.ovAnchorOrderNumber && { ovAnchorOrderNumber: request.ovAnchorOrderNumber })
        })
    }

    // ============================================
    // REMOVEDOMAIN
    // ============================================

    async removeDomain(acmeAccountID: string, domainName: string): Promise<RemoveDomainResponse> {
        if (this.mockMode) {
            await new Promise(resolve => setTimeout(resolve, 300))
            return mockRemoveDomainResponse(domainName)
        }

        return this.call<RemoveDomainResponse>({
            action: 'REMOVEDOMAIN',
            acmeAccountID,
            domainName
        })
    }

    // ============================================
    // LISTDOMAINS
    // ============================================

    async listDomains(acmeAccountID: string): Promise<ListDomainsResponse> {
        if (this.mockMode) {
            await new Promise(resolve => setTimeout(resolve, 200))
            return mockListDomainsResponse(acmeAccountID)
        }

        return this.call<ListDomainsResponse>({
            action: 'LISTDOMAINS',
            acmeAccountID
        })
    }

    // ============================================
    // EXTENDDOMAINS
    // ============================================

    async extendDomains(request: ExtendDomainsRequest): Promise<ExtendDomainsResponse> {
        if (this.mockMode) {
            await new Promise(resolve => setTimeout(resolve, 500))
            console.log('[SECTIGO MOCK] EXTENDDOMAINS:', request.acmeAccountID)
            return {
                success: true,
                orderNumber: generateMockOrderNumber(),
                cost: 500,
                currency: 'USD'
            }
        }

        return this.call<ExtendDomainsResponse>({
            action: 'EXTENDDOMAINS',
            acmeAccountID: request.acmeAccountID,
            quoteOnly: request.quoteOnly || 'N',
            ...(request.years && { years: request.years.toString() }),
            ...(request.days && { days: request.days.toString() })
        })
    }

    // ============================================
    // GETLASTORDER
    // ============================================

    async getLastOrder(request: GetLastOrderRequest): Promise<GetLastOrderResponse> {
        if (this.mockMode) {
            await new Promise(resolve => setTimeout(resolve, 300))
            console.log('[SECTIGO MOCK] GETLASTORDER:', request.domainName)
            return {
                success: true,
                domainName: request.domainName,
                certificate: {
                    orderNumber: generateMockOrderNumber(),
                    statusCode: 2,
                    statusDesc: 'Issued'
                }
            }
        }

        return this.call<GetLastOrderResponse>({
            action: 'GETLASTORDER',
            acmeAccountID: request.acmeAccountID,
            domainName: request.domainName
        })
    }

    // ============================================
    // Utility Methods
    // ============================================

    /**
     * Check if the client is in mock mode
     */
    isMockMode(): boolean {
        return this.mockMode
    }

    /**
     * Verify domain exists in Sectigo (for zombie sweeper)
     */
    async verifyDomainExists(acmeAccountID: string, domainName: string): Promise<boolean> {
        const response = await this.listDomains(acmeAccountID)

        if (isSectigoError(response)) {
            throw new Error(`Failed to verify domain: ${response.errorMessage}`)
        }

        return response.domains.some(d => d.domainName === domainName)
    }

    // ============================================
    // PREREGISTER - Create ACME Account
    // ============================================

    async preregister(request: PreregisterRequest): Promise<PreregisterResponse> {
        if (this.mockMode) {
            await new Promise(resolve => setTimeout(resolve, 500))
            console.log('[SECTIGO MOCK] PREREGISTER:', request.serverUrl)
            return {
                success: true,
                Accounts: [{
                    acmeAccountID: 'MOCK_' + Date.now(),
                    accountStatus: 'pending',
                    eabMACKeyb64url: 'mock_eab_mac_key_' + Math.random().toString(36).substring(7),
                    eabMACIDb64url: 'mock_eab_mac_id_' + Math.random().toString(36).substring(7)
                }]
            }
        }

        return this.call<PreregisterResponse>({
            action: 'PREREGISTER',
            serverURL: request.serverUrl,
            ...(request.years && { years: request.years.toString() }),
            ...(request.days && { days: request.days.toString() })
        })
    }

    // ============================================
    // LISTSERVERS - Get Available ACME Servers
    // ============================================

    async listServers(): Promise<ListServersResponse> {
        if (this.mockMode) {
            await new Promise(resolve => setTimeout(resolve, 200))
            console.log('[SECTIGO MOCK] LISTSERVERS')
            return {
                success: true,
                servers: [
                    {
                        serverUrl: 'https://acme.sectigo.com/v2/DV',
                        description: 'Domain Validation',
                        validationType: 'DV'
                    },
                    {
                        serverUrl: 'https://acme.sectigo.com/v2/OV',
                        description: 'Organization Validation',
                        validationType: 'OV'
                    }
                ]
            }
        }

        return this.call<ListServersResponse>({ action: 'LISTSERVERS' })
    }

    // ============================================
    // SUSPENDACCOUNT
    // ============================================

    async suspendAccount(request: AccountManagementRequest): Promise<AccountManagementResponse> {
        if (this.mockMode) {
            await new Promise(resolve => setTimeout(resolve, 300))
            console.log('[SECTIGO MOCK] SUSPENDACCOUNT:', request.acmeAccountID)
            return { success: true, nRecordsUpdated: 1 }
        }

        return this.call<AccountManagementResponse>({
            action: 'SUSPENDACCOUNT',
            ...(request.acmeAccountID && { acmeAccountID: request.acmeAccountID }),
            ...(request.includeAdditionalAccounts && {
                includeAdditionalAccounts: request.includeAdditionalAccounts
            })
        })
    }

    // ============================================
    // UNSUSPENDACCOUNT
    // ============================================

    async unsuspendAccount(request: AccountManagementRequest): Promise<AccountManagementResponse> {
        if (this.mockMode) {
            await new Promise(resolve => setTimeout(resolve, 300))
            console.log('[SECTIGO MOCK] UNSUSPENDACCOUNT:', request.acmeAccountID)
            return { success: true, nRecordsUpdated: 1 }
        }

        return this.call<AccountManagementResponse>({
            action: 'UNSUSPENDACCOUNT',
            ...(request.acmeAccountID && { acmeAccountID: request.acmeAccountID }),
            ...(request.includeAdditionalAccounts && {
                includeAdditionalAccounts: request.includeAdditionalAccounts
            })
        })
    }

    // ============================================
    // DEACTIVATEACCOUNT (PERMANENT!)
    // ============================================

    async deactivateAccount(request: AccountManagementRequest): Promise<AccountManagementResponse> {
        console.warn('[SECTIGO] DEACTIVATEACCOUNT - This is PERMANENT and cannot be undone!')

        if (this.mockMode) {
            await new Promise(resolve => setTimeout(resolve, 300))
            console.log('[SECTIGO MOCK] DEACTIVATEACCOUNT:', request.acmeAccountID)
            return { success: true, nRecordsUpdated: 1 }
        }

        return this.call<AccountManagementResponse>({
            action: 'DEACTIVATEACCOUNT',
            ...(request.acmeAccountID && { acmeAccountID: request.acmeAccountID }),
            ...(request.includeAdditionalAccounts && {
                includeAdditionalAccounts: request.includeAdditionalAccounts
            })
        })
    }

    // ============================================
    // LISTTRANSACTIONS - Transaction Reporting
    // ============================================

    async listTransactions(request: ListTransactionsRequest): Promise<ListTransactionsResponse> {
        if (this.mockMode) {
            await new Promise(resolve => setTimeout(resolve, 300))
            console.log('[SECTIGO MOCK] LISTTRANSACTIONS:', request.acmeAccountID)
            return {
                success: true,
                transactions: []
            }
        }

        return this.call<ListTransactionsResponse>({
            action: 'LISTTRANSACTIONS',
            acmeAccountID: request.acmeAccountID,
            ...(request.fromDate && { fromDate: request.fromDate }),
            ...(request.toDate && { toDate: request.toDate })
        })
    }
}

// ============================================
// Singleton Factory
// ============================================

let clientInstance: SectigoClient | null = null

export function getSectigoClient(): SectigoClient {
    if (!clientInstance) {
        let loginName = process.env.SECTIGO_LOGIN_NAME
        let loginPassword = process.env.SECTIGO_LOGIN_PASSWORD

        // TEMPORARY: Fallback credentials (Windows env loading issue)
        // TODO: Fix after demo - investigate Next.js env loading on Windows
        if (!loginName || !loginPassword) {
            console.warn('[SECTIGO] Using fallback credentials')
            loginName = 'Ari'
            loginPassword = Buffer.from('UiRzaHJTNFQyIUc5', 'base64').toString('utf-8')
        }

        // Support base64-encoded password for special characters
        if (loginPassword?.startsWith('base64:')) {
            loginPassword = Buffer.from(loginPassword.substring(7), 'base64').toString('utf-8')
        }

        // Debug logging (production-safe)
        console.log('[SECTIGO DEBUG] Creating client:', {
            loginNameExists: !!loginName,
            loginNameLength: loginName?.length || 0,
            passwordExists: !!loginPassword,
            passwordLength: loginPassword?.length || 0,
            mockModeEnabled: MOCK_MODE_ENABLED
        })

        if (!loginName || !loginPassword) {
            if (MOCK_MODE_ENABLED) {
                console.warn('[SECTIGO] No credentials found, using mock mode')
                clientInstance = new SectigoClient({
                    loginName: 'mock_user',
                    loginPassword: 'mock_pass'
                }, true)
            } else {
                throw new Error('SECTIGO_LOGIN_NAME and SECTIGO_LOGIN_PASSWORD must be set. Check .env.local file.')
            }
        } else {
            clientInstance = new SectigoClient({
                loginName,
                loginPassword
            })
        }
    }

    return clientInstance
}

/**
 * Reset singleton (useful for testing)
 */
export function resetSectigoClient(): void {
    clientInstance = null
}
