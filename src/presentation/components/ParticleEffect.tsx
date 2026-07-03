import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ----------------------------------------------------
// 1. Splash Particle (Droplets during pour)
// ----------------------------------------------------
interface SplashParticleProps {
  x: number;
  y: number;
  color: string;
}

const SplashParticle: React.FC<SplashParticleProps> = ({ x, y, color }) => {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // Random angle and distance
    const angle = Math.random() * Math.PI - Math.PI; // Burst upwards and sideways
    const speed = 30 + Math.random() * 40;
    const destX = Math.cos(angle) * speed;
    const destY = Math.sin(angle) * speed + 15; // Gravity drop

    tx.value = withTiming(destX, { duration: 400, easing: Easing.out(Easing.quad) });
    ty.value = withSequence(
      withTiming(destY - 20, { duration: 200, easing: Easing.out(Easing.quad) }),
      withTiming(destY + 50, { duration: 200, easing: Easing.in(Easing.quad) })
    );
    scale.value = withTiming(0.2, { duration: 400 });
    opacity.value = withTiming(0, { duration: 400 });
  }, []);

  const style = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      left: x,
      top: y,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: color,
      transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
      opacity: opacity.value,
    };
  }, [x, y, color, tx, ty, scale, opacity]);

  return <Animated.View style={style} />;
};

export const SplashEffect: React.FC<{ x: number; y: number; color: string; active: boolean }> = ({
  x,
  y,
  color,
  active,
}) => {
  if (!active) return null;

  // Generate 8 droplets
  const particles = Array.from({ length: 8 });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((_, i) => (
        <SplashParticle key={`splash-${i}`} x={x} y={y} color={color} />
      ))}
    </View>
  );
};

// ----------------------------------------------------
// 2. Bubble Particle (Inside tubes)
// ----------------------------------------------------
interface BubbleProps {
  x: number;
  y: number;
}

const Bubble: React.FC<BubbleProps> = ({ x, y }) => {
  const ty = useSharedValue(0);
  const opacity = useSharedValue(0.4);
  const tx = useSharedValue(0);

  useEffect(() => {
    ty.value = withRepeat(
      withTiming(-60, { duration: 1500 + Math.random() * 1000, easing: Easing.linear }),
      -1,
      false
    );
    tx.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 400, easing: Easing.sin }),
        withTiming(3, { duration: 400, easing: Easing.sin })
      ),
      -1,
      true
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 500 }),
        withTiming(0, { duration: 1000 })
      ),
      -1,
      false
    );
  }, []);

  const style = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      left: x,
      top: y,
      width: 4,
      height: 4,
      borderRadius: 2,
      borderWidth: 0.8,
      borderColor: 'rgba(255, 255, 255, 0.6)',
      backgroundColor: 'transparent',
      transform: [{ translateY: ty.value }, { translateX: tx.value }],
      opacity: opacity.value,
    };
  }, [x, y, ty, tx, opacity]);

  return <Animated.View style={style} />;
};

export const TubeBubbles: React.FC<{ tubeHeight: number; filledHeight: number }> = ({
  tubeHeight,
  filledHeight,
}) => {
  if (filledHeight <= 0) return null;

  // Render 3 bubbles at different starting points
  return (
    <View style={{ position: 'absolute', width: '100%', height: filledHeight, bottom: 5 }} pointerEvents="none">
      <Bubble x={12} y={filledHeight - 10} />
      <Bubble x={24} y={filledHeight - 25} />
      <Bubble x={35} y={filledHeight - 15} />
    </View>
  );
};

// ----------------------------------------------------
// 3. Confetti Particle (Victory Screen)
// ----------------------------------------------------
interface ConfettiFlakeProps {
  color: string;
  delay: number;
}

const CONFETTI_COLORS = ['#FF6B6B', '#4D96FF', '#6BCB77', '#FFD93D', '#A06FFF', '#FF9F45', '#00D7C6', '#FF78F0'];

const ConfettiFlake: React.FC<ConfettiFlakeProps> = ({ color, delay }) => {
  const startX = Math.random() * SCREEN_WIDTH;
  const ty = useSharedValue(-50);
  const tx = useSharedValue(startX);
  const rot = useSharedValue(0);
  const scale = useSharedValue(0.5 + Math.random() * 0.8);

  useEffect(() => {
    ty.value = withDelay(
      delay,
      withTiming(SCREEN_HEIGHT + 50, {
        duration: 2500 + Math.random() * 1500,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      })
    );

    rot.value = withDelay(
      delay,
      withRepeat(
        withTiming(360 * (Math.random() > 0.5 ? 1 : -1), {
          duration: 1000 + Math.random() * 1000,
          easing: Easing.linear,
        }),
        -1,
        false
      )
    );

    tx.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(startX - 30, { duration: 600, easing: Easing.sin }),
          withTiming(startX + 30, { duration: 600, easing: Easing.sin })
        ),
        -1,
        true
      )
    );
  }, []);

  const style = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      width: 10,
      height: 10,
      backgroundColor: color,
      borderRadius: Math.random() > 0.5 ? 0 : 5, // Mix squares and circles
      transform: [
        { translateX: tx.value },
        { translateY: ty.value },
        { rotate: `${rot.value}deg` },
        { scale: scale.value },
      ],
    };
  }, [color, tx, ty, rot, scale]);

  return <Animated.View style={style} />;
};

export const ConfettiEffect: React.FC<{ active: boolean }> = ({ active }) => {
  if (!active) return null;

  const flakes = Array.from({ length: 60 });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {flakes.map((_, i) => {
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const delay = Math.random() * 800; // stagger start times
        return <ConfettiFlake key={`confetti-${i}`} color={color} delay={delay} />;
      })}
    </View>
  );
};
