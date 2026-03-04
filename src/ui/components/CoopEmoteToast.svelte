<!-- Co-op Emote Toast — transient toast overlay shown when a partner sends an emote.
     Listens for chat:message WebSocket events with emote: true and renders
     a 3-second fade-in/out toast above the bottom of the mine view. -->
<script lang="ts">
  import { onMount } from 'svelte'
  import { wsClient } from '../../services/wsClient'

  interface Toast {
    id: number
    text: string
    from: string
  }

  let toasts = $state<Toast[]>([])
  let nextId = 0

  onMount(() => {
    const unsub = wsClient.on('chat:message', (msg) => {
      if (!msg.payload['emote']) return
      const id = nextId++
      toasts = [...toasts, { id, text: String(msg.payload['text'] ?? ''), from: String(msg.payload['from'] ?? 'Partner') }]
      setTimeout(() => { toasts = toasts.filter(t => t.id !== id) }, 3000)
    })
    return unsub
  })
</script>

<div class="toast-container" aria-live="polite" aria-atomic="false">
  {#each toasts as toast (toast.id)}
    <div class="emote-toast">{toast.from}: {toast.text}</div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
    display: flex; flex-direction: column; gap: 4px; z-index: 120; pointer-events: none;
  }
  .emote-toast {
    background: rgba(22,33,62,0.9); color: #4ecca3; padding: 6px 14px;
    border-radius: 16px; font-size: 14px; text-align: center;
    animation: fadeInOut 3s ease forwards;
  }
  @keyframes fadeInOut {
    0%   { opacity: 0; transform: translateY(8px); }
    15%  { opacity: 1; transform: translateY(0); }
    80%  { opacity: 1; }
    100% { opacity: 0; }
  }
</style>
