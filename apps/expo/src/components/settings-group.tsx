import type { ReactNode } from "react";

import { ListGroup, Separator, Typography } from "heroui-native";
import { Children, Fragment } from "react";
import { View } from "react-native";

// A titled group of rows, as in the platform's own settings screens.
export function SettingsGroup({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      {title && (
        <Typography
          type="body-xs"
          color="muted"
          className="px-4 font-semibold tracking-wider uppercase"
        >
          {title}
        </Typography>
      )}
      <ListGroup>
        {Children.toArray(children).map((child, index) => (
          <Fragment key={index}>
            {index > 0 && <Separator className="mx-4" />}
            {child}
          </Fragment>
        ))}
      </ListGroup>
      {footer && (
        <Typography type="body-xs" color="muted" className="px-4">
          {footer}
        </Typography>
      )}
    </View>
  );
}
