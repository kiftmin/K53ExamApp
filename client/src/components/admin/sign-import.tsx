import { useState, type ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileJson, Images, Trash2, Link2, CheckCircle2, Search, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnmatchedData {
  staged: { filename: string; slug: string; url: string; size: number }[];
  needsImage: { signId: number; name: string; heading: string; subheading: string; codes: string[]; images: { code: string; image_url: string }[] }[];
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function SignImportPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [jsonBusy, setJsonBusy] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [lastImport, setLastImport] = useState<string | null>(null);
  const [lastBatch, setLastBatch] = useState<string | null>(null);
  const [selStaged, setSelStaged] = useState<string | null>(null);
  const [selNeed, setSelNeed] = useState<{ signId: number; code: string } | null>(null);
  // "Add as new code" mode: image paired to a sign under a code not yet on its record
  const [selSignForNew, setSelSignForNew] = useState<{ signId: number; name: string } | null>(null);
  const [newCode, setNewCode] = useState("");
  const [needSearch, setNeedSearch] = useState("");
  const [stagedSearch, setStagedSearch] = useState("");

  const { data: unmatched, refetch: refetchUnmatched } = useQuery<UnmatchedData>({
    queryKey: ["/api/signs/unmatched-images"],
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/signs"] });
    refetchUnmatched();
  };

  const handleJsonUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setJsonBusy(true);
    setLastImport(null);
    try {
      const text = (await file.text()).replace(/^\uFEFF/, "");
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("JSON must be an array of sign records.");
      const res = await apiRequest("POST", "/api/signs/import", parsed);
      const data = (await res.json()) as { message: string };
      setLastImport(data.message);
      toast({ title: "Signs imported", description: data.message });
      refreshAll();
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setJsonBusy(false);
    }
  };

  const handleBatchUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setBatchBusy(true);
    setLastBatch(null);
    try {
      const payload = [];
      for (const f of files.slice(0, 50)) {
        payload.push({ filename: f.name, dataUrl: await readAsDataUrl(f) });
      }
      const res = await apiRequest("POST", "/api/signs/images/batch", { files: payload });
      const data = (await res.json()) as { matched: unknown[]; staged: unknown[] };
      setLastBatch(`${data.matched.length} auto-matched, ${data.staged.length} need manual pairing.`);
      toast({ title: "Batch processed", description: `${data.matched.length} matched · ${data.staged.length} staged` });
      refreshAll();
    } catch (err: any) {
      toast({ title: "Batch upload failed", description: err.message, variant: "destructive" });
    } finally {
      setBatchBusy(false);
    }
  };

  const pairMutation = useMutation({
    mutationFn: async () => {
      if (!selStaged) throw new Error("Pick an image first.");
      if (selNeed) {
        await apiRequest("POST", `/api/signs/${selNeed.signId}/images`, {
          code: selNeed.code,
          stagedFilename: selStaged,
        });
      } else if (selSignForNew && newCode.trim()) {
        await apiRequest("POST", `/api/signs/${selSignForNew.signId}/images`, {
          code: newCode.trim(),
          stagedFilename: selStaged,
          addCodeAsNew: true,
        });
      } else {
        throw new Error("Pick a code — or a sign plus a new code.");
      }
    },
    onSuccess: () => {
      toast({ title: selNeed ? "Image paired" : "Code added & image paired" });
      setSelStaged(null);
      setSelNeed(null);
      setSelSignForNew(null);
      setNewCode("");
      refreshAll();
    },
    onError: (e: Error) => toast({ title: "Pairing failed", description: e.message, variant: "destructive" }),
  });

  const removeCodeMutation = useMutation({
    mutationFn: async ({ signId, code }: { signId: number; code: string }) => {
      await apiRequest("DELETE", `/api/signs/${signId}/codes/${encodeURIComponent(code)}`);
    },
    onSuccess: (_data, vars) => {
      toast({ title: `Removed code ${vars.code}` });
      if (selNeed?.signId === vars.signId && selNeed?.code === vars.code) setSelNeed(null);
      refreshAll();
    },
    onError: (e: Error) => toast({ title: "Remove failed", description: e.message, variant: "destructive" }),
  });

  // Filename without extension — prefill for the "new code" input
  const baseOf = (filename: string) => filename.replace(/\.[^.]+$/, "");

  const pickStaged = (filename: string) => {
    const next = selStaged === filename ? null : filename;
    setSelStaged(next);
    if (next && selSignForNew && !newCode) setNewCode(baseOf(next));
  };

  const discardMutation = useMutation({
    mutationFn: async (filename: string) => {
      await apiRequest("DELETE", `/api/signs/unmatched-images/${encodeURIComponent(filename)}`);
    },
    onSuccess: () => {
      if (selStaged) setSelStaged(null);
      refetchUnmatched();
    },
    onError: (e: Error) => toast({ title: "Discard failed", description: e.message, variant: "destructive" }),
  });

  const staged = unmatched?.staged || [];
  const stagedQuery = stagedSearch.trim().toLowerCase();
  const filteredStaged = stagedQuery
    ? staged.filter((s) => s.filename.toLowerCase().includes(stagedQuery))
    : staged;
  const needsImage = unmatched?.needsImage || [];
  const needCount = needsImage.reduce((n, s) => n + s.codes.length, 0);

  // Search narrows the needs list by code (falls back to sign name).
  // While searching, each sign only shows its matching code chips.
  const needQuery = needSearch.trim().toLowerCase();
  const filteredNeeds = needQuery
    ? needsImage
        .map((s) => ({
          ...s,
          codes: s.codes.filter(
            (c) => c.toLowerCase().includes(needQuery) || s.name.toLowerCase().includes(needQuery)
          ),
        }))
        .filter((s) => s.codes.length > 0)
    : needsImage;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FileJson className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm">1 · Import Allsigns.json</h3>
          </div>
          <p className="text-xs text-muted-foreground">Bulk-inserts signs with empty image slots. Re-running skips duplicates.</p>
          <input type="file" id="signs-json" accept=".json" className="hidden" onChange={handleJsonUpload} disabled={jsonBusy} />
          <Button asChild variant="outline" className="w-full h-11 rounded-xl" disabled={jsonBusy}>
            <label htmlFor="signs-json" className="cursor-pointer">{jsonBusy ? "Importing…" : "Choose JSON file"}</label>
          </Button>
          {lastImport && <p className="text-xs text-green-700 font-semibold flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />{lastImport}</p>}
        </div>

        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Images className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm">2 · Upload image batch</h3>
          </div>
          <p className="text-xs text-muted-foreground">Filenames are slug-matched against codes. Leftovers go below for manual pairing.</p>
          <input type="file" id="signs-images" accept="image/*" multiple className="hidden" onChange={handleBatchUpload} disabled={batchBusy} />
          <Button asChild variant="outline" className="w-full h-11 rounded-xl" disabled={batchBusy}>
            <label htmlFor="signs-images" className="cursor-pointer">{batchBusy ? "Uploading…" : "Choose images (max 50)"}</label>
          </Button>
          {lastBatch && <p className="text-xs text-green-700 font-semibold flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />{lastBatch}</p>}
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" /> Reconcile leftovers
          </h3>
          <span className="text-xs text-muted-foreground">{staged.length} images · {needCount} codes</span>
        </div>
        {staged.length === 0 && needCount === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Nothing to reconcile — every code has an image.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Unmatched images — pick one</p>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={stagedSearch}
                    onChange={(e) => setStagedSearch(e.target.value)}
                    placeholder="Search by filename…"
                    className="pl-8 h-9 text-xs font-mono"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto">
                  {filteredStaged.length === 0 ? (
                    <p className="col-span-3 text-xs text-muted-foreground py-4 text-center">
                      {stagedQuery ? `No images match “${stagedSearch.trim()}”.` : "No staged images."}
                    </p>
                  ) : (
                    filteredStaged.map((s) => (
                    <div key={s.filename} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => pickStaged(s.filename)}
                        className={cn(
                          "block w-full aspect-square rounded-lg overflow-hidden border-2 bg-white",
                          selStaged === s.filename ? "border-primary ring-2 ring-primary/30" : "border-border"
                        )}
                        title={s.filename}
                      >
                        <img src={s.url} alt={s.filename} className="h-full w-full object-contain" loading="lazy" />
                      </button>
                      <div className="flex items-center gap-1">
                        <p className="text-[10px] font-mono text-muted-foreground truncate flex-1" title={s.filename}>{s.filename}</p>
                        <button
                          type="button"
                          onClick={() => discardMutation.mutate(s.filename)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Discard ${s.filename}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Codes needing an image — pick one</p>
                <p className="text-[11px] text-muted-foreground -mt-1">Code pairs the image · × removes a wrong code · + adds the image under a new code</p>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={needSearch}
                    onChange={(e) => setNeedSearch(e.target.value)}
                    placeholder="Search by code…"
                    className="pl-8 h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {filteredNeeds.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      {needQuery ? `No codes match “${needSearch.trim()}”.` : "Nothing here."}
                    </p>
                  ) : (
                    filteredNeeds.map((s) => {
                      const signSelected = selSignForNew?.signId === s.signId;
                      return (
                    <div
                      key={s.signId}
                      className={cn(
                        "border rounded-xl p-2",
                        signSelected ? "border-primary ring-2 ring-primary/30" : "border-border"
                      )}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Select sign to add the image under a NEW code"
                          onClick={() => {
                            if (signSelected) {
                              setSelSignForNew(null);
                            } else {
                              setSelSignForNew({ signId: s.signId, name: s.name });
                              setSelNeed(null);
                              if (selStaged && !newCode) setNewCode(baseOf(selStaged));
                            }
                          }}
                          className={cn(
                            "text-xs font-bold line-clamp-1 flex-1 text-left hover:text-primary",
                            signSelected && "text-primary"
                          )}
                        >
                          {s.name}
                        </button>
                        <button
                          type="button"
                          title="Add image under a new code on this sign"
                          onClick={() => {
                            setSelSignForNew({ signId: s.signId, name: s.name });
                            setSelNeed(null);
                            if (selStaged && !newCode) setNewCode(baseOf(selStaged));
                          }}
                          className={cn(
                            "p-1 rounded-md hover:bg-accent",
                            signSelected ? "text-primary" : "text-muted-foreground"
                          )}
                          aria-label={`Add new code to ${s.name}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.codes.map((c) => {
                          const active = selNeed?.signId === s.signId && selNeed?.code === c;
                          return (
                            <span
                              key={c}
                              className={cn(
                                "inline-flex items-center text-[11px] font-mono rounded-md border",
                                active ? "bg-primary text-primary-foreground border-primary" : "border-dashed border-amber-500 text-amber-700"
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setSelNeed(active ? null : { signId: s.signId, code: c });
                                  setSelSignForNew(null);
                                }}
                                className="px-2 py-1"
                              >
                                {c}
                              </button>
                              <button
                                type="button"
                                title={`Remove code ${c} from this sign`}
                                onClick={() => removeCodeMutation.mutate({ signId: s.signId, code: c })}
                                className={cn(
                                  "pr-1.5 py-1 hover:text-destructive",
                                  active && "hover:text-destructive-foreground"
                                )}
                                aria-label={`Remove code ${c}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            {selSignForNew && (
              <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold line-clamp-1">
                    New code on “{selSignForNew.name}”
                  </p>
                  <button
                    type="button"
                    onClick={() => { setSelSignForNew(null); setNewCode(""); }}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Cancel new code"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder={selStaged ? baseOf(selStaged) : "e.g. R1B"}
                    className="h-10 font-mono text-sm"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Prefilled from the image name — edit if the real code differs. The code is added to the sign record and the image attached to it.
                </p>
              </div>
            )}
            <Button
              onClick={() => pairMutation.mutate()}
              disabled={!selStaged || pairMutation.isPending || (!selNeed && !(selSignForNew && newCode.trim()))}
              className="w-full h-11 brand-gradient border-none rounded-xl font-bold disabled:opacity-50"
            >
              {pairMutation.isPending
                ? "Pairing…"
                : selNeed && selStaged
                  ? `Pair image → ${selNeed.code}`
                  : selSignForNew && selStaged && newCode.trim()
                    ? `Add ${newCode.trim()} & pair image`
                    : "Select an image, then a code — or a sign for a new code"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
