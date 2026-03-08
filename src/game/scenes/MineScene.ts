// TODO: card-roguelite — removed mining dependency (stub)
import Phaser from 'phaser'

/** Stub MineScene — mining archived, class retained for type compatibility. */
export class MineScene extends Phaser.Scene {
  /** @stub */ sentUpItems: any[] = []
  /** @stub */ player: { gridY: number } = { gridY: 0 }

  constructor() {
    super({ key: 'MineScene' })
  }

  /** @stub */ surfaceRun(): any { return {} }
  /** @stub */ getPlayerGridPos(): { x: number; y: number } { return { x: 0, y: 0 } }
  /** @stub */ getGrid(): any[][] { return [] }
  /** @stub */ applyConsumable(..._args: any[]): void {}
  /** @stub */ markAltarUsed(..._args: any[]): void {}
  /** @stub */ addInstability(..._args: any[]): void {}
  /** @stub */ triggerSmallEarthquake(..._args: any[]): void {}
  /** @stub */ spawnRandomGasLeak(..._args: any[]): void {}
  /** @stub */ revealRelicShrines(..._args: any[]): void {}
  /** @stub */ revealNearbyMinerals(..._args: any[]): void {}
  /** @stub */ drainOxygen(..._args: any[]): void {}
  /** @stub */ resumeFromQuiz(..._args: any[]): void {}
  /** @stub */ resumeFromArtifactQuiz(..._args: any[]): void {}
  /** @stub */ resumeFromRandomQuiz(..._args: any[]): void {}
  /** @stub */ resumeFromLayerQuiz(..._args: any[]): void {}
  /** @stub */ resumeFromSendUp(..._args: any[]): void {}
  /** @stub */ resumeFromOxygenQuiz(..._args: any[]): void {}
  /** @stub */ useBomb(..._args: any[]): void {}
}
