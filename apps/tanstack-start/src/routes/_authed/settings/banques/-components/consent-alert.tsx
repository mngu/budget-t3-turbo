"use client";

import type { ConsentAlert as ConsentAlertData } from "../-lib/consent";

import { ClockAlertIcon, TriangleAlertIcon, UnplugIcon } from "lucide-react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@budget/ui/alert";
import { Button } from "@budget/ui/button";
import { Spinner } from "@budget/ui/spinner";

import { TONE_VARIANT } from "../-lib/consent";
import { useRenewConnection } from "../-lib/use-renew";

const ICON = {
  warning: ClockAlertIcon,
  expired: TriangleAlertIcon,
  revoked: UnplugIcon,
};

/**
 * Bandeau d'échéance de consentement, en tête de `/banques`.
 *
 * La sévérité vit dans la **variante** de l'`Alert` ; le bouton en est un
 * ordinaire. Avant, la teinte était peinte à trois endroits de cet écran
 * (cadre, pastille d'icône, fond du bouton) — voir
 * `docs/adr/0001-le-design-appartient-au-package-ui.md`.
 */
export function ConsentAlert({ alert }: { alert: ConsentAlertData }) {
  const Icon = ICON[alert.level];
  const { renew, busy } = useRenewConnection();

  return (
    <Alert variant={TONE_VARIANT[alert.tone]} className="mt-5">
      <Icon />
      <AlertTitle>{alert.title}</AlertTitle>
      <AlertDescription>{alert.body}</AlertDescription>
      <AlertAction>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void renew(alert.connection)}
        >
          {busy && <Spinner />}
          {alert.cta}
        </Button>
      </AlertAction>
    </Alert>
  );
}
