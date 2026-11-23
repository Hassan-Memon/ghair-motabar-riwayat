import '@/features/content/backgroundTask';

import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/ui/states';
import { AppProviders, useColors, useT } from '@/providers/app-providers';
import { startupFonts } from '@/theme/fonts';
import { fontFamily } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync();

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  // The app is right-to-left in every language: the content is Urdu and Arabic.
  document.documentElement.dir = 'rtl';
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(startupFonts);
  const ready = fontsLoaded || !!fontError;

  return (
    <AppProviders
      fallback={({ error, retry }) => {
        if (error) {
          void SplashScreen.hideAsync();
          return <ErrorState onRetry={retry} message={error.message} />;
        }
        return <Loading />;
      }}>
      {ready ? <AppStack /> : <Loading />}
    </AppProviders>
  );
}

function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator />
    </View>
  );
}

function AppStack() {
  const { colors, dark } = useColors();
  const { t, lang } = useT();

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  const navTheme = useMemo(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.separator,
      },
    };
  }, [dark, colors]);

  const headerFont =
    lang === 'en' ? {} : { fontFamily: lang === 'ar' ? fontFamily.arabicFallback : fontFamily.mehr };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerTintColor: colors.primary,
          headerTitleStyle: { ...headerFont, color: colors.text },
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          headerBackButtonDisplayMode: 'minimal',
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t('appName') }} />
        <Stack.Screen name="hadith/[slug]" options={{ title: '' }} />
        <Stack.Screen
          name="footnote"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.45, 0.9],
            sheetGrabberVisible: true,
            title: t('hadith.references'),
          }}
        />
        <Stack.Screen
          name="search-filters"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.6, 0.95],
            sheetGrabberVisible: true,
            title: t('search.filters'),
          }}
        />
        <Stack.Screen name="books/[book]" options={{ title: t('books.title') }} />
        <Stack.Screen name="chapters/[slug]" options={{ title: t('all.chapters') }} />
        <Stack.Screen name="narrators/[slug]" options={{ title: t('narrators.title') }} />
        <Stack.Screen name="bookmarks" options={{ title: t('bookmarks.title') }} />
        <Stack.Screen name="history" options={{ title: t('history.title') }} />
        <Stack.Screen name="library" options={{ title: t('library.title') }} />
        <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
        <Stack.Screen name="about" options={{ title: t('about.title') }} />
        <Stack.Screen name="+not-found" options={{ title: t('common.notFound') }} />
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
