# -*- coding: utf-8 -*-
"""2단계: 페이지 줄 정보를 모아 시험 구간별로 문항을 확정한다.

- 같은 배너(시험명)가 이어지는 페이지 묶음 = 하나의 시험
- 문항번호 왼쪽 여백은 시험 전체의 최빈값으로 보정 (표지 페이지에 흔들리지 않게)
- 번호가 1씩 증가하는 것만 인정 → 본문 속 '12.' 같은 오검출 제거
- 한 문항이 단·페이지를 넘어가면 조각(rect) 여러 개로 이어붙인다

사용: python3 assemble.py <in.jsonl> <out.json> <파일표시이름>
"""
import sys, json, re, collections

LABELS = ('5지선다형', '단답형', '주관식', '5지 선다형', '단 답 형', '선다형')


def mode_x(xs, binw=2.5):
    bins = {}
    for x in xs:
        bins.setdefault(round(x / binw), []).append(x)
    return min(max(bins.values(), key=lambda v: (len(v), -min(v))))


SUNEUNG_PAT = re.compile(r'^(\d{2})학년도\s*(수능|\d{1,2}월)\s*(.*)$')
SUBJ_RULES = [('확률과통계', '확통'), ('확률과 통계', '확통'), ('확통', '확통'),
              ('미적분', '미적'), ('미적', '미적'), ('기하', '기하'), ('공통', '공통')]


def norm_subject(s):
    t = s.replace(' ', '')
    if '가형' in t:
        return '가형'
    if '나형' in t:
        return '나형'
    for pat, out in SUBJ_RULES:
        if pat.replace(' ', '') in t:
            return out
    if t.endswith('가'):          # '1911가' 처럼 한 글자로 붙는 경우
        return '가형'
    if t.endswith('나'):
        return '나형'
    return ''


def canon_banner(name):
    """같은 시험인데 배너 문자열이 조금씩 다른 경우를 하나로 묶는 열쇠.
    (예: '2025학년도3월고2전국연합학력평가문제지2503' 과 '2503' 은 같은 시험)"""
    s = name.replace('-unlocked', '').strip()
    m = SUNEUNG_PAT.match(s)
    if m:
        return 'S|%s|%s|%s' % (m.group(1), m.group(2), norm_subject(m.group(3)))
    nums = re.findall(r'\d{4}', s)
    if nums:
        return 'E|%s|%s' % (nums[-1], norm_subject(s))
    return 'X|' + s


def split_sections(rows):
    secs = []
    for r in rows:
        key = canon_banner(r['banner'])
        if secs and secs[-1]['key'] == key:
            secs[-1]['pages'].append(r)
        else:
            secs.append(dict(name=r['banner'], key=key, pages=[r]))
    return secs


def calibrate(sec):
    """시험 구간 전체에서 단별 문항번호 여백을 구한다."""
    xs = [[], []]
    for p in sec['pages']:
        if p.get('scan'):
            continue
        for ci, col in enumerate(p['lines'][:2]):
            body = [ln['x'] for ln in col if len(ln['s']) >= 6]
            blm = mode_x(body) if body else None
            for ln in col:
                if ln['n'] is not None and (blm is None or ln['x'] <= blm + 4.0):
                    xs[ci].append(ln['x'])
    return [mode_x(v) if v else None for v in xs]


def anchors_of(col, lm, ctop, cbot):
    if lm is None:
        return []
    out = []
    for ln in col:
        if ln['n'] is None:
            continue
        if not (lm - 4.0 <= ln['x'] <= lm + 6.0):
            continue
        if not (ctop - 4 <= ln['t'] <= cbot):
            continue
        out.append((ln['n'], ln['t']))
    out.sort(key=lambda a: a[1])
    return out


def build_section(sec, margins):
    """[(번호, [(page, col, t0, t1)], 텍스트)] 반환."""
    units = []          # (page_rec, col_index, [anchors], ctop, cbot)
    for p in sec['pages']:
        if p.get('scan'):
            units.append((p, None, [], 0, 0))
            continue
        for ci in range(len(p['lines'])):
            lm = margins[ci] if ci < len(margins) else None
            units.append((p, ci, anchors_of(p['lines'][ci], lm, p['ctop'], p['cbot']),
                          p['ctop'], p['cbot']))

    # 번호 시퀀스 검증: 1씩 증가하는 흐름에서 벗어난 후보는 버린다
    seq = []
    for ui, (p, ci, anc, ctop, cbot) in enumerate(units):
        for num, top in anc:
            seq.append([ui, num, top, True])
    expect = None
    for e in seq:
        if expect is None:
            expect = e[1]
        if e[1] == expect:
            expect += 1
        elif e[1] == expect + 1 or (expect is not None and e[1] > expect and e[1] - expect <= 2):
            expect = e[1] + 1      # 중간 누락은 허용
        else:
            e[3] = False           # 역행하거나 튀는 번호는 오검출
    good = collections.defaultdict(list)
    for ui, num, top, ok in seq:
        if ok:
            good[ui].append((num, top))

    # 조각 만들기 → 문항으로 병합
    qs = []
    for ui, (p, ci, _anc, ctop, cbot) in enumerate(units):
        if ci is None:
            continue
        anc = good.get(ui, [])
        first = anc[0][1] if anc else cbot
        if first > ctop + 10:
            lead = ''.join(ln['s'] for ln in p['lines'][ci] if ctop - 3 <= ln['t'] < first - 5)
            for L in LABELS:
                lead = lead.replace(L, '')
            # 쪽머리 밑줄(━━━)이나 점선은 글자로 치지 않는다.
            # 이것을 글자로 세면 «단답형» 딱지만 있는 칸이 앞 문항에 딸려 붙는다.
            lead = re.sub(r'[\u2500-\u257f\u2014\u2013\-_.·…\s]+', '', lead)
            if len(lead.strip()) > 3 and qs:
                qs[-1]['rects'].append((p, ci, ctop, first - 8))
        for k, (num, top) in enumerate(anc):
            bot = anc[k + 1][1] - 8 if k + 1 < len(anc) else cbot
            # 문항 사이에 놓인 «단답형» 같은 구분 딱지는 앞 문항에 딸려 들어가지 않게 자른다
            for ln in p['lines'][ci]:
                t = ln['s'].replace(' ', '')
                if t and any(t == L.replace(' ', '') for L in LABELS) and top + 20 < ln['t'] < bot:
                    bot = min(bot, ln['t'] - 6)
            qs.append(dict(num=num, rects=[(p, ci, top - 9, bot)]))

    out = []
    for q in qs:
        txt = []
        for p, ci, t0, t1 in q['rects']:
            lines = [ln for ln in p['lines'][ci] if t0 - 3 <= ln['t'] < t1]
            lines.sort(key=lambda ln: ln['i'])
            txt.append(' '.join(ln['s'] for ln in lines))
        out.append(dict(num=q['num'], text=re.sub(r'\s+', ' ', ' '.join(txt)).strip(),
                        rects=[dict(page=p['page'], col=ci, t0=round(t0, 1), t1=round(t1, 1),
                                    x0=p['cols'][ci][0], x1=p['cols'][ci][1],
                                    w=p['w'], h=p['h'])
                               for p, ci, t0, t1 in q['rects']]))
    return out


def parse_name(name, grade):
    """시험 이름을 연도·시행·과목으로 나누고, 보여줄 이름을 만든다.

    수능·모의평가는 '학년도' 기준, 교육청 전국연합은 '실시 연월' 기준으로 적는다.
    """
    s = name.replace('-unlocked', '').strip()
    m = SUNEUNG_PAT.match(s)
    if m:
        subj = norm_subject(m.group(3))
        disp = '%s학년도 %s' % (m.group(1), m.group(2)) + (' ' + subj if subj else '')
        return dict(year='20' + m.group(1), round=m.group(2), subject=subj,
                    grade='수능·모평', name=disp)

    nums = re.findall(r'\d{4}', s)
    if nums:
        yymm = nums[-1]
        yy, mm = yymm[:2], yymm[2:]
        subj = norm_subject(s)
        rnd = '%d월' % int(mm) if mm.isdigit() and 1 <= int(mm) <= 12 else ''
        disp = '20%s년 %s %s' % (yy, rnd, grade) + (' ' + subj if subj else '')
        return dict(year='20' + yy, round=rnd, subject=subj, grade=grade, name=disp)

    return dict(year='', round='', subject='', grade=grade, name=s)


def main():
    inp, outp, label = sys.argv[1], sys.argv[2], sys.argv[3]
    grade = next((g for g in ('고1', '고2', '고3') if g in label), '수능·모평')
    rows = [json.loads(l) for l in open(inp, encoding='utf-8')]
    rows.sort(key=lambda r: r['page'])
    result = dict(file=label, exams=[])
    for sec in split_sections(rows):
        margins = calibrate(sec)
        qs = build_section(sec, margins)
        meta = parse_name(sec['name'], grade)
        result['exams'].append(dict(**meta, raw=sec['name'],
                                    pages=[p['page'] for p in sec['pages']],
                                    scan=sum(1 for p in sec['pages'] if p.get('scan')),
                                    questions=qs))
    json.dump(result, open(outp, 'w', encoding='utf-8'), ensure_ascii=False)
    nq = sum(len(e['questions']) for e in result['exams'])
    print('시험 %d개, 문항 %d개' % (len(result['exams']), nq))


if __name__ == '__main__':
    main()
