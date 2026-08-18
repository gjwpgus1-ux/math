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


def read_grid(pg, start=1, per_row=5, max_rows=7):
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

    # ② 표 아래로 몇 줄
    rows = []
    for l in lines:
        t = min(c[2] for c in l)
        if t < top0 - 3:
            continue
        cc = [c for c in l if cols[0] - 12 <= c[1] <= right + 12]
        if len(cc) >= 2:
            rows.append((t, cc))
    rows.sort(key=lambda r: r[0])
    if len(rows) > 1:
        d = [b[0] - a[0] for a, b in zip(rows, rows[1:]) if 4 < b[0] - a[0] < 60]
        gapy = sorted(d)[len(d) // 2] if d else 14.0
    else:
        gapy = 14.0
    rows = [r for r in rows if r[0] <= top0 + gapy * (max_rows - 0.4)]

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


def read_file(path, pdfium):
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
                    g = read_grid(pg, start=1)
                    if len(g) >= 10:
                        out.append((lab, g)); done1 = True
                g = read_grid(pg, start=23)
                if len(g) >= 5:
                    out.append((lab, g))
            finally:
                pg.close()
    finally:
        d.close()
    return out
