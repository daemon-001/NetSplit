import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNetSplitStore } from '../store/useNetSplitStore';
import { darkTheme, lightTheme, typography, spacing, radii } from '../theme';
import { StatusBadge } from '../components/StatusBadge';
import { WifiIcon, EthernetIcon, ShieldIcon, AppsIcon, RulesIcon, RefreshIcon } from '../components/Icons';

export const OverviewScreen: React.FC = () => {
  const themeMode = useNetSplitStore((state) => state.themeMode);
  const systemStatus = useNetSplitStore((state) => state.systemStatus);
  const adapters = useNetSplitStore((state) => state.adapters);
  const apps = useNetSplitStore((state) => state.apps);
  const rules = useNetSplitStore((state) => state.rules);
  const setCurrentScreen = useNetSplitStore((state) => state.setCurrentScreen);
  const verifyRules = useNetSplitStore((state) => state.verifyRules);
  const isLoading = useNetSplitStore((state) => state.isLoading);

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  const upAdapters = adapters.filter((a) => a.status === 'UP' && a.type !== 'LOOPBACK');
  const assignedApps = apps.filter((a) => a.assignedAdapterId);
  const activeRules = rules.filter((r) => r.status === 'ACTIVE');
  const errorRules = rules.filter((r) => r.status === 'ERROR');

  const formatLinkSpeed = (bps: number) => {
    if (!bps || bps === 0) return 'Unknown speed';
    if (bps >= 1000000000) return `${(bps / 1000000000).toFixed(1)} Gbps`;
    if (bps >= 1000000) return `${(bps / 1000000).toFixed(0)} Mbps`;
    return `${(bps / 1000).toFixed(0)} Kbps`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Banner / Routing Status */}
      <View style={[styles.heroCard, { backgroundColor: theme.surfaceCard, borderColor: theme.border }]}>
        <View style={styles.heroLeft}>
          <ShieldIcon size={28} color={theme.accent} />
          <View style={{ marginLeft: 14 }}>
            <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>
              Windows Filtering Platform Engine
            </Text>
            <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
              Per-Application socket redirection active with verified interface binding (IP_UNICAST_IF)
            </Text>
          </View>
        </View>

        <View style={styles.heroRight}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.accent }]}
            onPress={() => verifyRules()}
            disabled={isLoading}
          >
            <Text style={[styles.actionBtnText, { color: '#ffffff' }]}>
              {isLoading ? 'Verifying...' : 'Verify System Rules'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

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
          <TouchableOpacity onPress={() => setCurrentScreen('apps')}>
            <Text style={[styles.cardLink, { color: theme.accent }]}>Manage applications →</Text>
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
          <TouchableOpacity onPress={() => setCurrentScreen('rules')}>
            <Text style={[styles.cardLink, { color: theme.accent }]}>View routing table →</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.metricCard, { backgroundColor: theme.surfaceCard, borderColor: theme.border }]}>
          <Text style={[styles.cardLabel, { color: theme.textTertiary }]}>DEFAULT POLICY</Text>
          <View style={styles.metricValRow}>
            <Text style={[styles.metricVal, { color: theme.textPrimary, fontSize: 16 }]}>
              {systemStatus?.defaultPolicy === 'PREFER_ADAPTER' ? 'Preferred Adapter' : 'Windows Default'}
            </Text>
          </View>
          <Text style={[styles.cardFootnote, { color: theme.textTertiary }]}>
            Unassigned apps follow default metric
          </Text>
        </View>
      </View>

      {/* Live Adapters Grid */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Live Network Interfaces</Text>
        <TouchableOpacity onPress={() => setCurrentScreen('adapters')}>
          <Text style={[styles.sectionAction, { color: theme.accent }]}>All Interfaces ({adapters.length}) →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.adaptersGrid}>
        {upAdapters.map((adapter) => {
          const isWifi = adapter.type === 'WIFI';
          const boundApps = apps.filter((a) => a.assignedAdapterId === adapter.id);

          return (
            <View
              key={adapter.id}
              style={[
                styles.adapterCard,
                {
                  backgroundColor: theme.surfaceCard,
                  borderColor: adapter.isDefaultRoute ? theme.accent : theme.border,
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
                {adapter.isDefaultRoute && (
                  <View style={[styles.defaultRoutePill, { backgroundColor: theme.surfaceSubtle }]}>
                    <Text style={[styles.defaultRouteText, { color: theme.accent }]}>Default Gateway</Text>
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
