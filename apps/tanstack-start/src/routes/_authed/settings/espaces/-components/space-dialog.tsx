"use client";

import {
  Button,
  Description,
  Input,
  Label,
  Modal,
  Radio,
  RadioGroup,
  Spinner,
  TextField,
} from "@heroui/react";

export interface SpaceDialogSpec {
  icon: React.ReactNode;
  tone: "accent" | "warning" | "danger";
  title: string;
  body: string;
  choices?: {
    key: string;
    label: string;
    description: string;
    warning?: string;
  }[];
  choice?: string;
  onChoice?: (key: string) => void;
  input?: { label: string; placeholder?: string; value: string };
  onInput?: (value: string) => void;
  hint?: string;
  footnote?: string;
  cta: string;
  /** Omit for informational dialogs without a cancel action. */
  cancel?: string;
  disabled?: boolean;
}

const ICON_TONE = {
  accent: "bg-accent-soft text-accent-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  danger: "bg-danger-soft text-danger-soft-foreground",
};

export function SpaceDialog({
  spec,
  busy,
  onConfirm,
  onClose,
}: {
  spec: SpaceDialogSpec | null;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!spec) return null;

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Icon className={ICON_TONE[spec.tone]}>
              {spec.icon}
            </Modal.Icon>
            <Modal.Heading>{spec.title}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <p>{spec.body}</p>

            {spec.choices && (
              <RadioGroup
                aria-label={spec.title}
                value={spec.choice}
                onChange={(key) => spec.onChoice?.(key)}
              >
                {spec.choices.map((choice) => (
                  <Radio key={choice.key} value={choice.key}>
                    <Radio.Content>
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                      {choice.label}
                    </Radio.Content>
                    <Description>
                      {choice.description}
                      {spec.choice === choice.key && choice.warning && (
                        <span className="text-warning block">
                          {choice.warning}
                        </span>
                      )}
                    </Description>
                  </Radio>
                ))}
              </RadioGroup>
            )}

            {spec.input && (
              <TextField
                autoFocus
                value={spec.input.value}
                onChange={(value) => spec.onInput?.(value)}
              >
                <Label>{spec.input.label}</Label>
                <Input placeholder={spec.input.placeholder} />
                {spec.hint && <Description>{spec.hint}</Description>}
              </TextField>
            )}

            {spec.footnote && <p className="text-muted">{spec.footnote}</p>}
          </Modal.Body>
          <Modal.Footer>
            {spec.cancel && (
              <Button slot="close" variant="tertiary">
                {spec.cancel}
              </Button>
            )}
            <Button
              variant={spec.tone === "danger" ? "danger" : "primary"}
              isDisabled={spec.disabled}
              isPending={busy}
              onPress={onConfirm}
            >
              {busy && <Spinner color="current" size="sm" />}
              {spec.cta}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
