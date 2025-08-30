import { SwitchModel, EndpointProfile } from '../types'

// Stub switch catalog as specified
const SWITCH_CATALOG: SwitchModel[] = [
  { id: 'DS2000', name: 'DataSwitch 2000', ports: 48, type: 'leaf' },
  { id: 'DS3000', name: 'DataSwitch 3000', ports: 64, type: 'spine' }
]

// Stub endpoint profiles
const ENDPOINT_PROFILES: EndpointProfile[] = [
  { id: 'standard-48', name: 'Standard 48-port', endpointCount: 48, uplinksPerEndpoint: 2 },
  { id: 'high-density-96', name: 'High Density 96-port', endpointCount: 96, uplinksPerEndpoint: 4 }
]

export class CatalogService {
  static getSwitchModel(modelId: string): SwitchModel | null {
    if (!modelId || typeof modelId !== 'string') {
      return null
    }
    return SWITCH_CATALOG.find(model => model.id === modelId) || null
  }

  static getEndpointProfile(profileId: string): EndpointProfile | null {
    if (!profileId || typeof profileId !== 'string') {
      return null
    }
    return ENDPOINT_PROFILES.find(profile => profile.id === profileId) || null
  }

  static getAllSwitchModels(): SwitchModel[] {
    return [...SWITCH_CATALOG]
  }

  static getAllEndpointProfiles(): EndpointProfile[] {
    return [...ENDPOINT_PROFILES]
  }

  static getSpineModels(): SwitchModel[] {
    return SWITCH_CATALOG.filter(model => model.type === 'spine')
  }

  static getLeafModels(): SwitchModel[] {
    return SWITCH_CATALOG.filter(model => model.type === 'leaf')
  }

  // Validation helper
  static isValidModelPair(spineId: string, leafId: string): boolean {
    const spine = this.getSwitchModel(spineId)
    const leaf = this.getSwitchModel(leafId)
    
    if (!spine || !leaf) return false
    if (spine.type !== 'spine' || leaf.type !== 'leaf') return false
    
    return true
  }
}