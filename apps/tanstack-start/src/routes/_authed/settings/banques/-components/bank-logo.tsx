"use client";

import { useState } from "react";

import { cn } from "@budget/ui";

// Bank logos may be missing or broken. Keep a white background in both themes
// so dark artwork on transparent logos remains visible.
export function BankLogo({
  name,
  logoUrl,
  className,
}: {
  name: string;
  logoUrl: string | null;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);

  if (!logoUrl || broken) {
    return (
      <span
        className={cn(
          "bg-background-secondary text-muted flex items-center justify-center rounded-md border font-semibold",
          className,
        )}
      >
        {initials(name)}
      </span>
    );
  }

  return (
    <img
      src={logoUrl}
      alt=""
      onError={() => setBroken(true)}
      className={cn("rounded-md border bg-white object-contain p-1", className)}
    />
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
