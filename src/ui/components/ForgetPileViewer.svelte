<script lang="ts">
  import type { Card } from '../../data/card-types';
  import CardBrowser from './CardBrowser.svelte';

  interface Props {
    /** Cards in the forget pile, including isRemovedFromGame Inscriptions. */
    forgottenCards: Card[];
    /** Called when the player dismisses the viewer. */
    onDismiss: () => void;
  }

  let { forgottenCards, onDismiss }: Props = $props();
</script>

<!--
  AR-204: ForgetPileViewer — thin wrapper over CardBrowser in view mode.
  Shows all forgotten cards including Inscription cards marked isRemovedFromGame.
  Players can see what they've permanently played (Inscriptions) alongside normal forgets.
-->
<CardBrowser
  cards={forgottenCards}
  mode="view"
  title="Forgotten Cards"
  {onDismiss}
/>
