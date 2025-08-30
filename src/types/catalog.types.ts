/**
 * HNC Catalog Types
 * Type definitions for switch models and catalog data
 */

export type SwitchType = 'leaf' | 'spine';

export type PortSpeed = '10G' | '25G' | '100G' | '400G';

export interface SwitchPort {
  readonly id: string;
  readonly speed: PortSpeed;
  readonly type: 'ethernet' | 'fiber';
}

export interface SwitchModel {
  readonly id: string;
  readonly name: string;
  readonly type: SwitchType;
  readonly ports: readonly SwitchPort[];
  readonly maxPorts: number;
  readonly supportedSpeeds: readonly PortSpeed[];
  readonly manufacturer: string;
  readonly series: string;
}

export interface CatalogData {
  readonly switches: readonly SwitchModel[];
  readonly version: string;
  readonly lastUpdated: string;
}

export interface CatalogService {
  loadCatalog(): Promise<CatalogData>;
  getSwitchModel(id: string): Promise<SwitchModel | null>;
  validateModelId(id: string): Promise<boolean>;
  getAllSwitchModels(): Promise<readonly SwitchModel[]>;
  getSwitchesByType(type: SwitchType): Promise<readonly SwitchModel[]>;
}

export class CatalogError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'CatalogError';
  }
}

export class ModelNotFoundError extends CatalogError {
  constructor(modelId: string) {
    super(
      `Switch model not found: ${modelId}`,
      'MODEL_NOT_FOUND',
      { modelId }
    );
  }
}