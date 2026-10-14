import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNetSplitStore } from '../store/useNetSplitStore';
import { darkTheme, lightTheme, typography, spacing, radii } from '../theme';
import { StatusBadge } from '../components/StatusBadge';
import { WifiIcon, EthernetIcon, CheckIcon } from '../components/Icons';

export const NetworkAdaptersScreen: React.FC = () => {
  const [selectedAdapterId, setSelectedAdapterId] = useState<string | null>(null);

  const themeMode = useNetSplitStore((state) => state.themeMode);
  const adapters = useNetSplitStore((state) => state.adapters);
  const apps = useNetSplitStore((state) => state.apps);
  const settings = useNetSplitStore((state) => state.settings);
  const setDefaultAdapter = useNetSplitStore((state) => state.setDefaultAdapter);
  const removeAssignment = useNetSplitStore((state) => state.removeAssignment);
  const setCurrentScreen = useNetSplitStore((state) => state.setCurrentScreen);

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  // Selected adapter details
  const activeAdapter = adapters.find((a) => a.id === selectedAdapterId) || adapters[0];
  const boundApps = activeAdapter ? apps.filter((a) => a.assignedAdapterId === activeAdapter.id) : [];

  const formatLinkSpeed = (bps: number, status?: string) => {
    if (!bps || bps === 0 || bps > 1000000000000 || status === 'DOWN') return 'Disconnected';
    if (bps >= 1000000000) return `${(bps / 1000000000).toFixed(1)} Gbps`;
    if (bps >= 1000000) return `${(bps / 1000000).toFixed(0)} Mbps`;
    return `${(bps / 1000).toFixed(0)} Kbps`;
  };

  const isAdapterDefault = (adapterId: string, isDefaultRoute: boolean) => {
    if (settings.defaultRoutingPolicy === 'PREFER_ADAPTER') {
      return settings.defaultAdapterId === adapterId;
    }
    return isDefaultRoute;
  };

  const activeIsDefault = activeAdapter ? isAdapterDefault(activeAdapter.id, activeAdapter.isDefaultRoute) : false;

  return (
    <View style={styles.container}>
      {/* Left List of detected adapters */}
      <View style={[styles.listPane, { backgroundColor: theme.surfaceCard, borderRightColor: theme.border }]}>
        <View style={[styles.listHeader, { borderBottomColor: theme.borderSubtle }]}>
          <Text style={[styles.listHeaderTitle, { color: theme.textSecondary }]}>
            DETECTED ADAPTERS ({adapters.length})
          </Text>
        </View>

        <ScrollView>
          {adapters.map((adapter) => {
            const isSelected = activeAdapter && activeAdapter.id === adapter.id;
            const isWifi = adapter.type === 'WIFI';
            const isUp = adapter.status === 'UP';
            const appCount = apps.filter((a) => a.assignedAdapterId === adapter.id).length;
            const isDefault = isAdapterDefault(adapter.id, adapter.isDefaultRoute);

            return (
              <TouchableOpacity
                key={adapter.id}
                style={[
                  styles.adapterItem,
                  {
                    backgroundColor: isSelected ? theme.surfaceActive : 'transparent',
                    borderBottomColor: theme.borderSubtle,
                  },
                ]}
                onPress={() => setSelectedAdapterId(adapter.id)}
              >
                <View style={styles.itemIconBox}>
                  {isWifi ? (
                    <WifiIcon size={18} color={isUp ? theme.accent : theme.textTertiary} />
                  ) : (
                    <EthernetIcon size={18} color={isUp ? theme.accent : theme.textTertiary} />
                  )}
                </View>

                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[styles.itemName, { color: theme.textPrimary }]} numberOfLines={1}>
                      {adapter.friendlyName}
                    </Text>
                    <StatusBadge status={adapter.status} size="sm" />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Text style={[styles.itemSub, { color: theme.textTertiary }]}>
                      {adapter.type} • {formatLinkSpeed(adapter.linkSpeedBps, adapter.status)}
                    </Text>
                    {isDefault && (
                      <View style={[styles.defaultTag, { backgroundColor: theme.accent + '22', borderColor: theme.accent }]}>
                        <Text style={[styles.defaultTagText, { color: theme.accent }]}>DEFAULT</Text>
                      </View>
                    )}
                  </View>
                  {appCount > 0 && (
                    <Text style={[styles.itemAppCount, { color: theme.accent }]}>
                      {appCount} assigned application{appCount > 1 ? 's' : ''}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Right Details Pane for the selected adapter */}
      {activeAdapter ? (
        <ScrollView style={styles.detailPane} contentContainerStyle={{ padding: spacing.xl }}>
          <View style={[styles.detailHeader, { borderBottomColor: theme.borderSubtle }]}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.detailTitle, { color: theme.textPrimary }]}>
                  {activeAdapter.friendlyName}
                </Text>
                {activeIsDefault && (
                  <View style={[styles.defaultBadgeLarge, { backgroundColor: theme.accent + '22', borderColor: theme.accent }]}>
                    <Text style={[styles.defaultBadgeLargeText, { color: theme.accent }]}>★ DEFAULT ADAPTER</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.detailSubtitle, { color: theme.textSecondary }]}>
                {activeAdapter.description}
              </Text>
            </View>
            <StatusBadge status={activeAdapter.status} size="md" />
          </View>

          {/* Default Adapter Quick Action Card */}
          <View
            style={[
              styles.defaultStatusCard,
              {
                backgroundColor: activeIsDefault ? theme.surfaceActive : theme.surfaceCard,
                borderColor: activeIsDefault ? theme.accent : theme.border,
              },
            ]}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.defaultStatusTitle, { color: activeIsDefault ? theme.accent : theme.textPrimary }]}>
                {activeIsDefault ? '★ System Default Network Adapter' : 'Set as Default Network Adapter'}
              </Text>
              <Text style={[styles.defaultStatusDesc, { color: theme.textSecondary }]}>
                {activeIsDefault
                  ? 'All unassigned applications, games, and background services route traffic through this adapter (metric 5).'
                  : `Route all unassigned applications and background traffic through ${activeAdapter.friendlyName} instead of other interfaces.`}
              </Text>
            </View>

            {activeIsDefault ? (
              <TouchableOpacity
                style={[styles.actionBtnSecondary, { borderColor: theme.border, backgroundColor: theme.surfaceHover }]}
                onPress={() => setDefaultAdapter('', 'WINDOWS_DEFAULT')}
              >
                <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '600' }}>Revert to Auto</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtnPrimary, { backgroundColor: theme.accent }]}
                onPress={() => setDefaultAdapter(activeAdapter.id, 'PREFER_ADAPTER')}
                disabled={activeAdapter.status !== 'UP'}
              >
                <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: 'bold' }}>★ Make Default</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Properties Grid */}
          <Text style={[styles.sectionHeading, { color: theme.textTertiary }]}>ADAPTER ATTRIBUTES</Text>
          <View style={[styles.propsCard, { backgroundColor: theme.surfaceCard, borderColor: theme.border }]}>
            <View style={styles.propRow}>
              <Text style={[styles.propKey, { color: theme.textTertiary }]}>Adapter Type:</Text>
              <Text style={[styles.propVal, { color: theme.textPrimary }]}>{activeAdapter.type}</Text>
            </View>
            <View style={styles.propRow}>
              <Text style={[styles.propKey, { color: theme.textTertiary }]}>Hardware MAC Address:</Text>
              <Text style={[styles.propValMono, { color: theme.textPrimary }]}>{activeAdapter.macAddress || 'None'}</Text>
            </View>
            <View style={styles.propRow}>
              <Text style={[styles.propKey, { color: theme.textTertiary }]}>Interface Index (IPv4 / IPv6):</Text>
              <Text style={[styles.propValMono, { color: theme.textPrimary }]}>
                ifIndex {activeAdapter.ifIndex} / {activeAdapter.ipv6IfIndex}
              </Text>
            </View>
            <View style={styles.propRow}>
              <Text style={[styles.propKey, { color: theme.textTertiary }]}>GUID Identifier:</Text>
              <Text style={[styles.propValMono, { color: theme.textTertiary, fontSize: 11 }]}>
                {activeAdapter.id}
              </Text>
            </View>
            <View style={styles.propRow}>
              <Text style={[styles.propKey, { color: theme.textTertiary }]}>Link Speed:</Text>
              <Text style={[styles.propVal, { color: theme.textPrimary }]}>
                {formatLinkSpeed(activeAdapter.linkSpeedBps)}
              </Text>
            </View>
            <View style={styles.propRow}>
              <Text style={[styles.propKey, { color: theme.textTertiary }]}>Routing Compatibility:</Text>
              <Text style={[styles.propVal, { color: activeAdapter.compatibilityStatus === 'SUPPORTED' ? theme.success : theme.warning }]}>
                {activeAdapter.compatibilityStatus} (Standard WFP & Socket Binding)
              </Text>
            </View>
          </View>

          {/* IP Configuration */}
          <Text style={[styles.sectionHeading, { color: theme.textTertiary }]}>IP CONFIGURATION</Text>
          <View style={[styles.propsCard, { backgroundColor: theme.surfaceCard, borderColor: theme.border }]}>
            <View style={styles.propRow}>
              <Text style={[styles.propKey, { color: theme.textTertiary }]}>IPv4 Address:</Text>
              <Text style={[styles.propValMono, { color: theme.textPrimary }]}>
                {(activeAdapter.ipv4Addresses && activeAdapter.ipv4Addresses.length > 0)
                  ? activeAdapter.ipv4Addresses.join(', ')
                  : 'No IPv4 address'}
              </Text>
            </View>
            <View style={styles.propRow}>
              <Text style={[styles.propKey, { color: theme.textTertiary }]}>IPv4 Gateway:</Text>
              <Text style={[styles.propValMono, { color: theme.textPrimary }]}>
                {(activeAdapter.gateways && activeAdapter.gateways.length > 0)
                  ? activeAdapter.gateways.join(', ')
                  : 'None'}
              </Text>
            </View>
            {activeAdapter.ipv6Addresses && activeAdapter.ipv6Addresses.length > 0 && (
              <View style={styles.propRow}>
                <Text style={[styles.propKey, { color: theme.textTertiary }]}>IPv6 Address:</Text>
                <Text style={[styles.propValMono, { color: theme.textPrimary }]}>
                  {activeAdapter.ipv6Addresses[0]}
                </Text>
              </View>
            )}
            <View style={styles.propRow}>
              <Text style={[styles.propKey, { color: theme.textTertiary }]}>Holds Default Route:</Text>
              <Text style={[styles.propVal, { color: activeAdapter.isDefaultRoute ? theme.accent : theme.textSecondary }]}>
                {activeAdapter.isDefaultRoute ? 'Yes (Primary Windows Gateway)' : 'No'}
              </Text>
            </View>
          </View>

          {/* Assigned Applications */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm }}>
            <Text style={[styles.sectionHeading, { color: theme.textTertiary, marginBottom: 0 }]}>
              ASSIGNED APPLICATIONS ({boundApps.length})
            </Text>
            <TouchableOpacity onPress={() => setCurrentScreen('apps')}>
              <Text style={{ fontFamily: typography.fontFamily, fontSize: typography.sizes.xs, color: theme.accent }}>
                + Assign More Apps
              </Text>
            </TouchableOpacity>
          </View>

          {boundApps.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: theme.surfaceCard, borderColor: theme.border }]}>
              <Text style={[styles.emptyText, { color: theme.textTertiary }]}>
                No applications are currently routed through this adapter.
              </Text>
            </View>
          ) : (
            <View style={[styles.appsList, { backgroundColor: theme.surfaceCard, borderColor: theme.border }]}>
              {boundApps.map((app) => (
                <View
                  key={app.id}
                  style={[styles.appItemRow, { borderBottomColor: theme.borderSubtle }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.appNameText, { color: theme.textPrimary }]}>{app.name}</Text>
                    <Text style={[styles.appPathText, { color: theme.textTertiary }]} numberOfLines={1}>
                      {app.executablePath}
                    </Text>
                  </View>
                  <StatusBadge status={app.ruleStatus} size="sm" />
                  <TouchableOpacity
                    style={[styles.unassignBtn, { backgroundColor: theme.surfaceHover }]}
                    onPress={() => removeAssignment(app.id)}
                  >
                    <Text style={{ color: theme.error, fontSize: 11 }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  listPane: {
    width: 300,
    borderRightWidth: 1,
  },
  listHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  listHeaderTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  adapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  itemIconBox: {
    width: 24,
    alignItems: 'center',
  },
  itemName: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  itemSub: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    marginTop: 2,
  },
  itemAppCount: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: typography.weights.medium,
    marginTop: 3,
  },
  detailPane: {
    flex: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    marginBottom: spacing.lg,
  },
  detailTitle: {
    fontFamily: typography.fontFamilyDisplay,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  detailSubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  sectionHeading: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  propsCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.lg,
  },
  propRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  propKey: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
  },
  propVal: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  propValMono: {
    fontFamily: typography.fontFamilyMono,
    fontSize: typography.sizes.xs,
  },
  emptyBox: {
    padding: spacing.xl,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
  },
  appsList: {
    borderRadius: radii.md,
    borderWidth: 1,
  },
  appItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  appNameText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  appPathText: {
    fontFamily: typography.fontFamilyMono,
    fontSize: 10,
    marginTop: 2,
  },
  unassignBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    marginLeft: spacing.md,
  },
  defaultTag: {
    marginLeft: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.xs,
    borderWidth: 1,
  },
  defaultTagText: {
    fontFamily: typography.fontFamilyMono,
    fontSize: 9,
    fontWeight: typography.weights.bold,
  },
  defaultBadgeLarge: {
    marginLeft: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
    borderWidth: 1,
  },
  defaultBadgeLargeText: {
    fontFamily: typography.fontFamilyMono,
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  defaultStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  defaultStatusTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  defaultStatusDesc: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  actionBtnPrimary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  actionBtnSecondary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
});
