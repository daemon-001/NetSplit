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

const OPPOSITE_STORAGE_KEY = 'netsplit_opposite_default_apps';

export const loadOppositeDefaultApps = (): string[] => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(OPPOSITE_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    }
  } catch (e) {
    // ignore
  }
  return [];
};

export const saveOppositeDefaultApps = (appIds: string[]) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(OPPOSITE_STORAGE_KEY, JSON.stringify(appIds));
    }
  } catch (e) {
    // ignore
  }
};

const FOLLOW_DEFAULT_STORAGE_KEY = 'netsplit_follow_default_apps';

export const loadFollowDefaultApps = (): string[] => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(FOLLOW_DEFAULT_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    }
  } catch (e) {
    // ignore
  }
  return [];
};

export const saveFollowDefaultApps = (appIds: string[]) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(FOLLOW_DEFAULT_STORAGE_KEY, JSON.stringify(appIds));
    }
  } catch (e) {
    // ignore
  }
};

const MASTER_ENGINE_STORAGE_KEY = 'netsplit_master_engine_enabled';

export const loadMasterEngineEnabled = (): boolean => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(MASTER_ENGINE_STORAGE_KEY);
      if (stored !== null) return stored === 'true';
    }
  } catch (e) {
    // ignore
  }
  return true;
};

export const saveMasterEngineEnabled = (enabled: boolean) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(MASTER_ENGINE_STORAGE_KEY, enabled ? 'true' : 'false');
    }
  } catch (e) {
    // ignore
  }
};

export const getDefaultAdapter = (
  adapters: NetworkAdapter[],
  defaultAdapterId?: string
): NetworkAdapter | undefined => {
  if (adapters.length === 0) return undefined;
  return (
    adapters.find((a) => a.id === defaultAdapterId) ||
    adapters.find((a) => a.isDefaultRoute) ||
    adapters.find((a) => a.type === 'WIFI' || a.type === 'ETHERNET' || a.type === 'CELLULAR') ||
    adapters[0]
  );
};

export const getOppositeAdapter = (
  adapters: NetworkAdapter[],
  defaultAdapterId?: string
): NetworkAdapter | undefined => {
  const hardwareAdapters = adapters.filter(
    (a) => a.type === 'WIFI' || a.type === 'ETHERNET' || a.type === 'CELLULAR'
  );
  if (hardwareAdapters.length === 0) return undefined;

  const effectiveDefaultId =
    defaultAdapterId ||
    adapters.find((a) => a.isDefaultRoute)?.id ||
    hardwareAdapters[0]?.id;

  // 1. Primary choice: distinct hardware adapter that is currently UP
  const upOpposite = hardwareAdapters.find(
    (a) => a.id !== effectiveDefaultId && a.status === 'UP'
  );
  if (upOpposite) return upOpposite;

  // 2. If the distinct opposite adapter is disconnected/DOWN, merge to the available active UP adapter!
  const availableUp = hardwareAdapters.find((a) => a.status === 'UP');
  if (availableUp) return availableUp;

  return hardwareAdapters.find((a) => a.id !== effectiveDefaultId);
};

export const isOppositeAdapterMerged = (
  adapters: NetworkAdapter[],
  defaultAdapterId?: string
): boolean => {
  const hardwareAdapters = adapters.filter(
    (a) => a.type === 'WIFI' || a.type === 'ETHERNET' || a.type === 'CELLULAR'
  );
  const effectiveDefaultId =
    defaultAdapterId ||
    adapters.find((a) => a.isDefaultRoute)?.id ||
    hardwareAdapters[0]?.id;

  const upOpposite = hardwareAdapters.find(
    (a) => a.id !== effectiveDefaultId && a.status === 'UP'
  );
  return !upOpposite && hardwareAdapters.some((a) => a.status === 'UP');
};

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
  oppositeDefaultAppIds: string[];
  followDefaultAppIds: string[];
  isEngineEnabled: boolean;
  pausedRuleIds: string[];

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
  toggleRuleMerge: (ruleId: string, mergeEnabled: boolean) => Promise<void>;
  bulkToggleRuleMerge: (appIds: string[], mergeEnabled: boolean) => Promise<void>;
  verifyRules: () => Promise<void>;
  syncOppositeDefaultRules: (overrideDefaultAdapterId?: string) => Promise<void>;
  syncFollowDefaultRules: (overrideDefaultAdapterId?: string) => Promise<void>;
  addManualApp: (path: string, customName?: string) => Promise<boolean>;
  updateSettings: (settings: Partial<GlobalSettings>) => Promise<void>;
  setDefaultAdapter: (adapterId: string, policy?: 'WINDOWS_DEFAULT' | 'PREFER_ADAPTER') => Promise<void>;
  toggleMasterEngine: (enabled?: boolean) => Promise<void>;
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
  oppositeDefaultAppIds: loadOppositeDefaultApps(),
  followDefaultAppIds: loadFollowDefaultApps(),
  isEngineEnabled: loadMasterEngineEnabled(),
  pausedRuleIds: [],

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
      // Derive rules from apps that have assigned adapters
      const oppositeIds = get().oppositeDefaultAppIds;
      const followDefaultIds = get().followDefaultAppIds;
      const effectiveDefaultId =
        cfg?.defaultAdapterId ||
        get().settings.defaultAdapterId ||
        adapters.find((a) => a.isDefaultRoute)?.id;
      const isOppMerged = isOppositeAdapterMerged(adapters, effectiveDefaultId);

      const appsWithDynamic = apps.map((a) => ({
        ...a,
        isOppositeDefault: oppositeIds.includes(a.id),
        isFollowDefault: followDefaultIds.includes(a.id),
        isMerged: oppositeIds.includes(a.id) ? isOppMerged : false,
      }));

      const existingRules = get().rules;
      const rules: RoutingRule[] = appsWithDynamic
        .filter((a) => a.assignedAdapterId && a.assignedAdapterId.length > 0)
        .map((a) => {
          const existingRule = existingRules.find((r) => r.applicationId === a.id);
          const fallbackMode: FallbackPolicy =
            (a as any).fallbackMode || existingRule?.fallbackMode || 'WINDOWS_DEFAULT';
          return {
            id: `rule-${a.id}`,
            applicationId: a.id,
            applicationName: a.name,
            executablePath: a.executablePath,
            adapterId: a.assignedAdapterId!,
            adapterName: a.assignedAdapterName || 'Adapter',
            isOppositeDefault: a.isOppositeDefault,
            isFollowDefault: a.isFollowDefault,
            isMerged: a.isMerged,
            enabled: a.ruleStatus !== 'INACTIVE',
            fallbackMode,
            status: a.ruleStatus || 'ACTIVE',
            createdAt: existingRule?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        });

      set((state) => ({
        serviceConnected: status !== null,
        systemStatus: status,
        isEngineEnabled:
          status?.routingEngineEnabled !== undefined
            ? status.routingEngineEnabled
            : state.isEngineEnabled,
        adapters: adapters.length > 0 ? adapters : state.adapters,
        apps: appsWithDynamic,
        rules: rules,
        activities: activity,
        settings: cfg ? cfg : state.settings,
        isLoading: false,
      }));

      // Check if any opposite-default or follow-default app is out of sync
      if (adapters.length > 0) {
        if (followDefaultIds.length > 0) {
          const targetDefault = getDefaultAdapter(adapters, effectiveDefaultId);
          if (targetDefault) {
            const needsSync = appsWithDynamic.some(
              (a) =>
                followDefaultIds.includes(a.id) &&
                a.assignedAdapterId &&
                a.assignedAdapterId !== targetDefault.id
            );
            if (needsSync) {
              get().syncFollowDefaultRules(effectiveDefaultId).catch(() => {});
            }
          }
        }

        if (oppositeIds.length > 0) {
          const targetOpposite = getOppositeAdapter(adapters, effectiveDefaultId);
          if (targetOpposite) {
            const needsSync = appsWithDynamic.some(
              (a) =>
                oppositeIds.includes(a.id) &&
                a.assignedAdapterId &&
                (a.assignedAdapterId !== targetOpposite.id || a.isMerged !== isOppMerged)
            );
            if (needsSync) {
              get().syncOppositeDefaultRules(effectiveDefaultId).catch(() => {});
            }
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ serviceConnected: false, lastError: msg, isLoading: false });
    }
  },

  assignApp: async (appId: string, adapterId: string, fallbackMode: FallbackPolicy = 'WINDOWS_DEFAULT') => {
    const { apps, adapters, rules, settings, oppositeDefaultAppIds, followDefaultAppIds } = get();
    const app = apps.find((a) => a.id === appId);
    if (!app) return;

    const isOpposite = adapterId === 'OPPOSITE_DEFAULT';
    const isFollow = adapterId === 'DEFAULT_ADAPTER';
    const effectiveDefaultId =
      settings.defaultAdapterId || adapters.find((a) => a.isDefaultRoute)?.id;

    let adapter: NetworkAdapter | undefined;
    if (isOpposite) {
      adapter = getOppositeAdapter(adapters, effectiveDefaultId);
    } else if (isFollow) {
      adapter = getDefaultAdapter(adapters, effectiveDefaultId);
    } else {
      adapter = adapters.find((a) => a.id === adapterId);
    }

    if (!adapter) {
      if (isOpposite) {
        console.warn('Cannot resolve opposite adapter: need at least 2 active network adapters');
      }
      return;
    }

    const nextOppositeIds = isOpposite
      ? Array.from(new Set([...oppositeDefaultAppIds, appId]))
      : oppositeDefaultAppIds.filter((id) => id !== appId);
    saveOppositeDefaultApps(nextOppositeIds);

    const nextFollowIds = isFollow
      ? Array.from(new Set([...followDefaultAppIds, appId]))
      : followDefaultAppIds.filter((id) => id !== appId);
    saveFollowDefaultApps(nextFollowIds);

    const isMerged = isOpposite ? isOppositeAdapterMerged(adapters, effectiveDefaultId) : false;

    // 1. Optimistic update immediately for instant UI feedback
    const prevApps = apps;
    const prevRules = rules;

    const updatedApps = apps.map((a) =>
      a.id === appId
        ? {
            ...a,
            assignedAdapterId: adapter.id,
            assignedAdapterName: adapter.friendlyName,
            isOppositeDefault: isOpposite,
            isFollowDefault: isFollow,
            isMerged,
            fallbackMode,
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
      isOppositeDefault: isOpposite,
      isFollowDefault: isFollow,
      isMerged,
      enabled: true,
      fallbackMode,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existingIdx = rules.findIndex((r) => r.applicationId === appId || r.id === ruleId);
    const updatedRules =
      existingIdx >= 0
        ? rules.map((r, i) => (i === existingIdx ? newRule : r))
        : [...rules, newRule];

    set({
      apps: updatedApps,
      rules: updatedRules,
      oppositeDefaultAppIds: nextOppositeIds,
      followDefaultAppIds: nextFollowIds,
      lastError: null,
    });

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
    const { selectedAppIds, apps, adapters, rules, settings, oppositeDefaultAppIds, followDefaultAppIds } = get();
    if (selectedAppIds.length === 0) return { succeeded: 0, failed: 0 };

    const isOpposite = adapterId === 'OPPOSITE_DEFAULT';
    const isFollow = adapterId === 'DEFAULT_ADAPTER';
    const effectiveDefaultId =
      settings.defaultAdapterId || adapters.find((a) => a.isDefaultRoute)?.id;

    let adapter: NetworkAdapter | undefined;
    if (isOpposite) {
      adapter = getOppositeAdapter(adapters, effectiveDefaultId);
    } else if (isFollow) {
      adapter = getDefaultAdapter(adapters, effectiveDefaultId);
    } else {
      adapter = adapters.find((a) => a.id === adapterId);
    }

    if (!adapter) return { succeeded: 0, failed: 0 };

    const nextOppositeIds = isOpposite
      ? Array.from(new Set([...oppositeDefaultAppIds, ...selectedAppIds]))
      : oppositeDefaultAppIds.filter((id) => !selectedAppIds.includes(id));
    saveOppositeDefaultApps(nextOppositeIds);

    const nextFollowIds = isFollow
      ? Array.from(new Set([...followDefaultAppIds, ...selectedAppIds]))
      : followDefaultAppIds.filter((id) => !selectedAppIds.includes(id));
    saveFollowDefaultApps(nextFollowIds);

    const isMerged = isOpposite ? isOppositeAdapterMerged(adapters, effectiveDefaultId) : false;

    const prevApps = apps;
    const prevRules = rules;

    // 1. Optimistic update
    const updatedApps = apps.map((a) =>
      selectedAppIds.includes(a.id)
        ? {
            ...a,
            assignedAdapterId: adapter.id,
            assignedAdapterName: adapter.friendlyName,
            isOppositeDefault: isOpposite,
            isFollowDefault: isFollow,
            isMerged,
            fallbackMode: 'WINDOWS_DEFAULT' as FallbackPolicy,
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
          isOppositeDefault: isOpposite,
          isFollowDefault: isFollow,
          isMerged,
          enabled: true,
          fallbackMode: 'WINDOWS_DEFAULT',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    set({
      apps: updatedApps,
      rules: Array.from(rulesMap.values()),
      oppositeDefaultAppIds: nextOppositeIds,
      followDefaultAppIds: nextFollowIds,
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
        fallbackMode: 'WINDOWS_DEFAULT' as FallbackPolicy,
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
    const { selectedAppIds, apps, rules, oppositeDefaultAppIds, followDefaultAppIds } = get();
    if (selectedAppIds.length === 0) return;

    const nextOppositeIds = oppositeDefaultAppIds.filter((id) => !selectedAppIds.includes(id));
    saveOppositeDefaultApps(nextOppositeIds);

    const nextFollowIds = followDefaultAppIds.filter((id) => !selectedAppIds.includes(id));
    saveFollowDefaultApps(nextFollowIds);

    const prevApps = apps;
    const prevRules = rules;

    // 1. Optimistic unassignment
    const updatedApps = apps.map((a) =>
      selectedAppIds.includes(a.id)
        ? {
            ...a,
            assignedAdapterId: undefined,
            assignedAdapterName: undefined,
            isOppositeDefault: false,
            isFollowDefault: false,
            ruleStatus: 'NONE' as RuleEnforcementStatus,
          }
        : a
    );
    const updatedRules = rules.filter((r) => !selectedAppIds.includes(r.applicationId));

    set({
      apps: updatedApps,
      rules: updatedRules,
      oppositeDefaultAppIds: nextOppositeIds,
      followDefaultAppIds: nextFollowIds,
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
    const { apps, rules, oppositeDefaultAppIds, followDefaultAppIds } = get();
    const nextOppositeIds = oppositeDefaultAppIds.filter((id) => id !== appId);
    saveOppositeDefaultApps(nextOppositeIds);

    const nextFollowIds = followDefaultAppIds.filter((id) => id !== appId);
    saveFollowDefaultApps(nextFollowIds);

    const prevApps = apps;
    const prevRules = rules;

    // 1. Optimistic removal immediately for instant feedback
    const updatedApps = apps.map((a) =>
      a.id === appId
        ? {
            ...a,
            assignedAdapterId: undefined,
            assignedAdapterName: undefined,
            isOppositeDefault: false,
            isFollowDefault: false,
            ruleStatus: 'NONE' as RuleEnforcementStatus,
          }
        : a
    );
    const updatedRules = rules.filter((r) => r.applicationId !== appId && r.id !== `rule-${appId}`);

    set({
      apps: updatedApps,
      rules: updatedRules,
      oppositeDefaultAppIds: nextOppositeIds,
      followDefaultAppIds: nextFollowIds,
      lastError: null,
    });

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

  toggleRuleMerge: async (ruleId: string, mergeEnabled: boolean) => {
    const { rules, apps, adapters, settings } = get();
    const fallbackMode: FallbackPolicy = mergeEnabled ? 'WINDOWS_DEFAULT' : 'BLOCK';
    const prevRules = rules;
    const prevApps = apps;

    const targetRule = rules.find((r) => r.id === ruleId);
    if (!targetRule) return;

    // 1. Optimistic toggle
    const updatedRules = rules.map((r) =>
      r.id === ruleId
        ? {
            ...r,
            fallbackMode,
          }
        : r
    );

    const updatedApps = apps.map((a) =>
      a.id === targetRule.applicationId
        ? {
            ...a,
            fallbackMode,
          }
        : a
    );

    set({ rules: updatedRules, apps: updatedApps, lastError: null });

    const effectiveDefaultId =
      settings.defaultAdapterId || adapters.find((a) => a.isDefaultRoute)?.id;

    let targetAdapterId = targetRule.adapterId;
    if (targetRule.isOppositeDefault) {
      const opp = getOppositeAdapter(adapters, effectiveDefaultId);
      if (opp) targetAdapterId = opp.id;
    }

    try {
      await defaultIpcClient.assignRule({
        applicationId: targetRule.applicationId,
        executablePath: targetRule.executablePath,
        applicationName: targetRule.applicationName,
        adapterId: targetAdapterId,
        fallbackMode,
      });
      get().refreshAll(false).catch(() => {});
    } catch (err: unknown) {
      set({ rules: prevRules, apps: prevApps, lastError: String(err) });
    }
  },

  bulkToggleRuleMerge: async (appIds: string[], mergeEnabled: boolean) => {
    const { rules, apps } = get();
    const fallbackMode: FallbackPolicy = mergeEnabled ? 'WINDOWS_DEFAULT' : 'BLOCK';
    const prevRules = rules;
    const prevApps = apps;

    const updatedRules = rules.map((r) =>
      appIds.includes(r.applicationId)
        ? {
            ...r,
            fallbackMode,
          }
        : r
    );

    const updatedApps = apps.map((a) =>
      appIds.includes(a.id)
        ? {
            ...a,
            fallbackMode,
          }
        : a
    );

    set({ rules: updatedRules, apps: updatedApps, lastError: null });

    try {
      for (const appId of appIds) {
        const r = rules.find((item) => item.applicationId === appId);
        if (r) {
          await defaultIpcClient.assignRule({
            applicationId: r.applicationId,
            executablePath: r.executablePath,
            applicationName: r.applicationName,
            adapterId: r.adapterId,
            fallbackMode,
          }).catch(() => {});
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

  syncOppositeDefaultRules: async (overrideDefaultAdapterId?: string) => {
    const { oppositeDefaultAppIds, apps, adapters, rules, settings } = get();
    if (oppositeDefaultAppIds.length === 0 || adapters.length === 0) return;

    const defaultId =
      overrideDefaultAdapterId ||
      settings.defaultAdapterId ||
      adapters.find((a) => a.isDefaultRoute)?.id;
    const newOpposite = getOppositeAdapter(adapters, defaultId);
    if (!newOpposite) return;

    const isMerged = isOppositeAdapterMerged(adapters, defaultId);

    // Filter apps that need updating
    const appsToUpdate = apps.filter(
      (a) =>
        oppositeDefaultAppIds.includes(a.id) &&
        (a.assignedAdapterId !== newOpposite.id || a.isMerged !== isMerged)
    );

    if (appsToUpdate.length === 0) return;

    // Optimistically update all affected apps and rules
    const updatedApps = apps.map((a) =>
      oppositeDefaultAppIds.includes(a.id)
        ? {
            ...a,
            assignedAdapterId: newOpposite.id,
            assignedAdapterName: newOpposite.friendlyName,
            isOppositeDefault: true,
            isMerged,
            ruleStatus: 'ACTIVE' as RuleEnforcementStatus,
          }
        : a
    );

    const updatedRules = rules.map((r) =>
      oppositeDefaultAppIds.includes(r.applicationId)
        ? {
            ...r,
            adapterId: newOpposite.id,
            adapterName: newOpposite.friendlyName,
            isOppositeDefault: true,
            isMerged,
          }
        : r
    );

    set({ apps: updatedApps, rules: updatedRules });

    // Send RPC assignments for each app
    for (const app of appsToUpdate) {
      try {
        const rule = rules.find((r) => r.applicationId === app.id);
        const fallbackMode = rule?.fallbackMode || 'WINDOWS_DEFAULT';
        await defaultIpcClient.assignRule({
          applicationId: app.id,
          executablePath: app.executablePath,
          applicationName: app.name,
          adapterId: newOpposite.id,
          fallbackMode,
        });
      } catch (e) {
        console.warn(`Failed to reassign opposite app ${app.name}:`, e);
      }
    }
  },

  syncFollowDefaultRules: async (overrideDefaultAdapterId?: string) => {
    const { followDefaultAppIds, apps, adapters, rules, settings } = get();
    if (followDefaultAppIds.length === 0 || adapters.length === 0) return;

    const defaultId =
      overrideDefaultAdapterId ||
      settings.defaultAdapterId ||
      adapters.find((a) => a.isDefaultRoute)?.id;
    const newDefault = getDefaultAdapter(adapters, defaultId);
    if (!newDefault) return;

    // Filter apps that need updating
    const appsToUpdate = apps.filter(
      (a) => followDefaultAppIds.includes(a.id) && a.assignedAdapterId !== newDefault.id
    );

    if (appsToUpdate.length === 0) return;

    // Optimistically update all affected apps and rules
    const updatedApps = apps.map((a) =>
      followDefaultAppIds.includes(a.id)
        ? {
            ...a,
            assignedAdapterId: newDefault.id,
            assignedAdapterName: newDefault.friendlyName,
            isFollowDefault: true,
            ruleStatus: 'ACTIVE' as RuleEnforcementStatus,
          }
        : a
    );

    const updatedRules = rules.map((r) =>
      followDefaultAppIds.includes(r.applicationId)
        ? {
            ...r,
            adapterId: newDefault.id,
            adapterName: newDefault.friendlyName,
            isFollowDefault: true,
          }
        : r
    );

    set({ apps: updatedApps, rules: updatedRules });

    // Send RPC assignments for each app
    for (const app of appsToUpdate) {
      try {
        await defaultIpcClient.assignRule({
          applicationId: app.id,
          executablePath: app.executablePath,
          applicationName: app.name,
          adapterId: newDefault.id,
          fallbackMode: 'BLOCK',
        });
      } catch (e) {
        console.warn(`Failed to reassign follow default app ${app.name}:`, e);
      }
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

    // 2. Trigger instant synchronization for all "Opposite to Default" and "Follow Default" apps!
    get().syncOppositeDefaultRules(adapterId).catch(() => {});
    get().syncFollowDefaultRules(adapterId).catch(() => {});

    // 3. Perform backend update
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

  toggleMasterEngine: async (overrideEnabled) => {
    const { serviceConnected } = get();
    if (!serviceConnected) {
      console.warn('Cannot toggle engine: NetSplit Windows Service is offline or not installed.');
      set({ isEngineEnabled: false });
      return;
    }

    const current = get().isEngineEnabled;
    const target = overrideEnabled !== undefined ? overrideEnabled : !current;
    const { rules } = get();

    // 1. Optimistic update
    saveMasterEngineEnabled(target);
    if (!target) {
      const activeIds = rules.filter((r) => r.enabled).map((r) => r.id);
      set({
        isEngineEnabled: false,
        pausedRuleIds: activeIds,
        lastError: null,
      });
    } else {
      set({
        isEngineEnabled: true,
        lastError: null,
      });
    }

    // 2. Notify backend service via IPC
    try {
      await defaultIpcClient.toggleEngine(target);
    } catch (err: unknown) {
      console.warn('IPC engine.toggle call failed, applying fallback rule toggling:', err);
      if (!target) {
        for (const rule of rules) {
          if (rule.enabled) {
            await defaultIpcClient.toggleRule(rule.id, false).catch(() => {});
          }
        }
      } else {
        const { pausedRuleIds } = get();
        for (const rule of rules) {
          if (pausedRuleIds.length === 0 || pausedRuleIds.includes(rule.id)) {
            await defaultIpcClient.toggleRule(rule.id, true).catch(() => {});
          }
        }
        set({ pausedRuleIds: [] });
      }
    }

    // 3. Refresh state to stay synchronized
    get().refreshAll(false).catch(() => {});
  },
}));
