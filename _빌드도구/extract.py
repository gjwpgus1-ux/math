# -*- coding: utf-8 -*-
"""1단계: PDF 페이지의 단 구조·줄·문항번호 후보를 JSONL로 뽑아낸다.
문항 경계 확정은 2단계(assemble.py)에서 시험 구간 전체를 보고 결정한다.
pypdfium2 의 페이지 캐시 누수를 피하려고 페이지 구간을 나눠 별도 프로세스로 실행한다.

사용: python3 extract.py <pdf> <start> <end> <out.jsonl>
"""
import sys, json
import pypdfium2 as pdfium
import layout


def page_record(pg, pi, force_split=None):
    chars, W, H = layout.get_chars(pg)
    rec = dict(page=pi, w=round(W, 1), h=round(H, 1),
               banner=layout.clean_text(layout.banner_text(chars)))
    lay = layout.analyse(chars, W, H, force_split=force_split)
    if lay is None:
        rec['scan'] = True
        return rec

    rec['split'] = round(lay['auto_split'], 1)
    rec['cols'] = [[round(x, 1) for x in c] for c in lay['cols']]
    rec['ctop'] = round(lay['content_top'], 1)
    rec['cbot'] = round(lay['content_bot'], 1)
    rec['medh'] = round(lay['med_h'], 2)
    rec['lines'] = []
    for ci, lines in enumerate(lay['lines_by_col']):
        # 페이지별 여백으로 미리 거르지 않는다. 걸러내기는 시험 구간 전체를
        # 보는 assemble 단계에서 해야 표지 페이지 등에 흔들리지 않는다.
        anchors = lay['cands_by_col'][ci]
        col = []
        for ln in lines:
            x0, top, x1, bot = layout.line_box(ln)
            hit = next(((n, c) for n, c in anchors
                        if top - 2 <= c[2] <= bot + 2 and x0 - 2 <= c[1] <= x1 + 2), None)
            col.append(dict(x=round(hit[1][1] if hit else x0, 1),
                            t=round(top, 1), b=round(bot, 1),
                            i=min(c[5] for c in ln),
                            n=hit[0] if hit else None,
                            s=layout.clean_text(layout.line_text(ln))))
        rec['lines'].append(col)
    return rec


def main():
    src, a, b, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
    smap = {}
    if len(sys.argv) > 5:
        smap = {int(k): v for k, v in json.load(open(sys.argv[5])).items()}
    doc = pdfium.PdfDocument(src)
    rows = []
    for pi in range(a, min(b, len(doc))):
        pg = doc[pi]
        rows.append(page_record(pg, pi, smap.get(pi)))
        pg.close()
    with open(out, 'a', encoding='utf-8') as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main()
