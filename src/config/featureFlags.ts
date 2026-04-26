/**
 * Build-time feature flags for Recall Rogue.
 *
 * These are plain TypeScript constants. Vite tree-shakes all code behind
 * a `false` flag in the production bundle — the gated branch is excluded
 * from the shipped build, not just hidden.
 *
 * To re-enable multiplayer post-launch: set MULTIPLAYER_ENABLED = true,
 * rebuild, and redeploy. No other code changes required — every entry point
 * already reads from this file.
 */

/**
 * Gates all player-reachable multiplayer entry points for the Steam v1.0 launch.
 *
 * When false:
 * - The "Multiplayer" tent button is hidden on the hub (both landscape and portrait).
 * - The multiplayerMenu / lobbyBrowser / multiplayerLobby / triviaRound / raceResults
 *   screens are not rendered (or force-redirect to hub if currentScreen lands on them).
 * - The `?mp` URL broadcast-channel dev mode is a no-op.
 * - The lobby $effect in CardApp.svelte is skipped.
 *
 * When true: full multiplayer UI and service stack is active (production MP launch).
 */
export const MULTIPLAYER_ENABLED = false;
