import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { useNetSplitStore } from '../store/useNetSplitStore';
import { darkTheme, lightTheme, typography, spacing, radii } from '../theme';
import { StatusBadge } from '../components/StatusBadge';
import { ShieldIcon, RefreshIcon } from '../components/Icons';

export const RoutingRulesScreen: React.FC = () => {
  const themeMode = useNetSplitStore((state) => state.themeMode);
  const rules = useNetSplitStore((state) => state.rules);
  const toggleRule = useNetSplitStore((state) => state.toggleRule);
  const removeAssignment = useNetSplitStore((state) => state.removeAssignment);
  const verifyRules = useNetSplitStore((state) => state.verifyRules);
  const isLoading = useNetSplitStore((state) => state.isLoading);
  const setCurrentScreen = useNetSplitStore((state) => state.setCurrentScreen);

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <View style={[styles.headerBanner, { backgroundColor: theme.surfaceCard, borderBottomColor: theme.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: theme.textPrimary }]}>
            Enforced Windows Filtering Platform (WFP) Rules
          </Text>
          <Text style={[styles.bannerSubtitle, { color: theme.textSecondary }]}>
            These rules are actively bound to the Windows network stack. NetSplit will only mark a rule 'Active' when kernel/adapter verification succeeds.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.verifyBtn, { backgroundColor: theme.accent }]}
          onPress={() => verifyRules()}
          disabled={isLoading}
        >
          <Text style={[styles.verifyBtnText, { color: '#ffffff' }]}>
            {isLoading ? 'Verifying...' : '⚡ Verify All Rules'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Rules Table Header */}
      <View style={[styles.tableHeader, { backgroundColor: theme.tableHeaderBg, borderBottomColor: theme.border }]}>
        <View style={styles.colApp}>
          <Text style={[styles.colHeaderText, { color: theme.textTertiary }]}>APPLICATION & BINARY PATH</Text>
        </View>
        <View style={styles.colAdapter}>
          <Text style={[styles.colHeaderText, { color: theme.textTertiary }]}>TARGET ADAPTER</Text>
        </View>
        <View style={styles.colEnabled}>
          <Text style={[styles.colHeaderText, { color: theme.textTertiary }]}>ENABLED</Text>
        </View>
        <View style={styles.colStatus}>
          <Text style={[styles.colHeaderText, { color: theme.textTertiary }]}>ENFORCEMENT STATUS</Text>
        </View>
        <View style={styles.colActions}>
          <Text style={[styles.colHeaderText, { color: theme.textTertiary }]}>ACTIONS</Text>
        </View>
      </View>

      {/* Rules List */}
      <FlatList
        data={rules}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={[
              styles.tableRow,
              {
                backgroundColor: theme.surfaceCard,
                borderBottomColor: theme.borderSubtle,
              },
            ]}
          >
            {/* App info */}
            <View style={styles.colApp}>
              <Text style={[styles.appName, { color: theme.textPrimary }]}>
                {item.applicationName}
              </Text>
              <Text style={[styles.appPath, { color: theme.textTertiary }]} numberOfLines={1}>
                {item.executablePath}
              </Text>
            </View>

            {/* Target Adapter */}
            <View style={styles.colAdapter}>
              <Text style={[styles.adapterName, { color: theme.textPrimary }]}>
                {item.adapterName}
              </Text>
              <Text style={[styles.fallbackText, { color: theme.textTertiary }]}>
                Fallback: {item.fallbackMode === 'BLOCK' ? 'Drop / Kill-Switch' : 'Windows Default'}
              </Text>
            </View>

            {/* Toggle */}
            <View style={styles.colEnabled}>
              <Switch
                value={item.enabled}
                onValueChange={(val) => toggleRule(item.id, val)}
                trackColor={{ false: theme.surfaceHover, true: theme.accent }}
              />
            </View>

            {/* Status */}
            <View style={styles.colStatus}>
              <StatusBadge status={item.status} />
              {item.lastError && (
                <Text style={[styles.errorDetail, { color: theme.error }]} numberOfLines={1}>
                  {item.lastError}
                </Text>
              )}
            </View>

            {/* Actions */}
            <View style={styles.colActions}>
              <TouchableOpacity
                style={[styles.removeBtn, { backgroundColor: theme.surfaceHover }]}
                onPress={() => removeAssignment(item.applicationId)}
              >
                <Text style={{ color: theme.error, fontSize: 11 }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <ShieldIcon size={36} color={theme.textTertiary} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary, marginTop: 12 }]}>
              No active routing rules
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
              Assign applications to network adapters in the Applications tab to create rules.
            </Text>
            <TouchableOpacity
              style={[styles.addFirstBtn, { backgroundColor: theme.accent, marginTop: 16 }]}
              onPress={() => setCurrentScreen('apps')}
            >
              <Text style={{ color: '#ffffff', fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold }}>
                Go to Applications
              </Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBanner: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerTitle: {
    fontFamily: typography.fontFamilyDisplay,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  bannerSubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    marginTop: 2,
    maxWidth: 600,
  },
  verifyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  verifyBtnText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  colHeaderText: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  colApp: {
    flex: 3,
    paddingRight: spacing.md,
  },
  appName: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  appPath: {
    fontFamily: typography.fontFamilyMono,
    fontSize: 10,
    marginTop: 2,
  },
  colAdapter: {
    flex: 2,
  },
  adapterName: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  fallbackText: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    marginTop: 2,
  },
  colEnabled: {
    width: 80,
    alignItems: 'flex-start',
  },
  colStatus: {
    flex: 1.5,
  },
  errorDetail: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    marginTop: 3,
  },
  colActions: {
    width: 70,
    alignItems: 'flex-end',
  },
  removeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: typography.fontFamilyDisplay,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  emptySubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    marginTop: 4,
    maxWidth: 360,
    textAlign: 'center',
  },
  addFirstBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
});
