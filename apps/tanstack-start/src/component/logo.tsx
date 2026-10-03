import { cn } from "@budget/ui";

// The fill level echoes the app's budget gauges.
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("text-accent flex-none", className)}
    >
      <rect x="6" y="2" width="12" height="4" rx="1.25" />
      <rect x="4" y="7.5" width="16" height="14.5" rx="4" opacity="0.35" />
      <path d="M4 13h16v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
    </svg>
  );
}
