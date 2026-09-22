import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Trash2, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type CodeType = "daily" | "weekly" | "monthly" | "master";

interface AccessCode {
  id: number;
  code: string;
  type: CodeType;
  mobile_number: string | null;
  has_admin_access: boolean;
  expires_at: string | null;
  is_revoked: boolean;
  created_at: string;
}

const TYPE_LABEL: Record<CodeType, string> = {
  daily: "Daily (D)",
  weekly: "Weekly (W)",
  monthly: "Monthly (M)",
  master: "Master (X)",
};

export default function AccessCodeManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [genType, setGenType] = useState<CodeType>("weekly");
  const [genMobile, setGenMobile] = useState("");
  const [genAdmin, setGenAdmin] = useState(false);

  const { data: codes, isLoading } = useQuery<AccessCode[]>({
    queryKey: ["/api/access-codes"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/access-codes/generate", {
        type: genType,
        mobileNumber: ["weekly", "monthly", "master"].includes(genType) ? genMobile.trim() : undefined,
        hasAdminAccess: genType === "master" ? genAdmin : false,
      });
      return res.json();
    },
    onSuccess: (created: AccessCode) => {
      queryClient.invalidateQueries({ queryKey: ["/api/access-codes"] });
      toast({ title: `Generated ${created.code}` });
      setGenMobile("");
      setGenAdmin(false);
    },
    onError: (e: Error) => toast({ title: "Generate failed", description: e.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/access-codes/${id}/revoke`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/access-codes"] });
      toast({ title: "Code revoked" });
    },
    onError: (e: Error) => toast({ title: "Revoke failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/access-codes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/access-codes"] });
      toast({ title: "Code deleted" });
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const needsMobile = ["weekly", "monthly", "master"].includes(genType);
  const genValid = !needsMobile || /^\d{10}$/.test(genMobile.trim());

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">
          Generate on-demand code
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold">Type</Label>
          <Select value={genType} onValueChange={(v) => setGenType(v as CodeType)}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_LABEL) as CodeType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-[11px] font-bold">
            Mobile {needsMobile ? "(required, 10 digits)" : "(not needed for Daily)"}
          </Label>
          <Input
            placeholder={needsMobile ? "e.g. 0821234567" : "—"}
            inputMode="numeric"
            value={genMobile}
            onChange={(e) => setGenMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
            maxLength={10}
            disabled={!needsMobile}
            className="h-10 font-mono"
          />
        </div>

        <div className="flex items-end gap-2">
          {genType === "master" && (
            <label className="flex items-center gap-2 text-[11px] font-bold pb-3 whitespace-nowrap">
              <Checkbox checked={genAdmin} onCheckedChange={(c) => setGenAdmin(c as boolean)} />
              Admin access
            </label>
          )}
          <Button
            className="h-10 flex-1 text-[11px] font-bold"
            disabled={!genValid || generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            {generateMutation.isPending ? "Generating…" : "Generate"}
          </Button>
        </div>
      </div>

      <p className="text-[10px] text-neutral-400">
        Daily (D) expires at midnight SAST · Weekly (W) 7 days · Monthly (M) 30 days · Master (X) never expires.
        W/M/X must be linked to a 10-digit mobile at creation.
      </p>

      <div className="border-t pt-3 space-y-2">
        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">
          Issued codes ({codes?.length ?? 0})
        </span>
        {isLoading ? (
          <p className="text-xs text-neutral-400 italic">Loading…</p>
        ) : !codes?.length ? (
          <p className="text-xs text-neutral-400 italic">No on-demand codes yet.</p>
        ) : (
          <div className="max-h-64 overflow-auto space-y-1.5">
            {codes.map((c) => {
              const expired = c.expires_at && new Date(c.expires_at).getTime() < Date.now();
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${
                    c.is_revoked || expired ? "bg-neutral-50 border-neutral-200 opacity-60" : "bg-neutral-50/50 border-neutral-100"
                  }`}
                >
                  <span className="font-mono font-black tracking-widest w-20">{c.code}</span>
                  <span className="text-[10px] font-bold uppercase text-neutral-500 w-16">{c.type}</span>
                  <span className="font-mono text-neutral-600 flex-1 truncate">
                    {c.mobile_number || "—"}
                  </span>
                  {c.has_admin_access && (
                    <span className="text-[9px] font-black uppercase bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                      admin
                    </span>
                  )}
                  {c.is_revoked ? (
                    <span className="text-[9px] font-black uppercase text-red-500">revoked</span>
                  ) : expired ? (
                    <span className="text-[9px] font-black uppercase text-amber-600">expired</span>
                  ) : (
                    <span className="text-[9px] text-neutral-400">
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "never"}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      navigator.clipboard.writeText(c.code);
                      toast({ title: "Copied" });
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  {!c.is_revoked && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => revokeMutation.mutate(c.id)}
                    >
                      <Ban className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500"
                    onClick={() => deleteMutation.mutate(c.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
