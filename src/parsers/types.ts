import type { ParsedRequest, ParsedFile, HttpMethod, HttpHeader, HttpAuth } from '@/types'

export type { ParsedRequest, ParsedFile, HttpMethod, HttpHeader, HttpAuth }

export interface ParserResult {
  success: boolean
  file?: ParsedFile
  error?: string
}

export interface ParserOptions {
  fileName: string
  content: string
}

