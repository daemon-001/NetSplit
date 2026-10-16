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
import { defaultIpcClient } from './services/ipcClient';

export const App: React.FC = () => {
  const currentScreen = useNetSplitStore((state) => state.currentScreen);
  const setCurrentScreen = useNetSplitStore((state) => state.setCurrentScreen);
  const themeMode = useNetSplitStore((state) => state.themeMode);
  const init = useNetSplitStore((state) => state.init);
  const refreshAll = useNetSplitStore((state) => state.refreshAll);
  const serviceConnected = useNetSplitStore((state) => state.serviceConnected);
  const systemStatus = useNetSplitStore((state) => state.systemStatus);
  const lastError = useNetSplitStore((state) => state.lastError);

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  useEffect(() => {
    init();

    // Listen for service restart events from Electron host
    if (typeof window !== 'undefined' && (window as unknown as { netSplitHost?: { onServiceRestarted?: (cb: (data: { token?: string }) => void) => void } }).netSplitHost?.onServiceRestarted) {
      (window as unknown as { netSplitHost: { onServiceRestarted: (cb: (data: { token?: string }) => void) => void } }).netSplitHost.onServiceRestarted((data) => {
        if (data?.token) {
          defaultIpcClient.setToken(data.token);
        }
        useNetSplitStore.setState({ isServiceInstalled: true, serviceConnected: true });
        refreshAll();
      });
    }

    // Listen for service uninstalled events from Electron host
    if (typeof window !== 'undefined' && (window as unknown as { netSplitHost?: { onServiceUninstalled?: (cb: () => void) => void } }).netSplitHost?.onServiceUninstalled) {
      (window as unknown as { netSplitHost: { onServiceUninstalled: (cb: () => void) => void } }).netSplitHost.onServiceUninstalled(() => {
        defaultIpcClient.setToken('');
        useNetSplitStore.setState({
          isServiceInstalled: false,
          serviceConnected: false,
          isEngineEnabled: false,
          systemStatus: null,
          rules: [],
          adapters: [],
        });
      });
    }


    // Periodic sync every 5 seconds to maintain fresh telemetry quietly in background
    const interval = setInterval(() => {
      refreshAll(false);
    }, 5000);

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

        {/* Unreachable Service Banner (if service offline and not on overview) */}
        {!serviceConnected && currentScreen !== 'overview' && (
          <View
            style={[
              styles.serviceAlert,
              {
                backgroundColor: theme.errorSubtle,
                borderBottomColor: theme.error,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              },
            ]}
          >
            <Text style={[styles.serviceAlertText, { color: theme.error, flex: 1 }]}>
              NetSplit Windows Service is currently offline. Background rules are paused.
            </Text>
            <TouchableOpacity
              onPress={() => setCurrentScreen('overview')}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                backgroundColor: theme.error,
                borderRadius: 4,
                marginLeft: 12,
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: 'bold' }}>
                Install from Overview
              </Text>
            </TouchableOpacity>
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
