import { createHmac } from 'crypto';

const SAST_OFFSET_MS = 2 * 60 * 60 * 1000; // UTC+2

/**
 * Get the current date in SAST timezone as YYYY-MM-DD string.
 */
export function getTodaySAST(): string {
    const now = new Date();
    const sast = new Date(now.getTime() + SAST_OFFSET_MS);
    return sast.toISOString().split('T')[0];
}

/**
 * Generate a 6-digit access code for a given date using HMAC-SHA256.
 * The secret key is stored in the environment variable ACCESS_CODE_SECRET.
 * 
 * This is cryptographically secure — even with many date/code pairs,
 * the secret key cannot be reverse-engineered (same principle as TOTP/bank OTPs).
 */
export function generateAccessCode(dateStr: string): string {
    const secret = process.env.ACCESS_CODE_SECRET;
    if (!secret) {
        throw new Error('ACCESS_CODE_SECRET environment variable is not set');
    }

    const hmac = createHmac('sha256', secret);
    hmac.update(dateStr);
    const hash = hmac.digest('hex');

    // Extract a 6-character alphanumeric code from the hash
    // Map the first 12 hex chars (48 bits) to 6 alphanumeric characters
    // Character set: 0-9, A-Z (base 36)
    const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';

    // We take segments of the hash to pick characters from the charset
    // 8 hex chars = 32 bits, which is plenty to pick 6 chars from a 36-char set
    // (36^6 is ~2.1 billion, 2^32 is ~4.3 billion)
    let num = parseInt(hash.substring(0, 10), 16);

    for (let i = 0; i < 6; i++) {
        code += charset[num % 36];
        num = Math.floor(num / 36);
    }

    return code;
}

/**
 * Validate a user-submitted access code against today's code.
 */
export function validateAccessCode(submittedCode: string): boolean {
    const todayCode = generateAccessCode(getTodaySAST());
    return submittedCode === todayCode;
}

/**
 * Get the time remaining until the next code change (midnight SAST).
 */
export function getTimeUntilNextCode(): { hours: number; minutes: number; seconds: number; totalSeconds: number } {
    const now = new Date();
    const sast = new Date(now.getTime() + SAST_OFFSET_MS);

    const endOfDay = new Date(sast);
    endOfDay.setHours(23, 59, 59, 999);

    const diffMs = endOfDay.getTime() - sast.getTime();
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return { hours, minutes, seconds, totalSeconds };
}
