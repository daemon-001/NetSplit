import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { useNetSplitStore, getOppositeAdapter, getDefaultAdapter } from '../store/useNetSplitStore';
import { darkTheme, lightTheme, typography, spacing, radii } from '../theme';
import { WifiIcon, EthernetIcon, SwapIcon, StarIcon, NetworkIcon, CloseIcon } from './Icons';
import { StatusBadge } from './StatusBadge';

interface BulkActionBarProps {
  entityName?: string;
  showToggleActions?: boolean;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  entityName = 'application',
  showToggleActions = false,
}) => {
  const [showAdapterPicker, setShowAdapterPicker] = useState(false);

  const themeMode = useNetSplitStore((state) => state.themeMode);
  const selectedAppIds = useNetSplitStore((state) => state.selectedAppIds);
  const clearSelection = useNetSplitStore((state) => state.clearSelection);
  const adapters = useNetSplitStore((state) => state.adapters);
  const settings = useNetSplitStore((state) => state.settings);
  const bulkAssign = useNetSplitStore((state) => state.bulkAssign);
  const bulkUnassign = useNetSplitStore((state) => state.bulkUnassign);
  const bulkToggleRuleMerge = useNetSplitStore((state) => state.bulkToggleRuleMerge);

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  if (selectedAppIds.length === 0) return null;

  const hardwareAdapters = adapters.filter(
    (a) => a.type === 'WIFI' || a.type === 'ETHERNET' || a.type === 'CELLULAR'
  );

  const connectedAdapters = hardwareAdapters.filter((a) => a.status === 'UP');
  const disconnectedAdapters = hardwareAdapters.filter((a) => a.status !== 'UP');

  const effectiveDefaultId = settings.defaultAdapterId || adapters.find((a) => a.isDefaultRoute)?.id;
  const defaultAdapter = getDefaultAdapter(adapters, effectiveDefaultId);
  const oppositeAdapter = getOppositeAdapter(adapters, effectiveDefaultId);

  const handleBulkAssign = async (adapterId: string) => {
    setShowAdapterPicker(false);
    if (adapterId === 'UNASSIGN') {
      await bulkUnassign();
    } else {
      await bulkAssign(adapterId);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surfaceCard, borderColor: theme.borderStrong }]}>
      <View style={styles.infoRow}>
        <View style={[styles.countBadge, { backgroundColor: theme.accent }]}>
          <Text style={[styles.countText, { color: '#ffffff' }]}>{selectedAppIds.length}</Text>
        </View>
        <Text style={[styles.infoText, { color: theme.textPrimary }]}>
          {entityName}{selectedAppIds.length > 1 ? 's' : ''} selected
        </Text>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.btnAction, { backgroundColor: theme.accent }]}
          onPress={() => setShowAdapterPicker(true)}
        >
          <Text style={[styles.btnActionText, { color: '#ffffff' }]}>Assign to Adapter...</Text>
        </TouchableOpacity>

        {showToggleActions && (
          <>
            <TouchableOpacity
              style={[styles.btnSecondary, { borderColor: theme.border, backgroundColor: theme.surfaceHover }]}
              onPress={() => bulkToggleRuleMerge(selectedAppIds, true)}
            >
              <Text style={[styles.btnSecondaryText, { color: theme.success, fontWeight: '600' }]}>Enable Merge (All)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnSecondary, { borderColor: theme.border, backgroundColor: theme.surfaceHover }]}
              onPress={() => bulkToggleRuleMerge(selectedAppIds, false)}
            >
              <Text style={[styles.btnSecondaryText, { color: theme.warning, fontWeight: '600' }]}>Isolate (Kill-Switch)</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={[styles.btnSecondary, { borderColor: theme.border, backgroundColor: theme.surfaceHover }]}
          onPress={() => bulkUnassign()}
        >
          <Text style={[styles.btnSecondaryText, { color: theme.error, fontWeight: '600' }]}>
            {entityName === 'rule' ? 'Delete Selected' : 'Remove Assignment'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnGhost]}
          onPress={clearSelection}
        >
          <Text style={[styles.btnGhostText, { color: theme.textTertiary }]}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Adapter Selection Modal for Bulk Assign */}
      <Modal visible={showAdapterPicker} transparent animationType="fade" onRequestClose={() => setShowAdapterPicker(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAdapterPicker(false)}
        >
          <View
            style={[styles.pickerModal, { backgroundColor: theme.surfaceCard, borderColor: theme.borderStrong }]}
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.borderSubtle }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickerTitle, { color: theme.textPrimary }]}>
                  Assign {selectedAppIds.length} {entityName === 'rule' ? 'Rule' : 'Application'}{selectedAppIds.length > 1 ? 's' : ''} to:
                </Text>
                <Text style={[styles.pickerSubtitle, { color: theme.textTertiary }]}>
                  Select network adapter for routed traffic
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: theme.surfaceHover, borderColor: theme.borderSubtle }]}
                onPress={() => setShowAdapterPicker(false)}
              >
                <CloseIcon size={12} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Adapters List with clean card layout and prioritized connected adapters */}
            <ScrollView style={styles.adapterList} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={true}>
              {/* Dynamic Modes Header */}
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>DYNAMIC ROUTING MODES</Text>
              </View>

              {/* Dynamic Default Adapter Option */}
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  {
                    borderColor: theme.borderSubtle,
                    backgroundColor: theme.surfaceSubtle,
                  },
                ]}
                onPress={() => handleBulkAssign('DEFAULT_ADAPTER')}
              >
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: themeMode === 'dark' ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                    },
                  ]}
                >
                  <StarIcon size={14} color={themeMode === 'dark' ? '#34d399' : '#059669'} />
                </View>

                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.adapterName, { color: theme.textPrimary }]} numberOfLines={1}>
                      Default Adapter
                    </Text>
                    <View style={[styles.dynamicPill, { backgroundColor: themeMode === 'dark' ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5' }]}>
                      <Text style={{ fontSize: 9, color: themeMode === 'dark' ? '#34d399' : '#059669', fontWeight: '700' }}>
                        DYNAMIC
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.adapterMeta, { color: theme.textTertiary }]} numberOfLines={1}>
                    Follows system default connection ({defaultAdapter?.friendlyName || 'Auto'})
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Dynamic Opposite to Default Adapter Option */}
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  {
                    borderColor: theme.borderSubtle,
                    backgroundColor: theme.surfaceSubtle,
                    opacity: hardwareAdapters.length < 2 ? 0.45 : 1,
                  },
                ]}
                disabled={hardwareAdapters.length < 2}
                onPress={() => handleBulkAssign('OPPOSITE_DEFAULT')}
              >
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: themeMode === 'dark' ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe',
                    },
                  ]}
                >
                  <SwapIcon size={14} color={themeMode === 'dark' ? '#a78bfa' : '#7c3aed'} />
                </View>

                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.adapterName, { color: theme.textPrimary }]} numberOfLines={1}>
                      Opposite to Default Adapter
                    </Text>
                    <View style={[styles.dynamicPill, { backgroundColor: themeMode === 'dark' ? 'rgba(139, 92, 246, 0.2)' : '#ddd6fe' }]}>
                      <Text style={{ fontSize: 9, color: themeMode === 'dark' ? '#a78bfa' : '#7c3aed', fontWeight: '700' }}>
                        DYNAMIC
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.adapterMeta, { color: theme.textTertiary }]} numberOfLines={1}>
                    {hardwareAdapters.length >= 2
                      ? `Follows secondary connection (${oppositeAdapter?.friendlyName || 'Alternate'})`
                      : 'Requires at least 2 active network adapters'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Connected Interfaces Header */}
              <View style={[styles.sectionHeaderRow, { marginTop: 10 }]}>
                <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>
                  CONNECTED INTERFACES ({connectedAdapters.length})
                </Text>
              </View>

              {connectedAdapters.map((a) => {
                const isDefault =
                  settings.defaultRoutingPolicy === 'PREFER_ADAPTER'
                    ? settings.defaultAdapterId === a.id
                    : a.isDefaultRoute;

                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[
                      styles.optionCard,
                      {
                        borderColor: isDefault ? (themeMode === 'dark' ? 'rgba(16, 185, 129, 0.4)' : '#6ee7b7') : theme.borderSubtle,
                        backgroundColor: theme.surfaceSubtle,
                      },
                    ]}
                    onPress={() => handleBulkAssign(a.id)}
                  >
                    <View
                      style={[
                        styles.iconBox,
                        {
                          backgroundColor: themeMode === 'dark' ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
                        },
                      ]}
                    >
                      {a.type === 'WIFI' ? (
                        <WifiIcon size={15} color={theme.success} />
                      ) : (
                        <EthernetIcon size={15} color={theme.success} />
                      )}
                    </View>

                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.adapterName, { color: theme.textPrimary }]} numberOfLines={1}>
                          {a.friendlyName}
                        </Text>
                        {isDefault && (
                          <View style={[styles.defaultTag, { backgroundColor: theme.accentSubtle, borderColor: theme.accent }]}>
                            <Text style={[styles.defaultTagText, { color: theme.accent }]}>DEFAULT</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.adapterMeta, { color: theme.textTertiary }]} numberOfLines={1}>
                        {a.type} • {a.ipv4Addresses?.[0] || 'DHCP'}
                      </Text>
                    </View>

                    <StatusBadge status={a.status} size="sm" />
                  </TouchableOpacity>
                );
              })}

              {/* Disconnected Interfaces (if any) */}
              {disconnectedAdapters.length > 0 && (
                <>
                  <View style={[styles.sectionHeaderRow, { marginTop: 10 }]}>
                    <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>
                      DISCONNECTED / OFFLINE ({disconnectedAdapters.length})
                    </Text>
                  </View>

                  {disconnectedAdapters.map((a) => (
                    <TouchableOpacity
                      key={a.id}
                      style={[
                        styles.optionCard,
                        {
                          borderColor: theme.borderSubtle,
                          backgroundColor: theme.surfaceSubtle,
                          opacity: 0.6,
                        },
                      ]}
                      onPress={() => handleBulkAssign(a.id)}
                    >
                      <View style={[styles.iconBox, { backgroundColor: theme.surfaceHover }]}>
                        {a.type === 'WIFI' ? (
                          <WifiIcon size={15} color={theme.textTertiary} />
                        ) : (
                          <EthernetIcon size={15} color={theme.textTertiary} />
                        )}
                      </View>

                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.adapterName, { color: theme.textSecondary }]} numberOfLines={1}>
                          {a.friendlyName}
                        </Text>
                        <Text style={[styles.adapterMeta, { color: theme.textTertiary }]} numberOfLines={1}>
                          {a.type} • Disconnected
                        </Text>
                      </View>

                      <StatusBadge status={a.status} size="sm" />
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: '25%',
    right: '25%',
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  countText: {
    fontFamily: typography.fontFamilyMono,
    fontSize: 11,
    fontWeight: typography.weights.bold,
  },
  infoText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnAction: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.sm,
    marginRight: 8,
  },
  btnActionText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  btnSecondary: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginRight: 8,
  },
  btnSecondaryText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
  },
  btnGhost: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  btnGhostText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerModal: {
    width: 480,
    maxHeight: '85%',
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    marginBottom: spacing.sm,
  },
  pickerTitle: {
    fontFamily: typography.fontFamilyDisplay,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  pickerSubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  adapterList: {
    maxHeight: 440,
  },
  sectionHeaderRow: {
    paddingHorizontal: 2,
    paddingTop: 8,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 9,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.6,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: 6,
  },
  dynamicPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    marginLeft: 6,
  },
  defaultTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    marginLeft: 6,
  },
  defaultTagText: {
    fontSize: 9,
    fontWeight: '700',
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adapterName: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  adapterMeta: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    marginTop: 2,
  },
});
