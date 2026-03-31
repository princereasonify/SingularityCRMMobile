import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Menu } from 'lucide-react-native';
import { useNavigation, DrawerActions } from '@react-navigation/native';

interface Props {
  color?: string;
  size?: number;
}

export const DrawerMenuButton = ({ color = '#FFF', size = 20 }: Props) => {
  const navigation = useNavigation();
  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
      hitSlop={12}
    >
      <Menu size={size} color={color} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
