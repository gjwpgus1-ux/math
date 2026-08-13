# -*- coding: utf-8 -*-
"""4단계: 문항 정보와 이미지 목록을 합쳐 검색용 index.js 를 만든다.

사용: python3 build_app.py <앱폴더> <작업이름>[:<표시이름>] ...
예:   python3 build_app.py /out/검색기 suneung go1 go2
"""
import sys, os, json, shutil, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import layout

WORK = '/tmp/qbuild'


def main():
    app = sys.argv[1]
    keys = sys.argv[2:]
    os.makedirs(os.path.join(app, 'data'), exist_ok=True)
    os.makedirs(os.path.join(app, 'img'), exist_ok=True)

    exams, items, notes = [], [], []
    for key in keys:
        w = os.path.join(WORK, key)
        D = json.load(open(os.path.join(w, 'questions.json'), encoding='utf-8'))
        man = {}
        with open(os.path.join(w, 'manifest.jsonl'), encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                for m in json.loads(line):
                    man[(m['exam'], m['num'])] = m

        dst = os.path.join(app, 'img', key)
        os.makedirs(dst, exist_ok=True)
        base = len(exams)
        for ei, e in enumerate(D['exams']):
            exams.append(dict(n=e['name'], y=e.get('year', ''), r=e.get('round', ''),
                              s=e.get('subject', ''), g=e.get('grade', ''), f=D['file']))
            # 스캔 페이지가 있어도 문항이 다 뽑혔으면 알릴 필요가 없다
            # (대개 그 페이지는 문제지가 아니라 OMR 답안지다)
            if e.get('scan') and not e['questions']:
                notes.append('%s (%s)' % (e['name'], D['file']))
            for q in e['questions']:
                m = man.get((ei, q['num']))
                if not m:
                    continue
                src = os.path.join(w, 'img', m['img'])
                if not os.path.exists(src):
                    continue
                out_path = os.path.join(dst, m['img'])
                if not (os.path.exists(out_path)
                        and os.path.getsize(out_path) == os.path.getsize(src)):
                    shutil.copyfile(src, out_path)
                items.append([base + ei, q['num'], key + '/' + m['img'],
                              m['w'], m['h'], layout.norm_key(q['text'])])

    data = dict(exams=exams, items=items, scan=sorted(set(notes)))
    with open(os.path.join(app, 'data', 'index.js'), 'w', encoding='utf-8') as f:
        f.write('window.QDATA=')
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';')
    size = os.path.getsize(os.path.join(app, 'data', 'index.js')) // 1024
    print('시험 %d개 · 문항 %d개 · 색인 %dKB' % (len(exams), len(items), size))


if __name__ == '__main__':
    main()
