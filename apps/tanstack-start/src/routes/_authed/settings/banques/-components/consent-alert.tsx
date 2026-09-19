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
