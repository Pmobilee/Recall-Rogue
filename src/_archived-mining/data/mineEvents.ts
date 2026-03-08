/** A type of random mine event. */
export type MineEventType = 'tremor' | 'gas_leak' | 'relic_signal' | 'crystal_vein' | 'pressure_surge'

/** Represents a random mine event that can fire during a dive. */
export interface MineEvent {
  id: MineEventType
  label: string
  gaiaLine: string
  /** Whether this event adds instability. */
  instabilityDelta: number
}

/** Pool of all possible mine events. (Phase 35.7) */
export const MINE_EVENTS: MineEvent[] = [
  {
    id: 'tremor',
    label: 'Seismic Tremor',
    gaiaLine: "Micro-quake. Watch your footing.",
    instabilityDelta: 10,
  },
  {
    id: 'gas_leak',
    label: 'Gas Leak Detected',
    gaiaLine: "Methane pocket ruptured nearby. Don't breathe deep.",
    instabilityDelta: 5,
  },
  {
    id: 'relic_signal',
    label: 'Relic Signal',
    gaiaLine: "Artifact resonance detected — something valuable is close.",
    instabilityDelta: 0,
  },
  {
    id: 'crystal_vein',
    label: 'Crystal Vein Exposed',
    gaiaLine: "Crystalline deposit fracture. Enhanced yield in this sector.",
    instabilityDelta: 0,
  },
  {
    id: 'pressure_surge',
    label: 'Pressure Surge',
    gaiaLine: "Atmospheric pressure spike. O2 consumption spiking.",
    instabilityDelta: 8,
  },
]

/**
 * Get a mine event definition by its type id.
 * @param id - The event type id to look up.
 */
export function getMineEvent(id: MineEventType): MineEvent {
  return MINE_EVENTS.find(e => e.id === id)!
}
