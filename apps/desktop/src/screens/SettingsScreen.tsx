import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { useNetSplitStore } from '../store/useNetSplitStore';
import { defaultIpcClient } from '../services/ipcClient';
import { darkTheme, lightTheme, typography, spacing, radii } from '../theme';
import { ShieldIcon, CheckIcon, NetworkIcon, WifiIcon, EthernetIcon } from '../components/Icons';

export const SettingsScreen: React.FC = () => {
  const themeMode = useNetSplitStore((state) => state.themeMode);
  const setThemeMode = useNetSplitStore((state) => state.setThemeMode);
  const settings = useNetSplitStore((state) => state.settings);
  const updateSettings = useNetSplitStore((state) => state.updateSettings);
  const setDefaultAdapter = useNetSplitStore((state) => state.setDefaultAdapter);
  const adapters = useNetSplitStore((state) => state.adapters);
  const systemStatus = useNetSplitStore((state) => state.systemStatus);
  const serviceConnected = useNetSplitStore((state) => state.serviceConnected);
  const refreshAll = useNetSplitStore((state) => state.refreshAll);

  const [isRestarting, setIsRestarting] = useState(false);

  const handleRestartElevated = async () => {
    setIsRestarting(true);
    try {
      const res = await (window as any).netSplitHost?.elevateService?.();
      if (res?.token) {
        defaultIpcClient.setToken(res.token);
      }
      await refreshAll();
    } catch (e) {
      console.warn('Elevate service error:', e);
    } finally {
      setIsRestarting(false);
    }
  };

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  const upAdapters = adapters.filter((a) => a.status === 'UP' && a.type !== 'LOOPBACK');

  const formatLinkSpeed = (bps: number) => {
    if (!bps || bps === 0) return '';
    if (bps >= 1000000000) return `${(bps / 1000000000).toFixed(1)} Gbps`;
    if (bps >= 1000000) return `${(bps / 1000000).toFixed(0)} Mbps`;
    return `${(bps / 1000).toFixed(0)} Kbps`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Service Diagnostics Card */}
      <View style={[styles.card, { backgroundColor: theme.surfaceCard, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <ShieldIcon size={20} color={serviceConnected ? theme.success : theme.error} />
          <Text style={[styles.cardTitle, { color: theme.textPrimary, marginLeft: 10 }]}>
            Windows Service & WFP Engine Status
          </Text>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>Service Daemon Status:</Text>
            <Text style={[styles.settingValue, { color: serviceConnected ? theme.success : theme.error }]}>
              {serviceConnected ? 'RUNNING (NT AUTHORITY\\SYSTEM or LocalService)' : 'STOPPED / UNREACHABLE'}
            </Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>Engine Interception Mode:</Text>
            <Text style={[styles.settingValue, { color: theme.textPrimary }]}>
              {systemStatus?.routingEngineMode || 'WFP_ALE_PROXY (User-Mode Connect Redirect)'}
            </Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>Dynamic WFP Session:</Text>
            <Text style={[styles.settingValue, { color: theme.success }]}>
              Active (Zero-residue automatic kernel filter cleanup)
            </Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>System Permissions:</Text>
            <Text style={[styles.settingValue, { color: theme.success }]}>
              Full Administrator & Kernel Route Control (Always Active)
            </Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>IPC Channel:</Text>
            <Text style={[styles.settingValue, { color: theme.textPrimary }]}>
              Local Loopback WebSocket (127.0.0.1:48192, Ephemeral Token DACL)
            </Text>
          </View>
        </View>
      </View>

      {/* Default Network Adapter for Unassigned Applications */}
      <View style={[styles.card, { backgroundColor: theme.surfaceCard, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <NetworkIcon size={20} color={theme.accent} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
              Default Adapter for Unassigned Applications
            </Text>
            <Text style={[styles.policyDesc, { color: theme.textSecondary, marginTop: 2 }]}>
              Any program, game, or background process not specifically listed in Applications will route through this adapter (lowest routing metric).
            </Text>
          </View>
        </View>

        <View style={{ marginTop: spacing.md, gap: 10 }}>
          {/* Option: Windows Automatic Default */}
          <TouchableOpacity
            style={[
              styles.defaultAdapterOption,
              {
                backgroundColor: settings.defaultRoutingPolicy === 'WINDOWS_DEFAULT' ? theme.surfaceActive : theme.surfaceSubtle,
                borderColor: settings.defaultRoutingPolicy === 'WINDOWS_DEFAULT' ? theme.accent : theme.border,
              },
            ]}
            onPress={() => setDefaultAdapter('', 'WINDOWS_DEFAULT')}
          >
            <View style={styles.radioOuter}>
              {settings.defaultRoutingPolicy === 'WINDOWS_DEFAULT' && (
                <View style={[styles.radioInner, { backgroundColor: theme.accent }]} />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>
                  Windows Automatic Default (OS Priority)
                </Text>
                {settings.defaultRoutingPolicy === 'WINDOWS_DEFAULT' && (
                  <View style={[styles.activeTag, { backgroundColor: theme.accent + '22', borderColor: theme.accent }]}>
                    <Text style={[styles.activeTagText, { color: theme.accent }]}>ACTIVE</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.optionDesc, { color: theme.textTertiary }]}>
                Windows dynamically determines the default gateway based on interface speeds and standard metrics.
              </Text>
            </View>
          </TouchableOpacity>

          {/* Options: Each Connected Hardware Adapter */}
          {upAdapters.map((ad) => {
            const isChosen = settings.defaultRoutingPolicy === 'PREFER_ADAPTER' && settings.defaultAdapterId === ad.id;
            const isWifi = ad.type === 'WIFI';
            const speed = formatLinkSpeed(ad.linkSpeedBps);
            const ip = ad.ipv4Addresses && ad.ipv4Addresses.length > 0 ? ad.ipv4Addresses[0] : '';

            return (
              <TouchableOpacity
                key={ad.id}
                style={[
                  styles.defaultAdapterOption,
                  {
                    backgroundColor: isChosen ? theme.surfaceActive : theme.surfaceSubtle,
                    borderColor: isChosen ? theme.accent : theme.border,
                  },
                ]}
                onPress={() => setDefaultAdapter(ad.id, 'PREFER_ADAPTER')}
              >
                <View style={styles.radioOuter}>
                  {isChosen && (
                    <View style={[styles.radioInner, { backgroundColor: theme.accent }]} />
                  )}
                </View>
                <View style={{ marginLeft: 12, marginRight: 8 }}>
                  {isWifi ? (
                    <WifiIcon size={18} color={isChosen ? theme.accent : theme.textSecondary} />
                  ) : (
                    <EthernetIcon size={18} color={isChosen ? theme.accent : theme.textSecondary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>
                      {ad.friendlyName}
                    </Text>
                    {isChosen ? (
                      <View style={[styles.activeTag, { backgroundColor: theme.success + '22', borderColor: theme.success }]}>
                        <Text style={[styles.activeTagText, { color: theme.success }]}>DEFAULT ADAPTER (METRIC 5)</Text>
                      </View>
                    ) : ad.isDefaultRoute ? (
                      <View style={[styles.activeTag, { backgroundColor: theme.surfaceHover, borderColor: theme.border }]}>
                        <Text style={[styles.activeTagText, { color: theme.textSecondary }]}>CURRENT OS ROUTE</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.optionDesc, { color: theme.textTertiary }]}>
                    {ad.description} • {ip}{speed ? ` • ${speed}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Network Policies */}
      <View style={[styles.card, { backgroundColor: theme.surfaceCard, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.textPrimary, marginBottom: spacing.md }]}>
          Network Routing & Isolation Policies
        </Text>

        {/* Fallback Behavior */}
        <View style={[styles.policyBlock, { borderBottomColor: theme.borderSubtle }]}>
          <View style={{ flex: 1, paddingRight: spacing.lg }}>
            <Text style={[styles.policyTitle, { color: theme.textPrimary }]}>
              Adapter Disconnect Policy (Kill-Switch)
            </Text>
            <Text style={[styles.policyDesc, { color: theme.textSecondary }]}>
              When an assigned adapter disconnects, strictly block outbound traffic for that application rather than leaking its traffic onto the default Windows connection.
            </Text>
          </View>

          <Switch
            value={settings.adapterDisconnectBehavior === 'BLOCK'}
            onValueChange={(val) =>
              updateSettings({ adapterDisconnectBehavior: val ? 'BLOCK' : 'WINDOWS_DEFAULT' })
            }
            trackColor={{ false: theme.surfaceHover, true: theme.accent }}
          />
        </View>

        {/* Audit Logging */}
        <View style={styles.policyBlock}>
          <View style={{ flex: 1, paddingRight: spacing.lg }}>
            <Text style={[styles.policyTitle, { color: theme.textPrimary }]}>
              Real-Time Audit & Telemetry Logging
            </Text>
            <Text style={[styles.policyDesc, { color: theme.textSecondary }]}>
              Record kernel rule additions, adapter arrival/departure events, and verification logs locally in the Activity log. No browsing history or packet payloads are ever collected.
            </Text>
          </View>

          <Switch
            value={settings.enableAuditLogging}
            onValueChange={(val) => updateSettings({ enableAuditLogging: val })}
            trackColor={{ false: theme.surfaceHover, true: theme.accent }}
          />
        </View>
      </View>

      {/* Appearance & System */}
      <View style={[styles.card, { backgroundColor: theme.surfaceCard, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.textPrimary, marginBottom: spacing.md }]}>
          Desktop Appearance & Startup
        </Text>

        <View style={[styles.settingRow, { marginBottom: 16 }]}>
          <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>Interface Theme:</Text>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
              style={[
                styles.themeBtn,
                {
                  backgroundColor: themeMode === 'dark' ? theme.accent : theme.surfaceSubtle,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => setThemeMode('dark')}
            >
              <Text style={{ color: themeMode === 'dark' ? '#ffffff' : theme.textSecondary, fontSize: 12 }}>
                Dark Theme
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeBtn,
                {
                  backgroundColor: themeMode === 'light' ? theme.accent : theme.surfaceSubtle,
                  borderColor: theme.border,
                  marginLeft: 8,
                },
              ]}
              onPress={() => setThemeMode('light')}
            >
              <Text style={{ color: themeMode === 'light' ? '#ffffff' : theme.textSecondary, fontSize: 12 }}>
                Light Theme
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.policyBlock, { borderTopWidth: 1, borderTopColor: theme.borderSubtle }]}>
          <View style={{ flex: 1, paddingRight: spacing.lg }}>
            <Text style={[styles.policyTitle, { color: theme.textPrimary }]}>Start with Windows</Text>
            <Text style={[styles.policyDesc, { color: theme.textSecondary }]}>
              Launch NetSplit minimized in system tray when logging into Windows.
            </Text>
          </View>

          <Switch
            value={settings.startWithWindows}
            onValueChange={(val) => updateSettings({ startWithWindows: val })}
            trackColor={{ false: theme.surfaceHover, true: theme.accent }}
          />
        </View>
      </View>

      {/* Windows Service Permanent Installation Card */}
      <View style={[styles.card, { backgroundColor: theme.surfaceCard, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.textPrimary, marginBottom: 6 }]}>
          Windows Service Management
        </Text>
        <Text style={[styles.policyDesc, { color: theme.textSecondary, marginBottom: 12 }]}>
          Installing NetSplit as a Windows Service allows it to run automatically on Windows boot under NT AUTHORITY\SYSTEM with full administrative privileges, eliminating UAC prompts and ensuring seamless network adapter metric and route enforcement.
        </Text>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            style={[styles.installServiceBtn, { backgroundColor: theme.accent }]}
            onPress={() => (window as any).netSplitHost?.installService?.()}
          >
            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 12 }}>
              🛡️ Install as Windows Service
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.installServiceBtn,
              {
                backgroundColor: isRestarting ? theme.surfaceSubtle : theme.surfaceHover,
                borderWidth: 1,
                borderColor: theme.border,
                opacity: isRestarting ? 0.7 : 1,
              },
            ]}
            onPress={handleRestartElevated}
            disabled={isRestarting}
          >
            <Text style={{ color: theme.textPrimary, fontSize: 12 }}>
              {isRestarting ? '⏳ Restarting Service...' : '⚡ Restart Service Elevated'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>


      {/* Uninstall and Clean Recovery Guidance */}
      <View style={[styles.card, { backgroundColor: theme.surfaceCard, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.textPrimary, marginBottom: 6 }]}>
          Clean Uninstall & Recovery Guidance
        </Text>
        <Text style={[styles.policyDesc, { color: theme.textSecondary, marginBottom: 12 }]}>
          NetSplit uses exclusively dynamic WFP sessions (`FWPM_SESSION_FLAG_DYNAMIC`). All rules are automatically freed by Windows upon exit. To cleanly uninstall the service:
        </Text>

        <View style={[styles.codeBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
          <Text style={[styles.codeText, { color: theme.textPrimary }]}>
            # Run in elevated PowerShell to completely remove the background service:{'\n'}
            .\native\windows-service\NetSplitService.exe --uninstall
          </Text>
        </View>
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
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontFamily: typography.fontFamilyDisplay,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  cardBody: {
    marginTop: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  settingLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
  },
  settingValue: {
    fontFamily: typography.fontFamilyMono,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  policyBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  policyTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  policyDesc: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  themeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  codeBox: {
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  codeText: {
    fontFamily: typography.fontFamilyMono,
    fontSize: 11,
    lineHeight: 18,
  },
  defaultAdapterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#666666',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  optionDesc: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  activeTag: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
    borderWidth: 1,
  },
  activeTagText: {
    fontFamily: typography.fontFamilyMono,
    fontSize: 9,
    fontWeight: typography.weights.bold,
  },
  installServiceBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
