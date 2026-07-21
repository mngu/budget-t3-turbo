import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  CheckCircle2Icon,
  CircleIcon,
  CopyIcon,
  Loader2Icon,
  XCircleIcon,
} from "lucide-react";

import type { SetupStatus } from "@budget/api";
import { Button } from "@budget/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/ui/card";
import { Input } from "@budget/ui/input";
import { Label } from "@budget/ui/label";
import { toast } from "@budget/ui/toast";

import { useTRPCClient } from "~/lib/trpc";

function CheckItem({
  ok,
  pending,
  label,
}: {
  ok: boolean;
  pending?: boolean;
  label: string;
}) {
  const Icon = pending ? CircleIcon : ok ? CheckCircle2Icon : XCircleIcon;
  const color = pending
    ? "text-muted-foreground"
    : ok
      ? "text-green-600"
      : "text-red-600";
  return (
    <li className="flex items-center gap-2 text-sm">
      <Icon className={`size-4 ${color}`} />
      {label}
    </li>
  );
}

export function Onboarding({ setup }: { setup: SetupStatus }) {
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const [applicationId, setApplicationId] = useState("");
  const [privateKeyPem, setPrivateKeyPem] = useState("");
  const [redirectUrl, setRedirectUrl] = useState(setup.redirectUrl ?? "");
  const [saving, setSaving] = useState(false);

  // Suggestion par défaut : l'URL de callback de cette instance de l'app.
  useEffect(() => {
    if (!redirectUrl) setRedirectUrl(`${window.location.origin}/callback`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyRedirect = async () => {
    await navigator.clipboard.writeText(redirectUrl);
    toast.success("URL copiée.");
  };

  const submit = async () => {
    setSaving(true);
    try {
      const status = await trpcClient.settings.save.mutate({
        applicationId,
        privateKeyPem,
        redirectUrl,
      });
      if (status.configured)
        toast.success("Configuration Enable Banking validée !");
      else toast.warning(status.error ?? "Configuration incomplète.");
      await router.invalidate();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec de la sauvegarde.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Configuration Enable Banking</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ol className="flex list-inside list-decimal flex-col gap-3 text-sm">
          <li>
            Créez un compte (gratuit, email suffit) puis une application{" "}
            <b>PRODUCTION</b> sur{" "}
            <a
              href="https://enablebanking.com/cp/applications"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              enablebanking.com/cp/applications
            </a>
            . Le navigateur télécharge une clé privée <code>.pem</code> —
            gardez-la.
          </li>
          <li className="flex flex-wrap items-center gap-2">
            Déclarez cette URL de redirection dans le Control Panel :
            <code className="bg-muted rounded px-1.5 py-0.5">
              {redirectUrl}
            </code>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Copier l'URL"
              onClick={copyRedirect}
            >
              <CopyIcon />
            </Button>
          </li>
          <li>
            Renseignez ci-dessous l'application_id et le contenu de la clé
            privée.
          </li>
        </ol>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="application-id">Application ID</Label>
            <Input
              id="application-id"
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="redirect-url">
              URL de redirection (déclarée dans le Control Panel)
            </Label>
            <Input
              id="redirect-url"
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="private-key">
              Clé privée (contenu du fichier .pem)
            </Label>
            <textarea
              id="private-key"
              value={privateKeyPem}
              onChange={(e) => setPrivateKeyPem(e.target.value)}
              rows={6}
              placeholder="-----BEGIN PRIVATE KEY-----"
              className="border-input focus-visible:ring-ring rounded-md border bg-transparent px-3 py-2 font-mono text-xs shadow-xs focus-visible:ring-2 focus-visible:outline-none"
            />
          </div>
        </div>

        <ul className="flex flex-col gap-1">
          <CheckItem
            ok={setup.settingsPresent}
            pending={!setup.settingsPresent && !setup.error}
            label="Identifiants renseignés"
          />
          <CheckItem
            ok={setup.apiOk}
            pending={!setup.settingsPresent}
            label="Clé acceptée par l'API Enable Banking"
          />
          <CheckItem
            ok={setup.redirectUrlRegistered}
            pending={!setup.apiOk}
            label="URL de redirection enregistrée dans le Control Panel"
          />
        </ul>
        {setup.error && <p className="text-sm text-red-600">{setup.error}</p>}

        <Button
          onClick={submit}
          disabled={saving || !applicationId || !privateKeyPem}
        >
          {saving && <Loader2Icon className="animate-spin" />}
          Valider la configuration
        </Button>
      </CardContent>
    </Card>
  );
}
