/**
 * Playtest log analyzer for Recall Rogue.
 * Reads each log file, checks all 9 issue types, writes a report JSON.
 */
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'logs');
const REPORT_DIR = path.join(__dirname, 'reports');

const TARGET_FILES = [
  'playthrough-beginner-200-1773154379504.json',
  'playthrough-beginner-300-1773154384068.json',
  'playthrough-beginner-42-1773154368400.json',
  'playthrough-beginner-500-1773154388196.json',
  'playthrough-control-expert-100-1773154427048.json',
  'playthrough-control-expert-700-1773154434457.json',
  'playthrough-defensive-average-100-1773154418190.json',
  'playthrough-defensive-average-400-1773154422843.json',
];

const ALL_CARD_TYPES = ['attack', 'shield', 'heal', 'buff', 'debuff', 'utility', 'regen', 'wild'];

function analyze(log) {
  const issues = [];
  let issueNum = 0;

  function addIssue(category, severity, title, description, evidence, reproSteps) {
    issueNum++;
    issues.push({
      id: `issue-${log.id}-${String(issueNum).padStart(3, '0')}`,
      category,
      severity,
      title: title.slice(0, 120),
      description,
      evidence,
      reproductionSteps: reproSteps,
    });
  }

  const baseRepro = `Profile: ${log.profileId}, Seed: ${log.rngSeed}`;
  const turns = log.turns;
  const summary = log.summary;
  const encounterResults = summary.encounterResults || [];

  // =========================================================================
  // 1. balance_damage_spike (HIGH)
  //    Enemy deals >50% of player's current HP in one enemy turn.
  // =========================================================================
  for (const turn of turns) {
    if (turn.phase === 'enemy_turn' && turn.outcome.damageReceived > 0) {
      // The snapshot is AFTER the turn resolves, so the playerHP before this turn is
      // snapshot.playerHP + damageReceived (minus any shield absorbed, but damageReceived
      // is the actual HP loss after shield).
      const hpBefore = turn.snapshot.playerHP + turn.outcome.damageReceived;
      const ratio = turn.outcome.damageReceived / hpBefore;
      if (ratio > 0.5) {
        addIssue(
          'balance_damage_spike',
          'high',
          `Enemy dealt ${turn.outcome.damageReceived} dmg (${Math.round(ratio * 100)}% of ${hpBefore} HP) on floor ${turn.floor}`,
          `On floor ${turn.floor}, encounter ${turn.encounter}, turn ${turn.turnNumber} (seq ${turn.seq}), the enemy dealt ${turn.outcome.damageReceived} damage which is ${Math.round(ratio * 100)}% of the player's ${hpBefore} HP before the hit. This exceeds the 50% threshold for a single enemy turn.`,
          {
            turnSeqs: [turn.seq],
            floor: turn.floor,
            encounter: turn.encounter,
            metric: `Enemy dealt ${turn.outcome.damageReceived} dmg (${Math.round(ratio * 100)}% of ${hpBefore} HP)`,
          },
          [baseRepro, `Floor ${turn.floor}, Encounter ${turn.encounter}, Turn ${turn.turnNumber}`]
        );
      }
    }
  }

  // =========================================================================
  // 2. balance_too_easy (LOW)
  //    3+ consecutive encounters where playerHPRemaining > 72 (90% of 80).
  // =========================================================================
  {
    let consecutive = 0;
    let streakStart = -1;
    for (let i = 0; i < encounterResults.length; i++) {
      const er = encounterResults[i];
      if (er.playerHPRemaining > 72) {
        if (consecutive === 0) streakStart = i;
        consecutive++;
        if (consecutive >= 3) {
          const streakEncounters = encounterResults.slice(streakStart, i + 1);
          addIssue(
            'balance_too_easy',
            'low',
            `${consecutive} consecutive easy encounters (floors ${streakEncounters[0].floor}-${streakEncounters[consecutive - 1].floor})`,
            `${consecutive} consecutive encounters where player ended with >90% HP (>72). Encounters: ${streakEncounters.map(e => `F${e.floor}E${e.encounter}:${e.playerHPRemaining}HP`).join(', ')}. The game may not be challenging enough in this stretch.`,
            {
              floors: streakEncounters.map(e => e.floor),
              encounters: streakEncounters.map(e => e.encounter),
              hpValues: streakEncounters.map(e => e.playerHPRemaining),
              metric: `${consecutive} encounters with HP > 72/80`,
            },
            [baseRepro, `Floors ${streakEncounters[0].floor}-${streakEncounters[consecutive - 1].floor}`]
          );
        }
      } else {
        consecutive = 0;
      }
    }
  }

  // =========================================================================
  // 3. balance_too_hard (MEDIUM)
  //    Player defeated on floors 1-3.
  // =========================================================================
  for (const er of encounterResults) {
    if (er.result === 'defeat' && er.floor >= 1 && er.floor <= 3) {
      addIssue(
        'balance_too_hard',
        'medium',
        `Player defeated on floor ${er.floor}, encounter ${er.encounter} (${er.enemyId})`,
        `Player was defeated on floor ${er.floor}, encounter ${er.encounter} against ${er.enemyId} (${er.enemyCategory}). Accuracy was ${Math.round(er.accuracy * 100)}% with ${er.turnsToResolve} turns played. Early defeat suggests difficulty may be too high for this profile.`,
        {
          floor: er.floor,
          encounter: er.encounter,
          enemyId: er.enemyId,
          enemyCategory: er.enemyCategory,
          accuracy: er.accuracy,
          turnsToResolve: er.turnsToResolve,
          metric: `Defeated on floor ${er.floor} with ${Math.round(er.accuracy * 100)}% accuracy`,
        },
        [baseRepro, `Floor ${er.floor}, Encounter ${er.encounter}, Enemy: ${er.enemyId}`]
      );
    }
  }

  // =========================================================================
  // 4. balance_healing_insufficient (MEDIUM)
  //    Player never heals above 60% HP (48) after floor 3.
  // =========================================================================
  {
    const postFloor3Turns = turns.filter(t => t.floor > 3);
    if (postFloor3Turns.length > 0) {
      const maxHPPostFloor3 = Math.max(...postFloor3Turns.map(t => t.snapshot.playerHP));
      if (maxHPPostFloor3 < 48) {
        addIssue(
          'balance_healing_insufficient',
          'medium',
          `Player never exceeded 60% HP after floor 3 (max: ${maxHPPostFloor3})`,
          `After floor 3, the player's HP never exceeded ${maxHPPostFloor3} (threshold: 48, which is 60% of 80 max HP). This suggests healing mechanics are insufficient to sustain the player in later floors.`,
          {
            maxHPPostFloor3,
            threshold: 48,
            metric: `Max HP after floor 3: ${maxHPPostFloor3}/80 (${Math.round(maxHPPostFloor3 / 80 * 100)}%)`,
          },
          [baseRepro, 'Floors 4+: check healing card availability and heal amounts']
        );
      }
    }
    // If the run never reaches floor 4, this check is N/A (no issue to report)
  }

  // =========================================================================
  // 5. balance_combo_unreachable (MEDIUM)
  //    overallAccuracy > 0.6 but maxCombo < 3.
  // =========================================================================
  if (summary.overallAccuracy > 0.6 && summary.maxCombo < 3) {
    addIssue(
      'balance_combo_unreachable',
      'medium',
      `Accuracy ${Math.round(summary.overallAccuracy * 100)}% but max combo only ${summary.maxCombo}`,
      `The player achieved ${Math.round(summary.overallAccuracy * 100)}% overall accuracy (above 60% threshold) but only reached a max combo of ${summary.maxCombo} (below 3). This suggests the combo system is too hard to build despite decent knowledge performance.`,
      {
        accuracy: summary.overallAccuracy,
        maxCombo: summary.maxCombo,
        metric: `${Math.round(summary.overallAccuracy * 100)}% accuracy, max combo ${summary.maxCombo}`,
      },
      [baseRepro, 'Review combo mechanics — is combo broken by enemy turns or card type changes?']
    );
  }

  // =========================================================================
  // 6. progression_difficulty_spike (HIGH)
  //    An encounter's turnsToResolve > 2x previous floor's avg turnsToResolve.
  // =========================================================================
  {
    // Group encounters by floor
    const floorMap = {};
    for (const er of encounterResults) {
      if (!floorMap[er.floor]) floorMap[er.floor] = [];
      floorMap[er.floor].push(er);
    }
    const floors = Object.keys(floorMap).map(Number).sort((a, b) => a - b);
    for (let fi = 1; fi < floors.length; fi++) {
      const prevFloor = floors[fi - 1];
      const currFloor = floors[fi];
      const prevEncounters = floorMap[prevFloor];
      const prevAvg = prevEncounters.reduce((s, e) => s + e.turnsToResolve, 0) / prevEncounters.length;
      for (const er of floorMap[currFloor]) {
        if (prevAvg > 0 && er.turnsToResolve > 2 * prevAvg) {
          addIssue(
            'progression_difficulty_spike',
            'high',
            `Floor ${currFloor} enc ${er.encounter}: ${er.turnsToResolve} turns vs prev floor avg ${prevAvg.toFixed(1)}`,
            `Encounter ${er.encounter} on floor ${currFloor} took ${er.turnsToResolve} turns to resolve, which is more than 2x the previous floor's average of ${prevAvg.toFixed(1)} turns. This indicates a sharp difficulty spike. Enemy: ${er.enemyId} (${er.enemyCategory}).`,
            {
              floor: currFloor,
              encounter: er.encounter,
              turnsToResolve: er.turnsToResolve,
              previousFloorAvg: Math.round(prevAvg * 10) / 10,
              ratio: Math.round((er.turnsToResolve / prevAvg) * 100) / 100,
              enemyId: er.enemyId,
              metric: `${er.turnsToResolve} turns vs ${prevAvg.toFixed(1)} avg (${(er.turnsToResolve / prevAvg).toFixed(1)}x)`,
            },
            [baseRepro, `Floor ${currFloor}, Encounter ${er.encounter}, Enemy: ${er.enemyId}`]
          );
        }
      }
    }
  }

  // =========================================================================
  // 7. progression_dead_end (CRITICAL)
  //    An encounter has damageDealt === 0.
  // =========================================================================
  for (const er of encounterResults) {
    if (er.damageDealt === 0) {
      addIssue(
        'progression_dead_end',
        'critical',
        `Zero damage dealt in floor ${er.floor} encounter ${er.encounter} (${er.enemyId})`,
        `The player dealt exactly 0 damage during floor ${er.floor}, encounter ${er.encounter} against ${er.enemyId}. This means the player had no way to progress — a dead end. Cards played: ${er.cardsPlayed}, accuracy: ${Math.round(er.accuracy * 100)}%.`,
        {
          floor: er.floor,
          encounter: er.encounter,
          enemyId: er.enemyId,
          damageDealt: 0,
          cardsPlayed: er.cardsPlayed,
          accuracy: er.accuracy,
          metric: `0 damage dealt in ${er.cardsPlayed} cards played`,
        },
        [baseRepro, `Floor ${er.floor}, Encounter ${er.encounter} — check if attack cards were available`]
      );
    }
  }

  // =========================================================================
  // 8. ux_unfun_moment (LOW)
  //    Player HP drops from >70% to <20% within a single encounter.
  // =========================================================================
  {
    // Group turns by encounter
    const encounterKey = (t) => `${t.floor}-${t.encounter}`;
    const encounterTurns = {};
    for (const t of turns) {
      const key = encounterKey(t);
      if (!encounterTurns[key]) encounterTurns[key] = [];
      encounterTurns[key].push(t);
    }
    for (const [key, eTurns] of Object.entries(encounterTurns)) {
      const hpValues = eTurns.map(t => t.snapshot.playerHP);
      const maxHP = 80;
      // Check if any HP value > 70% (56) and any later HP value < 20% (16) in same encounter
      for (let i = 0; i < hpValues.length; i++) {
        if (hpValues[i] > 0.7 * maxHP) { // >56
          for (let j = i + 1; j < hpValues.length; j++) {
            if (hpValues[j] < 0.2 * maxHP) { // <16
              const floor = eTurns[0].floor;
              const encounter = eTurns[0].encounter;
              addIssue(
                'ux_unfun_moment',
                'low',
                `HP crashed from ${hpValues[i]} to ${hpValues[j]} in floor ${floor} encounter ${encounter}`,
                `During floor ${floor}, encounter ${encounter}, player HP dropped from ${hpValues[i]} (${Math.round(hpValues[i] / maxHP * 100)}%) to ${hpValues[j]} (${Math.round(hpValues[j] / maxHP * 100)}%). Going from >70% to <20% in one encounter feels punishing and unfun.`,
                {
                  floor,
                  encounter,
                  hpStart: hpValues[i],
                  hpEnd: hpValues[j],
                  turnSeqs: [eTurns[i].seq, eTurns[j].seq],
                  metric: `HP ${hpValues[i]} → ${hpValues[j]} (${Math.round(hpValues[i] / maxHP * 100)}% → ${Math.round(hpValues[j] / maxHP * 100)}%)`,
                },
                [baseRepro, `Floor ${floor}, Encounter ${encounter}`]
              );
              // Only report once per encounter (break both loops for this encounter)
              i = hpValues.length;
              break;
            }
          }
        }
      }
    }
  }

  // =========================================================================
  // 9. mechanic_unused (LOW)
  //    A card type has 0 plays across entire run.
  // =========================================================================
  {
    const cardTypeCounts = {};
    for (const ct of ALL_CARD_TYPES) cardTypeCounts[ct] = 0;
    for (const t of turns) {
      if (t.action && t.action.type === 'play_card' && t.action.cardType) {
        const ct = t.action.cardType;
        if (ct in cardTypeCounts) {
          cardTypeCounts[ct]++;
        }
      }
    }
    for (const [ct, count] of Object.entries(cardTypeCounts)) {
      if (count === 0) {
        addIssue(
          'mechanic_unused',
          'low',
          `Card type "${ct}" was never played during the entire run`,
          `The card type "${ct}" had 0 plays across the entire run (${summary.totalCardsPlayed} total cards played). This may indicate the type is not appearing in decks, not being offered, or players are avoiding it.`,
          {
            cardType: ct,
            totalCardsPlayed: summary.totalCardsPlayed,
            cardTypeCounts,
            metric: `0 plays of "${ct}" across ${summary.totalCardsPlayed} total cards`,
          },
          [baseRepro, `Check deck composition — does "${ct}" appear in the card pool?`]
        );
      }
    }
  }

  // Build report
  const report = {
    playthroughId: log.id,
    profileId: log.profileId,
    settings: log.settings,
    runSummary: {
      result: summary.result,
      finalFloor: summary.finalFloor,
      accuracy: summary.overallAccuracy,
      maxCombo: summary.maxCombo,
    },
    analyzedAt: new Date().toISOString(),
    issues,
  };

  return report;
}

// Process all target files
for (const filename of TARGET_FILES) {
  const filepath = path.join(LOG_DIR, filename);
  console.log(`Analyzing: ${filename}`);
  const log = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const report = analyze(log);
  const reportFilename = `report-${log.id}.json`;
  const reportPath = path.join(REPORT_DIR, reportFilename);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`  → ${reportFilename} (${report.issues.length} issues found)`);
}

console.log('\nDone. All 8 reports written.');
