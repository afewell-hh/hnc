/**
 * Switch Profile Types - HNC v0.3
 * Defines TypeScript interfaces matching the exact JSON schema contract
 */

export interface PortProfile {
  portProfile: string | null;
  speedGbps: number;
}

export interface ProfilePorts {
  endpointAssignable: string[];
  fabricAssignable: string[];
}

export interface BreakoutCapability {
  /** Read-only flag indicating if port supports breakouts */
  readonly supportsBreakout: boolean;
  /** Breakout configuration (e.g., "4x25G" for 4x25Gbps lanes) */
  readonly breakoutType?: string;
  /** Multiplier for effective capacity when breakouts enabled */
  readonly capacityMultiplier?: number;
}

export interface ProfileProfiles {
  endpoint: PortProfile;
  uplink: PortProfile;
  /** Breakout capability for this switch model */
  breakout?: BreakoutCapability;
}

export interface ProfileMeta {
  source: string;
  version: string;
}

export interface SwitchProfile {
  modelId: string;
  roles: string[];
  ports: ProfilePorts;
  profiles: ProfileProfiles;
  meta: ProfileMeta;
}

export type ProfileIngestMode = 'fixture' | 'go';

export interface ProfileLoaderConfig {
  mode?: ProfileIngestMode;
  fixturesPath?: string;
  goToolPath?: string;
}

export interface ProfileLoaderResult {
  profiles: Map<string, SwitchProfile>;
  mode: ProfileIngestMode;
  loadedAt: Date;
  errors: string[];
}

/** Helper type for breakout calculations */
export interface BreakoutConfig {
  enabled: boolean;
  type?: string;
  effectiveCapacity: number;
}