import { Tabs } from "expo-router";
import { LandmarkIcon, ReceiptTextIcon } from "lucide-react-native";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color, size }) => (
            <ReceiptTextIcon color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="banques"
        options={{
          title: "Banques",
          tabBarIcon: ({ color, size }) => (
            <LandmarkIcon color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
