import { parseHttpFile } from './httpParser'
import { parseBrunoFile } from './brunoParser'
import type { ParsedFile, ParserResult, ParserOptions } from './types'

export { parseHttpFile } from './httpParser'
export { parseBrunoFile } from './brunoParser'
export type { ParsedFile, ParsedRequest, ParserResult, ParserOptions } from './types'

// Auto-detect file type and parse
export function parseFile(options: ParserOptions): ParserResult {
  const { fileName, content } = options
  
  try {
    const extension = fileName.split('.').pop()?.toLowerCase()
    
    let file: ParsedFile
    
    if (extension === 'http' || extension === 'rest') {
      file = parseHttpFile(fileName, content)
    } else if (extension === 'bru') {
      file = parseBrunoFile(fileName, content)
    } else {
      return {
        success: false,
        error: `Unsupported file type: .${extension}. Supported types: .http, .rest, .bru`
      }
    }
    
    if (file.requests.length === 0) {
      return {
        success: false,
        error: 'No valid requests found in file'
      }
    }
    
    return {
      success: true,
      file
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    }
  }
}

// Read file from File object and parse
export async function parseFileFromUpload(file: File): Promise<ParserResult> {
  try {
    const content = await file.text()
    return parseFile({ fileName: file.name, content })
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read file'
    }
  }
}

