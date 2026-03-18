<script lang="ts">
  import CutscenePanel from './CutscenePanel.svelte'

  interface Props {
    onComplete: () => void
  }

  const { onComplete }: Props = $props()

  const PANELS = [
    { src: '/cutscene/panel_01.png', webp: '/cutscene/panel_01.webp', caption: 'Year 2847. No one has seen the surface in three centuries.' },
    { src: '/cutscene/panel_02.png', webp: '/cutscene/panel_02.webp', caption: 'Your survey vessel was not built for atmospheric re-entry. Neither were you.' },
    { src: '/cutscene/panel_03.png', webp: '/cutscene/panel_03.webp', caption: 'You survived.' },
    { src: '/cutscene/panel_04.png', webp: '/cutscene/panel_04.webp', caption: 'G.A.I.A. online. Hull integrity: ask again later. One survivor: you.' },
    { src: '/cutscene/panel_05.png', webp: '/cutscene/panel_05.webp', caption: 'Everything worth knowing is buried down there. GAIA remembers where.' },
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
