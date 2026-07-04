import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAudio } from '../src/presentation/hooks/useAudio';

export default function RootLayout() {
  const { startBgm } = useAudio();

  useEffect(() => {
    // Start BGM on launch if enabled in settings
    startBgm().catch((e) => console.warn('BGM failed to play on start', e));
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0b0f19' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="game" />
      </Stack>
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}
