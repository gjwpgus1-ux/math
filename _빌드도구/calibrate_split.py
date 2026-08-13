# -*- coding: utf-8 -*-
"""1.5단계: 1차 추출 결과에서 시험 구간별 단 경계를 중앙값으로 확정한다.
같은 시험지는 모든 쪽의 단 구조가 같으므로, 한두 쪽에서 튄 값을 구간 전체로 바로잡는다.

사용: python3 calibrate_split.py <in.jsonl> <out_splitmap.json>
"""
import sys, json, statistics


def main():
    rows = [json.loads(l) for l in open(sys.argv[1], encoding='utf-8')]
    rows.sort(key=lambda r: r['page'])
    secs = []
    for r in rows:
        if secs and secs[-1][0] == r['banner']:
            secs[-1][1].append(r)
        else:
            secs.append([r['banner'], [r]])

    smap = {}
    for name, rs in secs:
        vals = [r['split'] for r in rs if 'split' in r]
        if not vals:
            continue
        med = statistics.median(vals)
        for r in rs:
            smap[r['page']] = med
    json.dump(smap, open(sys.argv[2], 'w'), ensure_ascii=False)
    print('구간 %d개, 페이지 %d쪽 단 경계 보정' % (len(secs), len(smap)))


if __name__ == '__main__':
    main()
