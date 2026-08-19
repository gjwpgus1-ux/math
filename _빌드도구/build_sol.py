# -*- coding: utf-8 -*-
"""해설지를 문항별로 잘라 그림으로 만든다.

해설은 여러 단(段)으로 짜여 있고, 각 문항은 «12. [출제의도] …» 로 시작한다.
   ① 빈 세로 띠를 찾아 단을 나눈다
   ② 단 안에서 «번호. [출제의도]» 줄을 찾는다
   ③ 그 줄부터 다음 줄(또는 단 끝)까지를 잘라 낸다
쪽을 넘어 이어지는 문항은 조각을 세로로 이어 붙인다.
"""
import sys, os, re, json, glob, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pypdfium2 as pdfium
from PIL import Image
import layout

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
DB = os.path.abspath(os.path.join(APP, '..', '데이터베이스', '해설파일(정리 전)'))
OUT = os.path.join(APP, 'img', '해설')

ANCHOR = re.compile(r'^\s*(\d{1,2})\s*\.\s*\[\s*출제의도\s*\]')
SECT = re.compile(r'\[\s*(확률과\s*통계|미적분|기하)\s*\]')
SCALE = 2.4          # 그림 해상도
PAD = 4.0            # 잘라낼 때 둘레 여백(pt)

HOW_MANY = int(os.environ.get('SOL_N', '20'))    # 이번에 만들 회차 수 (최근 것부터)


def pick_jobs(n=None):
    """전국연합(학평) 해설 파일을 최근 회차부터 골라 온다.

    평가원(수능·모평)은 저작권이 있어 넣지 않는다.
    이미 만들어 둔 회차는 건너뛴다."""
    import build_answer as BA
    src = open(os.path.join(APP, 'data', 'index.js'), encoding='utf-8').read()
    Q = json.loads(src[src.index('{'):src.rindex('}') + 1].rstrip(';'))
    exams = Q['exams']
    qno = collections.defaultdict(set)
    for r in Q['items']:
        qno[exams[r[0]]['n']].add(r[1])
    by_key = collections.defaultdict(list)
    for e in exams:
        by_key[(e['g'], e['y'], e['r'])].append(e)

    done = set()
    sp = os.path.join(APP, 'data', 'sol.js')
    if os.path.exists(sp):
        for k in json.loads(open(sp, encoding='utf-8').read().split('=', 1)[1].rstrip(';\n')):
            done.add(k[:k.rfind('#')])

    files = sorted(glob.glob(os.path.join(DB, '전국연합*', '*.pdf'))) + \
            sorted(glob.glob(os.path.join(DB, '전국연합*', '해설', '*.pdf')))
    jobs = []
    for f in files:
        rel = os.path.relpath(f, DB)
        if '전과목' in rel or '다른본' in rel:
            continue
        key = BA.parse_name(rel)
        if not key:
            continue
        g, y, r, hyung = key
        cand = by_key.get((g, y, r), [])
        if not cand:
            continue
        base = os.path.basename(rel)
        only = None
        for k, v in (('확통', ('확통', '확률과 통계')), ('미적', ('미적', '미적분')), ('기하', ('기하',))):
            if k in base:
                only = v; break
        want = []
        for e in cand:
            s = e['s']
            if s in ('공통', '') or s == hyung:
                if hyung and s not in ('공통', '', hyung):
                    continue
                if only:            # 과목 전용 파일에는 공통이 함께 들어 있다
                    pass
                want.append((e['n'], min(qno[e['n']]), max(qno[e['n']])))
            elif s in ('확통', '확률과 통계', '미적', '미적분', '기하'):
                if only and s not in only:
                    continue
                want.append((e['n'], min(qno[e['n']]), max(qno[e['n']])))
        want = [w for w in want if w[0] not in done]
        if not want:
            continue
        mo = int(re.sub(r'\D', '', r) or 12)      # «수능» 은 12월로 본다
        jobs.append((int(y), mo, rel, want))

    # 한 회차에 파일이 여럿일 때가 있다 (묶음본·과목별본·정답만 있는 것).
    # 담긴 시험이 많은 것, 그다음 두꺼운 것을 먼저 쓰고 겹치는 시험은 뺀다.
    jobs.sort(key=lambda t: (-t[0], -t[1],
                             -len(t[3]),
                             -os.path.getsize(os.path.join(DB, t[2])),
                             t[2]))
    taken, out = set(), []
    for y, mo, rel, want in jobs:
        left = [w for w in want if w[0] not in taken]
        if not left:
            continue
        taken.update(w[0] for w in left)
        out.append({'file': rel.replace(os.sep, '/'), 'exams': left})
    return out[:n] if n else out


JOBS = None          # main() 에서 채운다


def find_cols(chars, W):
    """글자가 하나도 없는 세로 띠로 단을 나눈다 → 경계 x 목록"""
    filled = [False] * (int(W) + 2)
    for c in chars:
        a, b = int(max(0, c[1])), int(min(W, c[3]))
        for x in range(a, b + 1):
            filled[x] = True
    bands, run = [], None
    for x in range(int(W * 0.08), int(W * 0.92)):
        if not filled[x]:
            run = x if run is None else run
        else:
            if run is not None and x - run >= 8:
                bands.append((run + x) // 2)
            run = None
    # 너무 촘촘한 띠는 하나로
    out = []
    for b in bands:
        if not out or b - out[-1] > W * 0.12:
            out.append(b)
    return out


def col_of(x, cuts, W):
    i = 0
    while i < len(cuts) and x > cuts[i]:
        i += 1
    return i


def agree_cuts(pages):
    """쪽마다 찾은 단 경계 가운데 가장 자주 나온 짜임을 문서 전체에 쓴다.

    1쪽은 «빠른 정답» 표가 단을 가로질러 놓여 있어 경계를 못 찾는다.
    해설지는 어느 쪽이나 같은 단 짜임이므로 다수결이 안전하다."""
    cnt = collections.Counter(len(c) for c in pages if c)
    if not cnt:
        return []
    n = cnt.most_common(1)[0][0]
    same = [c for c in pages if len(c) == n]
    return [int(sorted(c[i] for c in same)[len(same) // 2]) for i in range(n)]


def page_pieces(pg, cuts=None):
    """이 쪽에서 (문항번호, x0, y0, x1, y1) 조각들을 뽑는다. y는 위 기준."""
    ch, W, H = layout.get_chars(pg)
    if not ch:
        return [], W, H
    if cuts is None:
        cuts = find_cols(ch, W)
    ch = [c for c in ch if c[2] < H * 0.90]      # 맨 아래 쪽번호는 뺀다
    if not ch:
        return [], W, H
    bycol = collections.defaultdict(list)
    for c in ch:
        bycol[col_of(c[1], cuts, W)].append(c)

    edges = [0] + cuts + [int(W)]
    pieces = []
    for ci, cc in sorted(bycol.items()):
        lines = layout.make_lines(cc)
        rows = []
        for l in lines:
            top = min(c[2] for c in l)
            bot = max(c[4] for c in l)
            s = ''.join(x[0] for x in sorted(l, key=lambda c: c[1]))
            rows.append((top, bot, s))
        rows.sort(key=lambda t: t[0])
        x0 = edges[ci] if ci < len(edges) else 0
        x1 = edges[ci + 1] if ci + 1 < len(edges) else W

        # 이 단에 [확률과 통계]·[미적분]·[기하] 표시가 있으면 자리와 함께 적어 둔다
        for top, bot, s in rows:
            m = SECT.search(s)
            if m:
                pieces.append(('과목', m.group(1).replace(' ', ''), top, ci))

        anchors = [(i, ANCHOR.match(r[2])) for i, r in enumerate(rows)]
        anchors = [(i, int(m.group(1))) for i, m in anchors if m]
        coltop = min(r[0] for r in rows)
        colbot = max(r[1] for r in rows)

        # 단 첫머리에 «번호. [출제의도]» 가 없으면 앞 문항이 넘어온 부분이다
        head_to = rows[anchors[0][0]][0] - 6 if anchors else colbot
        if head_to - coltop > 14:
            pieces.append(('이음', None, coltop, ci, x0, x1, head_to, not anchors))
        if not anchors:
            continue
        for k, (ri, no) in enumerate(anchors):
            top = rows[ri][0]
            tail = k + 1 >= len(anchors)          # 이 단의 마지막 문항인가
            # 다음 문항 제목이 딸려 오지 않도록 조금 위에서 끊는다
            bot = colbot if tail else rows[anchors[k + 1][0]][0] - 6
            pieces.append(('문항', no, top, ci, x0, x1, bot, tail))
    return pieces, W, H


def crop(pg, box, W, H, tail=True):
    x0, y0, x1, y1 = box
    x0 = max(0, x0 - PAD); y0 = max(0, y0 - PAD)
    x1 = min(W, x1 + PAD); y1 = min(H, y1 + (PAD if tail else 0))
    if x1 - x0 < 20 or y1 - y0 < 12:
        return None
    im = pg.render(scale=SCALE).to_pil()
    return im.crop((int(x0 * SCALE), int(y0 * SCALE), int(x1 * SCALE), int(y1 * SCALE)))


def stack(imgs):
    """세로로 이어 붙이기 (쪽·단을 넘어 이어지는 문항)"""
    imgs = [i for i in imgs if i]
    if not imgs:
        return None
    if len(imgs) == 1:
        return imgs[0]
    w = max(i.width for i in imgs)
    h = sum(i.height for i in imgs) + 6 * (len(imgs) - 1)
    out = Image.new('RGB', (w, h), 'white')
    y = 0
    for i in imgs:
        out.paste(i, (0, y)); y += i.height + 6
    return out


def run_job(job, sol):
    path = os.path.join(DB, job['file'].replace('/', os.sep))
    exams = job['exams']
    common = next((e[0] for e in exams if e[1] == 1), None)
    sel_names = [e[0] for e in exams if e[1] > 1]
    sel_from = min([e[1] for e in exams if e[1] > 1], default=99)
    ALIAS = {'확률과통계': 0, '미적분': 1, '기하': 2}

    d = pdfium.PdfDocument(path)
    # ① 먼저 쪽마다 단 경계를 재어 다수결로 정한다
    percuts = []
    for pi in range(len(d)):
        pg = d[pi]
        try:
            ch, W, H = layout.get_chars(pg)
            percuts.append(find_cols(ch, W) if ch else [])
        finally:
            pg.close()
    CUTS = agree_cuts(percuts)

    cur = None            # 지금 읽고 있는 선택과목
    prev = None           # 바로 앞 문항 (단·쪽을 넘어 이어질 때 쓴다)
    seen = 0              # 표시가 없을 때를 대비한 차례
    bag = collections.defaultdict(list)
    try:
        for pi in range(len(d)):
            pg = d[pi]
            try:
                pieces, W, H = page_pieces(pg, CUTS or None)
                # 읽는 차례: 단 → 위에서 아래로
                pieces.sort(key=lambda p: (p[3] if p[0] == '문항' else p[3],
                                           p[2]))
                for p in pieces:
                    if p[0] == '과목':
                        i = ALIAS.get(p[1])
                        if i is not None and i < len(sel_names):
                            cur = sel_names[i]
                            seen = i + 1
                        continue
                    if p[0] == '이음':
                        if prev is None:
                            continue
                        _, _, top, ci, x0, x1, bot, tail = p
                        im = crop(pg, (x0, top, x1, bot), W, H, tail)
                        if im:
                            bag[prev].append(im)
                        continue
                    _, no, top, ci, x0, x1, bot, tail = p
                    if no >= sel_from and sel_names:
                        if cur is None:
                            cur = sel_names[0]; seen = 1
                        name = cur
                    else:
                        name = common
                    if not name:
                        continue
                    im = crop(pg, (x0, top, x1, bot), W, H, tail)
                    if im:
                        bag[(name, no)].append(im)
                    prev = (name, no)
            finally:
                pg.close()
    finally:
        d.close()

    made = collections.Counter()
    for (name, no), ims in sorted(bag.items()):
        im = stack(ims)
        rel = '%s_%02d.png' % (re.sub(r'[^0-9A-Za-z가-힣]', '', name), no)
        # 해설은 흰 바탕에 검은 글씨라 회색 16색이면 눈에 똑같고 용량은 4분의 1
        im = im.convert('L').convert('P', palette=Image.ADAPTIVE, colors=16)
        im.save(os.path.join(OUT, rel), optimize=True)
        sol[name + '#' + str(no)] = [rel, im.width, im.height]
        made[name] += 1
    return made


def main():
    os.makedirs(OUT, exist_ok=True)
    # 이미 만들어 둔 것은 그대로 두고 새로 만든 것만 더한다
    sol = {}
    sp = os.path.join(APP, 'data', 'sol.js')
    if os.path.exists(sp):
        sol = json.loads(open(sp, encoding='utf-8').read().split('=', 1)[1].rstrip(';\n'))
    before = len(sol)

    jobs = pick_jobs(HOW_MANY)
    print('이번에 만들 회차 %d개 (아직 남은 것 %d개)\n' % (len(jobs), len(pick_jobs())))
    for i, job in enumerate(jobs, 1):
        made = run_job(job, sol)
        print('%2d. %-34s %s' % (i, job['file'].split('/')[-1][:34],
                                 ' · '.join('%s %d문항' % (k, v) for k, v in sorted(made.items()))))
    js = 'window.QSOL=' + json.dumps(sol, ensure_ascii=False, separators=(',', ':')) + ';\n'
    open(os.path.join(APP, 'data', 'sol.js'), 'w', encoding='utf-8').write(js)
    tot = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print('\n이번에 더한 해설 %d개 → 모두 %d개 · 그림 %.1fMB · data/sol.js %.0fKB'
          % (len(sol) - before, len(sol), tot / 1e6, len(js) / 1024))


if __name__ == '__main__':
    main()
