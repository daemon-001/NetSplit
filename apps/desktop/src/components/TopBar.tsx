import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { useNetSplitStore } from '../store/useNetSplitStore';
import { darkTheme, lightTheme, typography, spacing, radii } from '../theme';
import { SearchIcon, RefreshIcon, BoltIcon, PauseIcon, SunIcon, MoonIcon, CloseIcon } from './Icons';

export const TopBar: React.FC = () => {
  const currentScreen = useNetSplitStore((state) => state.currentScreen);
  const themeMode = useNetSplitStore((state) => state.themeMode);
  const toggleTheme = useNetSplitStore((state) => state.toggleTheme);
  const searchQuery = useNetSplitStore((state) => state.searchQuery);
  const setSearchQuery = useNetSplitStore((state) => state.setSearchQuery);
  const refreshAll = useNetSplitStore((state) => state.refreshAll);
  const isLoading = useNetSplitStore((state) => state.isLoading);
  const adapters = useNetSplitStore((state) => state.adapters);
  const rules = useNetSplitStore((state) => state.rules);
  const isEngineEnabled = useNetSplitStore((state) => state.isEngineEnabled);
  const toggleMasterEngine = useNetSplitStore((state) => state.toggleMasterEngine);

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

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
        {/* Top Master Switch - Enables/Disables Working of the App */}
        <View
          style={[
            styles.masterSwitchContainer,
            {
              backgroundColor: theme.surfaceSubtle,
              borderColor: isEngineEnabled
                ? (themeMode === 'dark' ? 'rgba(16, 185, 129, 0.4)' : '#6ee7b7')
                : theme.border,
            },
          ]}
        >
          <Switch
            value={isEngineEnabled}
            onValueChange={(val) => toggleMasterEngine(val)}
            trackColor={{
              false: theme.surfaceHover,
              true: themeMode === 'dark' ? 'rgba(16, 185, 129, 0.45)' : '#6ee7b7',
            }}
            thumbColor={
              isEngineEnabled
                ? theme.success
                : (themeMode === 'dark' ? '#94a3b8' : '#cbd5e1')
            }
            style={styles.switchControl}
          />
          <TouchableOpacity
            onPress={() => toggleMasterEngine()}
            activeOpacity={0.7}
            style={styles.masterSwitchLabelBtn}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {isEngineEnabled ? (
                <BoltIcon size={12} color={themeMode === 'dark' ? '#34d399' : '#059669'} style={{ marginRight: 4 }} />
              ) : (
                <PauseIcon size={10} color={theme.textTertiary} style={{ marginRight: 4 }} />
              )}
              <Text
                style={[
                  styles.masterSwitchLabel,
                  {
                    color: isEngineEnabled
                      ? (themeMode === 'dark' ? '#34d399' : '#059669')
                      : theme.textTertiary,
                  },
                ]}
              >
                {isEngineEnabled ? 'Active' : 'Paused'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick telemetry indicators */}
        <View style={[styles.metricPill, { backgroundColor: theme.surfaceSubtle, borderColor: theme.borderSubtle }]}>
          <Text style={[styles.metricLabel, { color: theme.textTertiary }]}>Adapters:</Text>
          <Text style={[styles.metricValue, { color: theme.success }]}>{upAdaptersCount} UP</Text>
        </View>

        <View style={[styles.metricPill, { backgroundColor: theme.surfaceSubtle, borderColor: theme.borderSubtle }]}>
          <Text style={[styles.metricLabel, { color: theme.textTertiary }]}>Rules:</Text>
          <Text
            style={[
              styles.metricValue,
              { color: isEngineEnabled ? theme.accent : theme.textTertiary },
            ]}
          >
            {isEngineEnabled ? `${activeRulesCount} Active` : `${rules.length} Paused`}
          </Text>
        </View>

        {/* Refresh Action */}
        <TouchableOpacity
          style={[
            styles.iconButton,
            { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
          ]}
          onPress={() => refreshAll(true)}
          disabled={isLoading}
        >
          <RefreshIcon size={14} color={isLoading ? theme.textTertiary : theme.textPrimary} />
        </TouchableOpacity>

        {/* Theme Toggle */}
        <TouchableOpacity
          style={[
            styles.themeToggle,
            { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
          ]}
          onPress={toggleTheme}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {themeMode === 'dark' ? (
              <SunIcon size={12} color="#fbbf24" style={{ marginRight: 5 }} />
            ) : (
              <MoonIcon size={12} color="#60a5fa" style={{ marginRight: 5 }} />
            )}
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
              {themeMode === 'dark' ? 'Light' : 'Dark'}
            </Text>
          </View>
        </TouchableOpacity>
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
  masterSwitchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 8,
    height: 32,
    borderRadius: radii.md,
    borderWidth: 1,
    marginRight: 8,
  },
  switchControl: {
    transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }],
    marginRight: 2,
  },
  masterSwitchLabelBtn: {
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  masterSwitchLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.3,
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
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  themeToggle: {
    paddingHorizontal: 10,
    height: 32,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
