import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Konfiguracja bazowa jest w app.json. Tu dokładamy tylko to, co zależy od zmiennych środowiska.
 *
 * Logowanie przez Google na iOS wymaga schematu URL z odwróconego iOS client ID
 * (`123-abc.apps.googleusercontent.com` → `com.googleusercontent.apps.123-abc`).
 * Bez EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID wtyczki nie dodajemy – przycisk Google na iOS się wtedy nie pokazuje.
 *
 * Dev client (APP_VARIANT=development albo profil EAS `development*`) nazywa się „Aloha Training Dev”,
 * żeby na telefonie odróżniał się od wersji ze sklepu.
 */
const isDevClient =
  process.env.APP_VARIANT === 'development' || process.env.EAS_BUILD_PROFILE?.startsWith('development') === true;

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  const plugins = [...(config.plugins ?? [])];

  if (iosClientId) {
    const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace(/\.apps\.googleusercontent\.com$/, '')}`;
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme }]);
  }

  const name = isDevClient ? 'Aloha Training Dev' : (config.name ?? 'Aloha Training');

  return { ...config, name, slug: config.slug ?? 'aloha-training', plugins };
};
