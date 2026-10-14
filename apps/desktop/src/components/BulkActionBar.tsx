import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useNetSplitStore } from '../store/useNetSplitStore';
import { darkTheme, lightTheme, typography, spacing, radii } from '../theme';
import { WifiIcon, EthernetIcon } from './Icons';

export const BulkActionBar: React.FC = () => {
  const [showAdapterPicker, setShowAdapterPicker] = useState(false);

  const themeMode = useNetSplitStore((state) => state.themeMode);
  const selectedAppIds = useNetSplitStore((state) => state.selectedAppIds);
  const clearSelection = useNetSplitStore((state) => state.clearSelection);
  const adapters = useNetSplitStore((state) => state.adapters);
  const bulkAssign = useNetSplitStore((state) => state.bulkAssign);
  const bulkUnassign = useNetSplitStore((state) => state.bulkUnassign);

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
          application{selectedAppIds.length > 1 ? 's' : ''} selected
        </Text>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.btnAction, { backgroundColor: theme.accent }]}
          onPress={() => setShowAdapterPicker(true)}
        >
          <Text style={[styles.btnActionText, { color: '#ffffff' }]}>Assign to Adapter...</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnSecondary, { borderColor: theme.border, backgroundColor: theme.surfaceHover }]}
          onPress={() => bulkUnassign()}
        >
          <Text style={[styles.btnSecondaryText, { color: theme.textSecondary }]}>Remove Assignment</Text>
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
          <View style={[styles.pickerModal, { backgroundColor: theme.surfaceCard, borderColor: theme.borderStrong }]}>
            <Text style={[styles.pickerTitle, { color: theme.textPrimary }]}>
              Assign {selectedAppIds.length} Application{selectedAppIds.length > 1 ? 's' : ''} to:
            </Text>

            {hardwareAdapters.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[styles.adapterRow, { borderBottomColor: theme.borderSubtle }]}
                onPress={() => handleBulkAssign(a.id)}
              >
                <View style={styles.iconBox}>
                  {a.type === 'WIFI' ? (
                    <WifiIcon size={16} color={theme.textPrimary} />
                  ) : (
                    <EthernetIcon size={16} color={theme.textPrimary} />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.adapterName, { color: theme.textPrimary }]}>{a.friendlyName}</Text>
                  <Text style={[styles.adapterMeta, { color: theme.textTertiary }]}>
                    {a.type} • {a.status} • {a.ipv4Addresses[0] || 'No IP'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
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
    width: 360,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  pickerTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.md,
  },
  adapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 24,
    alignItems: 'center',
  },
  adapterName: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  adapterMeta: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    marginTop: 1,
  },
});
