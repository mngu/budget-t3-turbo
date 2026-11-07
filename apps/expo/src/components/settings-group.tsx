import type { ReactNode } from "react";
import type { TextInputProps } from "react-native";

import { ListGroup, Separator, Typography, useThemeColor } from "heroui-native";
import { Check } from "lucide-react-native";
import { Children, Fragment, useState } from "react";
import { TextInput, View } from "react-native";

// A titled group of rows, as in the platform's own settings screens.
export function SettingsGroup({
  title,
  icon,
  footer,
  children,
}: {
  title?: string;
  icon?: ReactNode;
  footer?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      {title && (
        <View className="flex-row items-center gap-1.5 px-4">
          {icon}
          <Typography
            type="body-xs"
            color="muted"
            className="font-semibold tracking-wider uppercase"
          >
            {title}
          </Typography>
        </View>
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

// One choice among several, marked like the platform's own pickers.
export function CheckItem({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const accent = useThemeColor("accent");
  return (
    <ListGroup.Item onPress={onPress}>
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle>{label}</ListGroup.ItemTitle>
      </ListGroup.ItemContent>
      {/* Transparent rather than absent: an empty suffix renders the default chevron. */}
      <ListGroup.ItemSuffix>
        <Check size={18} color={selected ? accent : "transparent"} />
      </ListGroup.ItemSuffix>
    </ListGroup.Item>
  );
}

// A row that acts rather than navigates, tinted by what it does.
export function ActionItem({
  label,
  tone,
  isDisabled,
  onPress,
}: {
  label: string;
  tone: "accent" | "danger";
  isDisabled?: boolean;
  onPress: () => void;
}) {
  const color = useThemeColor(tone);
  return (
    <ListGroup.Item
      disabled={isDisabled}
      className={isDisabled ? "opacity-50" : undefined}
      onPress={onPress}
    >
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle style={{ color }}>{label}</ListGroup.ItemTitle>
      </ListGroup.ItemContent>
    </ListGroup.Item>
  );
}

// A bare text field filling its row, as in the platform's own forms.
export function TextItem(props: TextInputProps) {
  const muted = useThemeColor("muted");
  return (
    <TextInput
      placeholderTextColor={muted}
      autoCorrect={false}
      returnKeyType="done"
      className="text-foreground px-4 py-3.5 text-base"
      {...props}
    />
  );
}

// Committed on leaving the field, as the web's inputs on blur. Key it on the
// value so a rename made elsewhere resets the draft.
export function RenameItem({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  return (
    <TextItem
      value={text}
      onChangeText={setText}
      onEndEditing={() => {
        const trimmed = text.trim();
        if (trimmed && trimmed !== value) onCommit(trimmed);
        else setText(value);
      }}
    />
  );
}
