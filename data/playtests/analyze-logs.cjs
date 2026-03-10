/**
 * Playtest log analyzer for Recall Rogue.
 * Reads each log file, checks all 10 issue types, writes a report JSON.
 */
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'logs');
const REPORT_DIR = path.join(__dirname, 'reports');

const TARGET_FILES = [
  'playthrough-expert-500-1773159769776.json',
  'playthrough-expert-700-1773159774657.json',
  'playthrough-speed-runner-42-1773159771160.json',
  'playthrough-story-beginner-100-1773159772427.json',
];

const ALL_CARD_TYPES = ['attack', 'shield', 'heal', 'buff', 'debuff', 'utility', 'regen', 'wild'];

function analyze(log) {
  const issues = [];
  let issueNum = 0;

  function addIssue(category, severity, title, description, evidence, reproSteps, suggestedFix) {
    issueNum++;
    const issue = {
      id: `issue-${log.id}-${String(issueNum).padStart(3, '0')}`,
      playthroughId: log.id,
      profileId: log.profileId,
      category,
      severity,
      title: title.slice(0, 120),
      description,
      evidence,
      reproductionSteps: reproSteps,
    };
    if (suggestedFix) issue.suggestedFix = suggestedFix;
    issues.push(issue);
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
          [baseRepro, `Floor ${turn.floor}, Encounter ${turn.encounter}, Turn ${turn.turnNumber}`],
          'Cap single-hit enemy damage to 50% of player current HP or add damage-reduction mechanics.'
        );
      }
    }
  }

  // =========================================================================
  // 2. balance_too_easy (LOW)
  //    3+ consecutive encounters where playerHPRemaining > 90.
  //    Report each maximal streak once (not at every length increment).
  // =========================================================================
  {
    let streakStart = -1;
    for (let i = 0; i <= encounterResults.length; i++) {
      const er = i < encounterResults.length ? encounterResults[i] : null;
      if (er && er.playerHPRemaining > 90) {
        if (streakStart === -1) streakStart = i;
      } else {
        // Streak ended (or array ended)
        if (streakStart !== -1) {
          const streakLen = i - streakStart;
          if (streakLen >= 3) {
            const streakEncounters = encounterResults.slice(streakStart, i);
            addIssue(
              'balance_too_easy',
              'low',
              `${streakLen} consecutive easy encounters (floors ${streakEncounters[0].floor}-${streakEncounters[streakLen - 1].floor})`,
              `${streakLen} consecutive encounters where player ended with >90 HP remaining. Encounters: ${streakEncounters.map(e => `F${e.floor}E${e.encounter}:${e.playerHPRemaining}HP`).join(', ')}. The game may not be challenging enough in this stretch.`,
              {
                floors: streakEncounters.map(e => e.floor),
                encounters: streakEncounters.map(e => e.encounter),
                hpValues: streakEncounters.map(e => e.playerHPRemaining),
                metric: `${streakLen} encounters with HP > 90`,
              },
              [baseRepro, `Floors ${streakEncounters[0].floor}-${streakEncounters[streakLen - 1].floor}`],
              'Consider scaling enemy HP or damage for this difficulty/profile combination.'
            );
          }
          streakStart = -1;
        }
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
        [baseRepro, `Floor ${er.floor}, Encounter ${er.encounter}, Enemy: ${er.enemyId}`],
        'Reduce early floor enemy HP/damage or activate canary system earlier for struggling profiles.'
      );
    }
  }

  // =========================================================================
  // 4. balance_healing_insufficient (MEDIUM)
  //    Player never heals above 60 HP after floor 3.
  // =========================================================================
  {
    const postFloor3Turns = turns.filter(t => t.floor > 3);
    if (postFloor3Turns.length > 0) {
      const maxHPPostFloor3 = Math.max(...postFloor3Turns.map(t => t.snapshot.playerHP));
      if (maxHPPostFloor3 < 60) {
        addIssue(
          'balance_healing_insufficient',
          'medium',
          `Player never exceeded 60 HP after floor 3 (max: ${maxHPPostFloor3})`,
          `After floor 3, the player's HP never exceeded ${maxHPPostFloor3} (threshold: 60). This suggests healing mechanics are insufficient to sustain the player in later floors.`,
          {
            maxHPPostFloor3,
            threshold: 60,
            metric: `Max HP after floor 3: ${maxHPPostFloor3}/100`,
          },
          [baseRepro, 'Floors 4+: check healing card availability and heal amounts'],
          'Increase heal card frequency or heal amounts in later floors.'
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
      [baseRepro, 'Review combo mechanics — is combo broken by enemy turns or card type changes?'],
      'Consider making combo-building more forgiving or adding combo-preservation mechanics.'
    );
  }

  // =========================================================================
  // 5b. balance_attrition_death (MEDIUM)
  //     Player HP decreases every encounter with no recovery, leading to
  //     inevitable death. We look for streaks of 4+ encounters where HP
  //     never increases, ending in defeat.
  // =========================================================================
  {
    let declineStart = 0;
    for (let i = 1; i <= encounterResults.length; i++) {
      const prev = encounterResults[i - 1];
      const curr = i < encounterResults.length ? encounterResults[i] : null;
      const declining = curr && (curr.playerHPRemaining <= prev.playerHPRemaining);
      const defeated = curr && curr.result === 'defeat';

      if (declining || defeated) {
        // Continue streak — if defeated, include this encounter and close streak
        if (defeated) {
          const streakLen = i - declineStart + 1;
          if (streakLen >= 4) {
            const streak = encounterResults.slice(declineStart, i + 1);
            const hpTrajectory = streak.map(e => e.playerHPRemaining);
            const floors = streak.map(e => `F${e.floor}E${e.encounter}`).join(', ');
            addIssue(
              'balance_attrition_death',
              'medium',
              `${streakLen}-encounter HP decline ending in death (${hpTrajectory[0]} → ${hpTrajectory[hpTrajectory.length - 1]})`,
              `Player HP decreased across ${streakLen} consecutive encounters (${floors}) with no recovery, ending in defeat. HP trajectory: [${hpTrajectory.join(', ')}]. This attrition pattern suggests the player had no way to recover from a slow bleed.`,
              {
                turnSeqs: [],
                floor: streak[0].floor,
                encounter: streak[0].encounter,
                hpTrajectory,
                metric: `HP decline over ${streakLen} encounters: [${hpTrajectory.join(', ')}]`,
              },
              [baseRepro, `Floors ${streak[0].floor}-${streak[streak.length - 1].floor}`],
              'Add HP recovery between encounters (campfire healing, victory heal). Ensure heal cards can outpace incoming damage.'
            );
          }
          declineStart = i + 1;
        }
        // else continue the streak
      } else {
        // HP went up — reset streak
        declineStart = i;
      }
    }
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
  //    Player HP drops from >70 to <20 within a single encounter.
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
      // Check if any HP value > 70 and any later HP value < 20 in same encounter
      for (let i = 0; i < hpValues.length; i++) {
        if (hpValues[i] > 70) {
          for (let j = i + 1; j < hpValues.length; j++) {
            if (hpValues[j] < 20) {
              const floor = eTurns[0].floor;
              const encounter = eTurns[0].encounter;
              addIssue(
                'ux_unfun_moment',
                'low',
                `HP crashed from ${hpValues[i]} to ${hpValues[j]} in floor ${floor} encounter ${encounter}`,
                `During floor ${floor}, encounter ${encounter}, player HP dropped from ${hpValues[i]} to ${hpValues[j]}. Going from >70 to <20 in one encounter feels punishing and unfun.`,
                {
                  floor,
                  encounter,
                  hpStart: hpValues[i],
                  hpEnd: hpValues[j],
                  turnSeqs: [eTurns[i].seq, eTurns[j].seq],
                  metric: `HP ${hpValues[i]} → ${hpValues[j]}`,
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
    analyzedAt: new Date().toISOString(),
    issueCount: issues.length,
    issues,
  };

  return report;
}

// Process all target files
const summaryRows = [];
for (const filename of TARGET_FILES) {
  const filepath = path.join(LOG_DIR, filename);
  console.log(`Analyzing: ${filename}`);
  const log = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const report = analyze(log);
  const reportFilename = `report-${log.id}.json`;
  const reportPath = path.join(REPORT_DIR, reportFilename);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`  → ${reportFilename} (${report.issueCount} issues found)`);

  const sev = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const iss of report.issues) sev[iss.severity] = (sev[iss.severity] || 0) + 1;
  summaryRows.push({ id: report.playthroughId, profile: report.profileId, total: report.issueCount, ...sev });
}

console.log('\n=== SUMMARY: Issues per log by severity ===');
console.log('Playthrough ID'.padEnd(62) + 'CRIT  HIGH  MED   LOW   TOTAL');
console.log('-'.repeat(100));
for (const r of summaryRows) {
  console.log(
    r.id.padEnd(62) +
    String(r.critical).padEnd(6) +
    String(r.high).padEnd(6) +
    String(r.medium).padEnd(6) +
    String(r.low).padEnd(6) +
    String(r.total)
  );
}
const totals = summaryRows.reduce((a, r) => ({
  critical: a.critical + r.critical, high: a.high + r.high,
  medium: a.medium + r.medium, low: a.low + r.low, total: a.total + r.total
}), { critical: 0, high: 0, medium: 0, low: 0, total: 0 });
console.log('-'.repeat(100));
console.log(
  'TOTALS'.padEnd(62) +
  String(totals.critical).padEnd(6) +
  String(totals.high).padEnd(6) +
  String(totals.medium).padEnd(6) +
  String(totals.low).padEnd(6) +
  String(totals.total)
);

console.log(`\nDone. ${TARGET_FILES.length} reports written to ${REPORT_DIR}`);
