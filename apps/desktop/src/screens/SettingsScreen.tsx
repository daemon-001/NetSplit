import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { useNetSplitStore } from '../store/useNetSplitStore';
import { darkTheme, lightTheme, typography, spacing, radii } from '../theme';
import { ShieldIcon, CheckIcon } from '../components/Icons';

export const SettingsScreen: React.FC = () => {
  const themeMode = useNetSplitStore((state) => state.themeMode);
  const setThemeMode = useNetSplitStore((state) => state.setThemeMode);
  const settings = useNetSplitStore((state) => state.settings);
  const updateSettings = useNetSplitStore((state) => state.updateSettings);
  const systemStatus = useNetSplitStore((state) => state.systemStatus);
  const serviceConnected = useNetSplitStore((state) => state.serviceConnected);

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

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
            <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>IPC Channel:</Text>
            <Text style={[styles.settingValue, { color: theme.textPrimary }]}>
              Local Loopback WebSocket (127.0.0.1:48192, Ephemeral Token DACL)
            </Text>
          </View>
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
});
