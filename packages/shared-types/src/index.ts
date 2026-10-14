/**
 * NetSplit - Shared Type Definitions and Contracts
 * Used by Desktop UI (React Native for Windows) and Windows Service Backend
 */

export type AdapterStatus = 'UP' | 'DOWN' | 'TESTING' | 'UNKNOWN';

export type AdapterType = 
  | 'ETHERNET'
  | 'WIFI'
  | 'CELLULAR'
  | 'BLUETOOTH'
  | 'VIRTUAL'
  | 'LOOPBACK'
  | 'OTHER';

export interface NetworkAdapter {
  id: string; // Persistent GUID string or unique ID
  friendlyName: string;
  description: string;
  ifIndex: number;
  ipv6IfIndex: number;
  macAddress: string;
  status: AdapterStatus;
  type: AdapterType;
  linkSpeedBps: number; // e.g. 1000000000 for 1 Gbps
  ipv4Addresses: string[];
  ipv6Addresses: string[];
  gateways: string[];
  dnsServers: string[];
  isDefaultRoute: boolean;
  assignedAppCount: number;
  compatibilityStatus: 'SUPPORTED' | 'WARNING' | 'UNSUPPORTED';
  compatibilityNotes?: string;
}

export type ProcessStatus = 'RUNNING' | 'STOPPED' | 'MULTI_INSTANCE';

export type RuleEnforcementStatus = 
  | 'ACTIVE' 
  | 'INACTIVE' 
  | 'ERROR' 
  | 'UNVERIFIED' 
  | 'PENDING';

export interface ApplicationInfo {
  id: string; // SHA-256 or normalized key of executablePath
  name: string;
  executablePath: string;
  normalizedPath: string;
  publisher?: string;
  version?: string;
  iconBase64?: string;
  processIds: number[];
  processStatus: ProcessStatus;
  isRunning: boolean;
  isSystemProcess: boolean;
  hasVisibleWindow?: boolean;
  isGroup: boolean;
  groupMemberPaths?: string[];
  assignedAdapterId?: string;
  assignedAdapterName?: string;
  ruleStatus: RuleEnforcementStatus;
  lastError?: string;
}

export type FallbackPolicy = 'BLOCK' | 'WINDOWS_DEFAULT';

export interface RoutingRule {
  id: string;
  applicationId: string;
  applicationName: string;
  executablePath: string;
  adapterId: string;
  adapterName: string;
  enabled: boolean;
  fallbackMode: FallbackPolicy;
  status: RuleEnforcementStatus;
  lastVerifiedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export type DefaultRoutingPolicy = 'WINDOWS_DEFAULT' | 'PREFER_ADAPTER';

export interface GlobalSettings {
  defaultRoutingPolicy: DefaultRoutingPolicy;
  defaultAdapterId?: string;
  adapterDisconnectBehavior: FallbackPolicy;
  startWithWindows: boolean;
  minimizeToTray: boolean;
  enableAuditLogging: boolean;
  themeMode: 'DARK' | 'LIGHT' | 'SYSTEM';
}

export type ActivityLevel = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
export type ActivityCategory = 'ADAPTER' | 'RULE' | 'SERVICE' | 'APPLICATION' | 'SYSTEM';

export interface ActivityEvent {
  id: string;
  timestamp: string;
  level: ActivityLevel;
  category: ActivityCategory;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface SystemStatus {
  serviceRunning: boolean;
  serviceVersion: string;
  uptimeSeconds: number;
  routingEngineHealth: 'HEALTHY' | 'DEGRADED' | 'STOPPED';
  routingEngineMode: 'WFP_ALE_PROXY' | 'KERNEL_CALLOUT';
  totalAdapters: number;
  activeAdapters: number;
  assignedApplicationsCount: number;
  activeRulesCount: number;
  errorRulesCount: number;
  defaultPolicy: DefaultRoutingPolicy;
  defaultAdapterId?: string;
  isDriverInstalled: boolean;
  driverVersion?: string;
  isElevated?: boolean;
}

// JSON-RPC 2.0 Types

export interface JsonRpcRequest<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: T;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface JsonRpcNotification<T = unknown> {
  jsonrpc: '2.0';
  method: string;
  params: T;
}

// RPC Method Parameter and Result Contracts

export interface AssignRuleParams {
  applicationId: string;
  executablePath: string;
  applicationName?: string;
  adapterId: string;
  fallbackMode?: FallbackPolicy;
}

export interface BulkAssignRulesParams {
  assignments: Array<{
    applicationId: string;
    executablePath: string;
    applicationName?: string;
    adapterId: string;
    fallbackMode?: FallbackPolicy;
  }>;
}

export interface BulkAssignResult {
  succeeded: string[];
  failed: Array<{
    applicationId: string;
    error: string;
  }>;
}

export interface RemoveRuleParams {
  applicationId: string;
}

export interface VerifyRulesResult {
  totalChecked: number;
  activeCount: number;
  failedCount: number;
  results: Array<{
    ruleId: string;
    applicationId: string;
    status: RuleEnforcementStatus;
    details: string;
  }>;
}

export interface AddManualAppParams {
  executablePath: string;
  customName?: string;
}
