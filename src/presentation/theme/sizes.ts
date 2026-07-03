import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Responsive scale factor based on screen height to prevent vertical overflow
// Base target height is 844px (iPhone 12/13/14 Pro)
const scale = height < 700 ? 0.82 : (height < 800 ? 0.92 : 1.0);

const tubeWidth = Math.round(65 * scale);
const tubeHeight = Math.round(214 * scale);
const tubeGapX = Math.round(14 * scale);
const rowHeight = Math.round(230 * scale);
const y1 = Math.round(15 * scale);
const y2 = y1 + rowHeight;

export const sizes = {
  screenWidth: width,
  screenHeight: height,
  tubeWidth,
  tubeHeight,
  tubeGapX,
  spacingX: tubeWidth + tubeGapX,
  rowHeight,
  y1,
  y2,
};
