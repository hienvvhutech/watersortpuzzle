import { Easing } from 'react-native-reanimated';

export const animations = {
  springDefault: {
    damping: 12,
    stiffness: 100,
  },
  springSelected: {
    damping: 14,
    stiffness: 120,
  },
  springDamp: {
    damping: 18,
    stiffness: 150,
  },
  timingEase: {
    duration: 300,
    easing: Easing.inOut(Easing.ease),
  },
  timingLinear: {
    duration: 1800,
    easing: Easing.linear,
  },
};
