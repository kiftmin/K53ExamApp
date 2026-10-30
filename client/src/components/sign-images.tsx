import { SHOW_TEMPORARY_SIGNS, isTemporaryCode, orderImages, splitCodes, temporaryLabel, type SignImage } from "@/lib/sign-codes";
import { optimizedImageUrl } from "@/lib/image-url";
import { cn } from "@/lib/utils";

/** Case-insensitive match of "On any road" with optional full stop. */
export function isGenericWhere(text: string | null | undefined): boolean {
  return !!text && /^on any road\.?$/i.test(text.trim());
}

/**
 * Front-facing sign images: permanent-code images first (large / 2-col grid
 * for several), temporary-code images in a smaller captioned row beneath
 * (or as the main view when the record has no permanent image).
 */
export function SignFaceImages({ images, className }: { images: SignImage[] | null | undefined; className?: string }) {
  const ordered = orderImages(images || []);
  const perm = ordered.filter((i) => !isTemporaryCode(i.code));
  const temp = SHOW_TEMPORARY_SIGNS ? ordered.filter((i) => isTemporaryCode(i.code)) : [];
  // Records with no permanent image show temporary ones as the main view.
  const main = perm.length > 0 ? perm : temp;
  const tempRow = perm.length > 0 ? temp : [];

  const mainGrid = main.length > 1 && (
    <div className="grid grid-cols-2 gap-2 w-full">
      {main.slice(0, 4).map((img) => (
        <div key={`${img.code}-${img.image_url}`} className="flex flex-col items-center gap-0.5">
          <img
            src={optimizedImageUrl(img.image_url)}
            alt={`Sign code ${img.code}`}
            className="max-h-36 w-full object-contain bg-white rounded-xl"
            draggable={false}
          />
          {perm.length === 0 && (
            <p className="text-[10px] font-semibold text-muted-foreground">{temporaryLabel([img.code])}</p>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className={cn("w-full flex flex-col items-center gap-2", className)}>
      {main.length === 0 ? (
        <div className="h-40" />
      ) : main.length === 1 ? (
        <div className="flex flex-col items-center gap-0.5">
          <img
            src={optimizedImageUrl(main[0].image_url)}
            alt={`Sign code ${main[0].code}`}
            className="max-h-64 w-full object-contain bg-white rounded-2xl"
            draggable={false}
          />
          {perm.length === 0 && temp.length > 0 && (
            <p className="text-[10px] font-semibold text-muted-foreground">{temporaryLabel([main[0].code])}</p>
          )}
        </div>
      ) : (
        <>
          {mainGrid}
          {main.length > 4 && (
            <p className="text-[11px] font-bold text-muted-foreground">+{main.length - 4} more</p>
          )}
        </>
      )}
      {tempRow.length > 0 && (
        <div className="grid grid-cols-2 gap-2 w-full border-t border-border pt-2">
          {tempRow.map((img) => (
            <div key={`${img.code}-${img.image_url}`} className="flex flex-col items-center gap-0.5">
              <img
                src={optimizedImageUrl(img.image_url)}
                alt={`Temporary sign code ${img.code}`}
                className="max-h-24 object-contain bg-white rounded-lg"
                draggable={false}
              />
              <p className="text-[10px] font-semibold text-muted-foreground">{temporaryLabel([img.code])}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Code chips: permanent codes as chips, temporary codes in a muted caption line. */
export function SignCodeChips({ codes, className }: { codes: string[] | null | undefined; className?: string }) {
  const { permanent, temporary } = splitCodes(codes || []);
  const tempShown = SHOW_TEMPORARY_SIGNS ? temporary : [];
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1">
        {permanent.map((c) => (
          <span key={c} className="text-[11px] font-mono bg-background border border-border rounded-md px-2 py-0.5">{c}</span>
        ))}
      </div>
      {tempShown.length > 0 && (
        <p className="text-[10px] font-semibold text-muted-foreground mt-1">{temporaryLabel(tempShown)}</p>
      )}
    </div>
  );
}
