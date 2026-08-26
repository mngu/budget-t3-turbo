"use client";

import { useNavigate, useSearch } from "@tanstack/react-router";
import { useDebounce } from "@uidotdev/usehooks";
import { useEffect, useRef, useState } from "react";

import { InputGroupInput } from "@budget/ui/input-group";

export function SearchInput({
  param,
  delay = 300,
  resetParams,
  ...props
}: {
  param: string;
  delay?: number;
  resetParams?: Record<string, unknown>;
} & Omit<React.ComponentProps<typeof InputGroupInput>, "value" | "onChange">) {
  // Cast needed: eslint's typed-linting disagrees with `tsc` here — removing it breaks
  // `pnpm typecheck` (TS7053, no index signature) since `search[param]` below needs a string index.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const urlValue = typeof search[param] === "string" ? search[param] : "";
  const [text, setText] = useState(urlValue);
  const debouncedText = useDebounce(text, delay);

  // Pousse la valeur debouncée vers l'URL, une fois le debounce écoulé.
  useEffect(() => {
    if (debouncedText === urlValue) return;
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        ...resetParams,
        [param]: debouncedText || undefined,
      }),
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedText]);

  // Sync depuis l'URL (réinitialisation, back/forward) — jamais pendant la frappe,
  // sinon le retour du debounce écraserait le texte en cours de saisie.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setText(urlValue);
    }
  }, [urlValue]);

  // `InputGroupInput` et non `Input` : ce champ est toujours accompagné d'une
  // icône, donc toujours dans un `InputGroup` — c'est le groupe qui porte la
  // boîte et le focus, l'input ne doit pas en dessiner une seconde.
  return (
    <InputGroupInput
      ref={inputRef}
      value={text}
      onChange={(e) => setText(e.target.value)}
      {...props}
    />
  );
}
