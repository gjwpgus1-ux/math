# -*- coding: utf-8 -*-
"""빠진 문항이 왜 안 잡혔는지 진단한다.

해당 시험의 모든 줄을 훑어 'N.' 으로 시작하는 후보를 찾고,
그 줄의 x 위치가 문항번호 여백에서 얼마나 벗어났는지 보여준다.

사용: python3 diagnose.py <작업이름> [문항수기준]
"""
import sys, json, re, collections
sys.path.insert(0, '/sessions/serene-festive-hamilton/mnt/outputs')
from assemble import calibrate, split_sections, canon_banner
from check import expected


def main():
    key = sys.argv[1]
    W = '/tmp/qbuild/' + key
    D = json.load(open(W + '/questions.json', encoding='utf-8'))
    rows = {}
    for l in open(W + '/pass2.jsonl', encoding='utf-8'):
        r = json.loads(l)
        rows[r['page']] = r

    all_rows = sorted(rows.values(), key=lambda r: r['page'])
    secs = {canon_banner(s['name']): s for s in split_sections(all_rows)}

    for e in D['exams']:
        got = sorted(set(q['num'] for q in e['questions']))
        miss = [n for n in expected(e, got) if n not in got]
        if not miss or e.get('scan', 0) >= len(e['pages']):
            continue
        sec = secs.get(canon_banner(e['raw']))
        margins = calibrate(sec) if sec else [None, None]
        print('### %s  빠짐=%s  번호여백=%s'
              % (e['name'], miss, [round(m, 1) if m else None for m in margins]))
        for pi in e['pages']:
            r = rows[pi]
            if r.get('scan'):
                print('    p%d  (스캔 페이지)' % pi)
                continue
            for ci, col in enumerate(r.get('lines', [])):
                bodyx = [ln['x'] for ln in col if len(ln['s']) >= 6]
                for ln in col:
                    m = re.match(r'^\s*(\d{1,2})\s*\.', ln['s'])
                    if m and int(m.group(1)) in miss:
                        lm = margins[ci] if ci < len(margins) else None
                        why = []
                        if ln['n'] is None:
                            why.append('번호형태 인식실패')
                        if lm is not None and not (lm - 4 <= ln['x'] <= lm + 6):
                            why.append('x=%.1f (여백 %.1f 에서 %.1f 벗어남)' % (ln['x'], lm, ln['x'] - lm))
                        if not (r['ctop'] - 4 <= ln['t'] <= r['cbot']):
                            why.append('본문범위 %.0f~%.0f 밖 (t=%.0f)' % (r['ctop'], r['cbot'], ln['t']))
                        print('    p%d c%d  n=%-5s x=%6.1f t=%6.1f | %s'
                              % (pi, ci, ln['n'], ln['x'], ln['t'], ln['s'][:44]))
                        print('         → %s' % (', '.join(why) if why else '순서검증에서 탈락'))
        print()


main()
