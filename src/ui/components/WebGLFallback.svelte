<script lang="ts">
  // Static error page — no logic needed
</script>

<div class="fallback">
  <h1>Device Not Supported</h1>
  <p>
    Recall Rogue requires WebGL, which is not available in your current browser or device.
  </p>
  <p>
    Please update your browser, or try opening the game in Chrome or Firefox.
  </p>
</div>

<style>
  .fallback {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    padding: 2rem;
    text-align: center;
    font-family: monospace;
    background: #0d0d1a;
    color: #cccccc;
  }
  h1 { color: #e94560; margin-bottom: 1rem; }
  p { max-width: 400px; line-height: 1.6; margin-bottom: 0.8rem; }
</style>
