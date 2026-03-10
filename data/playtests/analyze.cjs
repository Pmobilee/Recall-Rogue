/**
 * Playtest log analyzer for Recall Rogue.
 * Reads JSON log files, applies 9-point detection checklist, writes report JSON.
 *
 * Usage: node analyze.cjs <logfile1> [logfile2 ...]
 */
const fs = require('fs');
const path = require('path');

const ALL_CARD_TYPES = ['attack', 'shield', 'heal', 'buff', 'debuff', 'utility', 'regen', 'wild'];

function analyzeLog(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const log = JSON.parse(raw);

  const issues = [];
  let issueCounter = 0;

  function addIssue(category, severity, title, description, evidence, reproSteps) {
    issueCounter++;
    issues.push({
      id: `issue-${log.id}-${String(issueCounter).padStart(3, '0')}`,
      category,
      severity,
      title: title.slice(0, 120),
      description,
      evidence,
      reproductionSteps: reproSteps
    });
  }

  const baseRepro = `Profile: ${log.profileId}, Seed: ${log.rngSeed}`;
  const summary = log.summary;
  const encounters = summary.encounterResults;
  const turns = log.turns;

  // =========================================================================
  // 1. balance_damage_spike (HIGH)
  //    Enemy deals >50% of player's current HP in one enemy turn.
  // =========================================================================
  const enemyTurns = turns.filter(t => t.phase === 'enemy_turn');
  for (const et of enemyTurns) {
    const dmgReceived = et.outcome.damageReceived;
    if (dmgReceived <= 0) continue;
    // playerHP in the snapshot is AFTER damage. So HP before damage = snapshot.playerHP + dmgReceived
    const hpBefore = et.snapshot.playerHP + dmgReceived;
    if (hpBefore > 0 && dmgReceived > 0.5 * hpBefore) {
      const pct = Math.round((dmgReceived / hpBefore) * 100);
      addIssue(
        'balance_damage_spike',
        'high',
        `Enemy dealt ${dmgReceived} dmg (${pct}% of ${hpBefore} HP) on floor ${et.floor} enc ${et.encounter}`,
        `During enemy turn (seq ${et.seq}), the enemy dealt ${dmgReceived} damage to a player with ${hpBefore} HP (${pct}% of current HP). This exceeds the 50% spike threshold. Enemy intent was "${et.snapshot.enemyNextIntent || 'unknown'}".`,
        {
          turnSeqs: [et.seq],
          floor: et.floor,
          encounter: et.encounter,
          metric: `Enemy dealt ${dmgReceived} dmg (${pct}% of ${hpBefore} HP)`
        },
        [baseRepro, `Floor ${et.floor}, Encounter ${et.encounter}, Turn seq ${et.seq}`]
      );
    }
  }

  // =========================================================================
  // 2. balance_too_easy (LOW)
  //    3+ consecutive encounters where playerHPRemaining > 72 (90% of 80)
  // =========================================================================
  {
    let streak = 0;
    let streakStart = -1;
    for (let i = 0; i < encounters.length; i++) {
      if (encounters[i].playerHPRemaining > 72) {
        if (streak === 0) streakStart = i;
        streak++;
        if (streak >= 3) {
          // Report at streak end — we want the longest consecutive run
          // but report each time we hit 3+ to capture the first occurrence
        }
      } else {
        if (streak >= 3) {
          const startEnc = encounters[streakStart];
          const endEnc = encounters[streakStart + streak - 1];
          const hps = encounters.slice(streakStart, streakStart + streak).map(e => e.playerHPRemaining);
          addIssue(
            'balance_too_easy',
            'low',
            `${streak} consecutive encounters with HP > 90% (floors ${startEnc.floor}-${endEnc.floor})`,
            `Player maintained >72 HP (90% of 80) across ${streak} consecutive encounters from floor ${startEnc.floor} enc ${startEnc.encounter} to floor ${endEnc.floor} enc ${endEnc.encounter}. HP values: [${hps.join(', ')}]. Encounters may not be challenging enough.`,
            {
              encounterIndices: Array.from({ length: streak }, (_, k) => streakStart + k),
              floors: `${startEnc.floor}-${endEnc.floor}`,
              hpValues: hps,
              metric: `${streak} encounters with HP > 72`
            },
            [baseRepro, `Floors ${startEnc.floor} to ${endEnc.floor}`]
          );
        }
        streak = 0;
      }
    }
    // Check trailing streak
    if (streak >= 3) {
      const startEnc = encounters[streakStart];
      const endEnc = encounters[streakStart + streak - 1];
      const hps = encounters.slice(streakStart, streakStart + streak).map(e => e.playerHPRemaining);
      addIssue(
        'balance_too_easy',
        'low',
        `${streak} consecutive encounters with HP > 90% (floors ${startEnc.floor}-${endEnc.floor})`,
        `Player maintained >72 HP (90% of 80) across ${streak} consecutive encounters from floor ${startEnc.floor} enc ${startEnc.encounter} to floor ${endEnc.floor} enc ${endEnc.encounter}. HP values: [${hps.join(', ')}]. Encounters may not be challenging enough.`,
        {
          encounterIndices: Array.from({ length: streak }, (_, k) => streakStart + k),
          floors: `${startEnc.floor}-${endEnc.floor}`,
          hpValues: hps,
          metric: `${streak} encounters with HP > 72`
        },
        [baseRepro, `Floors ${startEnc.floor} to ${endEnc.floor}`]
      );
    }
  }

  // =========================================================================
  // 3. balance_too_hard (MEDIUM)
  //    Player defeated on floors 1-3
  // =========================================================================
  for (const enc of encounters) {
    if (enc.result === 'defeat' && enc.floor <= 3) {
      addIssue(
        'balance_too_hard',
        'medium',
        `Player defeated on floor ${enc.floor} encounter ${enc.encounter} (${enc.enemyId})`,
        `Player was defeated on floor ${enc.floor} (encounter ${enc.encounter}) by ${enc.enemyId} (${enc.enemyCategory}). This is very early in the run and suggests difficulty may be too high for this profile. Accuracy: ${(enc.accuracy * 100).toFixed(1)}%, cards played: ${enc.cardsPlayed}, damage dealt: ${enc.damageDealt}, damage taken: ${enc.damageTaken}.`,
        {
          floor: enc.floor,
          encounter: enc.encounter,
          enemyId: enc.enemyId,
          enemyCategory: enc.enemyCategory,
          accuracy: enc.accuracy,
          metric: `Defeated on floor ${enc.floor}`
        },
        [baseRepro, `Floor ${enc.floor}, Encounter ${enc.encounter}`]
      );
    }
  }

  // =========================================================================
  // 4. balance_healing_insufficient (MEDIUM)
  //    Player never heals above 60% HP (48) after floor 3
  // =========================================================================
  {
    const postFloor3Encounters = encounters.filter(e => e.floor > 3);
    if (postFloor3Encounters.length > 0) {
      const maxHPPostFloor3 = Math.max(...postFloor3Encounters.map(e => e.playerHPRemaining));
      if (maxHPPostFloor3 < 48) {
        addIssue(
          'balance_healing_insufficient',
          'medium',
          `Player never above 60% HP after floor 3 (max ${maxHPPostFloor3})`,
          `After floor 3, the player's highest HP remaining after any encounter was ${maxHPPostFloor3}, which is below the 48 HP (60% of 80) threshold. This suggests healing is insufficient to sustain the player through the mid-to-late game. HP values post-floor-3: [${postFloor3Encounters.map(e => `F${e.floor}E${e.encounter}:${e.playerHPRemaining}`).join(', ')}].`,
          {
            maxHPPostFloor3,
            threshold: 48,
            hpTimeline: postFloor3Encounters.map(e => ({ floor: e.floor, encounter: e.encounter, hp: e.playerHPRemaining })),
            metric: `Max HP post-floor-3: ${maxHPPostFloor3}`
          },
          [baseRepro, `Floors 4+, max HP was ${maxHPPostFloor3}`]
        );
      }
    }
  }

  // =========================================================================
  // 5. balance_combo_unreachable (MEDIUM)
  //    overallAccuracy > 0.6 but maxCombo < 3
  // =========================================================================
  if (summary.overallAccuracy > 0.6 && summary.maxCombo < 3) {
    addIssue(
      'balance_combo_unreachable',
      'medium',
      `Accuracy ${(summary.overallAccuracy * 100).toFixed(1)}% but max combo only ${summary.maxCombo}`,
      `The player achieved ${(summary.overallAccuracy * 100).toFixed(1)}% overall accuracy (above 60% threshold) but only reached a max combo of ${summary.maxCombo} (below 3). This suggests the combo system may be too hard to build despite good knowledge performance.`,
      {
        overallAccuracy: summary.overallAccuracy,
        maxCombo: summary.maxCombo,
        metric: `Accuracy ${(summary.overallAccuracy * 100).toFixed(1)}%, maxCombo ${summary.maxCombo}`
      },
      [baseRepro, `Overall accuracy: ${(summary.overallAccuracy * 100).toFixed(1)}%, max combo: ${summary.maxCombo}`]
    );
  }

  // =========================================================================
  // 6. progression_difficulty_spike (HIGH)
  //    encounter turnsToResolve > 2x previous floor's average turnsToResolve
  // =========================================================================
  {
    // Group encounters by floor and compute average turnsToResolve per floor
    const floorMap = {};
    for (const enc of encounters) {
      if (!floorMap[enc.floor]) floorMap[enc.floor] = [];
      floorMap[enc.floor].push(enc);
    }
    const floors = Object.keys(floorMap).map(Number).sort((a, b) => a - b);

    for (let fi = 1; fi < floors.length; fi++) {
      const prevFloor = floors[fi - 1];
      const currFloor = floors[fi];
      const prevAvg = floorMap[prevFloor].reduce((s, e) => s + e.turnsToResolve, 0) / floorMap[prevFloor].length;

      for (const enc of floorMap[currFloor]) {
        if (prevAvg > 0 && enc.turnsToResolve > 2 * prevAvg) {
          addIssue(
            'progression_difficulty_spike',
            'high',
            `Floor ${currFloor} enc ${enc.encounter}: ${enc.turnsToResolve} turns (prev floor avg ${prevAvg.toFixed(1)})`,
            `Encounter on floor ${currFloor} (encounter ${enc.encounter}, ${enc.enemyId}/${enc.enemyCategory}) took ${enc.turnsToResolve} turns to resolve, which is more than 2x the previous floor's average of ${prevAvg.toFixed(1)} turns. This indicates a sudden difficulty spike.`,
            {
              floor: currFloor,
              encounter: enc.encounter,
              turnsToResolve: enc.turnsToResolve,
              previousFloorAvg: Math.round(prevAvg * 10) / 10,
              enemyId: enc.enemyId,
              ratio: Math.round((enc.turnsToResolve / prevAvg) * 10) / 10,
              metric: `${enc.turnsToResolve} turns vs ${prevAvg.toFixed(1)} avg`
            },
            [baseRepro, `Floor ${currFloor}, Encounter ${enc.encounter} (${enc.enemyId})`]
          );
        }
      }
    }
  }

  // =========================================================================
  // 7. progression_dead_end (CRITICAL)
  //    encounter has damageDealt === 0
  // =========================================================================
  for (const enc of encounters) {
    if (enc.damageDealt === 0) {
      addIssue(
        'progression_dead_end',
        'critical',
        `Zero damage dealt in floor ${enc.floor} enc ${enc.encounter} vs ${enc.enemyId}`,
        `The player dealt 0 damage during the encounter on floor ${enc.floor} (encounter ${enc.encounter}) against ${enc.enemyId} (${enc.enemyCategory}). This is a dead end — the player had no way to progress. Cards played: ${enc.cardsPlayed}, accuracy: ${(enc.accuracy * 100).toFixed(1)}%.`,
        {
          floor: enc.floor,
          encounter: enc.encounter,
          enemyId: enc.enemyId,
          damageDealt: 0,
          cardsPlayed: enc.cardsPlayed,
          metric: 'damageDealt === 0'
        },
        [baseRepro, `Floor ${enc.floor}, Encounter ${enc.encounter}`]
      );
    }
  }

  // =========================================================================
  // 8. ux_unfun_moment (LOW)
  //    Player HP drops from >70% to <20% within a single encounter
  // =========================================================================
  {
    // For each encounter, look at the HP at the start vs end
    // HP at start = playerHPRemaining of previous encounter (or 80 for first)
    for (let i = 0; i < encounters.length; i++) {
      const enc = encounters[i];
      let hpBefore;
      if (i === 0) {
        hpBefore = 80; // Starting HP
      } else {
        hpBefore = encounters[i - 1].playerHPRemaining;
      }
      const hpAfter = enc.playerHPRemaining;
      // >70% = >56, <20% = <16
      if (hpBefore > 56 && hpAfter < 16) {
        addIssue(
          'ux_unfun_moment',
          'low',
          `HP dropped from ${hpBefore} (${Math.round(hpBefore / 80 * 100)}%) to ${hpAfter} (${Math.round(hpAfter / 80 * 100)}%) in floor ${enc.floor} enc ${enc.encounter}`,
          `Player HP dropped from ${hpBefore} (>${Math.round(hpBefore / 80 * 100)}% of max) to ${hpAfter} (<${Math.round(hpAfter / 80 * 100 + 1)}% of max) during a single encounter on floor ${enc.floor} (encounter ${enc.encounter}) against ${enc.enemyId}. This dramatic HP swing feels unfair and frustrating. Damage taken: ${enc.damageTaken}, turns: ${enc.turnsToResolve}.`,
          {
            floor: enc.floor,
            encounter: enc.encounter,
            hpBefore,
            hpAfter,
            enemyId: enc.enemyId,
            damageTaken: enc.damageTaken,
            metric: `HP ${hpBefore} → ${hpAfter} (${Math.round(hpBefore / 80 * 100)}% → ${Math.round(hpAfter / 80 * 100)}%)`
          },
          [baseRepro, `Floor ${enc.floor}, Encounter ${enc.encounter}`]
        );
      }
    }
  }

  // =========================================================================
  // 9. mechanic_unused (LOW)
  //    A card type has 0 plays across entire run
  // =========================================================================
  {
    const cardTypeCounts = {};
    for (const ct of ALL_CARD_TYPES) {
      cardTypeCounts[ct] = 0;
    }
    for (const t of turns) {
      if (t.action && t.action.type === 'play_card' && t.action.cardType) {
        const ct = t.action.cardType;
        if (ct in cardTypeCounts) {
          cardTypeCounts[ct]++;
        }
      }
    }
    const unused = ALL_CARD_TYPES.filter(ct => cardTypeCounts[ct] === 0);
    for (const ct of unused) {
      addIssue(
        'mechanic_unused',
        'low',
        `Card type "${ct}" was never played in the entire run`,
        `The card type "${ct}" had 0 plays across the entire run (${summary.totalCardsPlayed} total cards played). This mechanic provided no value to the player. Card type distribution: ${JSON.stringify(cardTypeCounts)}.`,
        {
          unusedType: ct,
          totalCardsPlayed: summary.totalCardsPlayed,
          cardTypeDistribution: cardTypeCounts,
          metric: `${ct}: 0 plays`
        },
        [baseRepro, `Card type "${ct}" never appeared or was never played`]
      );
    }
  }

  // =========================================================================
  // Build report
  // =========================================================================
  const report = {
    playthroughId: log.id,
    profileId: log.profileId,
    settings: log.settings,
    runSummary: {
      result: summary.result,
      finalFloor: summary.finalFloor,
      accuracy: summary.overallAccuracy,
      maxCombo: summary.maxCombo
    },
    analyzedAt: new Date().toISOString(),
    issues
  };

  return report;
}

// ---- Main ----
const logFiles = [
  'playthrough-expert-100-1773154378754.json',
  'playthrough-expert-200-1773154389174.json',
  'playthrough-expert-300-1773154393221.json',
  'playthrough-expert-42-1773154374086.json',
  'playthrough-expert-700-1773154398768.json',
  'playthrough-impatient-300-1773154424738.json',
  'playthrough-impatient-42-1773154419927.json'
];

const logsDir = path.join(__dirname, 'logs');
const reportsDir = path.join(__dirname, 'reports');

for (const file of logFiles) {
  const filePath = path.join(logsDir, file);
  console.log(`Analyzing ${file}...`);
  try {
    const report = analyzeLog(filePath);
    const outPath = path.join(reportsDir, `report-${report.playthroughId}.json`);
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`  → ${report.issues.length} issues found, wrote ${path.basename(outPath)}`);
  } catch (err) {
    console.error(`  ERROR processing ${file}:`, err.message);
  }
}

console.log('\nDone. All reports in', reportsDir);
