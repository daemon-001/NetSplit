import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { useNetSplitStore, AppFilterType } from '../store/useNetSplitStore';
import { ApplicationInfo } from '@netsplit/shared-types';
import { darkTheme, lightTheme, typography, spacing, radii } from '../theme';
import { StatusBadge } from '../components/StatusBadge';
import { QuickAdapterSelector } from '../components/QuickAdapterSelector';
import { NativePickerModal } from '../components/NativePickerModal';
import { BulkActionBar } from '../components/BulkActionBar';

type SortColumn = 'app' | 'process' | 'adapter' | 'rule';
type SortOrder = 'asc' | 'desc';

export const ApplicationsScreen: React.FC = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>('app');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const themeMode = useNetSplitStore((state) => state.themeMode);
  const apps = useNetSplitStore((state) => state.apps);
  const searchQuery = useNetSplitStore((state) => state.searchQuery);
  const appFilter = useNetSplitStore((state) => state.appFilter);
  const setAppFilter = useNetSplitStore((state) => state.setAppFilter);
  const selectedAppIds = useNetSplitStore((state) => state.selectedAppIds);
  const toggleAppSelection = useNetSplitStore((state) => state.toggleAppSelection);
  const selectAllApps = useNetSplitStore((state) => state.selectAllApps);
  const clearSelection = useNetSplitStore((state) => state.clearSelection);
  const visibleWindowTitles = useNetSplitStore((state) => state.visibleWindowTitles);

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  // Detect whether an application is an active GUI app open in the foreground (like Task Manager "Apps")
  const isForegroundApp = (app: ApplicationInfo) => {
    if (!app.isRunning) return false;

    // 1. Native Win32 EnumWindows + WinSta0 detection (exact match to Task Manager)
    if (app.hasVisibleWindow === true) return true;

    const path = (app.executablePath || '').toLowerCase();
    const name = (app.name || '').toLowerCase();
    const filename = path.split('\\').pop() || '';

    // 2. Windows system & driver store directories are always background processes
    const isSystemPath =
      path.includes('\\windows\\system32\\') ||
      path.includes('\\windows\\syswow64\\') ||
      path.includes('\\driverstore\\') ||
      path.includes('\\system volume information\\') ||
      path.includes('\\progra~1\\difx\\') ||
      path.includes('\\windows\\servicing\\') ||
      path.includes('\\windows\\winsxs\\');

    if (app.isSystemProcess || isSystemPath) return false;

    // 3. Known background services, daemons, installers & helpers
    const bgNames = [
      'services.exe', 'svchost.exe', 'lsass.exe', 'csrss.exe', 'wininit.exe',
      'winlogon.exe', 'smss.exe', 'dpinst.exe', 'dpinst_x64.exe', 'armourycrate.service.exe',
      'asusappservice.exe', 'asussystemanalysis.exe', 'asusoptimization.exe',
      'taskhostw.exe', 'sihost.exe', 'ctfmon.exe', 'conhost.exe',
      'runtimebroker.exe', 'searchindexer.exe', 'searchhost.exe', 'shellexperiencehost.exe',
      'startmenuexperiencehost.exe', 'fontdrvhost.exe', 'dwm.exe', 'spoolsv.exe',
      'audiodg.exe', 'wlanext.exe', 'dashost.exe', 'smartscreen.exe',
    ];
    if (bgNames.includes(filename.toLowerCase())) return false;

    if (
      name.toLowerCase().endsWith('service') ||
      name.toLowerCase().includes('service daemon') ||
      name.toLowerCase().includes('driver package')
    ) {
      return false;
    }

    // 4. Microsoft Edge WebView2 runtime processes are embedded headless worker processes
    if (name.toLowerCase().includes('webview2') || path.includes('edgewebview')) {
      return false;
    }

    // 5. Match against active window titles from host desktopCapturer
    if (visibleWindowTitles && visibleWindowTitles.length > 0) {
      const match = visibleWindowTitles.some((title) => {
        const t = title.toLowerCase();
        return t.includes(name) || name.includes(t) || (t.length > 3 && path.includes(t));
      });
      if (match) return true;
    }

    // 6. Interactive user applications in Program Files, User Profile, Games, Steam, etc.
    const isUserApp =
      path.includes('\\games\\') ||
      path.includes('\\steam\\') ||
      path.includes('\\discord\\') ||
      path.includes('\\chrome\\') ||
      path.includes('\\firefox\\') ||
      path.includes('\\brave\\') ||
      path.includes('\\spotify\\') ||
      path.includes('\\slack\\') ||
      path.includes('\\telegram\\') ||
      path.includes('\\obs\\') ||
      path.includes('\\vlc\\') ||
      (app as any).isManual === true;

    if (isUserApp) return true;

    return false;
  };

  // Detect whether an application is a background process (like Task Manager "Background processes")
  const isBackgroundProcess = (app: ApplicationInfo) => {
    if (!app.isRunning) return false;
    return !isForegroundApp(app);
  };

  // Filter apps by search query and category tab
  const filteredApps = apps.filter((app) => {
    // Search query
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const matchName = app.name.toLowerCase().includes(q);
      const matchPath = app.executablePath.toLowerCase().includes(q);
      if (!matchName && !matchPath) return false;
    }

    // Filter status tab
    if (appFilter === 'running') return app.isRunning;
    if (appFilter === 'foreground' || appFilter === 'windows') return isForegroundApp(app);
    if (appFilter === 'background') return isBackgroundProcess(app);
    if (appFilter === 'assigned') return !!app.assignedAdapterId;
    if (appFilter === 'unassigned') return !app.assignedAdapterId;
    return true;
  });

  // Sort apps according to selected column and direction
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortOrder('asc');
    }
  };

  const sortedApps = [...filteredApps].sort((a, b) => {
    let comparison = 0;
    if (sortColumn === 'app') {
      comparison = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      if (comparison === 0) {
        comparison = a.executablePath.localeCompare(b.executablePath);
      }
    } else if (sortColumn === 'process') {
      // Asc: running (most instances) first -> stopped. Desc: stopped first -> running
      const aInstances = a.isRunning ? (a.processIds?.length || 1) : 0;
      const bInstances = b.isRunning ? (b.processIds?.length || 1) : 0;
      comparison = bInstances - aInstances;
      if (comparison === 0) {
        comparison = a.name.localeCompare(b.name);
      }
    } else if (sortColumn === 'adapter') {
      // Asc: assigned adapter first (A-Z by adapter name), then unassigned. Desc: unassigned first
      const aAssigned = a.assignedAdapterName ? 1 : 0;
      const bAssigned = b.assignedAdapterName ? 1 : 0;
      if (aAssigned !== bAssigned) {
        comparison = bAssigned - aAssigned;
      } else if (a.assignedAdapterName && b.assignedAdapterName) {
        comparison = a.assignedAdapterName.localeCompare(b.assignedAdapterName);
      } else {
        comparison = a.name.localeCompare(b.name);
      }
    } else if (sortColumn === 'rule') {
      // Asc: ACTIVE > UNVERIFIED > PENDING > ERROR > INACTIVE > NONE
      const rank: Record<string, number> = {
        ACTIVE: 5,
        UNVERIFIED: 4,
        PENDING: 3,
        ERROR: 2,
        INACTIVE: 1,
        NONE: 0,
      };
      const rankA = rank[a.ruleStatus] ?? -1;
      const rankB = rank[b.ruleStatus] ?? -1;
      comparison = rankB - rankA;
      if (comparison === 0) {
        comparison = a.name.localeCompare(b.name);
      }
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const allFilteredSelected =
    sortedApps.length > 0 && sortedApps.every((a) => selectedAppIds.includes(a.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      clearSelection();
    } else {
      selectAllApps(sortedApps.map((a) => a.id));
    }
  };

  const filterTabs: Array<{ key: AppFilterType; label: string }> = [
    { key: 'all', label: `All (${apps.length})` },
    { key: 'foreground', label: `Foreground Apps (${apps.filter(isForegroundApp).length})` },
    { key: 'background', label: `Background (${apps.filter(isBackgroundProcess).length})` },
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

      {/* Table Header with Clickable Arrow Sort Buttons */}
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
            APPLICATION
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

        {/* PROCESS STATUS Column Header */}
        <TouchableOpacity
          style={[styles.colProcess, styles.headerSortBtn]}
          onPress={() => handleSort('process')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.colHeaderText,
              { color: sortColumn === 'process' ? theme.accent : theme.textTertiary },
            ]}
          >
            PROCESS STATUS
          </Text>
          <Text
            style={[
              styles.sortArrow,
              {
                color: sortColumn === 'process' ? theme.accent : theme.textTertiary,
                opacity: sortColumn === 'process' ? 1 : 0.4,
              },
            ]}
          >
            {sortColumn === 'process' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ' ↕'}
          </Text>
        </TouchableOpacity>

        {/* ASSIGNED ADAPTER Column Header */}
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
            ASSIGNED ADAPTER
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

        {/* RULE STATUS Column Header */}
        <TouchableOpacity
          style={[styles.colRuleStatus, styles.headerSortBtn]}
          onPress={() => handleSort('rule')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.colHeaderText,
              { color: sortColumn === 'rule' ? theme.accent : theme.textTertiary },
            ]}
          >
            RULE STATUS
          </Text>
          <Text
            style={[
              styles.sortArrow,
              {
                color: sortColumn === 'rule' ? theme.accent : theme.textTertiary,
                opacity: sortColumn === 'rule' ? 1 : 0.4,
              },
            ]}
          >
            {sortColumn === 'rule' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ' ↕'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Applications Virtualized List */}
      <FlatList
        data={sortedApps}
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
                  isOppositeDefault={item.isOppositeDefault}
                  isFollowDefault={item.isFollowDefault}
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
