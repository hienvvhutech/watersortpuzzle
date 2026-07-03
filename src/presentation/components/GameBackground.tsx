import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop, Circle, Path, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, sizes } from '../theme';

interface BackgroundBubbleProps {
  delay: number;
  duration: number;
  startX: number;
  size: number;
}

const BackgroundBubble: React.FC<BackgroundBubbleProps> = ({ delay, duration, startX, size }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      progress.value = withRepeat(
        withTiming(1, { duration, easing: Easing.linear }),
        -1,
        false
      );
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const animStyle = useAnimatedStyle(() => {
    // Animate from screen bottom (screenHeight + 50) to off-screen top (-50)
    const yVal = (sizes.screenHeight + 50) - progress.value * (sizes.screenHeight + 100);
    // Sine curve to fade in smoothly in the center and fade out near the boundaries
    const opacityVal = 0.08 * Math.sin(progress.value * Math.PI);
    // Slight side sway using Math.sin
    const xSway = Math.sin(progress.value * Math.PI * 2) * 15;

    return {
      transform: [
        { translateY: yVal },
        { translateX: xSway },
      ],
      opacity: opacityVal,
    };
  }, [progress]);

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          left: startX,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        animStyle,
      ]}
    />
  );
};

export const GameBackground: React.FC = () => {
  return (
    <View style={StyleSheet.absoluteFill}>
      {/* 1. Base Gradient Canvas */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.backgroundStart} />
              <Stop offset="0.4" stopColor="#0f172a" />
              <Stop offset="1" stopColor={colors.backgroundEnd} />
            </LinearGradient>
            <LinearGradient id="glowGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.primaryLight} stopOpacity="0.18" />
              <Stop offset="0.6" stopColor="#a855f7" stopOpacity="0.04" />
              <Stop offset="1" stopColor="#000000" stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id="rayGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#818cf8" stopOpacity="0.05" />
              <Stop offset="1" stopColor="#818cf8" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#bgGrad)" />

          {/* 2. Top Glowing Orbs */}
          <Circle cx={sizes.screenWidth / 2} cy={-20} r={280} fill="url(#glowGrad)" />
          <Circle cx={0} cy={sizes.screenHeight * 0.4} r={180} fill="url(#glowGrad)" opacity={0.6} />

          {/* 3. Ambient Light Rays (Diagonal fans) */}
          <G opacity={0.7}>
            <Path
              d={`M ${sizes.screenWidth / 2},-20 L ${sizes.screenWidth * 0.1},${sizes.screenHeight} L ${sizes.screenWidth * 0.25},${sizes.screenHeight} Z`}
              fill="url(#rayGrad)"
            />
            <Path
              d={`M ${sizes.screenWidth / 2},-20 L ${sizes.screenWidth * 0.4},${sizes.screenHeight} L ${sizes.screenWidth * 0.6},${sizes.screenHeight} Z`}
              fill="url(#rayGrad)"
            />
            <Path
              d={`M ${sizes.screenWidth / 2},-20 L ${sizes.screenWidth * 0.75},${sizes.screenHeight} L ${sizes.screenWidth * 0.9},${sizes.screenHeight} Z`}
              fill="url(#rayGrad)"
            />
          </G>
        </Svg>
      </View>

      {/* 4. Layer of Drifting Ambient Particles */}
      <BackgroundBubble startX={sizes.screenWidth * 0.15} size={28} duration={12000} delay={0} />
      <BackgroundBubble startX={sizes.screenWidth * 0.45} size={18} duration={9000} delay={1500} />
      <BackgroundBubble startX={sizes.screenWidth * 0.75} size={36} duration={15000} delay={3000} />
      <BackgroundBubble startX={sizes.screenWidth * 0.3} size={24} duration={11000} delay={4500} />
      <BackgroundBubble startX={sizes.screenWidth * 0.6} size={32} duration={14000} delay={6000} />
      <BackgroundBubble startX={sizes.screenWidth * 0.85} size={20} duration={10000} delay={7500} />
    </View>
  );
};

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    backgroundColor: 'rgba(129, 140, 248, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(165, 180, 252, 0.3)',
  },
});
