/**
 * NetSplit IPC Client
 * Communicates with the native NetSplit Windows Service via authenticated JSON-RPC 2.0
 */

import {
  SystemStatus,
  NetworkAdapter,
  ApplicationInfo,
  RoutingRule,
  GlobalSettings,
  ActivityEvent,
  AssignRuleParams,
  BulkAssignRulesParams,
  BulkAssignResult,
  VerifyRulesResult,
  JsonRpcResponse,
} from '@netsplit/shared-types';

export class IpcClient {
  private baseUrl: string;
  private token: string | null = null;
  private reqIdCounter = 1;

  constructor(baseUrl = 'http://127.0.0.1:48192') {
    this.baseUrl = baseUrl;
  }

  public setToken(token: string) {
    this.token = token.trim();
  }

  public getToken(): string | null {
    return this.token;
  }

  private async call<T>(method: string, params?: unknown, retryOnAuth = true): Promise<T> {
    const id = `req-${this.reqIdCounter++}`;
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      params,
      ...(params && typeof params === 'object' ? (params as Record<string, unknown>) : {}),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 401 && retryOnAuth) {
          // Attempt to retrieve fresh token from host window
          if (typeof window !== 'undefined' && (window as unknown as { netSplitHost?: { getToken: () => Promise<string | null> } }).netSplitHost?.getToken) {
            const freshToken = await (window as unknown as { netSplitHost: { getToken: () => Promise<string | null> } }).netSplitHost.getToken();
            if (freshToken && freshToken !== this.token) {
              this.setToken(freshToken);
              return this.call<T>(method, params, false);
            }
          }
          throw new Error('Unauthorized: Invalid or missing IPC authentication token');
        }
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const json: JsonRpcResponse<T> = await response.json();
      if (json.error) {
        throw new Error(json.error.message || `RPC Error code: ${json.error.code}`);
      }

      return json.result as T;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`IPC Call '${method}' failed: ${msg}`);
    }
  }

  // System
  public async getStatus(): Promise<SystemStatus> {
    return this.call<SystemStatus>('system.getStatus');
  }

  // Adapters
  public async listAdapters(): Promise<NetworkAdapter[]> {
    return this.call<NetworkAdapter[]>('adapter.list');
  }

  // Applications
  public async listApps(): Promise<ApplicationInfo[]> {
    return this.call<ApplicationInfo[]>('app.list');
  }

  public async addManualApp(executablePath: string, customName?: string): Promise<{ success: boolean; applicationId: string }> {
    return this.call<{ success: boolean; applicationId: string }>('app.addManual', {
      executablePath,
      customName,
    });
  }

  // Rules
  public async assignRule(params: AssignRuleParams): Promise<{ success: boolean; ruleId: string; status: string }> {
    return this.call<{ success: boolean; ruleId: string; status: string }>('rule.assign', params);
  }

  public async bulkAssignRules(params: BulkAssignRulesParams): Promise<BulkAssignResult> {
    return this.call<BulkAssignResult>('rule.bulkAssign', params);
  }

  public async removeRule(applicationId: string): Promise<{ success: boolean }> {
    return this.call<{ success: boolean }>('rule.remove', { applicationId });
  }

  public async toggleRule(ruleId: string, enabled: boolean): Promise<{ success: boolean; enabled: boolean }> {
    return this.call<{ success: boolean; enabled: boolean }>('rule.toggle', { ruleId, enabled });
  }

  public async verifyRules(): Promise<VerifyRulesResult> {
    return this.call<VerifyRulesResult>('rule.verify');
  }

  // Configuration & Default Adapter
  public async setDefaultAdapter(
    adapterId: string,
    policy?: 'WINDOWS_DEFAULT' | 'PREFER_ADAPTER'
  ): Promise<{ success: boolean; defaultAdapterId: string; defaultRoutingPolicy: string }> {
    return this.call<{ success: boolean; defaultAdapterId: string; defaultRoutingPolicy: string }>('adapter.setDefault', {
      adapterId,
      policy,
    });
  }

  public async getConfig(): Promise<GlobalSettings> {
    return this.call<GlobalSettings>('config.get');
  }

  public async setConfig(config: Partial<GlobalSettings>): Promise<{ success: boolean }> {
    return this.call<{ success: boolean }>('config.set', config);
  }

  // Activity Log
  public async listActivity(): Promise<ActivityEvent[]> {
    return this.call<ActivityEvent[]>('activity.list');
  }
}

export const defaultIpcClient = new IpcClient();
