/**
 * Collection Type Definitions
 * 
 * Focused types for request collections, folders, and related data.
 */

import type { HttpMethod, HttpHeader, BodyType } from './request'
import type { HttpAuth } from './auth'

// Collection Request (stored in a collection)
export interface CollectionRequest {
  id: string
  name: string
  method: HttpMethod
  url: string
  headers: HttpHeader[]
  body?: string
  bodyType?: BodyType
  auth?: HttpAuth
  variables?: Record<string, string>
  folderId?: string // If in a folder, reference the folder ID
  createdAt: number
  updatedAt: number
}

// Collection Folder
export interface CollectionFolder {
  id: string
  name: string
  collapsed: boolean
  auth?: HttpAuth
  createdAt: number
  updatedAt: number
}

// Collection
export interface Collection {
  id: string
  name: string
  description?: string
  folders: CollectionFolder[]
  requests: CollectionRequest[]
  variables: Record<string, string>
  collapsed: boolean
  createdAt: number
  updatedAt: number
}

// Collection Export Format
export interface CollectionExport {
  version: string
  exportedAt: string
  collections: Collection[]
  // Optional environment bundling for convenience exports
  environments?: import('./index').Environment[]
  activeEnvironmentId?: string | null
}

