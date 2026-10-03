import { storage } from "./storage.js";
import { isValidMobile } from "./access-code.js";

export interface AdminCheckResult {
  valid: boolean;
  message?: string;
  mobileMatch?: boolean;
}

/**
 * Shared admin-credential check — used by both the public
 * /api/access-codes/validate-admin route and requireAdminAuth.
 * Only master (X) keys flagged has_admin_access, non-revoked,
 * with matching linked mobile qualify.
 */
export async function validateAdminAccess(code: string, mobileNumber: string): Promise<AdminCheckResult> {
  const normalized = (code || '').trim().toUpperCase();
  const mobile = (mobileNumber || '').trim();

  if (!normalized.startsWith('X')) {
    return { valid: false, message: "Admin access requires a master (X) key." };
  }
  if (!isValidMobile(mobile)) {
    return { valid: false, message: "A 10-digit mobile number is required." };
  }

  const stored = await storage.getAccessCodeByCode(normalized);
  if (!stored || stored.type !== 'master' || stored.is_revoked) {
    const mobileExists = stored && (stored.mobile_number || '').trim() === mobile;
    return { valid: false, message: "Invalid master key.", mobileMatch: !!mobileExists };
  }
  if ((stored.mobile_number || '').trim() !== mobile) {
    return { valid: false, message: "Mobile number does not match this master key." };
  }
  if (!stored.has_admin_access) {
    return { valid: false, message: "This master key does not have admin access." };
  }
  return { valid: true };
}

/** Express middleware: requires x-admin-key + x-admin-mobile headers to pass validateAdminAccess. */
export async function requireAdminAuth(req: any, res: any, next: any) {
  const key = req.headers['x-admin-key'];
  const mobile = req.headers['x-admin-mobile'];
  const result = await validateAdminAccess(String(key || ''), String(mobile || ''));
  if (!result.valid) {
    return res.status(401).json({ message: result.message || "Admin authentication required." });
  }
  next();
}
