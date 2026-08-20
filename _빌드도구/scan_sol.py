# -*- coding: utf-8 -*-
"""글자 층이 없는(스캔) 해설지를 문항별로 잘라 그림으로 만든다.

build_sol.py 는 PDF 속 글자를 읽어 «12. [출제의도] …» 를 찾지만,
2018~2019년 해설 몇 개는 글자 층이 없는 그림뿐이라 아무것도 못 읽는다.
이 도구는 같은 일을 픽셀만 보고 한다.

   ① 단 사이 세로 괘선을 찾아 단을 나눈다 (괘선 길이가 곧 본문 위·아래 끝)
   ② 단마다 글자를 읽어(tesseract) «번호. [» 로 시작하는 줄을 찾는다
   ③ 그 줄부터 다음 줄(또는 단 끝)까지를 잘라 낸다

안전장치: 읽어 낸 번호가 1..N 로 딱 떨어지지 않으면 그 회차는 통째로 건너뛴다.
잘못 짝지어진 해설을 보여 주느니 없는 편이 낫기 때문이다.

사용: python3 scan_sol.py            (남은 스캔본 전부)
      SCAN_N=3 python3 scan_sol.py   (3개만)
"""
import sys, os, re, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import pypdfium2 as pdfium
from PIL import Image
import pytesseract
import build_sol as BS

DPI = 200
SC = DPI / 72.0
DARK = 200                 # 이보다 어두우면 잉크
HOW_MANY = int(os.environ.get('SCAN_N', '0'))     # 0 이면 전부

# «19. [출제의도]» — 한글은 못 읽어도 앞의 «번호. [» 는 또렷하게 남는다.
# 다만 숫자 1 은 l·L·I·| 로 잘못 읽히는 일이 잦아 함께 받아 준다.
ANCHOR = re.compile(r'^\s*([0-9lLI|]{1,2})\s*[.,·]?\s*[\[({|]')
ONE = str.maketrans('lLI|', '1111')


def anchor_no(s):
    """줄 첫머리가 «번호. [» 꼴이면 그 번호를, 아니면 None 을 돌려준다."""
    m = ANCHOR.match(s)
    if not m:
        return None
    t = m.group(1).translate(ONE)
    return int(t) if t.isdigit() and 1 <= int(t) <= 30 else None


def rules(ink):
    """단을 가르는 세로 괘선의 x 자리와, 괘선이 뻗은 위·아래 끝(픽셀)."""
    ph, pw = ink.shape
    cs = ink.sum(axis=0)
    xs = np.flatnonzero(cs > ph * 0.40)
    if xs.size == 0:
        return [], 0, ph
    # 붙어 있는 x 는 한 줄로 묶는다 (괘선이 2픽셀 굵기로 잡히는 일이 흔하다)
    grp, cur = [], [int(xs[0])]
    for x in xs[1:]:
        x = int(x)
        if x - cur[-1] <= 3:
            cur.append(x)
        else:
            grp.append(cur); cur = [x]
    grp.append(cur)
    cuts = [int(np.mean(g)) for g in grp if g]

    # 괘선이 이어진 가장 긴 구간 = 본문 위·아래 끝
    top, bot = 0, ph
    best = 0
    for x in cuts:
        col = ink[:, x]
        i = 0
        while i < ph:
            if not col[i]:
                i += 1; continue
            j = i
            while j < ph and col[j]:
                j += 1
            if j - i > best:
                best, top, bot = j - i, i, j
            i = j
    return cuts, top, bot


def ocr_anchors(im, y0, y1):
    """한 단 그림에서 «번호. [» 로 시작하는 줄을 찾아 [(번호, 윗변 픽셀)] 로 돌려준다."""
    df = pytesseract.image_to_data(im, lang='eng', config='--psm 6',
                                   output_type=pytesseract.Output.DICT)
    lines = {}
    for i, t in enumerate(df['text']):
        if not t.strip():
            continue
        k = (df['block_num'][i], df['par_num'][i], df['line_num'][i])
        if k not in lines:
            lines[k] = [df['top'][i], df['left'][i], []]
        lines[k][0] = min(lines[k][0], df['top'][i])
        lines[k][1] = min(lines[k][1], df['left'][i])
        lines[k][2].append(t)
    out = []
    for top, left, ws in lines.values():
        no = anchor_no(' '.join(ws))
        if no is not None:
            out.append((no, y0 + top))
    out.sort(key=lambda t: t[1])
    return out


def scan_page(pg):
    """한 쪽을 훑어 단마다 «자리 + 찾은 번호» 를 적어 둔다 (좌표는 pt)."""
    W, H = pg.get_size()
    im = pg.render(scale=SC).to_pil().convert('L')
    a = np.asarray(im)
    ink = a < DARK
    ph, pw = ink.shape

    cuts, ctop, cbot = rules(ink)
    if not cuts:
        return dict(w=W, h=H, cols=[])
    edges = [0] + cuts + [pw]
    cols = []
    for ci in range(len(edges) - 1):
        x0p, x1p = edges[ci] + 4, edges[ci + 1] - 4
        sub = ink[ctop:cbot, x0p:x1p]
        if sub.size == 0 or not sub.any():
            continue
        rows = np.flatnonzero(sub.any(axis=1))
        colsx = np.flatnonzero(sub.any(axis=0))
        coltop = ctop + int(rows[0])
        colbot = ctop + int(rows[-1])
        lx = x0p + int(colsx[0]) - 6
        rx = x0p + int(colsx[-1]) + 6

        # 단 맨 윗줄이 괘선 끝에 바짝 붙어 있으면 글자 윗부분이 잘려 안 읽힌다.
        # 위아래로 조금 넉넉히 떼어 읽는다.
        pad = int(0.09 * DPI)
        oy = max(0, ctop - pad)
        anchors = ocr_anchors(im.crop((x0p, oy, x1p, min(ph, cbot + pad))), oy, cbot)
        anchors = [(n, y) for n, y in anchors if oy <= y <= colbot]
        cols.append(dict(ci=ci, x0=lx / SC, x1=rx / SC,
                         top=coltop / SC, bot=colbot / SC,
                         anchors=[(n, y / SC) for n, y in anchors]))
    return dict(w=W, h=H, cols=cols)


def longest_rising(nums):
    """차례대로 커지는 가장 긴 묶음의 자리 번호를 돌려준다.

    OCR 이 본문 한 줄을 «24. [» 처럼 잘못 읽어 끼어드는 일이 있다.
    해설의 번호는 읽는 차례대로 반드시 커지므로, 가장 길게 커지는 줄기만
    남기면 끼어든 가짜가 걸러진다."""
    n = len(nums)
    if n == 0:
        return []
    best = [1] * n
    prev = [-1] * n
    for i in range(n):
        for j in range(i):
            if nums[j] < nums[i] and best[j] + 1 > best[i]:
                best[i] = best[j] + 1
                prev[i] = j
    i = max(range(n), key=lambda k: best[k])
    out = []
    while i >= 0:
        out.append(i)
        i = prev[i]
    return out[::-1]


def make_pieces(rec, keep):
    """훑어 둔 쪽에서 잘라 낼 조각을 만든다. keep 은 살릴 (단, 차례) 짝의 모음."""
    pieces = []
    for c in rec['cols']:
        ci = c['ci']
        anchors = [a for k, a in enumerate(c['anchors']) if (ci, k) in keep]
        top = min(c['top'], anchors[0][1]) if anchors else c['top']
        head_to = anchors[0][1] - 3 if anchors else c['bot']
        if head_to - top > 14:
            pieces.append(('이음', None, top, ci, c['x0'], c['x1'],
                           head_to, not anchors))
        for k, (no, y) in enumerate(anchors):
            tail = k + 1 >= len(anchors)
            bot = c['bot'] if tail else anchors[k + 1][1] - 3
            pieces.append(('문항', no, y, ci, c['x0'], c['x1'], bot, tail))
    return pieces


def run_job(job, sol):
    path = os.path.join(BS.DB, job['file'].replace('/', os.sep))
    exams = job['exams']
    name = exams[0][0]
    lo, hi = exams[0][1], exams[0][2]
    if len(exams) != 1:
        return None, '한 파일에 시험이 여럿이라 건너뜀'

    d = pdfium.PdfDocument(path)
    try:
        # ① 먼저 전체를 훑어 번호를 모은다
        recs = []
        for pi in range(len(d)):
            pg = d[pi]
            try:
                recs.append(scan_page(pg))
            finally:
                pg.close()

        # ② 읽는 차례(쪽 → 단 → 위에서 아래)대로 늘어놓고,
        #    차례대로 커지는 가장 긴 줄기만 남긴다
        flat = []
        for pi, rec in enumerate(recs):
            for c in sorted(rec['cols'], key=lambda c: c['ci']):
                for k, (n, y) in enumerate(c['anchors']):
                    flat.append((n, pi, c['ci'], k))
        good = {(pi, ci, k) for n, pi, ci, k in
                (flat[i] for i in longest_rising([f[0] for f in flat]))
                if lo <= n <= hi}

        nums = sorted(n for n, pi, ci, k in flat if (pi, ci, k) in good)
        miss = [n for n in range(lo, hi + 1) if n not in nums]
        if len(nums) != len(set(nums)):
            return None, '같은 번호가 두 번 나옴'
        if len(miss) > max(2, (hi - lo + 1) * 0.15):
            return None, '못 찾은 문항이 많음 %d개 %s' % (len(miss), miss[:8])

        # ③ 살아남은 번호로 조각을 만들어 잘라 낸다
        prev, bag = None, collections.defaultdict(list)
        for pi, rec in enumerate(recs):
            W, H = rec['w'], rec['h']
            pieces = make_pieces(rec, {(ci, k) for p, ci, k in good if p == pi})
            pieces.sort(key=lambda p: (p[3], p[2]))
            pg = d[pi]
            try:
                for p in pieces:
                    if p[0] == '이음':
                        if prev is None:
                            continue
                        _, _, top, ci, x0, x1, bot, tail = p
                        im = BS.crop(pg, (x0, top, x1, bot), W, H, tail)
                        if im:
                            bag[prev].append(im)
                        continue
                    _, no, top, ci, x0, x1, bot, tail = p
                    im = BS.crop(pg, (x0, top, x1, bot), W, H, tail)
                    if im:
                        bag[(name, no)].append(im)
                    prev = (name, no)
            finally:
                pg.close()
    finally:
        d.close()

    made = 0
    for (nm, no), ims in sorted(bag.items()):
        im = BS.stack(ims)
        rel = '%s_%02d.png' % (re.sub(r'[^0-9A-Za-z가-힣]', '', nm), no)
        im = im.convert('L').convert('P', palette=Image.ADAPTIVE, colors=16)
        im.save(os.path.join(BS.OUT, rel), optimize=True)
        sol[nm + '#' + str(no)] = [rel, im.width, im.height]
        made += 1
    return made, ('못 찾은 문항 %s' % miss if miss else '')


def main():
    os.makedirs(BS.OUT, exist_ok=True)
    sp = os.path.join(BS.APP, 'data', 'sol.js')
    sol = json.loads(open(sp, encoding='utf-8').read().split('=', 1)[1].rstrip(';\n')) \
        if os.path.exists(sp) else {}
    before = len(sol)

    def save():
        js = 'window.QSOL=' + json.dumps(sol, ensure_ascii=False, separators=(',', ':')) + ';\n'
        open(sp, 'w', encoding='utf-8').write(js)
        return js

    jobs = BS.pick_jobs()
    if HOW_MANY:
        jobs = jobs[:HOW_MANY]
    print('남은 회차 %d개\n' % len(jobs))
    for i, job in enumerate(jobs, 1):
        try:
            made, note = run_job(job, sol)
        except Exception as e:
            made, note = None, '오류: %s' % e
        if made:
            save()
        print('%2d. %-24s %-26s %s' % (i, job['file'].split('/')[-1][:24],
                                       job['exams'][0][0] if len(job['exams']) == 1 else '(여럿)',
                                       ('%d문항 %s' % (made, note)) if made else '건너뜀 — ' + note),
              flush=True)
    js = save()
    tot = sum(os.path.getsize(os.path.join(BS.OUT, f)) for f in os.listdir(BS.OUT))
    print('\n이번에 더한 해설 %d개 → 모두 %d개 · 그림 %.1fMB · data/sol.js %.0fKB'
          % (len(sol) - before, len(sol), tot / 1e6, len(js) / 1024))


if __name__ == '__main__':
    main()
