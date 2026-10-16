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

            {/* Adapters List with clear UP / DOWN Network Status */}
            <ScrollView style={styles.adapterList} showsVerticalScrollIndicator={false}>
              {/* Dynamic Default Adapter Option */}
              <TouchableOpacity
                style={[
                  styles.adapterRow,
                  {
                    borderBottomColor: theme.borderSubtle,
                    backgroundColor: themeMode === 'dark' ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
                  },
                ]}
                onPress={() => handleBulkAssign('DEFAULT_ADAPTER')}
              >
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: themeMode === 'dark' ? 'rgba(16, 185, 129, 0.25)' : '#d1fae5',
                    },
                  ]}
                >
                  <StarIcon size={16} color={themeMode === 'dark' ? '#6ee7b7' : '#059669'} />
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text
                      style={[
                        styles.adapterName,
                        { color: themeMode === 'dark' ? '#6ee7b7' : '#047857', fontWeight: '700' },
                      ]}
                      numberOfLines={1}
                    >
                      Default Adapter
                    </Text>
                    <View
                      style={{
                        backgroundColor: themeMode === 'dark' ? 'rgba(16, 185, 129, 0.35)' : '#a7f3d0',
                        paddingHorizontal: 5,
                        paddingVertical: 1,
                        borderRadius: 3,
                        marginLeft: 6,
                      }}
                    >
                      <Text style={{ fontSize: 9, color: themeMode === 'dark' ? '#6ee7b7' : '#047857', fontWeight: '700' }}>
                        DYNAMIC
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.adapterMeta, { color: theme.textTertiary }]} numberOfLines={1}>
                    Dynamically follows default connection (currently: {defaultAdapter?.friendlyName || 'Auto'})
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Dynamic Opposite to Default Adapter Option */}
              <TouchableOpacity
                style={[
                  styles.adapterRow,
                  {
                    borderBottomColor: theme.borderSubtle,
                    backgroundColor: themeMode === 'dark' ? 'rgba(139, 92, 246, 0.12)' : '#f5f3ff',
                    opacity: hardwareAdapters.length < 2 ? 0.5 : 1,
                  },
                ]}
                disabled={hardwareAdapters.length < 2}
                onPress={() => handleBulkAssign('OPPOSITE_DEFAULT')}
              >
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: themeMode === 'dark' ? 'rgba(139, 92, 246, 0.25)' : '#ede9fe',
                    },
                  ]}
                >
                  <SwapIcon size={16} color={themeMode === 'dark' ? '#c4b5fd' : '#7c3aed'} />
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text
                      style={[
                        styles.adapterName,
                        { color: themeMode === 'dark' ? '#c4b5fd' : '#6d28d9', fontWeight: '700' },
                      ]}
                      numberOfLines={1}
                    >
                      Opposite to Default Adapter
                    </Text>
                    <View
                      style={{
                        backgroundColor: themeMode === 'dark' ? 'rgba(139, 92, 246, 0.35)' : '#ddd6fe',
                        paddingHorizontal: 5,
                        paddingVertical: 1,
                        borderRadius: 3,
                        marginLeft: 6,
                      }}
                    >
                      <Text style={{ fontSize: 9, color: themeMode === 'dark' ? '#ddd6fe' : '#5b21b6', fontWeight: '700' }}>
                        DYNAMIC
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.adapterMeta, { color: theme.textTertiary }]} numberOfLines={1}>
                    {hardwareAdapters.length >= 2
                      ? `Dynamically follows non-default connection (currently: ${oppositeAdapter?.friendlyName || 'Secondary'})`
                      : 'Requires at least 2 network adapters'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Windows Default (Unassigned) option */}
              <TouchableOpacity
                style={[
                  styles.adapterRow,
                  {
                    borderBottomColor: theme.borderSubtle,
                    backgroundColor: theme.surfaceCard,
                  },
                ]}
                onPress={() => handleBulkAssign('UNASSIGN')}
              >
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
                    },
                  ]}
                >
                  <NetworkIcon size={16} color={theme.textSecondary} />
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text
                    style={[
                      styles.adapterName,
                      { color: theme.textPrimary, fontWeight: '600' },
                    ]}
                    numberOfLines={1}
                  >
                    Windows Default (Unassigned)
                  </Text>
                  <Text style={[styles.adapterMeta, { color: theme.textTertiary }]} numberOfLines={1}>
                    Remove rule and follow normal OS route metric
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={{ paddingHorizontal: spacing.sm, paddingTop: 10, paddingBottom: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: theme.textTertiary, letterSpacing: 0.5 }}>
                  SPECIFIC HARDWARE ADAPTERS
                </Text>
              </View>

              {hardwareAdapters.map((a) => {
                const isUp = a.status === 'UP';
                const isDefault =
                  settings.defaultRoutingPolicy === 'PREFER_ADAPTER'
                    ? settings.defaultAdapterId === a.id
                    : a.isDefaultRoute;

                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[
                      styles.adapterRow,
                      {
                        borderBottomColor: theme.borderSubtle,
                        backgroundColor: theme.surfaceCard,
                      },
                    ]}
                    onPress={() => handleBulkAssign(a.id)}
                  >
                    <View
                      style={[
                        styles.iconBox,
                        {
                          backgroundColor: isUp
                            ? (themeMode === 'dark' ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5')
                            : (themeMode === 'dark' ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2'),
                        },
                      ]}
                    >
                      {a.type === 'WIFI' ? (
                        <WifiIcon size={16} color={isUp ? (themeMode === 'dark' ? '#34d399' : '#059669') : theme.textTertiary} />
                      ) : (
                        <EthernetIcon size={16} color={isUp ? (themeMode === 'dark' ? '#34d399' : '#059669') : theme.textTertiary} />
                      )}
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.adapterName, { color: theme.textPrimary }]} numberOfLines={1}>
                          {a.friendlyName}
                        </Text>
                        {isDefault && (
                          <View
                            style={{
                              backgroundColor: theme.accentSubtle,
                              paddingHorizontal: 5,
                              paddingVertical: 1,
                              borderRadius: 3,
                              marginLeft: 6,
                            }}
                          >
                            <Text style={{ fontSize: 9, color: theme.accent, fontWeight: '700' }}>DEFAULT</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.adapterMeta, { color: theme.textTertiary }]} numberOfLines={1}>
                        {a.type} • {a.ipv4Addresses?.[0] || 'No IPv4'}
                      </Text>
                    </View>

                    {/* Network Status Badge (UP / DOWN) */}
                    <View style={styles.statusCol}>
                      <StatusBadge status={a.status} size="sm" />
                    </View>
                  </TouchableOpacity>
                );
              })}
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
    width: 440,
    maxHeight: '80%',
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    marginBottom: spacing.xs,
  },
  pickerTitle: {
    fontFamily: typography.fontFamily,
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
  closeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
  },
  adapterList: {
    maxHeight: 340,
  },
  adapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 34,
    height: 34,
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
  statusCol: {
    marginLeft: 10,
    alignItems: 'flex-end',
  },
});
