import type { RunEndData } from './runManager'

export type RunShareMethod = 'web_share' | 'download'

function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  ratio: number,
  color: string,
): void {
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fillRect(x, y, width, height)
  ctx.fillStyle = color
  ctx.fillRect(x, y, Math.max(6, Math.round(width * Math.max(0, Math.min(1, ratio)))), height)
}

export async function renderRunShareCard(summary: RunEndData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to create canvas context')

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, '#0b1323')
  gradient.addColorStop(1, '#1e293b')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = '#f8fafc'
  ctx.font = '700 72px system-ui'
  ctx.fillText('RECALL ROGUE', 80, 140)

  ctx.fillStyle = '#fbbf24'
  ctx.font = '600 44px system-ui'
  ctx.fillText(`Depth ${summary.floorReached}`, 80, 230)

  ctx.fillStyle = '#dbeafe'
  ctx.font = '500 34px system-ui'
  ctx.fillText(`Accuracy ${summary.accuracy}%`, 80, 300)

  drawBar(ctx, 80, 330, 920, 24, summary.accuracy / 100, '#22c55e')
  drawBar(ctx, 80, 390, 920, 24, Math.min(1, summary.bestCombo / 6), '#38bdf8')
  drawBar(ctx, 80, 450, 920, 24, Math.min(1, summary.factsMastered / 10), '#f59e0b')

  ctx.fillStyle = '#bfdbfe'
  ctx.font = '500 28px system-ui'
  ctx.fillText(`Combo x${summary.bestCombo}`, 80, 386)
  ctx.fillText(`Mastered +${summary.factsMastered}`, 80, 446)

  ctx.fillStyle = '#e2e8f0'
  ctx.font = '500 30px system-ui'
  ctx.fillText(`Facts answered: ${summary.factsAnswered}`, 80, 560)
  ctx.fillText(`Correct: ${summary.correctAnswers}`, 80, 610)
  ctx.fillText(`Encounters won: ${summary.encountersWon}/${summary.encountersTotal}`, 80, 660)

  if (summary.completedBounties.length > 0) {
    ctx.fillStyle = '#fde68a'
    ctx.font = '600 30px system-ui'
    ctx.fillText('Bounties Cleared', 80, 760)
    ctx.fillStyle = '#f8fafc'
    ctx.font = '500 26px system-ui'
    summary.completedBounties.slice(0, 4).forEach((name, index) => {
      ctx.fillText(`- ${name}`, 100, 810 + index * 40)
    })
  }

  ctx.fillStyle = '#93c5fd'
  ctx.font = '500 26px system-ui'
  ctx.fillText('How deep can you go?', 80, 1220)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value)
      else reject(new Error('Unable to encode run share card'))
    }, 'image/png')
  })

  return blob
}

export async function shareRunSummaryCard(summary: RunEndData): Promise<RunShareMethod> {
  const blob = await renderRunShareCard(summary)
  const filename = `recall-rogue-run-${summary.floorReached}.png`

  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean
  }

  if (typeof nav.share === 'function') {
    const file = new File([blob], filename, { type: 'image/png' })
    try {
      if (!nav.canShare || nav.canShare({ files: [file] })) {
        await nav.share({
          title: 'Recall Rogue Run',
          text: `Depth ${summary.floorReached} • Accuracy ${summary.accuracy}% • Combo x${summary.bestCombo}`,
          files: [file],
        })
      } else {
        await nav.share({
          title: 'Recall Rogue Run',
          text: `Depth ${summary.floorReached} • Accuracy ${summary.accuracy}% • Combo x${summary.bestCombo}`,
        })
      }
      return 'web_share'
    } catch {
      // Fall through to download fallback.
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
  return 'download'
}
