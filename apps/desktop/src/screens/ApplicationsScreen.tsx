import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { useNetSplitStore, AppFilterType } from '../store/useNetSplitStore';
import { darkTheme, lightTheme, typography, spacing, radii } from '../theme';
import { StatusBadge } from '../components/StatusBadge';
import { QuickAdapterSelector } from '../components/QuickAdapterSelector';
import { NativePickerModal } from '../components/NativePickerModal';
import { BulkActionBar } from '../components/BulkActionBar';
import { SearchIcon } from '../components/Icons';

export const ApplicationsScreen: React.FC = () => {
  const [showAddModal, setShowAddModal] = useState(false);

  const themeMode = useNetSplitStore((state) => state.themeMode);
  const apps = useNetSplitStore((state) => state.apps);
  const searchQuery = useNetSplitStore((state) => state.searchQuery);
  const setSearchQuery = useNetSplitStore((state) => state.setSearchQuery);
  const appFilter = useNetSplitStore((state) => state.appFilter);
  const setAppFilter = useNetSplitStore((state) => state.setAppFilter);
  const selectedAppIds = useNetSplitStore((state) => state.selectedAppIds);
  const toggleAppSelection = useNetSplitStore((state) => state.toggleAppSelection);
  const selectAllApps = useNetSplitStore((state) => state.selectAllApps);
  const clearSelection = useNetSplitStore((state) => state.clearSelection);

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  // Filter apps
  const filteredApps = apps.filter((app) => {
    // Search query
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const matchName = app.name.toLowerCase().includes(q);
      const matchPath = app.executablePath.toLowerCase().includes(q);
      if (!matchName && !matchPath) return false;
    }

    // Filter status
    if (appFilter === 'running') return app.isRunning;
    if (appFilter === 'assigned') return !!app.assignedAdapterId;
    if (appFilter === 'unassigned') return !app.assignedAdapterId;
    return true;
  });

  const allFilteredSelected =
    filteredApps.length > 0 && filteredApps.every((a) => selectedAppIds.includes(a.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      clearSelection();
    } else {
      selectAllApps(filteredApps.map((a) => a.id));
    }
  };

  const filterTabs: Array<{ key: AppFilterType; label: string }> = [
    { key: 'all', label: `All (${apps.length})` },
    { key: 'running', label: `Running (${apps.filter((a) => a.isRunning).length})` },
    { key: 'assigned', label: `Assigned (${apps.filter((a) => a.assignedAdapterId).length})` },
    { key: 'unassigned', label: `Unassigned (${apps.filter((a) => !a.assignedAdapterId).length})` },
  ];

  return (
    <View style={styles.container}>
      {/* Control Bar: Filter Tabs & Add App Button */}
      <View style={[styles.controlBar, { backgroundColor: theme.surfaceCard, borderBottomColor: theme.border }]}>
        <View style={styles.filterTabs}>
          {filterTabs.map((tab) => {
            const isActive = appFilter === tab.key;
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
                onPress={() => setAppFilter(tab.key)}
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
          onPress={() => setShowAddModal(true)}
        >
          <Text style={[styles.addBtnText, { color: '#ffffff' }]}>+ Add Executable</Text>
        </TouchableOpacity>
      </View>

      {/* Table Header */}
      <View style={[styles.tableHeader, { backgroundColor: theme.tableHeaderBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.colCheck} onPress={handleToggleSelectAll}>
          <View
            style={[
              styles.checkbox,
              {
                borderColor: theme.borderStrong,
                backgroundColor: allFilteredSelected ? theme.accent : 'transparent',
              },
            ]}
          >
            {allFilteredSelected && <Text style={{ color: '#ffffff', fontSize: 10 }}>✓</Text>}
          </View>
        </TouchableOpacity>

        <View style={styles.colApp}>
          <Text style={[styles.colHeaderText, { color: theme.textTertiary }]}>APPLICATION</Text>
        </View>

        <View style={styles.colProcess}>
          <Text style={[styles.colHeaderText, { color: theme.textTertiary }]}>PROCESS STATUS</Text>
        </View>

        <View style={styles.colAdapter}>
          <Text style={[styles.colHeaderText, { color: theme.textTertiary }]}>ASSIGNED ADAPTER</Text>
        </View>

        <View style={styles.colRuleStatus}>
          <Text style={[styles.colHeaderText, { color: theme.textTertiary }]}>RULE STATUS</Text>
        </View>
      </View>

      {/* Applications Virtualized List */}
      <FlatList
        data={filteredApps}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelected = selectedAppIds.includes(item.id);

          return (
            <View
              style={[
                styles.tableRow,
                {
                  borderBottomColor: theme.borderSubtle,
                  backgroundColor: isSelected
                    ? theme.tableRowSelected
                    : theme.surfaceCard,
                },
              ]}
            >
              {/* Checkbox */}
              <TouchableOpacity
                style={styles.colCheck}
                onPress={() => toggleAppSelection(item.id)}
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

              {/* App Identity */}
              <View style={styles.colApp}>
                <Text style={[styles.appName, { color: theme.textPrimary }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.appPath, { color: theme.textTertiary }]} numberOfLines={1}>
                  {item.executablePath}
                </Text>
              </View>

              {/* Process Status */}
              <View style={styles.colProcess}>
                <StatusBadge
                  status={item.isRunning ? 'RUNNING' : 'STOPPED'}
                  label={
                    item.isRunning
                      ? item.processIds && item.processIds.length > 0
                        ? `Running (${item.processIds.length})`
                        : 'Running'
                      : 'Stopped'
                  }
                />
              </View>

              {/* Quick Adapter Selector */}
              <View style={styles.colAdapter}>
                <QuickAdapterSelector
                  applicationId={item.id}
                  assignedAdapterId={item.assignedAdapterId}
                  assignedAdapterName={item.assignedAdapterName}
                />
              </View>

              {/* Rule Status Badge */}
              <View style={styles.colRuleStatus}>
                <StatusBadge status={item.ruleStatus || 'NONE'} />
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No applications found</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
              {searchQuery ? 'Try clearing your search query.' : 'Click "+ Add Executable" to register a program manually.'}
            </Text>
          </View>
        }
      />

      {/* Bulk Action Bar (appears on multi-select) */}
      <BulkActionBar />

      {/* Manual Executable Picker Modal */}
      <NativePickerModal visible={showAddModal} onClose={() => setShowAddModal(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  controlBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterTabs: {
    flexDirection: 'row',
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
    paddingHorizontal: spacing.lg,
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
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  colCheck: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
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
  colProcess: {
    flex: 1.2,
  },
  colAdapter: {
    flex: 2,
  },
  colRuleStatus: {
    flex: 1,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: typography.fontFamilyDisplay,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  emptySubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    marginTop: 4,
  },
});
