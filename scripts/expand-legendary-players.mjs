/**
 * expand-legendary-players.mjs
 * Adds ~30 new facts to the legendary_players sub-deck in fifa_world_cup.json.
 * Surgical expansion — touches ONLY that sub-deck.
 * Run: node scripts/expand-legendary-players.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DECK_PATH = join(__dirname, '../data/decks/fifa_world_cup.json');

const deck = JSON.parse(readFileSync(DECK_PATH, 'utf8'));

// ============================================================
// NEW FACTS — ~30 additions for legendary_players sub-deck
// chainThemeId: 2 (legendary_players), subDeckId: 'legendary_players'
// ============================================================

const NEW_FACTS = [

  // -------------------------------------------------------
  // PELÉ — expanding from 3 to 5 facts (+2 new)
  // -------------------------------------------------------
  {
    id: 'legend_pele_1958_semifinal_hattrick',
    correctAnswer: 'France',
    chainThemeId: 2,
    answerTypePoolId: 'winner_country_names_mens',
    difficulty: 3,
    funScore: 9,
    distractors: ['Sweden', 'West Germany', 'England', 'Soviet Union'],
    quizQuestion: 'Against which team did a 17-year-old Brazilian forward score a hat-trick in the 1958 World Cup semifinal — becoming the youngest player ever to do so?',
    explanation: "Pelé scored three goals against France in the 1958 semifinal at the age of 17 years and 244 days — a record for the youngest hat-trick scorer in World Cup history. Brazil went on to win the 1958 final against Sweden, giving Pelé his first of three titles.",
    wowFactor: "Seventeen years old, hat-trick in the World Cup semifinal — Pelé announced himself to the planet in a single match.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Pel%C3%A9',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },
  {
    id: 'legend_pele_1970_final_header',
    correctAnswer: 'Pelé',
    chainThemeId: 2,
    answerTypePoolId: 'men_player_names',
    difficulty: 3,
    funScore: 9,
    distractors: ['Garrincha', 'Jairzinho', 'Tostão', 'Gérson'],
    quizQuestion: "Which Brazilian forward opened the scoring in the 1970 World Cup Final against Italy with a header, completing a perfect team move that is still considered the greatest goal in final history?",
    explanation: "Pelé met a Carlos Alberto cross with a perfectly timed header to open the scoring in the 1970 final, which Brazil won 4-1 against Italy. The same match ended with Carlos Alberto's iconic thunderbolt — often called the greatest World Cup final of all time.",
    wowFactor: "The 1970 final: Pelé headed the first, Carlos Alberto thunderbolted the fourth. Italy were helpless.",
    sourceUrl: 'https://en.wikipedia.org/wiki/1970_FIFA_World_Cup_Final',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },

  // -------------------------------------------------------
  // MARADONA — expanding from 2 to 5 facts (+3 new)
  // -------------------------------------------------------
  {
    id: 'legend_maradona_hand_of_god_country',
    correctAnswer: 'England',
    chainThemeId: 2,
    answerTypePoolId: 'winner_country_names_mens',
    difficulty: 2,
    funScore: 10,
    distractors: ['West Germany', 'Italy', 'Belgium', 'France'],
    quizQuestion: "Diego Maradona scored both the 'Hand of God' goal and the 'Goal of the Century' in the same 1986 World Cup quarterfinal match — against which country?",
    explanation: "In the 1986 quarterfinal against England, Maradona first punched the ball into the net with his hand (claiming it was 'the hand of God') and then dribbled past five players and the goalkeeper for what FIFA voters later chose as the Goal of the Century. Argentina won 2-1 and went on to win the tournament.",
    wowFactor: "In one match against England, Maradona committed the most notorious cheat in football history AND produced the greatest individual goal ever scored.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Diego_Maradona',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },
  {
    id: 'legend_maradona_1990_final_opponent',
    correctAnswer: 'West Germany',
    chainThemeId: 2,
    answerTypePoolId: 'winner_country_names_mens',
    difficulty: 3,
    funScore: 7,
    distractors: ['Italy', 'Brazil', 'Argentina', 'England'],
    quizQuestion: "Diego Maradona captained Argentina to the 1990 World Cup Final, which they lost 1-0. Which country defeated them in that final?",
    explanation: "West Germany beat Argentina 1-0 in the 1990 final in Rome — a rematch of the 1986 final that Argentina had won. A controversial late penalty decided the match. Maradona wept on the pitch, leaving with a suspension that would haunt the end of his international career.",
    wowFactor: "1986 final: Argentina beat West Germany. 1990 final: West Germany beat Argentina. The greatest rematch in World Cup history.",
    sourceUrl: 'https://en.wikipedia.org/wiki/1990_FIFA_World_Cup_Final',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },
  {
    id: 'legend_maradona_wc_goals',
    correctAnswer: 8,
    chainThemeId: 2,
    answerTypePoolId: 'world_cup_goal_tallies',
    difficulty: 3,
    funScore: 7,
    distractors: [12, 10, 6, 15],
    quizQuestion: "How many goals did Diego Maradona score across his four World Cup tournaments (1982, 1986, 1990, 1994)?",
    explanation: "Maradona scored 8 goals in 21 World Cup matches. While not the highest tally, his combination of goals, assists, and individual match-winning performances in 1986 make him the most impactful single player in World Cup history by many accounts.",
    wowFactor: "8 goals in 21 matches — but one of those 8 was possibly the most famous ever scored, and another was possibly the most notorious.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Diego_Maradona',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },

  // -------------------------------------------------------
  // MESSI — expanding from 1 to 4 facts (+3 new)
  // -------------------------------------------------------
  {
    id: 'legend_messi_2006_youngest_arg',
    correctAnswer: 'Messi',
    chainThemeId: 2,
    answerTypePoolId: 'men_player_names',
    difficulty: 3,
    funScore: 7,
    distractors: ['Tevez', 'Riquelme', 'Crespo', 'Saviola'],
    quizQuestion: "Which Argentine player became the youngest goal scorer in his country's World Cup history when he scored against Serbia and Montenegro at the 2006 World Cup at age 18?",
    explanation: "At 18 years and 357 days old, Messi came off the bench to score Argentina's sixth goal against Serbia and Montenegro in 2006 — the youngest Argentine to score at a World Cup. It was a hint of what was to come across five more tournaments.",
    wowFactor: "Youngest Argentine scorer at a World Cup — and 16 years later, he'd finally lift the trophy.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Lionel_Messi',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },
  {
    id: 'legend_messi_2014_golden_ball',
    correctAnswer: 2014,
    chainThemeId: 2,
    answerTypePoolId: 'mens_wc_years',
    difficulty: 3,
    funScore: 8,
    distractors: [2018, 2010, 2006, 2022],
    quizQuestion: "In which year did Lionel Messi win a controversial World Cup Golden Ball despite Argentina losing the final to Germany — a decision many felt was politically motivated?",
    explanation: "Messi won the 2014 Golden Ball after scoring 4 goals and assisting in Argentina's run to the final, which they lost 1-0 to Germany in extra time. The award was widely debated, with many arguing Germany's Manuel Neuer or Götze deserved it more. Messi himself admitted it felt hollow without the trophy.",
    wowFactor: "The Golden Ball without the gold trophy — Messi's 2014 win sparked one of football's most enduring debates.",
    sourceUrl: 'https://en.wikipedia.org/wiki/2014_FIFA_World_Cup',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },
  {
    id: 'legend_messi_career_wc_goals',
    correctAnswer: 13,
    chainThemeId: 2,
    answerTypePoolId: 'world_cup_goal_tallies',
    difficulty: 3,
    funScore: 8,
    distractors: [10, 8, 16, 11],
    quizQuestion: "How many goals has Lionel Messi scored across his five World Cup tournaments — the most of any Argentine player in history?",
    explanation: "Messi scored 13 World Cup goals across 2006, 2010, 2014, 2018, and 2022, including 7 goals and 3 assists in the 2022 tournament alone. His 2022 campaign, capped with the title, is widely considered the greatest individual World Cup performance by any player.",
    wowFactor: "13 World Cup goals across five tournaments — the last one finally came with a winner's medal.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Lionel_Messi',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },

  // -------------------------------------------------------
  // CRISTIANO RONALDO — new player, 4 facts
  // -------------------------------------------------------
  {
    id: 'legend_cr7_five_wcs_scorer',
    correctAnswer: 'Cristiano Ronaldo',
    chainThemeId: 2,
    answerTypePoolId: 'men_player_names',
    difficulty: 2,
    funScore: 9,
    distractors: ['Messi', 'Klose', 'Ronaldo (Brazil)', 'Müller'],
    quizQuestion: "Which Portuguese striker became the first man to score at five different FIFA World Cups, achieving the feat at Qatar 2022 at age 37?",
    explanation: "Cristiano Ronaldo scored in 2006, 2010, 2014, 2018, and 2022, making him the only man to score in five different World Cup tournaments. He shares this record with no one else. Portugal reached the quarterfinals in 2022 without him scoring in the knockout stages.",
    wowFactor: "Five World Cups, five scored — no man has ever done that before.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Cristiano_Ronaldo',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },
  {
    id: 'legend_cr7_hattrick_spain_2018',
    correctAnswer: 'Spain',
    chainThemeId: 2,
    answerTypePoolId: 'winner_country_names_mens',
    difficulty: 2,
    funScore: 10,
    distractors: ['Morocco', 'Iran', 'Uruguay', 'France'],
    quizQuestion: "Against which World Cup opponent did Cristiano Ronaldo score a hat-trick in the 2018 group stage — including a stunning last-minute free kick to draw 3-3?",
    explanation: "In a breathtaking 3-3 draw with Spain at the 2018 World Cup, Cristiano Ronaldo scored all three of Portugal's goals, including a stoppage-time free kick into the top corner. It remains one of the most dramatic individual performances in World Cup group stage history.",
    wowFactor: "3-3 vs Spain in a World Cup group game, all three goals from the same man, the last one in stoppage time. Pure theatre.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Cristiano_Ronaldo',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },
  {
    id: 'legend_cr7_wc_goals',
    correctAnswer: 8,
    chainThemeId: 2,
    answerTypePoolId: 'world_cup_goal_tallies',
    difficulty: 3,
    funScore: 7,
    distractors: [13, 12, 5, 10],
    quizQuestion: "How many World Cup goals has Cristiano Ronaldo scored across his five tournaments with Portugal?",
    explanation: "Cristiano Ronaldo scored 8 World Cup goals across 2006, 2010, 2014, 2018, and 2022 — with all of those goals coming in the group stage or early rounds, as Portugal never reached a final. His World Cup record contrasts with his domestic tally of 900+ career club and international goals.",
    wowFactor: "8 World Cup goals across 5 tournaments — all group-stage or early round, no knockout goals in his entire World Cup career.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Cristiano_Ronaldo',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },

  // -------------------------------------------------------
  // RONALDO (BRAZIL) — expanding from 3 to 4 facts (+1 new)
  // -------------------------------------------------------
  {
    id: 'legend_ronaldo_brazil_1998_illness',
    correctAnswer: 'Ronaldo (Brazil)',
    chainThemeId: 2,
    answerTypePoolId: 'men_player_names',
    difficulty: 3,
    funScore: 9,
    distractors: ['Rivaldo', 'Romário', 'Bebeto', 'Denilson'],
    quizQuestion: "Which Brazilian striker suffered a mysterious pre-match convulsive fit on the day of the 1998 World Cup Final, was initially left out of the lineup, and then reportedly re-added hours before kickoff — as France won 3-0?",
    explanation: "The 1998 final is haunted by what happened before it. Ronaldo (Brazil) had a convulsive episode at the team hotel on the day of the match and was initially left off the team sheet, then restored hours later. He played but was clearly unwell; France won 3-0. The truth of what happened has never been fully explained.",
    wowFactor: "The greatest striker in the world collapses the morning of the World Cup Final — and nobody has ever fully explained why.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Ronaldo_(Brazilian_footballer)',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },

  // -------------------------------------------------------
  // ZIDANE — expanding from 1 to 4 facts (+3 new)
  // -------------------------------------------------------
  {
    id: 'legend_zidane_1998_final_brace',
    correctAnswer: 'Brazil',
    chainThemeId: 2,
    answerTypePoolId: 'winner_country_names_mens',
    difficulty: 2,
    funScore: 9,
    distractors: ['Italy', 'West Germany', 'Argentina', 'Netherlands'],
    quizQuestion: "Zinedine Zidane scored two headed goals in the first half of the 1998 World Cup Final as France won 3-0 — against which opponent?",
    explanation: "Zidane headed two corners into the net from Youri Djorkaeff deliveries in the first half to give France a 2-0 lead against Brazil at the Stade de France. Emmanuel Petit added a third late on. It remains France's greatest footballing night and launched Zidane into global superstardom.",
    wowFactor: "Two headed goals from a midfielder in a World Cup final — against Brazil — in front of your home crowd.",
    sourceUrl: 'https://en.wikipedia.org/wiki/1998_FIFA_World_Cup_Final',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },
  {
    id: 'legend_zidane_headbutt_player',
    correctAnswer: 'Zinedine Zidane',
    chainThemeId: 2,
    answerTypePoolId: 'men_player_names',
    difficulty: 2,
    funScore: 10,
    distractors: ['Thierry Henry', 'Patrick Vieira', 'Robert Pires', 'Lilian Thuram'],
    quizQuestion: "Which French midfielder was sent off in the final minutes of the 2006 World Cup Final for headbutting Italian defender Marco Materazzi in the chest — in his final professional match?",
    explanation: "Zinedine Zidane's headbutt on Marco Materazzi in the 109th minute of extra time in the 2006 final was his last ever act as a professional footballer. He received a red card and walked past the World Cup trophy as France went on to lose the final on penalties to Italy. Materazzi later admitted he had taunted Zidane with an insult about his sister.",
    wowFactor: "He walked past the World Cup trophy on his way off the pitch after the red card. His last act in football. Ever.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Zinedine_Zidane',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },
  {
    id: 'legend_zidane_nationality',
    correctAnswer: 'France',
    chainThemeId: 2,
    answerTypePoolId: 'winner_country_names_mens',
    difficulty: 1,
    funScore: 6,
    distractors: ['Algeria', 'Spain', 'Italy', 'Belgium'],
    quizQuestion: "Which country did Zinedine Zidane represent at the FIFA World Cup — winning it in 1998 and reaching the final again in 2006?",
    explanation: "Born in Marseille to Algerian parents, Zidane chose to represent France and became one of the greatest players in French football history. His 1998 brace in the final and his 2006 Golden Ball (despite the red card) bookend a remarkable World Cup career that earned two final appearances.",
    wowFactor: "Son of Algerian immigrants, winner for France, Golden Ball in his final match — Zidane's story is as complex as his football.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Zinedine_Zidane',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },

  // -------------------------------------------------------
  // MBAPPÉ — expanding from 1 to 3 facts (+2 new)
  // -------------------------------------------------------
  {
    id: 'legend_mbappe_youngest_final_scorer',
    correctAnswer: 'Pelé',
    chainThemeId: 2,
    answerTypePoolId: 'men_player_names',
    difficulty: 3,
    funScore: 8,
    distractors: ['Ronaldo (Brazil)', 'Zinedine Zidane', 'Garrincha', 'Gerd Müller'],
    quizQuestion: "Kylian Mbappé became the second teenager to score in a World Cup Final when he netted in the 2018 final at age 19 — which player was the first?",
    explanation: "Pelé scored in the 1958 World Cup Final at age 17, and Mbappé scored in the 2018 final at age 19 — becoming only the second teenager ever to score in a World Cup Final. Mbappé also became the first teenager to score in a final since Pelé's feat 60 years earlier.",
    wowFactor: "Only the second teenager in World Cup final history to score — the first was Pelé, 60 years earlier.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Kylian_Mbapp%C3%A9',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },
  {
    id: 'legend_mbappe_2022_final_hattrick',
    correctAnswer: 3,
    chainThemeId: 2,
    answerTypePoolId: 'world_cup_goal_tallies',
    difficulty: 2,
    funScore: 10,
    distractors: [2, 4, 1, 5],
    quizQuestion: "How many goals did Kylian Mbappé score in the 2022 World Cup Final — including a late brace that forced extra time before Argentina won on penalties?",
    explanation: "Mbappé scored a hat-trick in the 2022 final, becoming only the second player ever to do so (after Geoff Hurst in 1966). With France trailing 3-1 with 10 minutes left, he scored twice to level at 3-3, then scored again in extra time before Argentina won the penalty shootout. It was the greatest World Cup final in modern history.",
    wowFactor: "A hat-trick in a losing final. 3-1 down with 10 minutes left. The greatest World Cup final comeback that still ended in defeat.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Kylian_Mbapp%C3%A9',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },

  // -------------------------------------------------------
  // JUST FONTAINE — expanding from 1 to 2 facts (+1 new)
  // -------------------------------------------------------
  {
    id: 'legend_fontaine_only_wc',
    correctAnswer: 1958,
    chainThemeId: 2,
    answerTypePoolId: 'mens_wc_years',
    difficulty: 3,
    funScore: 9,
    distractors: [1954, 1962, 1966, 1950],
    quizQuestion: "In which year did Just Fontaine play his only World Cup — scoring 13 goals in 6 games to set an all-time single-tournament record that still stands?",
    explanation: "Fontaine played only one World Cup — 1958 in Sweden — and scored 13 goals in 6 games. A knee injury ended his career before the next tournament. His record of 13 goals in a single World Cup remains unbroken over 65 years later and is considered one of the most unbreakable records in football.",
    wowFactor: "One World Cup, 13 goals, one knee injury — and that record has stood for over 65 years.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Just_Fontaine',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },

  // -------------------------------------------------------
  // GERD MÜLLER — expanding from 1 to 3 facts (+2 new)
  // -------------------------------------------------------
  {
    id: 'legend_gerd_muller_1974_final_winner',
    correctAnswer: 'Gerd Müller',
    chainThemeId: 2,
    answerTypePoolId: 'men_player_names',
    difficulty: 3,
    funScore: 8,
    distractors: ['Franz Beckenbauer', 'Paul Breitner', 'Sepp Maier', 'Helmut Schön'],
    quizQuestion: "Which West German striker scored the winning goal in the 1974 World Cup Final against the Netherlands — his last act in international football before announcing his retirement?",
    explanation: "Gerd Müller scored the 43rd-minute winner in the 1974 final against the Netherlands, giving West Germany a 2-1 victory. It was the last goal of his international career — he announced his retirement from the national team immediately after, having scored 14 World Cup goals and 68 international goals in total.",
    wowFactor: "His last ever international goal was the World Cup winner. Then he walked away. Job done.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Gerd_M%C3%BCller',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },
  {
    id: 'legend_gerd_muller_nationality',
    correctAnswer: 'West Germany',
    chainThemeId: 2,
    answerTypePoolId: 'winner_country_names_mens',
    difficulty: 2,
    funScore: 6,
    distractors: ['Germany', 'Austria', 'Netherlands', 'Switzerland'],
    quizQuestion: "Which country did Gerd Müller — the third-highest World Cup scorer of all time — represent when he won the 1974 World Cup?",
    explanation: "Gerd Müller represented West Germany (not Germany) at two World Cups — 1970 and 1974 — scoring 14 goals across both tournaments. The German reunification in 1990 means all pre-1991 German players represented 'West Germany', a distinction important for football records.",
    wowFactor: "Third on the all-time scorer list — and both his World Cups were for West Germany, a country that no longer exists.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Gerd_M%C3%BCller',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },

  // -------------------------------------------------------
  // KLOSE — expanding from 2 to 3 facts (+1 new)
  // -------------------------------------------------------
  {
    id: 'legend_klose_2014_title',
    correctAnswer: 2014,
    chainThemeId: 2,
    answerTypePoolId: 'mens_wc_years',
    difficulty: 2,
    funScore: 8,
    distractors: [2010, 2006, 2002, 2018],
    quizQuestion: "In which year did Miroslav Klose win his only World Cup title with Germany — at age 36, becoming a champion alongside the generation he had inspired?",
    explanation: "Klose won the 2014 World Cup with Germany in Brazil, aged 36, after three previous tournaments (2002, 2006, 2010). He scored 1 goal in 2014 to bring his all-time record to 16. The 2014 semifinal 7-1 win over Brazil — the Mineirazo — happened with Klose on the pitch.",
    wowFactor: "Four World Cups, 16 goals, finally a winner's medal — at age 36 in enemy territory (Brazil).",
    sourceUrl: 'https://en.wikipedia.org/wiki/Miroslav_Klose',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },

  // -------------------------------------------------------
  // FRANZ BECKENBAUER — expanding from 1 to 3 facts (+2 new)
  // -------------------------------------------------------
  {
    id: 'legend_beckenbauer_1974_captain',
    correctAnswer: 1974,
    chainThemeId: 2,
    answerTypePoolId: 'mens_wc_years',
    difficulty: 3,
    funScore: 7,
    distractors: [1970, 1966, 1978, 1982],
    quizQuestion: "In which year did Franz Beckenbauer captain West Germany to the World Cup title — 16 years before he would manage the same country to another title in 1990?",
    explanation: "Beckenbauer captained West Germany to the 1974 World Cup title on home soil, defeating the Netherlands 2-1 in the final. In 1990, as manager, he led Germany to a third title against Argentina. He remains one of only two people ever to win the World Cup as both captain and coach; the other is Mario Zagallo of Brazil.",
    wowFactor: "Captain in 1974, manager in 1990 — 16 years apart. The only German to win the World Cup in both roles.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Franz_Beckenbauer',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },
  {
    id: 'legend_zagallo_four_titles',
    correctAnswer: 'Brazil',
    chainThemeId: 2,
    answerTypePoolId: 'winner_country_names_mens',
    difficulty: 3,
    funScore: 9,
    distractors: ['Argentina', 'West Germany', 'Italy', 'France'],
    quizQuestion: "Mario Zagallo is the only person in football history to win the World Cup in four different roles — player (1958, 1962), head coach (1970), and assistant coach (1994). Which country did he serve throughout?",
    explanation: "Mario Zagallo's four World Cup titles as player (1958, 1962), head coach (1970), and assistant (1994) with Brazil is unmatched in football history. Beckenbauer won as player and coach (2 roles); Zagallo won in 4 distinct roles across 36 years, all with the same nation.",
    wowFactor: "Four World Cups, four roles (player, player, head coach, assistant), all with Brazil. No one else comes close.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Mario_Zagallo',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },

  // -------------------------------------------------------
  // MARTA — expanding from 3 to 5 facts (+2 new)
  // -------------------------------------------------------
  {
    id: 'legend_marta_2007_silver_boot_goals',
    correctAnswer: 7,
    chainThemeId: 2,
    answerTypePoolId: 'world_cup_goal_tallies',
    difficulty: 3,
    funScore: 8,
    distractors: [5, 9, 6, 10],
    quizQuestion: "How many goals did Marta score at the 2007 Women's World Cup — winning both the Golden Ball (best player) and Silver Boot (second-top scorer)?",
    explanation: "Marta scored 7 goals at the 2007 Women's World Cup in China, winning the Golden Ball as best player and the Silver Boot as second-top scorer (Germany's Birgit Prinz scored the same). Brazil reached the final but lost to Germany. Marta's 2007 tournament is widely considered the greatest individual performance in Women's World Cup history.",
    wowFactor: "7 goals, Golden Ball, Silver Boot — yet her team still lost the final. The greatest individual performance that came up just short.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Marta_(footballer)',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },
  {
    id: 'legend_marta_oldest_scorer_2019',
    correctAnswer: 33,
    chainThemeId: 2,
    answerTypePoolId: 'world_cup_goal_tallies',
    difficulty: 4,
    funScore: 8,
    distractors: [30, 35, 38, 29],
    quizQuestion: "How old was Marta when she became the oldest goalscorer in Women's World Cup history at the 2019 tournament in France?",
    explanation: "Marta scored against Italy at the 2019 Women's World Cup at age 33 years and 133 days, becoming the oldest scorer in Women's World Cup history at the time. That goal was her 17th career Women's World Cup goal — the all-time record. Brazil still lost in the round of 16.",
    wowFactor: "33 years old, 17th World Cup goal, oldest scorer ever — Brazil still went out in the round of 16. The record came in defeat.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Marta_(footballer)',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },

  // -------------------------------------------------------
  // ABBY WAMBACH — expanding from 1 to 3 facts (+2 new)
  // -------------------------------------------------------
  {
    id: 'legend_wambach_122nd_minute',
    correctAnswer: 'Abby Wambach',
    chainThemeId: 2,
    answerTypePoolId: 'women_player_names',
    difficulty: 2,
    funScore: 10,
    distractors: ['Megan Rapinoe', 'Carli Lloyd', 'Hope Solo', 'Alex Morgan'],
    quizQuestion: "Which American striker scored in the 122nd minute of the 2011 Women's World Cup quarterfinal against Brazil — one of the most dramatic headers in the history of the sport — to force a penalty shootout the USA eventually won?",
    explanation: "With the USA reduced to 10 players and down to their last moments against Brazil in the 2011 quarterfinal, Megan Rapinoe crossed from the left and Wambach headed in from close range in the 122nd minute. The USA then won on penalties and eventually finished as runners-up. ESPN voted it the greatest women's sports moment of the decade.",
    wowFactor: "122nd minute, 10 players vs 11, Brazil, and the header that kept the dream alive. Sports doesn't get more dramatic.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Abby_Wambach',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },
  {
    id: 'legend_wambach_2015_title',
    correctAnswer: 2015,
    chainThemeId: 2,
    answerTypePoolId: 'womens_wc_years',
    difficulty: 2,
    funScore: 7,
    distractors: [2011, 2007, 2019, 2003],
    quizQuestion: "In which year did Abby Wambach win the Women's World Cup with the USA — her first and only title, in her final tournament?",
    explanation: "Wambach won the 2015 Women's World Cup with the USA in Canada, in what proved to be her final World Cup tournament. The USA beat Japan 5-2 in the final, with Carli Lloyd scoring a hat-trick. Wambach retired shortly after, holding the all-time international goals record (184) for both men and women.",
    wowFactor: "Four World Cups, one title — won in her final tournament, alongside the Carli Lloyd hat-trick that made the 2015 final famous.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Abby_Wambach',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },

  // -------------------------------------------------------
  // BIRGIT PRINZ — expanding from 1 to 3 facts (+2 new)
  // -------------------------------------------------------
  {
    id: 'legend_birgit_prinz_wc_goals',
    correctAnswer: 14,
    chainThemeId: 2,
    answerTypePoolId: 'world_cup_goal_tallies',
    difficulty: 3,
    funScore: 7,
    distractors: [17, 10, 8, 12],
    quizQuestion: "How many Women's World Cup goals did Birgit Prinz score in her career — the record she held until Marta broke it?",
    explanation: "Birgit Prinz scored 14 goals in Women's World Cup tournaments from 1995 to 2011, holding the all-time record until Marta surpassed her in 2007. Prinz also won the FIFA Women's World Player of the Year award three consecutive times (2003, 2004, 2005) and won the World Cup with Germany in 2003 and 2007.",
    wowFactor: "14 goals, two World Cup titles, three FIFA Player of the Year awards — then Marta showed up.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Birgit_Prinz',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },
  {
    id: 'legend_birgit_prinz_nationality',
    correctAnswer: 'Germany',
    chainThemeId: 2,
    answerTypePoolId: 'winner_country_names_mens',
    difficulty: 2,
    funScore: 6,
    distractors: ['USA', 'Brazil', 'Sweden', 'Norway'],
    quizQuestion: "Which country did Women's World Cup legend Birgit Prinz represent — winning consecutive World Cup titles in 2003 and 2007?",
    explanation: "Birgit Prinz represented Germany throughout a career spanning five World Cups (1995–2011), winning back-to-back titles in 2003 (vs Sweden) and 2007 (vs Brazil). She is considered the greatest European player in Women's World Cup history and one of the most decorated players globally.",
    wowFactor: "Back-to-back Women's World Cup titles — Germany's most decorated player in women's football history.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Birgit_Prinz',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },

  // -------------------------------------------------------
  // CARLI LLOYD — expanding from 1 to 3 facts (+2 new)
  // -------------------------------------------------------
  {
    id: 'legend_carli_lloyd_2015_golden_ball',
    correctAnswer: 2015,
    chainThemeId: 2,
    answerTypePoolId: 'womens_wc_years',
    difficulty: 3,
    funScore: 8,
    distractors: [2011, 2007, 2019, 2003],
    quizQuestion: "In which year did Carli Lloyd win the Women's World Cup Golden Ball — the same year she scored a hat-trick in the final, including a goal from the halfway line?",
    explanation: "Carli Lloyd won the 2015 Women's World Cup Golden Ball after scoring 3 goals in the final against Japan in 16 minutes — the third was a stunning strike from the halfway line that left the Japanese goalkeeper stranded. The USA won 5-2. Lloyd also scored a Golden Ball-winning brace in the 2008 Olympics final, making her one of the most clutch big-game players in women's football history.",
    wowFactor: "Hat-trick in 16 minutes in a World Cup final — the third from the halfway line. It was the biggest stage and she was at her absolute best.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Carli_Lloyd',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },
  {
    id: 'legend_carli_lloyd_opponent_2015',
    correctAnswer: 'Japan',
    chainThemeId: 2,
    answerTypePoolId: 'winner_country_names_womens',
    difficulty: 2,
    funScore: 8,
    distractors: ['Germany', 'Brazil', 'Sweden', 'England'],
    quizQuestion: "Against which country did Carli Lloyd score her famous 2015 Women's World Cup Final hat-trick — the opponents who had defeated the USA in the 2011 final?",
    explanation: "Japan defeated the USA in the 2011 Women's World Cup Final on penalties. The 2015 rematch in the final saw the USA win 5-2, with Carli Lloyd scoring 3 in the first 16 minutes. The result was seen as revenge for 2011 and a statement by the USA that they had reclaimed their dominance of the women's game.",
    wowFactor: "Japan beat them in 2011 — the USA came back four years later and scored 5 in the final. Lloyd scored 3 of them.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Carli_Lloyd',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },

  // -------------------------------------------------------
  // HOMARE SAWA — expanding from 1 to 3 facts (+2 new)
  // -------------------------------------------------------
  {
    id: 'legend_homare_sawa_2011_title',
    correctAnswer: 2011,
    chainThemeId: 2,
    answerTypePoolId: 'womens_wc_years',
    difficulty: 2,
    funScore: 8,
    distractors: [2007, 2015, 2019, 2003],
    quizQuestion: "In which year did Homare Sawa captain Japan to their first Women's World Cup title — in a tournament where she won both the Golden Ball and Golden Boot?",
    explanation: "Sawa captained Japan to their first and only Women's World Cup title in 2011, defeating the USA on penalties. She won both the Golden Ball (best player) and Golden Boot (top scorer with 5 goals), becoming the first Asian player to win the Women's World Cup Golden Ball. Japan dedicated the victory to victims of the Tōhoku earthquake and tsunami earlier that year.",
    wowFactor: "Captain, Golden Ball, Golden Boot — and the title dedicated to earthquake survivors. Japan's greatest sporting moment.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Homare_Sawa',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },
  {
    id: 'legend_homare_sawa_nationality',
    correctAnswer: 'Japan',
    chainThemeId: 2,
    answerTypePoolId: 'winner_country_names_womens',
    difficulty: 1,
    funScore: 6,
    distractors: ['China', 'South Korea', 'Australia', 'North Korea'],
    quizQuestion: "Which country did Homare Sawa represent — becoming the first player from her nation to win the Women's World Cup Golden Ball in 2011?",
    explanation: "Homare Sawa represented Japan in six Women's World Cups (1995–2015), a record for any player at the time. Her 2011 Golden Ball win made her the first Asian player to receive the award in Women's World Cup history. She retired in 2015 as Japan's most capped player.",
    wowFactor: "Six World Cups, the 2011 Golden Ball and Golden Boot — the first Asian player to win the Women's World Cup award.",
    sourceUrl: 'https://en.wikipedia.org/wiki/Homare_Sawa',
    subDeckId: 'legendary_players',
    categoryL1: 'sports_entertainment',
    categoryL2: 'football_soccer',
    sourceName: 'Wikipedia',
    volatile: false,
    ageGroup: 'all'
  },

];

// ============================================================
// MERGE INTO DECK
// ============================================================

// 1. Append new facts
deck.facts.push(...NEW_FACTS);

// 2. Update legendary_players subDeck.factIds
const legendarySubDeck = deck.subDecks.find(s => s.id === 'legendary_players');
const newIds = NEW_FACTS.map(f => f.id);
legendarySubDeck.factIds.push(...newIds);

// 3. Update answer type pools — add new factIds to relevant pools
const poolUpdates = {};
NEW_FACTS.forEach(f => {
  if (!poolUpdates[f.answerTypePoolId]) poolUpdates[f.answerTypePoolId] = [];
  poolUpdates[f.answerTypePoolId].push(f.id);
});

deck.answerTypePools.forEach(pool => {
  if (poolUpdates[pool.id]) {
    pool.factIds.push(...poolUpdates[pool.id]);
  }
});

// Print summary
console.log('New facts added:', NEW_FACTS.length);
console.log('Total facts:', deck.facts.length);
console.log('legendary_players factIds count:', legendarySubDeck.factIds.length);
console.log('\nPool updates:');
Object.entries(poolUpdates).forEach(([pid, ids]) => console.log(`  ${pid}: +${ids.length} (${ids.join(', ')})`));

// ============================================================
// WRITE FILE
// ============================================================
writeFileSync(DECK_PATH, JSON.stringify(deck, null, 2));
console.log('\nFile written successfully.');
