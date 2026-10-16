import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useNetSplitStore } from '../store/useNetSplitStore';
import { defaultIpcClient } from '../services/ipcClient';
import { darkTheme, lightTheme, typography, spacing, radii } from '../theme';
import { StatusBadge } from '../components/StatusBadge';
import { WifiIcon, EthernetIcon, ShieldIcon, AppsIcon, RulesIcon, RefreshIcon, BoltIcon, StarIcon, ArrowRightIcon } from '../components/Icons';

export const OverviewScreen: React.FC = () => {
  const themeMode = useNetSplitStore((state) => state.themeMode);
  const settings = useNetSplitStore((state) => state.settings);
  const systemStatus = useNetSplitStore((state) => state.systemStatus);
  const adapters = useNetSplitStore((state) => state.adapters);
  const apps = useNetSplitStore((state) => state.apps);
  const rules = useNetSplitStore((state) => state.rules);
  const setCurrentScreen = useNetSplitStore((state) => state.setCurrentScreen);
  const verifyRules = useNetSplitStore((state) => state.verifyRules);
  const isVerifyingRules = useNetSplitStore((state) => state.isVerifyingRules);
  const isEngineEnabled = useNetSplitStore((state) => state.isEngineEnabled);
  const toggleMasterEngine = useNetSplitStore((state) => state.toggleMasterEngine);
  const serviceConnected = useNetSplitStore((state) => state.serviceConnected);
  const refreshAll = useNetSplitStore((state) => state.refreshAll);

  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installSuccess, setInstallSuccess] = useState<string | null>(null);
  const isStoreServiceInstalled = useNetSplitStore((state) => state.isServiceInstalled);
  const [localIsServiceInstalled, setLocalIsServiceInstalled] = useState<boolean | null>(null);

  const isServiceInstalled = localIsServiceInstalled ?? isStoreServiceInstalled ?? serviceConnected;

  React.useEffect(() => {
    const checkInstalled = async () => {
      if (typeof window !== 'undefined' && (window as any).netSplitHost?.isServiceInstalled) {
        try {
          const installed = await (window as any).netSplitHost.isServiceInstalled();
          setLocalIsServiceInstalled(installed);
          useNetSplitStore.setState({ isServiceInstalled: installed });
        } catch {}
      }
    };
    checkInstalled();
  }, [serviceConnected]);

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  const upAdapters = adapters.filter((a) => a.status === 'UP' && a.type !== 'LOOPBACK');
  const assignedApps = apps.filter((a) => a.assignedAdapterId);
  const activeRules = rules.filter((r) => r.status === 'ACTIVE');
  const errorRules = rules.filter((r) => r.status === 'ERROR');

  const preferredDefaultAdapter = settings.defaultAdapterId
    ? adapters.find((a) => a.id === settings.defaultAdapterId)
    : null;
  const osDefaultAdapter = adapters.find((a) => a.isDefaultRoute);
  const currentDefaultName = preferredDefaultAdapter
    ? preferredDefaultAdapter.friendlyName
    : osDefaultAdapter
    ? `${osDefaultAdapter.friendlyName} (Auto)`
    : 'Windows Auto';

  const formatLinkSpeed = (bps: number) => {
    if (!bps || bps === 0) return 'Unknown speed';
    if (bps >= 1000000000) return `${(bps / 1000000000).toFixed(1)} Gbps`;
    if (bps >= 1000000) return `${(bps / 1000000).toFixed(0)} Mbps`;
    return `${(bps / 1000).toFixed(0)} Kbps`;
  };

  const handleInstallService = async () => {
    setIsInstalling(true);
    setInstallError(null);
    setInstallSuccess(null);
    try {
      let res;
      if (isServiceInstalled) {
        res = await (window as any).netSplitHost?.elevateService?.();
      } else {
        res = await (window as any).netSplitHost?.installService?.();
      }
      if (res?.token) {
        defaultIpcClient.setToken(res.token);
      }
      setLocalIsServiceInstalled(true);
      useNetSplitStore.setState({ isServiceInstalled: true, serviceConnected: true });
      await refreshAll();
      setInstallSuccess('NetSplit Windows Service is active.');
    } catch (e: any) {
      console.warn('Start/install service error:', e);
      setInstallError(e?.message || 'Failed to start service. Please ensure administrator access was granted.');
    } finally {
      setIsInstalling(false);
    }
  };

  const isEngineActive = serviceConnected && isEngineEnabled;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Banner: Service Installation (if offline) OR Routing Status (if online) */}
      {!serviceConnected ? (
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: themeMode === 'dark' ? 'rgba(239, 68, 68, 0.08)' : '#fef2f2',
              borderColor: themeMode === 'dark' ? 'rgba(239, 68, 68, 0.35)' : '#fca5a5',
            },
          ]}
        >
          <View style={styles.heroLeft}>
            <ShieldIcon size={30} color={themeMode === 'dark' ? '#f87171' : '#dc2626'} />
            <View style={{ marginLeft: 14, flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>
                  {isServiceInstalled === false
                    ? 'NetSplit Windows Service Not Installed'
                    : isServiceInstalled === true
                    ? 'NetSplit Windows Service Offline / Stopped'
                    : 'NetSplit Windows Service Offline'}
                </Text>
                <View
                  style={{
                    backgroundColor: themeMode === 'dark' ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                    marginLeft: 10,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: typography.fontFamilyMono,
                      fontSize: 10,
                      fontWeight: 'bold',
                      color: themeMode === 'dark' ? '#f87171' : '#dc2626',
                    }}
                  >
                    {isServiceInstalled === false
                      ? 'NOT INSTALLED'
                      : isServiceInstalled === true
                      ? 'SERVICE STOPPED'
                      : 'OFFLINE'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.heroSubtitle, { color: theme.textSecondary, marginTop: 4 }]}>
                {isServiceInstalled === false
                  ? 'NetSplit requires the privileged Windows Service for kernel network packet filtering and per-app adapter routing. Install the service to activate routing.'
                  : 'The background Windows Service daemon is required for kernel network packet filtering and per-app adapter routing. Activate the service below to resume routing network traffic.'}
              </Text>
              {installError && (
                <Text style={{ color: theme.error, fontSize: 11, marginTop: 6, fontWeight: '500' }}>
                  {installError}
                </Text>
              )}
              {installSuccess && (
                <Text style={{ color: theme.success, fontSize: 11, marginTop: 6, fontWeight: '500' }}>
                  {installSuccess}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.heroRight}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                {
                  backgroundColor: theme.accent,
                  opacity: isInstalling ? 0.7 : 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                },
              ]}
              onPress={handleInstallService}
              disabled={isInstalling}
            >
              {isInstalling ? (
                <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
              ) : (
                <BoltIcon size={13} color="#ffffff" style={{ marginRight: 6 }} />
              )}
              <Text style={[styles.actionBtnText, { color: '#ffffff' }]}>
                {isInstalling
                  ? 'Processing...'
                  : isServiceInstalled === false
                  ? 'Install Windows Service'
                  : 'Start / Activate Service'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: theme.surfaceCard,
              borderColor: isEngineActive ? theme.border : (themeMode === 'dark' ? '#475569' : '#cbd5e1'),
            },
          ]}
        >
          <View style={styles.heroLeft}>
            <ShieldIcon size={28} color={isEngineActive ? theme.accent : theme.textTertiary} />
            <View style={{ marginLeft: 14 }}>
              <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>
                {isEngineActive
                  ? 'Windows Filtering Platform Engine Active'
                  : 'NetSplit Routing Engine Paused'}
              </Text>
              <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
                {isEngineActive
                  ? 'Per-Application socket redirection active with verified interface binding (IP_UNICAST_IF)'
                  : 'Master switch is OFF. All routing rules are bypassed and network traffic flows through standard Windows defaults.'}
              </Text>
            </View>
          </View>

          <View style={styles.heroRight}>
            {isEngineActive ? (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: theme.accent }]}
                onPress={() => verifyRules()}
                disabled={isVerifyingRules}
              >
                <Text style={[styles.actionBtnText, { color: '#ffffff' }]}>
                  {isVerifyingRules ? 'Verifying...' : 'Verify System Rules'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: theme.accent }]}
                onPress={() => toggleMasterEngine(true)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <BoltIcon size={13} color="#ffffff" style={{ marginRight: 5 }} />
                  <Text style={[styles.actionBtnText, { color: '#ffffff' }]}>
                    Resume Engine
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, { backgroundColor: theme.surfaceCard, borderColor: theme.border }]}>
          <Text style={[styles.cardLabel, { color: theme.textTertiary }]}>ACTIVE ADAPTERS</Text>
          <View style={styles.metricValRow}>
            <Text style={[styles.metricVal, { color: theme.textPrimary }]}>{upAdapters.length}</Text>
            <Text style={[styles.metricSubVal, { color: theme.textTertiary }]}>/ {adapters.length} total</Text>
          </View>
          <Text style={[styles.cardFootnote, { color: theme.success }]}>
            {upAdapters.length >= 2 ? 'Multi-adapter routing available' : 'Single connection detected'}
          </Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: theme.surfaceCard, borderColor: theme.border }]}>
          <Text style={[styles.cardLabel, { color: theme.textTertiary }]}>ASSIGNED APPS</Text>
          <View style={styles.metricValRow}>
            <Text style={[styles.metricVal, { color: theme.accent }]}>{assignedApps.length}</Text>
            <Text style={[styles.metricSubVal, { color: theme.textTertiary }]}>/ {apps.length} discovered</Text>
          </View>
          <TouchableOpacity onPress={() => setCurrentScreen('apps')} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.cardLink, { color: theme.accent }]}>Manage applications</Text>
            <ArrowRightIcon size={9} color={theme.accent} style={{ marginLeft: 5 }} />
          </TouchableOpacity>
        </View>

        <View style={[styles.metricCard, { backgroundColor: theme.surfaceCard, borderColor: theme.border }]}>
          <Text style={[styles.cardLabel, { color: theme.textTertiary }]}>ENFORCED RULES</Text>
          <View style={styles.metricValRow}>
            <Text style={[styles.metricVal, { color: theme.textPrimary }]}>{activeRules.length}</Text>
            {errorRules.length > 0 && (
              <Text style={[styles.metricSubVal, { color: theme.error }]}>({errorRules.length} Error)</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => setCurrentScreen('rules')} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.cardLink, { color: theme.accent }]}>View routing table</Text>
            <ArrowRightIcon size={9} color={theme.accent} style={{ marginLeft: 5 }} />
          </TouchableOpacity>
        </View>

        <View style={[styles.metricCard, { backgroundColor: theme.surfaceCard, borderColor: theme.border }]}>
          <Text style={[styles.cardLabel, { color: theme.textTertiary }]}>DEFAULT ADAPTER</Text>
          <View style={styles.metricValRow}>
            <Text style={[styles.metricVal, { color: theme.textPrimary, fontSize: 15 }]} numberOfLines={1}>
              {currentDefaultName}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setCurrentScreen('settings')} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.cardLink, { color: theme.accent }]} numberOfLines={1}>
              {preferredDefaultAdapter ? `Unassigned apps to ${preferredDefaultAdapter.friendlyName}` : 'Configure default adapter'}
            </Text>
            <ArrowRightIcon size={9} color={theme.accent} style={{ marginLeft: 5 }} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Live Adapters Grid */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Live Network Interfaces</Text>
        <TouchableOpacity onPress={() => setCurrentScreen('adapters')} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[styles.sectionAction, { color: theme.accent }]}>All Interfaces ({adapters.length})</Text>
          <ArrowRightIcon size={9} color={theme.accent} style={{ marginLeft: 5 }} />
        </TouchableOpacity>
      </View>

      <View style={styles.adaptersGrid}>
        {upAdapters.map((adapter) => {
          const isWifi = adapter.type === 'WIFI';
          const boundApps = apps.filter((a) => a.assignedAdapterId === adapter.id);
          const isDefault =
            (settings.defaultRoutingPolicy === 'PREFER_ADAPTER' && settings.defaultAdapterId === adapter.id) ||
            (settings.defaultRoutingPolicy === 'WINDOWS_DEFAULT' && adapter.isDefaultRoute);

          return (
            <View
              key={adapter.id}
              style={[
                styles.adapterCard,
                {
                  backgroundColor: theme.surfaceCard,
                  borderColor: isDefault ? theme.accent : theme.border,
                },
              ]}
            >
              <View style={styles.adapterCardHeader}>
                <View style={styles.adapterTypeIcon}>
                  {isWifi ? (
                    <WifiIcon size={20} color={theme.accent} />
                  ) : (
                    <EthernetIcon size={20} color={theme.accent} />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.adapterName, { color: theme.textPrimary }]}>
                    {adapter.friendlyName}
                  </Text>
                  <Text style={[styles.adapterDesc, { color: theme.textTertiary }]} numberOfLines={1}>
                    {adapter.description}
                  </Text>
                </View>
                <StatusBadge status={adapter.status} size="sm" />
              </View>

              <View style={styles.adapterDetails}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: theme.textTertiary }]}>IPv4 Address:</Text>
                  <Text style={[styles.detailVal, { color: theme.textPrimary }]}>
                    {adapter.ipv4Addresses?.[0] || 'Unassigned'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: theme.textTertiary }]}>Gateway:</Text>
                  <Text style={[styles.detailVal, { color: theme.textPrimary }]}>
                    {adapter.gateways?.[0] || 'None'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: theme.textTertiary }]}>Link Speed:</Text>
                  <Text style={[styles.detailVal, { color: theme.textPrimary }]}>
                    {formatLinkSpeed(adapter.linkSpeedBps)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: theme.textTertiary }]}>Interface Index:</Text>
                  <Text style={[styles.detailVal, { color: theme.textTertiary }]}>
                    ifIndex {adapter.ifIndex}
                  </Text>
                </View>
              </View>

              <View style={[styles.adapterCardFooter, { borderTopColor: theme.borderSubtle }]}>
                <Text style={[styles.assignedCountText, { color: theme.textSecondary }]}>
                  {boundApps.length} Application{boundApps.length === 1 ? '' : 's'} Assigned
                </Text>
                {isDefault && (
                  <View style={[styles.defaultRoutePill, { backgroundColor: theme.accent + '22', borderWidth: 1, borderColor: theme.accent, flexDirection: 'row', alignItems: 'center' }]}>
                    {settings.defaultRoutingPolicy === 'PREFER_ADAPTER' && (
                      <StarIcon size={10} color={theme.accent} style={{ marginRight: 4 }} />
                    )}
                    <Text style={[styles.defaultRouteText, { color: theme.accent, fontWeight: 'bold' }]}>
                      {settings.defaultRoutingPolicy === 'PREFER_ADAPTER' ? 'Default Adapter' : 'Default Gateway'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
  },
  heroCard: {
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  heroTitle: {
    fontFamily: typography.fontFamilyDisplay,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  heroSubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  heroRight: {
    marginLeft: spacing.lg,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  actionBtnText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xxl,
  },
  metricCard: {
    flex: 1,
    marginRight: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  cardLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  metricValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  metricVal: {
    fontFamily: typography.fontFamilyDisplay,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
  },
  metricSubVal: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    marginLeft: 6,
  },
  cardFootnote: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    marginTop: 4,
  },
  cardLink: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: typography.weights.medium,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: typography.fontFamilyDisplay,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  sectionAction: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  adaptersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.sm,
  },
  adapterCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.lg,
  },
  adapterCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  adapterTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adapterName: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  adapterDesc: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    marginTop: 1,
  },
  adapterDetails: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  detailKey: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
  },
  detailVal: {
    fontFamily: typography.fontFamilyMono,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  adapterCardFooter: {
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assignedCountText: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
  },
  defaultRoutePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  defaultRouteText: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: typography.weights.medium,
  },
});
