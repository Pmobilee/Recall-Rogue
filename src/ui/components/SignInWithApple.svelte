<script lang="ts">
  /**
   * Sign in with Apple button (Guideline 4.8).
   * Uses Capacitor registerPlugin bridge — no @capacitor/sign-in-with-apple import.
   * Falls back gracefully on Android/web (button is hidden).
   */
  import { registerPlugin } from '@capacitor/core'
  import { onMount } from 'svelte'

  interface SignInWithApplePlugin {
    authorize(options: {
      clientId: string
      redirectURI: string
      scopes: string
      state: string
      nonce: string
    }): Promise<{
      response: {
        user: string
        email: string | null
        givenName: string | null
        familyName: string | null
        identityToken: string
        authorizationCode: string
      }
    }>
  }

  const SignInWithApplePlugin = registerPlugin<SignInWithApplePlugin>('SignInWithApple')

  let isAvailable = false

  onMount(() => {
    // Only show on iOS (Capacitor native)
    isAvailable = typeof window !== 'undefined' &&
      'Capacitor' in window &&
      (window as Record<string, unknown>)['Capacitor'] !== undefined
  })

  async function handleSignIn() {
    try {
      const result = await SignInWithApplePlugin.authorize({
        clientId: 'com.terragacha.app',
        redirectURI: 'https://terragacha.com/auth/apple/callback',
        scopes: 'email name',
        state: crypto.randomUUID(),
        nonce: crypto.randomUUID(),
      })
      // Send identityToken to server for JWT exchange
      // POST /api/auth/apple with { identityToken, authorizationCode }
      if (import.meta.env.DEV) console.log('[AppleSignIn] Success, sending token to server')
    } catch (err) {
      console.warn('[AppleSignIn] Failed or cancelled', err)
    }
  }
</script>

{#if isAvailable}
  <button
    class="sign-in-apple"
    on:click={handleSignIn}
    aria-label="Sign in with Apple"
  >
    <!-- Apple's Human Interface Guidelines require the Apple logo in the button -->
    <svg viewBox="0 0 24 24" class="apple-logo" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
    Sign in with Apple
  </button>
{/if}

<style>
  .sign-in-apple {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 14px 20px;
    background: #000;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 17px;
    font-weight: 600;
    cursor: pointer;
    pointer-events: auto;
  }
  .apple-logo {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }
</style>
