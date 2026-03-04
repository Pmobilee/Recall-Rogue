<script lang="ts">
  import MasteryToast from './MasteryToast.svelte'
  import type { CelebrationEvent } from '../../game/managers/CelebrationManager'

  interface Props {
    event: CelebrationEvent
    onComplete: () => void
  }

  let { event, onComplete }: Props = $props()
</script>

<!-- MilestoneCelebration is a convenience wrapper around MasteryToast for fullscreen events -->
<MasteryToast {event} {onComplete} />
