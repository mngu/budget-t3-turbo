import { useLinkingURL } from "expo-linking";
import { router } from "expo-router";
import { Spinner } from "heroui-native";
import { useEffect } from "react";
import { View } from "react-native";

import { storeSessionCookie } from "~/lib/auth";

// Magic links redirect here once the server has verified them. The cookie is read
// from the raw URL because router params decode it a second time, which can
// corrupt its signature.
export default function AuthCallback() {
  const url = useLinkingURL();
  const cookie = url ? new URL(url).searchParams.get("cookie") : null;

  useEffect(() => {
    // Return to the screen already open instead of stacking a second one.
    const done = () => router.dismissTo("/");
    if (cookie) void storeSessionCookie(cookie).then(done);
    else done();
  }, [cookie]);

  return (
    <View className="bg-background flex-1 items-center justify-center">
      <Spinner />
    </View>
  );
}
