import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { useNetSplitStore } from '../store/useNetSplitStore';
import { darkTheme, lightTheme, typography, spacing, radii } from '../theme';
import { StatusBadge } from '../components/StatusBadge';
import { ShieldIcon, RefreshIcon } from '../components/Icons';
import { QuickAdapterSelector } from '../components/QuickAdapterSelector';
import { BulkActionBar } from '../components/BulkActionBar';

type RuleSortColumn = 'app' | 'adapter' | 'merge' | 'status';
type SortOrder = 'asc' | 'desc';

export const RoutingRulesScreen: React.FC = () => {
  const themeMode = useNetSplitStore((state) => state.themeMode);
  const rules = useNetSplitStore((state) => state.rules);
  const toggleRuleMerge = useNetSplitStore((state) => state.toggleRuleMerge);
  const removeAssignment = useNetSplitStore((state) => state.removeAssignment);
  const verifyRules = useNetSplitStore((state) => state.verifyRules);
  const isVerifyingRules = useNetSplitStore((state) => state.isVerifyingRules);
  const setCurrentScreen = useNetSplitStore((state) => state.setCurrentScreen);
  const searchQuery = useNetSplitStore((state) => state.searchQuery);
  const selectedAppIds = useNetSplitStore((state) => state.selectedAppIds);
  const toggleAppSelection = useNetSplitStore((state) => state.toggleAppSelection);
  const selectAllApps = useNetSplitStore((state) => state.selectAllApps);
  const clearSelection = useNetSplitStore((state) => state.clearSelection);

  // Filter tabs and sorting state
  const [ruleFilter, setRuleFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<RuleSortColumn>('app');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  // Compute counts for top filter tabs
  const totalCount = rules.length;
  const mergedCount = rules.filter((r) => r.fallbackMode !== 'BLOCK').length;
  const isolatedCount = rules.filter((r) => r.fallbackMode === 'BLOCK').length;
  const errorCount = rules.filter((r) => r.status === 'ERROR').length;
  const followDefaultCount = rules.filter((r) => r.isFollowDefault).length;
  const oppositeCount = rules.filter((r) => r.isOppositeDefault).length;

  // Group adapters that have rules
  const adapterMap = new Map<string, { name: string; count: number }>();
  for (const r of rules) {
    const existing = adapterMap.get(r.adapterId);
    if (existing) {
      existing.count++;
    } else {
      adapterMap.set(r.adapterId, { name: r.adapterName, count: 1 });
    }
  }

  const filterTabs = [
    { key: 'all', label: `All (${totalCount})` },
    { key: 'merged', label: `Merged (${mergedCount})` },
    { key: 'isolated', label: `Isolated (${isolatedCount})` },
    ...(followDefaultCount > 0 ? [{ key: 'follow_default', label: `★ Default (${followDefaultCount})` }] : []),
    ...(oppositeCount > 0 ? [{ key: 'opposite', label: `⇄ Opposite (${oppositeCount})` }] : []),
    ...(errorCount > 0 ? [{ key: 'error', label: `Errors (${errorCount})` }] : []),
    ...Array.from(adapterMap.entries()).map(([id, data]) => ({
      key: `adapter:${id}`,
      label: `${data.name} (${data.count})`,
    })),
  ];

  // 1. Filter rules by tab
  let filteredRules = rules.filter((r) => {
    if (ruleFilter === 'all') return true;
    if (ruleFilter === 'merged') return r.fallbackMode !== 'BLOCK';
    if (ruleFilter === 'isolated') return r.fallbackMode === 'BLOCK';
    if (ruleFilter === 'follow_default') return !!r.isFollowDefault;
    if (ruleFilter === 'opposite') return !!r.isOppositeDefault;
    if (ruleFilter === 'error') return r.status === 'ERROR';
    if (ruleFilter.startsWith('adapter:')) {
      return r.adapterId === ruleFilter.replace('adapter:', '');
    }
    return true;
  });

  // 2. Filter rules by topbar search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filteredRules = filteredRules.filter(
      (r) =>
        r.applicationName.toLowerCase().includes(q) ||
        r.executablePath.toLowerCase().includes(q) ||
        r.adapterName.toLowerCase().includes(q)
    );
  }

  // 3. Sort rules
  const handleSort = (column: RuleSortColumn) => {
    if (sortColumn === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortOrder('asc');
    }
  };

  const sortedRules = [...filteredRules].sort((a, b) => {
    let comparison = 0;
    if (sortColumn === 'app') {
      comparison = a.applicationName.localeCompare(b.applicationName, undefined, { numeric: true, sensitivity: 'base' });
      if (comparison === 0) {
        comparison = a.executablePath.localeCompare(b.executablePath);
      }
    } else if (sortColumn === 'adapter') {
      comparison = a.adapterName.localeCompare(b.adapterName);
      if (comparison === 0) {
        comparison = a.applicationName.localeCompare(b.applicationName);
      }
    } else if (sortColumn === 'merge') {
      const aMerged = a.fallbackMode !== 'BLOCK' ? 1 : 0;
      const bMerged = b.fallbackMode !== 'BLOCK' ? 1 : 0;
      comparison = bMerged - aMerged;
      if (comparison === 0) {
        comparison = a.applicationName.localeCompare(b.applicationName);
      }
    } else if (sortColumn === 'status') {
      const rank: Record<string, number> = {
        ACTIVE: 4,
        UNVERIFIED: 3,
        PENDING: 2,
        ERROR: 1,
        INACTIVE: 0,
      };
      const rankA = rank[a.status] ?? -1;
      const rankB = rank[b.status] ?? -1;
      comparison = rankB - rankA;
      if (comparison === 0) {
        comparison = a.applicationName.localeCompare(b.applicationName);
      }
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const allSelected =
    sortedRules.length > 0 &&
    sortedRules.every((r) => selectedAppIds.includes(r.applicationId));

  const handleToggleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAllApps(sortedRules.map((r) => r.applicationId));
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
            These rules are actively bound to the Windows network stack. NetSplit will only mark a rule 'Active' when kernel/adapter verification succeeds.
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

      {/* Top Filter Tabs Bar */}
      <View style={[styles.controlBar, { backgroundColor: theme.surfaceCard, borderBottomColor: theme.border }]}>
        <View style={styles.filterTabs}>
          {filterTabs.map((tab) => {
            const isActive = ruleFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabBtn,
                  {
                    backgroundColor: isActive ? theme.surfaceActive : 'transparent',
                    borderColor: isActive ? theme.borderStrong : 'transparent',
                  },
                ]}
                onPress={() => setRuleFilter(tab.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    {
                      color: isActive ? theme.textPrimary : theme.textSecondary,
                      fontWeight: isActive ? typography.weights.semibold : typography.weights.regular,
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: theme.accent }]}
          onPress={() => setCurrentScreen('apps')}
          activeOpacity={0.8}
        >
          <Text style={[styles.addBtnText, { color: '#ffffff' }]}>+ Add Rule</Text>
        </TouchableOpacity>
      </View>

      {/* Rules Table Header with Clickable Arrow Sort Filters */}
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

        {/* APPLICATION Column Header */}
        <TouchableOpacity
          style={[styles.colApp, styles.headerSortBtn]}
          onPress={() => handleSort('app')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.colHeaderText,
              { color: sortColumn === 'app' ? theme.accent : theme.textTertiary },
            ]}
          >
            APPLICATION & BINARY PATH
          </Text>
          <Text
            style={[
              styles.sortArrow,
              {
                color: sortColumn === 'app' ? theme.accent : theme.textTertiary,
                opacity: sortColumn === 'app' ? 1 : 0.4,
              },
            ]}
          >
            {sortColumn === 'app' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ' ↕'}
          </Text>
        </TouchableOpacity>

        {/* TARGET ADAPTER Column Header */}
        <TouchableOpacity
          style={[styles.colAdapter, styles.headerSortBtn]}
          onPress={() => handleSort('adapter')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.colHeaderText,
              { color: sortColumn === 'adapter' ? theme.accent : theme.textTertiary },
            ]}
          >
            TARGET ADAPTER
          </Text>
          <Text
            style={[
              styles.sortArrow,
              {
                color: sortColumn === 'adapter' ? theme.accent : theme.textTertiary,
                opacity: sortColumn === 'adapter' ? 1 : 0.4,
              },
            ]}
          >
            {sortColumn === 'adapter' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ' ↕'}
          </Text>
        </TouchableOpacity>

        {/* MERGE Column Header */}
        <TouchableOpacity
          style={[styles.colEnabled, styles.headerSortBtn]}
          onPress={() => handleSort('merge')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.colHeaderText,
              { color: sortColumn === 'merge' ? theme.accent : theme.textTertiary },
            ]}
          >
            MERGE
          </Text>
          <Text
            style={[
              styles.sortArrow,
              {
                color: sortColumn === 'merge' ? theme.accent : theme.textTertiary,
                opacity: sortColumn === 'merge' ? 1 : 0.4,
              },
            ]}
          >
            {sortColumn === 'merge' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ' ↕'}
          </Text>
        </TouchableOpacity>

        {/* ENFORCEMENT STATUS Column Header */}
        <TouchableOpacity
          style={[styles.colStatus, styles.headerSortBtn]}
          onPress={() => handleSort('status')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.colHeaderText,
              { color: sortColumn === 'status' ? theme.accent : theme.textTertiary },
            ]}
          >
            ENFORCEMENT STATUS
          </Text>
          <Text
            style={[
              styles.sortArrow,
              {
                color: sortColumn === 'status' ? theme.accent : theme.textTertiary,
                opacity: sortColumn === 'status' ? 1 : 0.4,
              },
            ]}
          >
            {sortColumn === 'status' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ' ↕'}
          </Text>
        </TouchableOpacity>

        {/* ACTIONS Column Header */}
        <View style={styles.colActions}>
          <Text style={[styles.colHeaderText, { color: theme.textTertiary }]}>ACTIONS</Text>
        </View>
      </View>

      {/* Rules List */}
      <FlatList
        data={sortedRules}
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
                  isOppositeDefault={item.isOppositeDefault}
                  isFollowDefault={item.isFollowDefault}
                />
                <Text style={[styles.fallbackText, { color: theme.textTertiary }]} numberOfLines={1}>
                  Target: {item.adapterName}
                </Text>
              </View>

              {/* Toggle Merge Switch */}
              <View style={styles.colEnabled}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Switch
                    value={item.fallbackMode !== 'BLOCK'}
                    onValueChange={(val) => toggleRuleMerge(item.id, val)}
                    trackColor={{
                      false: theme.surfaceHover,
                      true: themeMode === 'dark' ? 'rgba(16, 185, 129, 0.4)' : '#6ee7b7',
                    }}
                    thumbColor={item.fallbackMode !== 'BLOCK' ? theme.success : (themeMode === 'dark' ? '#94a3b8' : '#cbd5e1')}
                  />
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      marginLeft: 6,
                      color: item.fallbackMode !== 'BLOCK' ? theme.success : theme.textTertiary,
                    }}
                  >
                    {item.fallbackMode !== 'BLOCK' ? 'MERGE ON' : 'OFF'}
                  </Text>
                </View>
                <Text style={[styles.fallbackText, { color: theme.textTertiary, marginTop: 2 }]} numberOfLines={1}>
                  {item.fallbackMode !== 'BLOCK' ? 'Auto-failover enabled' : 'Kill-switch (isolated)'}
                </Text>
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
              {searchQuery || ruleFilter !== 'all' ? 'No matching routing rules found' : 'No active routing rules'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
              {searchQuery || ruleFilter !== 'all'
                ? 'Try resetting your filter tabs or search query.'
                : 'Assign applications to network adapters in the Applications tab to create rules.'}
            </Text>
            {!searchQuery && ruleFilter === 'all' && (
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
  controlBar: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginRight: 6,
  },
  tabBtnText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
  },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  addBtnText: {
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
  headerSortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    cursor: 'pointer' as unknown as undefined,
    userSelect: 'none' as unknown as undefined,
  },
  sortArrow: {
    fontFamily: typography.fontFamilyMono,
    fontSize: 10,
    marginLeft: 4,
    fontWeight: typography.weights.bold,
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
    width: 150,
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
