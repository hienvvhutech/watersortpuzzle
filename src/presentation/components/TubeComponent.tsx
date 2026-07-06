import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Pressable, Platform } from 'react-native';
import Svg, { Path, G, ClipPath, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  Easing,
  runOnJS,
  useAnimatedProps,
  SharedValue,
} from 'react-native-reanimated';
import { SKINS, SkinConfig } from '../themes';
import { TubeSkin } from '../../domain/types';
import { TUBE_CAPACITY, getTopColorSegment } from '../../domain/rules';
import { sizes } from '../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface WaterLayerProps {
  color: string;
  slotIndex: number;
  isTop: boolean;
  wavePhase: SharedValue<number>;
  isSelected: boolean;
}

// 1.3x Scaled dimensions (65x214 tube layout)
const LAYER_HEIGHT = 42;
const TUBE_BOTTOM_Y = 198;
const TUBE_WIDTH = 60; // Inner water width

const WaterLayer: React.FC<WaterLayerProps> = ({ color, slotIndex, isTop, wavePhase, isSelected }) => {
  const heightVal = useSharedValue(color ? 1 : 0);
  const [renderColor, setRenderColor] = useState(color);

  useEffect(() => {
    if (color) {
      setRenderColor(color);
      heightVal.value = withTiming(1, { duration: 400 });
    } else {
      heightVal.value = withTiming(0, { duration: 400 }, (finished) => {
        if (finished) {
          runOnJS(setRenderColor)('');
        }
      });
    }
  }, [color]);

  const animatedProps = useAnimatedProps(() => {
    if (!renderColor) {
      return { d: '' };
    }

    const yBottom = TUBE_BOTTOM_Y - slotIndex * LAYER_HEIGHT;
    const currentHeight = heightVal.value * LAYER_HEIGHT;
    const yTop = yBottom - currentHeight;

    if (currentHeight <= 0) {
      return { d: '' };
    }

    const isMobile = Platform.OS !== 'web';
    // Only animate waves on web, or on mobile if the tube is currently active/selected (to save CPU on mobile)
    const animateWave = !isMobile || isSelected;

    if (isTop && animateWave) {
      // Sinusoidal wave simulation using quadratic Beziers (scaled by 1.3)
      const amplitude = 3.0;
      const wave1 = Math.sin(wavePhase.value) * amplitude;
      const wave2 = Math.cos(wavePhase.value) * amplitude;

      const x0 = 2.5;
      const x1 = x0 + TUBE_WIDTH / 4;
      const x2 = x0 + TUBE_WIDTH / 2;
      const x3 = x0 + (3 * TUBE_WIDTH) / 4;
      const x4 = x0 + TUBE_WIDTH;

      return {
        d: `M ${x0},${yBottom} 
            L ${x0},${yTop} 
            Q ${x1},${yTop + wave1} ${x2},${yTop} 
            Q ${x3},${yTop + wave2} ${x4},${yTop} 
            L ${x4},${yBottom} 
            Z`,
      };
    } else {
      // Flat top boundary for sub-layers
      const x0 = 2.5;
      const x4 = x0 + TUBE_WIDTH;
      return {
        d: `M ${x0},${yBottom} L ${x0},${yTop} L ${x4},${yTop} L ${x4},${yBottom} Z`,
      };
    }
  }, [renderColor, slotIndex, heightVal, isTop, wavePhase, isSelected]);

  if (!renderColor) return null;

  return <AnimatedPath animatedProps={animatedProps} fill={renderColor} opacity={0.92} />;
};

interface TubeComponentProps {
  tube: string[];
  tubeId: number;
  isSelected: boolean;
  skin: TubeSkin;
  onPress?: () => void;
  streamColor?: string;
}

export const TubeComponent: React.FC<TubeComponentProps> = ({
  tube,
  tubeId,
  isSelected,
  skin,
  onPress,
  streamColor,
}) => {
  const skinConfig = SKINS[skin] || SKINS.glass;
  const liftVal = useSharedValue(0);
  const floatVal = useSharedValue(0);
  const wavePhase = useSharedValue(0);

  // Selection bounce/lift animation
  useEffect(() => {
    liftVal.value = withSpring(isSelected ? -25 : 0, {
      damping: 14,
      stiffness: 120,
    });

    if (isSelected) {
      // Gentle floating animation while selected
      floatVal.value = withRepeat(
        withTiming(-6, {
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      );
    } else {
      floatVal.value = withSpring(0, { damping: 12 });
    }
  }, [isSelected]);

  // Infinite wave phase animation
  useEffect(() => {
    wavePhase.value = withRepeat(
      withTiming(Math.PI * 2, {
        duration: 1800,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: liftVal.value + floatVal.value },
        { scale: withSpring(isSelected ? 1.06 : 1, { damping: 12 }) },
      ],
    };
  }, [liftVal, floatVal, isSelected]);

  // Determine which slot is currently the top-most visible one
  const topIndex = tube.length - 1;

  // Render slots from 0 to TUBE_CAPACITY - 1
  const slots = Array.from({ length: TUBE_CAPACITY });

  // 1.3x Scaled SVG Path coordinates (65x214 tube layout)
  const innerUPath = `M 2.5,0 L 2.5,168 A 30,30 0 0 0 62.5,168 L 62.5,0`;
  const outerUPath = `M 1,0 L 1,168 A 31.5,31.5 0 0 0 64,168 L 64,0`;
  const glassReflectPath = `M 6,7 L 6,163 A 26.5,26.5 0 0 0 59,163 L 59,7`;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Pressable onPress={onPress} style={styles.pressable}>
        <Svg width={sizes.tubeWidth} height={sizes.tubeHeight} viewBox="0 0 65 214" style={{ pointerEvents: 'none' }}>
          <Defs>
            {/* Clip path to match the inside of the tube */}
            <ClipPath id={`clip-${tubeId}`}>
              <Path d={innerUPath} />
            </ClipPath>
            {/* Premium glossy linear gradient highlight */}
            <LinearGradient id="glassGradient" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#ffffff" stopOpacity={0.22} />
              <Stop offset="0.25" stopColor="#ffffff" stopOpacity={0.08} />
              <Stop offset="0.75" stopColor="#ffffff" stopOpacity={0.02} />
              <Stop offset="1" stopColor="#ffffff" stopOpacity={0.35} />
            </LinearGradient>
          </Defs>

          {/* Tube Glass Background Tint */}
          <Path d={innerUPath} fill={skinConfig.bgFill || 'rgba(255, 255, 255, 0.05)'} />

          {/* Water Layers Clipped to Inner Tube Shape */}
          <G clipPath={`url(#clip-${tubeId})`}>
            {slots.map((_, idx) => {
              const color = tube[idx] || '';
              const isTop = idx === topIndex;
              return (
                <WaterLayer
                  key={`water-${tubeId}-${idx}`}
                  color={color}
                  slotIndex={idx}
                  isTop={isTop}
                  wavePhase={wavePhase}
                  isSelected={isSelected}
                />
              );
            })}
          </G>

          {/* Glass Glossy Highlight reflection overlaying the water layers */}
          <Path d={innerUPath} fill="url(#glassGradient)" />

          {/* Pouring Stream (if active) */}
          {streamColor && (
            <Path
              d={`M 32.5,3 L 32.5,${TUBE_BOTTOM_Y - tube.length * LAYER_HEIGHT}`}
              stroke={streamColor}
              strokeWidth={5}
              opacity={0.85}
              strokeLinecap="round"
            />
          )}

          {/* Tube Rim Highlight at Top */}
          <Rect x={1} y={0} width={63} height={4.5} rx={2.25} fill={skinConfig.borderColor} opacity={0.85} />

          {/* Tube Outer Glass Outline */}
          <Path
            d={outerUPath}
            fill="none"
            stroke={skinConfig.borderColor}
            strokeWidth={3.5}
            strokeLinecap="round"
          />

          {/* Glass Glossy Highlight reflection */}
          <Path
            d={glassReflectPath}
            fill="none"
            stroke="url(#glassGradient)"
            strokeWidth={2}
          />
        </Svg>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: sizes.tubeWidth,
    height: sizes.tubeHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  pressable: {
    width: sizes.tubeWidth,
    height: sizes.tubeHeight,
  },
});

export default TubeComponent;
