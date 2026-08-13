# -*- coding: utf-8 -*-
"""이미 만들어진 data/index.js 에 새 시험만 덧붙인다.

전체를 다시 만들지 않으므로 몇 초면 끝나고, 기존 5천여 문항은 손대지 않는다.
같은 이름의 시험이 이미 있으면 건너뛴다(두 번 넣어도 안전).

사용: python3 add_exams.py <앱폴더> <작업폴더> <작업이름> ...
예:   python3 add_exams.py ../ /tmp/qb n2603g1 n2603g2
"""
import sys, os, json, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import layout


def load_index(app):
    p = os.path.join(app, 'data', 'index.js')
    s = open(p, encoding='utf-8').read()
    return json.loads(s[len('window.QDATA='):-1])


def main():
    app, work = sys.argv[1], sys.argv[2]
    keys = sys.argv[3:]
    D = load_index(app)
    exams, items = D['exams'], D['items']
    have = set(e['n'] for e in exams)
    before_e, before_i = len(exams), len(items)

    for key in keys:
        w = os.path.join(work, key)
        Q = json.load(open(os.path.join(w, 'q.json'), encoding='utf-8'))
        man = {}
        for line in open(os.path.join(w, 'manifest.jsonl'), encoding='utf-8'):
            line = line.strip()
            if not line:
                continue
            for m in json.loads(line):
                man[(m['exam'], m['num'])] = m

        dst = os.path.join(app, 'img', key)
        os.makedirs(dst, exist_ok=True)
        added = 0
        for ei, e in enumerate(Q['exams']):
            if e['name'] in have:
                print('  건너뜀 (이미 있음): %s' % e['name'])
                continue
            have.add(e['name'])
            idx = len(exams)
            exams.append(dict(n=e['name'], y=e.get('year', ''), r=e.get('round', ''),
                              s=e.get('subject', ''), g=e.get('grade', ''), f=Q['file']))
            for q in e['questions']:
                m = man.get((ei, q['num']))
                if not m:
                    continue
                src = os.path.join(w, 'img', m['img'])
                if not os.path.exists(src):
                    continue
                shutil.copyfile(src, os.path.join(dst, m['img']))
                items.append([idx, q['num'], key + '/' + m['img'],
                              m['w'], m['h'], layout.norm_key(q['text'])])
                added += 1
        print('  %-10s 문항 %d개' % (key, added))

    D['exams'], D['items'] = exams, items
    p = os.path.join(app, 'data', 'index.js')
    with open(p, 'w', encoding='utf-8') as f:
        f.write('window.QDATA=')
        json.dump(D, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';')
    print()
    print('시험 %d → %d개 · 문항 %d → %d개 · 색인 %dKB'
          % (before_e, len(exams), before_i, len(items), os.path.getsize(p) // 1024))


if __name__ == '__main__':
    main()
