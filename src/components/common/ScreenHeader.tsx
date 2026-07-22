import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Menu } from 'lucide-react-native';
import { CS, Colors } from '../../theme';
import { rf } from '../../utils/responsive';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  color?: string;
  onBack?: () => void;
  onMenu?: () => void;
  rightAction?: React.ReactNode;
}

export const ScreenHeader = ({
  title,
  subtitle,
  color = Colors.roles.FO.primary,
  onBack,
  onMenu,
  rightAction,
}: ScreenHeaderProps) => {
  const insets = useSafeAreaInsets();
  // insets.top already covers the status bar / notch / Dynamic Island on both platforms.
  // The status bar is translucent app-wide, so on Android this inset includes the status
  // bar height — adding StatusBar.currentHeight on top double-counted it and pushed the
  // header down by an extra ~24-48px.
  const pt = insets.top;

  return (
    <View style={[CS.headerContainer, { paddingTop: pt + 12, backgroundColor: color }]}>
      <View style={CS.headerRow}>
        {onMenu && (
          <TouchableOpacity style={CS.headerBackBtn} onPress={onMenu}>
            <Menu size={22} color={Colors.textInverse} />
          </TouchableOpacity>
        )}
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
