export type DriftResult = { 
  enabled: boolean; 
  items: Array<{ id: string; path: string }> 
};

export async function checkDrift(): Promise<DriftResult> {
  // Storybook/browser: no real FS; return disabled indicator
  return { enabled: false, items: [] };
}