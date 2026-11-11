import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AI_FUNCTIONS } from '../ai/ai-prompt.ts';
import { hasModule, MODULE_IDS, MODULES, modulesFor, PACKAGES } from './modules.ts';

test('MVP: pakiety płatne mają wszystko, darmowy – wszystko poza prawdziwym trenerem; nieznany status = darmowy', () => {
  for (const status of ['trial', 'paid']) assert.deepEqual(modulesFor(status), MODULE_IDS);
  const free = MODULE_IDS.filter((id) => id !== 'coach_human');
  for (const status of ['free', null, 'cokolwiek']) assert.deepEqual(modulesFor(status), free);
  assert.ok(hasModule('free', 'coach_chat'));
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
