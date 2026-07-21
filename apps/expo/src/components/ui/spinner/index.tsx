"use client";

import React from "react";
import { ActivityIndicator } from "react-native";
import { tva } from "@gluestack-ui/utils/nativewind-utils";
import { styled } from "nativewind";

// La forme objet de styled() est rejetée par le typage de nativewind
// 5.0.0-preview.4 — même simplification que pour icon/badge.
const StyledActivityIndicator = styled(ActivityIndicator, {
  className: "style",
});
const spinnerStyle = tva({});

const Spinner = React.forwardRef<
  React.ComponentRef<typeof ActivityIndicator>,
  React.ComponentProps<typeof ActivityIndicator>
>(function Spinner(
  {
    className,
    color,
    focusable = false,
    "aria-label": ariaLabel = "loading",
    ...props
  },
  ref,
) {
  return (
    <StyledActivityIndicator
      ref={ref}
      focusable={focusable}
      aria-label={ariaLabel}
      {...props}
      color={color}
      className={spinnerStyle({ class: className })}
    />
  );
});

Spinner.displayName = "Spinner";

export { Spinner };
