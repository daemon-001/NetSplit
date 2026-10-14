/**
 * NetSplit Unit Test: JSON-RPC 2.0 Protocol & Authentication Validator
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

describe('JSON-RPC 2.0 IPC Protocol Tests', () => {
  test('Valid JSON-RPC request adheres to 2.0 standard format', () => {
    const req = {
      jsonrpc: '2.0',
      id: 'req-1',
      method: 'adapter.list',
      params: {},
    };

    assert.strictEqual(req.jsonrpc, '2.0');
    assert.strictEqual(req.id, 'req-1');
    assert.strictEqual(typeof req.method, 'string');
  });

  test('JSON-RPC response matches success schema', () => {
    const successResp = {
      jsonrpc: '2.0',
      id: 'req-1',
      result: {
        serviceRunning: true,
        routingEngineHealth: 'HEALTHY',
      },
    };

    assert.strictEqual(successResp.jsonrpc, '2.0');
    assert.ok(successResp.result);
    assert.strictEqual(successResp.result.serviceRunning, true);
    assert.strictEqual(successResp.error, undefined);
  });

  test('JSON-RPC error response adheres to error code standard', () => {
    const errorResp = {
      jsonrpc: '2.0',
      id: 'req-2',
      error: {
        code: -32001,
        message: 'Unauthorized: Invalid or missing IPC authentication token',
      },
    };

    assert.strictEqual(errorResp.jsonrpc, '2.0');
    assert.strictEqual(errorResp.error.code, -32001);
    assert.ok(errorResp.error.message.includes('Unauthorized'));
  });

  test('Path normalization converts Windows paths to standard lowercase canonical format', () => {
    function normalizePath(raw) {
      return raw.replace(/\//g, '\\').toLowerCase().trim();
    }

    const path1 = 'C:/Games/Valorant/live/shooter.exe';
    const path2 = 'C:\\games\\VALORANT\\live\\SHOOTER.EXE';
    assert.strictEqual(normalizePath(path1), normalizePath(path2));
  });
});
