# -*- coding: utf-8 -*-
"""잘린 문항 여러 개를 한꺼번에 다시 자른다.

recrop.py 와 같은 원리지만, 쪽을 한 번만 그려 놓고 여러 문항을 잘라 내므로 훨씬 빠르다.

  · 마지막 조각의 아래끝을 «그 시험이 실제로 쓴 가장 아래»까지 늘린다
    (그 값은 꼬리말을 이미 걸러낸 뒤의 것이라 안전하다)
  · 같은 칸에 다음 문항이 있으면 그 앞까지만 늘린다
  · 늘린 뒤 픽셀을 보고 빈 곳을 다시 잘라 내므로 여백이 늘지 않는다

사용: python3 recrop_batch.py <할일.json> <내보낼폴더>
      할일.json = [{"key":..., "exam":0, "num":13, "path":"go3/000_13.png"}, ...]
"""
import sys, os, json, subprocess, collections
import pypdfium2 as pdfium
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render

HERE = os.path.dirname(os.path.abspath(__file__))
NEWQ = '/tmp/qb'


def load_q(key):
    p = os.path.join(HERE, 'questions_%s.json' % key)
    if os.path.exists(p):
        return json.load(open(p, encoding='utf-8'))
    p = os.path.join(NEWQ, key, 'q.json')
    if os.path.exists(p):
        return json.load(open(p, encoding='utf-8'))
    return None


def pdf_for(key, cache={}):
    if key in cache:
        return cache[key]
    names = {}
    for fn in ('files.txt', '새시험목록.txt'):
        p = os.path.join(HERE, fn)
        if not os.path.exists(p):
            continue
        for line in open(p, encoding='utf-8'):
            line = line.strip()
            if line:
                parts = line.split('|')
                names[parts[0]] = parts[1]
    out = subprocess.run(['bash', os.path.join(HERE, 'findpdf.sh'), names[key]],
                         capture_output=True, text=True)
    cache[key] = out.stdout.strip()
    return cache[key]


def main():
    jobs = json.load(open(sys.argv[1], encoding='utf-8'))
    outdir = sys.argv[2]
    os.makedirs(outdir, exist_ok=True)

    bykey = collections.defaultdict(list)
    for j in jobs:
        bykey[j['key']].append(j)

    done = fail = 0
    for key, js in bykey.items():
        Q = load_q(key)
        if Q is None:
            print('  문항 정보 없음:', key); fail += len(js); continue
        doc = pdfium.PdfDocument(pdf_for(key))

        # 문항마다 늘린 rect 를 미리 계산해 «쪽별»로 모은다
        want = collections.defaultdict(list)
        plans = {}
        for j in js:
            e = Q['exams'][j['exam']]
            q = next((x for x in e['questions'] if x['num'] == j['num']), None)
            if not q:
                fail += 1; continue
            rects = [dict(r) for r in q['rects']]
            last = rects[-1]
            limit = max((r['t1'] for x in e['questions'] for r in x['rects']),
                        default=last['h'] * 0.85)
            for x in e['questions']:
                if x['num'] == j['num']:
                    continue
                for r in x['rects']:
                    if (r['page'] == last['page'] and r['col'] == last['col']
                            and r['t0'] >= last['t1'] - 2):
                        limit = min(limit, r['t0'] - 8)
            last['t1'] = max(last['t1'], limit)

            # 위쪽도 늘린다 — 분수처럼 키 큰 식이나 그림이 문항 번호보다 위로 솟는 경우.
            # 같은 칸의 앞 문항 아래끝과 칸 맨 위를 넘지 않는 선에서만 올린다.
            first = rects[0]
            same = [r for x in e['questions'] for r in x['rects']
                    if r['page'] == first['page'] and r['col'] == first['col']]
            floor = min((r['t0'] for r in same), default=first['t0'])
            prev = [r['t1'] for x in e['questions'] for r in x['rects']
                    if r['page'] == first['page'] and r['col'] == first['col']
                    and r['t1'] <= first['t0'] + 2 and x['num'] != j['num']]
            allowed = max([floor] + prev)
            if allowed < first['t0']:
                first['t0'] = allowed

            plans[j['path']] = rects
            for ri, r in enumerate(rects):
                want[r['page']].append((j['path'], ri, r))

        pieces = {}
        for pno in sorted(want):
            pg = doc[pno]
            big = pg.render(scale=render.SCALE).to_pil().convert('L')
            for path, ri, r in want[pno]:
                box = (max(0, int(r['x0'] * render.SCALE)), max(0, int(r['t0'] * render.SCALE)),
                       min(big.width, int(r['x1'] * render.SCALE)),
                       min(big.height, int(r['t1'] * render.SCALE)))
                if box[2] - box[0] < 10 or box[3] - box[1] < 10:
                    continue
                pieces[(path, ri)] = render.trim(big.crop(box))
            pg.close(); del big

        for path, rects in plans.items():
            parts = [pieces.get((path, ri)) for ri in range(len(rects))]
            parts = [p for p in parts if p is not None and p.height >= 12]
            img = render.stack(parts)
            if img is None or img.height < 24:
                print('  못 만듦:', path); fail += 1; continue
            dst = os.path.join(outdir, path.replace('/', '__'))
            img.save(dst, optimize=True)
            done += 1
        doc.close()
        print('  %-10s %3d개' % (key, len(js)), flush=True)

    print()
    print('다시 자름 %d개 · 실패 %d개' % (done, fail))


if __name__ == '__main__':
    main()
