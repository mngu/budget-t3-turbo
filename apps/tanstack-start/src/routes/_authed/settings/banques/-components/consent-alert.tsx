"use client";

import type { ConsentAlert as ConsentAlertData } from "../-lib/consent";

import { Alert, Button, Spinner } from "@heroui/react";

import { useRenewConnection } from "../-lib/use-renew";

export function ConsentAlert({ alert }: { alert: ConsentAlertData }) {
  const { renew, busy } = useRenewConnection();

  return (
    <Alert status={alert.tone} className="mt-5">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{alert.title}</Alert.Title>
        <Alert.Description>{alert.body}</Alert.Description>
      </Alert.Content>
      <Button
        variant="outline"
        size="sm"
        isPending={busy}
        onPress={() => void renew(alert.connection)}
      >
        {busy && <Spinner color="current" size="sm" />}
        {alert.cta}
      </Button>
    </Alert>
  );
}
