import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useNetSplitStore } from '../store/useNetSplitStore';
import { darkTheme, lightTheme, typography, spacing, radii } from '../theme';
import { SearchIcon, CloseIcon } from './Icons';

export const TopBar: React.FC = () => {
  const currentScreen = useNetSplitStore((state) => state.currentScreen);
  const themeMode = useNetSplitStore((state) => state.themeMode);
  const searchQuery = useNetSplitStore((state) => state.searchQuery);
  const setSearchQuery = useNetSplitStore((state) => state.setSearchQuery);
  const adapters = useNetSplitStore((state) => state.adapters);
  const rules = useNetSplitStore((state) => state.rules);
  const serviceConnected = useNetSplitStore((state) => state.serviceConnected);
  const isEngineEnabled = useNetSplitStore((state) => state.isEngineEnabled);

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  const isEngineActive = serviceConnected && isEngineEnabled;
  const upAdaptersCount = adapters.filter((a) => a.status === 'UP').length;
  const activeRulesCount = rules.filter((r) => r.status === 'ACTIVE').length;

  const titles: Record<string, string> = {
    overview: 'System Overview',
    apps: 'Application Routing Library',
    adapters: 'Network Adapters & Hardware',
    rules: 'Active Routing Engine Rules',
    activity: 'Audit & Telemetry Activity',
    settings: 'Global Preferences & Service Configuration',
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.topbarBg,
          borderBottomColor: theme.border,
        },
      ]}
    >
      {/* Title & Path */}
      <View style={styles.titleSection}>
        <Text style={[styles.screenTitle, { color: theme.textPrimary }]}>
          {titles[currentScreen] || 'NetSplit'}
        </Text>
      </View>

      {/* Global Search */}
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: theme.surfaceSubtle,
            borderColor: theme.border,
          },
        ]}
      >
        <SearchIcon size={14} color={theme.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: theme.textPrimary }]}
          placeholder="Search apps, executables, adapters..."
          placeholderTextColor={theme.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
            <CloseIcon size={10} color={theme.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Actions & Metrics */}
      <View style={styles.actionsSection}>
        {/* Quick telemetry indicators */}
        <View style={[styles.metricPill, { backgroundColor: theme.surfaceSubtle, borderColor: theme.borderSubtle }]}>
          <Text style={[styles.metricLabel, { color: theme.textTertiary }]}>Adapters:</Text>
          <Text style={[styles.metricValue, { color: theme.success }]}>{upAdaptersCount} UP</Text>
        </View>

        <View style={[styles.metricPill, { backgroundColor: theme.surfaceSubtle, borderColor: theme.borderSubtle, marginRight: 0 }]}>
          <Text style={[styles.metricLabel, { color: theme.textTertiary }]}>Rules:</Text>
          <Text
            style={[
              styles.metricValue,
              { color: isEngineActive ? theme.accent : theme.textTertiary },
            ]}
          >
            {!serviceConnected
              ? 'Offline'
              : (isEngineEnabled ? `${activeRulesCount} Active` : `${rules.length} Paused`)}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 52,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  titleSection: {
    minWidth: 200,
  },
  screenTitle: {
    fontFamily: typography.fontFamilyDisplay,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  searchBox: {
    flex: 1,
    maxWidth: 380,
    height: 32,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    marginHorizontal: spacing.lg,
  },
  searchInput: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    paddingVertical: 0,
    paddingHorizontal: spacing.xs,
  },
  actionsSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginRight: 8,
  },
  metricLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    marginRight: 4,
  },
  metricValue: {
    fontFamily: typography.fontFamilyMono,
    fontSize: 11,
    fontWeight: typography.weights.semibold,
  },
});
