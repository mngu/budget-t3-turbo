import { router } from "expo-router";
import { Spinner } from "heroui-native";
import { useEffect } from "react";
import { View } from "react-native";

// Magic links land here, their cookie already stored by `+native-intent`. Links
// without one (an expired token) land here too, and fall back on the login screen.
export default function AuthCallback() {
  useEffect(() => {
    // Return to the screen already open instead of stacking a second one.
    router.dismissTo("/");
  }, []);

  return (
    <View className="bg-background flex-1 items-center justify-center">
      <Spinner />
    </View>
  );
}
