# -*- coding: utf-8 -*-
"""제보된 문항 하나를 «아래를 넉넉히 잡아» 다시 잘라 낸다.

잘리는 원인
    자르는 아래 끝을 «마지막 글자 줄»로 잡다 보니, 글자 아래에 그림만 있는
    문항은 그림이 잘려 나갔다. 그림은 글자가 아니라 선이라서 세지 못한 것이다.

하는 일
    그 문항 마지막 조각의 아래 끝을 쪽 아래쪽(꼬리말 앞)까지 늘린 뒤,
    실제 픽셀을 보고 빈 곳을 잘라 내는 render.py 의 trim 을 그대로 쓴다.

사용: python3 recrop.py <key> <시험번호> <문항번호> <출력.png> [--up N] [--bot N]
      --up N   첫 조각의 위쪽을 N pt 더 올린다 (분수처럼 키 큰 식이 잘릴 때)
      --bot N  마지막 조각의 아래끝을 N pt 로 못박는다
      --rects 0,1  쓸 조각만 고른다 (엉뚱한 조각이 딸려 왔을 때)
"""
import sys, os, json, glob
import numpy as np
import pypdfium2 as pdfium
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render

HERE = os.path.dirname(os.path.abspath(__file__))
NEWQ = '/tmp/qb'          # 새로 넣은 시험의 작업 폴더


def load_q(key):
    """key 에 맞는 questions json 과 PDF 이름을 찾는다."""
    p = os.path.join(HERE, 'questions_%s.json' % key)
    if os.path.exists(p):
        return json.load(open(p, encoding='utf-8')), None
    p = os.path.join(NEWQ, key, 'q.json')
    if os.path.exists(p):
        return json.load(open(p, encoding='utf-8')), None
    raise SystemExit('문항 정보를 찾지 못했습니다: %s' % key)


def pdf_for(key):
    import subprocess
    names = {}
    for line in open(os.path.join(HERE, 'files.txt'), encoding='utf-8'):
        line = line.strip()
        if line:
            k, f, _ = line.split('|')
            names[k] = f
    p2 = os.path.join(HERE, '새시험목록.txt')
    if os.path.exists(p2):
        for line in open(p2, encoding='utf-8'):
            line = line.strip()
            if line:
                parts = line.split('|')
                names[parts[0]] = parts[1]
    if key not in names:
        raise SystemExit('PDF 이름을 모릅니다: %s' % key)
    out = subprocess.run(['bash', os.path.join(HERE, 'findpdf.sh'), names[key]],
                         capture_output=True, text=True)
    if out.returncode != 0:
        raise SystemExit(out.stderr.strip())
    return out.stdout.strip()


def main():
    key, ei, num, outp = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
    rest = sys.argv[5:]
    up = grow = None
    pick = None
    for i, a in enumerate(rest):
        if a == '--up' and i + 1 < len(rest):
            up = float(rest[i + 1])
        if a == '--bot' and i + 1 < len(rest):
            grow = float(rest[i + 1])
        if a == '--rects' and i + 1 < len(rest):
            pick = [int(x) for x in rest[i + 1].split(',')]

    D, _ = load_q(key)
    e = D['exams'][ei]
    q = next((x for x in e['questions'] if x['num'] == num), None)
    if not q:
        raise SystemExit('%s 시험%d 에 %d번이 없습니다' % (key, ei, num))

    doc = pdfium.PdfDocument(pdf_for(key))
    rects = [dict(r) for r in q['rects']]
    if pick is not None:
        rects = [rects[i] for i in pick]
    last = rects[-1]
    H = last['h']
    # 그 시험에서 실제로 쓰인 가장 아래 값을 한계로 삼는다.
    # 이 값은 꼬리말(쪽번호·저작권)을 이미 걸러낸 뒤의 것이라 안전하다.
    limit = max((r['t1'] for x in e['questions'] for r in x['rects']), default=H * 0.85)
    for x in e['questions']:
        if x['num'] == num:
            continue
        for r in x['rects']:
            if r['page'] == last['page'] and r['col'] == last['col'] and r['t0'] >= last['t1'] - 2:
                limit = min(limit, r['t0'] - 8)
    last['t1'] = grow if grow else max(last['t1'], limit)
    if up:
        rects[0]['t0'] = max(0.0, rects[0]['t0'] - up)

    # render.py 의 방식 그대로: 쪽을 한 번 그려 놓고 잘라 낸다
    outs = []
    for r in rects:
        pg = doc[r['page']]
        bmp = pg.render(scale=render.SCALE).to_pil()
        s = render.SCALE
        box = (int(r['x0'] * s), int(r['t0'] * s), int(r['x1'] * s), int(r['t1'] * s))
        box = (max(0, box[0]), max(0, box[1]),
               min(bmp.width, box[2]), min(bmp.height, box[3]))
        piece = bmp.crop(box)
        piece = render.trim(piece)
        if piece is not None and piece.height >= 12:
            outs.append(piece)          # 빈 조각은 버린다

    if not outs:
        raise SystemExit('남는 그림이 없습니다')
    out = render.stack(outs) if len(outs) > 1 else outs[0]
    out.save(outp)
    print('%s  %s %d번 → %s  (%dx%d)' % (key, e['name'], num, outp, out.width, out.height))


if __name__ == '__main__':
    main()
