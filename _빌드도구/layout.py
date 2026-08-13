# -*- coding: utf-8 -*-
"""기출 PDF 페이지의 단(段) 구조와 문항 경계를 자동 검출한다.

페이지 크기가 파일·연도마다 다르므로 좌표는 모두 페이지 기준으로 상대 계산한다.
문항번호는 정규식이 아니라 '단의 왼쪽 여백에서 시작하는 줄'이라는 기하 조건으로 찾는다.
"""
import re, unicodedata

BANNER_H  = 60.0            # 합본 제작 시 상단에 찍힌 시험명 배너 높이
PUA       = re.compile('[-]')
CHROME_KW = ('저작권', '문제지', '평가원', '교육청', '무단', '복제', '교육과정',
             '학년도', '교시', '모의평가', '학력평가', '전국연합', '수학영역',
             '대학수학능력', '홀수형', '짝수형')
LABELS    = ('5지선다형', '단답형', '주관식', '5지 선다형', '단 답 형', '선다형')
# 시험지 끝에 붙는 안내 상자 (문항이 아님)
NOTE_KW   = ('확인사항', '답안지의해당란', '수고하셨습니다', '문제지와답안지', '이어서선택과목')
DIGITS    = '0123456789'


def squeeze(s):
    """겹쳐 찍힌 글자를 하나로. '확확인인 사사항항' → '확인 사항'

    문제지 안내 상자는 굵게 보이도록 같은 글자를 두 번 겹쳐 인쇄한 것이 있어,
    그대로 읽으면 낱말이 맞지 않는다."""
    out, i = [], 0
    while i < len(s):
        out.append(s[i])
        i += 2 if i + 1 < len(s) and s[i + 1] == s[i] else 1
    return ''.join(out)


def has_kw(s, kws):
    """겹쳐 찍힌 경우까지 감안해 낱말이 들어 있는지 본다."""
    a = s.replace(' ', '')
    b = squeeze(a)
    return any(k.replace(' ', '') in a or k.replace(' ', '') in b for k in kws)


# ---------------------------------------------------------------- 문자 추출

def get_chars(pg):
    """(문자, x0, top, x1, bottom) 목록. top은 페이지 상단 기준."""
    W, H = pg.get_size()
    tp = pg.get_textpage()
    n = tp.count_chars()
    txt = tp.get_text_range(0, n)
    out = []
    for i in range(n):
        ch = txt[i]
        if ch in '\r\n\t\x00':
            continue
        l, b, r, t = tp.get_charbox(i)
        if r - l <= 0 or t - b <= 0:
            continue
        out.append((ch, l, H - t, r, H - b, i))
    tp.close()
    return out, W, H


def banner_text(chars):
    return ''.join(c[0] for c in chars if c[2] < BANNER_H).strip()


def clean_text(s):
    s = PUA.sub(' ', unicodedata.normalize('NFC', s))
    return re.sub(r'\s+', ' ', s).strip()


def norm_key(s):
    s = PUA.sub('', unicodedata.normalize('NFC', s)).lower()
    return re.sub(r'[^0-9a-z가-힣]', '', s)


# ---------------------------------------------------------------- 줄 묶기

def make_lines(chars, tol=3.0):
    """같은 baseline(글자 상자 아래끝)끼리 한 줄로 묶어 x 순 정렬.
    윗첨자·분수 때문에 top 기준으로 묶으면 '1' 과 '.' 이 갈라지므로 baseline 을 쓴다."""
    cs = sorted(chars, key=lambda c: (c[4], c[1]))
    lines, cur = [], []
    for c in cs:
        if cur and abs(c[4] - cur[0][4]) > tol:
            lines.append(sorted(cur, key=lambda z: z[1])); cur = []
        cur.append(c)
    if cur:
        lines.append(sorted(cur, key=lambda z: z[1]))
    hs = sorted(c[4] - c[2] for c in chars) or [10.0]
    lines = merge_overlapping(lines, hs[len(hs) // 2])
    lines.sort(key=lambda ln: (min(c[2] for c in ln), line_box(ln)[0]))
    return lines


def merge_overlapping(lines, med_h, frac=0.55):
    """세로 위치가 거의 겹치는 조각들을 한 글줄로 합친다.

    같은 글줄인데도 글리프마다 baseline 이 미세하게 달라 '16.' 이
    '1'+'6.' 처럼 쪼개지는 경우가 있다. 위아래 겹침으로 판단하면
    이런 조각을 안전하게 다시 붙일 수 있다.
    윗줄·아랫줄까지 삼켜버리지 않도록 합쳐진 높이에 상한을 둔다.
    """
    cap = 2.5 * med_h
    items = sorted(lines, key=lambda ln: min(c[2] for c in ln))
    out = []
    for ln in items:
        t, b = min(c[2] for c in ln), max(c[4] for c in ln)
        for g in out:
            ov = min(b, g['b']) - max(t, g['t'])
            h = min(b - t, g['b'] - g['t'])
            if h > 0 and ov > frac * h and (max(b, g['b']) - min(t, g['t'])) <= cap:
                g['cs'].extend(ln)
                g['t'] = min(g['t'], t); g['b'] = max(g['b'], b)
                break
        else:
            out.append(dict(cs=list(ln), t=t, b=b))
    return [sorted(g['cs'], key=lambda z: z[1]) for g in out]


def line_text(ln):
    return ''.join(c[0] for c in ln)


def ink(ln):
    """공백 문자를 뺀 글자들.
    PDF 안에는 폭이 0인 공백이 엉뚱한 x 위치에 박혀 있는 경우가 있어,
    줄의 시작 위치나 문항번호를 판단할 때는 반드시 걸러야 한다."""
    out = [c for c in ln if not c[0].isspace()]
    return out or ln


def line_box(ln):
    g = ink(ln)
    return (min(c[1] for c in g), min(c[2] for c in g),
            max(c[3] for c in g), max(c[4] for c in g))


# ---------------------------------------------------------------- 레이아웃

def find_split(body, W):
    """단 경계 = 페이지 가운데에서 글자가 하나도 없는 가장 넓은 세로 띠의 중앙.
    밀도 최솟값만 쓰면 본문 한가운데를 가르는 사고가 나므로 '빈 띠'를 찾는다."""
    lo, hi = 0.43 * W, 0.57 * W
    n = int(hi - lo) + 1
    cov = bytearray(n)
    for _, x0, top, x1, bot, _i in body:
        a = max(0, int(x0 - lo) - 1)
        b = min(n, int(x1 - lo) + 2)
        for k in range(a, b):
            cov[k] = 1
    best_len, best_mid = 0, None
    k = 0
    while k < n:
        if cov[k]:
            k += 1; continue
        j = k
        while j < n and not cov[j]:
            j += 1
        if j - k > best_len:
            best_len, best_mid = j - k, lo + (k + j) / 2.0
        k = j
    if best_mid is not None and best_len >= 6:
        return best_mid
    # 빈 띠가 없으면 밀도가 가장 낮은 지점
    best, best_n = W / 2.0, None
    x = 0.40 * W
    while x <= 0.60 * W:
        c = sum(1 for z in body if x - 12 <= z[1] <= x + 12)
        if best_n is None or c < best_n:
            best_n, best = c, x
        x += 3.0
    return best


def col_margin(lines):
    """단의 왼쪽 본문 여백 = 줄 시작 x0 의 최빈값.
    표지 제목이나 그림처럼 왼쪽으로 튀어나온 줄에 흔들리지 않도록 백분위 대신 최빈값을 쓴다."""
    xs = [line_box(ln)[0] for ln in lines if len(clean_text(line_text(ln))) >= 4]
    if not xs:
        return None
    bins = {}
    for x in xs:
        bins.setdefault(round(x / 2.5), []).append(x)
    best = max(bins.values(), key=lambda v: (len(v), -min(v)))
    return min(best)


def parse_numdot(ln, med_h):
    """줄이 '12.' 꼴로 시작하면 번호를 돌려준다 (x 위치는 보지 않음)."""
    g = ink(ln)
    if not g:
        return None
    if (g[0][4] - g[0][2]) < med_h * 0.70:
        return None
    num, i = '', 0
    while i < len(g) and g[i][0] in DIGITS and len(num) < 2:
        num += g[i][0]; i += 1
    if not num or i >= len(g) or g[i][0] != '.':
        return None
    if i + 1 < len(g) and g[i + 1][0] in DIGITS and (g[i + 1][1] - g[i][3]) < 1.0:
        return None          # 소수점 (예: 1.5)
    return int(num)


def numdot_at(row, idx):
    """글자 목록(한 글줄, x 순)에서 idx 위치부터 'N.' 을 읽는다."""
    num, i = '', idx
    while i < len(row) and row[i][0] in DIGITS and len(num) < 2:
        num += row[i][0]; i += 1
    if not num or i >= len(row) or row[i][0] != '.':
        return None
    if row[i][1] - row[i - 1][3] > 3.5:        # 숫자와 마침표가 너무 멀면 아님
        return None
    if i + 1 < len(row) and row[i + 1][0] in DIGITS and (row[i + 1][1] - row[i][3]) < 1.0:
        return None                            # 소수점 (예: 1.5)
    return int(num)


def anchor_candidates(col_chars, med_h):
    """줄 묶기와 무관하게, 글자 위치만 보고 '문항번호' 후보를 찾는다.

    같은 글줄인데도 글리프마다 baseline 이 미세하게 어긋나 줄이 쪼개지는 PDF가 있어,
    줄에 의존하지 않고 '아래끝이 비슷한 글자들'을 그때그때 모아 판단한다.
    """
    g = [c for c in col_chars if not c[0].isspace()]
    g.sort(key=lambda c: c[1])
    out = []
    for c in g:
        if c[0] not in DIGITS:
            continue
        if (c[4] - c[2]) < med_h * 0.70:
            continue
        row = [z for z in g if abs(z[4] - c[4]) <= 2.5]
        row.sort(key=lambda z: z[1])
        idx = next((k for k, z in enumerate(row) if z is c), None)
        if idx is None:
            continue
        # 바로 왼쪽에 글자가 '붙어' 있으면 문장 속 숫자이므로 제외한다.
        # 옆 단에서 넘어온 쉼표 하나쯤은 멀리 떨어져 있으므로 무시된다.
        if idx > 0 and (c[1] - row[idx - 1][3]) < 6.0:
            continue
        n = numdot_at(row, idx)
        if n is not None:
            out.append((n, c))
    return out


def anchor_margin_of(cands, body_lm):
    xs = [c[1] for _, c in cands if body_lm is None or c[1] <= body_lm + 4.0]
    if not xs:
        return body_lm
    bins = {}
    for x in xs:
        bins.setdefault(round(x / 2.5), []).append(x)
    return min(max(bins.values(), key=lambda v: (len(v), -min(v))))


def anchor_margin(lines, med_h, body_lm):
    """문항번호 전용 왼쪽 여백. 번호는 본문보다 왼쪽으로 내어쓰기 되므로 따로 잰다."""
    xs = [line_box(ln)[0] for ln in lines
          if parse_numdot(ln, med_h) is not None
          and (body_lm is None or line_box(ln)[0] <= body_lm + 4.0)]
    if not xs:
        return body_lm
    bins = {}
    for x in xs:
        bins.setdefault(round(x / 2.5), []).append(x)
    return min(max(bins.values(), key=lambda v: (len(v), -min(v))))


def line_anchor(ln, lm, med_h):
    if lm is None:
        return None
    if not (lm - 4.0 <= line_box(ln)[0] <= lm + 6.0):
        return None
    return parse_numdot(ln, med_h)


def analyse(chars, W, H, force_split=None):
    """레이아웃 + 문항 조각 검출. 텍스트가 없으면 None.
    force_split 을 주면 (시험 구간 전체로 보정한 값) 그 경계를 그대로 쓴다."""
    body = [c for c in chars if c[2] >= BANNER_H]
    if len(body) < 25:
        return None

    heights = sorted(c[4] - c[2] for c in body)
    med_h = heights[len(heights) // 2]

    # 단 경계를 찾을 때는 머리말·꼬리말(쪽번호·과목명)을 빼야 한다.
    # 쪽번호가 하필 두 단 사이 여백에 찍혀 있어 경계 검출을 방해하기 때문.
    mid_band = [c for c in body if 0.16 * H < c[2] < 0.85 * H]
    auto_split = find_split(mid_band if len(mid_band) > 40 else body, W)
    split = auto_split if force_split is None else force_split
    left = [c for c in body if c[1] < split]
    right = [c for c in body if c[1] >= split]
    thr = 0.05 if force_split is not None else 0.12
    single = len(right) < thr * len(body) or len(left) < thr * len(body)

    groups = [body] if single else [left, right]
    lines_by_col = [make_lines(g) for g in groups]
    body_margins = [col_margin(ls) for ls in lines_by_col]

    # 문항번호는 줄 묶기와 무관하게 글자 위치로 직접 찾는다
    cands = [anchor_candidates(g, med_h) for g in groups]
    margins = [anchor_margin_of(cd, bm) for cd, bm in zip(cands, body_margins)]
    anchors_by_col = []
    for ci, cd in enumerate(cands):
        lm = margins[ci]
        picked = [] if lm is None else [(n, c) for n, c in cd if lm - 4.0 <= c[1] <= lm + 6.0]
        picked.sort(key=lambda z: z[1][2])
        anchors_by_col.append(picked)

    # 찾은 문항번호를 해당 글줄에 표시해 둔다
    anchored = []
    for ci, ls in enumerate(lines_by_col):
        marks = []
        for ln in ls:
            x0, top, x1, bot = line_box(ln)
            hit = next((n for n, c in anchors_by_col[ci]
                        if top - 2 <= c[2] <= bot + 2 and x0 - 2 <= c[1] <= x1 + 2), None)
            marks.append((ln, hit))
        anchored.append(marks)

    # 머리말/꼬리말 잘라내기: 위/아래 끝에서 짧고 번호 없는 줄들을 벗겨낸다
    def is_chrome(ln, num, H):
        s = clean_text(line_text(ln)).replace(' ', '')
        if has_kw(s, CHROME_KW):
            return True
        if num is not None:
            return False
        return len(s) <= 14

    tops, bots = [], []
    for ci, rows in enumerate(anchored):
        if not rows:
            continue
        i = 0
        while i < len(rows) and line_box(rows[i][0])[1] < 0.17 * H and is_chrome(rows[i][0], rows[i][1], H):
            i += 1
        j = len(rows) - 1
        while j >= 0 and line_box(rows[j][0])[1] > 0.85 * H and is_chrome(rows[j][0], rows[j][1], H):
            j -= 1
        if i <= j:
            tops.append(line_box(rows[i][0])[1])
            bots.append(line_box(rows[j][0])[3])
    if not tops:
        return None

    c_top = max(BANNER_H + 2, min(tops) - 8)
    c_bot = min(H - 3, max(bots) + 6)

    # 시험지 맨 끝의 '※ 확인 사항' 안내 상자는 문항이 아니므로 잘라낸다
    for ls in lines_by_col:
        for ln in ls:
            t = clean_text(line_text(ln)).replace(' ', '')
            top = line_box(ln)[1]
            if top > 0.45 * H and has_kw(t, NOTE_KW):
                # 안내 상자의 «테두리 선»까지 함께 잘라 낸다.
                # 글자만 피해 자르면 선이 남아 문항 아래가 길게 비어 보인다.
                c_bot = min(c_bot, top - 26)

    if single:
        cols = [(max(0.0, min(c[1] for c in body) - 14), min(W, max(c[3] for c in body) + 14))]
    else:
        cols = [(max(0.0, min(c[1] for c in left) - 14), split - 5),
                (split - 1, min(W, max(c[3] for c in right) + 14))]

    # 조각 만들기
    segs = []
    for ci, rows in enumerate(anchored):
        rows = [(ln, num) for ln, num in rows
                if c_top - 3 <= line_box(ln)[1] <= c_bot]
        anc = [(num, line_box(ln)[1]) for ln, num in rows if num is not None]
        first = anc[0][1] if anc else c_bot
        if first > c_top + 10:
            lead = ''.join(line_text(ln) for ln, _ in rows if line_box(ln)[1] < first - 5)
            lead = clean_text(PUA.sub('', lead))
            for L in LABELS:
                lead = lead.replace(L, '')
            if len(lead.strip()) > 3:
                segs.append((None, ci, c_top, first - 8))
        for k, (num, top) in enumerate(anc):
            bot = anc[k + 1][1] - 8 if k + 1 < len(anc) else c_bot
            segs.append((num, ci, top - 9, bot))

    return dict(cols=cols, margins=margins, split=split, auto_split=auto_split, single=single,
                content_top=c_top, content_bot=c_bot, segs=segs, med_h=med_h,
                lines_by_col=lines_by_col, anchors_by_col=anchors_by_col,
                cands_by_col=cands)


def seg_text(lay, ci, t0, t1):
    """조각의 텍스트. 줄 순서가 아니라 PDF 원본 문자 순서로 이어 붙여야
    윗첨자·분수 때문에 어순이 뒤섞이지 않는다."""
    picked = []
    for ln in lay['lines_by_col'][ci]:
        if t0 - 3 <= line_box(ln)[1] < t1:
            picked.extend(ln)
    picked.sort(key=lambda c: c[5])
    return clean_text(''.join(c[0] for c in picked))
