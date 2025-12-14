/**
 * Workspace Type Definitions
 * 
 * Workspaces provide isolation for collections and environments,
 * similar to Postman/Insomnia workspaces.
 */

import type { Collection } from './collection'
import type { Environment } from './index'

/**
 * Workspace - A container for collections and environments
 */
export interface Workspace {
  id: string
  name: string
  description?: string
  /** Color for visual distinction in UI (hex color) */
  color?: string
  createdAt: number
  updatedAt: number
}

/**
 * Workspace Export Format - For exporting/importing workspaces
 */
export interface WorkspaceExport {
  version: string
  exportedAt: string
  workspace: Workspace
  collections: Collection[]
  environments: Environment[]
  activeEnvironmentId?: string | null
}

/**
 * Workspace metadata for quick display without loading full data
 */
export interface WorkspaceMetadata {
  id: string
  name: string
  description?: string
  color?: string
  collectionCount: number
  environmentCount: number
  createdAt: number
  updatedAt: number
}

/**
 * Default workspace colors for selection
 */
export const WORKSPACE_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
] as const

export type WorkspaceColor = typeof WORKSPACE_COLORS[number]
