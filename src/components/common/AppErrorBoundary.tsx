import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../../theme/useAppTheme';

/**
 * Catches an error thrown while rendering any screen. Without a boundary, React unmounts the
 * whole tree on a render error, and in a release build that is a fatal JS exception: the app
 * closes and the user lands on the phone's home screen. With it, they get a "Try again" screen
 * and the rest of the session (login, navigation state above the boundary) survives.
 */
export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

const ErrorFallback = ({ onRetry }: { onRetry: () => void }) => {
  const T = useAppTheme();
  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <Text style={[styles.title, { color: T.text }]}>Something went wrong</Text>
      <Text style={[styles.body, { color: T.sub }]}>
        This screen hit an unexpected problem. Your data is safe — tap below to reload it.
      </Text>
      <TouchableOpacity onPress={onRetry} activeOpacity={0.8} style={[styles.btn, { backgroundColor: T.accent }]}>
        <Text style={[styles.btnTxt, { color: T.onAccent }]}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  btn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  btnTxt: { fontSize: 14, fontWeight: '700' },
});
