# -*- coding: utf-8 -*-
"""2022 개정 수학과 교육과정(별책 8) PDF에서 성취기준을 통째로 뽑아낸다.

뽑는 것
  코드 · 학교급 · 과목 · 영역번호 · 영역명 · 성취기준 문장
  + 그 성취기준에 달린 해설
  + 영역 단위의 «성취기준 적용 시 고려 사항» 과 거기서 추린 «용어와 기호»

사용: python3 extract_std.py <교육과정 PDF> <내보낼 json>
"""
import sys, re, json, unicodedata
import pypdfium2 as pdfium

SUBJ = [
    ('2수',   '초등학교', '수학(1~2학년)'),
    ('4수',   '초등학교', '수학(3~4학년)'),
    ('6수',   '초등학교', '수학(5~6학년)'),
    ('9수',   '중학교',   '수학'),
    ('10공수1','고등학교', '공통수학1'),
    ('10공수2','고등학교', '공통수학2'),
    ('10기수1','고등학교', '기본수학1'),
    ('10기수2','고등학교', '기본수학2'),
    ('12대수', '고등학교', '대수'),
    ('12미적Ⅰ','고등학교', '미적분Ⅰ'),
    ('12확통', '고등학교', '확률과 통계'),
    ('12미적Ⅱ','고등학교', '미적분Ⅱ'),
    ('12기하', '고등학교', '기하'),
    ('12경수', '고등학교', '경제 수학'),
    ('12인수', '고등학교', '인공지능 수학'),
    ('12직수', '고등학교', '직무 수학'),
    ('12수문', '고등학교', '수학과 문화'),
    ('12실통', '고등학교', '실용 통계'),
    ('12수과', '고등학교', '수학과제 탐구'),
]
SUBJ_BY_PREFIX = {p:(lv,nm) for p,lv,nm in SUBJ}
# 긴 접두사를 먼저 (10공수1 이 10공수 보다 앞서야 함)
PREFIXES = sorted(SUBJ_BY_PREFIX, key=len, reverse=True)

CODE   = re.compile(r'\[([0-9]{1,2}[가-힣ⅠⅡ]{1,4}[0-9]?-?[0-9]{2}-[0-9]{2})\]')
AREA   = re.compile(r'^\((\d{1,2})\)\s*(.+?)\s*$')
HEAD_A = re.compile(r'^\(가\)\s*성취기준\s*해설')
HEAD_B = re.compile(r'^\(나\)\s*성취기준\s*적용\s*시\s*고려\s*사항')
HEAD_S = re.compile(r'^나\.\s*성취기준')
HEAD_E = re.compile(r'^(다\.|3\.|가\.\s*내용\s*체계)')
BULLET = re.compile(r'^[•·⋅]\s*')
TERMS  = re.compile(r'용어와\s*기호로\s*[‘\'"]?(.+)')


def prefix_of(code):
    for p in PREFIXES:
        if code.startswith(p):
            return p
    return None


def clean(s):
    s = unicodedata.normalize('NFC', s)
    s = s.replace('​', '').replace('\xa0', ' ').replace(' 숔 ', ' - ')
    return re.sub(r'\s+', ' ', s).strip()


def page_lines(pg):
    """쪽 텍스트를 줄 단위로. 머리말·쪽번호는 버린다."""
    t = pg.get_textpage().get_text_range()
    out = []
    for ln in t.split('\n'):
        ln = ln.rstrip()
        if not ln.strip():
            continue
        if re.fullmatch(r'\s*\d{1,3}\s*', ln):
            continue
        if ln.startswith('수학과 교육과정') or ln.startswith('선택 중심 교육과정') \
           or ln.startswith('공통 교육과정'):
            continue
        out.append(ln)
    return out


def wrap_join(lines):
    """이어지는 줄을 하나로 붙인다. 새 항목(코드·글머리표·영역)이 나오면 끊는다."""
    items, cur = [], None
    for ln in lines:
        s = ln.strip()
        new = CODE.match(s) or BULLET.match(s) or AREA.match(s) \
              or HEAD_A.match(s) or HEAD_B.match(s)
        if new:
            if cur: items.append(cur)
            cur = s
        elif cur is not None:
            cur += ' ' + s
    if cur: items.append(cur)
    return [clean(x) for x in items]


def main():
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else 'standards.json'
    doc = pdfium.PdfDocument(src)

    # 1) 과목별로 «나. 성취기준» 이 있는 쪽 범위를 찾는다
    span = {}
    for i in range(len(doc)):
        txt = doc[i].get_textpage().get_text_range()
        for c in CODE.findall(txt):
            p = prefix_of(c)
            if not p: continue
            a, b = span.get(p, (i, i))
            span[p] = (min(a, i), max(b, i))

    recs, areas = [], []
    for p in PREFIXES:
        if p not in span: continue
        lv, nm = SUBJ_BY_PREFIX[p]
        a, b = span[p]
        b = min(b + 1, len(doc) - 1)   # 마지막 영역의 «고려 사항»이 다음 쪽으로 넘어가는 일이 있다
        lines = []
        for i in range(a, b + 1):
            lines += page_lines(doc[i])
        items = wrap_join(lines)

        sec = 'std'
        area_no, area_nm = '', ''
        cur_note, cur_terms = [], ''
        pending = {}          # 코드 → 레코드
        order = []

        def flush_area():
            if not area_no or not order: return   # 성취기준이 하나도 없는 껍데기는 버린다
            areas.append({'과목': nm, '학교급': lv, '영역번호': area_no,
                          '영역명': area_nm, '용어와기호': cur_terms,
                          '고려사항': list(cur_note)})
            for code in order:
                r = pending[code]
                r['용어와기호'] = cur_terms
                r['고려사항'] = list(cur_note)

        for it in items:
            mc = CODE.search(it)
            if mc and prefix_of(mc.group(1)) != p:
                break                       # 다음 과목이 시작됐다
            m = AREA.match(it)
            if m and not CODE.match(it):
                flush_area()
                area_no, area_nm = m.group(1), m.group(2)
                cur_note, cur_terms = [], ''
                pending, order = {}, []
                sec = 'std'
                continue
            if HEAD_S.match(it) or HEAD_E.match(it):
                if HEAD_E.match(it): break        # «다. 성취기준 ...» 다음은 이 과목이 아니다
                continue
            if HEAD_A.match(it): sec = 'note'; continue
            if HEAD_B.match(it): sec = 'apply'; continue

            m = CODE.match(it)
            if sec == 'std' and m:
                code = m.group(1)
                body = clean(CODE.sub('', it, count=1))
                r = {'코드': code, '학교급': lv, '과목': nm,
                     '영역번호': area_no, '영역명': area_nm,
                     '성취기준': body, '해설': ''}
                recs.append(r); pending[code] = r; order.append(code)
            elif sec == 'note':
                s = BULLET.sub('', it)
                m2 = CODE.match(s)
                if m2 and m2.group(1) in pending:
                    pending[m2.group(1)]['해설'] = clean(CODE.sub('', s, count=1))
            elif sec == 'apply':
                s = BULLET.sub('', it)
                cur_note.append(s)
                mt = TERMS.search(s)
                if mt:
                    tt = mt.group(1)
                    tt = re.split(r'[’\']?\s*[을를]\s*다룬다', tt)[0]
                    cur_terms = clean(tt.strip('‘’\'" '))
        flush_area()

    json.dump({'출처': src.split('/')[-1], '성취기준': recs, '영역': areas},
              open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    from collections import Counter
    c = Counter((r['학교급'], r['과목']) for r in recs)
    print('성취기준 %d개 · 영역 %d개' % (len(recs), len(areas)))
    for (lv, nm), n in c.items():
        print('  %-6s %-12s %3d개' % (lv, nm, n))
    bad = [r for r in recs if not r['성취기준'] or not r['영역명']]
    print('빠진 값이 있는 항목:', len(bad))
    for r in bad[:5]: print('   ', r['코드'], repr(r['성취기준'][:30]), repr(r['영역명']))


if __name__ == '__main__':
    main()
