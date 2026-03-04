<script lang="ts">
  /**
   * ReviewPromptTrigger — invisible mount component.
   * Evaluates review prompt eligibility on positive game moments and
   * fires the native in-app review prompt when conditions are met.
   * Renders nothing visible; mount in BaseView or App.svelte.
   */
  import { playerSave } from '../stores/playerData'
  import { shouldShowReviewPrompt, fireReviewPrompt } from '../../services/reviewPromptService'
  import type { ReviewState } from '../../data/types'

  interface Props {
    /** Set to true when a positive game moment occurs (streak milestone, PB dive, mastery). */
    wasPositiveMoment?: boolean
  }

  let { wasPositiveMoment = false }: Props = $props()

  $effect(() => {
    if (!wasPositiveMoment) return

    const s = $playerSave
    if (!s) return

    const masteredFacts = s.reviewStates
      ? (s.reviewStates as ReviewState[]).filter(r => r.interval >= 60).length
      : 0

    const totalDives = s.stats?.totalDivesCompleted ?? s.diveCount ?? 0

    if (shouldShowReviewPrompt({ totalDives, masteredFacts, wasPositiveMoment: true })) {
      void fireReviewPrompt()
    }
  })
</script>

<!-- Intentionally renders nothing -->
