# -*- coding: utf-8 -*-
"""3단계: 확정된 문항 영역을 PNG 이미지로 잘라 저장한다.

- 페이지는 한 번만 렌더링하고 그 위에서 여러 문항을 잘라낸다
- 아래쪽 빈 공간은 실제 픽셀을 보고 잘라내므로 문항 길이에 딱 맞는다
- 단이나 페이지를 넘어간 문항은 조각들을 세로로 이어 붙인다

사용: python3 render.py <pdf> <questions.json> <img_dir> <시험시작> <시험끝>
"""
import sys, os, json
import numpy as np
import pypdfium2 as pdfium
from PIL import Image

DPI = 180
SCALE = DPI / 72.0
PAD = 10           # 잘라낸 뒤 남길 여백(px)
WHITE = 247        # 이 값보다 밝으면 빈 픽셀로 본다
RULE = 0.80        # 이 비율 이상 이어지면 인쇄용 괘선으로 본다


def trim(img):
    """빈 여백을 잘라낸다. 단 사이 세로 괘선은 내용으로 치지 않고 함께 제거한다."""
    a = np.asarray(img.convert('L'))
    if a.size == 0:
        return None
    dark = a < WHITE
    h, w = dark.shape

    # 페이지 전체를 관통하는 세로/가로 괘선 찾기
    vrule = dark.sum(axis=0) > h * RULE
    hrule = dark.sum(axis=1) > w * RULE
    content = dark.copy()
    content[:, vrule] = False
    content[hrule, :] = False

    rows = np.flatnonzero(content.any(axis=1))
    cols = np.flatnonzero(content.any(axis=0))
    if rows.size == 0 or cols.size == 0:
        return None
    top = max(0, rows[0] - PAD)
    bot = min(h, rows[-1] + 1 + PAD)
    left = max(0, cols[0] - PAD)
    right = min(w, cols[-1] + 1 + PAD)

    # 잘린 가장자리에 괘선만 남았다면 그것도 밀어낸다
    while left < right and vrule[left]:
        left += 1
    while right > left and vrule[right - 1]:
        right -= 1
    return img.crop((int(left), int(top), int(right), int(bot)))


def stack(imgs, gap=14):
    imgs = [i for i in imgs if i is not None]
    if not imgs:
        return None
    if len(imgs) == 1:
        return imgs[0]
    w = max(i.width for i in imgs)
    h = sum(i.height for i in imgs) + gap * (len(imgs) - 1)
    out = Image.new('L', (w, h), 255)
    y = 0
    for i in imgs:
        out.paste(i.convert('L'), (0, y))
        y += i.height + gap
    return out


def main():
    pdf, qjson, imgdir, a, b = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
    D = json.load(open(qjson, encoding='utf-8'))
    exams = D['exams'][a:b]
    doc = pdfium.PdfDocument(pdf)
    os.makedirs(imgdir, exist_ok=True)

    # 필요한 페이지 목록
    need = {}
    for ei, e in enumerate(exams, start=a):
        for qi, q in enumerate(e['questions']):
            for ri, r in enumerate(q['rects']):
                need.setdefault(r['page'], []).append((ei, qi, ri, r))

    pieces = {}
    for pno in sorted(need):
        pg = doc[pno]
        big = pg.render(scale=SCALE).to_pil().convert('L')
        for ei, qi, ri, r in need[pno]:
            box = (max(0, int(r['x0'] * SCALE)), max(0, int(r['t0'] * SCALE)),
                   min(big.width, int(r['x1'] * SCALE)), min(big.height, int(r['t1'] * SCALE)))
            if box[2] - box[0] < 10 or box[3] - box[1] < 10:
                continue
            pieces[(ei, qi, ri)] = trim(big.crop(box))
        pg.close()
        del big

    out = []
    for ei, e in enumerate(exams, start=a):
        for qi, q in enumerate(e['questions']):
            parts = [pieces.get((ei, qi, ri)) for ri in range(len(q['rects']))]
            img = stack(parts)
            if img is None or img.height < 30:
                continue
            name = '%03d_%02d.png' % (ei, q['num'])
            img.save(os.path.join(imgdir, name), optimize=True)
            out.append(dict(exam=ei, num=q['num'], img=name,
                            w=img.width, h=img.height))
    print(json.dumps(out, ensure_ascii=False))


if __name__ == '__main__':
    main()
