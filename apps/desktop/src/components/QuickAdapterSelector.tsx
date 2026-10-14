import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, FlatList } from 'react-native';
import { useNetSplitStore } from '../store/useNetSplitStore';
import { darkTheme, lightTheme, typography, spacing, radii } from '../theme';
import { ChevronDownIcon, CheckIcon, WifiIcon, EthernetIcon } from './Icons';

interface QuickAdapterSelectorProps {
  applicationId: string;
  assignedAdapterId?: string;
  assignedAdapterName?: string;
}

export const QuickAdapterSelector: React.FC<QuickAdapterSelectorProps> = ({
  applicationId,
  assignedAdapterId,
  assignedAdapterName,
}) => {
  const [open, setOpen] = useState(false);

  const themeMode = useNetSplitStore((state) => state.themeMode);
  const adapters = useNetSplitStore((state) => state.adapters);
  const assignApp = useNetSplitStore((state) => state.assignApp);
  const removeAssignment = useNetSplitStore((state) => state.removeAssignment);

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  // Filter to usable hardware adapters (e.g. WiFi, Ethernet, Cellular)
  const hardwareAdapters = adapters.filter(
    (a) => a.type === 'WIFI' || a.type === 'ETHERNET' || a.type === 'CELLULAR'
  );

  const isAssigned = !!assignedAdapterId && assignedAdapterId.length > 0;
  const currentAdapter = adapters.find((a) => a.id === assignedAdapterId);

  const handleSelectAdapter = async (adapterId: string) => {
    setOpen(false);
    if (adapterId === 'UNASSIGN') {
      await removeAssignment(applicationId);
    } else {
      await assignApp(applicationId, adapterId, 'BLOCK');
    }
  };

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: isAssigned ? theme.accentSubtle : theme.surfaceSubtle,
            borderColor: isAssigned ? theme.accent : theme.border,
          },
        ]}
        onPress={() => setOpen(true)}
      >
        <Text
          style={[
            styles.buttonText,
            {
              color: isAssigned ? theme.accent : theme.textSecondary,
              fontWeight: isAssigned ? typography.weights.semibold : typography.weights.regular,
            },
          ]}
          numberOfLines={1}
        >
          {isAssigned ? (currentAdapter ? currentAdapter.friendlyName : assignedAdapterName || 'Assigned') : 'Default (Windows)'}
        </Text>
        <ChevronDownIcon size={10} color={isAssigned ? theme.accent : theme.textTertiary} />
      </TouchableOpacity>

      {/* Dropdown Modal */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View
            style={[
              styles.dropdownMenu,
              {
                backgroundColor: theme.surfaceCard,
                borderColor: theme.borderStrong,
              },
            ]}
          >
            <View style={[styles.menuHeader, { borderBottomColor: theme.borderSubtle }]}>
              <Text style={[styles.menuTitle, { color: theme.textTertiary }]}>ASSIGN NETWORK ADAPTER</Text>
            </View>

            {/* Unassign option */}
            <TouchableOpacity
              style={[
                styles.optionRow,
                {
                  backgroundColor: !isAssigned ? theme.surfaceActive : 'transparent',
                },
              ]}
              onPress={() => handleSelectAdapter('UNASSIGN')}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionName, { color: theme.textPrimary }]}>Windows Default Routing</Text>
                <Text style={[styles.optionSub, { color: theme.textTertiary }]}>Follow normal system interface metric</Text>
              </View>
              {!isAssigned && <CheckIcon size={14} color={theme.accent} />}
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

            {/* Hardware Adapters List */}
            {hardwareAdapters.map((a) => {
              const isSelected = assignedAdapterId === a.id;
              const isUp = a.status === 'UP';

              return (
                <TouchableOpacity
                  key={a.id}
                  style={[
                    styles.optionRow,
                    {
                      backgroundColor: isSelected ? theme.surfaceActive : 'transparent',
                    },
                  ]}
                  onPress={() => handleSelectAdapter(a.id)}
                >
                  <View style={styles.adapterIconBox}>
                    {a.type === 'WIFI' ? (
                      <WifiIcon size={14} color={isUp ? theme.textPrimary : theme.textTertiary} />
                    ) : (
                      <EthernetIcon size={14} color={isUp ? theme.textPrimary : theme.textTertiary} />
                    )}
                  </View>

                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={[styles.optionName, { color: theme.textPrimary, flex: 1 }]} numberOfLines={1}>
                        {a.friendlyName}
                      </Text>
                      {a.isDefaultRoute && (
                        <View style={{ backgroundColor: theme.accentSubtle, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, marginLeft: 4 }}>
                          <Text style={{ fontSize: 9, color: theme.accent, fontWeight: 'bold' }}>DEFAULT</Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: isUp ? theme.success : theme.error, marginLeft: 6 },
                        ]}
                      />
                    </View>
                    <Text style={[styles.optionSub, { color: theme.textTertiary }]} numberOfLines={1}>
                      {a.description}
                    </Text>
                    <Text style={[styles.optionSub, { color: isUp ? theme.textSecondary : theme.textTertiary, fontSize: 10 }]}>
                      {(a.ipv4Addresses && a.ipv4Addresses.length > 0) ? a.ipv4Addresses[0] : 'No IPv4'} • {a.type} • {a.status}
                    </Text>
                  </View>

                  {isSelected && <CheckIcon size={14} color={theme.accent} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.sm,
    borderWidth: 1,
    minWidth: 140,
    maxWidth: 180,
  },
  buttonText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    flex: 1,
    marginRight: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownMenu: {
    width: 320,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  menuHeader: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  menuTitle: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  adapterIconBox: {
    width: 20,
    alignItems: 'center',
  },
  optionName: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  optionSub: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    marginTop: 1,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 6,
  },
});
