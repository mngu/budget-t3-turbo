import { Button as ButtonPrimitive } from "@base-ui/react/button";
import {
  buttonVariants as heroButtonVariants,
  linkVariants,
} from "@heroui/styles";

import { cn } from "@budget/ui";

// HeroUI's look on Base UI's button: React Aria's Button drops DOM props it does
// not know (`title`, `style`, `tabIndex`), which Base UI triggers and screens pass.
const VARIANTS = {
  default: "primary",
  outline: "outline",
  secondary: "secondary",
  ghost: "ghost",
  destructive: "danger",
} as const;

const SIZES = {
  default: { size: "md" },
  xs: { size: "sm" },
  sm: { size: "sm" },
  lg: { size: "lg" },
  icon: { size: "md", isIconOnly: true },
  "icon-xs": { size: "sm", isIconOnly: true },
  "icon-sm": { size: "sm", isIconOnly: true },
  "icon-lg": { size: "lg", isIconOnly: true },
} as const;

interface ButtonVariantProps {
  variant?: keyof typeof VARIANTS | "link";
  size?: keyof typeof SIZES;
}

function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: ButtonVariantProps & { className?: string } = {}) {
  return variant === "link"
    ? cn(linkVariants().base(), className)
    : heroButtonVariants({
        variant: VARIANTS[variant],
        ...SIZES[size],
        className,
      });
}

function Button({
  className,
  variant,
  size,
  ...props
}: Omit<ButtonPrimitive.Props, "className"> &
  ButtonVariantProps & { className?: string }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}

export { Button, buttonVariants };
