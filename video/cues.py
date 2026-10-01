"""Edit decision list: music sections and sound-effect hits, all anchored to
spoken words in timeline.json so picture, music and SFX land on the same frame.

Run:  BUILD=... python3 cues.py   ->  $BUILD/cues.json
"""
import json
import os

BUILD = os.environ['BUILD']
TL = json.load(open(os.path.join(BUILD, 'timeline.json'), encoding='utf-8'))
LINES = TL['lines']


def chars(i):
    return LINES[i]['chars']


def w(i, sub, k=0):
    """(t0, t1) of the k-th occurrence of `sub` in line i (spoken form)."""
    cs = chars(i)
    s = ''.join(c['c'] for c in cs)
    pos = -1
    for _ in range(k + 1):
        pos = s.find(sub, pos + 1)
        if pos < 0:
            raise KeyError(f'{sub!r} not in line {i}: {s}')
    # map string offset -> char index (units may hold >1 letter, e.g. "AI")
    off = 0
    for idx, c in enumerate(cs):
        if off == pos:
            start = idx
        if off + len(c['c']) >= pos + len(sub):
            return cs[start]['t0'], cs[idx]['t1']
        off += len(c['c'])
    raise KeyError(sub)


def t0(i, sub, k=0):
    return w(i, sub, k)[0]


def t1(i, sub, k=0):
    return w(i, sub, k)[1]


def ls(i):
    return LINES[i]['start']


def le(i):
    return LINES[i]['end']


sfx = []


def fx(t, kind, gain=0.0, **kw):
    sfx.append(dict(t=round(t, 3), type=kind, gain_db=gain, **kw))


# --------------------------------------------------------------- cold open
fx(0.25, 'breath', -8)
for ch in '千锤百炼':
    fx(t0(0, ch) - 0.02, 'anvil', -6)
fx(t0(1, '最') - 0.03, 'boom', -4)
fx(t0(2, '被') - 1.2, 'reverse_swell', -10, dur=1.2)
fx(t0(2, '看'), 'bloom', -8)
fx(ls(3) - 0.25, 'paper', -14)
fx(t0(3, '遗憾'), 'pencil', -16, dur=0.7)
fx(t0(5, '喧') - 0.02, 'glitch', -6, dur=0.5)
for ch in '嚣烂东':
    fx(t0(5, ch), 'glitch_hit', -10)
fx(t0(5, '造势'), 'impact', -6)
fx(le(5) + 0.25, 'tape_stop', -8, dur=0.6)

# --------------------------------------------------------- 01 livestream
fx(ls(6) - 1.1, 'whoosh_soft', -14)
for k in range(8):
    fx(ls(6) - 0.4 + k * 1.0, 'clock_tick', -20)
fx(ls(7) - 0.2, 'phone_on', -14)
for k in range(3):
    fx(ls(7) + 0.35 + k * 0.42, 'swipe', -18)
fx(t0(7, '停'), 'tap', -14)
for k in range(5):
    fx(ls(8) + 0.6 + k * 1.15, 'scrape', -20)
fx(t0(11, '刀'), 'knife', -8)
fx(t0(11, '刻'), 'knife', -8)
fx(t0(12, '停留'), 'pop', -14)          # viewer count 7 -> 8
fx(t0(13, '手艺人'), 'marker', -18, dur=0.5)
fx(t0(13, '艺术者'), 'marker', -18, dur=0.5)
fx(t0(15, '老竹') - 0.15, 'card', -16)
fx(t0(15, '内径') - 0.15, 'card', -16)
fx(t0(15, '音色') - 0.15, 'card', -16)
fx(t0(16, '笨拙'), 'stamp', -10)
fx(t0(16, '虔诚'), 'stamp', -9)
fx(t1(17, '花哨话术'), 'pen_strike', -14)
fx(t1(17, '秒杀套路'), 'pen_strike', -14)
fx(t1(17, '速成教学'), 'pen_strike', -14)
fx(t1(18, '任何装饰'), 'pen_strike', -14)
fx(t0(19, '安静'), 'chime', -16)
fx(ls(20) - 0.05, 'boom', -3)
fx(t0(22, '驻足'), 'digit', -16)
fx(t0(22, '驻足') + 0.5, 'digit', -16)
fx(t0(22, '却不多'), 'digit', -16)
fx(ls(23) - 0.05, 'glitch', -8, dur=0.35)
t, gap = ls(24) - 0.3, 0.55
while t < le(24) + 0.2:
    fx(t, 'ding', -18)
    t += gap
    gap = max(0.09, gap * 0.86)
fx(t0(24, '源源不断'), 'cash', -12)
fx(ls(25) - 0.05, 'freeze', -8)
fx(t0(26, '错位'), 'dislocate', -8)
fx(t0(28, '听见'), 'bell', -14)
fx(t0(28, '听见', 1), 'bell', -12)

# ---------------------------------------------------------- 02 two tracks
fx(ls(29) - 0.9, 'whoosh', -10)
fx(t0(29, '游戏美术'), 'whoosh_soft', -16)
fx(ls(30) - 0.1, 'paper', -16)
for word in ['阴干老竹', '修孔', '调音', '纯粹']:
    fx(t0(31, word), 'wood', -16)
for word in ['手绘笔触', '推敲光影', '构图']:
    fx(t0(32, word), 'brush', -14)
fx(t0(32, '几十版'), 'counter', -18, dur=1.4)
fx(t0(33, '完美'), 'focus', -14)
for word in ['耗时间', '耐寂寞', '慢打磨', '不讨巧']:
    fx(t0(35, word), 'stamp', -7)
fx(t0(36, '不再'), 'stamp_x', -8)
fx(t0(37, '无人问津'), 'dust', -16)
fx(t0(38, '玩具笛'), 'ding', -16)
fx(t0(38, '占领市场'), 'cash', -14)
fx(t0(40, '嫌慢'), 'message', -12)
fx(t0(40, '嫌贵'), 'message', -12)
fx(ls(41) - 0.05, 'copier', -12, dur=4.6)
fx(t0(41, 'AI'), 'glitch_hit', -10)
fx(t0(43, '收割流量'), 'coins', -12)
fx(t0(44, '吃亏'), 'low_tone', -12)

# --------------------------------------------------------- 03 twenty years
fx(ls(45) - 0.8, 'whoosh', -12)
for k in range(10):
    fx(t0(46, '二十年') + k * 0.32, 'book', -20)
fx(t0(46, '手绘功底'), 'pencil', -18, dur=1.0)
fx(t0(48, 'AI') - 0.05, 'glitch', -6, dur=0.8)
fx(t0(48, '彻底'), 'sub_drop', -6)
for word in ['细腻的笔触', '耐心的打磨', '光影塑造']:
    fx(t0(49, word), 'erase', -16)
for word in ['快速的产能', '批量的出图', '无限的迭代']:
    fx(t0(50, word), 'slam', -10)
fx(ls(51) - 0.2, 'rush', -14, dur=5.5)
fx(t0(52, '换了规则'), 'clack', -10)
fx(t0(54, '白发'), 'sparkle', -16)
for k in range(9):
    fx(ls(55) + k * (0.62 - k * 0.025), 'heartbeat', -10 - (0 if k > 4 else 3))
fx(t0(57, '三年前'), 'page_flip', -16)
fx(t0(57, '使用AI'), 'typing', -16, dur=1.4)
fx(t0(58, '取代'), 'low_tone', -12)
fx(t0(59, '迷茫') - 1.0, 'reverse_swell', -12, dur=1.0)

# ------------------------------------------------------------ 04 new worlds
fx(ls(60) - 0.8, 'whoosh', -12)
fx(t0(60, '三月'), 'page_flip', -12)
fx(t0(60, '跳出'), 'pop_big', -10)
for word in ['音乐', '学习竹笛', '自媒体']:
    fx(t0(61, word), 'pop', -12)
fx(t0(62, '更多世界'), 'sparkle', -14)
for word in ['AI', '运营', '培训', 'OA', '研发游戏', '文旅项目']:
    fx(t0(64, word), 'sticky', -10)
fx(t0(65, '铺开'), 'whoosh_soft', -14)
fx(t0(66, '浪潮') - 0.6, 'wave', -9, dur=2.2)
fx(t1(68, '失去了'), 'pen_strike', -12)
fx(t0(69, '全新的价值'), 'stamp', -9)
fx(t0(70, '贯通'), 'connect', -12, dur=1.0)
fx(t0(71, '同一条路'), 'whoosh_soft', -14)
fx(t0(73, '命题'), 'bell', -12)

# ------------------------------------------------------------------ 05 roots
fx(ls(74) - 0.8, 'whoosh', -12)
fx(t0(74, '开箱'), 'tape_rip', -10)
fx(t0(74, '一摞'), 'book', -10)
for word in ['艺术流派', '经典画风', '传统美术', '历史美学']:
    fx(t0(75, word), 'page_flip', -14)
fx(ls(78) - 0.05, 'gong', -6)
fx(t0(78, '扎根'), 'grow', -12, dur=3.0)
fx(t0(78, '生命力'), 'sparkle', -10)
for word in ['复制技法', '量产画面', '拼接风格', '堆砌效果']:
    fx(t0(79, word), 'copier_hit', -10)
for i, gain in [(80, -9), (81, -7), (82, -5)]:
    fx(t0(i, '复制不了'), 'scan', -14, dur=0.9)
    fx(t0(i, '不了'), 'error_hit', gain)
fx(t0(82, '一锤'), 'anvil', -12)
fx(t0(82, '一笔'), 'brush', -12)
fx(t0(82, '温度'), 'bloom', -10)

# --------------------------------------------------------------- synthesis
fx(t0(84, '民乐竹笛') - 0.3, 'whoosh', -12)
fx(t0(84, '高度相通'), 'merge_hit', -6)
for word in ['老竹', '制笛工艺', '国风音律', '文化传承']:
    fx(t0(85, word), 'wood', -18)
for word in ['传统美学', '历史沉淀', '艺术底蕴', '手绘温度', '创作感知']:
    fx(t0(86, word), 'brush', -18)
fx(t0(87, '每一根'), 'lens', -14)
fx(t0(88, '审美积淀'), 'bloom', -16)
for word in ['沉淀', '根基', '独一无二', '有温度']:
    fx(t0(89, word), 'sparkle', -14)
fx(t0(89, '越珍贵'), 'chime', -12)

# ----------------------------------------------------------------- 06 seen
fx(ls(90) - 0.8, 'whoosh', -12)
fx(t0(90, '涌入'), 'gather', -14, dur=1.6)
for k in range(7):
    fx(t0(91, '一次次') + k * 0.28, 'blip_down', -16)
fx(t0(92, '音色浑浊'), 'bad_flute', -12, dur=1.2)
fx(t0(93, '没有温度'), 'thermo_down', -14, dur=1.0)
fx(t0(94, '把竹材'), 'scrape', -18)
fx(t0(94, '把音修准'), 'wood', -16)
fx(t0(95, '结构'), 'pencil', -18, dur=0.8)
fx(t0(98, '无法速成'), 'stamp', -6)
fx(t0(99, '商品'), 'machine_stop', -8)
fx(t0(100, '作品') - 0.02, 'stamp', -5)
fx(t0(100, '作品'), 'impact_big', -4)
fx(ls(101), 'rush', -18, dur=4.0)
fx(t0(105, '被看见'), 'bloom', -6)
fx(t0(105, '被看见') + 0.1, 'sparkle', -10)
fx(TL['duration'] - 3.3, 'stamp', -8)

# ------------------------------------------------------------ music cues
SECTION_NOTES = {
    'open': dict(mood='dark, sparse, breath; solo dizi long note over low D drone; warm D-major bloom at 被看见; near-silence at 太安静了', bpm=60,
                 hits={'最难': t0(1, '最'), '被看见': t0(2, '被'), 'quiet_start': ls(4), 'quiet_end': le(4)}),
    'loud': dict(mood='cheap trap/EDM, distorted 808, stutter; hard tape-stop to silence', bpm=140,
                 hits={'drop': t0(5, '喧'), 'stop': le(5) + 0.25}),
    'night': dict(mood='lo-fi night: felt piano chords, vinyl, rare koto pluck; thin to a held pad under the quote', bpm=70,
                  hits={'quote_in': ls(9), 'quote_out': le(11)}),
    'craft': dict(mood='warm appreciation: piano + strings pad + dizi fragments, D major pentatonic; light koto quarter-notes under the 没有… list', bpm=76,
                  hits={'triptych': ls(15), 'list': ls(17), 'calm': t0(19, '安静')}),
    'cruel': dict(mood='low cello drone + sub pulse, minor-second tension, very dark', bpm=60, hits={}),
    'traffic': dict(mood='cheap commercial EDM, four-on-floor, supersaw, sidechain pump; hard cut at end', bpm=128,
                    hits={'cut': ls(25) - 0.1}),
    'realize': dict(mood='after the cut: single piano notes, long reverb, slightly detuned wobble pad; celesta question motif ending unresolved; riser into chapter 02', bpm=66,
                    hits={'dislocate': t0(26, '错位'), 'question': ls(28), 'riser_end': ls(29) - 0.9}),
    'tracks': dict(mood='rhythmic build: koto ostinato 8ths, low taiko on 1 and 3, strings; stop-time hits on the four words', bpm=92,
                   hits={'twin': ls(31), '耗时间': t0(35, '耗时间'), '耐寂寞': t0(35, '耐寂寞'), '慢打磨': t0(35, '慢打磨'), '不讨巧': t0(35, '不讨巧')}),
    'market': dict(mood='tense spiccato strings 8ths, ticking, bass pulses; robotic arpeggiator speeding up under the AI grid; abrupt stop', bpm=100,
                   hits={'aigrid': ls(41), 'stop': le(41) + 0.3}),
    'irony': dict(mood='near silence; cheap bright stab at 速成品, soft low cello/piano at 用心作, sad chord', bpm=60,
                  hits={'cheap': ls(43), 'heart': ls(44)}),
    'painter': dict(mood='melancholic main theme on piano + cello (B minor); glitch break at AI; cold robotic pulse under swap; rushing texture; music-box line at rules', bpm=72,
                    hits={'glitch': t0(48, 'AI'), 'swap': ls(49), 'misfit': ls(51), 'rules': ls(52)}),
    'me': dict(mood='introspective drone + distant piano; ticking ostinato faster at me_run; dark ambient swell peaking at 迷茫 then silence', bpm=64,
               hits={'run': ls(55), 'anxiety': ls(56), 'peak': t0(59, '迷茫'), 'silence': le(59) + 0.6}),
    'march': dict(mood='hopeful bright: plucky koto/harp arpeggios, shaker, soft kick, D major pentatonic; dizi melody; claps under the boss list; big swell at 浪潮; warm strings to a soft peak at 命题', bpm=100,
                  hits={'break_out': t0(60, '跳出'), 'boss': ls(63), '浪潮': t0(66, '浪潮'), 'path': ls(67), '命题': t0(73, '命题')}),
    'books': dict(mood='curious pizzicato + celesta; cut to silence at 他说', bpm=96,
                  hits={'silence': ls(77)}),
    'roots': dict(mood='deep gong, low strings drone, choir pad swell, spacious', bpm=50,
                  hits={'gong': ls(78), '生命力': t0(78, '生命力')}),
    'copy': dict(mood='mechanical synth pulse; each 复制不了 adds layers (strings swell, taiko), the third is biggest, resolving warm at 温度与执念', bpm=110,
                 hits={'c1': t0(80, '不了'), 'c2': t0(81, '不了'), 'c3': t0(82, '不了'), 'warm': t0(82, '温度')}),
    'merge': dict(mood='MAIN THEME full: dizi melody over piano + strings + taiko, D major pentatonic; lighter under unique_*; shimmer build to peak at 越珍贵', bpm=84,
                  hits={'相通': t0(84, '高度相通'), 'rare': ls(89), 'peak': t0(89, '越珍贵')}),
    'youth': dict(mood='soft nostalgic piano + light strings; warm craft motif returns under masters', bpm=72,
                  hits={'masters': ls(94)}),
    'timbre': dict(mood='featured dizi solo (苍凉与温柔) with guzheng and soft strings; strings swell; taiko build into the stamp at 无法速成', bpm=72,
                   hits={'swell': ls(97), 'stamp': t0(98, '无法速成')}),
    'climax': dict(mood='full orchestra: big hit at start; crescendo to apex at 作品 (cymbal + choir); sustained theme softening; complete silence before 只是', bpm=76,
                   hits={'start': ls(99), 'apex': t0(100, '作品'), 'fade_out_end': ls(103) - 0.4}),
    'finale': dict(mood='silence during 只是; sparse piano; dizi enters at finale2 and builds; full warm D add9 swell at 被看见; end card resolves and decays', bpm=66,
                   hits={'piano_in': ls(104) - 0.1, 'dizi_in': ls(105), '被看见': t0(105, '被看见'), 'end_card': le(105) + 0.4}),
}

sections = []
for ln in LINES:
    if ln['music']:
        sections.append(dict(key=ln['music'], t0=ln['start'] if ln['i'] else 0.0))
for a, b in zip(sections, sections[1:]):
    a['t1'] = b['t0']
sections[-1]['t1'] = TL['duration']
# a section's music can start slightly before its first word
for s in sections:
    s.update(SECTION_NOTES[s['key']])
    s['hits'] = {k: round(v, 3) for k, v in s['hits'].items()}
    s['t0'] = round(s['t0'], 3)
    s['t1'] = round(s['t1'], 3)

speech = [[ln['start'], ln['end']] for ln in LINES]
out = dict(duration=TL['duration'], sections=sections, sfx=sorted(sfx, key=lambda e: e['t']), speech=speech)
json.dump(out, open(os.path.join(BUILD, 'cues.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(sections), 'sections,', len(sfx), 'sfx events, types:', sorted({e['type'] for e in sfx}))
