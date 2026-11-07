import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScrollView } from "react-native";

import { CheckItem, SettingsGroup } from "~/components/settings-group";
import { trpc } from "~/lib/trpc";

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

// The space's budget month, shared with the web and every member.
export default function MonthStartDay() {
  const { data: current } = useQuery(trpc.spaces.monthStartDay.queryOptions());
  const { mutate } = useMutation({
    ...trpc.spaces.setMonthStartDay.mutationOptions(),
    onSuccess: () => router.back(),
  });

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-6 p-4"
      contentInsetAdjustmentBehavior="automatic"
    >
      <SettingsGroup footer="Pour suivre un salaire versé en fin de mois. Un jour absent d'un mois court tombe sur son dernier jour. Le réglage vaut pour tout l'espace, sur le web comme sur mobile.">
        {DAYS.map((day) => (
          <CheckItem
            key={day}
            label={day === 1 ? "1er" : `Le ${day}`}
            selected={current === day}
            onPress={() => mutate(day)}
          />
        ))}
      </SettingsGroup>
    </ScrollView>
  );
}
