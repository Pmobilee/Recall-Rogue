# steamworks-rs 0.12 → 0.13 upgrade — fixes issues 059 + M-020

**Status:** research complete 2026-04-23; **not yet implemented (Red-zone approval needed).**

## TL;DR

Upgrade `src-tauri/Cargo.toml` from `steamworks = "0.12"` to `steamworks = "0.13"`. Effort ~1-2 hours. Risk low — no method-signature changes across our API surface. Fixes MP-STEAM-20260422-059 (callback handle drop) and cascading M-020 (accept() plumbing dead at runtime because callback never fires).

## The bug

`steamworks-rs` 0.12.2 `networking_messages.rs`:
```rust
pub fn session_request_callback<F>(&self, mut callback: F) where ...
{
    let call_handle = register_callback(&self.inner, move |cb: SessionRequestCallback| { ... });
    // call_handle drops at end of scope
    // CallbackHandle::Drop deregisters the callback immediately
}
```

The handle returned by `register_callback` is dropped at end of scope; `CallbackHandle::Drop` de-registers. So the callback never fires in practice — exactly what our `_session_request_callback: Option<()>` comment describes.

## The fix in 0.13.0

```rust
pub fn session_request_callback<F>(&self, mut callback: F) where ...
{
    let call_handle = register_callback(&self.inner, ...);
    std::mem::forget(call_handle);  // leak — callback stays registered forever
}
```

Same public signature. Public-facing `()` return unchanged — the fix is internal. So our `Option<()>` markers stay as-is.

## Affected callsites in our code

`src-tauri/src/steam.rs`:
- `client.networking_messages().session_request_callback(...)` — **fixed by 0.13**
- `client.networking_messages().session_failed_callback(...)` — **fixed by 0.13**
- `client.register_callback::<GameOverlayActivated|LobbyEnter|LobbyChatUpdate|P2PSessionConnectFail, _>` — unchanged across versions, we already store these correctly in `SendableCallbackHandle`.

## Breaking changes 0.12 → 0.13

- `CallbackHandle::disconnect` **removed**. We don't call it anywhere (grep confirmed). No impact.
- `Callback::SIZE` associated constant **removed**. We don't implement `Callback` ourselves. No impact.
- SDK bumped to 1.64 (from 1.58). No ABI changes in our calls.
- Transitive deps may shift slightly — `bindgen` etc. May need a fresh `cargo update` on the Windows ARM64 cross-build rig.

## API surface we rely on — all unchanged

`Client::init_app`, `run_callbacks`, `user().steam_id`, `utils().is_overlay_enabled`, all `friends().*`, all `matchmaking().*` (11 methods), `networking_messages().{send_message_to_user, receive_messages_on_channel, get_session_connection_info}`, `register_callback`. Signatures identical on docs.rs.

## Recommended path

1. Bump `steamworks = "0.12"` → `"0.13"` in `src-tauri/Cargo.toml`.
2. `cargo update -p steamworks`.
3. `cargo check --target aarch64-pc-windows-msvc` on the Windows rig.
4. Live smoke test: spawn two Steam accounts on separate machines, join a lobby, grep `~/Library/Logs/Recall Rogue/debug.log` for "SessionRequest: accepting". Currently 0 occurrences; post-upgrade should be non-zero.
5. Flip issues 059 + M-020 to `fixed` in the leaderboard once verified.

## Fallback if 0.13 regresses on Windows ARM64

`[patch.crates-io]` override pointing at a fork of 0.12.2 with `std::mem::forget(call_handle)` applied to just the two methods. Two-line patch, preserves SDK 1.58. Only use if the 0.13 path actually breaks — otherwise it's unnecessary maintenance burden.

## Why option (c) "different crate / raw FFI" is worse

No better-maintained Rust Steamworks crate exists. Raw FFI for two callbacks is strictly more code for strictly less maintainability. Skip.
