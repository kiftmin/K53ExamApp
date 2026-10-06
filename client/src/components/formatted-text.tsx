import React from "react";

// Renders text where \n becomes line breaks and **x** becomes <strong>.
export function FormattedText({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <p className={className} style={{ whiteSpace: "pre-line" }}>
      {lines.map((line, li) => (
        <React.Fragment key={li}>
          {line.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={i}>{part.slice(2, -2)}</strong>
            ) : (
              <React.Fragment key={i}>{part}</React.Fragment>
            )
          )}
          {li < lines.length - 1 && "\n"}
        </React.Fragment>
      ))}
    </p>
  );
}
