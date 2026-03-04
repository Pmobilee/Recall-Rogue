<script lang="ts">
  interface Props {
    onComplete: (interests: string[], weights: Record<string, number>) => void
  }

  const { onComplete }: Props = $props()

  type Phase = 'talking' | 'selecting' | 'reacting'

  const LINES = [
    "Oh! You survived! I was running crash-recovery diagnostics for seventeen minutes. That's a new record. For surviving, I mean — not for worrying.",
    "I'm GAIA. Geological Analytical Intelligence Assistant. I contain approximately 2.3 terabytes of Earth's accumulated knowledge — most of it intact, some of it... corrupted. Your job is to dig up artifacts so I can rebuild what I've lost.",
    "But first — I need to calibrate my fact-weighting algorithm. Before the crash, what were you most interested in?",
  ]

  const INTERESTS = [
    { label: 'Historian', categories: ['History'] },
    { label: 'Geologist', categories: ['Natural Sciences', 'Geography'] },
    { label: 'Linguist', categories: ['Language'] },
    { label: 'Scientist', categories: ['Natural Sciences', 'Technology'] },
    { label: 'Naturalist', categories: ['Life Sciences'] },
    { label: 'Explorer', categories: ['Geography', 'Culture'] },
    { label: 'Generalist', categories: [] },
  ]

  const REACTIONS: Record<string, string> = {
    Historian: "A historian! Oh, I have centuries of suppressed archaeological records in my databanks. They tried to bury some of this history. Ironic that you'll now dig it back up.",
    Geologist: "A geologist! The mineral strata under this crash site alone would make your jaw drop. 300 million years of compression, right below your feet.",
    Linguist: "A linguist! I have partial records of 847 extinct languages. Some died before anyone thought to record them. We might be the last ones who can reconstruct them.",
    Scientist: "A scientist! Good. I need someone who won't panic when the facts get counterintuitive. And they will get counterintuitive.",
    Naturalist: "A naturalist! The fossils down there — some of the creatures buried in this rock haven't been seen in 65 million years. We could bring one back.",
    Explorer: "An explorer! Perfect. The descent shafts go down 20 layers. Nobody has mapped what's at the bottom. Nobody human, anyway.",
    Generalist: "A generalist! My favorite kind. The people who know a little about everything are always the most dangerous in a crisis. This qualifies as a crisis.",
  }

  let phase = $state<Phase>('talking')
  let visibleLines = $state(0)
  let selected = $state<string[]>([])
  let reactionStep = $state(0)

  // Auto-advance talking lines
  $effect(() => {
    if (phase !== 'talking') return
    if (visibleLines >= LINES.length) {
      phase = 'selecting'
      return
    }
    const delay = visibleLines === 0 ? 2000 : 3000
    const t = setTimeout(() => { visibleLines++ }, delay)
    return () => clearTimeout(t)
  })

  // Show first line immediately after a moment
  $effect(() => {
    if (visibleLines === 0 && phase === 'talking') {
      const t = setTimeout(() => { visibleLines = 1 }, 500)
      return () => clearTimeout(t)
    }
  })

  function toggleInterest(label: string) {
    if (label === 'Generalist') {
      selected = ['Generalist']
    } else {
      selected = selected.filter(s => s !== 'Generalist')
      if (selected.includes(label)) {
        selected = selected.filter(s => s !== label)
      } else {
        selected = [...selected, label]
      }
    }
  }

  function handleContinue() {
    phase = 'reacting'
    reactionStep = 0
    // Auto-advance reaction steps
    setTimeout(() => { reactionStep = 1 }, 4000)
    setTimeout(() => { finalize() }, 7000)
  }

  function handleSkip() {
    onComplete(['Generalist'], {})
  }

  function finalize() {
    const weights: Record<string, number> = {}
    if (!selected.includes('Generalist')) {
      for (const s of selected) {
        const def = INTERESTS.find(i => i.label === s)
        if (def) {
          for (const cat of def.categories) {
            weights[cat] = 1.5
          }
        }
      }
    }
    onComplete([...selected], weights)
  }

  function advanceTalking() {
    if (phase === 'talking' && visibleLines < LINES.length) {
      visibleLines = Math.min(visibleLines + 1, LINES.length)
    }
  }

  const firstSelected = $derived(selected[0] ?? 'Generalist')
  const reactionText = $derived(REACTIONS[firstSelected] ?? REACTIONS.Generalist)
</script>

<div class="gaia-intro" role="region" aria-label="GAIA Introduction">
  <button class="skip-btn" onclick={handleSkip}>Skip</button>

  <div class="gaia-avatar">
    <div class="gaia-icon">G</div>
    <span class="gaia-label">G.A.I.A.</span>
  </div>

  <div class="dialogue-area">
    {#if phase === 'talking'}
      {#each LINES.slice(0, visibleLines) as line, i}
        <div class="speech-bubble" class:latest={i === visibleLines - 1}>
          <p>{line}</p>
        </div>
      {/each}
      {#if visibleLines < LINES.length}
        <button class="tap-continue" onclick={advanceTalking}>Tap to continue</button>
      {/if}

    {:else if phase === 'selecting'}
      <div class="speech-bubble">
        <p>{LINES[2]}</p>
      </div>
      <div class="interest-grid">
        {#each INTERESTS as interest}
          <button
            class="interest-pill"
            class:active={selected.includes(interest.label)}
            onclick={() => toggleInterest(interest.label)}
          >
            {interest.label}
          </button>
        {/each}
      </div>
      {#if selected.length > 0}
        <button class="continue-btn" onclick={handleContinue}>Continue</button>
      {/if}

    {:else if phase === 'reacting'}
      <div class="speech-bubble">
        <p>{reactionText}</p>
      </div>
      {#if reactionStep >= 1}
        <div class="speech-bubble">
          <p>Perfect. I'll prioritize those areas in my artifact analysis. Now — there's a pickaxe in the emergency kit. Let's see what's buried under this crash site.</p>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .gaia-intro {
    position: fixed;
    inset: 0;
    background: #0a0a12;
    display: flex;
    flex-direction: column;
    padding: 1rem;
    z-index: 100;
    overflow-y: auto;
    pointer-events: auto;
  }

  .skip-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid #555;
    color: #aaa;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    min-width: 44px;
    min-height: 44px;
    font-family: monospace;
    z-index: 10;
  }

  .gaia-avatar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    padding-top: 0.5rem;
  }

  .gaia-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #0ff, #08f);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: bold;
    color: #000;
    font-family: monospace;
  }

  .gaia-label {
    color: #0ff;
    font-family: monospace;
    font-size: 0.9rem;
    letter-spacing: 0.1em;
  }

  .dialogue-area {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
    padding-bottom: 2rem;
  }

  .speech-bubble {
    background: rgba(0, 200, 255, 0.08);
    border: 1px solid rgba(0, 200, 255, 0.2);
    border-radius: 12px;
    padding: 0.75rem 1rem;
    max-width: 90%;
    animation: fadeIn 0.4s ease-out;
  }

  .speech-bubble.latest {
    border-color: rgba(0, 200, 255, 0.4);
  }

  .speech-bubble p {
    color: #d0e8f0;
    font-family: monospace;
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 0;
  }

  .tap-continue {
    align-self: center;
    background: none;
    border: none;
    color: #888;
    font-family: monospace;
    font-size: 0.8rem;
    cursor: pointer;
    animation: pulse 2s ease-in-out infinite;
    padding: 0.5rem;
  }

  .interest-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.5rem 0;
  }

  .interest-pill {
    background: rgba(40, 40, 60, 0.8);
    border: 1px solid #444;
    color: #ccc;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    cursor: pointer;
    font-family: monospace;
    font-size: 0.85rem;
    min-height: 44px;
    transition: all 0.2s ease;
  }

  .interest-pill.active {
    background: rgba(0, 200, 255, 0.2);
    border-color: #0ff;
    color: #0ff;
  }

  .interest-pill:hover {
    border-color: #888;
  }

  .continue-btn {
    align-self: center;
    background: linear-gradient(135deg, #0af, #08f);
    border: none;
    color: #fff;
    padding: 0.75rem 2rem;
    border-radius: 8px;
    cursor: pointer;
    font-family: monospace;
    font-size: 1rem;
    min-height: 48px;
    margin-top: 0.5rem;
    transition: transform 0.1s;
  }

  .continue-btn:active {
    transform: scale(0.96);
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }
</style>
