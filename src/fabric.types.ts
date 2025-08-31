// Fabric Summary types for workspace management
import type { DriftStatus } from './drift/types.js'
import type { GitStatus } from './features/git.service.js'

export interface FabricSummary {
  id: string
  name: string
  status: 'draft' | 'computed' | 'saved'
  createdAt: Date
  lastModified: Date
  driftStatus?: DriftStatus | null
  gitStatus?: GitStatus | null
}

// Workspace context and events
export interface WorkspaceContext {
  fabrics: FabricSummary[]
  selectedFabricId: string | null
  errors: string[]
}

export type WorkspaceEvent =
  | { type: 'CREATE_FABRIC'; name: string }
  | { type: 'SELECT_FABRIC'; fabricId: string }
  | { type: 'DELETE_FABRIC'; fabricId: string }
  | { type: 'LIST_FABRICS' }
  | { type: 'UPDATE_FABRIC_STATUS'; fabricId: string; status: 'draft' | 'computed' | 'saved' }
  | { type: 'UPDATE_FABRIC_DRIFT'; fabricId: string; driftStatus: DriftStatus | null }
  | { type: 'UPDATE_FABRIC_GIT'; fabricId: string; gitStatus: GitStatus | null }
  | { type: 'CHECK_ALL_DRIFT' }
  | { type: 'CHECK_GIT_STATUS'; fabricId?: string }
  | { type: 'BACK_TO_LIST' }