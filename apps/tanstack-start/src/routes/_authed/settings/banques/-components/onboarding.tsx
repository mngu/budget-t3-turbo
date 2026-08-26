"use client";

import type { SetupStatus } from "@budget/api";

import { useRouter } from "@tanstack/react-router";
import { KeyRoundIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@budget/ui";
import { Button } from "@budget/ui/button";
import { Field, FieldDescription, FieldLabel } from "@budget/ui/field";
import { Input } from "@budget/ui/input";
import { Spinner } from "@budget/ui/spinner";
import { toast } from "@budget/ui/toast";
import { useTRPCClient } from "~/lib/trpc";

export function Onboarding({ setup }: { setup: SetupStatus }) {
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const [applicationId, setApplicationId] = useState("");
  const [privateKeyPem, setPrivateKeyPem] = useState("");
  const [redirectUrl, setRedirectUrl] = useState(setup.redirectUrl ?? "");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // Suggestion par défaut : l'URL de callback de cette instance de l'app.
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
    <section className="border-border-strong bg-card mt-5 overflow-hidden rounded-lg border">
      <header className="bg-sunken border-b px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <KeyRoundIcon className="text-primary size-3.5" />
          <h2 className="text-body font-semibold">
            Configuration Enable Banking
          </h2>
          <span className="text-subtle text-control ml-auto">
            une seule fois, à l'installation
          </span>
        </div>
        <p className="text-muted-foreground text-control mt-1.5 max-w-155 text-pretty">
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
            <span className="bg-sunken num text-meta truncate rounded-md border px-2.5 py-1">
              {redirectUrl}
            </span>
            <button
              type="button"
              onClick={copyRedirect}
              className={cn(
                "border-border-strong hover:bg-accent text-control h-7 rounded-md border px-2.5 whitespace-nowrap",
                copied ? "text-ok" : "text-muted-foreground",
              )}
            >
              {copied ? "✓ Copiée" : "Copier"}
            </button>
          </div>
        </Step>
        <Step n="3">
          Renseignez ci-dessous l'identifiant de l'application et la clé privée
          téléchargée.
        </Step>
      </ol>

      <div className="flex flex-col gap-3.5 px-5 pt-3.5 pb-4.5">
        <Field>
          <FieldLabel htmlFor="application-id">Application ID</FieldLabel>
          <Input
            id="application-id"
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="redirect-url">URL de redirection</FieldLabel>
          <Input
            id="redirect-url"
            value={redirectUrl}
            onChange={(e) => setRedirectUrl(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="private-key">Clé privée</FieldLabel>
          <FieldDescription>
            fichier .pem téléchargé sur enablebanking.com
          </FieldDescription>
          {/* Pas de composant `textarea` dans le package : le seul de l'app,
              il garde son gabarit et emprunte celui de `Input`. */}
          <textarea
            id="private-key"
            value={privateKeyPem}
            onChange={(e) => setPrivateKeyPem(e.target.value)}
            rows={4}
            placeholder="-----BEGIN PRIVATE KEY-----"
            className={cn(FIELD, "h-auto resize-y py-2.5 leading-normal")}
          />
        </Field>
      </div>

      <div className="bg-surface-2 border-t px-5 py-3.5">
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
          <div className="border-bad bg-bad-soft mt-3 rounded-md border px-3 py-2.5">
            <p className="text-bad text-control font-semibold">
              L'API Enable Banking a refusé la configuration
            </p>
            <p className="text-muted-foreground num text-meta mt-1.5 break-words">
              {setup.error}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 border-t px-5 py-3">
        <span className="text-subtle text-control min-w-0 flex-1">
          Rien n'est envoyé à votre banque à cette étape.
        </span>
        <Button
          className="flex-none"
          disabled={saving || !applicationId || !privateKeyPem}
          onClick={submit}
        >
          {saving && <Spinner />}
          Valider la configuration
        </Button>
      </div>
    </section>
  );
}

const FIELD =
  "border-input bg-background focus:border-primary num h-8 w-full max-w-110 rounded-md border px-2.5 text-control outline-none";

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[22px_minmax(0,1fr)] items-start gap-3">
      <span className="border-border-strong text-muted-foreground num text-meta flex size-6 items-center justify-center rounded-full border">
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
          "text-primary-foreground text-label flex size-4 items-center justify-center rounded-full border-[1.5px]",
          bad && "border-bad bg-bad",
          ok && "border-ok bg-ok",
          pending && "border-border-strong",
        )}
      >
        {bad ? "✕" : ok ? "✓" : ""}
      </span>
      <span
        className={cn(
          "text-control",
          pending ? "text-subtle" : "text-foreground",
        )}
      >
        {children}
      </span>
    </div>
  );
}
