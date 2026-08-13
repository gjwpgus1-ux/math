# -*- coding: utf-8 -*-
"""스캔본에서 따로 뽑은 문항을 본 색인(questions.json)의 해당 시험 자리에 끼워 넣는다.

사용: python3 merge_scan.py <본_questions.json> <스캔_questions.json>
"""
import sys, json


def main():
    main_path, scan_path = sys.argv[1], sys.argv[2]
    M = json.load(open(main_path, encoding='utf-8'))
    S = json.load(open(scan_path, encoding='utf-8'))
    by_name = {e['name']: e for e in S['exams']}

    hit = []
    for i, e in enumerate(M['exams']):
        s = by_name.get(e.get('raw', '')) or by_name.get(e['name'])
        if not s:
            continue
        e['questions'] = s['questions']
        e['scan'] = 0
        hit.append((i, e['name'], len(s['questions'])))

    json.dump(M, open(main_path, 'w', encoding='utf-8'), ensure_ascii=False)
    for i, n, c in hit:
        print('  [%d] %s ← %d문항' % (i, n, c))
    print('총 문항 %d개' % sum(len(e['questions']) for e in M['exams']))


if __name__ == '__main__':
    main()
