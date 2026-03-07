<script lang="ts">
  import CutscenePanel from './CutscenePanel.svelte'

  interface Props {
    onComplete: () => void
  }

  const { onComplete }: Props = $props()

  const PANELS = [
    { src: '/cutscene/panel_01.png', webp: '/cutscene/panel_01.webp', caption: 'Year 2847. The surface of Earth has been unrecognizable for three centuries.' },
    { src: '/cutscene/panel_02.png', webp: '/cutscene/panel_02.webp', caption: 'Your survey vessel — and its onboard AI — were not designed for atmospheric re-entry.' },
    { src: '/cutscene/panel_03.png', webp: '/cutscene/panel_03.webp', caption: 'You survived. Somehow.' },
    { src: '/cutscene/panel_04.png', webp: '/cutscene/panel_04.webp', caption: 'G.A.I.A. systems: nominal. Crew status: you, alive. Hull status: do not ask.' },
    { src: '/cutscene/panel_05.png', webp: '/cutscene/panel_05.webp', caption: 'Somewhere underground, Earth\'s history is buried. You have a pickaxe. GAIA has a plan.' },
  ]

  let panelIndex = $state(0)
  let timer: ReturnType<typeof setTimeout> | undefined = undefined

  function advance() {
    clearTimeout(timer)
    if (panelIndex < PANELS.length - 1) {
      panelIndex++
    } else {
      onComplete()
    }
  }

  $effect(() => {
    // Re-schedule auto-advance whenever panelIndex changes
    const _idx = panelIndex
    timer = setTimeout(() => advance(), 4000)
    return () => clearTimeout(timer)
  })
</script>

<CutscenePanel
  imageSrc={PANELS[panelIndex].src}
  imageWebp={PANELS[panelIndex].webp}
  caption={PANELS[panelIndex].caption}
  onAdvance={advance}
  onSkip={onComplete}
/>
