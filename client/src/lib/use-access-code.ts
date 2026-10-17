import { useState, useEffect, useCallback } from "react";

const CODE_PREFIX_REQUIRES_MOBILE = ["W", "M", "X"];

export interface UseAccessCodeReturn {
  code: string;
  mobile: string;
  validated: boolean;
  requiresMobile: boolean;
  error: string;
  loading: boolean;
  setCode: (next: string) => void;
  setMobile: (next: string) => void;
  verify: () => Promise<void>;
  clear: () => void;
}

export function useAccessCode(): UseAccessCodeReturn {
  const [code, setCodeState] = useState("");
  const [mobile, setMobileState] = useState("");
  const [validated, setValidated] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedCode = sessionStorage.getItem("k53_access_code");
    const savedMobile = sessionStorage.getItem("k53_mobile_number");
    if (savedCode) {
      setCodeState(savedCode);
      setMobileState(savedMobile || "");
      setValidated(true);
    }
  }, []);

  const requiresMobile = CODE_PREFIX_REQUIRES_MOBILE.includes(
    code.charAt(0)?.toUpperCase() || ""
  );

  const setCode = useCallback((next: string) => {
    const val = next.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 7);
    setCodeState(val);
    if (validated) {
      setValidated(false);
      sessionStorage.removeItem("k53_access_code");
    }
    setError("");
  }, [validated]);

  const setMobile = useCallback((next: string) => {
    const val = next.replace(/\D/g, "").slice(0, 10);
    setMobileState(val);
    if (validated) {
      setValidated(false);
      sessionStorage.removeItem("k53_access_code");
    }
    setError("");
  }, [validated]);

  const verify = useCallback(async () => {
    const c = code.trim().toUpperCase();
    if (!c || c.length !== 7) {
      setError("Please enter a 7-character code (e.g. DXXXXXX).");
      return;
    }
    const prefix = c.charAt(0);
    const needsMobile = CODE_PREFIX_REQUIRES_MOBILE.includes(prefix);
    if (needsMobile && !/^\d{10}$/.test(mobile.trim())) {
      setError("This code requires a linked 10-digit mobile number.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/access-code/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: c,
          mobileNumber: needsMobile ? mobile.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (data.valid) {
        setValidated(true);
        sessionStorage.setItem("k53_access_code", c);
        if (needsMobile) {
          sessionStorage.setItem("k53_mobile_number", mobile.trim());
        } else {
          sessionStorage.removeItem("k53_mobile_number");
        }
      } else {
        setError(data.message || "Invalid access code. Please try again.");
      }
    } catch {
      setError("Failed to validate code. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [code, mobile]);

  const clear = useCallback(() => {
    setCodeState("");
    setMobileState("");
    setValidated(false);
    setError("");
    sessionStorage.removeItem("k53_access_code");
    sessionStorage.removeItem("k53_mobile_number");
  }, []);

  return { code, mobile, validated, requiresMobile, error, loading, setCode, setMobile, verify, clear };
}
