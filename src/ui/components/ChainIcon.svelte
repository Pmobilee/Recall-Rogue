<script lang="ts">
  import { getChainIconPath } from '../../data/chainIcons'
  import { getChainTypeColor } from '../../data/chainTypes'

  interface Props {
    /** Chain type index (0–5). */
    chainType: number
    /** Icon size in pixels. Default: 16. */
    size?: number
    /** Optional extra CSS class. */
    class?: string
  }

  let { chainType, size = 16, class: extraClass = '' }: Props = $props()

  let iconPath = $derived(getChainIconPath(chainType))
  let iconColor = $derived(getChainTypeColor(chainType))
</script>

<!--
  ChainIcon — renders a chain-type SVG icon at a given size.
  Colour is taken directly from the chain type definition so it always matches
  the rest of the UI.  Pass `size` to scale it; defaults to 16 px.
-->
<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  class="chain-icon {extraClass}"
  aria-hidden="true"
  focusable="false"
>
  <path d={iconPath} fill={iconColor} />
</svg>

<style>
  .chain-icon {
    display: inline-block;
    vertical-align: middle;
    flex-shrink: 0;
  }
</style>
