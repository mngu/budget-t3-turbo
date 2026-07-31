"use client";

import {
  ClockAlertIcon,
  Loader2Icon,
  TriangleAlertIcon,
  UnplugIcon,
} from "lucide-react";

import { cn } from "@budget/ui";

import type { ConsentAlert as Alert } from "../-lib/consent";
import { CONSENT_TONE } from "../-lib/consent";
import { useRenewConnection } from "../-lib/use-renew";

const ICON = {
  warning: ClockAlertIcon,
  expired: TriangleAlertIcon,
  revoked: UnplugIcon,
};

export function ConsentAlert({ alert }: { alert: Alert }) {
  const tone = CONSENT_TONE[alert.tone];
  const Icon = ICON[alert.level];
  const { renew, busy } = useRenewConnection();

  return (
    <section
      className={cn(
        "mt-5 flex flex-wrap items-center gap-4 rounded-xl border px-5 py-4",
        tone.border,
        tone.bg,
      )}
    >
      <span
        className={cn(
          "bg-card flex size-8 flex-none items-center justify-center rounded-[10px] border",
          tone.border,
          tone.text,
        )}
      >
        <Icon className="size-4" />
      </span>

      <div className="min-w-[280px] flex-1">
        <h2 className="text-[13.5px] font-semibold tracking-[-0.015em]">
          {alert.title}
        </h2>
        <p className="text-muted-foreground mt-1 max-w-[640px] text-xs text-pretty">
          {alert.body}
        </p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void renew(alert.connection)}
        className={cn(
          "text-primary-foreground flex h-[33px] items-center gap-1.5 rounded-[9px] px-3.5 text-[12.5px] font-semibold whitespace-nowrap disabled:opacity-60",
          tone.fill,
        )}
      >
        {busy && <Loader2Icon className="size-3.5 animate-spin" />}
        {alert.cta}
      </button>
    </section>
  );
}
