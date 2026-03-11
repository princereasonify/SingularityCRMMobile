import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { rf } from '../../utils/responsive';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  color?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export const ScreenHeader = ({
  title,
  subtitle,
  color = '#0d9488',
  onBack,
  rightAction,
}: ScreenHeaderProps) => {
  const insets = useSafeAreaInsets();
  const pt = insets.top + (Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0);

  return (
    <View style={[styles.header, { paddingTop: pt + 12, backgroundColor: color }]}>
      <View style={styles.row}>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <ArrowLeft size={22} color="#FFF" />
          </TouchableOpacity>
        )}
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>
        {rightAction && <View style={styles.rightAction}>{rightAction}</View>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 8,
    padding: 4,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: rf(20),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: rf(13),
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  rightAction: {
    marginLeft: 8,
  },
});
