# -*- coding: utf-8 -*-
"""텍스트 층이 없는 스캔 페이지를 픽셀만 보고 문항으로 나눈다.

원리
  - 두 단 사이의 세로 괘선이 본문 영역의 위·아래 끝을 그대로 알려준다
  - 문항번호는 본문보다 왼쪽으로 내어쓰기 되어 있어, 단의 맨 왼쪽 좁은 띠에
    잉크가 닿는 줄만 골라내면 그것이 곧 문항의 시작이다

결과는 extract.py 와 같은 JSONL 형식이라 assemble.py 가 그대로 처리한다.
사용: python3 scan_extract.py <pdf> <start> <end> <out.jsonl> [배너이름]
"""
import sys, json
import numpy as np
import pypdfium2 as pdfium

DPI = 200
SC = DPI / 72.0
DARK = 200          # 이보다 어두우면 잉크
MIN_RUN = 6         # 문항번호로 인정할 최소 세로 픽셀 수


def close_gaps(mask, gap):
    """True 사이의 짧은 False 구간을 메운다 (모폴로지 닫기)."""
    m = mask.copy()
    idx = np.flatnonzero(mask)
    if idx.size < 2:
        return m
    for a, b in zip(idx[:-1], idx[1:]):
        if 1 < b - a <= gap + 1:
            m[a:b] = True
    return m


def box_ratio(sub, i, j):
    """그 덩어리에 들어 있는 가장 긴 가로선의 길이 / 단 폭.
    '단답형' 같은 안내 상자는 좁고(0.3 안팎), 조건·보기 상자는 단을 거의 채운다(0.9 안팎)."""
    colw = sub.shape[1]
    best = 0
    for y in range(i, min(j, sub.shape[0])):
        run = 0
        for v in sub[y]:
            run = run + 1 if v else 0
            if run > best:
                best = run
    return best / float(colw or 1)


def boxed(sub, lx, i, j):
    """조건 상자·<보기> 상자·'단답형' 안내처럼 네모 테두리로 시작하는 덩어리인지 판별.

    글자는 아무리 붙어 있어도 가로로 길게 이어지지 않지만,
    상자의 가로 테두리는 한 줄이 통째로 이어진다."""
    colw = sub.shape[1]
    for y in range(i, min(j, sub.shape[0])):
        row = sub[y]
        # (1) 왼쪽 여백 근처에서 시작하는 가로선 = 안내 상자의 테두리
        for s in range(max(0, lx - 4), min(colw, lx + 9)):
            if row[s]:
                run, k = 0, s
                while k < colw and row[k]:
                    run += 1; k += 1
                if run > 0.2 * DPI:
                    return True
                break
        # (2) 단 폭의 절반을 넘는 가로선 = 조건·보기 상자의 테두리
        run = best = 0
        for v in row:
            run = run + 1 if v else 0
            if run > best:
                best = run
        if best > 0.45 * colw:
            return True
    return False


def analyse_page(pg):
    W, H = pg.get_size()
    im = pg.render(scale=SC).to_pil().convert('L')
    a = np.asarray(im)
    ink = a < DARK
    ph, pw = ink.shape

    # --- 두 단 사이 세로 괘선 찾기 (가운데 30% 안에서 가장 길게 이어진 세로줄) ---
    mid0, mid1 = int(pw * 0.35), int(pw * 0.65)
    colsum = ink[:, mid0:mid1].sum(axis=0)
    if colsum.size == 0 or colsum.max() < ph * 0.35:
        return None
    rx = mid0 + int(colsum.argmax())
    # 머리말·꼬리말 글자가 우연히 같은 x 에 걸릴 수 있으므로
    # '가장 길게 끊김 없이 이어진 구간'을 괘선으로 삼는다
    rule = ink[:, rx]
    best = (0, 0, 0)
    i = 0
    while i < ph:
        if not rule[i]:
            i += 1; continue
        j = i
        while j < ph and rule[j]:
            j += 1
        if j - i > best[0]:
            best = (j - i, i, j)
        i = j
    if best[0] < ph * 0.40:
        return None
    ctop_px, cbot_px = best[1], best[2]

    # 시험지 맨 끝 '※ 확인 사항' 안내 상자 잘라내기:
    # 본문 맨 아래에 딱 붙어 있는 네모 상자는 문항이 아니다
    for x0, x1 in ((rx + 3, pw), (0, rx - 3)):
        seg = ink[ctop_px:cbot_px, x0:x1]
        wide = seg.sum(axis=1) > (x1 - x0) * 0.70
        idx = np.flatnonzero(wide)
        if idx.size >= 2 and (seg.shape[0] - idx[-1]) < 0.06 * ph:
            gap = np.flatnonzero(np.diff(idx) > 20)
            top_rule = idx[gap[-1]] if gap.size else idx[0]
            newbot = ctop_px + int(top_rule) - 6
            if newbot > ctop_px + 0.3 * (cbot_px - ctop_px):
                cbot_px = newbot
            break

    band = slice(ctop_px + 4, cbot_px - 3)
    cols_px = [(0, rx - 3), (rx + 3, pw)]
    out_cols, out_lines = [], []

    for ci, (x0, x1) in enumerate(cols_px):
        sub = ink[band, x0:x1]
        bh = sub.shape[0]
        # 세로 괘선(거의 모든 줄에 잉크가 있는 x)은 본문이 아니므로 왼쪽 끝 계산에서 뺀다
        colcnt = sub.sum(axis=0)
        # 잉크가 «한 점이라도» 있는 곳을 왼쪽 끝으로 삼으면, 스캔 얼룩이나
        # 쪽 테두리 한 줄에 끌려가 엉뚱한 여백을 문항번호 자리로 착각한다.
        # 글자 획 하나만큼(단 높이의 0.4%)은 있어야 본문으로 친다.
        floor = max(2, int(bh * 0.004))
        real = (colcnt >= floor) & (colcnt < bh * 0.5)
        xs = np.flatnonzero(real)
        if xs.size == 0:
            out_cols.append([x0 / SC, x1 / SC]); out_lines.append([]); continue
        lm = x0 + int(xs[0])                     # 이 단의 왼쪽 끝(=문항번호 위치)
        cx1 = min(x1, x0 + int(xs[-1]) + 26)
        out_cols.append([max(x0, lm - 26) / SC, cx1 / SC])

        # 문항번호 띠: 왼쪽 끝에서 오른쪽으로 조금만
        nb = ink[band, lm:lm + int(0.085 * DPI)]
        hit = nb.any(axis=1)
        # 굵은 글씨의 획 사이가 끊겨 한 번호가 두 번 잡히는 것을 막는다
        hit = close_gaps(hit, int(0.045 * DPI))
        # 본문 전체의 잉크 줄 (이어짐 판정용).
        # 세로 괘선은 빼고, 가로로 쭉 그어진 선(머리말 밑줄·상자 테두리)도 글이 아니므로 뺀다.
        core = sub[:, real]
        frac = core.sum(axis=1) / max(1, int(real.sum()))
        anyrow = (frac > 0) & (frac < 0.7)

        lines = []
        i = 0
        while i < hit.size:
            if not hit[i]:
                i += 1; continue
            j = i
            while j < hit.size and hit[j]:
                j += 1
            if j - i >= MIN_RUN:
                if boxed(sub, lm - x0, i, j):
                    # '5지선다형'·'단답형' 안내 상자 — 문항이 아니므로 위치만 기록해
                    # 앞 문항의 아래 경계로 쓴다
                    lines.append(dict(x=lm / SC, t=(band.start + i) / SC,
                                      b=(band.start + j) / SC, i=len(lines),
                                      n=-2, s='안내상자',
                                      bw=round(box_ratio(sub, i, j), 3)))
                else:
                    lines.append(dict(x=lm / SC, t=(band.start + i) / SC,
                                      b=(band.start + j) / SC, i=len(lines),
                                      n=-1, s='문항시작표시'))
            i = j
        # 첫 문항 위에 본문이 있으면(앞 문항에서 이어진 조각) 표시해 둔다.
        # '5지선다형'·'단답형' 안내 상자는 본문이 아니므로 지우고 판단한다.
        for ln in lines:
            if ln['n'] == -2:
                anyrow[max(0, int(ln['t'] * SC - band.start) - 3):
                       int(ln['b'] * SC - band.start) + 3] = False
        anc_lines = [ln for ln in lines if ln['n'] == -1]
        first = anc_lines[0]['t'] * SC - band.start if anc_lines else anyrow.size
        # 문항번호 바로 위(약 10pt)는 그 문항 자신의 분수·지수가 올라온 것이므로 제외한다
        if anyrow[:max(0, int(first) - 28)].sum() >= 8:
            lines.insert(0, dict(x=(lm + 12) / SC, t=band.start / SC,
                                 b=(band.start + max(1, int(first) - 4)) / SC,
                                 i=-1, n=None, s='앞문항에서이어짐'))
        out_lines.append(lines)

    return dict(w=round(W, 1), h=round(H, 1),
                cols=[[round(c[0], 1), round(c[1], 1)] for c in out_cols],
                ctop=round(ctop_px / SC, 1), cbot=round(cbot_px / SC, 1),
                lines=out_lines)


def main():
    src, a, b, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
    banner = sys.argv[5] if len(sys.argv) > 5 else None
    doc = pdfium.PdfDocument(src)
    rows = []
    for pi in range(a, min(b, len(doc))):
        pg = doc[pi]
        rec = analyse_page(pg)
        pg.close()
        if rec is None:
            rows.append(dict(page=pi, banner=banner or '', scan=True))
        else:
            rec['page'] = pi
            rec['banner'] = banner or ''
            rows.append(rec)
    with open(out, 'a', encoding='utf-8') as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    print('%d쪽 처리' % len(rows))


if __name__ == '__main__':
    main()
