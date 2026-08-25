# -*- coding: utf-8 -*-
"""글자 층이 없는 스캔 시험지를 문항별 그림으로 잘라 낸다.

먼저 deskew_pdf.py 로 쪽을 반듯하게 편 다음 쓴다.

  ① 두 단 사이 세로 괘선으로 단을 나누고, 단마다 본문 왼쪽 끝을 잰다
  ② 쪽 전체를 tesseract 로 읽어 «12.» 처럼 생긴 낱말 가운데
     단 왼쪽 끝에 붙어 있는 것만 문항번호로 본다
  ③ 읽는 차례(쪽 → 단 → 위에서 아래)로 늘어놓고, 번호가 차례대로
     커지는 가장 긴 줄기만 남긴다 (본문에 섞인 «7.» 따위를 걷어 낸다)
  ④ 빠진 번호는 앞뒤 문항 사이에서 «가장 넓은 빈 줄»을 찾아 그 자리로 삼는다
  ⑤ 문항 시작부터 다음 문항 시작까지를 잘라 내고, 단·쪽을 넘어가면 이어 붙인다

결과는 add_exams.py / build_secret.py 가 그대로 받는 q.json + manifest.jsonl 이다.

그래도 못 찾는 번호가 남으면 «손잡이» 파일로 자리를 직접 일러 줄 수 있다.
   {"anchors": {"5": [1, 0, 355]},        번호: [몇째쪽, 몇째단, 위에서 몇 픽셀]
    "bottom":  {"22": 2560}}              그 문항을 여기서 끊어라 (※ 확인 사항 상자 따위)

사용: python3 scan_q.py <편PDF> <작업폴더> <시험이름> <첫쪽> <끝쪽> <첫번호> <끝번호> [손잡이.json]
예:   python3 scan_q.py 문제지.pdf /tmp/일감/x01 "2026년 8월 고3 공통" 0 8 1 22 손잡이.json
"""
import sys, os, re, json
import numpy as np
import pypdfium2 as pdfium
import pytesseract
from PIL import Image

DPI = 200
SC = DPI / 72.0
DARK = 200
PAT = re.compile(r'^([0-9lLI]{1,2})[.,]$')
LINE = re.compile(r'^\s*([0-9lLI]{1,2})\s*[.,]\s')
ONE = str.maketrans('lLI', '111')
NEAR_LEFT = 44        # 단 왼쪽 끝에서 이만큼 안쪽까지를 «번호 자리»로 본다
PAD = 10              # 잘라 낼 때 둘레 여백(픽셀)
LINE_GAP = 7          # 이만큼 비면 글줄이 바뀐 것
BLOCK_GAP = 26        # 이만큼 비면 덩어리가 바뀐 것
RULE_GAP = 40         # 괘선이 이만큼 끊긴 것은 이어진 것으로 본다
RULE_BAND = 18        # 괘선을 이만큼 좌우로 넓게 본다 (쪽이 조금 기울어도)
MIN_CONT = 130        # 다음 단으로 이어졌다고 볼 최소 길이
FOOT_H = 150          # 쪽번호 상자로 볼 최대 높이
FOOT_GAP = 150        # 위 덩어리와 이만큼 떨어져 있으면 쪽번호로 본다


def rules(ink):
    """가운데 세로 괘선의 x 와, 괘선이 뻗은 위·아래 끝."""
    ph, pw = ink.shape
    lo, hi = int(pw * 0.35), int(pw * 0.65)
    cs = ink[:, lo:hi].sum(axis=0)
    if cs.size == 0 or cs.max() < ph * 0.18:
        return None, 0, ph
    rx = lo + int(cs.argmax())
    # 쪽이 조금만 기울어도 괘선이 여러 칸에 걸쳐 흩어진다.
    # 한 칸만 보지 말고 좌우로 조금 넓게 «띠»로 보아야 끊기지 않는다.
    a0 = max(0, rx - RULE_BAND); a1 = min(pw, rx + RULE_BAND + 1)
    col = ink[:, a0:a1].any(axis=1)
    # 스캔이 흐려 괘선이 군데군데 끊긴다. 짧은 끊김은 이어 붙여 놓고 재야
    # 본문의 위·아래 끝을 제대로 잡는다. (안 그러면 쪽 가운데서 끊긴다)
    idx = np.flatnonzero(col)
    for a, b in zip(idx[:-1], idx[1:]):
        if 1 < b - a <= RULE_GAP:
            col[a:b] = True
    best, i = (0, 0, ph), 0
    while i < ph:
        if not col[i]:
            i += 1; continue
        j = i
        while j < ph and col[j]:
            j += 1
        if j - i > best[0]:
            best = (j - i, i, j)
        i = j
    if best[0] < ph * 0.40:
        return None, 0, ph
    return rx, best[1], best[2]


def cut_above(ink, x0, x1, y, ct):
    """다음 문항이 시작하는 y 위쪽의 «빈 줄» 한가운데를 끊는 자리로 삼는다.

    번호 «2.» 의 위끝을 그대로 쓰면, 그 줄에 분수처럼 위로 솟은 것이 있을 때
    앞 문항 그림에 윗동강이 딸려 들어간다."""
    on = ink[:, x0:x1].any(axis=1)
    i = min(y, len(on) - 1)
    while i > ct and on[i]:          # 다음 문항의 글에서 위로 빠져나온다
        i -= 1
    j = i
    while j > ct and not on[j]:      # 빈 줄의 위끝까지
        j -= 1
    return (i + j) // 2 if i > j else y - 4


def drop_footer(ink, x0, x1, ct, cb):
    """단의 아래끝을 «쪽번호 상자» 위로 당긴다.

    쪽 아래 «1/16» 은 문항이 아닌데, 문항을 단 끝까지 자르면 늘 딸려 들어간다.
    맨 아래 덩어리가 작고(글 몇 줄이 못 되고) 위 덩어리와 멀리 떨어져 있으면
    쪽번호로 본다."""
    bs = blocks(ink, x0, x1, ct, cb)
    if len(bs) < 2:
        return cb
    last, prev = bs[-1], bs[-2]
    if last[1] - last[0] <= FOOT_H and last[0] - prev[1] >= FOOT_GAP:
        return last[0] - 8
    return cb


def left_edge(ink, x0, x1, ct, cb):
    sub = ink[ct:cb, x0:x1]
    bh = sub.shape[0]
    cc = sub.sum(axis=0)
    xs = np.flatnonzero((cc >= max(2, int(bh * 0.004))) & (cc < bh * 0.5))
    return x0 + int(xs[0]) if xs.size else x0


def scan_page(pg):
    """한 쪽 → (그림, 단 경계, 위·아래, 단별 왼쪽끝, 찾은 번호들)"""
    im = pg.render(scale=SC).to_pil().convert('L')
    ink = np.asarray(im) < DARK
    ph, pw = ink.shape
    rx, ct, cb = rules(ink)
    if rx is None:
        return im, None
    # 단 사이 괘선은 크롭에 넣지 않는다. 넣으면 세로선이 아래까지 이어져
    # «여기까지 글이 있다»고 잘못 재고, 빈 곳을 못 잘라 낸다.
    cols = [(0, rx - 14), (rx + 14, pw)]
    lm = [left_edge(ink, a, b, ct, cb) for a, b in cols]
    # 단마다 아래끝을 따로 잡는다 — 쪽번호 상자를 문항에서 뺀다
    cbot = [drop_footer(ink, a + 6, b - 6, ct, cb) for a, b in cols]
    df = pytesseract.image_to_data(im, lang='eng', config='--psm 3',
                                   output_type=pytesseract.Output.DICT)
    hits = []
    for i, t in enumerate(df['text']):
        m = PAT.match(t.strip())
        if not m:
            continue
        v = m.group(1).translate(ONE)
        if not v.isdigit():
            continue
        L, T = df['left'][i], df['top'][i]
        ci = 0 if L < rx else 1
        if abs(L - lm[ci]) > NEAR_LEFT:
            continue
        hits.append((ci, T, int(v)))

    # 쪽을 통째로 읽으면 놓치는 번호가 많다 (글이 빽빽한 쪽에서 특히).
    # 단마다 따로 한 번 더 읽어 빠진 것을 채운다.
    have = set((c, n) for c, _, n in hits)
    for ci, (x0, x1) in enumerate(cols):
        sub = im.crop((max(0, lm[ci] - 20), ct, x1, cb))
        df2 = pytesseract.image_to_data(sub, lang='eng', config='--psm 6',
                                        output_type=pytesseract.Output.DICT)
        L = {}
        for i, t in enumerate(df2['text']):
            if not t.strip():
                continue
            k = (df2['block_num'][i], df2['par_num'][i], df2['line_num'][i])
            if k not in L:
                L[k] = [df2['top'][i], df2['left'][i], []]
            L[k][0] = min(L[k][0], df2['top'][i])
            L[k][1] = min(L[k][1], df2['left'][i])
            L[k][2].append(t)
        for top, left, ws in L.values():
            m = LINE.match(' '.join(ws))
            if not m or left > 40:          # 줄 첫머리에 붙어 있어야 문항번호다
                continue
            v = m.group(1).translate(ONE)
            if v.isdigit() and (ci, int(v)) not in have:
                have.add((ci, int(v)))
                hits.append((ci, ct + top, int(v)))
    hits.sort()
    return im, dict(ink=ink, cols=cols, ct=ct, cb=cb, cbot=cbot, lm=lm, hits=hits)


def rising(nums):
    """차례대로 커지는 가장 긴 묶음의 자리 번호."""
    n = len(nums)
    if not n:
        return []
    best = [1] * n; prev = [-1] * n
    for i in range(n):
        for j in range(i):
            if nums[j] < nums[i] and best[j] + 1 > best[i]:
                best[i] = best[j] + 1; prev[i] = j
    i = max(range(n), key=lambda k: best[k])
    out = []
    while i >= 0:
        out.append(i); i = prev[i]
    return out[::-1]


def blocks(ink, x0, x1, ct, cb):
    """단 안에서 빈 줄로 갈린 덩어리들의 (위, 아래) — 쪽 위 기준 픽셀."""
    on = ink[ct:cb, x0:x1].sum(axis=1) > 0
    out, s, run = [], None, 0
    for y, v in enumerate(on):
        if v:
            if s is None:
                s = y
            run = 0
        elif s is not None:
            run += 1
            if run >= BLOCK_GAP:
                out.append((ct + s, ct + y - run)); s = None; run = 0
    if s is not None:
        out.append((ct + s, cb))
    return [b for b in out if b[1] - b[0] > 14]


def main():
    src, work, name = sys.argv[1], sys.argv[2], sys.argv[3]
    a0, a1 = int(sys.argv[4]), int(sys.argv[5])
    lo, hi = int(sys.argv[6]), int(sys.argv[7])
    hand = {}
    if len(sys.argv) > 8 and os.path.exists(sys.argv[8]):
        hand = json.load(open(sys.argv[8], encoding='utf-8'))
    HA = {int(k): v for k, v in (hand.get('anchors') or {}).items()}
    HB = {int(k): v for k, v in (hand.get('bottom') or {}).items()}

    d = pdfium.PdfDocument(src)
    pages = []
    for pi in range(a0, a1):
        pg = d[pi]
        im, rec = scan_page(pg)
        pg.close()
        pages.append((pi, im, rec))
        print('  %2d쪽  찾은 번호 %s' % (pi, [h[2] for h in rec['hits']] if rec else '괘선 못 찾음'),
              flush=True)

    # 읽는 차례로 늘어놓고 차례대로 커지는 것만 남긴다
    flat = []
    for k, (pi, im, rec) in enumerate(pages):
        if not rec:
            continue
        for ci, T, v in rec['hits']:
            flat.append(dict(k=k, ci=ci, y=T, no=v))
    keep = [flat[i] for i in rising([f['no'] for f in flat])]
    keep = [f for f in keep if lo <= f['no'] <= hi]
    miss = [n for n in range(lo, hi + 1) if n not in [f['no'] for f in keep]]
    print('\n  살린 번호 %s\n  못 찾은 번호 %s' % ([f['no'] for f in keep], miss))

    # 손으로 일러 준 자리가 있으면 그것을 따른다 (잘못 읽은 것을 덮어쓴다)
    for n, v in sorted(HA.items()):
        if not (lo <= n <= hi):
            continue
        keep = [f for f in keep if f['no'] != n]
        keep.append(dict(k=v[0] - a0, ci=v[1], y=v[2], no=n))
        print('  %d번 → 손으로 잡음 %s' % (n, v))
    keep.sort(key=lambda f: f['no'])
    miss = [n for n in range(lo, hi + 1) if n not in [f['no'] for f in keep]]

    # 그래도 못 찾은 번호는 앞뒤 사이에서 빈 줄 자리로 채운다
    for n in miss:
        before = [f for f in keep if f['no'] < n]
        after = [f for f in keep if f['no'] > n]
        if not before or not after:
            continue
        A, B = before[-1], after[0]
        cand = []
        for k in range(A['k'], B['k'] + 1):
            pi, im, rec = pages[k]
            if not rec:
                continue
            for ci in range(2):
                if (k, ci) < (A['k'], A['ci']) or (k, ci) > (B['k'], B['ci']):
                    continue
                x0, x1 = rec['cols'][ci]
                for bs, be in blocks(rec['ink'], x0 + 6, x1 - 6, rec['ct'], rec['cb']):
                    if (k, ci, bs) <= (A['k'], A['ci'], A['y']):
                        continue
                    if (k, ci, bs) >= (B['k'], B['ci'], B['y']):
                        continue
                    # 문항의 첫 줄은 번호가 왼쪽으로 내어쓰기 되어 있다.
                    # 이어지는 줄·선택지는 안쪽에서 시작하므로, 단 왼쪽 끝에
                    # 가장 바짝 붙은 덩어리가 문항이 시작하는 자리다.
                    seg = rec['ink'][bs:min(be, bs + 60), x0 + 6:x1 - 6]
                    xs = np.flatnonzero(seg.any(axis=0))
                    off = int(xs[0]) if xs.size else 9999
                    cand.append(dict(k=k, ci=ci, y=bs, no=n, off=off))
        cand.sort(key=lambda c: c['off'])
        if len(cand) == 1:
            keep.append(cand[0]); print('  %d번 → 빈 줄로 찾음' % n)
        elif cand:
            keep.append(cand[0]); print('  %d번 → 빈 줄 %d곳 가운데 첫째로 잡음' % (n, len(cand)))
    keep.sort(key=lambda f: f['no'])

    got = [f['no'] for f in keep]
    if got != list(range(lo, hi + 1)):
        print('\n  ⚠ 번호가 %s ~ %s 로 딱 떨어지지 않습니다: %s' % (lo, hi, got))

    # 잘라 내기 — 문항 시작부터 다음 시작까지, 단·쪽을 넘으면 이어 붙인다
    os.makedirs(os.path.join(work, 'img'), exist_ok=True)
    man, qs = [], []
    for idx, f in enumerate(keep):
        nxt = keep[idx + 1] if idx + 1 < len(keep) else None
        parts = []
        k, ci, y = f['k'], f['ci'], f['y']
        while True:
            pi, im, rec = pages[k]
            if not rec:          # 괘선을 못 찾은 쪽은 건너뛴다
                break
            x0, x1 = rec['cols'][ci]
            top = y if (k, ci) == (f['k'], f['ci']) else rec['ct']
            if nxt and (k, ci) == (nxt['k'], nxt['ci']):
                bot = cut_above(rec['ink'], x0 + 6, x1 - 6, nxt['y'], rec['ct'])
            else:
                bot = rec['cbot'][ci]
            if f['no'] in HB and (k, ci) == (f['k'], f['ci']):
                bot = min(bot, HB[f['no']])       # 손으로 일러 준 끊는 자리
            box = (max(0, x0 - PAD), max(0, top - PAD),
                   min(im.width, x1 + PAD), min(im.height, bot + PAD))
            # 다음 단으로 «이어진» 조각은 어느 정도 길어야 진짜다.
            # 다음 문항이 단 첫머리에서 바로 시작하면 그 앞은 테두리뿐이다.
            same = (k, ci) == (f['k'], f['ci'])
            if not same and bot - top < MIN_CONT:
                pass
            elif box[3] - box[1] > 20:
                parts.append(im.crop(box))
            if not nxt or (k, ci) == (nxt['k'], nxt['ci']):
                break
            ci += 1
            if ci > 1:
                ci = 0; k += 1
                if k >= len(pages):
                    break
            if (k, ci) > (nxt['k'], nxt['ci']):
                break
        # 세로로 이어 붙인다
        parts = [p for p in parts if p.height > 10]
        if not parts:
            continue
        W = max(p.width for p in parts)
        H = sum(p.height for p in parts) + 6 * (len(parts) - 1)
        out = Image.new('L', (W, H), 255)
        yy = 0
        for p in parts:
            out.paste(p, (0, yy)); yy += p.height + 6
        # 아래 빈 곳을 실제 픽셀로 잘라 낸다.
        # 뒷면이 비쳐 보이는 자국(옅은 회색)에 끌려가지 않도록 진한 것만 세고,
        # 한 줄에 몇 점 찍힌 얼룩도 글로 치지 않는다.
        aa = np.asarray(out) < 170
        rowcnt = aa.sum(axis=1)
        rr = np.flatnonzero(rowcnt >= max(4, int(W * 0.004)))
        if rr.size:
            out = out.crop((0, 0, W, min(H, rr[-1] + PAD)))
        fn = '%03d_%02d.png' % (0, f['no'])
        out.convert('P', palette=Image.ADAPTIVE, colors=16).save(
            os.path.join(work, 'img', fn), optimize=True)
        man.append(dict(exam=0, num=f['no'], img=fn, w=out.width, h=out.height))
        qs.append(dict(num=f['no'], text=''))
        print('  %2d번  %dx%d  조각 %d' % (f['no'], out.width, out.height, len(parts)))

    json.dump(dict(file=os.path.basename(src), exams=[dict(
        name=name, year='', round='', subject='', grade='', questions=qs)]),
        open(os.path.join(work, 'q.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    with open(os.path.join(work, 'manifest.jsonl'), 'w', encoding='utf-8') as fp:
        fp.write(json.dumps(man, ensure_ascii=False) + '\n')
    print('\n%s — 문항 %d개' % (name, len(man)))


if __name__ == '__main__':
    main()
