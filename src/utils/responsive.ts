import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Breakpoints
export const BREAKPOINTS = {
  phone: 0,
  tablet: 768,
  largeTablet: 1024,
};

export const isTablet = () => SCREEN_WIDTH >= BREAKPOINTS.tablet;
export const isLargeTablet = () => SCREEN_WIDTH >= BREAKPOINTS.largeTablet;

// Base design width (iPhone 14 Pro = 393pt)
const BASE_WIDTH = 393;

export const wp = (percentage: number) => {
  const { width } = Dimensions.get('window');
  return (percentage / 100) * width;
};

export const hp = (percentage: number) => {
  const { height } = Dimensions.get('window');
  return (percentage / 100) * height;
};

// Responsive font size
export const rf = (size: number) => {
  const { width } = Dimensions.get('window');
  const scale = width / BASE_WIDTH;
  const newSize = size * Math.min(scale, isTablet() ? 1.2 : 1.1);
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Responsive spacing
export const rs = (size: number) => {
  const { width } = Dimensions.get('window');
  const scale = width / BASE_WIDTH;
  return Math.round(size * Math.min(scale, isTablet() ? 1.3 : 1.0));
};

export const getNumColumns = (min: number = 2, max: number = 4) => {
  const { width } = Dimensions.get('window');
  if (width >= BREAKPOINTS.largeTablet) return max;
  if (width >= BREAKPOINTS.tablet) return Math.min(max, 3);
  return min;
};

export const getCardWidth = (columns: number, padding: number = 32) => {
  const { width } = Dimensions.get('window');
  return (width - padding - (columns - 1) * 12) / columns;
};

// Layout helpers
export const layout = {
  padding: isTablet() ? 24 : 16,
  cardPadding: isTablet() ? 20 : 16,
  borderRadius: isTablet() ? 16 : 12,
  headerHeight: isTablet() ? 70 : 60,
};

export const screenWidth = SCREEN_WIDTH;
export const screenHeight = SCREEN_HEIGHT;
