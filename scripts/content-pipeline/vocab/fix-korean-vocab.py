#!/usr/bin/env python3
"""
Fix Korean vocabulary answer quality issues in vocab-ko.json.

Phase 1: Apply 34 manual corrections for confirmed-wrong answers.
Phase 2: Extract clean answers from verbose definitions (pattern-based).
Phase 3: General cleanup (trailing periods, leading articles, quotes, spaces).
"""

import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
VOCAB_FILE = REPO_ROOT / "src/data/seed/vocab-ko.json"

# ---------------------------------------------------------------------------
# Phase 1: Manual corrections (confirmed wrong answers from audit)
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Phase 1b: Hardcoded fixes for NIKL definitions too vague for pattern extraction
# ---------------------------------------------------------------------------
COMMON_WORD_FIXES = {
    # Original 35 entries
    'ko-nikl-198':  'urgent',                   # 급하다
    'ko-nikl-206':  'joy, delight',             # 기쁨
    'ko-nikl-447':  'moment, point in time',    # 때
    'ko-nikl-461':  'to run',                   # 뛰다
    'ko-nikl-600':  'beyond, other side',       # 밖
    'ko-nikl-702':  'secret',                   # 비밀
    'ko-nikl-710':  'to fall in',               # 빠지다
    'ko-nikl-802':  'the world',                # 세계
    'ko-nikl-946':  'uncertain',                # 아무
    'ko-nikl-1000': 'complex, difficult',       # 어렵다
    'ko-nikl-1013': 'sometime',                 # 언젠가
    'ko-nikl-1058': 'zero',                     # 영
    'ko-nikl-1281': 'to write down',            # 적다
    'ko-nikl-1297': 'lunch time',               # 점심시간
    'ko-nikl-1506': 'to grow',                  # 자라다
    'ko-nikl-1592': 'student',                  # 학생
    'ko-nikl-1672': 'strenuous, hard',          # 힘들다
    'ko-nikl-1856': 'high-level',               # 고급
    'ko-nikl-1893': 'everywhere',               # 곳곳
    'ko-nikl-2056': 'recent times',             # 근래
    'ko-nikl-275':  'younger brother',          # 남동생
    'ko-nikl-280':  'husband',                  # 남편
    'ko-nikl-283':  'daytime',                  # 낮
    'ko-nikl-284':  'next year',                # 내년
    'ko-nikl-340':  'different',                # 다르다
    'ko-nikl-341':  'day after tomorrow',       # 모레
    'ko-nikl-418':  'pork',                     # 돼지고기
    'ko-nikl-497':  'bad-tasting',              # 맛없다
    'ko-nikl-518':  'excellent',                # 멋지다
    'ko-nikl-556':  'free (no charge)',         # 무료
    'ko-nikl-579':  'flour',                    # 밀가루
    'ko-nikl-240':  'vase',                     # 꽃병
    'ko-nikl-248':  'end, expiration',          # 끝
    'ko-nikl-306':  'yellow',                   # 노란색
    'ko-nikl-313':  'green',                    # 녹색

    # Extended batch — unambiguous NIKL definitions
    'ko-nikl-39':   'cold medicine',            # 감기약
    'ko-nikl-51':   'to return (borrowed item)',# 갚다
    'ko-nikl-174':  'therefore, for that reason',# 그래서
    'ko-nikl-239':  'bouquet',                  # 꽃다발
    'ko-nikl-244':  'to extinguish a fire',     # 끄다
    'ko-nikl-336':  'to be late',               # 늦다
    'ko-nikl-533':  'appearance, aspect',       # 면
    'ko-nikl-613':  'to become light, dawn',    # 밝다
    'ko-nikl-641':  'faster than expected',     # 빨리
    'ko-nikl-664':  'to visit an elder',        # 뵙다
    'ko-nikl-686':  'pink',                     # 분홍색
    'ko-nikl-715':  'briefly, in a short time', # 잠깐
    'ko-nikl-809':  'washing machine',          # 세탁기
    'ko-nikl-845':  'swimsuit',                 # 수영복
    'ko-nikl-877':  'clock',                    # 시계
    'ko-nikl-879':  'noisy, loud',              # 시끄럽다
    'ko-nikl-947':  'extremely, severely',      # 엄청나게
    'ko-nikl-961':  'musical instrument',       # 악기
    'ko-nikl-978':  'forward direction, front', # 앞쪽
    'ko-nikl-1009': 'yesterday',                # 어제
    'ko-nikl-1067': 'neighboring house',        # 옆집
    'ko-nikl-1107': 'foreign language',         # 외국어
    'ko-nikl-1189': 'right now, at this moment',# 지금
    'ko-nikl-1192': 'future, time ahead',       # 이후
    'ko-nikl-1290': 'possibly, wholly',         # 전혀
    'ko-nikl-1313': 'first place, number one',  # 첫째
    'ko-nikl-1369': 'present moment, right now',# 현재
    'ko-nikl-1428': 'first in order',           # 먼저
    'ko-nikl-1451': 'soccer ball',              # 축구공
    'ko-nikl-1464': 'ample, sufficient',        # 넉넉하다
    'ko-nikl-1537': 'cargo truck',              # 화물차
    'ko-nikl-1540': 'unusually, differently',   # 특별히
    'ko-nikl-1598': 'Hangeul (Korean alphabet)',# 한글
    'ko-nikl-1600': 'Hanbok (traditional dress)',# 한복
    'ko-nikl-1632': 'lake',                     # 호수
    'ko-nikl-1650': 'company employee',         # 회사원
    'ko-nikl-1670': 'white',                    # 흰색
    'ko-nikl-1692': 'gas',                      # 기체
    'ko-nikl-1706': 'each country',             # 각국
    'ko-nikl-1748': 'lecture room',             # 강의실
    'ko-nikl-1797': 'in-depth review',          # 검토
    'ko-nikl-1818': 'never, absolutely not',    # 결코
    'ko-nikl-1888': 'alley, narrow path',       # 골목
    'ko-nikl-1912': 'princess',                 # 공주
    'ko-nikl-1961': 'educator, teacher',        # 교육자
    'ko-nikl-2053': 'suburbs, outskirts',       # 근교
    'ko-nikl-2140': 'top, summit',              # 꼭대기
    'ko-nikl-2145': 'to be ranked',             # 들다
    'ko-nikl-2179': 'to get goosebumps',        # 돋다
    'ko-nikl-2202': 'to fly (through the air)', # 날다
    'ko-nikl-2206': 'old and worn out',         # 낡다
    'ko-nikl-2207': 'brother and younger sister',# 남매
    'ko-nikl-2218': 'to look outside from inside',# 내다보다
    'ko-nikl-2219': 'next month',               # 다음 달
    'ko-nikl-2236': 'cold water',               # 냉수
    'ko-nikl-2253': 'to overflow',              # 넘치다
    'ko-nikl-2286': 'farming village',          # 농촌
    'ko-nikl-2301': 'eye disease',              # 눈병
    'ko-nikl-2322': 'to sleep in late',         # 늦잠
    'ko-nikl-2365': 'US dollar',                # 달러
    'ko-nikl-2370': 'moonlight',                # 달빛
    'ko-nikl-2380': 'being in charge',          # 담당
    'ko-nikl-2381': 'person in charge',         # 담당자
    'ko-nikl-2382': 'genuine, frank',           # 담백하다
    'ko-nikl-2428': 'popular song',             # 대중가요
    'ko-nikl-2494': 'pebble, small stone',      # 돌멩이
    'ko-nikl-2538': 'headache medicine',        # 두통약
    'ko-nikl-2539': 'to look around',           # 둘러보다
    'ko-nikl-2552': 'back view, rear',          # 뒷모습
    'ko-nikl-2571': 'to let someone in',        # 들이다
    'ko-nikl-2577': 'hiking clothes',           # 등산복
    'ko-nikl-2597': 'depending on circumstances',# 따라서
    'ko-nikl-2613': 'definite, clear',          # 뚜렷하다
    'ko-nikl-2617': 'to run out quickly',       # 뛰쳐나오다
    'ko-nikl-2618': 'to jump down',             # 뛰어내리다
    'ko-nikl-2674': 'last bus or train',        # 막차
    'ko-nikl-2697': 'to face each other',       # 마주서다
    'ko-nikl-2730': 'haphazardly, randomly',    # 마구
    'ko-nikl-2766': 'thirsty',                  # 목마르다
    'ko-nikl-2785': 'ugly, unattractive',       # 못생기다
    'ko-nikl-2812': 'silently, without words',  # 묵묵히
    'ko-nikl-2824': 'skilled writer',           # 문장가
    'ko-nikl-2895': 'half price',               # 반값
    'ko-nikl-2922': 'step forward, footstep',   # 발걸음
    'ko-nikl-3007': 'to throw a party or feast',# 벌이다
    'ko-nikl-3051': 'pedestrian',               # 보행자
    'ko-nikl-3098': 'irregularity',             # 불규칙
    'ko-nikl-3113': 'quantity, amount',         # 수량
    'ko-nikl-3166': 'even so, nonetheless',     # 그래도
    'ko-nikl-3199': 'rainwater',                # 빗물
    'ko-nikl-3239': 'death',                    # 사망
    'ko-nikl-3251': 'content of a letter',      # 사연
    'ko-nikl-3252': 'method of use',            # 사용법
    'ko-nikl-3278': 'deep in the mountains',    # 산속
    'ko-nikl-3333': 'new home (after moving)',  # 새집
    'ko-nikl-3339': 'date of birth',            # 생년월일
    'ko-nikl-3347': 'living expenses',          # 생활비
    'ko-nikl-3348': 'basic necessities',        # 생필품
    'ko-nikl-3355': 'slowly, little by little', # 서서히
    'ko-nikl-3399': 'century',                  # 세기
    'ko-nikl-3434': 'urine',                    # 소변
    'ko-nikl-3478': 'honestly, sincerely',      # 솔직하게
    'ko-nikl-3498': 'repair cost',              # 수리비
    'ko-nikl-3555': 'humidity',                 # 습도
    'ko-nikl-3559': 'victory',                  # 승리
    'ko-nikl-3590': 'moment, point in time',    # 시점
    'ko-nikl-3600': 'restaurant street',        # 식당가
    'ko-nikl-3618': 'sour taste',               # 신맛
    'ko-nikl-3623': 'gentleman',                # 신사
    'ko-nikl-3624': 'new product, new release', # 신제품
    'ko-nikl-3648': 'practical, useful',        # 실용적
    'ko-nikl-3649': 'in truth, in reality',     # 실제로
    'ko-nikl-3655': 'real thing, reality',      # 실체
    'ko-nikl-3706': 'floor below, basement',    # 아래층
    'ko-nikl-3709': 'probably, likely',         # 아마
    'ko-nikl-3767': 'to put someone first',     # 앞세우다
    'ko-nikl-3791': 'both countries',           # 양국
    'ko-nikl-3889': 'professional actor',       # 연기자
    'ko-nikl-3892': 'age (years lived)',        # 연령
    'ko-nikl-3906': 'tender, soft',             # 연하다
    'ko-nikl-3954': 'for a long time',          # 오래
    'ko-nikl-4013': 'yogurt',                   # 요구르트
    'ko-nikl-4028': 'bravery, courage',         # 용기
    'ko-nikl-4038': 'funny, amusing',           # 우습다
    'ko-nikl-4064': 'to make someone laugh',    # 웃기다
    'ko-nikl-4082': 'remarkable, outstanding',  # 우수하다
    'ko-nikl-4098': 'glass window',             # 유리창
    'ko-nikl-4111': 'army, land forces',        # 육군
    'ko-nikl-4119': 'voice, sound of speech',   # 음성
    'ko-nikl-4155': 'advantageous, helpful',    # 유리하다
    'ko-nikl-4161': 'this way, in this direction',# 이쪽
    'ko-nikl-4163': 'just this much',           # 이만큼
    'ko-nikl-4164': 'about this much',          # 이 정도
    'ko-nikl-4177': 'out of range, outside',    # 이외
    'ko-nikl-4180': 'finally, at last',         # 이윽고
    'ko-nikl-4184': 'the next day',             # 이튿날
    'ko-nikl-4191': 'true nature, humanity',    # 인간성
    'ko-nikl-4198': 'all people, everyone',     # 인류
    'ko-nikl-4200': 'ginseng tea',              # 인삼차
    'ko-nikl-4208': 'human relationship',       # 인간관계
    'ko-nikl-4245': 'type, kind',               # 일종
    'ko-nikl-4248': 'sunrise, dawn',            # 일출
    'ko-nikl-4276': 'status, position',         # 지위
    'ko-nikl-4288': 'operating capital',        # 자금
    'ko-nikl-4369': 'low quality, low level',   # 저급
    'ko-nikl-4451': 'front, facing side',       # 정면
    'ko-nikl-4510': 'seasoning, condiment',     # 조미료
    'ko-nikl-4531': 'paper cup',                # 종이컵
    'ko-nikl-4532': 'daytime, from morning to evening',# 종일
    'ko-nikl-4565': 'bare branch, dead branch', # 죽은 가지
    'ko-nikl-4566': 'constantly, without stopping',# 줄곧
    'ko-nikl-4601': 'continuously, until now',  # 지금껏
    'ko-nikl-4639': 'true logic, reason',       # 진리
    'ko-nikl-4670': 'salty taste',              # 짠맛
    'ko-nikl-4700': 'train or car window',      # 차창
    'ko-nikl-4733': 'single woman',             # 처녀
    'ko-nikl-4767': 'beginning, start of a period',# 초
    'ko-nikl-4828': 'biological son',           # 친아들
    'ko-nikl-4862': 'important, hard task',     # 큰일
    'ko-nikl-4949': 'lifetime, lifespan',       # 평생
    'ko-nikl-4962': 'heavy snowfall',           # 폭설
    'ko-nikl-4979': 'traits, basis',            # 바탕
    'ko-nikl-4981': 'sufficient, plenty',       # 풍족하다
    'ko-nikl-4986': 'printer',                  # 프린터
    'ko-nikl-4998': 'necessity, need',          # 필요성
    'ko-nikl-5041': 'fairly long time',         # 한참
    'ko-nikl-5043': 'more than, exceeding',     # 이상
    'ko-nikl-5071': 'coastline, shore',         # 해안선
    'ko-nikl-5077': 'venue, event location',    # 행사장
    'ko-nikl-5157': 'lively, full of energy',   # 활기차다
    'ko-nikl-5223': 'moreover, to make it worse',# 더구나
    'ko-nikl-5242': 'fabrication, lies',        # 거짓말
    'ko-nikl-5246': 'residential building',     # 주거용 건물
    'ko-nikl-5261': 'various fields of society',# 각계각층
    'ko-nikl-5272': 'various places',           # 여러 곳
    'ko-nikl-5287': 'desperate wish, longing',  # 간절한 바람
    'ko-nikl-5321': 'just now, a moment ago',   # 방금
    'ko-nikl-5327': 'powerfully, forcefully',   # 강하게
    'ko-nikl-5334': 'mentally tough, tenacious',# 강인하다
    'ko-nikl-5335': 'powerful person',          # 권력자
    'ko-nikl-5376': 'large amount of money',    # 거액
    'ko-nikl-5403': 'cause for concern, worry', # 걱정거리
    'ko-nikl-5459': 'ending, conclusion',       # 결말
    'ko-nikl-5484': 'passage of time',          # 세월
    'ko-nikl-5526': 'planned, systematic',      # 계획적
    'ko-nikl-5528': 'expensive item',           # 고가품
    'ko-nikl-5530': 'high school student',      # 고등학생
    'ko-nikl-5532': 'distinguished, valuable',  # 고귀하다
    'ko-nikl-5564': 'highland, plateau',        # 고원
    'ko-nikl-5587': 'antique, old artifact',    # 골동품
    'ko-nikl-5626': 'for the public good',      # 공익
    'ko-nikl-5630': 'general public',           # 대중
    'ko-nikl-5734': 'job hunting',              # 구직
    'ko-nikl-5740': 'rescue, saving someone',   # 구조
    'ko-nikl-5744': 'old-fashioned style',      # 구식
    'ko-nikl-5747': 'national border',          # 국경
    'ko-nikl-5769': 'many places, everywhere',  # 곳곳
    'ko-nikl-5770': 'roasted chestnut',         # 군밤
    'ko-nikl-5819': 'severity, extreme degree', # 심각성
    'ko-nikl-5884': 'end of semester',          # 학기 말
    'ko-nikl-5900': 'to crawl',                 # 기다
    'ko-nikl-5910': 'very unusual, strange',    # 기이하다
    'ko-nikl-5982': 'tough, hard to cut',       # 질기다
    'ko-nikl-5997': 'more and more, increasingly',# 점점
    'ko-nikl-6022': 'hard to decide, hesitant', # 망설이다
    'ko-nikl-6030': 'more and more, increasingly',# 점점
    'ko-nikl-6047': 'flat and spread out',      # 납작하다
    'ko-nikl-6126': 'old age',                  # 노년
    'ko-nikl-6167': 'frown, wrinkle between brows',# 미간
    'ko-nikl-6185': 'excellent in a field',     # 뛰어나다
    'ko-nikl-6192': 'great quantity, plenty',   # 많음
    'ko-nikl-6193': 'similarly, in the same way',# 마찬가지로
    'ko-nikl-6278': 'peak season',              # 성수기
    'ko-nikl-6283': 'to cry loudly, wail',      # 엉엉 울다
    'ko-nikl-6285': 'substitute, replacement',  # 대체물
    'ko-nikl-6300': 'university district',      # 대학가
    'ko-nikl-6352': 'venomous snake',           # 독사
    'ko-nikl-6387': 'simultaneous interpretation',# 동시통역
    'ko-nikl-6443': 'plain, flat land',         # 평야
    'ko-nikl-6446': 'to come and go frequently',# 드나들다
    'ko-nikl-6447': 'to come and go frequently',# 드나들다
    'ko-nikl-6502': 'exactly right, perfect',   # 딱
    'ko-nikl-6508': 'to burst out quickly',     # 튀어나가다
    'ko-nikl-6509': 'to come bursting out',     # 튀어나오다
    'ko-nikl-6523': 'completion process',       # 마무리
    'ko-nikl-6528': 'reluctantly, against will',# 마지못해
    'ko-nikl-6534': 'enormous, very numerous',  # 막대하다
    'ko-nikl-6542': 'easily, without obstacles',# 막힘없이
    'ko-nikl-6562': 'to face closely',          # 맞대다
    'ko-nikl-6563': 'to hold at both ends',     # 맞잡다
    'ko-nikl-6641': 'everything, without exception',# 모두
    'ko-nikl-6676': 'appropriately, moderately',# 적당히
    'ko-nikl-6698': 'without thought, mechanically',# 무심코
    'ko-nikl-6734': 'water drop, droplet',      # 물방울
    'ko-nikl-6740': 'sense of taste',           # 미각
    'ko-nikl-6742': 'beautiful woman',          # 미인
    'ko-nikl-6745': 'beautiful face',           # 미모
    'ko-nikl-6832': 'all the time, day and night',# 밤낮으로
    'ko-nikl-6881': 'light red, pinkish red',   # 분홍빛
    'ko-nikl-6918': 'noticeably strange',       # 유별나다
    'ko-nikl-6978': 'mountain peak, summit',    # 산봉우리
    'ko-nikl-6991': 'I hope, if possible',      # 부디
    'ko-nikl-7032': 'powdered milk',            # 분유
    'ko-nikl-7035': 'powerful stream, jet',     # 분출
    'ko-nikl-7046': 'bad behavior, bad personality',# 못된 성격
    'ko-nikl-7069': 'unfortunately',            # 불행히도
    'ko-nikl-7093': 'immoral act',              # 불의
    'ko-nikl-7109': 'unbearably sad, dreadful', # 비참하다
    'ko-nikl-7147': 'sweating a lot',           # 땀을 흘리며
    'ko-nikl-7200': 'secluded mountain area',   # 산속 외딴 곳
    'ko-nikl-7235': 'upward trend',             # 상승세
    'ko-nikl-7274': 'living things, organisms', # 생물
    'ko-nikl-7298': 'detailed document',        # 상세 문서
    'ko-nikl-7350': 'sadness, sorrow',          # 슬픔
    'ko-nikl-7356': 'laws of nature',           # 자연법칙
    'ko-nikl-7358': 'absorption, intake',       # 섭취
    'ko-nikl-7360': 'donation, charity',        # 기부금
    'ko-nikl-7372': 'sincere personality',      # 성실한 성격
    'ko-nikl-7382': 'temper, personality',      # 성격
    'ko-nikl-7436': 'continuously, in succession',# 연달아
    'ko-nikl-7467': 'talking too much, verbose',# 수다스럽다
    'ko-nikl-7470': 'common, widespread',       # 흔하다
    'ko-nikl-7562': 'very urgently',            # 매우 급하게
    'ko-nikl-7568': 'era-specific characteristic',# 시대적 특성
    'ko-nikl-7605': 'eating habits',            # 식습관
    'ko-nikl-7606': 'edible, food-related',     # 식용
    'ko-nikl-7643': 'real-time, simultaneous',  # 실시간
    'ko-nikl-7675': 'eight or nine out of ten', # 십중팔구
    'ko-nikl-7676': 'fresh, clear, fragrant',   # 상쾌하다
    'ko-nikl-7765': 'very beginning',           # 시초
    'ko-nikl-7780': 'low value, weak tendency', # 낮은 경향
    'ko-nikl-7876': 'married woman (polite)',   # 부인
    'ko-nikl-7878': 'girl',                     # 여자아이
    'ko-nikl-7883': 'travel route, itinerary',  # 여행 경로
    'ko-nikl-7907': 'to have a lingering obsession',# 미련을 갖다
    'ko-nikl-7932': 'violent storm wind',       # 폭풍
    'ko-nikl-7943': 'cause, state of a matter', # 상태
    'ko-nikl-7972': 'arts and athletics',       # 예체능
    'ko-nikl-7975': 'brother and younger sister',# 남매
    'ko-nikl-7998': 'cloth, fabric',            # 천
    'ko-nikl-8012': 'royal palace',             # 궁궐
    'ko-nikl-8013': 'royal authority',          # 왕권
    'ko-nikl-8016': 'royal status, kingship',   # 왕위
    'ko-nikl-8031': 'imported product',         # 수입품
    'ko-nikl-8033': 'outer appearance',         # 외관
    'ko-nikl-8044': 'to summarize key points',  # 요약하다
    'ko-nikl-8051': 'method of use',            # 사용법
    'ko-nikl-8098': 'to exceed, surpass',       # 넘다
    'ko-nikl-8167': 'preschool child',          # 유아
    'ko-nikl-8169': 'groundless rumor',         # 유언비어
    'ko-nikl-8201': 'naturally, of course',     # 물론
    'ko-nikl-8204': 'steadily, not too strongly',# 꾸준히
    'ko-nikl-8207': 'vague, unclear',           # 희미하다
    'ko-nikl-8252': 'to burn with red flames',  # 타오르다
    'ko-nikl-8263': 'extraordinary, unique',    # 특이하다
    'ko-nikl-8265': 'no matter how hard one tries',# 아무리
    'ko-nikl-8280': 'consecutively, continuously',# 연속으로
    'ko-nikl-8286': 'beneficial thing',         # 이로운 것
    'ko-nikl-8324': 'daily newspaper',          # 일간지
    'ko-nikl-8342': 'to make a habit of',       # 습관화하다
    'ko-nikl-8343': 'routinization, normalization',# 일상화
    'ko-nikl-8345': 'scheduled date',           # 일정
    'ko-nikl-8383': 'independence, self-reliance',# 독립
    'ko-nikl-8428': 'leftover money, savings',  # 잔돈
    'ko-nikl-8437': 'worthless talk, chatter',  # 잡소리
    'ko-nikl-8446': 'specialty, strong suit',   # 장기
    'ko-nikl-8483': 'material characteristics', # 재질
    'ko-nikl-8498': 'to become dark, sunset',   # 어두워지다
    'ko-nikl-8525': 'year before last',         # 재작년
    'ko-nikl-8531': 'war strategy, tactics',    # 전략
    'ko-nikl-8539': 'entire field, everything', # 전반
    'ko-nikl-8575': 'mountain peak, top',       # 정상
    'ko-nikl-8613': 'first month of lunar year',# 정월
    'ko-nikl-8623': 'politician',               # 정치인
    'ko-nikl-8683': 'seed (of a plant)',        # 씨앗
    'ko-nikl-8765': 'severe hatred, resentment',# 원한
    'ko-nikl-8781': 'paper surface',            # 지면
    'ko-nikl-8804': 'terrain, surface features',# 지형
    'ko-nikl-8837': 'mass (amount of matter)',  # 질량
    'ko-nikl-8858': 'prickling sensation',      # 따끔하다
    'ko-nikl-8867': 'to poke, stab',            # 찌르다
    'ko-nikl-8903': 'natural flavor',           # 제 맛
    'ko-nikl-8955': 'first bus or train of the day',# 첫차
    'ko-nikl-8966': 'internal organs',          # 장기
    'ko-nikl-8995': 'bachelor, single man',     # 총각
    'ko-nikl-8996': 'total amount, sum',        # 총액
    'ko-nikl-9077': 'sense of closeness',       # 친밀감
    'ko-nikl-9078': 'closeness, intimacy',      # 친밀함
    'ko-nikl-9160': 'fur coat, fur clothing',   # 털옷
    'ko-nikl-9172': 'pathway, walkway',         # 통로
    'ko-nikl-9256': 'seller, vendor',           # 판매자
    'ko-nikl-9273': 'standard form, pattern',   # 패턴
    'ko-nikl-9328': 'strong wind, gale',        # 강풍
    'ko-nikl-9338': 'target object',            # 목표물
    'ko-nikl-9412': 'knowledge',                # 지식

    # Final pass — 42 remaining > 25 chars (26-30 range)
    'ko-nikl-174':  'therefore',                # 그래서
    'ko-nikl-186':  'just that much, no more',  # 그만큼
    'ko-nikl-1600': 'Hanbok (Korean dress)',    # 한복
    'ko-nikl-2207': 'brother and sister',       # 남매
    'ko-nikl-2218': 'to look out from inside',  # 내다보다
    'ko-nikl-2224': 'to dump out completely',   # 쏟아내다
    'ko-nikl-2597': 'depending on circumstances',# 따라서 — keep as-is (accurate)
    'ko-nikl-4161': 'this way, this direction', # 이쪽
    'ko-nikl-4175': 'to be connected, linked',  # 이어지다
    'ko-nikl-4380': 'to cause a problem',       # 일으키다
    'ko-nikl-4566': 'constantly, nonstop',      # 줄곧
    'ko-nikl-4767': 'beginning, early period',  # 초
    'ko-nikl-5223': 'moreover, even worse',     # 더구나
    'ko-nikl-5301': 'emotional sensitivity',    # 감성
    'ko-nikl-5956': '(endearing) little child', # 아이
    'ko-nikl-5997': 'more and more',            # 점점
    'ko-nikl-6030': 'more and more',            # 점점
    'ko-nikl-6167': 'frown, brow wrinkle',      # 미간
    'ko-nikl-6193': 'similarly, likewise',      # 마찬가지로
    'ko-nikl-6387': 'simultaneous interpretation',# 동시통역 — keep
    'ko-nikl-6641': 'everything, all',          # 모두
    'ko-nikl-6698': 'without thinking',         # 무심코
    'ko-nikl-6832': 'all the time, always',     # 밤낮으로
    'ko-nikl-7046': 'bad behavior, bad trait',  # 못된 성격
    'ko-nikl-7142': '(slang) to surpass',       # 능가하다
    'ko-nikl-7436': 'continuously, one after another',# 연달아 — > 25
    'ko-nikl-7538': 'to seep in gradually',     # 스며들다
    'ko-nikl-7568': 'era-specific trait',       # 시대적 특성
    'ko-nikl-7907': 'to linger with regret',    # 미련을 갖다
    'ko-nikl-7975': 'brother and sister',       # 남매
    'ko-nikl-8204': 'steadily, calmly',         # 꾸준히
    'ko-nikl-8265': 'no matter how hard',       # 아무리
    'ko-nikl-8280': 'consecutively',            # 연속으로
    'ko-nikl-8287': '(emphasis) until now',     # 지금껏
    'ko-nikl-8343': 'routinization',            # 일상화
    'ko-nikl-8383': 'independence',             # 독립
    'ko-nikl-8955': 'first bus or train',       # 첫차
    'ko-nikl-9066': 'to rise powerfully',       # 솟구치다
    'ko-nikl-9279': 'to spread widely',         # 퍼뜨리다
    'ko-nikl-9446': 'round of business, deal',  # 거래
    'ko-nikl-9455': 'animal trap, pit',         # 함정
    'ko-nikl-9548': 'to feel dizzy',            # 어지럽다
    'ko-nikl-9580': 'criminal case',            # 형사 사건
    'ko-nikl-9581': 'form, shape',              # 형태
    'ko-nikl-9594': 'quiet, remote',            # 외딴
    'ko-nikl-9645': 'powerful, vigorous',       # 활기차다
    'ko-nikl-9660': 'sixtieth birthday',        # 환갑
    'ko-nikl-9682': 'sense of smell',           # 후각
    'ko-nikl-9705': 'dimly bright, faint',      # 희미하다
}

CORRECTIONS = {
    'ko-nikl-9719': 'swept away',
    'ko-nikl-9228': 'to block, plug up',
    'ko-nikl-9626': 'burn (injury)',
    'ko-nikl-9539': 'futile, vain',
    'ko-nikl-9422': 'to the fullest',
    'ko-nikl-9486': 'tsunami',
    'ko-nikl-9246': 'to be buried',
    'ko-nikl-4787': 'best effort',
    'ko-nikl-4777': 'anxiety',
    'ko-nikl-4674': 'to chase',
    'ko-nikl-4821': 'side, aspect',
    'ko-nikl-5134': 'sunny, clear',
    'ko-nikl-4706': 'sesame oil',
    'ko-nikl-4625': 'zipper',
    'ko-nikl-4595': 'diagnosis',
    'ko-nikl-5201': 'excitement',
    'ko-nikl-4933': 'quite, very',
    'ko-nikl-5073': 'modern era',
    'ko-nikl-3404': 'triangle',
    'ko-nikl-5467': 'fruition',
    'ko-nikl-5241': 'to fade away',
    'ko-nikl-5411': 'half-heartedly',
    'ko-nikl-5233': 'patriarchal',
    'ko-nikl-5395': 'macroscopic',
    'ko-nikl-5575': 'hardship',
    'ko-nikl-6524': 'role, excuse',
    'ko-nikl-7262': 'flaw, defect',
    # Additional from beginner/intermediate audit
    'ko-nikl-1513': 'to ride',
    'ko-nikl-458':  'smart, clever',
    'ko-nikl-1713': 'barely, narrowly',
    'ko-nikl-1159': 'beverage',
    'ko-nikl-5133': 'topic, talking point',
    'ko-nikl-1576': 'to bloom, to smoke',
    'ko-nikl-1230': 'repeatedly',
}


# ---------------------------------------------------------------------------
# Phase 2: Pattern-based extraction for verbose definitions
# ---------------------------------------------------------------------------

def _extract_role_noun(text: str) -> str | None:
    """
    'person whose job it is to X'  →  role noun
    'person who X-s / person who was born as Y'  →  role noun
    """
    # "person whose job it is to sing" → "singer"
    m = re.match(r'person whose job it is to (.+)', text, re.IGNORECASE)
    if m:
        verb = m.group(1).strip().rstrip('.')
        role_map = {
            'sing': 'singer', 'teach': 'teacher', 'cook': 'cook',
            'drive': 'driver', 'act': 'actor', 'write': 'writer',
            'paint': 'painter', 'nurse': 'nurse', 'farm': 'farmer',
            'fish': 'fisher', 'hunt': 'hunter', 'manage': 'manager',
            'clean': 'cleaner', 'guard': 'guard', 'deliver': 'delivery person',
            'bake': 'baker', 'sell': 'seller', 'translate': 'translator',
            'design': 'designer', 'direct': 'director', 'report': 'reporter',
            'research': 'researcher', 'treat patients': 'doctor',
            'heal patients': 'doctor', 'perform surgery': 'surgeon',
        }
        return role_map.get(verb.lower(), verb + 'er' if not verb.endswith('e') else verb + 'r')

    # "person who performs in a movie" → "actor"
    # "person who goes on a tour"      → "tourist"
    # "person who was born as a male"  → "man"
    specific_map = {
        r'person who performs? in a movie': 'actor',
        r'person who goes? on a tour': 'tourist',
        r'person who was born as a male': 'man',
        r'person who was born as a female': 'woman',
        r'person who watches? something': 'spectator',
        r'person who leads? a group': 'leader',
        r'person who is? in charge': 'person in charge',
    }
    for pattern, result in specific_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result

    return None


def _extract_act_noun(text: str) -> str | None:
    """
    'act of X-ing' / 'action of X-ing'  →  noun form
    """
    act_map = {
        r'act of helping another person': 'help',
        r'act of reaching a destination': 'arrival',
        r'act of teaching students?': 'teaching',
        r'act of choosing among options?': 'choice',
        r'act of moving from one place to another': 'movement',
        r'act of receiving something': 'reception',
        r'act of giving something': 'giving',
        r'act of making something': 'making',
        r'act of meeting someone': 'meeting',
        r'act of buying something': 'purchase',
        r'act of selling something': 'sale',
        r'act of reading': 'reading',
        r'act of writing': 'writing',
        r'act of speaking': 'speaking',
        r'act of studying': 'studying',
        r'act of working': 'work',
        r'act of cooking': 'cooking',
        r'act of eating': 'eating',
        r'act of drinking': 'drinking',
        r'act of sleeping': 'sleeping',
        r'act of traveling': 'travel',
        r'act of returning': 'return',
        r'act of waiting': 'waiting',
        r'act of running': 'running',
        r'act of thinking': 'thinking',
        r'act of deciding': 'decision',
        r'act of preparing': 'preparation',
        r'act of using': 'use',
        r'act of entering': 'entry',
        r'act of leaving': 'departure',
        r'act of starting': 'start',
        r'act of ending': 'end',
        r'act of changing': 'change',
    }
    for pattern, result in act_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result

    # Generic: "act of X-ing" → X-ing
    m = re.match(r'(?:act|action) of (.+)', text, re.IGNORECASE)
    if m:
        action = m.group(1).strip().rstrip('.')
        return action

    return None


def _extract_place(text: str) -> str | None:
    """
    'place where/to X'  →  place type
    """
    place_map = {
        r'place to get on or off a train': 'train station',
        r'place where four roads meet': 'intersection',
        r'place where products are (?:displayed and )?sold': 'store',
        r'place where people worship': 'house of worship',
        r'place where people live': 'residence',
        r'place where students learn': 'school',
        r'place where books are kept': 'library',
        r'place where money is kept': 'bank',
        r'place where sick people go': 'hospital',
        r'place where planes land': 'airport',
        r'place where buses stop': 'bus stop',
        r'place where food is served': 'restaurant',
        r'place where films? (?:are shown|is shown)': 'cinema',
        r'place to sleep': 'bedroom',
        r'place to cook': 'kitchen',
        r'place to eat': 'dining room',
        r'place to park': 'parking lot',
        r'place to exercise': 'gym',
        r'place to swim': 'swimming pool',
    }
    for pattern, result in place_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result
    return None


def _extract_food(text: str) -> str | None:
    """
    'meat of pigs eaten as food' → 'pork'
    'Soup made with seaweed'     → 'seaweed soup'
    etc.
    """
    food_map = {
        r'meat of pigs? eaten as food': 'pork',
        r'meat of cows? eaten as food': 'beef',
        r'meat of chickens? eaten as food': 'chicken',
        r'soup that is made with seaweed': 'seaweed soup',
        r'powder made by grinding wheat': 'flour',
        r'medicine used to treat colds?': 'cold medicine',
        r'drink made from fermented rice': 'rice wine',
        r'food made from fermented cabbage': 'kimchi',
        r'soup made with tofu': 'tofu soup',
        r'rice cooked with vegetables': 'bibimbap',
    }
    for pattern, result in food_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result

    # Generic "X eaten as food" → X
    m = re.match(r'(.+?) eaten as food', text, re.IGNORECASE)
    if m:
        return m.group(1).strip().rstrip('.')

    # Generic "X made from/with Y" — keep as-is if short enough (handled later)
    return None


def _extract_color(text: str) -> str | None:
    """
    'color of a chick or banana' → 'yellow'
    """
    color_map = {
        r'color of (?:a )?chick|color of.*banana': 'yellow',
        r'color of grass|color of.*tree leaves': 'green',
        r'mixed color of red and yellow': 'orange',
        r'color of.*sky': 'blue',
        r'color of.*snow|color of.*milk': 'white',
        r'color of.*night|color of.*coal': 'black',
        r'color of.*blood|color of.*apple': 'red',
        r'color of.*violet|color of.*purple': 'purple',
        r'color of.*pink': 'pink',
        r'color of.*brown': 'brown',
    }
    for pattern, result in color_map.items():
        if re.search(pattern, text, re.IGNORECASE):
            return result

    # Generic "color of X"
    m = re.match(r'color of (.+)', text, re.IGNORECASE)
    if m:
        return m.group(1).strip().rstrip('.')

    return None


def _extract_state(text: str) -> str | None:
    """
    'state of being X' / 'state of X'  →  X or X-ness
    """
    state_map = {
        r'state of being not far': 'near, close',
        r'state of charging nothing': 'free (no charge)',
        r'state of being free': 'free',
        r'state of being busy': 'busy',
        r'state of being happy': 'happy',
        r'state of being sad': 'sad',
        r'state of being tired': 'tired',
        r'state of being angry': 'angry',
        r'state of being afraid': 'afraid',
        r'state of being healthy': 'healthy',
        r'state of being sick': 'sick',
        r'state of being alone': 'alone',
        r'state of being ready': 'ready',
        r'state of being complete': 'complete',
        r'state of being empty': 'empty',
        r'state of being full': 'full',
        r'state of being loud': 'loud',
        r'state of being quiet': 'quiet',
        r'state of being clean': 'clean',
        r'state of being dirty': 'dirty',
        r'state of being hot': 'hot',
        r'state of being cold': 'cold',
        r'state of being warm': 'warm',
        r'state of being cool': 'cool',
        r'state of being safe': 'safe',
        r'state of being dangerous': 'dangerous',
    }
    for pattern, result in state_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result

    # Generic: "state of being X" → X
    m = re.match(r'state of being (.+)', text, re.IGNORECASE)
    if m:
        adj = m.group(1).strip().rstrip('.')
        return adj

    # Generic: "state of X" → X
    m = re.match(r'state of (.+)', text, re.IGNORECASE)
    if m:
        noun = m.group(1).strip().rstrip('.')
        return noun

    return None


def _extract_family_term(text: str) -> str | None:
    """
    'The mother of one's husband' → 'mother-in-law'
    'One's male child'            → 'son'
    """
    family_map = {
        r"(?:the )?mother of one's husband": 'mother-in-law (husband\'s side)',
        r"(?:the )?father of one's husband": 'father-in-law (husband\'s side)',
        r"(?:the )?mother of one's wife": 'mother-in-law (wife\'s side)',
        r"(?:the )?father of one's wife": 'father-in-law (wife\'s side)',
        r"one's male child": 'son',
        r"one's female child": 'daughter',
        r"one's older brother.*male": 'older brother (for males)',
        r"one's older brother.*female": 'older brother (for females)',
        r"one's older sister.*male": 'older sister (for males)',
        r"one's older sister.*female": 'older sister (for females)',
        r"one's younger sibling": 'younger sibling',
        r"one's husband": 'husband',
        r"one's wife": 'wife',
        r"one's grandfather": 'grandfather',
        r"one's grandmother": 'grandmother',
        r"one's uncle": 'uncle',
        r"one's aunt": 'aunt',
        r"one's cousin": 'cousin',
        r"one's nephew": 'nephew',
        r"one's niece": 'niece',
    }
    for pattern, result in family_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result
    return None


def _extract_time(text: str) -> str | None:
    """
    'time from sunrise to sunset' → 'daytime'
    """
    time_map = {
        r'time from sunrise to sunset': 'daytime',
        r'time from sunset to sunrise': 'nighttime',
        r'time before noon': 'morning',
        r'time after noon': 'afternoon',
        r'time in the evening': 'evening',
        r'time at night': 'night',
        r'first part of the day': 'morning',
        r'last part of the day': 'evening',
    }
    for pattern, result in time_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result
    return None


def _extract_symptom(text: str) -> str | None:
    """
    'symptom of a pain in the head' → 'headache'
    """
    symptom_map = {
        r'symptom of a pain in the head': 'headache',
        r'symptom of a pain in the stomach': 'stomachache',
        r'symptom of a pain in the back': 'backache',
        r'symptom of a pain in the tooth': 'toothache',
        r'symptom of a high temperature': 'fever',
        r'symptom of difficulty breathing': 'breathing difficulty',
        r'symptom of a runny nose': 'runny nose',
        r'symptom of a sore throat': 'sore throat',
    }
    for pattern, result in symptom_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result

    # Generic "symptom of X" → X
    m = re.match(r'symptom of (.+)', text, re.IGNORECASE)
    if m:
        return m.group(1).strip().rstrip('.')

    return None


def _extract_not_pattern(text: str) -> str | None:
    """
    'Not too lengthy or complex'       → 'simple'
    'Not different from each other'    → 'same, similar'
    'Not the same as each other'       → 'different'
    """
    not_map = {
        r'not too lengthy or complex': 'simple',
        r'not different from each other': 'same, similar',
        r'not the same as each other': 'different',
        r'not short': 'long',
        r'not long': 'short',
        r'not small': 'large, big',
        r'not large|not big': 'small',
        r'not fast': 'slow',
        r'not slow': 'fast',
        r'not easy': 'difficult',
        r'not difficult|not hard': 'easy',
        r'not old': 'new, young',
        r'not new': 'old',
        r'not near|not close': 'far',
        r'not far': 'near, close',
        r'not heavy': 'light',
        r'not light': 'heavy',
        r'not cheap|not inexpensive': 'expensive',
        r'not expensive': 'cheap',
        r'not dirty': 'clean',
        r'not clean': 'dirty',
        r'not noisy': 'quiet',
        r'not quiet': 'noisy',
        r'not dark': 'bright',
        r'not bright|not light': 'dark',
    }
    for pattern, result in not_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result
    return None


def _extract_person_in_place(text: str) -> str | None:
    """
    'person who studies in a school'  → 'student'
    'person who works in a hospital'  → 'doctor / nurse'
    """
    person_place_map = {
        r'person who studies? (?:in|at) (?:a )?school': 'student',
        r'person who teaches? (?:in|at) (?:a )?school': 'teacher',
        r'person who works? (?:in|at) (?:a )?hospital': 'medical worker',
        r'person who performs? (?:in|at) (?:a )?(?:movie|film|theater|theatre)': 'actor',
        r'person who works? (?:in|at) (?:a )?(?:restaurant|kitchen)': 'cook',
        r'person who (?:lives|resides?) (?:in|at) (?:a )?foreign country': 'foreigner',
        r'person who visits? (?:a )?(?:country|place) for travel': 'tourist',
        r'person who goes? (?:to|on) (?:a )?tour': 'tourist',
        r'person who runs? (?:a )?business': 'businessperson',
        r'person who plays? (?:a )?(?:sport|game)': 'player',
        r'person who (?:leads?|manages?) (?:a )?(?:group|team|organization)': 'leader',
        r'person who (?:reads?|studies?) (?:a lot|many books)': 'avid reader',
        r'person who is? (?:born|raised) (?:in|at) (?:a )?foreign': 'foreigner',
        r'person who (?:drives?|operates?) (?:a )?(?:car|vehicle|bus|taxi)': 'driver',
        r'person who (?:sings?|performs?) (?:songs?|music)': 'singer',
        r'person who writes? (?:books?|stories?|novels?)': 'writer, author',
        r'person who (?:draws?|paints?) pictures?': 'artist',
        r'person who (?:takes?|shoots?) photos?': 'photographer',
        r'person who (?:designs?|creates?) (?:buildings?|structures?)': 'architect',
        r'person who (?:defends?|protects?) (?:the )?country': 'soldier',
        r'person who (?:cooks?|prepares?) food': 'cook, chef',
        r'person who (?:fixes?|repairs?) (?:things?|machines?|devices?)': 'repairperson',
        r'person who (?:grows?|farms?) (?:crops?|plants?|food)': 'farmer',
        r'person who (?:catches?|hunts?) fish': 'fisher',
        r'person who (?:sells?|trades?) (?:goods?|products?|things?)': 'merchant, seller',
        r'person who (?:helps?|assists?) (?:others?|people)': 'helper, assistant',
        r'person who (?:runs?|manages?) (?:a )?company': 'company manager',
        r'person who (?:gives?|delivers?) mail': 'mail carrier',
        r'person who (?:cuts?|styles?) hair': 'hairstylist',
        r'person who (?:measures?|examines?) health': 'health examiner',
        r'person who (?:serves?|works? (?:as|in)) (?:a )?soldier': 'soldier',
        r'person who works? for (?:a )?company': 'company employee',
        r'person who (?:studies?|learns?) (?:at|in) (?:a )?university': 'university student',
        r'person who uses? something': 'user',
        r'person who (?:wins?|came in) (?:first|1st)': 'first-place winner',
        r'person who (?:receives?|gets?) (?:a )?prize': 'prize winner',
        r'person who is? (?:being|currently) (?:sick|ill)': 'patient',
        r'person who is? (?:staying|hospitalized) (?:in|at) (?:a )?hospital': 'patient',
        r'person who (?:lives?|stays?) (?:in|at) (?:a )?house': 'resident',
        r'person who is? married': 'married person',
        r'person who is? not yet married': 'unmarried person',
        r'person who has? (?:a )?job': 'worker, employee',
        r'person who (?:is|works as) (?:a )?(?:police|officer)': 'police officer',
        r'person who (?:watches?|guards?) (?:something|a place)': 'guard, watcher',
        r'person who (?:comes?|arrives?) (?:from|for) (?:a )?visit': 'visitor, guest',
        r'person who has? (?:come|arrived) (?:from|for) (?:a )?visit': 'visitor, guest',
    }
    for pattern, result in person_place_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result
    return None


def _extract_very_not_quite(text: str) -> str | None:
    """
    'Very good and pleasant feeling' → 'joy, delight'   (handled by hardcoded dict)
    'Very special and outstanding'   → 'excellent'
    'Not being big in number'        → 'few'
    'Being fairly small or little'   → 'small, little'
    """
    specific_map = {
        r'very special and outstanding': 'excellent',
        r'very good (?:and|or) (?:great|excellent|outstanding)': 'excellent',
        r'very good and pleasant feeling': 'joy, delight',
        r'very (?:complicated|complex) or hard to do': 'complex, difficult',
        r'very (?:important|significant)': 'important',
        r'very (?:beautiful|pretty|lovely)': 'beautiful',
        r'very (?:fast|quick|rapid)': 'fast, quick',
        r'very (?:slow|sluggish)': 'slow',
        r'not being big in number': 'few',
        r'not being much in quantity': 'little',
        r'not being (?:big|large) in (?:size|amount)': 'small, little',
        r'being fairly small or little': 'small, little',
        r'not easily moved or affected': 'stubborn, firm',
        r'newly,? not existing before': 'new',
        r'quite (?:a lot|many|much)': 'quite a lot',
        r'requiring much power or effort': 'strenuous, hard',
        r'relatively high grade or level': 'high-level',
        r'relatively low grade or level': 'low-level',
    }
    for pattern, result in specific_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result

    # Generic: "Very [adjective]" → adjective
    m = re.match(r'^very ([a-z][a-z\s,]+?)(?:\s+(?:and|or)\s+[a-z\s]+)?$', text, re.IGNORECASE)
    if m:
        adj = m.group(1).strip().rstrip('.')
        if len(adj) <= 20:
            return adj

    # Generic: "Not being [adjective]" / "Not [adjective]" → antonym hint
    m = re.match(r'^not being (.+)$', text, re.IGNORECASE)
    if m:
        adj = m.group(1).strip().rstrip('.')
        if len(adj) <= 20:
            return 'not ' + adj

    return None


def _extract_to_verb(text: str) -> str | None:
    """
    'To move forward in quick steps' → 'to run'
    'To record something in writing' → 'to write down'
    'To fall into water, a pit, etc' → 'to fall in'
    'For an animal or plant to grow' → 'to grow'
    'To come in and out freely'      → 'to come and go'
    """
    specific_map = {
        r'to move forward in quick steps': 'to run',
        r'to record something in writing': 'to write down',
        r'to fall into water,? a pit,?': 'to fall in',
        r'to come in and out freely': 'to come and go',
        r'for an animal or plant to grow': 'to grow',
        r'to move from one place to another': 'to move',
        r'to go from one place to another': 'to travel, go',
        r'to make something (?:by hand|yourself)': 'to make, create',
        r'to put something in(?: a)? (?:certain )?order': 'to arrange, sort',
        r'to look for something (?:that is )?lost': 'to search, look for',
        r'to go out of (?:a )?(?:place|room|building)': 'to go out, exit',
        r'to come into (?:a )?(?:place|room|building)': 'to come in, enter',
        r'to stop doing something': 'to stop',
        r'to start doing something': 'to start, begin',
        r'to finish doing something': 'to finish, complete',
        r'to (?:speak|talk) (?:with|to) someone': 'to talk, converse',
        r'to (?:listen|pay attention) (?:to )?(?:something|someone)': 'to listen',
        r'to (?:look|watch|observe) (?:at )?something': 'to look, watch',
        r'to (?:feel|sense) something': 'to feel',
        r'to (?:think|consider) (?:about )?something': 'to think',
        r'to (?:use|utilize) something': 'to use',
        r'to (?:give|offer) something to someone': 'to give',
        r'to (?:take|receive) something from someone': 'to take, receive',
        r'to (?:buy|purchase) something': 'to buy',
        r'to (?:sell|trade) something': 'to sell',
        r'to (?:eat|consume) food': 'to eat',
        r'to (?:drink|consume) liquid': 'to drink',
        r'to (?:wear|put on) (?:clothes?|clothing)': 'to wear',
        r'to (?:take off|remove) (?:clothes?|clothing)': 'to take off',
        r'to (?:open|unlock) something': 'to open',
        r'to (?:close|shut|lock) something': 'to close',
        r'to (?:wash|clean) something': 'to wash, clean',
        r'to (?:fix|repair) something': 'to fix, repair',
        r'to (?:break|damage) something': 'to break',
        r'to (?:make|prepare) food': 'to cook',
        r'to (?:call|contact) someone': 'to call, contact',
        r'to (?:meet|see) someone': 'to meet',
        r'to (?:help|assist) someone': 'to help',
        r'to (?:ask|request) something': 'to ask, request',
        r'to (?:answer|respond) (?:to )?(?:a )?question': 'to answer',
        r'to (?:wait|stay) (?:for|until)': 'to wait',
        r'to (?:sleep|rest) (?:at night)?': 'to sleep',
        r'to (?:wake up|get up)': 'to wake up',
        r'to (?:sit|be seated) down': 'to sit down',
        r'to (?:stand|get) up': 'to stand up',
        r'to (?:go|come) (?:back|home|return)': 'to return, go back',
        r'to (?:arrive|reach) (?:a )?destination': 'to arrive',
        r'to (?:leave|depart) (?:a )?(?:place|home)': 'to leave, depart',
        r'to (?:walk|go on foot)': 'to walk',
        r'to (?:run|jog|sprint)': 'to run',
        r'to (?:fly|travel by air)': 'to fly',
        r'to (?:swim|move through water)': 'to swim',
        r'to (?:carry|bring|take) (?:something|someone)': 'to carry, bring',
        r'to (?:send|mail) something': 'to send',
        r'to (?:receive|get) (?:a )?(?:letter|mail|package)': 'to receive',
        r'to (?:save|store) (?:money|something)': 'to save',
        r'to (?:spend|use up) money': 'to spend',
        r'to (?:borrow|rent) something': 'to borrow',
        r'to (?:lend|loan) something': 'to lend',
        r'to (?:study|learn) something': 'to study, learn',
        r'to (?:teach|instruct) someone': 'to teach',
        r'to (?:read|look over) (?:a )?(?:book|text)': 'to read',
        r'to (?:write|record) something': 'to write',
        r'to (?:draw|sketch|paint) something': 'to draw, paint',
        r'to (?:play|perform) (?:a )?(?:sport|game|music)': 'to play',
        r'to (?:sing|perform) (?:a )?song': 'to sing',
        r'to (?:dance|move to music)': 'to dance',
        r'to (?:watch|view) something': 'to watch',
        r'to (?:explain|describe) something': 'to explain',
        r'to (?:introduce|present) someone': 'to introduce',
        r'to (?:begin|start) something': 'to begin, start',
        r'to (?:end|finish|complete) something': 'to end, finish',
        r'to (?:continue|keep doing) something': 'to continue',
        r'to (?:change|alter|modify) something': 'to change',
        r'to (?:increase|grow|get bigger)': 'to increase',
        r'to (?:decrease|shrink|get smaller)': 'to decrease',
        r'to (?:become|turn into) something': 'to become',
        r'to (?:cause|make) something happen': 'to cause',
        r'to (?:know|understand) something': 'to know, understand',
        r'to (?:forget|not remember) something': 'to forget',
        r'to (?:remember|recall) something': 'to remember',
        r'to (?:plan|decide) (?:to do )?something': 'to plan, decide',
        r'to (?:choose|select|pick) something': 'to choose',
        r'to (?:compare|contrast) (?:two )?things?': 'to compare',
        r'to (?:check|confirm|verify) something': 'to check, confirm',
        r'to (?:practice|rehearse) something': 'to practice',
        r'to (?:prepare|get ready) (?:for )?something': 'to prepare',
        r'to (?:join|participate|take part) (?:in )?something': 'to join, participate',
        r'to (?:share|distribute) something': 'to share',
        r'to (?:accept|agree) (?:with )?something': 'to accept, agree',
        r'to (?:refuse|reject|decline) something': 'to refuse, reject',
        r'to (?:apologize|say sorry)': 'to apologize',
        r'to (?:thank|express gratitude)': 'to thank',
        r'to (?:greet|say hello to) someone': 'to greet',
        r'to (?:take|have|get) (?:a )?rest': 'to rest',
        r'to have (?:a )?conversation': 'to converse',
        r'to (?:think|contemplate|reflect)': 'to think',
        r'to (?:decide|make a decision)': 'to decide',
        r'to (?:show|reveal|display) something': 'to show',
        r'to (?:hide|conceal) something': 'to hide',
        r'to (?:gather|collect) (?:things?|items?)': 'to gather, collect',
        r'to (?:drop|let fall) something': 'to drop',
        r'to (?:pick up|lift) something': 'to pick up',
        r'to (?:put|place) something (?:somewhere|down)': 'to put, place',
        r'to (?:throw|toss) something': 'to throw',
        r'to (?:catch|grab) something': 'to catch',
        r'to (?:cut|chop|slice) something': 'to cut',
        r'to (?:fold|bend) something': 'to fold',
        r'to (?:tie|fasten|attach) something': 'to tie, fasten',
        r'to (?:untie|unfasten|detach) something': 'to untie',
        r'to (?:touch|feel) something': 'to touch',
        r'to (?:push|press) something': 'to push, press',
        r'to (?:pull|drag) something': 'to pull',
        r'to (?:hit|strike) something': 'to hit, strike',
        r'to (?:kick|boot) something': 'to kick',
        r'to (?:stretch|extend) something': 'to stretch',
        r'to (?:measure|weigh) something': 'to measure',
        r'to (?:count|number) something': 'to count',
        r'to (?:add|sum up) numbers?': 'to add',
        r'to (?:subtract|minus) numbers?': 'to subtract',
        r'to (?:multiply) numbers?': 'to multiply',
        r'to (?:divide|split) (?:something|numbers?)': 'to divide',
        r'to (?:protect|defend|keep safe) something': 'to protect',
        r'to (?:destroy|ruin|damage) something': 'to destroy',
        r'to (?:build|construct|create) something': 'to build, create',
        r'to (?:design|plan|draft) something': 'to design, plan',
        r'to (?:develop|improve|advance) something': 'to develop',
        r'to (?:test|examine|check) something': 'to test, examine',
        r'to (?:research|investigate|study) something': 'to research',
        r'to (?:discover|find out) something': 'to discover',
        r'to (?:invent|create) something new': 'to invent',
        r'to (?:solve|resolve|fix) (?:a )?problem': 'to solve',
        r'to (?:manage|control|handle) something': 'to manage',
        r'to (?:lead|guide) (?:a )?(?:group|team)': 'to lead',
        r'to (?:follow|obey|listen to) (?:a )?rule': 'to follow, obey',
        r'to (?:break|violate) (?:a )?rule': 'to break (a rule)',
        r'to (?:express|show|display) (?:an? )?(?:emotion|feeling)': 'to express',
        r'to (?:enjoy|like|love) something': 'to enjoy, like',
        r'to (?:dislike|hate) something': 'to dislike',
        r'to (?:worry|be concerned) about something': 'to worry',
        r'to (?:hope|wish|expect) for something': 'to hope, wish',
        r'to (?:dream|imagine) about something': 'to dream',
        r'to (?:laugh|smile) (?:at something)?': 'to laugh, smile',
        r'to (?:cry|weep|sob)': 'to cry',
        r'to (?:shout|yell|scream)': 'to shout',
        r'to (?:whisper|speak softly)': 'to whisper',
        r'to (?:nod|agree by nodding)': 'to nod',
        r'to (?:shake|move) (?:the )?head': 'to shake one\'s head',
        r'to (?:clap|applaud)': 'to clap',
        r'to (?:bow|show respect)': 'to bow',
        r'to (?:hug|embrace) someone': 'to hug',
        r'to (?:shake hands? with) someone': 'to shake hands',
        r'to (?:wave|signal) (?:to )?someone': 'to wave',
        r'to (?:point|gesture) (?:at|to) something': 'to point',
    }
    for pattern, result in specific_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result

    # Generic: "To [verb phrase]" — if the verb phrase is short enough already
    m = re.match(r'^to (.+)$', text, re.IGNORECASE)
    if m:
        phrase = m.group(1).strip().rstrip('.')
        # Only simplify if it starts with a verb and the overall result will be short
        # and the phrase contains a qualifier like "quickly", "in a place", etc.
        words = phrase.split()
        if len(words) <= 3:
            return 'to ' + phrase
        # "to [verb] [something/someone]" — strip generic objects
        simplified = re.sub(r'\s+(?:something|someone|a person|things?|items?|an? \w+)\s*$', '', phrase, flags=re.IGNORECASE)
        if simplified and len(simplified) < len(phrase) and len(simplified) <= 20:
            return 'to ' + simplified.strip()

    # "For X to Y" → "to Y"
    m = re.match(r'^for .+ to (.+)$', text, re.IGNORECASE)
    if m:
        phrase = m.group(1).strip().rstrip('.')
        if len(phrase) <= 20:
            return 'to ' + phrase

    return None


def _extract_something_pattern(text: str) -> str | None:
    """
    'Something that is not definite'   → 'uncertain'
    'Something interesting to see'     → 'sight, attraction'
    'hidden thing unknown to others'   → 'secret'
    """
    specific_map = {
        r'something that is not definite': 'uncertain',
        r'something interesting to (?:see|look at)': 'sight, attraction',
        r'hidden thing unknown to others': 'secret',
        r'something (?:that is )?hidden': 'secret',
        r'something (?:that is )?unknown': 'unknown thing',
        r'something (?:that is )?new': 'new thing',
        r'something (?:that is )?important': 'important thing',
        r'something (?:that is )?special': 'special thing',
        r'something (?:that is )?difficult or hard': 'difficulty',
        r'something (?:that is )?easy': 'easy thing',
        r'something (?:that is )?dangerous': 'danger',
        r'something (?:that is )?free (?:of charge)?': 'free item',
        r'something (?:that is )?necessary': 'necessity',
        r'something (?:that is )?useful': 'useful thing',
        r'something (?:that is )?delicious': 'delicious food',
        r'something (?:that is )?beautiful': 'beautiful thing',
        r'something (?:that is )?strange': 'strange thing',
        r'something (?:that is )?funny': 'funny thing',
        r'something (?:that is )?scary': 'scary thing',
        r'something (?:that is )?surprising': 'surprise',
        r'something (?:that happens )?by chance': 'coincidence',
        r'someone who is (?:a )?(?:stranger|unknown)': 'stranger',
    }
    for pattern, result in specific_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result
    return None


def _extract_time_allotted(text: str) -> str | None:
    """
    'time allotted for having lunch' → 'lunch time'
    'time set aside for [activity]'  → '[activity] time'
    """
    specific_map = {
        r'time allotted for having lunch': 'lunch time',
        r'time (?:allotted|set aside) for (?:having )?lunch': 'lunch time',
        r'time (?:allotted|set aside) for (?:having )?breakfast': 'breakfast time',
        r'time (?:allotted|set aside) for (?:having )?dinner': 'dinner time',
        r'time (?:allotted|set aside) for (?:having )?a meal': 'mealtime',
        r'time (?:allotted|set aside) for sleeping': 'sleep time',
        r'time (?:allotted|set aside) for rest': 'rest time',
        r'time (?:allotted|set aside) for studying': 'study time',
        r'time (?:allotted|set aside) for work': 'work time',
        r'time (?:allotted|set aside) for exercise': 'exercise time',
        r'time (?:allotted|set aside) for play': 'play time',
        r'time (?:allotted|set aside) for (?:a )?break': 'break time',
        r'time (?:allotted|set aside) for class': 'class time',
    }
    for pattern, result in specific_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result

    # Generic: "time allotted for [X]ing" → "[X] time"
    m = re.match(r'time (?:allotted|set aside) for (.+)', text, re.IGNORECASE)
    if m:
        activity = m.group(1).strip().rstrip('.').strip()
        # Remove leading "having " or "doing "
        activity = re.sub(r'^(?:having|doing|taking)\s+', '', activity, flags=re.IGNORECASE)
        if activity and len(activity) <= 15:
            return activity + ' time'
    return None


def _extract_noun_of_noun(text: str) -> str | None:
    """
    'brother who is younger'          → 'younger brother'
    'man of a married couple'         → 'husband'
    'time from sunrise to sunset'     → 'daytime'
    'year coming after this year'     → 'next year'
    'day following tomorrow'          → 'day after tomorrow'
    'side beyond a line or boundary'  → 'beyond, other side'
    'days or years near the present'  → 'recent times'
    'undecided day in the future'     → 'someday'
    """
    specific_map = {
        r'brother who is younger': 'younger brother',
        r'sister who is younger': 'younger sister',
        r'brother who is older': 'older brother',
        r'sister who is older': 'older sister',
        r'man of a married couple': 'husband',
        r'woman of a married couple': 'wife',
        r'year coming after this year': 'next year',
        r'year (?:that )?(?:came|coming) before this year': 'last year',
        r'day following tomorrow': 'day after tomorrow',
        r'day (?:before|prior to) yesterday': 'day before yesterday',
        r'side beyond a line or boundary': 'beyond, other side',
        r'days or years near the present': 'recent times',
        r'undecided day in the future': 'someday',
        r'(?:certain|specific) moment or part of time': 'moment',
        r'at some time one does not know': 'sometime',
        r'number that indicates no value': 'zero',
        r'all the countries on the earth': 'the world',
        r'many places,? or here and there': 'everywhere',
        r'(?:ticket|pass) (?:bought|used) to ride (?:a )?train': 'train ticket',
        r'(?:ticket|pass) (?:bought|used) to ride (?:a )?bus': 'bus ticket',
        r'(?:ticket|pass) (?:bought|used) to ride (?:a )?subway': 'subway ticket',
        r'(?:ticket|pass) (?:bought|used) to board (?:a )?plane': 'plane ticket',
        r'bottle used to hold flowers?': 'vase',
        r'container used to hold (?:flowers?|plants?)': 'vase',
        r'utensil that holds food': 'bowl, dish',
        r'container (?:that holds|used for) (?:food|liquid)': 'bowl, container',
        r'more and more as time passes': 'increasingly',
        r'(?:current )?location of an object': 'location, position',
        r'feeling of being unsatisfied': 'dissatisfaction',
        r'feeling of being satisfied': 'satisfaction',
        r'feeling of being happy': 'happiness',
        r'feeling of being sad': 'sadness',
        r'feeling of being afraid': 'fear',
        r'feeling of being angry': 'anger',
        r'feeling of being embarrassed': 'embarrassment',
        r'feeling of being lonely': 'loneliness',
        r'feeling of missing someone': 'longing, missing',
        r'feeling of being grateful': 'gratitude',
        r'feeling of wanting something': 'desire, want',
        r'taste of food being not good': 'bad-tasting',
        r'taste (?:that is )?(?:sour|bitter|spicy|sweet|salty)': lambda m: m.group(0).split()[-1] + ' taste',
        r'(?:mixed )?color of red and yellow': 'orange',
        r'powder made by grinding wheat': 'flour',
        r'soup (?:that is )?made with seaweed': 'seaweed soup',
        r'(?:a )?(?:certain|specific) time in (?:the )?future': 'future time',
        r'time when something (?:ends|is over|expires)': 'expiration, end time',
        r'time (?:when someone|for) (?:graduation|graduating)': 'graduation',
        r'place where (?:two )?roads? (?:meet|intersect|cross)': 'intersection',
    }
    for pattern, result in specific_map.items():
        if isinstance(result, str) and re.match(pattern, text, re.IGNORECASE):
            return result

    # "X who is Y" → "Y X"  (e.g. "brother who is younger" → "younger brother")
    m = re.match(r'^(\w+) who is (\w+)$', text, re.IGNORECASE)
    if m:
        noun, adj = m.group(1), m.group(2)
        return f'{adj} {noun}'

    # "[noun] of [noun]" — very generic, only handle known short constructs
    # Don't apply generically to avoid false positives

    return None


def _extract_all_X_in_Y(text: str) -> str | None:
    """
    'All the countries on the earth' → 'the world'
    'All the [noun] in/on [place]'   → '[noun]'
    """
    specific_map = {
        r'all the countries (?:on|in) (?:the )?earth': 'the world',
        r'all the countries (?:on|in) (?:the )?world': 'world',
        r'all the people (?:in|on) (?:the )?world': 'all people',
        r'all the (?:different )?kinds?': 'all kinds',
    }
    for pattern, result in specific_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result

    m = re.match(r'all the (\w+(?:\s+\w+)?) (?:on|in|of) .+', text, re.IGNORECASE)
    if m:
        noun = m.group(1).strip()
        if len(noun) <= 15:
            return noun
    return None


def _extract_object_used_for(text: str) -> str | None:
    """
    'bottle used to hold flowers' → 'vase'
    'utensil that holds food'     → 'bowl, dish'
    '[material] made by [process]' → product name
    """
    specific_map = {
        r'bottle (?:used )?to hold flowers?': 'vase',
        r'utensil (?:used )?(?:that holds?|to hold) food': 'bowl, dish',
        r'container (?:used )?to hold (?:rice|food)': 'bowl',
        r'tool (?:used )?to cut (?:food|things)': 'knife, cutting tool',
        r'device (?:used )?to tell time': 'clock',
        r'tool (?:used )?to write': 'pen, pencil',
        r'object (?:used )?to sit on': 'chair',
        r'object (?:used )?to sleep on': 'bed',
        r'object (?:used )?to eat with': 'utensil',
        r'(?:a )?(?:ticket|card) (?:used )?to (?:ride|board|enter)': 'ticket',
    }
    for pattern, result in specific_map.items():
        if re.match(pattern, text, re.IGNORECASE):
            return result
    return None


def apply_pattern_extraction(answer: str) -> tuple[str, str] | None:
    """
    Try each extraction rule in order. Returns (new_answer, rule_name) or None.
    Only applies when len(answer) > 20.
    """
    if len(answer) <= 20:
        return None

    text = answer.strip()

    # Rule 1: person whose job / person who
    if re.match(r'person (?:whose|who)', text, re.IGNORECASE):
        result = _extract_role_noun(text)
        if result:
            return result, 'role_noun'

    # Rule 1b: person who [verb]s in/at [place] (new comprehensive rule)
    if re.match(r'person who', text, re.IGNORECASE):
        result = _extract_person_in_place(text)
        if result:
            return result, 'person_in_place'

    # Rule 2: act of / action of
    if re.match(r'(?:act|action) of', text, re.IGNORECASE):
        result = _extract_act_noun(text)
        if result:
            return result, 'act_noun'

    # Rule 3: place where/to
    if re.match(r'place (?:where|to)', text, re.IGNORECASE):
        result = _extract_place(text)
        if result:
            return result, 'place'

    # Rule 4: food patterns
    if re.search(r'eaten as food|made from|made with|made by grinding', text, re.IGNORECASE):
        result = _extract_food(text)
        if result:
            return result, 'food'

    # Rule 5: color of
    if re.match(r'(?:mixed )?color of', text, re.IGNORECASE):
        result = _extract_color(text)
        if result:
            return result, 'color'

    # Rule 6: state of being / state of
    if re.match(r'state of', text, re.IGNORECASE):
        result = _extract_state(text)
        if result:
            return result, 'state'

    # Rule 7: family terms
    if re.match(r"(?:the )?(?:mother|father|one's)", text, re.IGNORECASE):
        result = _extract_family_term(text)
        if result:
            return result, 'family'

    # Rule 8: time from X to Y
    if re.match(r'time from|time before|time after|time (?:in|at)', text, re.IGNORECASE):
        result = _extract_time(text)
        if result:
            return result, 'time'

    # Rule 9: symptom of
    if re.match(r'symptom of', text, re.IGNORECASE):
        result = _extract_symptom(text)
        if result:
            return result, 'symptom'

    # Rule 10: Not X patterns
    if re.match(r'not ', text, re.IGNORECASE):
        result = _extract_not_pattern(text)
        if result:
            return result, 'not_pattern'

    # Rule 11: Very/Not/Quite/Being [adjective] — strip adverb
    if re.match(r'(?:very|quite|being|not being|requiring|relatively|newly)', text, re.IGNORECASE):
        result = _extract_very_not_quite(text)
        if result:
            return result, 'adverb_strip'

    # Rule 12: "To [verb phrase]" / "For X to [verb]"
    if re.match(r'(?:to |for .+ to )', text, re.IGNORECASE):
        result = _extract_to_verb(text)
        if result:
            return result, 'to_verb'

    # Rule 13: Something/Someone that/who [verb]
    if re.match(r'(?:something|someone|hidden thing|certain)', text, re.IGNORECASE):
        result = _extract_something_pattern(text)
        if result:
            return result, 'something_pattern'

    # Rule 14: "[time] allotted for [activity]"
    if re.match(r'time (?:allotted|set aside)', text, re.IGNORECASE):
        result = _extract_time_allotted(text)
        if result:
            return result, 'time_allotted'

    # Rule 15: "X who is Y", "X of Y", "X following Y", etc.
    if re.match(r'(?:\w+ who is|\w+ of (?:a|an|the)|\w+ (?:coming|following)|all the|many places|more and|(?:current )?location|feeling of|taste of|days or years|undecided|certain moment|at some time|number that|side beyond|(?:ticket|bottle|utensil|container|powder|soup))', text, re.IGNORECASE):
        result = _extract_noun_of_noun(text)
        if result:
            return result, 'noun_of_noun'

    # Rule 16: "All the [noun] in/on [place]"
    if re.match(r'all the', text, re.IGNORECASE):
        result = _extract_all_X_in_Y(text)
        if result:
            return result, 'all_x_in_y'

    # Rule 17: "[object] used to [purpose]" / "[material] made by [process]"
    if re.search(r'used to (?:hold|store|carry|cut|write|tell)|made by grinding|that holds? food', text, re.IGNORECASE):
        result = _extract_object_used_for(text)
        if result:
            return result, 'object_used_for'

    return None


# ---------------------------------------------------------------------------
# Phase 3: General cleanup helpers
# ---------------------------------------------------------------------------

def clean_answer(answer: str) -> str:
    """Apply general cleanup rules to any answer."""
    text = answer

    # Strip outer quotes (leading/trailing single or double)
    text = re.sub(r'^["\'](.+)["\']$', r'\1', text.strip())

    # Strip leading "(honorific) " → move to suffix
    m = re.match(r'^\(honorific\)\s+(.+)', text, re.IGNORECASE)
    if m:
        text = m.group(1).strip() + ' (honorific)'

    # Strip trailing period
    text = text.rstrip('.')

    # Strip leading "A " / "An " / "The " from answers ≤ 25 chars
    if len(text) <= 25:
        text = re.sub(r'^(?:A |An |The )(?=\S)', '', text)

    # Normalize double spaces
    text = re.sub(r'  +', ' ', text).strip()

    return text


def fallback_truncate(answer: str) -> tuple[str, str] | None:
    """If > 30 chars and no pattern matched, truncate at last comma/space before 30."""
    if len(answer) <= 30:
        return None
    # Try last comma before char 30
    sub = answer[:30]
    comma_pos = sub.rfind(',')
    if comma_pos > 10:
        return answer[:comma_pos].strip(), 'fallback_truncate'
    # Try last space before char 30
    space_pos = sub.rfind(' ')
    if space_pos > 10:
        return answer[:space_pos].strip(), 'fallback_truncate'
    # Hard cut at 30
    return answer[:30].strip(), 'fallback_truncate'


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print(f"Loading {VOCAB_FILE} ...")
    with open(VOCAB_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    total = len(data)
    manual_applied = 0
    common_word_applied = 0
    pattern_applied = 0
    fallback_applied = 0
    cleanup_applied = 0
    total_changed = 0

    for entry in data:
        entry_id = entry.get('id', '')
        original = entry.get('correctAnswer', '')
        current = original

        # --- Phase 1: Manual corrections ---
        if entry_id in CORRECTIONS:
            new_val = CORRECTIONS[entry_id]
            if current != new_val:
                entry['correctAnswer'] = new_val
                current = new_val
                manual_applied += 1
                print(f"  [manual]   {entry_id}: {original!r} → {new_val!r}")

        # --- Phase 1b: Hardcoded common-word fixes ---
        if entry_id in COMMON_WORD_FIXES:
            new_val = COMMON_WORD_FIXES[entry_id]
            if current != new_val:
                entry['correctAnswer'] = new_val
                current = new_val
                common_word_applied += 1
                print(f"  [common_word] {entry_id}: {original!r} → {new_val!r}")

        # --- Phase 2: Pattern extraction (only on verbose answers > 20 chars) ---
        if len(current) > 20:
            result = apply_pattern_extraction(current)
            if result:
                new_val, rule = result
                # Apply general cleanup to extracted result too
                new_val = clean_answer(new_val)
                if new_val and new_val != current:
                    print(f"  [{rule:<20}] {entry_id}: {current!r} → {new_val!r}")
                    entry['correctAnswer'] = new_val
                    current = new_val
                    pattern_applied += 1

        # --- Phase 2b: Fallback truncation (> 30 chars, no pattern matched) ---
        if len(current) > 30:
            result = fallback_truncate(current)
            if result:
                new_val, rule = result
                new_val = clean_answer(new_val)
                if new_val and new_val != current:
                    print(f"  [fallback_truncate  ] {entry_id}: {current!r} → {new_val!r}")
                    entry['correctAnswer'] = new_val
                    current = new_val
                    fallback_applied += 1

        # --- Phase 3: General cleanup (applied to ALL answers) ---
        cleaned = clean_answer(current)
        if cleaned and cleaned != current:
            entry['correctAnswer'] = cleaned
            current = cleaned
            cleanup_applied += 1

        if current != original:
            total_changed += 1

    # Write back
    print(f"\nWriting corrected data to {VOCAB_FILE} ...")
    with open(VOCAB_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

    # Count remaining verbose answers
    remaining_verbose_25 = sum(1 for e in data if len(e.get('correctAnswer', '')) > 25)
    remaining_verbose_30 = sum(1 for e in data if len(e.get('correctAnswer', '')) > 30)

    print("\n--- Summary ---")
    print(f"  Total entries processed : {total}")
    print(f"  Manual corrections      : {manual_applied}")
    print(f"  Common-word fixes       : {common_word_applied}")
    print(f"  Pattern extractions     : {pattern_applied}")
    print(f"  Fallback truncations    : {fallback_applied}")
    print(f"  Cleanup-only changes    : {cleanup_applied}")
    print(f"  Total entries changed   : {total_changed}")
    print(f"\n--- Remaining verbose answers ---")
    print(f"  Still > 25 chars        : {remaining_verbose_25}")
    print(f"  Still > 30 chars        : {remaining_verbose_30}")


if __name__ == '__main__':
    main()
