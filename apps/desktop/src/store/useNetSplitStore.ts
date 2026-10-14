import { create } from 'zustand';
import {
  SystemStatus,
  NetworkAdapter,
  ApplicationInfo,
  RoutingRule,
  GlobalSettings,
  ActivityEvent,
  FallbackPolicy,
  RuleEnforcementStatus,
} from '@netsplit/shared-types';
import { defaultIpcClient } from '../services/ipcClient';

export type ScreenType = 'overview' | 'apps' | 'adapters' | 'rules' | 'activity' | 'settings';
export type AppFilterType = 'all' | 'running' | 'assigned' | 'unassigned';

interface NetSplitState {
  currentScreen: ScreenType;
  themeMode: 'dark' | 'light';
  serviceConnected: boolean;
  isLoading: boolean;
  lastError: string | null;

  systemStatus: SystemStatus | null;
  adapters: NetworkAdapter[];
  apps: ApplicationInfo[];
  rules: RoutingRule[];
  activities: ActivityEvent[];
  settings: GlobalSettings;

  // Search & Filters
  searchQuery: string;
  appFilter: AppFilterType;
  selectedAppIds: string[];

  // Actions
  setCurrentScreen: (screen: ScreenType) => void;
  setThemeMode: (mode: 'dark' | 'light') => void;
  toggleTheme: () => void;
  setSearchQuery: (query: string) => void;
  setAppFilter: (filter: AppFilterType) => void;
  toggleAppSelection: (appId: string) => void;
  selectAllApps: (appIds: string[]) => void;
  clearSelection: () => void;

  // Async Backend Actions
  init: () => Promise<void>;
  refreshAll: () => Promise<void>;
  assignApp: (appId: string, adapterId: string, fallbackMode?: FallbackPolicy) => Promise<void>;
  bulkAssign: (adapterId: string) => Promise<{ succeeded: number; failed: number }>;
  bulkUnassign: () => Promise<void>;
  removeAssignment: (appId: string) => Promise<void>;
  toggleRule: (ruleId: string, enabled: boolean) => Promise<void>;
  verifyRules: () => Promise<void>;
  addManualApp: (path: string, customName?: string) => Promise<boolean>;
  updateSettings: (settings: Partial<GlobalSettings>) => Promise<void>;
  setDefaultAdapter: (adapterId: string, policy?: 'WINDOWS_DEFAULT' | 'PREFER_ADAPTER') => Promise<void>;
}

export const useNetSplitStore = create<NetSplitState>((set, get) => ({
  currentScreen: 'overview',
  themeMode: 'dark',
  serviceConnected: false,
  isLoading: false,
  lastError: null,

  systemStatus: null,
  adapters: [],
  apps: [],
  rules: [],
  activities: [],
  settings: {
    defaultRoutingPolicy: 'WINDOWS_DEFAULT',
    adapterDisconnectBehavior: 'BLOCK',
    startWithWindows: true,
    minimizeToTray: true,
    enableAuditLogging: true,
    themeMode: 'DARK',
  },

  searchQuery: '',
  appFilter: 'all',
  selectedAppIds: [],

  setCurrentScreen: (screen) => set({ currentScreen: screen }),
  setThemeMode: (mode) => set({ themeMode: mode }),
  toggleTheme: () => set((state) => ({ themeMode: state.themeMode === 'dark' ? 'light' : 'dark' })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setAppFilter: (filter) => set({ appFilter: filter }),

  toggleAppSelection: (appId) =>
    set((state) => {
      const exists = state.selectedAppIds.includes(appId);
      return {
        selectedAppIds: exists
          ? state.selectedAppIds.filter((id) => id !== appId)
          : [...state.selectedAppIds, appId],
      };
    }),

  selectAllApps: (appIds) => set({ selectedAppIds: appIds }),
  clearSelection: () => set({ selectedAppIds: [] }),

  init: async () => {
    try {
      if (typeof window !== 'undefined' && (window as unknown as { netSplitHost?: { getToken: () => Promise<string | null> } }).netSplitHost?.getToken) {
        const token = await (window as unknown as { netSplitHost: { getToken: () => Promise<string | null> } }).netSplitHost.getToken();
        if (token) {
          defaultIpcClient.setToken(token);
        }
      }
    } catch (e) {
      console.warn('Could not retrieve host token:', e);
    }
    await get().refreshAll();
  },

  refreshAll: async () => {
    try {
      if (!defaultIpcClient.getToken() && typeof window !== 'undefined' && (window as unknown as { netSplitHost?: { getToken: () => Promise<string | null> } }).netSplitHost?.getToken) {
        const token = await (window as unknown as { netSplitHost: { getToken: () => Promise<string | null> } }).netSplitHost.getToken();
        if (token) {
          defaultIpcClient.setToken(token);
        }
      }
    } catch {}

    set({ isLoading: true, lastError: null });
    try {
      const [status, adapters, apps, cfg, activity] = await Promise.all([
        defaultIpcClient.getStatus().catch(() => null),
        defaultIpcClient.listAdapters().catch(() => []),
        defaultIpcClient.listApps().catch(() => []),
        defaultIpcClient.getConfig().catch(() => null),
        defaultIpcClient.listActivity().catch(() => []),
      ]);

      // Derive rules from apps that have assigned adapters
      const rules: RoutingRule[] = apps
        .filter((a) => a.assignedAdapterId && a.assignedAdapterId.length > 0)
        .map((a) => ({
          id: `rule-${a.id}`,
          applicationId: a.id,
          applicationName: a.name,
          executablePath: a.executablePath,
          adapterId: a.assignedAdapterId!,
          adapterName: a.assignedAdapterName || 'Adapter',
          enabled: true,
          fallbackMode: 'BLOCK',
          status: a.ruleStatus || 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

      set({
        serviceConnected: status !== null,
        systemStatus: status,
        adapters: adapters,
        apps: apps,
        rules: rules,
        activities: activity,
        settings: cfg ? cfg : get().settings,
        isLoading: false,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ serviceConnected: false, lastError: msg, isLoading: false });
    }
  },

  assignApp: async (appId: string, adapterId: string, fallbackMode: FallbackPolicy = 'BLOCK') => {
    const { apps, adapters } = get();
    const app = apps.find((a) => a.id === appId);
    const adapter = adapters.find((a) => a.id === adapterId);
    if (!app || !adapter) return;

    try {
      await defaultIpcClient.assignRule({
        applicationId: app.id,
        executablePath: app.executablePath,
        applicationName: app.name,
        adapterId: adapter.id,
        fallbackMode,
      });
      await get().refreshAll();
    } catch (err: unknown) {
      set({ lastError: String(err) });
    }
  },

  bulkAssign: async (adapterId) => {
    const { selectedAppIds, apps, adapters } = get();
    const adapter = adapters.find((a) => a.id === adapterId);
    if (!adapter || selectedAppIds.length === 0) return { succeeded: 0, failed: 0 };

    const assignments = selectedAppIds
      .map((id) => apps.find((a) => a.id === id))
      .filter((app): app is ApplicationInfo => !!app)
      .map((app) => ({
        applicationId: app.id,
        executablePath: app.executablePath,
        applicationName: app.name,
        adapterId: adapter.id,
        fallbackMode: 'BLOCK' as FallbackPolicy,
      }));

    try {
      const result = await defaultIpcClient.bulkAssignRules({ assignments });
      await get().refreshAll();
      set({ selectedAppIds: [] });
      return {
        succeeded: result.succeeded.length,
        failed: result.failed.length,
      };
    } catch (err: unknown) {
      set({ lastError: String(err) });
      return { succeeded: 0, failed: selectedAppIds.length };
    }
  },

  bulkUnassign: async () => {
    const { selectedAppIds } = get();
    if (selectedAppIds.length === 0) return;

    try {
      for (const appId of selectedAppIds) {
        await defaultIpcClient.removeRule(appId).catch(() => {});
      }
      await get().refreshAll();
      set({ selectedAppIds: [] });
    } catch (err: unknown) {
      set({ lastError: String(err) });
    }
  },

  removeAssignment: async (appId) => {
    try {
      await defaultIpcClient.removeRule(appId);
      await get().refreshAll();
    } catch (err: unknown) {
      set({ lastError: String(err) });
    }
  },

  toggleRule: async (ruleId, enabled) => {
    try {
      await defaultIpcClient.toggleRule(ruleId, enabled);
      await get().refreshAll();
    } catch (err: unknown) {
      set({ lastError: String(err) });
    }
  },

  verifyRules: async () => {
    set({ isLoading: true });
    try {
      await defaultIpcClient.verifyRules();
      await get().refreshAll();
    } catch (err: unknown) {
      set({ lastError: String(err), isLoading: false });
    }
  },

  addManualApp: async (path, customName) => {
    try {
      const res = await defaultIpcClient.addManualApp(path, customName);
      if (res.success) {
        await get().refreshAll();
        return true;
      }
      return false;
    } catch (err: unknown) {
      set({ lastError: String(err) });
      return false;
    }
  },

  updateSettings: async (settings) => {
    try {
      await defaultIpcClient.setConfig(settings);
      set((state) => ({
        settings: { ...state.settings, ...settings },
      }));
      await get().refreshAll();
    } catch (err: unknown) {
      set({ lastError: String(err) });
    }
  },

  setDefaultAdapter: async (adapterId, policy) => {
    try {
      const res = await defaultIpcClient.setDefaultAdapter(adapterId, policy);
      if (res.success) {
        set((state) => ({
          settings: {
            ...state.settings,
            defaultAdapterId: res.defaultAdapterId,
            defaultRoutingPolicy: res.defaultRoutingPolicy as any,
          },
          lastError: null,
        }));
        await get().refreshAll();
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      set({ lastError: msg });
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(msg);
      }
    }
  },
}));
