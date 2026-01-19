/**
 * Maps raw error codes to user-friendly messages
 * Prevents exposure of internal database/system details
 */

// Database error codes (PostgreSQL)
const DB_ERROR_MAP: Record<string, string> = {
  '23505': 'This record already exists',
  '23503': 'Related record not found',
  '23502': 'Required information is missing',
  '23514': 'The value provided is not valid',
  '42501': 'You do not have permission to perform this action',
  '42P01': 'The requested resource was not found',
  '22P02': 'Invalid input format',
  '28P01': 'Authentication failed',
  '40001': 'Please try again',
  '57014': 'Operation timed out. Please try again',
};

// PostgREST error codes
const POSTGREST_ERROR_MAP: Record<string, string> = {
  'PGRST116': 'The requested record was not found',
  'PGRST301': 'Connection error. Please check your network',
  'PGRST302': 'Request timeout. Please try again',
};

// Supabase Auth error codes
const AUTH_ERROR_MAP: Record<string, string> = {
  'invalid_credentials': 'Invalid email or password',
  'user_not_found': 'Invalid email or password',
  'invalid_grant': 'Invalid email or password',
  'email_not_confirmed': 'Please verify your email address',
  'user_already_exists': 'An account with this email already exists',
  'email_taken': 'An account with this email already exists',
  'weak_password': 'Password is too weak. Please use a stronger password',
  'invalid_email': 'Please enter a valid email address',
  'signup_disabled': 'Sign up is currently disabled',
  'email_change_email_not_authorized': 'Email change is not authorized',
  'otp_expired': 'The verification code has expired. Please request a new one',
  'otp_disabled': 'Verification is currently disabled',
  'session_not_found': 'Your session has expired. Please sign in again',
  'refresh_token_not_found': 'Your session has expired. Please sign in again',
  'user_banned': 'Your account has been suspended',
  'over_request_rate_limit': 'Too many attempts. Please try again later',
  'over_email_send_rate_limit': 'Too many email requests. Please try again later',
};

// Common error message patterns
const ERROR_MESSAGE_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /duplicate key/i, message: 'This record already exists' },
  { pattern: /violates foreign key/i, message: 'Related record not found' },
  { pattern: /violates not-null/i, message: 'Required information is missing' },
  { pattern: /violates check constraint/i, message: 'The value provided is not valid' },
  { pattern: /permission denied/i, message: 'You do not have permission to perform this action' },
  { pattern: /row-level security/i, message: 'You do not have access to this resource' },
  { pattern: /network/i, message: 'Network error. Please check your connection' },
  { pattern: /timeout/i, message: 'Request timed out. Please try again' },
  { pattern: /invalid password/i, message: 'Invalid email or password' },
  { pattern: /email not confirmed/i, message: 'Please verify your email address' },
  { pattern: /already registered/i, message: 'An account with this email already exists' },
  { pattern: /rate limit/i, message: 'Too many attempts. Please try again later' },
];

/**
 * Extracts error code from various error object formats
 */
function extractErrorCode(error: any): string | null {
  if (!error) return null;
  
  // Direct code property
  if (error.code) return String(error.code);
  
  // Error code variations
  if (error.error_code) return String(error.error_code);
  if (error.errorCode) return String(error.errorCode);
  
  // Nested in error object
  if (error.error?.code) return String(error.error.code);
  
  // Supabase specific
  if (error.__isAuthError && error.status) return String(error.status);
  
  return null;
}

/**
 * Extracts error message from various error object formats
 */
function extractErrorMessage(error: any): string | null {
  if (!error) return null;
  
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  if (error.error_description) return error.error_description;
  if (error.msg) return error.msg;
  if (error.error?.message) return error.error.message;
  
  return null;
}

/**
 * Returns a safe, user-friendly error message
 * Does not expose internal database or system details
 */
export function getSafeErrorMessage(error: any, defaultMessage?: string): string {
  const fallback = defaultMessage || 'An error occurred. Please try again or contact support.';
  
  if (!error) return fallback;
  
  // Extract error code and message
  const code = extractErrorCode(error);
  const message = extractErrorMessage(error);
  
  // Check error code maps
  if (code) {
    if (DB_ERROR_MAP[code]) return DB_ERROR_MAP[code];
    if (POSTGREST_ERROR_MAP[code]) return POSTGREST_ERROR_MAP[code];
    if (AUTH_ERROR_MAP[code]) return AUTH_ERROR_MAP[code];
  }
  
  // Check message patterns
  if (message) {
    for (const { pattern, message: safeMessage } of ERROR_MESSAGE_PATTERNS) {
      if (pattern.test(message)) {
        return safeMessage;
      }
    }
  }
  
  return fallback;
}

/**
 * Returns a safe authentication error message
 * Specifically designed to prevent user enumeration attacks
 */
export function getSafeAuthErrorMessage(error: any): string {
  const code = extractErrorCode(error);
  const message = extractErrorMessage(error);
  
  // For security, use the same message for user not found and invalid credentials
  // This prevents attackers from enumerating valid emails
  if (code && AUTH_ERROR_MAP[code]) {
    return AUTH_ERROR_MAP[code];
  }
  
  // Check message patterns for auth-specific errors
  if (message) {
    if (/invalid.*password/i.test(message) || /user.*not.*found/i.test(message)) {
      return 'Invalid email or password';
    }
    if (/email.*not.*confirmed/i.test(message)) {
      return 'Please verify your email address';
    }
    if (/already.*exists/i.test(message) || /already.*registered/i.test(message)) {
      return 'An account with this email already exists';
    }
  }
  
  return 'Authentication failed. Please check your credentials and try again.';
}

/**
 * Logs error details in development only
 * Use this alongside getSafeErrorMessage for debugging
 */
export function logErrorInDev(context: string, error: any): void {
  if (import.meta.env.DEV) {
    console.error(`[${context}] Full error:`, error);
  }
}
