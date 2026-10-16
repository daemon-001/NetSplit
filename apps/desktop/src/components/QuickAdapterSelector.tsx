import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useNetSplitStore, getOppositeAdapter, getDefaultAdapter } from '../store/useNetSplitStore';
import { darkTheme, lightTheme, typography, spacing, radii } from '../theme';
import { ChevronDownIcon, CheckIcon, WifiIcon, EthernetIcon, SwapIcon, StarIcon } from './Icons';

interface QuickAdapterSelectorProps {
  applicationId: string;
  assignedAdapterId?: string;
  assignedAdapterName?: string;
  isOppositeDefault?: boolean;
  isFollowDefault?: boolean;
}

export const QuickAdapterSelector: React.FC<QuickAdapterSelectorProps> = ({
  applicationId,
  assignedAdapterId,
  assignedAdapterName,
  isOppositeDefault: propIsOpposite,
  isFollowDefault: propIsFollow,
}) => {
  const [open, setOpen] = useState(false);

  const themeMode = useNetSplitStore((state) => state.themeMode);
  const adapters = useNetSplitStore((state) => state.adapters);
  const settings = useNetSplitStore((state) => state.settings);
  const oppositeDefaultAppIds = useNetSplitStore((state) => state.oppositeDefaultAppIds);
  const followDefaultAppIds = useNetSplitStore((state) => state.followDefaultAppIds);
  const assignApp = useNetSplitStore((state) => state.assignApp);
  const removeAssignment = useNetSplitStore((state) => state.removeAssignment);

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  // Filter to usable hardware adapters (e.g. WiFi, Ethernet, Cellular)
  const hardwareAdapters = adapters.filter(
    (a) => a.type === 'WIFI' || a.type === 'ETHERNET' || a.type === 'CELLULAR'
  );

  const isOpposite = propIsOpposite || oppositeDefaultAppIds.includes(applicationId);
  const isFollow = propIsFollow || followDefaultAppIds.includes(applicationId);
  const isAssigned = !!assignedAdapterId && assignedAdapterId.length > 0;
  const currentAdapter = adapters.find((a) => a.id === assignedAdapterId);

  const effectiveDefaultId = settings.defaultAdapterId || adapters.find((a) => a.isDefaultRoute)?.id;
  const defaultAdapter = getDefaultAdapter(adapters, effectiveDefaultId);
  const oppositeAdapter = getOppositeAdapter(adapters, effectiveDefaultId);

  const handleSelectAdapter = async (adapterId: string) => {
    setOpen(false);
    if (adapterId === 'UNASSIGN') {
      await removeAssignment(applicationId);
    } else {
      await assignApp(applicationId, adapterId, 'WINDOWS_DEFAULT');
    }
  };

  let buttonLabel = `Default (${defaultAdapter?.friendlyName || 'Auto'})`;
  if (isFollow) {
    buttonLabel = `Default (${currentAdapter ? currentAdapter.friendlyName : defaultAdapter?.friendlyName || 'Adapter'})`;
  } else if (isOpposite) {
    buttonLabel = `Opposite (${currentAdapter ? currentAdapter.friendlyName : oppositeAdapter?.friendlyName || 'Alternate'})`;
  } else if (isAssigned) {
    buttonLabel = currentAdapter ? currentAdapter.friendlyName : assignedAdapterName || 'Assigned';
  }

  const buttonBg = isFollow
    ? (themeMode === 'dark' ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5')
    : isOpposite
    ? (themeMode === 'dark' ? 'rgba(139, 92, 246, 0.15)' : '#f3e8ff')
    : isAssigned
    ? theme.accentSubtle
    : theme.surfaceSubtle;

  const buttonBorder = isFollow
    ? (themeMode === 'dark' ? '#10b981' : '#059669')
    : isOpposite
    ? (themeMode === 'dark' ? '#8b5cf6' : '#7c3aed')
    : isAssigned
    ? theme.accent
    : theme.border;

  const buttonColor = isFollow
    ? (themeMode === 'dark' ? '#6ee7b7' : '#047857')
    : isOpposite
    ? (themeMode === 'dark' ? '#c4b5fd' : '#6d28d9')
    : isAssigned
    ? theme.accent
    : theme.textSecondary;

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: buttonBg,
            borderColor: buttonBorder,
          },
        ]}
        onPress={() => setOpen(true)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 4 }}>
          {isFollow && <StarIcon size={11} color={buttonColor} style={{ marginRight: 5 }} />}
          {isOpposite && <SwapIcon size={11} color={buttonColor} style={{ marginRight: 5 }} />}
          <Text
            style={[
              styles.buttonText,
              {
                color: buttonColor,
                fontWeight: (isAssigned || isOpposite || isFollow) ? typography.weights.semibold : typography.weights.regular,
              },
            ]}
            numberOfLines={1}
          >
            {buttonLabel}
          </Text>
        </View>
        <ChevronDownIcon
          size={10}
          color={
            isFollow
              ? (themeMode === 'dark' ? '#34d399' : '#059669')
              : isOpposite
              ? (themeMode === 'dark' ? '#a78bfa' : '#7c3aed')
              : isAssigned
              ? theme.accent
              : theme.textTertiary
          }
        />
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

            {/* 1. Dynamic Default Adapter Option */}
            <TouchableOpacity
              style={[
                styles.optionRow,
                {
                  backgroundColor: (isFollow || (!isAssigned && !isOpposite))
                    ? (themeMode === 'dark' ? 'rgba(16, 185, 129, 0.18)' : '#ecfdf5')
                    : 'transparent',
                },
              ]}
              onPress={() => handleSelectAdapter('DEFAULT_ADAPTER')}
            >
              <View style={styles.adapterIconBox}>
                <StarIcon size={14} color={(isFollow || (!isAssigned && !isOpposite)) ? (themeMode === 'dark' ? '#6ee7b7' : '#059669') : theme.textSecondary} />
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text
                    style={[
                      styles.optionName,
                      {
                        color: (isFollow || (!isAssigned && !isOpposite)) ? (themeMode === 'dark' ? '#6ee7b7' : '#047857') : theme.textPrimary,
                        fontWeight: '600',
                      },
                    ]}
                  >
                    Default Adapter
                  </Text>
                  <View
                    style={{
                      backgroundColor: themeMode === 'dark' ? 'rgba(16, 185, 129, 0.25)' : '#d1fae5',
                      paddingHorizontal: 4,
                      paddingVertical: 1,
                      borderRadius: 3,
                      marginLeft: 6,
                    }}
                  >
                    <Text style={{ fontSize: 9, color: themeMode === 'dark' ? '#34d399' : '#059669', fontWeight: 'bold' }}>
                      DYNAMIC
                    </Text>
                  </View>
                </View>

                <Text style={[styles.optionSub, { color: theme.textTertiary }]} numberOfLines={1}>
                  Always routes via default connection (currently: {defaultAdapter?.friendlyName || 'Auto'})
                </Text>
              </View>

              {(isFollow || (!isAssigned && !isOpposite)) && <CheckIcon size={14} color={themeMode === 'dark' ? '#34d399' : '#059669'} />}
            </TouchableOpacity>

            {/* 2. Dynamic Opposite to Default Adapter option */}
            <TouchableOpacity
              style={[
                styles.optionRow,
                {
                  backgroundColor: isOpposite
                    ? (themeMode === 'dark' ? 'rgba(139, 92, 246, 0.18)' : '#f3e8ff')
                    : 'transparent',
                },
              ]}
              onPress={() => handleSelectAdapter('OPPOSITE_DEFAULT')}
            >
              <View style={styles.adapterIconBox}>
                <SwapIcon size={14} color={isOpposite ? (themeMode === 'dark' ? '#c4b5fd' : '#7c3aed') : theme.textSecondary} />
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text
                    style={[
                      styles.optionName,
                      {
                        color: isOpposite ? (themeMode === 'dark' ? '#c4b5fd' : '#6d28d9') : theme.textPrimary,
                        fontWeight: '600',
                      },
                    ]}
                  >
                    Opposite to Default Adapter
                  </Text>
                  <View
                    style={{
                      backgroundColor: themeMode === 'dark' ? 'rgba(139, 92, 246, 0.25)' : '#ede9fe',
                      paddingHorizontal: 4,
                      paddingVertical: 1,
                      borderRadius: 3,
                      marginLeft: 6,
                    }}
                  >
                    <Text style={{ fontSize: 9, color: themeMode === 'dark' ? '#a78bfa' : '#6d28d9', fontWeight: 'bold' }}>
                      DYNAMIC
                    </Text>
                  </View>
                </View>

                <Text style={[styles.optionSub, { color: theme.textTertiary }]} numberOfLines={1}>
                  Always routes via non-default link (currently: {oppositeAdapter?.friendlyName || 'Auto'})
                </Text>
              </View>

              {isOpposite && <CheckIcon size={14} color={themeMode === 'dark' ? '#a78bfa' : '#7c3aed'} />}
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

            <View style={{ paddingHorizontal: spacing.sm, paddingVertical: 3 }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: theme.textTertiary, letterSpacing: 0.5 }}>
                SPECIFIC ADAPTERS
              </Text>
            </View>

            {/* Hardware Adapters List */}
            {hardwareAdapters.map((a) => {
              const isSelected = !isOpposite && !isFollow && assignedAdapterId === a.id;
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
                      {((settings.defaultRoutingPolicy === 'PREFER_ADAPTER' ? settings.defaultAdapterId === a.id : a.isDefaultRoute) || a.id === effectiveDefaultId) && (
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
