<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    children: Snippet
    fallback?: Snippet
  }

  let { children, fallback }: Props = $props()
  let hasError = $state(false)
  let errorMessage = $state('')

  /**
   * Expose a method so parent components or utilities can programmatically
   * trigger the error state (e.g. after catching a rejected Promise).
   *
   * Note: Svelte 5 does not have built-in error boundaries like React.
   * This component handles the error display UI; callers must catch errors
   * themselves and call `triggerError()` via a bound reference, or use
   * {#try} blocks in their templates for synchronous errors.
   */
  export function triggerError(message?: string): void {
    hasError = true
    errorMessage = message ?? ''
  }

  function retry(): void {
    hasError = false
    errorMessage = ''
  }
</script>

{#if hasError}
  {#if fallback}
    {@render fallback()}
  {:else}
    <div class="error-boundary">
      <div class="error-icon">&#9888;</div>
      <p class="error-text">Something went wrong</p>
      <p class="error-detail">{errorMessage || 'Please check your connection and try again.'}</p>
      <button class="retry-btn" type="button" onclick={retry}>
        Try Again
      </button>
    </div>
  {/if}
{:else}
  {@render children()}
{/if}

<style>
  .error-boundary {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
    color: #eee;
  }

  .error-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .error-text {
    font-size: 1.1rem;
    font-weight: bold;
    margin: 0 0 0.5rem;
  }

  .error-detail {
    font-size: 0.85rem;
    color: #aaa;
    margin: 0 0 1rem;
  }

  .retry-btn {
    background: #e94560;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 0.5rem 1.5rem;
    font-size: 0.9rem;
    cursor: pointer;
    min-height: 44px;
  }

  .retry-btn:active {
    opacity: 0.85;
  }
</style>
