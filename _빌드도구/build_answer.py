# -*- coding: utf-8 -*-
"""해설·정답 PDF에서 객관식 정답을 뽑아 data/ans.js 를 만든다.

- 해설지 첫머리의 '빠른 정답' 표를 찾는다.  1③2⑤3①4②5⑤ 처럼 붙어서 나온다.
- 1번부터 시작하는 덩어리는 공통(또는 단일 과목), 23번부터 시작하는 덩어리는 선택과목.
- 단답형은 특수 글꼴이라 거의 안 뽑히므로 넣지 않는다.
"""
import sys, os, re, json, glob, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pypdfium2 as pdfium
import layout
import anstable

HAND = {}
HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
DB = os.path.abspath(os.path.join(APP, '..', '데이터베이스', '해설파일(정리 전)'))

CIRC = '①②③④⑤'
RUN = re.compile(r'(?:\d{1,2}[①②③④⑤]){2,}')
ONE = re.compile(r'(\d{1,2})([①②③④⑤])')
SUBJ = re.compile(r'\[\s*(확률과\s*통계|미적분|기하)\s*\]')


def page_lines(pg):
    ch, W, H = layout.get_chars(pg)
    out = []
    for l in layout.make_lines(ch):
        y = min(c[2] for c in l)
        s = ''.join(x[0] for x in sorted(l, key=lambda c: c[1]))
        out.append((y, s))
    return out


def read_answers(path):
    """→ [ (과목표시 or None, {번호: 답}) ] 페이지 순서대로"""
    d = pdfium.PdfDocument(path)
    blocks = []
    try:
        for pi in range(len(d)):
            pg = d[pi]
            try:
                lines = page_lines(pg)
            finally:
                pg.close()
            found = {}
            label = None
            for y, s in lines:
                m = SUBJ.search(s)
                if m and label is None:
                    label = m.group(1).replace(' ', '')
                for r in RUN.finditer(s):
                    for a, b in ONE.findall(r.group()):
                        n = int(a)
                        if 1 <= n <= 30:
                            found.setdefault(n, CIRC.index(b) + 1)
            # 표의 마지막 객관식 한 칸은 단답형 줄에 붙어 있어 위에서 놓친다.
            # «다음 번호 + 동그라미»로 줄 맨 앞에 있을 때만 조심스레 더한다.
            if found:
                for _ in range(3):
                    nxt = max(found) + 1
                    got = None
                    for y, s in lines:
                        m = re.match(r'\s*(\d{1,2})([①②③④⑤])', s)
                        if m and int(m.group(1)) == nxt:
                            got = CIRC.index(m.group(2)) + 1
                            break
                    if got is None:
                        break
                    found[nxt] = got
            if found:
                blocks.append((label, found))
    finally:
        d.close()
    return blocks


def merged_blocks(path):
    """두 가지 방법으로 읽어 합친다.

    · 객관식 : 예전 방식(«1③2⑤…» 글자 이어 읽기) — 오래 검증된 것을 그대로 쓴다
    · 단답형 : 칸 자리로 읽는 방식 — 다만 그 표의 객관식을 «하나도 틀리지 않고
               거의 다» 읽어 냈을 때만 믿는다. 조금이라도 어긋나면 통째로 버린다.
    """
    old = read_answers(path)
    try:
        new = anstable.read_file(path, pdfium)
    except Exception:
        new = []
    if not old:
        return new

    used = set()
    out = []
    for label, og in old:
        st = min(og)
        pick = None
        for i, (nl, ng) in enumerate(new):
            if i in used or min(ng) != st:
                continue
            pick = i; break
        merged = dict(og)
        if pick is not None:
            used.add(pick)
            ng = new[pick][1]
            shared = [k for k in ng if k in og]
            agree = all(og[k] == ng[k] for k in shared)
            enough = len(shared) >= len(og) * 0.9
            if agree and enough:
                for k, v in ng.items():
                    merged.setdefault(k, v)
        out.append((label, merged))
    # 예전 방식이 아예 못 본 덩어리(선택과목 등)는 새 방식 것을 그대로
    for i, (nl, ng) in enumerate(new):
        if i not in used and len(ng) >= 5:
            out.append((nl, ng))
    return out


def split_blocks(found, g):
    """한 쪽에 공통(1~)과 선택(23~)이 같이 있을 수 있어 나눈다.
    고1·고2는 선택과목이 없으므로 1~30을 통째로 둔다."""
    if g in ('고1', '고2'):
        return [('공통', found)]
    lo = {k: v for k, v in found.items() if k <= 22}
    hi = {k: v for k, v in found.items() if k >= 23}
    out = []
    if lo:
        out.append(('공통', lo))
    if hi:
        out.append(('선택', hi))
    return out


# ── 파일 이름 → 시험 ──────────────────────────────────────────
def parse_name(rel):
    """→ (급, 연도, 시행, 형) 또는 None"""
    folder = rel.split(os.sep)[0]
    base = os.path.basename(rel)
    if base.endswith('_전과목.pdf') or '다른본' in base:
        return None

    if folder.startswith('평가원'):
        m = re.search(r'(\d{4})학년도-(\d{1,2})월', base)
        if m:
            return ('수능·모평', m.group(1), m.group(2) + '월', None)
        m = re.search(r'(\d{4})년-(\d{1,2})월', base)
        if m:  # 2025년 9월 시행 = 2026학년도
            return ('수능·모평', str(int(m.group(1)) + 1), m.group(2) + '월', None)
        return None

    if '평가원' in base or '모의평가' in base:
        return None

    # 학년은 폴더 «전국연합_고N» 의 앞부분으로 정한다.
    # «전국연합_고2_3월(고1 범위)» 처럼 괄호 안에 다른 학년이 적혀 있어 그냥 찾으면 틀린다.
    m = re.match(r'전국연합_(고[123])', folder)
    if m:
        g = m.group(1)
    else:
        g = '고1' if '고1' in folder else ('고2' if '고2' in folder else '고3')

    m = re.match(r'(\d{2})(\d{2})([가나])?(?![0-9년])', base)   # 2103_고1_해설 꼴
    if m:
        y = 2000 + int(m.group(1))
        mo = int(m.group(2))
        hyung = {'가': '가형', '나': '나형'}.get(m.group(3))
        return (g, str(y), '%d월' % mo, hyung)

    plain = re.sub(r'고[123]', '', base)          # '고1' 같은 학년 표시를 빼고 본다
    y = re.search(r'(\d{4})년', plain)
    mo = re.search(r'(\d{1,2})월', plain)
    if y and mo:
        return (g, y.group(1), mo.group(1) + '월', None)
    return None


def load_hand():
    p = os.path.join(HERE, '정답_손입력.json')
    if not os.path.exists(p):
        return {}
    raw = json.load(open(p, encoding='utf-8'))
    return {k: v for k, v in raw.items() if not k.startswith('_')}


def main():
    global HAND
    HAND = load_hand()
    src = open(os.path.join(APP, 'data', 'index.js'), encoding='utf-8').read()
    Q = json.loads(src[src.index('{'):src.rindex('}') + 1].rstrip(';'))
    exams = Q['exams']
    qno = collections.defaultdict(set)
    for r in Q['items']:
        qno[r[0]].add(r[1])

    by_key = collections.defaultdict(list)
    for i, e in enumerate(exams):
        by_key[(e['g'], e['y'], e['r'])].append(i)

    files = sorted(glob.glob(os.path.join(DB, '*', '*.pdf'))) + \
            sorted(glob.glob(os.path.join(DB, '*', '해설', '*.pdf'))) + \
            sorted(glob.glob(os.path.join(DB, '*', '문항', '*.pdf')))
    files = [f for f in files if '_지울것' not in f and '_확인필요' not in f]

    ANS = collections.defaultdict(dict)
    report = []
    for f in files:
        rel = os.path.relpath(f, DB)
        key = parse_name(rel)
        if not key:
            report.append((rel, '시험을 못 알아봄', 0))
            continue
        g, y, r, hyung = key
        cands = by_key.get((g, y, r), [])
        if not cands:
            report.append((rel, '검색기에 그 시험이 없음 (%s %s %s)' % (g, y, r), 0))
            continue

        key2 = rel.replace(os.sep, '/')
        hv = HAND.get(key2)
        if hv and not all(k.isdigit() for k in hv):
            # 과목별로 적어 둔 경우 — 곧바로 시험에 넣는다
            ALIAS = {'공통': ('공통', ''), '확통': ('확통', '확률과 통계'),
                     '미적': ('미적', '미적분'), '기하': ('기하',)}
            put = 0
            for sub, dd in hv.items():
                for i in [j for j in cands if exams[j]['s'] in ALIAS.get(sub, ())]:
                    for n, a in dd.items():
                        if int(n) in qno[i]:
                            ANS[exams[i]['n']][int(n)] = a
                            put += 1
            report.append((rel, 'ok', put))
            continue
        if hv:
            blocks = [(None, {int(k): v for k, v in hv.items()})]
        else:
            blocks = merged_blocks(f)
        if not blocks:
            report.append((rel, '정답표를 못 찾음', 0))
            continue

        put = 0
        sel_order = ['확률과통계', '미적분', '기하']
        sel_i = 0
        for label, found in blocks:
            for kind, part in split_blocks(found, g):
                if kind == '공통':
                    want = ['공통', '', hyung] if hyung else ['공통', '']
                    idx = [i for i in cands if exams[i]['s'] in want]
                else:
                    nm = label or (sel_order[sel_i] if sel_i < len(sel_order) else None)
                    sel_i += 1
                    alias = {'확률과통계': ('확통', '확률과 통계'), '미적분': ('미적', '미적분'),
                             '기하': ('기하',)}.get(nm, ())
                    idx = [i for i in cands if exams[i]['s'] in alias]
                for i in idx:
                    for n, a in part.items():
                        if n in qno[i]:
                            ANS[exams[i]['n']][n] = a
                            put += 1
        report.append((rel, 'ok', put))

    # 엑셀에 손으로 채워 주신 것 — 자동으로 읽은 것보다 우선한다
    xp = os.path.join(HERE, '정답_엑셀입력.json')
    xn = 0
    if os.path.exists(xp):
        for n, d in json.load(open(xp, encoding='utf-8')).items():
            if n.startswith('_'):
                continue
            for q, v in d.items():
                ANS[n][int(q)] = v; xn += 1
        print('엑셀에서 채워 넣은 정답 %d개를 함께 넣었습니다.' % xn)

    out = {k: {str(n): a for n, a in sorted(v.items())} for k, v in ANS.items() if v}
    js = 'window.QANS=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
    open(os.path.join(APP, 'data', 'ans.js'), 'w', encoding='utf-8').write(js)

    good = sum(1 for _, s, n in report if s == 'ok' and n)
    print('파일 %d개 중 정답을 넣은 것 %d개' % (len(report), good))
    print('시험 %d개 / 정답 %d개 / 파일 크기 %.0fKB'
          % (len(out), sum(len(v) for v in out.values()), len(js) / 1024))
    print('\n-- 못 넣은 파일')
    for rel, s, n in report:
        if s != 'ok' or not n:
            print('   %-46s %s' % (rel[:46], s))


if __name__ == '__main__':
    main()
