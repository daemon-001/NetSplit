import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNetSplitStore } from './store/useNetSplitStore';
import { darkTheme, lightTheme, typography } from './theme';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { OverviewScreen } from './screens/OverviewScreen';
import { ApplicationsScreen } from './screens/ApplicationsScreen';
import { NetworkAdaptersScreen } from './screens/NetworkAdaptersScreen';
import { RoutingRulesScreen } from './screens/RoutingRulesScreen';
import { ActivityScreen } from './screens/ActivityScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export const App: React.FC = () => {
  const currentScreen = useNetSplitStore((state) => state.currentScreen);
  const themeMode = useNetSplitStore((state) => state.themeMode);
  const init = useNetSplitStore((state) => state.init);
  const refreshAll = useNetSplitStore((state) => state.refreshAll);
  const serviceConnected = useNetSplitStore((state) => state.serviceConnected);
  const systemStatus = useNetSplitStore((state) => state.systemStatus);
  const lastError = useNetSplitStore((state) => state.lastError);

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  useEffect(() => {
    init();

    // Periodic sync every 4 seconds to maintain fresh telemetry
    const interval = setInterval(() => {
      refreshAll();
    }, 4000);

    return () => clearInterval(interval);
  }, [init, refreshAll]);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'overview':
        return <OverviewScreen />;
      case 'apps':
        return <ApplicationsScreen />;
      case 'adapters':
        return <NetworkAdaptersScreen />;
      case 'rules':
        return <RoutingRulesScreen />;
      case 'activity':
        return <ActivityScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <OverviewScreen />;
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <View style={styles.mainContent}>
        <TopBar />

        {/* Unreachable Service Banner (if service offline) */}
        {!serviceConnected && (
          <View style={[styles.serviceAlert, { backgroundColor: theme.errorSubtle, borderBottomColor: theme.error }]}>
            <Text style={[styles.serviceAlertText, { color: theme.error }]}>
              NetSplit Service is currently offline. Background rules are paused.
              To activate routing, ensure NetSplitService.exe is running in the background.
            </Text>
          </View>
        )}



        {/* Screen Content */}
        <View style={styles.screenHost}>
          {renderScreen()}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
    width: '100%',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'column',
    height: '100%',
  },
  serviceAlert: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  serviceAlertText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  elevationAlert: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  elevationAlertText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    flex: 1,
    marginRight: 12,
  },
  elevateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 4,
  },
  screenHost: {
    flex: 1,
  },
});

export default App;
