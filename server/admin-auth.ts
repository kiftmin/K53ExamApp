import { storage } from "./storage.js";
import { isValidMobile } from "./access-code.js";

export interface AdminCheckResult {
  valid: boolean;
  /** Reason the check failed — server-side logging only. Never send to clients:
   *  distinct messages let an attacker confirm key validity and key↔mobile
   *  linkage without holding both halves of the credential. */
  message?: string;
}

const GENERIC_ADMIN_FAILURE = "Invalid admin credentials.";

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
    console.warn(`Admin auth failed: unknown or revoked key ${normalized.slice(0, 2)}***`);
    return { valid: false, message: GENERIC_ADMIN_FAILURE };
  }
  if ((stored.mobile_number || '').trim() !== mobile) {
    console.warn(`Admin auth failed: mobile mismatch for key ${normalized.slice(0, 2)}***`);
    return { valid: false, message: GENERIC_ADMIN_FAILURE };
  }
  if (!stored.has_admin_access) {
    console.warn(`Admin auth failed: key ${normalized.slice(0, 2)}*** lacks admin access`);
    return { valid: false, message: GENERIC_ADMIN_FAILURE };
  }
  if (await storage.isMobileSuspended(mobile)) {
    console.warn(`Admin auth failed: mobile ${mobile.slice(0, 3)}****** suspended`);
    return { valid: false, message: "This mobile number has been suspended." };
  }
  return { valid: true };
}

/** Express middleware: requires x-admin-key + x-admin-mobile headers to pass validateAdminAccess. */
export async function requireAdminAuth(req: any, res: any, next: any) {
  const key = req.headers['x-admin-key'];
  const mobile = req.headers['x-admin-mobile'];
  const result = await validateAdminAccess(String(key || ''), String(mobile || ''));
  if (!result.valid) {
    return res.status(401).json({ message: "Admin authentication required." });
  }
  next();
}
