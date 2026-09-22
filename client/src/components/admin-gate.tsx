import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SESSION_KEY = "k53_admin_auth";

export function isAdminAuthenticated() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export default function AdminGate({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [authed, setAuthed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [masterKey, setMasterKey] = useState("");
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // request-key state
  const [showRequest, setShowRequest] = useState(false);
  const [requestMsg, setRequestMsg] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [smtpReady, setSmtpReady] = useState(false);

  useEffect(() => {
    setAuthed(isAdminAuthenticated());
    setChecked(true);
    fetch("/api/admin/contact")
      .then((r) => r.json())
      .then((d) => {
        setAdminEmail(d.email || "");
        setSmtpReady(!!d.smtpConfigured);
      })
      .catch(() => {});
  }, []);

  const handleLogin = async () => {
    const code = masterKey.trim().toUpperCase();
    if (!code.startsWith("X") || code.length !== 7) {
      setError("Enter a master (X) key, e.g. XABC123.");
      return;
    }
    if (!/^\d{10}$/.test(mobile.trim())) {
      setError("Enter the 10-digit mobile number linked to this key.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/access-codes/validate-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, mobileNumber: mobile.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        sessionStorage.setItem(SESSION_KEY, "1");
        sessionStorage.setItem("k53_admin_key", code);
        sessionStorage.setItem("k53_admin_mobile", mobile.trim());
        setAuthed(true);
        toast({ title: "Admin access granted" });
      } else {
        setError(data.message || "Invalid master key.");
        // If mobile was right but key wrong, backend returns mobileMatch — nudge to request flow
        if (data.mobileMatch) {
          setShowRequest(true);
        }
      }
    } catch {
      setError("Failed to validate. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleRequest = async () => {
    if (!/^\d{10}$/.test(mobile.trim())) {
      setError("Enter your 10-digit mobile number first.");
      return;
    }
    setRequestBusy(true);
    try {
      const res = await fetch("/api/admin/request-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber: mobile.trim(), message: requestMsg }),
      });
      const data = await res.json();
      if (res.ok && data.sent) {
        toast({ title: `Request sent to ${data.to}` });
        setShowRequest(false);
        setRequestMsg("");
      } else {
        // Fall back to mailto if backend email not configured
        if (adminEmail) {
          const subject = encodeURIComponent(`Master key request — ${mobile.trim()}`);
          const body = encodeURIComponent(
            `Hi,\n\nPlease issue a new master key for mobile: ${mobile.trim()}\n\n${requestMsg}\n`
          );
          window.location.href = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
        } else {
          setError(data.message || "Failed to send request. ADMIN_EMAIL not configured.");
        }
      }
    } catch {
      setError("Failed to send request.");
    } finally {
      setRequestBusy(false);
    }
  };

  if (!checked) return null;
  if (authed) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-50">
      <Card className="w-full max-w-md rounded-3xl shadow-xl border-none">
        <CardContent className="pt-8 pb-8 px-6 space-y-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Admin console — restricted</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Enter a master key (X…) with admin access plus its linked 10-digit mobile number.
          </p>
          <div className="space-y-2">
            <Label htmlFor="admin-key">Master key</Label>
            <Input
              id="admin-key"
              placeholder="X + 6 chars"
              value={masterKey}
              onChange={(e) =>
                setMasterKey(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 7))
              }
              maxLength={7}
              className="h-11 font-mono tracking-[0.25em]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-mobile">Mobile number</Label>
            <Input
              id="admin-mobile"
              placeholder="10-digit mobile"
              inputMode="numeric"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              maxLength={10}
              className="h-11 font-mono tracking-[0.2em]"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button onClick={handleLogin} disabled={busy} className="w-full h-11 font-bold">
            {busy ? "Verifying…" : "Unlock admin"}
          </Button>

          <div className="pt-2 border-t">
            {!showRequest ? (
              <Button
                variant="ghost"
                className="w-full text-xs"
                onClick={() => setShowRequest(true)}
              >
                <Mail className="h-3.5 w-3.5 mr-2" />
                Correct mobile but wrong key? Request a new master key
              </Button>
            ) : (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground">
                  {smtpReady
                    ? `This emails ${adminEmail || "the admin"} from the server.`
                    : adminEmail
                      ? `Server email not configured — this opens your email app to ${adminEmail}.`
                      : "Server email not configured — set ADMIN_EMAIL in .env."}
                </p>
                <Input
                  placeholder="Optional note for admin"
                  value={requestMsg}
                  onChange={(e) => setRequestMsg(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowRequest(false)}
                  >
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleRequest} disabled={requestBusy}>
                    {requestBusy ? "Sending…" : "Email admin"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
