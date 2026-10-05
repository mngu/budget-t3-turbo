import { Tabs } from "expo-router";
import { ChartPie, List } from "lucide-react-native";

import { BankPicker } from "~/components/bank-picker";
import { PeriodPicker } from "~/components/period-picker";

export default function TabsLayout() {
  return (
    // Both tabs show the same period, so its picker stands in for their titles.
    <Tabs
      screenOptions={{
        headerTitle: () => <PeriodPicker />,
        headerRight: () => <BankPicker />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Revue",
          tabBarIcon: ({ color, size }) => (
            <ChartPie color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color, size }) => <List color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
