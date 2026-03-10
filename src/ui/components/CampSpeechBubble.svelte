<script lang="ts">
  interface Props {
    text: string
    visible: boolean
    top: string
    left: string
  }

  let { text, visible, top, left }: Props = $props()
</script>

{#if visible}
  <div
    class="speech-bubble"
    style="position: absolute; top: {top}; left: {left}; transform: translate(-50%, -100%);"
  >
    <span class="bubble-text">{text}</span>
  </div>
{/if}

<style>
  .speech-bubble {
    z-index: 60;
    background: rgba(20, 20, 30, 0.9);
    color: #fff;
    border-radius: 8px;
    padding: 6px 10px;
    font-size: 12px;
    max-width: 120px;
    text-align: center;
    pointer-events: none;
    animation: bubble-fade-in 200ms ease-out;
  }

  .speech-bubble::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid rgba(20, 20, 30, 0.9);
  }

  .bubble-text {
    line-height: 1.3;
  }

  @keyframes bubble-fade-in {
    from {
      opacity: 0;
      transform: translate(-50%, -90%);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -100%);
    }
  }
</style>
