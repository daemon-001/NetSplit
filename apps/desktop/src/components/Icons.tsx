import React from 'react';
import { View, StyleSheet } from 'react-native';

interface IconProps {
  size?: number;
  color?: string;
}

// Fluent-style clean geometric vector icons
export const OverviewIcon: React.FC<IconProps> = ({ size = 18, color = '#ffffff' }) => (
  <View style={[styles.box, { width: size, height: size }]}>
    <View style={[styles.quadrant, { borderColor: color }]} />
    <View style={[styles.quadrant, { borderColor: color }]} />
    <View style={[styles.quadrant, { borderColor: color }]} />
    <View style={[styles.quadrant, { borderColor: color }]} />
  </View>
);

export const AppsIcon: React.FC<IconProps> = ({ size = 18, color = '#ffffff' }) => (
  <View style={[styles.box, { width: size, height: size, borderWidth: 1.5, borderColor: color, borderRadius: 3 }]}>
    <View style={{ width: '60%', height: 2, backgroundColor: color, marginBottom: 2 }} />
    <View style={{ width: '80%', height: 2, backgroundColor: color }} />
  </View>
);

export const NetworkIcon: React.FC<IconProps> = ({ size = 18, color = '#ffffff' }) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <View style={{ width: size * 0.8, height: size * 0.6, borderWidth: 1.5, borderColor: color, borderRadius: 2 }} />
    <View style={{ width: 2, height: 4, backgroundColor: color }} />
    <View style={{ width: size * 0.5, height: 2, backgroundColor: color }} />
  </View>
);

export const RulesIcon: React.FC<IconProps> = ({ size = 18, color = '#ffffff' }) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <View style={{ width: size * 0.75, height: size * 0.9, borderWidth: 1.5, borderColor: color, borderRadius: 2, padding: 2 }}>
      <View style={{ width: '100%', height: 1.5, backgroundColor: color, marginBottom: 2 }} />
      <View style={{ width: '70%', height: 1.5, backgroundColor: color, marginBottom: 2 }} />
      <View style={{ width: '85%', height: 1.5, backgroundColor: color }} />
    </View>
  </View>
);

export const ActivityIcon: React.FC<IconProps> = ({ size = 18, color = '#ffffff' }) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <View style={{ width: size * 0.85, height: size * 0.85, borderRadius: size * 0.45, borderWidth: 1.5, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 1.5, height: size * 0.35, backgroundColor: color, position: 'absolute', top: 3 }} />
      <View style={{ width: size * 0.3, height: 1.5, backgroundColor: color, position: 'absolute', right: 3 }} />
    </View>
  </View>
);

export const SettingsIcon: React.FC<IconProps> = ({ size = 18, color = '#ffffff' }) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <View style={{ width: size * 0.75, height: size * 0.75, borderWidth: 1.5, borderColor: color, borderRadius: size * 0.38, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size * 0.25, height: size * 0.25, backgroundColor: color, borderRadius: size * 0.13 }} />
    </View>
  </View>
);

export const RefreshIcon: React.FC<IconProps> = ({ size = 16, color = '#ffffff' }) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <View style={{ width: size * 0.75, height: size * 0.75, borderRadius: size * 0.38, borderWidth: 1.5, borderColor: color, borderTopColor: 'transparent' }} />
  </View>
);

export const SearchIcon: React.FC<IconProps> = ({ size = 16, color = '#888888' }) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <View style={{ width: size * 0.6, height: size * 0.6, borderRadius: size * 0.3, borderWidth: 1.5, borderColor: color }} />
    <View style={{ width: 1.5, height: size * 0.35, backgroundColor: color, transform: [{ rotate: '-45deg' }], position: 'absolute', bottom: 1, right: 1 }} />
  </View>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 14, color = '#107c41' }) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <View style={{ width: 4, height: 7, borderBottomWidth: 1.8, borderRightWidth: 1.8, borderColor: color, transform: [{ rotate: '45deg' }] }} />
  </View>
);

export const AlertIcon: React.FC<IconProps> = ({ size = 14, color = '#d13438' }) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <View style={{ width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 10, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} />
  </View>
);

export const WifiIcon: React.FC<IconProps> = ({ size = 16, color = '#ffffff' }) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <View style={{ width: size * 0.8, height: size * 0.4, borderTopLeftRadius: size, borderTopRightRadius: size, borderWidth: 1.5, borderColor: color, borderBottomWidth: 0, marginBottom: 2 }} />
    <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color }} />
  </View>
);

export const EthernetIcon: React.FC<IconProps> = ({ size = 16, color = '#ffffff' }) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <View style={{ width: size * 0.75, height: size * 0.6, borderWidth: 1.5, borderColor: color, borderRadius: 2 }} />
    <View style={{ width: size * 0.4, height: 2, backgroundColor: color, marginTop: 1 }} />
  </View>
);

export const ShieldIcon: React.FC<IconProps> = ({ size = 16, color = '#1173d4' }) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <View style={{ width: size * 0.7, height: size * 0.85, borderWidth: 1.5, borderColor: color, borderBottomLeftRadius: size * 0.4, borderBottomRightRadius: size * 0.4 }} />
  </View>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 12, color = '#888888' }) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <View style={{ width: 5, height: 5, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderColor: color, transform: [{ rotate: '45deg' }] }} />
  </View>
);

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
    padding: 1,
  },
  quadrant: {
    width: '45%',
    height: '45%',
    borderWidth: 1.5,
    borderRadius: 1.5,
  },
});
