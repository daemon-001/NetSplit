import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { useNetSplitStore } from '../store/useNetSplitStore';
import { darkTheme, lightTheme, typography, spacing, radii } from '../theme';
import { StatusBadge } from '../components/StatusBadge';
import { ShieldIcon, RefreshIcon } from '../components/Icons';
import { QuickAdapterSelector } from '../components/QuickAdapterSelector';
import { BulkActionBar } from '../components/BulkActionBar';

export const RoutingRulesScreen: React.FC = () => {
  const themeMode = useNetSplitStore((state) => state.themeMode);
  const rules = useNetSplitStore((state) => state.rules);
  const toggleRule = useNetSplitStore((state) => state.toggleRule);
  const removeAssignment = useNetSplitStore((state) => state.removeAssignment);
  const verifyRules = useNetSplitStore((state) => state.verifyRules);
  const isVerifyingRules = useNetSplitStore((state) => state.isVerifyingRules);
  const setCurrentScreen = useNetSplitStore((state) => state.setCurrentScreen);
  const searchQuery = useNetSplitStore((state) => state.searchQuery);
  const selectedAppIds = useNetSplitStore((state) => state.selectedAppIds);
  const toggleAppSelection = useNetSplitStore((state) => state.toggleAppSelection);
  const selectAllApps = useNetSplitStore((state) => state.selectAllApps);
  const clearSelection = useNetSplitStore((state) => state.clearSelection);

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  // Filter rules by topbar search query
  const filteredRules = rules.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      r.applicationName.toLowerCase().includes(q) ||
      r.executablePath.toLowerCase().includes(q) ||
      r.adapterName.toLowerCase().includes(q)
    );
  });

  const allSelected =
    filteredRules.length > 0 &&
    filteredRules.every((r) => selectedAppIds.includes(r.applicationId));

  const handleToggleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAllApps(filteredRules.map((r) => r.applicationId));
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <View style={[styles.headerBanner, { backgroundColor: theme.surfaceCard, borderBottomColor: theme.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: theme.textPrimary }]}>
            Enforced Windows Filtering Platform (WFP) Rules ({rules.length})
          </Text>
          <Text style={[styles.bannerSubtitle, { color: theme.textSecondary }]}>
            These rules are actively bound to the Windows network stack. Select rules to bulk change target adapters or toggle enforcement.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.verifyBtn, { backgroundColor: theme.accent }]}
          onPress={() => verifyRules()}
          disabled={isVerifyingRules}
        >
          <Text style={[styles.verifyBtnText, { color: '#ffffff' }]}>
            {isVerifyingRules ? 'Verifying...' : '⚡ Verify All Rules'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Rules Table Header */}
      <View style={[styles.tableHeader, { backgroundColor: theme.tableHeaderBg, borderBottomColor: theme.border }]}>
        {/* Select All Checkbox */}
        <TouchableOpacity style={styles.colCheck} onPress={handleToggleSelectAll} activeOpacity={0.7}>
          <View
            style={[
              styles.checkbox,
              {
                borderColor: theme.borderStrong,
                backgroundColor: allSelected ? theme.accent : 'transparent',
              },
            ]}
          >
            {allSelected && <Text style={{ color: '#ffffff', fontSize: 10 }}>✓</Text>}
          </View>
        </TouchableOpacity>

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
        data={filteredRules}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelected = selectedAppIds.includes(item.applicationId);

          return (
            <View
              style={[
                styles.tableRow,
                {
                  backgroundColor: isSelected ? theme.tableRowSelected : theme.surfaceCard,
                  borderBottomColor: theme.borderSubtle,
                },
              ]}
            >
              {/* Checkbox for Bulk Selection */}
              <TouchableOpacity
                style={styles.colCheck}
                onPress={() => toggleAppSelection(item.applicationId)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: theme.borderStrong,
                      backgroundColor: isSelected ? theme.accent : 'transparent',
                    },
                  ]}
                >
                  {isSelected && <Text style={{ color: '#ffffff', fontSize: 10 }}>✓</Text>}
                </View>
              </TouchableOpacity>

              {/* App info */}
              <View style={styles.colApp}>
                <Text style={[styles.appName, { color: theme.textPrimary }]} numberOfLines={1}>
                  {item.applicationName}
                </Text>
                <Text style={[styles.appPath, { color: theme.textTertiary }]} numberOfLines={1}>
                  {item.executablePath}
                </Text>
              </View>

              {/* Target Adapter Dropdown Selector */}
              <View style={styles.colAdapter}>
                <QuickAdapterSelector
                  applicationId={item.applicationId}
                  assignedAdapterId={item.adapterId}
                  assignedAdapterName={item.adapterName}
                />
                <Text style={[styles.fallbackText, { color: theme.textTertiary }]} numberOfLines={1}>
                  Fallback: {item.fallbackMode === 'BLOCK' ? 'Drop / Kill-Switch' : 'Windows Default'}
                </Text>
              </View>

              {/* Toggle Enable/Disable */}
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
                  <Text style={{ color: theme.error, fontSize: 11, fontWeight: '600' }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <ShieldIcon size={36} color={theme.textTertiary} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary, marginTop: 12 }]}>
              {searchQuery ? 'No matching routing rules found' : 'No active routing rules'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
              {searchQuery
                ? 'Try clearing your search query in the top bar.'
                : 'Assign applications to network adapters in the Applications tab to create rules.'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                style={[styles.addFirstBtn, { backgroundColor: theme.accent, marginTop: 16 }]}
                onPress={() => setCurrentScreen('apps')}
              >
                <Text style={{ color: '#ffffff', fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold }}>
                  Go to Applications
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Floating Bulk Action Bar */}
      <BulkActionBar entityName="rule" showToggleActions={true} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
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
  colCheck: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingVertical: 10,
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
    flex: 2.3,
    paddingRight: spacing.md,
    justifyContent: 'center',
  },
  fallbackText: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    marginTop: 4,
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
