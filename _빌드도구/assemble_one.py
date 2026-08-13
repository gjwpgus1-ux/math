# -*- coding: utf-8 -*-
"""단일 시험 PDF(합본이 아닌 것)를 문항으로 확정한다.

합본과 다른 점
  · 쪽마다 «2503» 같은 배너가 없어 시험을 이름으로 나눌 수 없다 → 메타를 직접 받는다
  · 고3·모평은 한 파일 안에 공통 + 확률과 통계 + 미적분 + 기하가 이어 붙어 있다
    → 문항 번호가 23번으로 되돌아가는 곳에서 과목을 가른다

사용: python3 assemble_one.py <pass2.jsonl> <out.json> <연도> <시행> <학년>
      예) python3 assemble_one.py p2.jsonl q.json 2026 6월 고1
          python3 assemble_one.py p2.jsonl q.json 2027 6월 수능·모평
"""
import sys, json, re, collections
import assemble as A

SUBJ_HINT = [('확률과 통계', ['률', '통계']),
             ('미적분',      ['미적분', '적분']),
             ('기하',        ['기하', '벡터'])]


def page_nums(rec):
    """그 쪽에서 잡힌 문항 번호들."""
    out = []
    for col in rec['lines']:
        for ln in col:
            if ln['n'] is not None:
                out.append(ln['n'])
    return out


def page_text(rec):
    return ''.join(ln['s'] for col in rec['lines'] for ln in col).replace(' ', '')


def hint_of(rec):
    """그 쪽에 세로로 인쇄된 과목 이름을 낱자로 짐작한다. 없으면 None."""
    txt = page_text(rec)
    best, bn = None, 0
    for nm, keys in SUBJ_HINT:
        c = sum(txt.count(k) for k in keys)
        if c > bn:
            best, bn = nm, c
    return best


def split_sections(rows):
    """과목 구간을 가른다.

    고3·모평은 공통 1~22 뒤에 선택과목이 저마다 23번부터 시작한다.
    확률과 통계는 22번 다음에 23번으로 이어져 번호만으로는 알 수 없으므로,
    «23번으로 시작하는 쪽 + 쪽옆 과목 이름»을 함께 본다.
    과목 이름은 세로로 인쇄돼 글자가 흩어지므로 낱자를 센다.
    """
    secs, cur, cur_subj, last = [], [], '공통', None
    for r in rows:
        ns = page_nums(r)
        lo = min(ns) if ns else None
        hi = max(ns) if ns else None
        h = hint_of(r)
        newsec = None
        if lo == 23 and h and h != cur_subj:
            newsec = h                                   # 선택과목이 시작되는 쪽
        elif lo is not None and last is not None and lo < last - 1:
            newsec = h or '선택'                          # 번호가 되돌아갔다
        if newsec and cur:
            secs.append(dict(name=cur_subj, pages=cur))
            cur, cur_subj = [], newsec
        cur.append(r)
        if hi is not None:
            last = hi
    if cur:
        secs.append(dict(name=cur_subj, pages=cur))
    return secs


def main():
    inp, outp, year, rnd, grade = sys.argv[1:6]
    rows = [json.loads(l) for l in open(inp, encoding='utf-8')]
    rows.sort(key=lambda r: r['page'])

    result = dict(file='%s %s %s' % (year, rnd, grade), exams=[])
    for sec in split_sections(rows):
        margins = A.calibrate(sec)
        qs = A.build_section(sec, margins)
        subj = sec['name']
        if grade == '수능·모평':
            disp = '%s학년도 %s %s' % (year[2:], rnd, subj)
        else:
            disp = '%s년 %s %s %s' % (year, rnd, grade, subj)
        result['exams'].append(dict(year=year, round=rnd, subject=subj, grade=grade,
                                    name=disp, raw=disp,
                                    pages=[p['page'] for p in sec['pages']],
                                    scan=0, questions=qs))
    json.dump(result, open(outp, 'w', encoding='utf-8'), ensure_ascii=False)
    for e in result['exams']:
        nums = [q['num'] for q in e['questions']]
        gap = ''
        if nums:
            want = list(range(min(nums), max(nums) + 1))
            miss = sorted(set(want) - set(nums))
            dup = [n for n, c in collections.Counter(nums).items() if c > 1]
            if miss: gap += '  빠짐:' + ','.join(map(str, miss))
            if dup:  gap += '  중복:' + ','.join(map(str, dup))
        print('  %-28s %2d문항  %s~%s%s' %
              (e['name'], len(nums), min(nums) if nums else '-', max(nums) if nums else '-', gap))


if __name__ == '__main__':
    main()
