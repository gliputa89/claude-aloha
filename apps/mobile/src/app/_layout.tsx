import "@/lib/theme-preference";

import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";

import { fontFamily } from "@/components/ui/text";
import { BootGate } from "@/features/boot/boot-gate";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useColors } from "@/hooks/use-colors";
import { useT } from "@/hooks/use-t";
import { AuthProvider, useAuth, useOnboarded } from "@/providers/auth-provider";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  return (
    <AuthProvider>
      <RootNavigator fontsReady={fontsLoaded || !!fontError} />
    </AuthProvider>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const c = useColors();
  const t = useT();
  const { session, ready } = useAuth();
  const onboarded = useOnboarded();

  useEffect(() => {
    if (fontsReady && ready) SplashScreen.hideAsync();
  }, [fontsReady, ready]);

  // Zimny start od razu do aplikacji (sesja i ukończona ankieta): ekran ze słońcem zasłania ją do kompletu danych.
  // Decyzja zapada raz – po zalogowaniu albo ankiecie w trakcie sesji użytkownik wchodzi bez zasłony.
  const appReady = fontsReady && ready;
  const [bootHold, setBootHold] = useState<boolean | null>(null);
  if (appReady && bootHold === null) setBootHold(!!session && onboarded);

  if (!appReady) return null;

  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: c.action,
      background: c.background,
      card: c.background,
      text: c.text,
      border: c.border,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <BootGate active={bootHold === true && !!session}>
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerTintColor: c.text,
            headerStyle: { backgroundColor: c.background },
            headerTitle: "",
            headerBackTitle: t("common.back"),
            headerBackButtonDisplayMode: "minimal",
            headerTitleStyle: { fontFamily: fontFamily.bold },
            contentStyle: { backgroundColor: c.background },
            // Ikony paska statusu według trybu aplikacji, a nie telefonu (domyślnie apka jest jasna).
            statusBarStyle: scheme === "dark" ? "light" : "dark",
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Protected guard={!!session && onboarded}>
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
          </Stack.Protected>
          {/* Ankieta startowa przy pierwszym wejściu – dopóki nie zostanie ukończona. */}
          <Stack.Protected guard={!!session && !onboarded}>
            <Stack.Screen
              name="(onboarding)"
              options={{ headerShown: false, gestureEnabled: false }}
            />
          </Stack.Protected>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          </Stack.Protected>
          {/* Linki z e-maili – dostępne z sesją i bez niej. */}
          <Stack.Screen
            name="auth/callback"
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen name="auth/reset-password" />
          {/* Podglądy deweloperskie – poza development buildem trasa przekierowuje na start. */}
          <Stack.Screen
            name="dev/plan-loader"
            options={{ headerShown: false }}
          />
          <Stack.Screen name="dev/weather" options={{ headerShown: false }} />
        </Stack>
      </BootGate>
    </ThemeProvider>
  );
}
