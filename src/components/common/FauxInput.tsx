import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

/**
 * The value display for the app's OWN keyboards (KeyField, NumField, the login keyboard).
 *
 * Why this is not a <TextInput>: any focused TextInput makes iOS present its input assistant
 * bar ("Passwords" AutoFill + dictation mic) at the bottom of the window — on iPad a translucent
 * pill that draws over the app's keyboard, even with the OS keyboard suppressed. No TextInput
 * trait removes it. The keyboards here type through their own keys, so they only need to SHOW
 * the text and a caret; nothing needs real OS text focus.
 *
 * Editing logic is unchanged — the caller keeps owning value/caret. The caret is drawn after
 * the text (edits always land at the caret, which stays at the end of the value).
 */
export const FauxInput = ({
  value, placeholder, secure, focused, textStyle, color, placeholderColor, caretColor, style,
}: {
  value: string;
  placeholder?: string;
  secure?: boolean;
  focused: boolean;
  textStyle?: StyleProp<TextStyle>;
  color: string;
  placeholderColor: string;
  caretColor: string;
  style?: StyleProp<ViewStyle>;
}) => {
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!focused) { blink.setValue(0); return undefined; }
    blink.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(blink, { toValue: 0, duration: 1, easing: Easing.linear, useNativeDriver: true }),
        Animated.delay(450),
        Animated.timing(blink, { toValue: 1, duration: 1, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [focused, blink]);

  const shown = secure ? '•'.repeat(value.length) : value;
  // Callers pass a TextInput-style `flex: 1` (LoginScreen.styles.input). On a <Text> that stretches
  // it across the whole row, so the caret — drawn right after it — lands at the far edge, under the
  // password eye icon, instead of right after the last character. Strip the flex props so the Text
  // is only as wide as its content; flexShrink:1 below still lets a long value shrink to fit.
  const { flex: _f, flexGrow: _g, flexShrink: _s, flexBasis: _b, ...textOnly } = (StyleSheet.flatten(textStyle) || {}) as TextStyle;
  return (
    // `flex: 1` alone collapses to ZERO height inside the keyboard sheets (a column with auto height), which
    // hid the typed value and the caret there. alignSelf:'stretch' gives full width in any parent, flexGrow
    // lets it fill a fixed-height row (login), and minHeight guarantees a line is always visible.
    <View style={[{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', flexGrow: 1, flexShrink: 1, minHeight: 30, overflow: 'hidden' }, style]}>
      {shown ? (
        <Text numberOfLines={1} style={[textOnly, { color, flexShrink: 1 }]}>{shown}</Text>
      ) : null}
      <Animated.View style={{ width: 2, height: 20, borderRadius: 1, backgroundColor: caretColor, opacity: blink, marginLeft: shown ? 1 : 0 }} />
      {!shown && placeholder ? (
        <Text numberOfLines={1} style={[textOnly, { color: placeholderColor, flexShrink: 1, marginLeft: 2 }]}>{placeholder}</Text>
      ) : null}
    </View>
  );
};
