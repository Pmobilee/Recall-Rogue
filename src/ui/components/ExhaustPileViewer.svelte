<script lang="ts">
  import type { Card } from '../../data/card-types';
  import CardBrowser from './CardBrowser.svelte';

  interface Props {
    /** Cards in the exhaust pile, including isRemovedFromGame Inscriptions. */
    exhaustedCards: Card[];
    /** Called when the player dismisses the viewer. */
    onDismiss: () => void;
  }

  let { exhaustedCards, onDismiss }: Props = $props();
</script>

<!--
  AR-204: ExhaustPileViewer — thin wrapper over CardBrowser in view mode.
  Shows all exhausted cards including Inscription cards marked isRemovedFromGame.
  Players can see what they've permanently played (Inscriptions) alongside normal exhausts.
-->
<CardBrowser
  cards={exhaustedCards}
  mode="view"
  title="Exhausted Cards"
  {onDismiss}
/>
