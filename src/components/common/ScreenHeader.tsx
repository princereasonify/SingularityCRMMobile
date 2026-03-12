import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { CS, Colors } from '../../theme';
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
  color = Colors.roles.FO.primary,
  onBack,
  rightAction,
}: ScreenHeaderProps) => {
  const insets = useSafeAreaInsets();
  const pt = insets.top + (Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0);

  return (
    <View style={[CS.headerContainer, { paddingTop: pt + 12, backgroundColor: color }]}>
      <View style={CS.headerRow}>
        {onBack && (
          <TouchableOpacity style={CS.headerBackBtn} onPress={onBack}>
            <ArrowLeft size={22} color={Colors.textInverse} />
          </TouchableOpacity>
        )}
        <View style={CS.headerTitleWrap}>
          <Text style={{ fontSize: rf(20), fontWeight: '700', color: Colors.textInverse }} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={{ fontSize: rf(13), color: 'rgba(255,255,255,0.75)', marginTop: 2 }} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {rightAction && <View style={CS.headerRightAction}>{rightAction}</View>}
      </View>
    </View>
  );
};
