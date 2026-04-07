import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useNotifications } from '../../context/NotificationContext';

interface Props {
  onPress: () => void;
  style?: any;
  iconColor?: string;
  iconSize?: number;
}

export const NotificationBell = ({ onPress, style, iconColor = '#FFF', iconSize = 20 }: Props) => {
  const { unreadCount } = useNotifications();

  return (
    <TouchableOpacity style={[styles.btn, style]} onPress={onPress}>
      <Bell size={iconSize} color={iconColor} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : String(unreadCount)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
});
