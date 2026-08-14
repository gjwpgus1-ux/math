# -*- coding: utf-8 -*-
"""문항마다 «수식이 살아 있는 글»을 만든다.

지금 색인에 들어 있는 글은 숫자·한글·영소문자만 남긴 것이라
  x^2-4x-3  →  2  43
처럼 수식이 통째로 사라진다. 이 도구는 같은 문항 자리에서 글자를 다시 읽어
formula.py 로 위·아래첨자와 수학기호를 되살린 글을 따로 만들어 둔다.

그림은 손대지 않는다. 오직 검색용 글만 만든다.

사용: python3 build_formula.py <questions.json> <pdf> <out.json>
"""
import sys, json, statistics
import pypdfium2 as pdfium
import layout, formula


def page_chars(doc, cache, pi):
    # pypdfium2 는 한 번 연 쪽을 계속 붙들고 있어, 다 쓴 쪽은 바로 닫아 준다.
    # 닫지 않으면 900쪽짜리 합본에서 메모리가 바닥난다.
    if pi not in cache:
        pg = doc[pi]
        chars, W, H = layout.get_chars(pg)
        pg.close()
        cache[pi] = (chars, W, H)
    return cache[pi]


def rect_text(doc, cache, r):
    """직사각형 하나 안의 글자를 수식이 살아 있는 글로."""
    chars, W, H = page_chars(doc, cache, r['page'])
    sx = W / r['w'] if r.get('w') else 1.0
    sy = H / r['h'] if r.get('h') else 1.0
    x0, x1 = r['x0'] * sx, r['x1'] * sx
    t0, t1 = r['t0'] * sy, r['t1'] * sy
    sel = [c for c in chars
           if x0 - 4 <= (c[1] + c[3]) / 2 <= x1 + 4 and t0 - 3 <= c[2] < t1]
    if not sel:
        return ''
    lines = layout.make_lines(sel)
    if not lines:
        return ''
    hs = [max(c[4] for c in ln) - min(c[2] for c in ln) for ln in lines]
    lines = layout.merge_overlapping(lines, statistics.median(hs) or 10)
    lines.sort(key=lambda ln: min(c[2] for c in ln))
    return ' '.join(formula.build(ln) for ln in lines)


def main():
    qjson, pdf, out = sys.argv[1], sys.argv[2], sys.argv[3]
    D = json.load(open(qjson, encoding='utf-8'))
    res, done = {}, 0
    for ex in D['exams']:
        if ex.get('scan'):
            continue
        # 시험마다 파일을 새로 열고 닫는다. 한 번 열어 둔 채 900쪽을 훑으면
        # 쓰고 버린 쪽이 쌓여 메모리가 바닥난다.
        doc = pdfium.PdfDocument(pdf)
        cache = {}
        cur = {}
        for q in ex['questions']:
            t = ' '.join(rect_text(doc, cache, r) for r in q['rects'])
            t = ' '.join(t.split())
            if t:
                cur[str(q['num'])] = t
            done += 1
        res[ex['name']] = cur
        cache.clear()
        doc.close()
        print('  %-24s %3d문항' % (ex['name'], len(cur)), flush=True)
    json.dump(res, open(out, 'w', encoding='utf-8'),
              ensure_ascii=False, separators=(',', ':'))
    print('시험 %d개 · 문항 %d개 → %s' % (len(res), done, out))


if __name__ == '__main__':
    main()
