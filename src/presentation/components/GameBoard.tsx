import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import TubeComponent from './TubeComponent';
import { useGameStore } from '../store/gameStore';
import { isValidMove, executeMove, TUBE_CAPACITY, getTopColorSegment } from '../../domain/rules';
import { useHaptics } from '../hooks/useHaptics';
import { useAudio } from '../hooks/useAudio';
import { SplashEffect, TubeBubbles } from './ParticleEffect';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface TubeWrapperProps {
  tx: Animated.SharedValue<number>;
  ty: Animated.SharedValue<number>;
  rot: Animated.SharedValue<number>;
  pos: { x: number; y: number };
  tubeWidth: number;
  tubeHeight: number;
  children: React.ReactNode;
}

// Dedicated wrapper component to resolve Rule of Hooks (useAnimatedStyle) inside the loop
const TubeWrapper: React.FC<TubeWrapperProps> = ({ tx, ty, rot, pos, tubeWidth, tubeHeight, children }) => {
  const pivotY = -tubeHeight / 2;
  const animStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: tx.value },
        { translateY: ty.value },
        { translateY: pivotY },
        { rotate: `${rot.value}deg` },
        { translateY: -pivotY },
      ],
    };
  }, [tx, ty, rot, tubeHeight]);

  return (
    <Animated.View
      style={[
        styles.absoluteTubeWrapper,
        {
          left: pos.x,
          top: pos.y,
          width: tubeWidth,
          height: tubeHeight,
        },
        animStyle,
      ]}
    >
      {children}
    </Animated.View>
  );
};

export const GameBoard: React.FC = () => {
  const { tubes, selectedTubeIndex, inventory, tapTube } = useGameStore();
  const currentSkin = inventory.currentSkin;
  
  const haptics = useHaptics();
  const audio = useAudio();

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Responsive Board boundaries
  const boardWidth = Math.min(windowWidth, 480);
  const boardHeight = windowHeight * 0.70; // Matches the 70% layout region height

  // Dynamically scale tubes relative to design viewport width & height
  const scale = Math.min(boardWidth / 390, boardHeight / 580);
  const TUBE_WIDTH = Math.round(54 * scale);
  const TUBE_HEIGHT = Math.round(180 * scale);

  const [visualTubes, setVisualTubes] = useState<string[][]>([]);
  const isAnimating = useRef(false);

  // Pouring stream state
  const [activeStream, setActiveStream] = useState<{ toIdx: number; color: string } | null>(null);

  // Splash particle state
  const [splash, setSplash] = useState<{ active: boolean; x: number; y: number; color: string }>({
    active: false,
    x: 0,
    y: 0,
    color: '',
  });

  // Keep local visual tubes in sync with store tubes during idle states
  useEffect(() => {
    if (!isAnimating.current) {
      setVisualTubes(tubes.map((t) => [...t]));
    }
  }, [tubes]);

  // Create static shared values for tube transforms (up to 10 tubes max) to conform to Rules of Hooks
  const t0 = { tx: useSharedValue(0), ty: useSharedValue(0), rot: useSharedValue(0) };
  const t1 = { tx: useSharedValue(0), ty: useSharedValue(0), rot: useSharedValue(0) };
  const t2 = { tx: useSharedValue(0), ty: useSharedValue(0), rot: useSharedValue(0) };
  const t3 = { tx: useSharedValue(0), ty: useSharedValue(0), rot: useSharedValue(0) };
  const t4 = { tx: useSharedValue(0), ty: useSharedValue(0), rot: useSharedValue(0) };
  const t5 = { tx: useSharedValue(0), ty: useSharedValue(0), rot: useSharedValue(0) };
  const t6 = { tx: useSharedValue(0), ty: useSharedValue(0), rot: useSharedValue(0) };
  const t7 = { tx: useSharedValue(0), ty: useSharedValue(0), rot: useSharedValue(0) };
  const t8 = { tx: useSharedValue(0), ty: useSharedValue(0), rot: useSharedValue(0) };
  const t9 = { tx: useSharedValue(0), ty: useSharedValue(0), rot: useSharedValue(0) };

  const transforms = [t0, t1, t2, t3, t4, t5, t6, t7, t8, t9];

  const getTubePosition = (idx: number, totalTubes: number) => {
    // If total tubes <= 4, they fit in 1 row centered
    if (totalTubes <= 4) {
      const gapX = (boardWidth - totalTubes * TUBE_WIDTH) / (totalTubes + 1);
      const x = gapX + idx * (TUBE_WIDTH + gapX);
      const gapY = (boardHeight - TUBE_HEIGHT) / 2;
      return { x, y: gapY };
    } else {
      // 2 rows layout distributed evenly
      const itemsInRow1 = Math.ceil(totalTubes / 2);
      const itemsInRow2 = totalTubes - itemsInRow1;

      const isRow2 = idx >= itemsInRow1;
      const rowIdx = isRow2 ? idx - itemsInRow1 : idx;
      const numItemsInThisRow = isRow2 ? itemsInRow2 : itemsInRow1;

      const gapX = (boardWidth - numItemsInThisRow * TUBE_WIDTH) / (numItemsInThisRow + 1);
      const x = gapX + rowIdx * (TUBE_WIDTH + gapX);

      const gapY = (boardHeight - 2 * TUBE_HEIGHT) / 3;
      const y = isRow2 ? 2 * gapY + TUBE_HEIGHT : gapY;
      return { x, y };
    }
  };

  const shakeTube = (idx: number) => {
    const { tx } = transforms[idx];
    tx.value = withSequence(
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(-4, { duration: 50 }),
      withTiming(4, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  };

  const handleTubePress = async (idx: number) => {
    if (isAnimating.current) return;

    // Check if we can pour from selectedTubeIndex to idx
    if (
      selectedTubeIndex !== null &&
      selectedTubeIndex !== idx &&
      isValidMove(tubes, selectedTubeIndex, idx, TUBE_CAPACITY)
    ) {
      isAnimating.current = true;
      const fromIdx = selectedTubeIndex;
      const toIdx = idx;

      // Calculate translation metrics
      const fromPos = getTubePosition(fromIdx, tubes.length);
      const toPos = getTubePosition(toIdx, tubes.length);

      const dx = toPos.x - fromPos.x;
      // Position mouth of A (y=0) right above mouth of B (y=toPos.y) with a 5px airgap
      const dy = toPos.y - fromPos.y - TUBE_HEIGHT - 5; 

      const isRight = dx > 0;
      const targetRotation = isRight ? 75 : -75;

      const fromTransforms = transforms[fromIdx];

      // 1. Move from origin to destination
      fromTransforms.tx.value = withTiming(dx, { duration: 220 });
      fromTransforms.ty.value = withTiming(dy, { duration: 220 });
      await sleep(220);

      // 2. Tilt source tube
      fromTransforms.rot.value = withTiming(targetRotation, { duration: 150 });
      await sleep(150);

      // 3. Start Pouring!
      const topColor = getTopColorSegment(tubes[fromIdx])?.color || '';
      
      // Render stream inside destination tube
      setActiveStream({ toIdx, color: topColor });

      // Trigger splash particles at destination lip
      // Offset by center x of B and 10px (lip y of B)
      setSplash({
        active: true,
        x: toPos.x + TUBE_WIDTH / 2,
        y: toPos.y + 10 * scale,
        color: topColor,
      });

      // Animate liquid heights by updating local render state
      const { tubes: nextVisualTubes } = executeMove(visualTubes, fromIdx, toIdx, TUBE_CAPACITY);
      setVisualTubes(nextVisualTubes);

      audio.playSound('pour');
      haptics.impactLight();

      // Wait for pouring flow duration
      await sleep(250);

      // 4. Stop Pour flow (hide stream and splash)
      setActiveStream(null);
      setSplash((prev) => ({ ...prev, active: false }));

      // 5. Untilt and return source tube back to origin
      fromTransforms.rot.value = withTiming(0, { duration: 150 });
      await sleep(150);

      fromTransforms.tx.value = withTiming(0, { duration: 180 });
      fromTransforms.ty.value = withTiming(0, { duration: 180 });
      await sleep(180);

      // 6. Commit move to game store state
      const res = useGameStore.getState().tapTube(toIdx);
      
      // Re-sync local render state with store
      setVisualTubes(useGameStore.getState().tubes.map((t) => [...t]));

      if (res.isWon) {
        audio.playSound('victory');
        haptics.success();
      }

      isAnimating.current = false;
    } else {
      // Normal click selection or error invalid selection
      const res = tapTube(idx);
      
      // Update visual state immediately for direct selection changes
      setVisualTubes(useGameStore.getState().tubes.map((t) => [...t]));

      if (res.soundEffect === 'click') {
        audio.playSound('click');
        haptics.selection();
      } else if (res.soundEffect === 'error') {
        audio.playSound('error');
        haptics.error();
        shakeTube(idx);
      }
    }
  };

  return (
    <View style={[styles.board, { width: boardWidth, height: boardHeight }]}>
      {visualTubes.map((tube, idx) => {
        const pos = getTubePosition(idx, tubes.length);
        const { tx, ty, rot } = transforms[idx];
        const streamColor = activeStream?.toIdx === idx ? activeStream.color : undefined;
        
        // Calculate liquid filled height inside the tube for showing bubble particles
        const filledHeight = tube.length * 32 * scale;

        return (
          <TubeWrapper
            key={`tube-slot-${idx}`}
            tx={tx}
            ty={ty}
            rot={rot}
            pos={pos}
            tubeWidth={TUBE_WIDTH}
            tubeHeight={TUBE_HEIGHT}
          >
            <TubeComponent
              tube={tube}
              tubeId={idx}
              isSelected={selectedTubeIndex === idx}
              skin={currentSkin}
              onPress={() => handleTubePress(idx)}
              streamColor={streamColor}
            />
            {/* Show bubble particles inside the tube if it contains liquid */}
            <TubeBubbles tubeHeight={TUBE_HEIGHT} filledHeight={filledHeight} />
          </TubeWrapper>
        );
      })}

      {/* Render splash droplets at the destination tube lip */}
      <SplashEffect
        x={splash.x}
        y={splash.y}
        color={splash.color}
        active={splash.active}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  board: {
    position: 'relative',
  },
  absoluteTubeWrapper: {
    position: 'absolute',
  },
});

export default GameBoard;
