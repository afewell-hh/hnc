export type DriftResult = { 
  enabled: boolean; 
  items: Array<{ id: string; path: string }> 
};

export async function checkDrift(): Promise<DriftResult> {
  // Node environment: placeholder for real YAML vs in-memory diff logic
  // TODO: implement actual drift detection
  return { enabled: true, items: [] };
}