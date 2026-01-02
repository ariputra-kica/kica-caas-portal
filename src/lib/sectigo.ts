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
     * Make API call to Sectigo
     */
    private async call<T>(params: Record<string, string>): Promise<T> {
        const body = new URLSearchParams({
            loginName: this.credentials.loginName,
            loginPassword: this.credentials.loginPassword,
            ...params
        })

        console.log(`[SECTIGO API] ${params.action} - Calling...`)

        const response = await fetch(SECTIGO_CAAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        })

        if (!response.ok) {
            console.error(`[SECTIGO API] HTTP Error: ${response.status}`)
            throw new Error(`Sectigo API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        console.log(`[SECTIGO API] ${params.action} - Response:`, data.success ? 'SUCCESS' : 'FAILED')

        return data as T
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
        const loginName = process.env.SECTIGO_LOGIN_NAME
        const loginPassword = process.env.SECTIGO_LOGIN_PASSWORD

        if (!loginName || !loginPassword) {
            if (MOCK_MODE_ENABLED) {
                console.warn('[SECTIGO] No credentials found, using mock mode with dummy credentials')
                clientInstance = new SectigoClient({
                    loginName: 'mock_user',
                    loginPassword: 'mock_pass'
                }, true)
            } else {
                throw new Error('SECTIGO_LOGIN_NAME and SECTIGO_LOGIN_PASSWORD must be set when mock mode is disabled')
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
