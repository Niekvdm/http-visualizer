/**
 * Presentation Modes Index
 * 
 * Registry of all available presentation modes and their factories.
 */

export * from './IPresentationMode'
export { TerminalMode } from './TerminalMode'
export { SequenceDiagramMode } from './SequenceDiagramMode'
export { NetworkTopologyMode } from './NetworkTopologyMode'
export { WaterfallMode } from './WaterfallMode'
export { PacketInspectorMode } from './PacketInspectorMode'
export { CurlMode } from './CurlMode'
export { HarTimelineMode } from './HarTimelineMode'
export { MatrixMode } from './MatrixMode'
export { BlueprintMode } from './BlueprintMode'

import type { PresentationMode } from '@/types'
import type { IPresentationMode, PresentationModeOptions, PresentationModeFactory } from './IPresentationMode'
import { TerminalMode } from './TerminalMode'
import { SequenceDiagramMode } from './SequenceDiagramMode'
import { NetworkTopologyMode } from './NetworkTopologyMode'
import { WaterfallMode } from './WaterfallMode'
import { PacketInspectorMode } from './PacketInspectorMode'
import { CurlMode } from './CurlMode'
import { HarTimelineMode } from './HarTimelineMode'
import { MatrixMode } from './MatrixMode'
import { BlueprintMode } from './BlueprintMode'

/**
 * Mode metadata for UI display
 */
export interface ModeInfo {
  id: PresentationMode
  name: string
  description: string
  icon: string // Lucide icon name
}

/**
 * Available presentation modes with metadata
 */
export const PRESENTATION_MODES: ModeInfo[] = [
  {
    id: 'dialog',
    name: 'Dialog View',
    description: 'Default view with data flow visualization',
    icon: 'LayoutDashboard',
  },
  {
    id: 'terminal',
    name: 'Terminal Mode',
    description: 'Retro CRT terminal with typing animation',
    icon: 'Terminal',
  },
  {
    id: 'sequence',
    name: 'Sequence Diagram',
    description: 'UML-style request/response timeline',
    icon: 'GitBranch',
  },
  {
    id: 'network',
    name: 'Network Topology',
    description: 'Client/server network visualization',
    icon: 'Network',
  },
  {
    id: 'waterfall',
    name: 'Waterfall',
    description: 'Chrome DevTools-style timing waterfall',
    icon: 'BarChart3',
  },
  {
    id: 'packet',
    name: 'Packet Inspector',
    description: 'Hex dump visualization of request/response',
    icon: 'Binary',
  },
  {
    id: 'curl',
    name: 'cURL',
    description: 'Equivalent cURL command with syntax highlighting',
    icon: 'SquareTerminal',
  },
  {
    id: 'har',
    name: 'HAR Timeline',
    description: 'HTTP Archive format timeline visualization',
    icon: 'Clock',
  },
  {
    id: 'matrix',
    name: 'Matrix',
    description: 'Falling character rain with data reveal',
    icon: 'Sparkles',
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    description: 'Technical schematic/CAD drawing style',
    icon: 'PenTool',
  },
]

/**
 * Registry mapping mode IDs to their factory functions
 */
const modeFactories: Partial<Record<PresentationMode, PresentationModeFactory>> = {
  terminal: (options) => new TerminalMode(options) as unknown as IPresentationMode,
  sequence: (options) => new SequenceDiagramMode(options),
  network: (options) => new NetworkTopologyMode(options),
  waterfall: (options) => new WaterfallMode(options),
  packet: (options) => new PacketInspectorMode(options),
  curl: (options) => new CurlMode(options),
  har: (options) => new HarTimelineMode(options),
  matrix: (options) => new MatrixMode(options),
  blueprint: (options) => new BlueprintMode(options),
}

/**
 * Create a presentation mode instance by ID
 * @param mode The mode ID
 * @param options Mode options
 * @returns The mode instance or null if mode is 'dialog' or not found
 */
export function createPresentationMode(
  mode: PresentationMode,
  options: PresentationModeOptions
): IPresentationMode | null {
  // 'dialog' mode uses PixiCanvas directly, not a presentation mode
  if (mode === 'dialog') {
    return null
  }

  const factory = modeFactories[mode]
  if (!factory) {
    console.warn(`Unknown presentation mode: ${mode}`)
    return null
  }

  return factory(options)
}

/**
 * Check if a mode ID is valid
 */
export function isValidMode(mode: string): mode is PresentationMode {
  return PRESENTATION_MODES.some(m => m.id === mode)
}

/**
 * Get mode info by ID
 */
export function getModeInfo(mode: PresentationMode): ModeInfo | undefined {
  return PRESENTATION_MODES.find(m => m.id === mode)
}
