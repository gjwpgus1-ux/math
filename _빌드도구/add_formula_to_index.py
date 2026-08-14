# -*- coding: utf-8 -*-
"""수식이 살아 있는 글을 색인(data/index.js)에 덧붙인다.

문항 한 줄은 지금  [시험번호, 번호, 그림, 폭, 높이, 찾을글]  여섯 칸이다.
여기에 일곱째 칸으로 수식글을 붙인다. 없으면 칸을 만들지 않는다.

그림·유사문항·복사자료는 건드리지 않는다. 색인 파일만 다시 쓴다.
원본은 index.js.바꾸기전 으로 남겨 둔다.

사용: python3 add_formula_to_index.py <index.js> <formula.json> [출력]
"""
import sys, os, json, shutil

# 도함수 프라임은 시험지마다 세 가지로 찍혀 있다. 한 가지(′)로 모아 둔다.
# 2계도함수는 ″ 대신 ′′ 로 적어야 g''(x) 처럼 두 번 친 것과 맞는다.
PRIME = [('‴', '′′′'), ('″', '′′'), ('’', '′'), ('´', '′'), ("'", '′')]


def main():
    idx = sys.argv[1]
    fj = sys.argv[2]
    out = sys.argv[3] if len(sys.argv) > 3 else idx

    s = open(idx, encoding='utf-8').read()
    head = s[:s.index('{')]
    D = json.loads(s[s.index('{'):].rstrip().rstrip(';'))
    F = json.load(open(fj, encoding='utf-8'))

    names = [e['n'] for e in D['exams']]
    hit = miss = 0
    seen = set()
    for it in D['items']:
        while len(it) > 6:
            it.pop()                      # 여러 번 돌려도 칸이 늘지 않게
        t = F.get(names[it[0]], {}).get(str(it[1]))
        if t:
            t = ''.join(t.split())         # 띄어쓰기는 어차피 무시하고 찾는다
            for a, b in PRIME:
                t = t.replace(a, b)
            it.append(t)
            hit += 1
            seen.add((names[it[0]], str(it[1])))
        else:
            miss += 1

    extra = sum(len(v) for v in F.values()) - len(seen)
    if out == idx and os.path.exists(idx):
        shutil.copy2(idx, idx + '.바꾸기전')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(head)
        json.dump(D, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n' if head.endswith('=') else '')

    print('수식글 붙은 문항 %d개 / 안 붙은 문항 %d개' % (hit, miss))
    print('색인에서 짝을 못 찾은 수식글 %d개' % extra)
    print('%s  %.1fMB' % (out, os.path.getsize(out) / 1e6))


if __name__ == '__main__':
    main()
