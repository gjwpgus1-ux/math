# -*- coding: utf-8 -*-
"""«빠른 정답» 표를 칸 자리로 읽는다 — 객관식과 단답형을 함께.

글자를 이어 붙여 읽으면 «21①222231324625144» 처럼 뒤엉켜 단답형을 가릴 수 없다.
표는 «번호 | 답 | 번호 | 답 …» 격자이므로, 가로로 붙어 있는 글자를 한 칸으로 묶은 뒤
번호가 1, 2, 3 … 으로 이어지는 것을 따라가며 그 다음 칸을 답으로 읽는다.
"""
import re
import layout
import formula

CIRC = '①②③④⑤'
RUN = re.compile(r'(?:\d{1,2}[①②③④⑤]){2,}')
# 정답표 숫자가 사용자영역(PUA) 글꼴로 박힌 파일이 많다. formula.py 의 표로 되살린다.
PAIR = re.compile(r'(\d{1,2})\s*\.\s*([①②③④⑤]|\d{1,4})')
PUA_DIGIT = {k: v for k, v in formula.PUA.items() if v.isdigit()}


def de(ch):
    """PUA 숫자를 진짜 숫자로. 그 밖의 글자는 그대로."""
    return PUA_DIGIT.get(ord(ch), ch)


def cells(chars, gap=4.5):
    """가로로 붙어 있는 글자를 한 칸으로 묶는다 → [(글, x0, x1)]"""
    chars = [(de(c[0]),) + tuple(c[1:]) for c in chars]
    cs = sorted(chars, key=lambda c: c[1])
    out, cur = [], [cs[0]]
    for c in cs[1:]:
        if c[1] - max(x[3] for x in cur) <= gap:
            cur.append(c)
        else:
            out.append(cur); cur = [c]
    out.append(cur)
    return [(''.join(x[0] for x in q).strip(),
             min(x[1] for x in q), max(x[3] for x in q)) for q in out]


def read_grid(pg, start=1, per_row=5, max_rows=7, cluster=True):
    """이 쪽의 정답표를 읽는다 → {번호: 답}

    ① «1③2⑤…» 줄을 찾아 그 줄의 «번호 칸» x자리 다섯 개를 재어 둔다
    ② 아래 줄들에서 같은 x자리에 있는 칸을 번호 칸으로 보고, 바로 오른쪽 칸을 답으로 읽는다
    번호 글자가 특수 글꼴이라 안 읽히더라도 자리로 알 수 있어 단답형까지 잡힌다.
    start : 표가 시작하는 번호 (공통 1, 선택과목 23)
    """
    ch, W, H = layout.get_chars(pg)
    if not ch:
        return {}
    lines = layout.make_lines(ch)

    # ① 기준 줄
    anchor = None
    for l in lines:
        cs = sorted(l, key=lambda c: c[1])
        m = RUN.search(''.join(x[0] for x in cs))
        if not m:
            continue
        if int(re.match(r'(\d{1,2})', m.group()).group(1)) != start:
            continue
        anchor = (min(c[2] for c in l), cs[m.start():m.end()])
        break
    if not anchor:
        return {}
    top0, ac = anchor
    acell = cells(ac)
    if len(acell) < 4:
        return {}
    cols = [c[1] for c in acell[0::2]]          # 번호 칸의 왼쪽 x
    if len(cols) < 2:
        return {}
    step = (cols[-1] - cols[0]) / max(1, len(cols) - 1)
    right = acell[-1][2]
    gapy = None

    # ② 표 아래로 몇 줄 — 먼저 줄 사이 간격을 잰다
    tops = sorted(min(c[2] for c in l) for l in lines
                  if min(c[2] for c in l) >= top0 - 3
                  and any(cols[0] - 12 <= c[1] <= right + 12 for c in l))
    d = [b - a for a, b in zip(tops, tops[1:]) if 7 < b - a < 60]
    gapy = sorted(d)[len(d) // 2] if d else 14.0

    # 번호와 답이 서로 다른 줄로 쪼개져 있는 표가 있다.
    #   y=275  '6' '7' '8' '9' '10'      ← 번호만
    #   y=280  '⑤' '①' '④' '④' '④'      ← 답만
    # 그래서 줄 단위가 아니라 글자를 다시 y로 묶는다.
    if cluster:
        pool = [c for c in ch
                if cols[0] - 12 <= c[1] <= right + 12
                and top0 - gapy * 0.6 <= c[2] <= top0 + gapy * (max_rows - 0.4)]
        pool.sort(key=lambda c: (c[2] + c[4]) / 2)
        rows, cur = [], []
        for c in pool:
            cy = (c[2] + c[4]) / 2
            if cur and cy - (cur[-1][2] + cur[-1][4]) / 2 > gapy * 0.5:
                rows.append((min(x[2] for x in cur), cur)); cur = []
            cur.append(c)
        if cur:
            rows.append((min(x[2] for x in cur), cur))
    else:
        rows = []
        for l in lines:
            t = min(c[2] for c in l)
            if not (top0 - 3 <= t <= top0 + gapy * (max_rows - 0.4)):
                continue
            cc = [c for c in l if cols[0] - 12 <= c[1] <= right + 12]
            if cc:
                rows.append((t, cc))
        rows.sort(key=lambda r: r[0])
    rows = [r for r in rows if len(r[1]) >= 2]

    # ③ 칸 자리로 읽기
    out = {}
    ri = 0
    seen_top = None
    for t, cc in rows:
        if seen_top is not None and t - seen_top < gapy * 0.55:
            continue                             # 같은 줄이 둘로 쪼개진 것
        cl = cells(cc)
        got = False
        for k, px in enumerate(cols):
            no = start + ri * per_row + k
            if no > start + max_rows * per_row:
                break
            # 번호 칸 — 자리로 찾는다
            idx = None
            for j, (s, a, b) in enumerate(cl):
                if abs(a - px) <= step * 0.34:
                    idx = j; break
            if idx is None:
                continue
            s = cl[idx][0]
            # 답이 세 자리쯤 되면 번호와 붙어 한 칸으로 읽힌다 — «29288» = 29번 답 288
            v = None
            if s and re.fullmatch(r'\d{3,6}', s) and s.startswith(str(no)):
                rest = s[len(str(no)):]
                if re.fullmatch(r'\d{1,4}', rest):
                    v = rest
            if v is None:
                if s and re.fullmatch(r'\d{1,2}', s) and int(s) != no:
                    continue                     # 번호가 어긋나면 이 줄은 표가 아니다
                v = cl[idx + 1][0] if idx + 1 < len(cl) else ''
                if v and cl[idx + 1][1] > px + step - 6:
                    v = ''                       # 너무 오른쪽 — 다음 번호 칸이다
            if v in CIRC and v:
                out[no] = CIRC.index(v) + 1; got = True
            elif re.fullmatch(r'\d{1,4}', v or ''):
                out[no] = int(v); got = True
            else:
                got = got or bool(s)
        if got:
            ri += 1; seen_top = t
    return out



def split_cols(chars, W):
    """글자가 하나도 없는 세로 띠로 단을 갈라 [단1 글자들, 단2 글자들, …] 로 준다."""
    filled = [False] * (int(W) + 2)
    for c in chars:
        for x in range(int(max(0, c[1])), int(min(W, c[3])) + 1):
            filled[x] = True
    cuts, run = [], None
    for x in range(int(W * 0.10), int(W * 0.90)):
        if not filled[x]:
            run = x if run is None else run
        else:
            if run is not None and x - run >= 8:
                cuts.append((run + x) // 2)
            run = None
    keep = []
    for b in cuts:
        if not keep or b - keep[-1] > W * 0.15:
            keep.append(b)
    if not keep:
        return [chars]
    out = [[] for _ in range(len(keep) + 1)]
    for c in chars:
        i = 0
        while i < len(keep) and c[1] > keep[i]:
            i += 1
        out[i].append(c)
    return [o for o in out if o]


def read_dotted(path, pdfium):
    """평가원 «정답 및 풀이» 꼴을 읽는다 → [(None, {번호: 답})]

    이쪽은 표가 아니라 이렇게 적혀 있다.
        01. ② 02. ①03. ③ 04.③ 05. ②
        16. 2 17. 6 18. 133 19. 82
    풀이 본문에도 «1. 출제의도…» 같은 것이 있으므로,
    한 줄에 «번호. 답» 이 세 쌍 넘게 있을 때만 정답 줄로 본다.
    """
    d = pdfium.PdfDocument(path)
    got, lines = {}, []
    try:
        for pi in range(len(d)):
            pg = d[pi]
            try:
                ch, W, H = layout.get_chars(pg)
                if not ch:
                    continue
                # 두 단으로 짜여 있어 그냥 읽으면 옆 단 숫자가 섞인다. 단을 갈라 놓는다.
                for cc in split_cols(ch, W):
                    for l in layout.make_lines(cc):
                        lines.append(cells(l))
            finally:
                pg.close()
    finally:
        d.close()

    def pairs(cl):
        """한 줄에서 «번호 → 답» 을 캐낸다.
        칸 단위로 읽는다. 글자를 이어 붙이면 «18. 133 19. 82» 가
        «18.1331982» 처럼 엉겨 옆 숫자를 물고 들어온다."""
        out = []
        for j, (t, x0, x1) in enumerate(cl):
            m = re.fullmatch(r'(\d{1,2})\.\s*([①②③④⑤]|\d{1,4})', t)
            if m:
                a, b = m.group(1), m.group(2)
            else:
                m = re.fullmatch(r'(\d{1,2})\.', t)
                if not m or j + 1 >= len(cl):
                    continue
                a, b = m.group(1), cl[j + 1][0]
                if not re.fullmatch(r'[①②③④⑤]|\d{1,4}', b):
                    continue
            n = int(a)
            if 1 <= n <= 30:
                out.append((n, CIRC.index(b) + 1 if b in CIRC else int(b)))
        return out

    # 세 쌍 넘게 있으면 정답 줄로 본다. 두 쌍뿐이어도 앞 줄에서 이어지는
    # 번호(21, 22 처럼 표 끝자락)면 받아들인다.
    cand = [(cl, pairs(cl)) for cl in lines]
    for _ in range(3):
        for cl, ps in cand:
            if not ps:
                continue
            if len(ps) >= 3 or (len(ps) >= 2 and got and min(n for n, _ in ps) == max(got) + 1):
                for n, v in ps:
                    got.setdefault(n, v)
    return [(None, got)] if got else []


def read_file(path, pdfium, cluster=True):
    """한 파일에서 (시작번호별) 표를 모두 읽는다 → [(과목표시, {번호: 답})]"""
    SECT = re.compile(r'\[\s*(확률과\s*통계|미적분|기하)\s*\]')
    d = pdfium.PdfDocument(path)
    out, done1 = [], False
    try:
        for pi in range(len(d)):
            pg = d[pi]
            try:
                lab = None
                ch, W, H = layout.get_chars(pg)
                for l in layout.make_lines(ch):
                    m = SECT.search(''.join(x[0] for x in sorted(l, key=lambda c: c[1])))
                    if m:
                        lab = m.group(1).replace(' ', ''); break
                # 공통 표는 한 번만. 뒷쪽 본문에 «1③2⑤» 꼴이 우연히 있어도 표로 보지 않는다.
                if not done1:
                    g = read_grid(pg, start=1, cluster=cluster)
                    if len(g) >= 10:
                        out.append((lab, g)); done1 = True
                g = read_grid(pg, start=23, cluster=cluster)
                if len(g) >= 5:
                    out.append((lab, g))
            finally:
                pg.close()
    finally:
        d.close()
    return out
