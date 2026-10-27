import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { StudySign } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { sentenceCase, titleCase } from "@/lib/text-case";
import { Images, Search } from "lucide-react";

interface SignImageOption {
  url: string;
  code: string;
  name: string;
  heading: string;
  subheading: string;
}

interface SignImagePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  selectedUrl?: string | null;
}

const MAX_TILES = 120;

function HeadingChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-[11px] font-bold px-2 py-1 rounded-md border transition-colors",
        active
          ? "bg-neutral-900 text-white border-neutral-900"
          : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"
      )}
    >
      {children}
    </button>
  );
}

/**
 * Picks an image that already lives in the signs study module. The chosen image
 * is stored on the question as its public `/assets/signs/...` URL, which every
 * question view already renders directly.
 */
export default function SignImagePicker({ open, onClose, onSelect, selectedUrl }: SignImagePickerProps) {
  const [search, setSearch] = useState("");
  const [heading, setHeading] = useState<string | null>(null);

  const { data: signs = [], isLoading } = useQuery<StudySign[]>({
    queryKey: ["/api/signs"],
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setSearch("");
      setHeading(null);
    }
  }, [open]);

  const headings = useMemo(
    () => Array.from(new Set(signs.map((s) => s.heading).filter(Boolean))).sort(),
    [signs]
  );

  const options = useMemo<SignImageOption[]>(() => {
    const seen = new Set<string>();
    const out: SignImageOption[] = [];
    for (const sign of signs) {
      if (heading && sign.heading !== heading) continue;
      for (const image of sign.images || []) {
        if (!image.image_url || seen.has(image.image_url)) continue;
        seen.add(image.image_url);
        out.push({
          url: image.image_url,
          code: image.code,
          name: sign.name,
          heading: sign.heading,
          subheading: sign.subheading,
        });
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code));
  }, [signs, heading]);

  const query = search.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!query) return options;
    return options.filter(
      (o) =>
        o.name.toLowerCase().includes(query) ||
        o.code.toLowerCase().includes(query) ||
        o.subheading.toLowerCase().includes(query)
    );
  }, [options, query]);

  const shown = matches.slice(0, MAX_TILES);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b space-y-1">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Images className="h-4 w-4" /> Choose a sign image
          </DialogTitle>
          <p className="text-xs text-muted-foreground">Images from the signs study module.</p>
        </DialogHeader>

        <div className="px-5 py-3 space-y-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by sign name, code or subheading…"
              className="h-9 pl-8 text-xs bg-white"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <HeadingChip active={!heading} onClick={() => setHeading(null)}>
              All
            </HeadingChip>
            {headings.map((h) => (
              <HeadingChip
                key={h}
                active={heading === h}
                onClick={() => setHeading(heading === h ? null : h)}
              >
                {titleCase(h)}
              </HeadingChip>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isLoading ? (
            <p className="py-12 text-center text-xs text-muted-foreground">Loading sign images…</p>
          ) : shown.length === 0 ? (
            <div className="py-12 text-center space-y-1">
              <p className="text-sm font-bold text-neutral-600">No sign images found</p>
              <p className="text-xs text-neutral-400">
                {query ? "Try a different search." : "Add images in the signs study module first."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {shown.map((o) => (
                  <button
                    key={o.url}
                    type="button"
                    onClick={() => onSelect(o.url)}
                    title={`${o.name} · ${o.code}\n${sentenceCase(o.subheading)}`}
                    className={cn(
                      "group flex flex-col rounded-lg border bg-white overflow-hidden text-left transition-colors",
                      o.url === selectedUrl
                        ? "border-blue-500 ring-2 ring-blue-500/30"
                        : "border-neutral-200 hover:border-blue-400"
                    )}
                  >
                    <div className="aspect-[4/3] flex items-center justify-center p-1.5">
                      <img
                        src={o.url}
                        alt={`${o.name} (${o.code})`}
                        className="max-h-full max-w-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <div className="w-full px-2 py-1.5 border-t bg-neutral-50">
                      <p className="text-[11px] font-bold text-neutral-800 truncate">{o.name}</p>
                      <p className="text-[10px] font-mono text-neutral-500 truncate">{o.code}</p>
                    </div>
                  </button>
                ))}
              </div>
              {matches.length > shown.length && (
                <p className="text-[11px] text-muted-foreground text-center pt-3">
                  Showing {shown.length} of {matches.length} — search to narrow.
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
