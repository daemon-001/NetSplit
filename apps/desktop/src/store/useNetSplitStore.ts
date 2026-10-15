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
export type AppFilterType = 'all' | 'running' | 'foreground' | 'background' | 'assigned' | 'unassigned' | 'windows';

interface NetSplitState {
  currentScreen: ScreenType;
  themeMode: 'dark' | 'light';
  serviceConnected: boolean;
  isLoading: boolean;
  isVerifyingRules: boolean;
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
  visibleWindowTitles: string[];

  // Actions
  fetchVisibleWindows: () => Promise<void>;
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
  refreshAll: (showLoading?: boolean) => Promise<void>;
  assignApp: (appId: string, adapterId: string, fallbackMode?: FallbackPolicy) => Promise<void>;
  bulkAssign: (adapterId: string) => Promise<{ succeeded: number; failed: number }>;
  bulkUnassign: () => Promise<void>;
  removeAssignment: (appId: string) => Promise<void>;
  toggleRule: (ruleId: string, enabled: boolean) => Promise<void>;
  bulkToggleRules: (appIds: string[], enabled: boolean) => Promise<void>;
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
  isVerifyingRules: false,
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
  visibleWindowTitles: [],

  fetchVisibleWindows: async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).netSplitHost?.getVisibleWindows) {
        const windows = await (window as any).netSplitHost.getVisibleWindows();
        if (Array.isArray(windows)) {
          const titles = windows
            .map((w: { name?: string }) => (w.name || '').trim())
            .filter((t: string) => t.length > 0);
          set({ visibleWindowTitles: titles });
        }
      }
    } catch (e) {
      console.warn('Could not fetch visible windows:', e);
    }
  },

  setCurrentScreen: (screen) => set({ currentScreen: screen, selectedAppIds: [] }),
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
    // Fetch visible windows in background so it never blocks UI responsiveness
    get().fetchVisibleWindows().catch(() => {});
    await get().refreshAll(true);
  },

  refreshAll: async (showLoading = false) => {
    try {
      if (!defaultIpcClient.getToken() && typeof window !== 'undefined' && (window as unknown as { netSplitHost?: { getToken: () => Promise<string | null> } }).netSplitHost?.getToken) {
        const token = await (window as unknown as { netSplitHost: { getToken: () => Promise<string | null> } }).netSplitHost.getToken();
        if (token) {
          defaultIpcClient.setToken(token);
        }
      }
    } catch {}

    if (showLoading) {
      set({ isLoading: true, lastError: null });
    }
    try {
      // Fast parallel IPC telemetry query (without waiting on slow desktop capture)
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
          enabled: a.ruleStatus !== 'INACTIVE',
          fallbackMode: 'BLOCK',
          status: a.ruleStatus || 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

      set((state) => ({
        serviceConnected: status !== null,
        systemStatus: status,
        adapters: adapters.length > 0 ? adapters : state.adapters,
        apps: apps,
        rules: rules,
        activities: activity,
        settings: cfg ? cfg : state.settings,
        isLoading: false,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ serviceConnected: false, lastError: msg, isLoading: false });
    }
  },

  assignApp: async (appId: string, adapterId: string, fallbackMode: FallbackPolicy = 'BLOCK') => {
    const { apps, adapters, rules } = get();
    const app = apps.find((a) => a.id === appId);
    const adapter = adapters.find((a) => a.id === adapterId);
    if (!app || !adapter) return;

    // 1. Optimistic update immediately for instant UI feedback
    const prevApps = apps;
    const prevRules = rules;

    const updatedApps = apps.map((a) =>
      a.id === appId
        ? {
            ...a,
            assignedAdapterId: adapter.id,
            assignedAdapterName: adapter.friendlyName,
            ruleStatus: 'ACTIVE' as RuleEnforcementStatus,
          }
        : a
    );

    const ruleId = `rule-${appId}`;
    const newRule: RoutingRule = {
      id: ruleId,
      applicationId: app.id,
      applicationName: app.name,
      executablePath: app.executablePath,
      adapterId: adapter.id,
      adapterName: adapter.friendlyName,
      enabled: true,
      fallbackMode,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existingIdx = rules.findIndex((r) => r.applicationId === appId || r.id === ruleId);
    const updatedRules = existingIdx >= 0
      ? rules.map((r, i) => (i === existingIdx ? newRule : r))
      : [...rules, newRule];

    set({ apps: updatedApps, rules: updatedRules, lastError: null });

    // 2. Perform backend action asynchronously
    try {
      await defaultIpcClient.assignRule({
        applicationId: app.id,
        executablePath: app.executablePath,
        applicationName: app.name,
        adapterId: adapter.id,
        fallbackMode,
      });
      get().refreshAll(false).catch(() => {});
    } catch (err: unknown) {
      // Rollback on failure
      set({ apps: prevApps, rules: prevRules, lastError: String(err) });
    }
  },

  bulkAssign: async (adapterId) => {
    const { selectedAppIds, apps, adapters, rules } = get();
    const adapter = adapters.find((a) => a.id === adapterId);
    if (!adapter || selectedAppIds.length === 0) return { succeeded: 0, failed: 0 };

    const prevApps = apps;
    const prevRules = rules;

    // 1. Optimistic update
    const updatedApps = apps.map((a) =>
      selectedAppIds.includes(a.id)
        ? {
            ...a,
            assignedAdapterId: adapter.id,
            assignedAdapterName: adapter.friendlyName,
            ruleStatus: 'ACTIVE' as RuleEnforcementStatus,
          }
        : a
    );

    const rulesMap = new Map<string, RoutingRule>();
    for (const r of rules) rulesMap.set(r.applicationId, r);

    for (const id of selectedAppIds) {
      const app = apps.find((a) => a.id === id);
      if (app) {
        rulesMap.set(id, {
          id: `rule-${id}`,
          applicationId: app.id,
          applicationName: app.name,
          executablePath: app.executablePath,
          adapterId: adapter.id,
          adapterName: adapter.friendlyName,
          enabled: true,
          fallbackMode: 'BLOCK',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    set({
      apps: updatedApps,
      rules: Array.from(rulesMap.values()),
      selectedAppIds: [],
      lastError: null,
    });

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
      get().refreshAll(false).catch(() => {});
      return {
        succeeded: result.succeeded.length,
        failed: result.failed.length,
      };
    } catch (err: unknown) {
      console.warn('bulkAssign RPC failed, attempting sequential assignment fallback:', err);
      let succeededCount = 0;
      let failedCount = 0;
      for (const item of assignments) {
        try {
          await defaultIpcClient.assignRule(item);
          succeededCount++;
        } catch {
          failedCount++;
        }
      }
      get().refreshAll(false).catch(() => {});
      if (failedCount > 0 && succeededCount === 0) {
        set({ apps: prevApps, rules: prevRules, lastError: String(err) });
      }
      return { succeeded: succeededCount, failed: failedCount };
    }
  },

  bulkUnassign: async () => {
    const { selectedAppIds, apps, rules } = get();
    if (selectedAppIds.length === 0) return;

    const prevApps = apps;
    const prevRules = rules;

    // 1. Optimistic unassignment
    const updatedApps = apps.map((a) =>
      selectedAppIds.includes(a.id)
        ? {
            ...a,
            assignedAdapterId: undefined,
            assignedAdapterName: undefined,
            ruleStatus: 'NONE' as RuleEnforcementStatus,
          }
        : a
    );
    const updatedRules = rules.filter((r) => !selectedAppIds.includes(r.applicationId));

    set({
      apps: updatedApps,
      rules: updatedRules,
      selectedAppIds: [],
      lastError: null,
    });

    try {
      for (const appId of selectedAppIds) {
        await defaultIpcClient.removeRule(appId).catch(() => {});
      }
      get().refreshAll(false).catch(() => {});
    } catch (err: unknown) {
      set({ apps: prevApps, rules: prevRules, lastError: String(err) });
    }
  },

  removeAssignment: async (appId) => {
    const { apps, rules } = get();
    const prevApps = apps;
    const prevRules = rules;

    // 1. Optimistic removal immediately for instant feedback
    const updatedApps = apps.map((a) =>
      a.id === appId
        ? {
            ...a,
            assignedAdapterId: undefined,
            assignedAdapterName: undefined,
            ruleStatus: 'NONE' as RuleEnforcementStatus,
          }
        : a
    );
    const updatedRules = rules.filter((r) => r.applicationId !== appId && r.id !== `rule-${appId}`);

    set({ apps: updatedApps, rules: updatedRules, lastError: null });

    // 2. Perform backend removal asynchronously
    try {
      await defaultIpcClient.removeRule(appId);
      get().refreshAll(false).catch(() => {});
    } catch (err: unknown) {
      set({ apps: prevApps, rules: prevRules, lastError: String(err) });
    }
  },

  toggleRule: async (ruleId, enabled) => {
    const { rules, apps } = get();
    const prevRules = rules;
    const prevApps = apps;

    // 1. Optimistic toggle immediately for instant switch animation
    const updatedRules = rules.map((r) =>
      r.id === ruleId
        ? {
            ...r,
            enabled,
            status: enabled ? ('ACTIVE' as RuleEnforcementStatus) : ('INACTIVE' as RuleEnforcementStatus),
          }
        : r
    );

    const rule = rules.find((r) => r.id === ruleId);
    const updatedApps = rule
      ? apps.map((a) =>
          a.id === rule.applicationId
            ? {
                ...a,
                ruleStatus: enabled ? ('ACTIVE' as RuleEnforcementStatus) : ('INACTIVE' as RuleEnforcementStatus),
              }
            : a
        )
      : apps;

    set({ rules: updatedRules, apps: updatedApps, lastError: null });

    // 2. Perform backend toggle asynchronously
    try {
      await defaultIpcClient.toggleRule(ruleId, enabled);
      get().refreshAll(false).catch(() => {});
    } catch (err: unknown) {
      set({ rules: prevRules, apps: prevApps, lastError: String(err) });
    }
  },

  bulkToggleRules: async (appIds, enabled) => {
    const { rules, apps } = get();
    const prevRules = rules;
    const prevApps = apps;

    // 1. Optimistic toggle immediately
    const updatedRules = rules.map((r) =>
      appIds.includes(r.applicationId)
        ? {
            ...r,
            enabled,
            status: enabled ? ('ACTIVE' as RuleEnforcementStatus) : ('INACTIVE' as RuleEnforcementStatus),
          }
        : r
    );

    const updatedApps = apps.map((a) =>
      appIds.includes(a.id)
        ? {
            ...a,
            ruleStatus: enabled ? ('ACTIVE' as RuleEnforcementStatus) : ('INACTIVE' as RuleEnforcementStatus),
          }
        : a
    );

    set({ rules: updatedRules, apps: updatedApps, lastError: null });

    // 2. Perform backend toggle asynchronously
    try {
      for (const r of rules) {
        if (appIds.includes(r.applicationId)) {
          await defaultIpcClient.toggleRule(r.id, enabled).catch(() => {});
        }
      }
      get().refreshAll(false).catch(() => {});
    } catch (err: unknown) {
      set({ rules: prevRules, apps: prevApps, lastError: String(err) });
    }
  },

  verifyRules: async () => {
    set({ isVerifyingRules: true });
    try {
      await defaultIpcClient.verifyRules();
      await get().refreshAll(false);
      set({ isVerifyingRules: false });
    } catch (err: unknown) {
      set({ lastError: String(err), isVerifyingRules: false });
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
    const prevSettings = get().settings;
    // 1. Optimistic update immediately for instant switch animation
    set((state) => ({
      settings: { ...state.settings, ...settings },
      lastError: null,
    }));

    // 2. Perform backend update asynchronously
    try {
      await defaultIpcClient.setConfig(settings);
      get().refreshAll(false).catch(() => {});
    } catch (err: unknown) {
      set({ settings: prevSettings, lastError: String(err) });
    }
  },

  setDefaultAdapter: async (adapterId, policy) => {
    const prevSettings = get().settings;
    const targetPolicy = policy || (adapterId ? 'PREFER_ADAPTER' : 'WINDOWS_DEFAULT');

    // 1. Optimistic update immediately
    set((state) => ({
      settings: {
        ...state.settings,
        defaultAdapterId: adapterId || undefined,
        defaultRoutingPolicy: targetPolicy,
      },
      lastError: null,
    }));

    // 2. Perform backend update
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
      }
      get().refreshAll(false).catch(() => {});
    } catch (err: any) {
      const msg = err?.message || String(err);
      set({ settings: prevSettings, lastError: msg });
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(msg);
      }
    }
  },
}));
