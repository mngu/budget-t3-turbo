"use client";

import { SearchField } from "@heroui/react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useDebounce } from "@uidotdev/usehooks";
import { useEffect, useRef, useState } from "react";

export function SearchInput({
  param,
  delay = 300,
  resetParams,
  placeholder,
  className,
  "aria-label": ariaLabel,
}: {
  param: string;
  delay?: number;
  resetParams?: Record<string, unknown>;
  placeholder: string;
  className?: string;
  "aria-label"?: string;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const urlValue = typeof search[param] === "string" ? search[param] : "";
  const [text, setText] = useState(urlValue);
  const debouncedText = useDebounce(text, delay);

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

  // Do not let a debounced URL update overwrite ongoing typing.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setText(urlValue);
    }
  }, [urlValue]);

  return (
    <SearchField
      value={text}
      onChange={setText}
      aria-label={ariaLabel ?? placeholder}
      className={className}
    >
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input ref={inputRef} placeholder={placeholder} />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  );
}
