import { useState, type ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileJson, Images, Trash2, Link2, CheckCircle2, Search } from "lucide-react";
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
  const [needSearch, setNeedSearch] = useState("");

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
      if (!selStaged || !selNeed) throw new Error("Pick one image and one code.");
      await apiRequest("POST", `/api/signs/${selNeed.signId}/images`, {
        code: selNeed.code,
        stagedFilename: selStaged,
      });
    },
    onSuccess: () => {
      toast({ title: "Image paired" });
      setSelStaged(null);
      setSelNeed(null);
      refreshAll();
    },
    onError: (e: Error) => toast({ title: "Pairing failed", description: e.message, variant: "destructive" }),
  });

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
                <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto">
                  {staged.map((s) => (
                    <div key={s.filename} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setSelStaged(selStaged === s.filename ? null : s.filename)}
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
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Codes needing an image — pick one</p>
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
                    filteredNeeds.map((s) => (
                    <div key={s.signId} className="border border-border rounded-xl p-2">
                      <p className="text-xs font-bold line-clamp-1">{s.name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.codes.map((c) => {
                          const active = selNeed?.signId === s.signId && selNeed?.code === c;
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setSelNeed(active ? null : { signId: s.signId, code: c })}
                              className={cn(
                                "text-[11px] font-mono px-2 py-1 rounded-md border",
                                active ? "bg-primary text-primary-foreground border-primary" : "border-dashed border-amber-500 text-amber-700"
                              )}
                            >
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <Button
              onClick={() => pairMutation.mutate()}
              disabled={!selStaged || !selNeed || pairMutation.isPending}
              className="w-full h-11 brand-gradient border-none rounded-xl font-bold disabled:opacity-50"
            >
              {pairMutation.isPending ? "Pairing…" : selStaged && selNeed ? `Pair image → ${selNeed.code}` : "Select one image and one code to pair"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
