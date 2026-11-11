import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AI_FUNCTIONS } from '../ai/ai-prompt.ts';
import { hasModule, MODULE_IDS, MODULES, modulesFor, PACKAGES } from './modules.ts';

test('MVP: każdy pakiet ma wszystkie moduły, nieznany status = darmowy', () => {
  for (const status of ['free', 'trial', 'paid', null, 'cokolwiek']) assert.deepEqual(modulesFor(status), MODULE_IDS);
});

test('moduł podstawowy jest włączony zawsze, zależny znika razem z tym, którego wymaga', () => {
  const saved = PACKAGES.free;
  try {
    (PACKAGES as Record<string, unknown>).free = ['review', 'coach'];
    assert.ok(hasModule('free', 'plan'));
    assert.ok(!hasModule('free', 'review'), 'ocena wymaga Stravy');
    assert.ok(hasModule('free', 'coach'));
    assert.ok(!hasModule('free', 'weather'));
  } finally {
    (PACKAGES as Record<string, unknown>).free = saved;
  }
});

test('każda funkcja AI należy do istniejącego modułu', () => {
  for (const fn of Object.values(AI_FUNCTIONS)) assert.ok(fn.module in MODULES, fn.label);
});
