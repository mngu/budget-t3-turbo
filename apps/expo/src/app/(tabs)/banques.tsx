import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function BanquesScreen() {
  return (
    <SafeAreaView className="bg-background flex-1">
      <View className="flex-1 items-center justify-center">
        <Text className="text-foreground">Banques à venir</Text>
      </View>
    </SafeAreaView>
  );
}
