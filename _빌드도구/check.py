# -*- coding: utf-8 -*-
"""추출 결과 점검: 시험별로 문항 번호가 빠지거나 중복되지 않았는지 확인."""
import sys, json, collections


def expected(e, got):
    """그 시험지에 있어야 할 문항 번호 목록."""
    subj = e.get('subject', '')
    if subj in ('가형', '나형'):
        return list(range(1, 31))
    if subj == '공통':
        return list(range(1, 23))
    if subj in ('확통', '미적', '기하'):
        return list(range(23, 31))
    if e.get('grade') in ('고1', '고2'):
        return list(range(1, 31))
    if e.get('grade') == '고3':
        return list(range(1, 31))
    return list(range(min(got), max(got) + 1)) if got else []


def main():
    D = json.load(open(sys.argv[1], encoding='utf-8'))
    bad = tot = 0
    for e in D['exams']:
        nums = [q['num'] for q in e['questions']]
        got = sorted(set(nums))
        tot += len(nums)
        dup = [n for n, c in collections.Counter(nums).items() if c > 1]
        miss = [n for n in expected(e, got) if n not in got]
        if miss or dup or e.get('scan'):
            bad += 1
            print('  %-24s(%s) 스캔=%2d 문항=%2d 빠짐=%s 중복=%s'
                  % (e['name'], e.get('raw', ''), e.get('scan', 0), len(nums),
                     miss[:12], dup[:6]))
    print('%s: 시험 %d개 중 이상 %d개 / 문항 %d개'
          % (D['file'], len(D['exams']), bad, tot))


if __name__ == '__main__':
    main()
