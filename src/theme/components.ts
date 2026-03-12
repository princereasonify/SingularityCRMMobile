import { StyleSheet } from 'react-native';
import { Colors } from './colors';
import { Spacing, Radius } from './spacing';
import { Shadows } from './shadows';

// ─── Shared Component StyleSheet ──────────────────────────────────────────────
// Import once in any component: import { CS } from '../../theme'
export const CS = StyleSheet.create({

  // ─── Layout ────────────────────────────────────────────────────────────────
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.base,
  },

  // ─── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    ...Shadows.md,
  },
  cardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },

  // ─── Screen Header ─────────────────────────────────────────────────────────
  headerContainer: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBackBtn: {
    marginRight: Spacing.sm,
    padding: Spacing.xs,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerRightAction: {
    marginLeft: Spacing.sm,
  },

  // ─── Input ─────────────────────────────────────────────────────────────────
  inputContainer: {
    marginBottom: Spacing.base,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.inputLabel,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    overflow: 'hidden',
  },
  inputField: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: Spacing.md,
    color: Colors.inputText,
  },
  inputRightIcon: {
    position: 'absolute',
    right: 12,
    padding: Spacing.xs,
  },
  inputErrorText: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: Spacing.xs,
  },

  // ─── Button ────────────────────────────────────────────────────────────────
  buttonBase: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  // ─── Badge ─────────────────────────────────────────────────────────────────
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeMd: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  // ─── Avatar ────────────────────────────────────────────────────────────────
  avatarBase: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },

  // ─── KPI Card ──────────────────────────────────────────────────────────────
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  kpiTitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
    flex: 1,
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 2,
    color: Colors.textPrimary,
  },
  kpiSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  kpiProgressBar: {
    marginTop: Spacing.sm,
  },

  // ─── Loading / Empty ───────────────────────────────────────────────────────
  loadingContainer: {
    padding: Spacing['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingFullScreen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingMessage: {
    marginTop: Spacing.md,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['3xl'],
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },

  // ─── Section ───────────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  // ─── List Item ─────────────────────────────────────────────────────────────
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
});
