# -*- coding: utf-8 -*-
"""스캔 페이지에서 찾은 문항 시작점을 읽기 순서대로 1번부터 번호 매겨 조립한다.

번호를 눈으로 읽을 수 없으므로 '왼쪽 단 → 오른쪽 단, 앞쪽 → 뒤쪽 페이지' 순서로
차례대로 매긴다. 시험당 검출 개수가 예상 문항 수와 정확히 일치할 때만 진행한다.

사용: python3 scan_assemble.py <in.jsonl> <out.json> <표시이름> <문항수>
"""
import sys, json


def main():
    inp, outp, label, nq = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
    rows = [json.loads(l) for l in open(inp, encoding='utf-8')]
    rows.sort(key=lambda r: r['page'])

    secs = []
    for r in rows:
        if secs and secs[-1]['name'] == r['banner']:
            secs[-1]['pages'].append(r)
        else:
            secs.append(dict(name=r['banner'], pages=[r]))

    out = dict(file=label, exams=[])
    for sec in secs:
        units = []
        for p in sec['pages']:
            for ci in range(len(p.get('lines', []))):
                units.append((p, ci))
        starts = [(p, ci, ln) for p, ci in units
                  for ln in p['lines'][ci] if ln['n'] == -1]
        if len(starts) != nq:
            print('  [경고] %s: 검출 %d개 (예상 %d개) — 건너뜀'
                  % (sec['name'], len(starts), nq))
            continue

        qs, k = [], 0
        for p, ci in units:
            col = p['lines'][ci]
            anc = [ln for ln in col if ln['n'] == -1]
            lead = [ln for ln in col if ln['n'] is None]
            if lead and qs:
                first = anc[0]['t'] if anc else p['cbot']
                qs[-1]['rects'].append(dict(page=p['page'], col=ci,
                                            t0=p['ctop'], t1=round(first - 6, 1),
                                            x0=p['cols'][ci][0], x1=p['cols'][ci][1],
                                            w=p['w'], h=p['h']))
            boxes = [ln for ln in col if ln['n'] == -2]
            for i, ln in enumerate(anc):
                k += 1
                # 다음 문항의 분수·지수가 번호보다 위로 올라오므로 넉넉히 띄어서 끊는다
                t1 = anc[i + 1]['t'] - 14 if i + 1 < len(anc) else p['cbot']
                # 다음 문항 전에 '단답형' 같은 안내 상자가 끼어 있으면 그 위에서 끊는다.
                # 조건·보기 상자는 문항의 일부이므로 잘라내면 안 된다 → 폭으로 구별한다.
                for bx in boxes:
                    if not (ln['t'] < bx['t'] < t1):
                        continue
                    if bx.get('bw', 1.0) >= 0.5:
                        continue                       # 단을 거의 채우는 상자 = 조건/보기
                    nxt = anc[i + 1]['t'] if i + 1 < len(anc) else None
                    if nxt is not None and nxt - bx['b'] > 30:
                        continue                       # 뒤에 문항이 바로 오지 않으면 안내가 아님
                    t1 = min(t1, bx['t'] - 6)
                qs.append(dict(num=k, text='',
                               rects=[dict(page=p['page'], col=ci,
                                           t0=round(ln['t'] - 6, 1), t1=round(t1, 1),
                                           x0=p['cols'][ci][0], x1=p['cols'][ci][1],
                                           w=p['w'], h=p['h'])]))
        name = sec['name']
        year = '20' + name[:2] if name[:2].isdigit() else ''
        rnd = '수능' if '수능' in name else ''
        subj = '가형' if '가형' in name else ('나형' if '나형' in name else '')
        out['exams'].append(dict(name=name, year=year, round=rnd, subject=subj,
                                 pages=[p['page'] for p in sec['pages']],
                                 scan=0, questions=qs))
        print('  %s: %d문항' % (name, len(qs)))

    json.dump(out, open(outp, 'w', encoding='utf-8'), ensure_ascii=False)


if __name__ == '__main__':
    main()
