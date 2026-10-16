import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNetSplitStore, ScreenType } from '../store/useNetSplitStore';
import { darkTheme, lightTheme, typography, spacing, radii } from '../theme';
import {
  OverviewIcon,
  AppsIcon,
  NetworkIcon,
  RulesIcon,
  ActivityIcon,
  SettingsIcon,
  ShieldIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from './Icons';

interface NavItem {
  key: ScreenType;
  label: string;
  icon: React.FC<{ size?: number; color?: string }>;
  badgeCount?: number;
}

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  const currentScreen = useNetSplitStore((state) => state.currentScreen);
  const setCurrentScreen = useNetSplitStore((state) => state.setCurrentScreen);
  const themeMode = useNetSplitStore((state) => state.themeMode);
  const serviceConnected = useNetSplitStore((state) => state.serviceConnected);
  const apps = useNetSplitStore((state) => state.apps);
  const rules = useNetSplitStore((state) => state.rules);

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  const assignedCount = apps.filter((a) => a.assignedAdapterId).length;
  const activeRulesCount = rules.filter((r) => r.status === 'ACTIVE').length;

  const navItems: NavItem[] = [
    { key: 'overview', label: 'Overview', icon: OverviewIcon },
    { key: 'apps', label: 'Applications', icon: AppsIcon, badgeCount: apps.length > 0 ? apps.length : undefined },
    { key: 'adapters', label: 'Network Adapters', icon: NetworkIcon },
    { key: 'rules', label: 'Routing Rules', icon: RulesIcon, badgeCount: activeRulesCount > 0 ? activeRulesCount : undefined },
    { key: 'activity', label: 'Activity', icon: ActivityIcon },
    { key: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          width: collapsed ? 56 : 220,
          backgroundColor: theme.sidebarBg,
          borderRightColor: theme.border,
        },
      ]}
    >
      {/* Brand Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <ShieldIcon size={20} color={theme.accent} />
          {!collapsed && (
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>NetSplit</Text>
              <Text style={[styles.brandSubtitle, { color: theme.textTertiary }]}>Windows Network Utility</Text>
            </View>
          )}
        </View>
      </View>

      {/* Navigation List */}
      <View style={styles.navList}>
        {navItems.map((item) => {
          const isActive = currentScreen === item.key;
          const Icon = item.icon;
          const iconColor = isActive ? theme.accent : theme.textSecondary;

          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.navItem,
                {
                  backgroundColor: isActive ? theme.sidebarActiveBg : 'transparent',
                },
              ]}
              onPress={() => setCurrentScreen(item.key)}
              activeOpacity={0.7}
            >
              {/* Active Indicator Bar */}
              {isActive && (
                <View style={[styles.activeIndicator, { backgroundColor: theme.accent }]} />
              )}

              <View style={styles.navIconContainer}>
                <Icon size={18} color={iconColor} />
              </View>

              {!collapsed && (
                <View style={styles.navLabelContainer}>
                  <Text
                    style={[
                      styles.navLabel,
                      {
                        color: isActive ? theme.textPrimary : theme.textSecondary,
                        fontWeight: isActive ? typography.weights.semibold : typography.weights.regular,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.badgeCount !== undefined && (
                    <View style={[styles.countBadge, { backgroundColor: theme.badgeBg }]}>
                      <Text style={[styles.countText, { color: theme.textTertiary }]}>
                        {item.badgeCount}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer Service Status */}
      <View style={[styles.footer, { borderTopColor: theme.borderSubtle }]}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: serviceConnected ? theme.success : theme.error },
            ]}
          />
          {!collapsed && (
            <View style={{ marginLeft: 8 }}>
              <Text style={[styles.statusText, { color: theme.textPrimary }]}>
                {serviceConnected ? 'Service Online' : 'Service Offline'}
              </Text>
              <Text style={[styles.versionText, { color: theme.textTertiary }]}>
                v1.0.0 (WFP Engine)
              </Text>
            </View>
          )}
        </View>

        {/* Collapse Toggle */}
        <TouchableOpacity
          style={[styles.collapseBtn, { backgroundColor: theme.surfaceHover }]}
          onPress={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRightIcon size={9} color={theme.textTertiary} />
          ) : (
            <ChevronLeftIcon size={9} color={theme.textTertiary} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: '100%',
    borderRightWidth: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontFamily: typography.fontFamilyDisplay,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.3,
  },
  brandSubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    marginTop: 1,
  },
  navList: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: radii.md,
    marginBottom: 4,
    position: 'relative',
    paddingHorizontal: 8,
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 9,
    bottom: 9,
    width: 3,
    borderRadius: 2,
  },
  navIconContainer: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabelContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 10,
  },
  navLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.base,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countText: {
    fontFamily: typography.fontFamilyMono,
    fontSize: 10,
  },
  footer: {
    borderTopWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  versionText: {
    fontFamily: typography.fontFamily,
    fontSize: 9,
  },
  collapseBtn: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
