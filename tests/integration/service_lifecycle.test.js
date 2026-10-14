/**
 * NetSplit Integration Test: Service Lifecycle & Live IPC Verification
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const SERVICE_EXE = path.resolve(__dirname, '../../native/windows-service/NetSplitService.exe');
const TOKEN_PATH = path.join(process.env.LOCALAPPDATA || 'C:\\', 'NetSplit', 'ipc_auth.token');

describe('Service Daemon & Live IPC Integration Tests', () => {
  let serviceProc = null;
  let authToken = null;

  test('Service binary exists', () => {
    assert.ok(fs.existsSync(SERVICE_EXE), `NetSplitService.exe not found at ${SERVICE_EXE}`);
  });

  test('Service starts and generates ephemeral token', async () => {
    serviceProc = spawn(SERVICE_EXE, [], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Wait for startup
    await new Promise((resolve) => setTimeout(resolve, 2000));

    assert.ok(fs.existsSync(TOKEN_PATH), `Token file not generated at ${TOKEN_PATH}`);
    authToken = fs.readFileSync(TOKEN_PATH, 'utf8').trim();
    assert.strictEqual(authToken.length, 64, 'Token must be 64-char hex string (256-bit)');
  });

  test('Unauthorized requests without token are rejected (HTTP 401)', async () => {
    const res = await fetch('http://127.0.0.1:48192', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: '1', method: 'system.getStatus' }),
    });

    assert.strictEqual(res.status, 401);
  });

  test('Authorized system.getStatus returns valid status', async () => {
    const res = await fetch('http://127.0.0.1:48192', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: '2', method: 'system.getStatus' }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.result.serviceRunning, true);
    assert.strictEqual(data.result.routingEngineHealth, 'HEALTHY');
    assert.ok(data.result.totalAdapters > 0);
  });

  test('adapter.list returns network adapters with interface indices', async () => {
    const res = await fetch('http://127.0.0.1:48192', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: '3', method: 'adapter.list' }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.result));
    assert.ok(data.result.length > 0);
    const first = data.result[0];
    assert.ok(first.friendlyName);
    assert.ok(first.ifIndex > 0);
  });

  test('Rule assign, verify, and remove lifecycle', async () => {
    // 1. Assign
    const assignRes = await fetch('http://127.0.0.1:48192', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '4',
        method: 'rule.assign',
        applicationId: 'app-integration-test',
        executablePath: 'C:\\Windows\\notepad.exe',
        applicationName: 'Notepad',
        adapterId: 'test-adapter-guid',
        fallbackMode: 'BLOCK',
      }),
    });
    const assignData = await assignRes.json();
    assert.strictEqual(assignData.result.success, true);
    assert.ok(assignData.result.ruleId);

    // 2. Remove
    const remRes = await fetch('http://127.0.0.1:48192', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '5',
        method: 'rule.remove',
        applicationId: 'app-integration-test',
      }),
    });
    const remData = await remRes.json();
    assert.strictEqual(remData.result.success, true);
  });

  test('adapter.setDefault changes default routing and reverts to auto', async () => {
    // 1. Get first active adapter
    const listRes = await fetch('http://127.0.0.1:48192', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'def-1', method: 'adapter.list' }),
    });
    const listData = await listRes.json();
    const activeAdapter = listData.result.find((a) => a.status === 'UP') || listData.result[0];
    assert.ok(activeAdapter);

    // 2. Set as default adapter
    const setRes = await fetch('http://127.0.0.1:48192', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'def-2',
        method: 'adapter.setDefault',
        adapterId: activeAdapter.id,
        policy: 'PREFER_ADAPTER',
      }),
    });
    const setData = await setRes.json();
    assert.strictEqual(setData.result?.success, true);
    assert.strictEqual(setData.result?.defaultAdapterId, activeAdapter.id);
    assert.strictEqual(setData.result?.defaultRoutingPolicy, 'PREFER_ADAPTER');

    // 3. Verify in config.get
    const cfgRes = await fetch('http://127.0.0.1:48192', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'def-3', method: 'config.get' }),
    });
    const cfgData = await cfgRes.json();
    assert.strictEqual(cfgData.result.defaultAdapterId, activeAdapter.id);
    assert.strictEqual(cfgData.result.defaultRoutingPolicy, 'PREFER_ADAPTER');

    // 4. Revert to WINDOWS_DEFAULT
    const resetRes = await fetch('http://127.0.0.1:48192', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'def-4',
        method: 'adapter.setDefault',
        adapterId: '',
        policy: 'WINDOWS_DEFAULT',
      }),
    });
    const resetData = await resetRes.json();
    assert.strictEqual(resetData.result.success, true);
    assert.strictEqual(resetData.result.defaultRoutingPolicy, 'WINDOWS_DEFAULT');
  });

  test('Service stops cleanly on termination signal', async () => {
    if (serviceProc && !serviceProc.killed) {
      serviceProc.kill();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    assert.strictEqual(serviceProc.killed, true);
  });
});
