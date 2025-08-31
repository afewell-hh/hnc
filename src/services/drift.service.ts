export type { DriftResult } from './drift.browser';

export async function checkDrift() {
  const isNode = typeof window === 'undefined';
  const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  
  // Always use browser version in test environment to ensure consistency
  if (isTest || !isNode) {
    const mod = await import('./drift.browser');
    return mod.checkDrift();
  }
  
  const mod = await import('./drift.node');
  return mod.checkDrift();
}