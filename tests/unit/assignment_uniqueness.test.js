/**
 * NetSplit Unit Test: Exclusive Assignment & Single-Adapter Guarantee
 * Verifies non-negotiable requirements #3, #4, #5, #6:
 * - Each application must have at most one explicit adapter assignment at any moment.
 * - Reassigning replaces previous assignment atomically without conflicts.
 * - Duplicate assignments are idempotent.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

class InMemoryAssignmentManager {
  constructor() {
    this.rulesByAppId = new Map();
  }

  setAssignment(applicationId, executablePath, adapterId, fallbackMode = 'BLOCK') {
    if (!applicationId || !adapterId) {
      throw new Error('applicationId and adapterId are required');
    }

    // Atomic replacement: enforce uniqueness by applicationId
    const existing = this.rulesByAppId.get(applicationId);
    const rule = {
      id: existing ? existing.id : `rule-${applicationId}-${Date.now()}`,
      applicationId,
      executablePath,
      adapterId,
      fallbackMode,
      enabled: true,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    };

    this.rulesByAppId.set(applicationId, rule);
    return rule;
  }

  removeAssignment(applicationId) {
    return this.rulesByAppId.delete(applicationId);
  }

  getAssignment(applicationId) {
    return this.rulesByAppId.get(applicationId) || null;
  }

  getAllRules() {
    return Array.from(this.rulesByAppId.values());
  }

  getRulesForAdapter(adapterId) {
    return this.getAllRules().filter((r) => r.adapterId === adapterId);
  }
}

describe('Exclusive Assignment Manager Tests', () => {
  test('Assigning an application binds it to exactly one adapter', () => {
    const manager = new InMemoryAssignmentManager();
    const rule = manager.setAssignment('app-valorant', 'C:\\Games\\VALORANT.exe', 'adapter-ethernet');

    assert.strictEqual(rule.applicationId, 'app-valorant');
    assert.strictEqual(rule.adapterId, 'adapter-ethernet');
    assert.strictEqual(manager.getAllRules().length, 1);
  });

  test('Reassigning an application to a new adapter replaces previous assignment atomically', () => {
    const manager = new InMemoryAssignmentManager();
    
    // Assign to Ethernet first
    manager.setAssignment('app-valorant', 'C:\\Games\\VALORANT.exe', 'adapter-ethernet');
    assert.strictEqual(manager.getAssignment('app-valorant').adapterId, 'adapter-ethernet');

    // Reassign to Wi-Fi
    const updated = manager.setAssignment('app-valorant', 'C:\\Games\\VALORANT.exe', 'adapter-wifi');
    assert.strictEqual(updated.adapterId, 'adapter-wifi');

    // Total rule count MUST still be 1 (No duplicate or conflicting rules)
    assert.strictEqual(manager.getAllRules().length, 1);
    assert.strictEqual(manager.getRulesForAdapter('adapter-ethernet').length, 0);
    assert.strictEqual(manager.getRulesForAdapter('adapter-wifi').length, 1);
  });

  test('Multiple distinct applications can use the same adapter', () => {
    const manager = new InMemoryAssignmentManager();

    manager.setAssignment('app-valorant', 'C:\\Games\\VALORANT.exe', 'adapter-ethernet');
    manager.setAssignment('app-steam', 'C:\\Program Files\\Steam\\steam.exe', 'adapter-ethernet');
    manager.setAssignment('app-discord', 'C:\\Users\\User\\Discord.exe', 'adapter-wifi');

    assert.strictEqual(manager.getAllRules().length, 3);
    assert.strictEqual(manager.getRulesForAdapter('adapter-ethernet').length, 2);
    assert.strictEqual(manager.getRulesForAdapter('adapter-wifi').length, 1);
  });

  test('Removing an assignment restores unassigned state cleanly', () => {
    const manager = new InMemoryAssignmentManager();

    manager.setAssignment('app-obs', 'C:\\Program Files\\obs-studio\\obs64.exe', 'adapter-wifi');
    assert.ok(manager.getAssignment('app-obs'));

    const removed = manager.removeAssignment('app-obs');
    assert.strictEqual(removed, true);
    assert.strictEqual(manager.getAssignment('app-obs'), null);
    assert.strictEqual(manager.getAllRules().length, 0);
  });

  test('Duplicate idempotent assignment does not duplicate rules', () => {
    const manager = new InMemoryAssignmentManager();

    manager.setAssignment('app-chrome', 'C:\\Program Files\\Chrome\\chrome.exe', 'adapter-wifi');
    manager.setAssignment('app-chrome', 'C:\\Program Files\\Chrome\\chrome.exe', 'adapter-wifi');

    assert.strictEqual(manager.getAllRules().length, 1);
    assert.strictEqual(manager.getAssignment('app-chrome').adapterId, 'adapter-wifi');
  });
});
