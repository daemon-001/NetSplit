import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetSplitStore } from '../store/useNetSplitStore';
import { darkTheme, lightTheme, typography } from '../theme';

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'sm' }) => {
  const themeMode = useNetSplitStore((state) => state.themeMode);
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  const normalized = status.toUpperCase();

  let dotColor = theme.textTertiary;
  let bg = theme.badgeBg;
  let textColor = theme.textSecondary;
  let text = label || normalized;

  switch (normalized) {
    case 'ACTIVE':
    case 'UP':
    case 'HEALTHY':
    case 'RUNNING':
      dotColor = '#107c41';
      bg = theme.successSubtle;
      textColor = themeMode === 'dark' ? '#54b07a' : '#107c41';
      break;
    case 'ERROR':
    case 'DOWN':
    case 'STOPPED':
      dotColor = '#d13438';
      bg = theme.errorSubtle;
      textColor = themeMode === 'dark' ? '#f1707b' : '#d13438';
      break;
    case 'UNVERIFIED':
    case 'TESTING':
    case 'DEGRADED':
    case 'WARNING':
      dotColor = '#ca8a04';
      bg = theme.warningSubtle;
      textColor = themeMode === 'dark' ? '#facc15' : '#854d0e';
      break;
    case 'INACTIVE':
    case 'NONE':
      dotColor = theme.textTertiary;
      bg = theme.badgeBg;
      textColor = theme.textTertiary;
      break;
  }

  const isSm = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: bg, paddingHorizontal: isSm ? 6 : 8, paddingVertical: isSm ? 2 : 4 }]}>
      <View style={[styles.dot, { backgroundColor: dotColor, width: isSm ? 5 : 6, height: isSm ? 5 : 6 }]} />
      <Text style={[styles.label, { color: textColor, fontSize: isSm ? typography.sizes.xs : typography.sizes.sm }]}>
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  dot: {
    borderRadius: 3,
    marginRight: 5,
  },
  label: {
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.medium,
  },
});
