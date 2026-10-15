import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { useNetSplitStore } from '../store/useNetSplitStore';
import { darkTheme, lightTheme, typography, spacing, radii } from '../theme';
import { WifiIcon, EthernetIcon } from './Icons';
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
  const bulkToggleRules = useNetSplitStore((state) => state.bulkToggleRules);

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  if (selectedAppIds.length === 0) return null;

  const hardwareAdapters = adapters.filter(
    (a) => a.type === 'WIFI' || a.type === 'ETHERNET' || a.type === 'CELLULAR'
  );

  const handleBulkAssign = async (adapterId: string) => {
    setShowAdapterPicker(false);
    await bulkAssign(adapterId);
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
              onPress={() => bulkToggleRules(selectedAppIds, true)}
            >
              <Text style={[styles.btnSecondaryText, { color: theme.success, fontWeight: '600' }]}>Enable All</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnSecondary, { borderColor: theme.border, backgroundColor: theme.surfaceHover }]}
              onPress={() => bulkToggleRules(selectedAppIds, false)}
            >
              <Text style={[styles.btnSecondaryText, { color: theme.warning, fontWeight: '600' }]}>Disable All</Text>
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
                <Text style={[styles.closeBtnText, { color: theme.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Adapters List with clear UP / DOWN Network Status */}
            <ScrollView style={styles.adapterList} showsVerticalScrollIndicator={false}>
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
