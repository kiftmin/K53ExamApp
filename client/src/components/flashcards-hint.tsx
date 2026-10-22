import { useState } from "react";
import { X } from "lucide-react";

const HINT_KEY = "k53_hint_flashcards";

/** One-time dismissible hint shown above the first flashcard. */
export function FlashcardsHint() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (dismissed) return null;
  return (
    <div className="rounded-2xl bg-primary/5 border border-primary/20 px-4 py-3 flex items-start justify-between gap-3">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Tap the card to see the answer, then tell us if you knew it. Cards you miss come back in Practise.
      </p>
      <button
        type="button"
        aria-label="Dismiss hint"
        onClick={() => {
          try {
            localStorage.setItem(HINT_KEY, "1");
          } catch {
            // ignore
          }
          setDismissed(true);
        }}
        className="p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
