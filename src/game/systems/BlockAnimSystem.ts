// TODO: card-roguelite — removed mining dependency (stub)
/** Configuration for mote particles on block break. */
export interface MoteParticleConfig {
  tint: number
  count: number
  lifespan: number
  speed: { min: number; max: number }
  scale: { start: number; end: number }
}
