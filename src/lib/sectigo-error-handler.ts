/**
 * Sectigo CaaS API Error Handler
 * 
 * Handles specific error cases from Sectigo API according to API reference:
 * - 403 "domain already exists" → Treat as success
 * - 429 Rate limiting → Implement retry with exponential backoff
 * - 400 Missing parameters → Clear validation error
 * - 401 Unauthorized → Credential validation error
 * 
 * Reference: docs/sectigo_caas_api_reference.md Section 6
 */

export interface SectigoErrorResponse {
    success: false
    errorType?: string
    errorMessage?: string
    errorCode?: number
    details?: string
}

export interface RetryConfig {
    maxRetries: number
    currentRetry: number
    delayMs: number
}

/**
 * Check if error is "domain already exists" which should be treated as success
 */
export function isDomainAlreadyExistsError(errorMessage: string): boolean {
    const patterns = [
        /domain.*already.*present/i,
        /domain.*already.*subscribed/i,
        /subscription.*already.*exists/i
    ]
    return patterns.some(pattern => pattern.test(errorMessage))
}

/**
 * Check if error is subscription expired
 */
export function isSubscriptionExpiredError(errorMessage: string): boolean {
    const patterns = [
        /subscription.*expired/i,
        /renew.*subscription.*before/i
    ]
    return patterns.some(pattern => pattern.test(errorMessage))
}

/**
 * Check if error is rate limiting
 */
export function isRateLimitError(status: number, errorMessage?: string): boolean {
    if (status === 429) return true
    if (errorMessage && /rate.*limit.*exceeded/i.test(errorMessage)) return true
    return false
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoffDelay(retryCount: number): number {
    // Exponential backoff: 2s, 4s, 8s
    const baseDelay = 2000
    return baseDelay * Math.pow(2, retryCount)
}

/**
 * Determine if request should be retried
 */
export function shouldRetryRequest(
    status: number,
    errorMessage: string | undefined,
    currentRetry: number,
    maxRetries: number = 3
): boolean {
    if (currentRetry >= maxRetries) return false

    // Retry on rate limiting
    if (isRateLimitError(status, errorMessage)) return true

    // Retry on network errors (5xx)
    if (status >= 500 && status < 600) return true

    return false
}

/**
 * Extract user-friendly error message from Sectigo API response
 */
export function extractErrorMessage(error: SectigoErrorResponse): string {
    if (error.errorMessage) return error.errorMessage
    if (error.details) return error.details
    if (error.errorType) return `Error type: ${error.errorType}`
    return 'Unknown error occurred'
}

/**
 * Handle Sectigo API error response
 * Returns a structured error or success indicator for special cases
 */
export async function handleSectigoAPIError(
    response: Response,
    action: string
): Promise<SectigoErrorResponse | { success: true; message: string }> {
    const status = response.status
    let errorData: any

    try {
        errorData = await response.json()
    } catch {
        errorData = { errorMessage: response.statusText }
    }

    const errorMessage = errorData.errorMessage || errorData.details || response.statusText

    // Special case: Domain already exists (403) - treat as success
    if (status === 403 && isDomainAlreadyExistsError(errorMessage)) {
        console.log(`[SECTIGO] ${action} - Domain already subscribed, treating as success`)
        return {
            success: true,
            message: 'Domain already subscribed (existing subscription found)'
        }
    }

    // Special case: Subscription expired - provide clear guidance
    if (status === 403 && isSubscriptionExpiredError(errorMessage)) {
        return {
            success: false,
            errorType: 'urn:ietf:params:acme:error:unauthorized',
            errorMessage: 'Subscription has expired. Please extend the subscription using EXTENDDOMAINS action.',
            errorCode: status,
            details: errorMessage
        }
    }

    // Rate limiting - will be handled by retry logic
    if (isRateLimitError(status, errorMessage)) {
        return {
            success: false,
            errorType: 'urn:ietf:params:acme:error:rateLimited',
            errorMessage: 'Rate limit exceeded. Request will be retried automatically.',
            errorCode: status,
            details: errorMessage
        }
    }

    // Missing parameters (400)
    if (status === 400) {
        return {
            success: false,
            errorType: 'urn:ietf:params:acme:error:malformed',
            errorMessage: errorMessage || 'Invalid request parameters',
            errorCode: status,
            details: 'Check that all required parameters are provided correctly'
        }
    }

    // Unauthorized (401)
    if (status === 401) {
        return {
            success: false,
            errorType: 'urn:ietf:params:acme:error:unauthorized',
            errorMessage: 'Authentication failed. Please check SECTIGO_LOGIN_NAME and SECTIGO_LOGIN_PASSWORD.',
            errorCode: status,
            details: errorMessage
        }
    }

    // Generic error
    return {
        success: false,
        errorType: errorData.errorType || 'urn:ietf:params:acme:error:serverInternal',
        errorMessage: errorMessage,
        errorCode: status,
        details: errorData.details
    }
}

/**
 * Log API request for debugging (production-safe, no credentials)
 */
export function logAPIRequest(action: string, params: Record<string, string>) {
    const safeParams = { ...params }
    delete safeParams.loginName
    delete safeParams.loginPassword

    console.log(`[SECTIGO API] ${action}`, {
        timestamp: new Date().toISOString(),
        action,
        params: safeParams
    })
}

/**
 * Log API response for debugging
 */
export function logAPIResponse(action: string, success: boolean, data?: any) {
    const logLevel = success ? 'log' : 'error'
    console[logLevel](`[SECTIGO API] ${action} - ${success ? 'SUCCESS' : 'FAILED'}`, {
        timestamp: new Date().toISOString(),
        success,
        ...(data && { data })
    })
}
