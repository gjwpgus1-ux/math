# -*- coding: utf-8 -*-
"""도함수 표시를 한 가지로 맞춘다.

시험지마다 도함수 프라임이 세 가지로 찍혀 있다.
    ′ (U+2032)  ″ (U+2033)  ’ (U+2019)
찾는 사람은 자판에 있는 ' 하나만 친다. 그래서 색인 쪽을 한 가지(′)로 모으고,
검색 쪽에서 ' 를 ′ 로 바꿔 주면 f'(x) 로 f′(x) 를 찾을 수 있다.

2계도함수는 ″ 대신 ′′ 로 적는다. 그래야 g''(x) 처럼 두 번 친 것과 맞는다.

사용: python3 fix_prime.py <index.js>
"""
import sys, os, json, shutil, collections

MAP = [('‴', '′′′'), ('″', '′′'), ('’', '′'), ('´', '′'), ("'", '′')]


def norm(s):
    for a, b in MAP:
        s = s.replace(a, b)
    return s


def main():
    idx = sys.argv[1]
    s = open(idx, encoding='utf-8').read()
    head = s[:s.index('{')]
    D = json.loads(s[s.index('{'):].rstrip().rstrip(';'))

    before = collections.Counter()
    n = 0
    for it in D['items']:
        if len(it) > 6 and it[6]:
            for ch in it[6]:
                if ch in "′″‴’´'":
                    before[ch] += 1
            t = norm(it[6])
            if t != it[6]:
                it[6] = t
                n += 1

    after = collections.Counter()
    for it in D['items']:
        if len(it) > 6 and it[6]:
            for ch in it[6]:
                if ch in "′″‴’´'":
                    after[ch] += 1

    shutil.copy2(idx, idx + '.프라임고치기전')
    with open(idx, 'w', encoding='utf-8') as f:
        f.write(head)
        json.dump(D, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')

    print('고친 문항 %d개' % n)
    print('  고치기 전 :', ' '.join('%s %d' % (k, v) for k, v in sorted(before.items())))
    print('  고친 뒤   :', ' '.join('%s %d' % (k, v) for k, v in sorted(after.items())))
    print('  %s  %.1fMB' % (idx, os.path.getsize(idx) / 1e6))


if __name__ == '__main__':
    main()
