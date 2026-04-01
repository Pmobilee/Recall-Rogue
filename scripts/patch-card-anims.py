#!/usr/bin/env python3
"""One-shot patch: remove center-screen card play animations from CardHand.svelte"""

src = '/Users/damion/CODE/Recall_Rogue/src/ui/components/CardHand.svelte'

with open(src, 'r') as f:
    content = f.read()

changes = [
    # 1. .card-reveal — remove centering, add in-place glow pulse
    (
        "  /* Reveal phase: card centers and enlarges */\n"
        "  .card-reveal {\n"
        "    position: fixed !important;\n"
        "    left: 50% !important;\n"
        "    top: 45% !important;\n"
        "    transform: translate(-50%, -50%) scale(1.8) !important;\n"
        "    z-index: 100 !important;\n"
        "    transition: all 400ms ease-in-out;\n"
        "    pointer-events: none;\n"
        "  }",
        "  /* Reveal phase: brief in-place glow pulse — card stays in hand */\n"
        "  .card-reveal {\n"
        "    pointer-events: none;\n"
        "    animation: cardRevealPulse 350ms ease-out forwards;\n"
        "  }\n"
        "  @keyframes cardRevealPulse {\n"
        "    0%   { transform: scale(1);    box-shadow: 0 0 0 rgba(255, 255, 255, 0); }\n"
        "    35%  { transform: scale(1.05); box-shadow: 0 0 calc(18px * var(--layout-scale, 1)) rgba(255, 255, 255, 0.6); }\n"
        "    100% { transform: scale(1);    box-shadow: 0 0 0 rgba(255, 255, 255, 0); opacity: 0.85; }\n"
        "  }"
    ),
    # 2. .card-swoosh base — remove centering, add fade
    (
        "  /* Swoosh base: card stays centered, type-specific pseudo-element overlays */\n"
        "  .card-swoosh {\n"
        "    position: fixed !important;\n"
        "    left: 50% !important;\n"
        "    top: 45% !important;\n"
        "    transform: translate(-50%, -50%) scale(1.8) !important;\n"
        "    z-index: 100 !important;\n"
        "    pointer-events: none;\n"
        "  }",
        "  /* Swoosh base: in-place type-specific pseudo-element overlays, card fades */\n"
        "  .card-swoosh {\n"
        "    pointer-events: none;\n"
        "    animation: cardSwooshFade 250ms ease-in forwards;\n"
        "  }\n"
        "  @keyframes cardSwooshFade {\n"
        "    0%   { opacity: 0.85; transform: scale(1); }\n"
        "    100% { opacity: 0.4;  transform: scale(0.95); }\n"
        "  }"
    ),
    # 3. .card-impact base + all type-specific variants
    (
        "  /* Impact base: card moves directionally */\n"
        "  .card-impact {\n"
        "    position: fixed !important;\n"
        "    left: 50% !important;\n"
        "    top: 45% !important;\n"
        "    z-index: 100 !important;\n"
        "    pointer-events: none;\n"
        "  }\n"
        "\n"
        "  /* Attack impact: 3D lunge toward enemy (upward) */\n"
        "  .card-impact-attack {\n"
        "    animation: impactLungeAttack 300ms ease-in-out forwards;\n"
        "  }\n"
        "  @keyframes impactLungeAttack {\n"
        "    0% { transform: translate(-50%, -50%) scale(1.8) perspective(600px) rotateX(0deg); }\n"
        "    40% { transform: translate(-50%, -55%) scale(1.9) perspective(600px) rotateX(-8deg); }\n"
        "    70% { transform: translate(-50%, -62%) scale(1.5) perspective(600px) rotateX(-14deg); opacity: 0.85; }\n"
        "    100% { transform: translate(-50%, -70%) scale(1.2) perspective(600px) rotateX(-18deg); opacity: 0.5; }\n"
        "  }\n"
        "\n"
        "  /* Shield impact: gentle protective rise */\n"
        "  .card-impact-shield {\n"
        "    animation: impactRiseShield 300ms ease-out forwards;\n"
        "  }\n"
        "  @keyframes impactRiseShield {\n"
        "    0% { transform: translate(-50%, -50%) scale(1.8); }\n"
        "    50% { transform: translate(-50%, -54%) scale(1.85); }\n"
        "    100% { transform: translate(-50%, -58%) scale(1.7); opacity: 0.6; }\n"
        "  }\n"
        "\n"
        "  /* Buff impact: power-up expand and glow */\n"
        "  .card-impact-buff {\n"
        "    animation: impactExpandBuff 300ms ease-out forwards;\n"
        "  }\n"
        "  @keyframes impactExpandBuff {\n"
        "    0% { transform: translate(-50%, -50%) scale(1.8); box-shadow: 0 0 0 rgba(255, 215, 0, 0); }\n"
        "    50% { transform: translate(-50%, -52%) scale(1.95); box-shadow: 0 0 40px rgba(255, 215, 0, 0.6); }\n"
        "    100% { transform: translate(-50%, -48%) scale(1.6); box-shadow: 0 0 0 rgba(255, 215, 0, 0); opacity: 0.5; }\n"
        "  }\n"
        "\n"
        "  /* Debuff impact: dissolve into mist toward enemy */\n"
        "  .card-impact-debuff {\n"
        "    animation: impactDissolveDebuff 300ms ease-in forwards;\n"
        "  }\n"
        "  @keyframes impactDissolveDebuff {\n"
        "    0% { transform: translate(-50%, -50%) scale(1.8); filter: blur(0); }\n"
        "    60% { transform: translate(-50%, -56%) scale(1.5); filter: blur(3px); opacity: 0.7; }\n"
        "    100% { transform: translate(-50%, -62%) scale(1.2); filter: blur(8px); opacity: 0.2; }\n"
        "  }\n"
        "\n"
        "  /* Wild impact: prismatic flash morph */\n"
        "  .card-impact-wild {\n"
        "    animation: impactMorphWild 300ms ease-in-out forwards;\n"
        "  }\n"
        "  @keyframes impactMorphWild {\n"
        "    0% { transform: translate(-50%, -50%) scale(1.8); filter: hue-rotate(0deg); }\n"
        "    50% { transform: translate(-50%, -52%) scale(1.9); filter: hue-rotate(180deg); }\n"
        "    100% { transform: translate(-50%, -55%) scale(1.5); filter: hue-rotate(360deg); opacity: 0.4; }\n"
        "  }",
        "  /* Impact base: card fades out in place — Phaser canvas owns the impact visual */\n"
        "  .card-impact {\n"
        "    pointer-events: none;\n"
        "  }\n"
        "\n"
        "  /* Attack impact: shrink-fade with slight upward drift */\n"
        "  .card-impact-attack {\n"
        "    animation: impactLungeAttack 300ms ease-in forwards;\n"
        "  }\n"
        "  @keyframes impactLungeAttack {\n"
        "    0%   { transform: scale(0.95); opacity: 0.4; }\n"
        "    100% { transform: scale(0.85) translateY(calc(-6px * var(--layout-scale, 1))); opacity: 0; }\n"
        "  }\n"
        "\n"
        "  /* Shield impact: fade out with brief border flash */\n"
        "  .card-impact-shield {\n"
        "    animation: impactRiseShield 300ms ease-out forwards;\n"
        "  }\n"
        "  @keyframes impactRiseShield {\n"
        "    0%   { transform: scale(0.95); opacity: 0.4; box-shadow: 0 0 calc(12px * var(--layout-scale, 1)) rgba(100, 180, 255, 0.5); }\n"
        "    100% { transform: scale(0.85); opacity: 0; box-shadow: 0 0 0 rgba(100, 180, 255, 0); }\n"
        "  }\n"
        "\n"
        "  /* Buff impact: fade out with golden glow */\n"
        "  .card-impact-buff {\n"
        "    animation: impactExpandBuff 300ms ease-out forwards;\n"
        "  }\n"
        "  @keyframes impactExpandBuff {\n"
        "    0%   { transform: scale(0.95); opacity: 0.4; box-shadow: 0 0 calc(14px * var(--layout-scale, 1)) rgba(255, 215, 0, 0.5); }\n"
        "    100% { transform: scale(0.85); opacity: 0; box-shadow: 0 0 0 rgba(255, 215, 0, 0); }\n"
        "  }\n"
        "\n"
        "  /* Debuff impact: dissolve blur fade */\n"
        "  .card-impact-debuff {\n"
        "    animation: impactDissolveDebuff 300ms ease-in forwards;\n"
        "  }\n"
        "  @keyframes impactDissolveDebuff {\n"
        "    0%   { transform: scale(0.95); opacity: 0.4; filter: blur(0); }\n"
        "    100% { transform: scale(0.85); opacity: 0; filter: blur(calc(6px * var(--layout-scale, 1))); }\n"
        "  }\n"
        "\n"
        "  /* Wild impact: hue-rotate fade */\n"
        "  .card-impact-wild {\n"
        "    animation: impactMorphWild 300ms ease-in-out forwards;\n"
        "  }\n"
        "  @keyframes impactMorphWild {\n"
        "    0%   { transform: scale(0.95); opacity: 0.4; filter: hue-rotate(0deg); }\n"
        "    100% { transform: scale(0.85); opacity: 0; filter: hue-rotate(90deg); }\n"
        "  }"
    ),
    # 4. .card-discard — remove position:fixed (WAAPI handles the fly from hand position)
    (
        "  /* Discard: minimize and fly to bottom-right */\n"
        "  .card-discard {\n"
        "    position: fixed !important;\n"
        "    z-index: 100 !important;\n"
        "    animation: discardMinimize 200ms ease-in forwards;\n"
        "    pointer-events: none;\n"
        "  }",
        "  /* Discard: WAAPI ghostCardAnim drives the fly-to-pile from hand position */\n"
        "  .card-discard {\n"
        "    pointer-events: none;\n"
        "  }"
    ),
    # 5. reduced-motion: card-reveal should suppress animation, not transition
    (
        "    .card-reveal {\n"
        "      transition: none;\n"
        "    }",
        "    .card-reveal {\n"
        "      animation: none !important;\n"
        "    }"
    ),
]

for old, new in changes:
    if old not in content:
        print(f"FAILED: could not find:\n{old[:80]}...")
        import sys; sys.exit(1)
    content = content.replace(old, new, 1)
    print(f"OK: replaced {old[:60].strip()!r}")

with open(src, 'w') as f:
    f.write(content)

print("\nSUCCESS: All patches applied.")
