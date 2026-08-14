# -*- coding: utf-8 -*-
"""문제지 수식을 글자로 되살린다.

왜 필요한가
    문제지 글꼴은 수식을 «사용자 영역(PUA)»이라는 비표준 코드로 넣는다.
    그래서 그냥 읽으면 x, 2, +, √ 같은 것이 모두 사라진다.
    글자 모양을 눈으로 보고 만든 표(PUA)로 되돌린다.

무엇을 살리나
    · 숫자·영문자(대소문자 구분)·괄호·연산자·그리스문자·√·Σ·∫
    · 위첨자 ^ · 아래첨자 _   (글자의 크기와 높이를 보고 가른다)
    · 분수 a/b               (가로선 위아래에 놓인 글자를 묶는다)
"""
import re, collections

# ── 글자 모양을 보고 적은 표 ──────────────────────────────────
PUA = {
 0xE034:'1',0xE035:'2',0xE036:'3',0xE037:'4',0xE038:'5',0xE039:'6',0xE03A:'7',0xE03B:'8',
 0xE03C:'9',0xE03D:'0',
 0xE044:'(',0xE045:')',0xE046:'-',0xE047:'=',0xE048:'+',0xE049:'[',0xE04A:']',
 0xE04B:'{',0xE04C:'}',0xE04D:'|',0xE04F:':',0xE052:',',0xE053:'·',0xE055:'<',0xE056:'>',
 0xE05B:'∫',0xE05C:'√',0xE05F:'·',0xE067:'Σ',0xE06E:'→',0xE042:'%',0xE03E:'!',
 0xF000:'/',0xE0C8:'○',0xE07B:'|',0xE101:'|',0xE104:'|',
 0xE078:'(',0xE100:'(',0xE103:'(',0xE07A:')',0xE102:')',0xE105:')',0xE079:'{',
 0xE000:'A',0xE001:'B',0xE002:'C',0xE003:'D',0xE004:'E',0xE005:'F',0xE006:'G',0xE008:'I',
 0xE00A:'K',0xE00B:'L',0xE00C:'M',0xE00D:'N',0xE00E:'O',0xE00F:'P',0xE010:'Q',0xE011:'R',
 0xE012:'S',0xE013:'T',0xE014:'U',0xE015:'V',0xE016:'W',0xE017:'X',0xE018:'Y',0xE019:'Z',
 0xE0E7:'C',
 0xE0E5:'a',0xE0E6:'b',0xE0E8:'d',0xE0E9:'e',0xE0EA:'f',0xE0EB:'g',0xE0EC:'h',0xE0ED:'i',
 0xE0EE:'j',0xE0EF:'k',0xE0F0:'l',0xE0F1:'m',0xE0F2:'n',0xE0F4:'p',0xE0F5:'q',0xE0F6:'r',
 0xE0F7:'s',0xE0F8:'t',0xE0F9:'u',0xE0FA:'v',0xE0FC:'x',0xE0FD:'y',0xE0FE:'z',
 0xE09D:'α',0xE09E:'β',0xE09F:'γ',0xE0A4:'θ',0xE0AC:'π',0xE0AE:'σ',
}
BAR = 0xE06D            # 분수 가로선 (마이너스와 다른 글자)
CAN_SUB = re.compile(r'[0-9A-Za-z αβγθπσ∞]')   # 첨자가 될 수 있는 글자 (연산자는 뺀다)


def conv(ch):
    """PUA 한 글자를 진짜 글자로. 모르는 PUA 는 버린다."""
    o = ord(ch)
    if o in PUA:
        return PUA[o]
    if 0xE000 <= o <= 0xF8FF:
        return ''
    return ch


def build(chars):
    """chars = [(글자, x0, top, x1, bottom, 순서)] → 수식이 살아 있는 한 줄 글."""
    cs = [c for c in chars if c[0] not in ' \n\r\t' and c[3] > c[1] and c[4] > c[2]]
    if not cs:
        return ''
    hs = sorted(c[4] - c[2] for c in cs)
    base_h = hs[len(hs) // 2] or 1.0                 # 본문 글자 크기

    # 분수 가로선 찾기
    bars = [c for c in cs if ord(c[0]) == BAR]
    used = set()
    frac, over = [], []                                        # (선, 분자들, 분모들)
    for b in bars:
        bx0, bx1 = b[1], b[3]
        by = (b[2] + b[4]) / 2
        num, den = [], []
        for i, c in enumerate(cs):
            if c is b or i in used:
                continue
            cx = (c[1] + c[3]) / 2
            if not (bx0 - 1 <= cx <= bx1 + 1):
                continue
            cy = (c[2] + c[4]) / 2
            if abs(cy - by) > base_h * 3.0:
                continue
            (num if cy < by else den).append((i, c))
        if num and den:
            frac.append((b, num, den))
            for i, _ in num + den:
                used.add(i)
        elif den and not num:
            over.append(b)          # 아래에만 글자 → 선분·벡터 위의 줄

    fr_at = {}
    for b, num, den in frac:
        def txt(g):
            g = sorted(g, key=lambda z: z[1][1])
            return ''.join(conv(c[0]) for _, c in g)
        fr_at[id(b)] = '(%s)/(%s)' % (txt(num), txt(den))

    # 줄을 따라가며 글자를 잇는다
    out = []
    order = sorted(range(len(cs)), key=lambda i: cs[i][5])
    mode = 0                                         # 0 보통 · 1 위첨자 · -1 아래첨자
    for i in order:
        c = cs[i]
        if ord(c[0]) == BAR:
            if id(c) in fr_at:
                out.append(fr_at[id(c)])
            else:
                pass                # 선분 위의 줄이거나 못 푼 분수선 — 글자로 옮기지 않는다
                                    # ('-' 로 적으면 없는 뺄셈이 생겨 검색을 더 망친다)
            continue
        if i in used:
            continue
        t = conv(c[0])
        if not t:
            continue
        out.append((t, c[4] - c[2], c))
    # 두 번째 지나가기 — 위/아래첨자 판정
    # 글자의 «아랫선(기준선)»으로 가른다.
    # a, x, c 처럼 위로 삐치는 획이 없는 글자는 키가 작아서
    # 크기만 보면 첨자로 잘못 읽힌다. 아랫선은 그런 영향을 받지 않는다.
    body = [o for o in out if isinstance(o, tuple) and o[1] >= base_h * 0.5]
    if body:
        bots = sorted(o[2][4] for o in body)
        base_bot = bots[len(bots) // 2]
    else:
        base_bot = None
    # 글자마다 «보통 / 위 / 아래»를 정한다.
    # 마침표·쉼표·연산자는 스스로 첨자가 되지 못한다 —
    # +, - 는 글줄 가운데에 놓여서 크기만 보면 위첨자로 잘못 읽히기 때문이다.
    marks = []
    for o in out:
        if isinstance(o, str):
            marks.append(None); continue
        t, h, c = o
        m = 0
        if base_bot is not None and CAN_SUB.match(t):
            bot = c[4]
            if bot < base_bot - base_h * 0.28:
                m = 1
            elif bot > base_bot + base_h * 0.14:
                m = -1
        marks.append(m)
    # 연산자는 앞뒤가 같은 첨자 안에 있을 때만 그 안에 넣는다 (a^(n+1) 같은 경우)
    for i, o in enumerate(out):
        if isinstance(o, str) or CAN_SUB.match(o[0]):
            continue
        if o[0] not in '+-':
            continue
        prev = next((marks[j] for j in range(i - 1, -1, -1) if marks[j] is not None), 0)
        nxt = next((marks[j] for j in range(i + 1, len(marks)) if marks[j] is not None), 0)
        marks[i] = prev if (prev == nxt and prev) else 0

    res, mode = [], 0
    for o, m in zip(out, marks):
        if isinstance(o, str):
            if mode: res.append(')'); mode = 0
            res.append(o); continue
        if m != mode:
            if mode: res.append(')')
            if m == 1: res.append('^(')
            elif m == -1: res.append('_(')
            mode = m
        res.append(o[0])
    if mode: res.append(')')
    s = ''.join(res)
    s = re.sub(r'\^\((.)\)', r'^\1', s)              # ^(2) → ^2
    s = re.sub(r'_\((.)\)', r'_\1', s)
    return s
