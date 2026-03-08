// TODO: card-roguelite — removed mining dependency (stub)
/** A type of random mine event. */
export type MineEventType = 'tremor' | 'gas_leak' | 'relic_signal' | 'crystal_vein' | 'pressure_surge'

/** Represents a random mine event that can fire during a dive. */
export interface MineEvent {
  id: MineEventType
  label: string
  gaiaLine: string
  instabilityDelta: number
}

/** Returns a mine event by type — stubbed after mining archival. */
export function getMineEvent(_type: MineEventType): MineEvent | undefined {
  return undefined
}
