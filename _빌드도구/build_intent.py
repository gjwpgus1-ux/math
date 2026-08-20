# -*- coding: utf-8 -*-
"""해설지에 적힌 «[출제의도] …» 를 문항별로 뽑아 _빌드도구/출제의도.json 으로 저장한다.

해설의 각 문항은 «12. [출제의도] 등비수열의 극한 이해하기» 로 시작한다.
이 한 마디는 그 문항이 무엇을 묻는지 요약한 것이라, 문장 표현이 달라도
같은 것을 묻는 문항끼리 묶는 데 쓸 수 있다.

  · 제목이 두 줄로 넘어가면 «…하기 / …한다» 로 끝날 때까지 이어 붙인다
  · 평가원(수능·모평) 은 해설 본문을 손대지 않고 «출제의도» 한 줄만 읽는다
  · 글자 층이 없는 스캔본은 읽을 수 없어 건너뛴다

사용: python3 build_intent.py          (전부)
      INT_N=5 python3 build_intent.py  (앞의 5회차만 — 확인용)
      INT_DRY=1 python3 build_intent.py (저장하지 않고 세어만 봄)
"""
import sys, os, re, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pypdfium2 as pdfium
import layout
import build_sol as BS

HOW_MANY = int(os.environ.get('INT_N', '0'))
DRY = os.environ.get('INT_DRY') == '1'

# 학평은 «12. [출제의도] …», 평가원은 «12. 출제의도 : …» 꼴이다.
# 평가원 해설은 짜임이 복잡해 단 나누기가 어긋나므로 첫 줄만 쓴다(BRACKET 로 가른다).
ANCHOR = re.compile(r'^\s*(\d{1,2})\s*\.\s*'
                    r'(?:(\[)\s*출제\s*의도\s*\]|출제\s*의도\s*[:：]?)\s*(.*)$')
# 수식 조각이 딸려 온 것 («limlim», «C×××») — 평가원 쪽에서만 걷어낸다
JUNK = re.compile(r'[A-Za-z×÷±∑∫√≤≥≠→←↔∼~^_·\'"`]{2,}')
# «…하기», «…한다», «…있는가?» 로 끝나면 제목이 다 나온 것이다
ENDED = re.compile(r'(기|다|다\s*\.|\?)\s*$')
MAX_CONT = 3            # 제목이 넘어가 봐야 서너 줄
SAME_X = 30             # 이어지는 줄은 첫 줄과 왼쪽 끝이 거의 같아야 한다 (pt)
# 뒤에 딸려 온 «정답 ②», «정답풀이 :», 다음 문항 번호 따위는 잘라 낸다
TAIL = re.compile(r'\s*(정답\s*풀이|정답\s*[①-⑤]|\d{1,2}\s*\.\s*출제|■|\[공통).*$')
# 고3 해설의 선택과목 갈림 표시
SECT = re.compile(r'\[\s*(확률과\s*통계|미적분|기하)\s*\]')
ALIAS = {'확률과통계': 0, '미적분': 1, '기하': 2}


def clean(s, junk=False):
    s = TAIL.sub('', s)
    if junk:
        s = JUNK.sub(' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    s = re.sub(r'^[\.\]\)\s]+', '', s)
    if '?' in s:                      # «…있는가?» 뒤는 이미 본문이다
        s = s[:s.index('?') + 1]
    if junk:                          # 끝에 남은 수식 부스러기를 떨어낸다
        s = re.sub(r'[^가-힣?]+$', '', s)
    return s.strip(' .')


def read_intents(path):
    """읽는 차례대로 (‹과목›, 이름) 또는 (‹문항›, 번호, 출제의도).

    고3 해설 한 파일에는 공통(1~22)과 확통·미적·기하(각 23~30)가 함께 들어 있어
    번호만으로는 어느 과목인지 알 수 없다. 그래서 [확률과 통계]·[미적분]·[기하]
    표시가 나오는 자리를 함께 적어 둔다."""
    d = pdfium.PdfDocument(path)
    out = []
    try:
        for pi in range(len(d)):
            pg = d[pi]
            try:
                ch, W, H = layout.get_chars(pg)
                if not ch:
                    continue
                cuts = BS.find_cols(ch, W)
                ch = [c for c in ch if c[2] < H * 0.90]
                by = collections.defaultdict(list)
                for c in ch:
                    by[BS.col_of(c[1], cuts, W)].append(c)
                for ci, cc in sorted(by.items()):
                    rows = []
                    for l in layout.make_lines(cc):
                        rows.append((min(x[2] for x in l), min(x[1] for x in l),
                                     ''.join(x[0] for x in sorted(l, key=lambda c: c[1])).strip()))
                    rows.sort()
                    for k, (top, x0, s) in enumerate(rows):
                        ms = SECT.search(s)
                        if ms:
                            out.append(('과목', ms.group(1).replace(' ', '')))
                        m = ANCHOR.match(s)
                        if not m:
                            continue
                        pyung = not m.group(2)          # 괄호가 없으면 평가원 꼴
                        txt = clean(m.group(3), pyung)
                        j = k + 1
                        # 평가원 해설은 단이 뒤섞여 이어 붙이면 오히려 더러워진다
                        while (not pyung and txt and not ENDED.search(txt)
                               and j < len(rows) and j - k <= MAX_CONT):
                            ny, nx, nxt = rows[j]
                            # 제목이 넘어간 줄은 첫 줄과 왼쪽 끝이 거의 같다.
                            # 옆 단이나 수식 조각이 끼어드는 것을 이걸로 막는다.
                            if ANCHOR.match(nxt) or not nxt or abs(nx - x0) > SAME_X:
                                break
                            txt = clean(txt + ' ' + nxt)
                            j += 1
                        if txt and len(txt) >= 4:
                            out.append(('문항', int(m.group(1)), txt))
            finally:
                pg.close()
    finally:
        d.close()
    return out


def main():
    sp = os.path.join(os.path.dirname(os.path.abspath(__file__)), '출제의도.json')
    INT = {}
    if os.path.exists(sp) and not DRY:
        INT = json.loads(open(sp, encoding='utf-8').read().split('=', 1)[1].rstrip(';\n'))
    done = {k[:k.rfind('#')] for k in INT}

    jobs = all_jobs()
    if not DRY:          # 이미 읽어 둔 회차는 건너뛴다 (나눠서 돌릴 수 있게)
        jobs = [j for j in jobs if any(e[0] not in done for e in j['exams'])]
    if HOW_MANY:
        jobs = jobs[:HOW_MANY]
    stat = collections.Counter()
    for i, job in enumerate(jobs, 1):
        path = os.path.join(BS.DB, job['file'].replace('/', os.sep))
        try:
            evs = read_intents(path)
        except Exception as e:
            evs = []
            print('%2d. %-30s 오류 %s' % (i, job['file'].split('/')[-1][:30], e))

        # 공통(1번부터)과 선택과목(23번부터)을 갈라 붙인다 — build_sol 과 같은 방식
        exs = job['exams']
        common = next((e[0] for e in exs if e[1] == 1), None)
        sel_names = [e[0] for e in exs if e[1] > 1]
        sel_from = min([e[1] for e in exs if e[1] > 1], default=99)
        rng = {e[0]: (e[1], e[2]) for e in exs}
        cur, n = None, 0
        for ev in evs:
            if ev[0] == '과목':
                k = ALIAS.get(ev[1])
                if k is not None and k < len(sel_names):
                    cur = sel_names[k]
                continue
            q, txt = ev[1], ev[2]
            if q >= sel_from and sel_names:
                if cur is None:
                    cur = sel_names[0]
                name = cur
            else:
                name = common
            if not name:
                continue
            lo, hi = rng[name]
            if lo <= q <= hi:
                INT[name + '#' + str(q)] = txt
                n += 1
        stat['문항'] += n
        stat['회차'] += 1
        if not n:
            stat['빈 파일'] += 1
        if not DRY:      # 한 파일 끝날 때마다 적어 둔다 (중간에 끊겨도 남는다)
            open(sp, 'w', encoding='utf-8').write(
                'window.QINT=' + json.dumps(INT, ensure_ascii=False, separators=(',', ':')) + ';\n')
        print('%3d. %-30s %3d개' % (i, job['file'].split('/')[-1][:30], n), flush=True)

    uniq = collections.Counter(INT.values())
    print('\n출제의도 %d문항 · 서로 다른 문구 %d개 · 파일 %d개(그중 못 읽은 것 %d개)'
          % (len(INT), len(uniq), stat['회차'], stat['빈 파일']))
    print('가장 흔한 것:', ', '.join('%s(%d)' % (k, c) for k, c in uniq.most_common(6)))
    if DRY:
        return
    print('_빌드도구/출제의도.json %.0fKB' % (os.path.getsize(sp) / 1024))


def all_jobs():
    """build_sol.pick_jobs 는 «이미 만든 것»을 빼므로, 여기서는 전부 모은다."""
    import glob, re as _re
    import build_answer as BA
    src = open(os.path.join(BS.APP, 'data', 'index.js'), encoding='utf-8').read()
    Q = json.loads(src[src.index('{'):src.rindex('}') + 1].rstrip(';'))
    exams = Q['exams']
    qno = collections.defaultdict(set)
    for r in Q['items']:
        qno[exams[r[0]]['n']].add(r[1])
    by_key = collections.defaultdict(list)
    for e in exams:
        by_key[(e['g'], e['y'], e['r'])].append(e)

    # 평가원(수능·모평) 해설은 저작권 때문에 본문을 손대지 않지만,
    # «[출제의도] … 이해하기» 한 줄 말마디는 문항을 묶는 이름표로만 쓴다.
    files = sorted(glob.glob(os.path.join(BS.DB, '전국연합*', '*.pdf'))) + \
            sorted(glob.glob(os.path.join(BS.DB, '전국연합*', '해설', '*.pdf'))) + \
            sorted(glob.glob(os.path.join(BS.DB, '평가원*', '*.pdf'))) + \
            sorted(glob.glob(os.path.join(BS.DB, '평가원*', '해설', '*.pdf')))
    jobs = []
    for f in files:
        rel = os.path.relpath(f, BS.DB)
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
                only = v
                break
        want = []
        for e in cand:
            s = e['s']
            if s in ('공통', '') or s == hyung:
                if hyung and s not in ('공통', '', hyung):
                    continue
                want.append((e['n'], min(qno[e['n']]), max(qno[e['n']])))
            elif s in ('확통', '확률과 통계', '미적', '미적분', '기하'):
                if only and s not in only:
                    continue
                want.append((e['n'], min(qno[e['n']]), max(qno[e['n']])))
        if not want:
            continue
        mo = int(_re.sub(r'\D', '', r) or 12)
        jobs.append((int(y), mo, rel, want))

    jobs.sort(key=lambda t: (-t[0], -t[1], -len(t[3]),
                             -os.path.getsize(os.path.join(BS.DB, t[2])), t[2]))
    taken, out = set(), []
    for y, mo, rel, want in jobs:
        left = [w for w in want if w[0] not in taken]
        if not left:
            continue
        taken.update(w[0] for w in left)
        out.append({'file': rel.replace(os.sep, '/'), 'exams': left})
    return out


if __name__ == '__main__':
    main()
