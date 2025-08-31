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

export interface ProfileProfiles {
  endpoint: PortProfile;
  uplink: PortProfile;
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