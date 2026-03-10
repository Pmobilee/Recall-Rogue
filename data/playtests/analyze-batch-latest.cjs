/**
 * Playtest log analyzer for Recall Rogue.
 * Reads each log file, checks all 10 issue types, writes a report JSON.
 *
 * Issue categories scanned:
 *   Balance:     damage_spike, too_easy, too_hard, healing_insufficient,
 *                combo_unreachable, attrition_death
 *   Progression: difficulty_spike, dead_end
 *   UX:          unfun_moment, mechanic_unused
 */
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'logs');
const REPORT_DIR = path.join(__dirname, 'reports');

const TARGET_FILES = [
  'playthrough-beginner-42-1773159787927.json',
  'playthrough-beginner-100-1773159791883.json',
  'playthrough-beginner-200-1773159798620.json',
  'playthrough-average-42-1773159776229.json',
  'playthrough-average-100-1773159785233.json',
  'playthrough-average-200-1773159790266.json',
];

const ALL_CARD_TYPES = ['attack', 'shield', 'heal', 'buff', 'debuff'];

function analyze(log) {
  const issues = [];
  let issueNum = 0;

  function addIssue(category, severity, title, description, evidence, reproSteps, suggestedFix) {
    issueNum++;
    const issue = {
      id: `issue-${log.id}-${issueNum}`,
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
      // snapshot is AFTER the turn resolves, so HP before = snapshot.playerHP + damageReceived
      const hpBefore = turn.snapshot.playerHP + turn.outcome.damageReceived;
      const ratio = turn.outcome.damageReceived / hpBefore;
      if (ratio > 0.5) {
        addIssue(
          'balance_damage_spike',
          'high',
          `Enemy dealt ${turn.outcome.damageReceived} dmg (${Math.round(ratio * 100)}% of ${hpBefore} HP) on floor ${turn.floor} enc ${turn.encounter}`,
          `On floor ${turn.floor}, encounter ${turn.encounter}, turn ${turn.turnNumber} (seq ${turn.seq}), the enemy dealt ${turn.outcome.damageReceived} damage which is ${Math.round(ratio * 100)}% of the player's ${hpBefore} HP before the hit. This exceeds the 50% threshold for a single enemy turn.`,
          {
            turnSeqs: [turn.seq],
            floor: turn.floor,
            encounter: turn.encounter,
            metric: `damageReceived=${turn.outcome.damageReceived}, playerHP_before=${hpBefore}, ratio=${ratio.toFixed(3)}`,
          },
          [baseRepro, `Floor ${turn.floor}, Encounter ${turn.encounter}, Turn ${turn.turnNumber}`],
          'Consider reducing enemy damage scaling or adding damage caps for this enemy type.'
        );
      }
    }
  }

  // =========================================================================
  // 2. balance_too_easy (LOW)
  //    3+ consecutive encounters where playerHPRemaining > 90.
  // =========================================================================
  {
    let consecutive = 0;
    let streakStart = -1;
    let reported = false;
    for (let i = 0; i < encounterResults.length; i++) {
      const er = encounterResults[i];
      if (er.playerHPRemaining > 90) {
        if (consecutive === 0) streakStart = i;
        consecutive++;
        if (consecutive >= 3 && !reported) {
          const streakEncounters = encounterResults.slice(streakStart, i + 1);
          addIssue(
            'balance_too_easy',
            'low',
            `${consecutive} consecutive easy encounters (floors ${streakEncounters[0].floor}-${streakEncounters[consecutive - 1].floor}): HP stayed above 90`,
            `${consecutive} consecutive encounters where player ended with HP > 90. Encounters: ${streakEncounters.map(e => `F${e.floor}E${e.encounter}:${e.playerHPRemaining}HP`).join(', ')}. The game may not be challenging enough in this stretch.`,
            {
              turnSeqs: [],
              floor: streakEncounters[0].floor,
              encounter: streakEncounters[0].encounter,
              metric: `playerHPRemaining: [${streakEncounters.map(e => e.playerHPRemaining).join(', ')}]`,
            },
            [baseRepro, `Floors ${streakEncounters[0].floor}e${streakEncounters[0].encounter} through ${streakEncounters[consecutive - 1].floor}e${streakEncounters[consecutive - 1].encounter}`],
            'Increase enemy damage or reduce healing on early floors.'
          );
          reported = true;
        }
      } else {
        consecutive = 0;
        reported = false;
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
        `Player defeated on floor ${er.floor}, encounter ${er.encounter} by ${er.enemyId} (${er.enemyCategory})`,
        `Player was defeated on floor ${er.floor}, encounter ${er.encounter} against ${er.enemyId} (${er.enemyCategory}). Accuracy was ${Math.round(er.accuracy * 100)}% over ${er.turnsToResolve} turns. They dealt ${er.damageDealt} damage and took ${er.damageTaken} damage. Early defeat suggests difficulty may be too high for this profile.`,
        {
          turnSeqs: [],
          floor: er.floor,
          encounter: er.encounter,
          metric: `result=defeat, damageDealt=${er.damageDealt}, damageTaken=${er.damageTaken}, accuracy=${Math.round(er.accuracy * 100)}%`,
        },
        [baseRepro, `Floor ${er.floor}, Encounter ${er.encounter}, Enemy: ${er.enemyId}`],
        er.enemyCategory === 'boss'
          ? 'Consider reducing boss HP or damage for early floors.'
          : 'Consider reducing enemy stats for floors 1-3.'
      );
    }
  }

  // =========================================================================
  // 4. balance_healing_insufficient (MEDIUM)
  //    Player never heals above 60 HP (60% of 100 max) after floor 3.
  // =========================================================================
  {
    const postFloor3Turns = turns.filter(t => t.floor > 3);
    if (postFloor3Turns.length > 0) {
      const maxHPPostFloor3 = Math.max(...postFloor3Turns.map(t => t.snapshot.playerHP));
      if (maxHPPostFloor3 < 60) {
        addIssue(
          'balance_healing_insufficient',
          'medium',
          `Player never exceeded ${maxHPPostFloor3} HP after floor 3 (threshold: 60)`,
          `After floor 3, the player's HP never exceeded ${maxHPPostFloor3} (threshold: 60, which is 60% of 100 max HP). This suggests healing mechanics are insufficient to sustain the player in later floors.`,
          {
            turnSeqs: [],
            floor: 4,
            encounter: 0,
            metric: `maxHP_after_floor3=${maxHPPostFloor3}, threshold=60`,
          },
          [baseRepro, 'Floors 4+: check healing card availability and heal amounts'],
          'Increase heal card frequency or heal amounts in later floors.'
        );
      }
    }
    // If the run never reaches floor 4, this check is N/A
  }

  // =========================================================================
  // 5. balance_combo_unreachable (MEDIUM)
  //    overallAccuracy > 0.6 but maxCombo < 3.
  // =========================================================================
  if (summary.overallAccuracy > 0.6 && summary.maxCombo < 3) {
    addIssue(
      'balance_combo_unreachable',
      'medium',
      `Accuracy ${Math.round(summary.overallAccuracy * 100)}% but max combo only ${summary.maxCombo} (threshold: 3)`,
      `The player achieved ${Math.round(summary.overallAccuracy * 100)}% overall accuracy (above 60% threshold) but only reached a max combo of ${summary.maxCombo} (below 3). This suggests the combo system is too hard to build despite decent knowledge performance.`,
      {
        turnSeqs: [],
        floor: 0,
        encounter: 0,
        metric: `overallAccuracy=${summary.overallAccuracy}, maxCombo=${summary.maxCombo}`,
      },
      [baseRepro, 'Review combo mechanics: is combo broken by enemy turns or card type changes?'],
      'Check combo tracking logic or make combo requirements more accessible.'
    );
  }

  // =========================================================================
  // 6. balance_attrition_death (MEDIUM)
  //    Player defeated with >60% overall accuracy.
  // =========================================================================
  if (summary.result === 'defeat' && summary.overallAccuracy > 0.6) {
    const lastEnc = encounterResults[encounterResults.length - 1];
    addIssue(
      'balance_attrition_death',
      'medium',
      `Player defeated despite ${Math.round(summary.overallAccuracy * 100)}% accuracy: attrition death`,
      `The player was defeated on floor ${summary.finalFloor} with an overall accuracy of ${Math.round(summary.overallAccuracy * 100)}%. High-accuracy players should have a fair chance of survival; this suggests the damage/healing balance is too punishing.`,
      {
        turnSeqs: [],
        floor: summary.finalFloor,
        encounter: lastEnc ? lastEnc.encounter : 0,
        metric: `overallAccuracy=${summary.overallAccuracy}, result=defeat, finalFloor=${summary.finalFloor}`,
      },
      [baseRepro],
      'Reduce enemy damage scaling or increase healing from correct answers.'
    );
  }

  // =========================================================================
  // 7. progression_difficulty_spike (HIGH)
  //    An encounter's turnsToResolve > 2x previous floor's avg turnsToResolve.
  // =========================================================================
  {
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
            `Floor ${currFloor} enc ${er.encounter}: ${er.turnsToResolve} turns vs prev floor avg ${prevAvg.toFixed(1)} (${(er.turnsToResolve / prevAvg).toFixed(1)}x)`,
            `Encounter ${er.encounter} on floor ${currFloor} (enemy: ${er.enemyId}, ${er.enemyCategory}) took ${er.turnsToResolve} turns to resolve, which is ${(er.turnsToResolve / prevAvg).toFixed(1)}x the previous floor's average of ${prevAvg.toFixed(1)} turns. This exceeds the 2x threshold and indicates a difficulty spike.`,
            {
              turnSeqs: [],
              floor: currFloor,
              encounter: er.encounter,
              metric: `turnsToResolve=${er.turnsToResolve}, prevFloorAvg=${prevAvg.toFixed(1)}, ratio=${(er.turnsToResolve / prevAvg).toFixed(1)}x`,
            },
            [baseRepro, `Floor ${currFloor}, Encounter ${er.encounter}, Enemy: ${er.enemyId}`],
            'Smooth difficulty curve between floors or reduce this enemy\'s HP/damage.'
          );
        }
      }
    }
  }

  // =========================================================================
  // 8. progression_dead_end (CRITICAL)
  //    An encounter has damageDealt === 0.
  // =========================================================================
  for (const er of encounterResults) {
    if (er.damageDealt === 0) {
      addIssue(
        'progression_dead_end',
        'critical',
        `Zero damage dealt in floor ${er.floor} encounter ${er.encounter} against ${er.enemyId}`,
        `The player dealt exactly 0 damage during floor ${er.floor}, encounter ${er.encounter} against ${er.enemyId}. This means the player had no way to progress. Cards played: ${er.cardsPlayed}, accuracy: ${Math.round(er.accuracy * 100)}%.`,
        {
          turnSeqs: [],
          floor: er.floor,
          encounter: er.encounter,
          metric: `damageDealt=0, cardsPlayed=${er.cardsPlayed}, accuracy=${Math.round(er.accuracy * 100)}%`,
        },
        [baseRepro, `Floor ${er.floor}, Encounter ${er.encounter}: check if attack cards were available`],
        'Ensure attack cards are always available in the hand, or add a base damage for any card played.'
      );
    }
  }

  // =========================================================================
  // 9. ux_unfun_moment (LOW)
  //    Player HP drops from >70 to <20 within a single encounter.
  // =========================================================================
  {
    const encounterKey = (t) => `${t.floor}-${t.encounter}`;
    const encounterTurns = {};
    for (const t of turns) {
      const key = encounterKey(t);
      if (!encounterTurns[key]) encounterTurns[key] = [];
      encounterTurns[key].push(t);
    }
    for (const [key, eTurns] of Object.entries(encounterTurns)) {
      const hpValues = eTurns.map(t => t.snapshot.playerHP);
      let reported = false;
      for (let i = 0; i < hpValues.length && !reported; i++) {
        if (hpValues[i] > 70) {
          for (let j = i + 1; j < hpValues.length && !reported; j++) {
            if (hpValues[j] < 20) {
              const floor = eTurns[0].floor;
              const encounter = eTurns[0].encounter;
              addIssue(
                'ux_unfun_moment',
                'low',
                `HP dropped from ${hpValues[i]} to ${hpValues[j]} in floor ${floor} encounter ${encounter}`,
                `During floor ${floor}, encounter ${encounter}, player HP dropped from ${hpValues[i]} to ${hpValues[j]}. Going from >70 to <20 in one encounter feels punishing and unfun.`,
                {
                  turnSeqs: [eTurns[i].seq, eTurns[j].seq],
                  floor,
                  encounter,
                  metric: `HP swing: ${hpValues[i]} -> ${hpValues[j]} (delta=${hpValues[i] - hpValues[j]})`,
                },
                [baseRepro, `Floor ${floor}, Encounter ${encounter}`],
                'Add damage caps per encounter or provide emergency healing at low HP.'
              );
              reported = true;
            }
          }
        }
      }
    }
  }

  // =========================================================================
  // 10. mechanic_unused (LOW)
  //     A card type appears in 0 play_card actions across the run.
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
        const playedTypes = Object.entries(cardTypeCounts).filter(([, c]) => c > 0).map(([t]) => t);
        addIssue(
          'mechanic_unused',
          'low',
          `Card type "${ct}" was never played during the run`,
          `The card type "${ct}" had 0 plays across the entire run (${summary.totalCardsPlayed} total cards played). Card types played: [${playedTypes.join(', ')}]. This may indicate the type is not appearing in decks or players are avoiding it.`,
          {
            turnSeqs: [],
            floor: 0,
            encounter: 0,
            metric: `cardTypesPlayed=[${playedTypes.join(', ')}], missing=${ct}`,
          },
          [baseRepro],
          `Review "${ct}" card distribution in the deck or make the card type more impactful.`
        );
      }
    }
  }

  // Build report
  return {
    playthroughId: log.id,
    profileId: log.profileId,
    analyzedAt: new Date().toISOString(),
    issueCount: issues.length,
    issues,
  };
}

// =========================================================================
// Main
// =========================================================================
fs.mkdirSync(REPORT_DIR, { recursive: true });

const summaryRows = [];

for (const filename of TARGET_FILES) {
  const filepath = path.join(LOG_DIR, filename);
  console.log(`Analyzing: ${filename}`);
  const log = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const report = analyze(log);
  const reportFilename = `report-${log.id}.json`;
  const reportPath = path.join(REPORT_DIR, reportFilename);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`  -> ${reportFilename} (${report.issueCount} issues found)`);

  const bySev = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of report.issues) {
    bySev[issue.severity] = (bySev[issue.severity] || 0) + 1;
  }
  summaryRows.push({
    file: filename.replace('playthrough-', '').replace('.json', ''),
    total: report.issueCount,
    ...bySev,
  });
}

console.log('\n=== SUMMARY ===');
console.log(
  'Log'.padEnd(50) +
    'Total'.padEnd(8) +
    'CRIT'.padEnd(7) +
    'HIGH'.padEnd(7) +
    'MED'.padEnd(7) +
    'LOW'.padEnd(7)
);
console.log('-'.repeat(79));
const grand = { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
for (const row of summaryRows) {
  console.log(
    row.file.padEnd(50) +
      String(row.total).padEnd(8) +
      String(row.critical).padEnd(7) +
      String(row.high).padEnd(7) +
      String(row.medium).padEnd(7) +
      String(row.low).padEnd(7)
  );
  grand.total += row.total;
  grand.critical += row.critical;
  grand.high += row.high;
  grand.medium += row.medium;
  grand.low += row.low;
}
console.log('-'.repeat(79));
console.log(
  'GRAND TOTAL'.padEnd(50) +
    String(grand.total).padEnd(8) +
    String(grand.critical).padEnd(7) +
    String(grand.high).padEnd(7) +
    String(grand.medium).padEnd(7) +
    String(grand.low).padEnd(7)
);
console.log('\nDone. ' + TARGET_FILES.length + ' reports written to ' + REPORT_DIR);
