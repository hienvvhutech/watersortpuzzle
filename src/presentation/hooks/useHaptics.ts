import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../store/settingsStore';

export const useHaptics = () => {
  const vibrationEnabled = useSettingsStore((state) => state.vibrationEnabled);

  const selection = () => {
    if (!vibrationEnabled) return;
    Haptics.selectionAsync().catch(() => {});
  };

  const impactLight = () => {
    if (!vibrationEnabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const impactMedium = () => {
    if (!vibrationEnabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const success = () => {
    if (!vibrationEnabled) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const error = () => {
    if (!vibrationEnabled) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  };

  return {
    selection,
    impactLight,
    impactMedium,
    success,
    error,
  };
};
