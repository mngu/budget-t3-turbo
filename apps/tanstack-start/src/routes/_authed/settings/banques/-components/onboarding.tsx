"use client";

import type { SetupStatus } from "@budget/api";

import {
  Alert,
  Button,
  Description,
  Input,
  Label,
  Spinner,
  TextArea,
  TextField,
  toast,
} from "@heroui/react";
import { KeyRoundIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@budget/ui";
import { useTRPCClient } from "~/lib/trpc";
import { useRun } from "~/lib/use-run";

export function Onboarding({ setup }: { setup: SetupStatus }) {
  const trpcClient = useTRPCClient();
  const run = useRun();
  const [applicationId, setApplicationId] = useState("");
  const [privateKeyPem, setPrivateKeyPem] = useState("");
  const [redirectUrl, setRedirectUrl] = useState(setup.redirectUrl ?? "");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!redirectUrl) setRedirectUrl(`${window.location.origin}/callback`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyRedirect = async () => {
    await navigator.clipboard.writeText(redirectUrl);
    setCopied(true);
    toast.success("URL copiée.");
  };

  const submit = async () => {
    setSaving(true);
    const status = await run(
      () =>
        trpcClient.settings.save.mutate({
          applicationId,
          privateKeyPem,
          redirectUrl,
        }),
      "Échec de la sauvegarde.",
    );
    setSaving(false);
    if (!status) return;
    if (status.configured)
      toast.success("Configuration Enable Banking validée !");
    else toast.warning(status.error ?? "Configuration incomplète.");
  };

  return (
    <section className="border-border bg-surface mt-5 overflow-hidden rounded-lg border">
      <header className="bg-background-secondary border-b px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <KeyRoundIcon className="text-accent size-3.5" />
          <h2 className="text-body font-semibold">
            Configuration Enable Banking
          </h2>
          <span className="text-muted text-control ml-auto">
            une seule fois, à l'installation
          </span>
        </div>
        <p className="text-muted text-control mt-1.5 max-w-155 text-pretty">
          Ce sont les identifiants de{" "}
          <span className="text-foreground font-medium">votre</span> compte
          agrégateur, pas ceux d'une banque. Aucune banque ne vous demandera
          jamais ses identifiants ici.
        </p>
      </header>

      <ol className="flex flex-col gap-3.5 px-5 pt-4.5 pb-1.5">
        <Step n="1">
          Créez un compte (gratuit, email suffit) puis une application{" "}
          <b>PRODUCTION</b> sur{" "}
          <a
            href="https://enablebanking.com/cp/applications"
            target="_blank"
            rel="noreferrer"
          >
            enablebanking.com
          </a>
          . Le navigateur télécharge une clé privée <code>.pem</code> —
          gardez-la.
        </Step>
        <Step n="2">
          Déclarez cette URL de redirection dans le Control Panel de votre
          application :
          <div className="mt-1.5 flex items-center gap-2">
            <span className="bg-background-secondary num text-meta truncate rounded-md border px-2.5 py-1">
              {redirectUrl}
            </span>
            <Button
              size="sm"
              variant="outline"
              onPress={() => void copyRedirect()}
            >
              {copied ? "✓ Copiée" : "Copier"}
            </Button>
          </div>
        </Step>
        <Step n="3">
          Renseignez ci-dessous l'identifiant de l'application et la clé privée
          téléchargée.
        </Step>
      </ol>

      <div className="flex flex-col gap-3.5 px-5 pt-3.5 pb-4.5">
        <TextField value={applicationId} onChange={setApplicationId}>
          <Label>Application ID</Label>
          <Input placeholder="00000000-0000-0000-0000-000000000000" />
        </TextField>
        <TextField value={redirectUrl} onChange={setRedirectUrl}>
          <Label>URL de redirection</Label>
          <Input />
        </TextField>
        <TextField value={privateKeyPem} onChange={setPrivateKeyPem}>
          <Label>Clé privée</Label>
          <TextArea rows={4} placeholder="-----BEGIN PRIVATE KEY-----" />
          <Description>
            fichier .pem téléchargé sur enablebanking.com
          </Description>
        </TextField>
      </div>

      <div className="bg-surface-secondary border-t px-5 py-3.5">
        <div className="flex flex-col gap-2.5">
          <Check
            ok={setup.settingsPresent}
            pending={!setup.settingsPresent && !setup.error}
          >
            Identifiants renseignés
          </Check>
          <Check ok={setup.apiOk} pending={!setup.settingsPresent}>
            Clé acceptée par l'API Enable Banking
          </Check>
          <Check ok={setup.redirectUrlRegistered} pending={!setup.apiOk}>
            URL de redirection enregistrée dans le Control Panel
          </Check>
        </div>

        {setup.error && (
          <Alert status="danger" className="mt-3">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>
                L'API Enable Banking a refusé la configuration
              </Alert.Title>
              <Alert.Description className="num break-words">
                {setup.error}
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}
      </div>

      <div className="flex items-center gap-3 border-t px-5 py-3">
        <span className="text-muted text-control min-w-0 flex-1">
          Rien n'est envoyé à votre banque à cette étape.
        </span>
        <Button
          className="flex-none"
          isDisabled={!applicationId || !privateKeyPem}
          isPending={saving}
          onPress={() => void submit()}
        >
          {saving && <Spinner color="current" size="sm" />}
          Valider la configuration
        </Button>
      </div>
    </section>
  );
}

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[22px_minmax(0,1fr)] items-start gap-3">
      <span className="border-border text-muted num text-meta flex size-6 items-center justify-center rounded-full border">
        {n}
      </span>
      <div className="text-control min-w-0 pt-px">{children}</div>
    </li>
  );
}

function Check({
  ok,
  pending,
  children,
}: {
  ok: boolean;
  pending: boolean;
  children: React.ReactNode;
}) {
  const bad = !ok && !pending;
  return (
    <div className="grid grid-cols-[16px_minmax(0,1fr)] items-center gap-2.5">
      <span
        className={cn(
          "text-accent-foreground text-label flex size-4 items-center justify-center rounded-full border-[1.5px]",
          bad && "border-danger bg-danger",
          ok && "border-success bg-success",
          pending && "border-border",
        )}
      >
        {bad ? "✕" : ok ? "✓" : ""}
      </span>
      <span
        className={cn(
          "text-control",
          pending ? "text-muted" : "text-foreground",
        )}
      >
        {children}
      </span>
    </div>
  );
}
