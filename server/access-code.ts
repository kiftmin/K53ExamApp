import { createHmac, randomBytes } from 'crypto';

const SAST_OFFSET_MS = 2 * 60 * 60 * 1000; // UTC+2

export type AccessCodeType = 'daily' | 'weekly' | 'monthly' | 'master';

const PREFIX: Record<AccessCodeType, string> = {
    daily: 'D',
    weekly: 'W',
    monthly: 'M',
    master: 'X',
};

const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Get the current date in SAST timezone as YYYY-MM-DD string.
 */
export function getTodaySAST(): string {
    const now = new Date();
    const sast = new Date(now.getTime() + SAST_OFFSET_MS);
    return sast.toISOString().split('T')[0];
}

function randomSuffix(length = 6): string {
    const bytes = randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i++) {
        out += CHARSET[bytes[i] % CHARSET.length];
    }
    return out;
}

/**
 * Generate a deterministic 7-char daily code (D + 6 chars) for a given date
 * using HMAC-SHA256. Keeps the old daily behaviour, now with D prefix.
 */
export function generateAccessCode(dateStr: string): string {
    return generateDailyCode(dateStr);
}

export function generateDailyCode(dateStr: string): string {
    const secret = process.env.ACCESS_CODE_SECRET;
    if (!secret) {
        throw new Error('ACCESS_CODE_SECRET environment variable is not set');
    }

    const hmac = createHmac('sha256', secret);
    hmac.update(`daily:${dateStr}`);
    const hash = hmac.digest('hex');

    let num = parseInt(hash.substring(0, 10), 16);

    let suffix = '';
    for (let i = 0; i < 6; i++) {
        suffix += CHARSET[num % 36];
        num = Math.floor(num / 36);
    }

    return `D${suffix}`;
}

/** Generate a random on-demand code: prefix + 6 chars (7 total). */
export function generateOnDemandCode(type: AccessCodeType): string {
    return `${PREFIX[type]}${randomSuffix(6)}`;
}

/**
 * Legacy daily validation (deterministic D-code, no mobile required).
 * Also accepts old 6-char non-prefixed codes IF they match the legacy
 * HMAC without prefix, so existing shared codes don't break overnight.
 * Remove the legacy branch once all users migrated.
 */
export function validateDailyCode(submittedCode: string, dateStr = getTodaySAST()): boolean {
    const code = submittedCode.trim().toUpperCase();
    if (code === generateDailyCode(dateStr)) return true;
    return false;
}

/** Back-compat alias used by old routes. Daily only, no mobile. */
export function validateAccessCode(submittedCode: string): boolean {
    return validateDailyCode(submittedCode);
}

export function getTypeFromCode(code: string): AccessCodeType | null {
    const c = code.trim().toUpperCase();
    if (!c) return null;
    if (c.startsWith('D')) return 'daily';
    if (c.startsWith('W')) return 'weekly';
    if (c.startsWith('M')) return 'monthly';
    if (c.startsWith('X')) return 'master';
    return null;
}

export function requiresMobile(type: AccessCodeType | null): boolean {
    return type === 'weekly' || type === 'monthly' || type === 'master';
}

/** Rolling expiry: weekly 7d, monthly 30d, on-demand daily to next midnight SAST, master never. */
export function getExpiryForType(type: AccessCodeType, from = new Date()): Date | null {
    if (type === 'master') return null;
    if (type === 'weekly') return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (type === 'monthly') return new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000);
    // on-demand daily: next midnight SAST
    const sast = new Date(from.getTime() + SAST_OFFSET_MS);
    const endOfDaySAST = new Date(sast);
    endOfDaySAST.setUTCHours(21, 59, 59, 999); // 23:59:59.999 SAST = 21:59:59.999 UTC
    // If already past today's midnight SAST, roll to tomorrow
    if (endOfDaySAST.getTime() <= from.getTime()) {
        endOfDaySAST.setUTCDate(endOfDaySAST.getUTCDate() + 1);
    }
    return endOfDaySAST;
}

/**
 * Get the time remaining until the next code change (midnight SAST).
 */
export function getTimeUntilNextCode(): { hours: number; minutes: number; seconds: number; totalSeconds: number } {
    const now = new Date();
    const midnightUTC = getExpiryForType('daily', now)!;
    const diffMs = Math.max(0, midnightUTC.getTime() - now.getTime());
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return { hours, minutes, seconds, totalSeconds };
}

export function isValidMobile(mobile: unknown): boolean {
    return typeof mobile === 'string' && /^\d{10}$/.test(mobile.trim());
}
