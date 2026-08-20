# -*- coding: utf-8 -*-
"""기울어진 스캔 PDF 를 똑바로 세워 새 PDF 로 만든다.

스캔한 시험지는 쪽마다 조금씩 삐뚤어져 있다. 0.6도만 기울어도 두 단 사이
세로 괘선이 여러 칸에 흩어져, 픽셀로 문항을 나누는 도구가 괘선을 못 찾는다.

  ① 두 단 사이 세로 괘선이 y 에 따라 얼마나 밀리는지 재어 기울기를 구한다
  ② 그만큼 되돌려 세운다
  ③ 둘레 빈 곳을 잘라 내고 새 PDF 로 저장한다

사용: python3 deskew_pdf.py <원본.pdf> <새.pdf> [시작쪽] [끝쪽]
      (쪽 번호는 0부터, 끝쪽은 포함하지 않는다)
"""
import sys, math
import numpy as np
import pypdfium2 as pdfium
from PIL import Image

# 문항을 픽셀로 나누는 도구(scan_extract)가 200dpi 로 다시 그리므로
# 여기서도 200dpi 로 맞춘다. 해상도가 다르면 다시 그릴 때 가는 괘선이
# 흐려져 끊기고, 그러면 단을 못 나눈다.
DPI = 200
DARK = 200
PAD = 24                 # 잘라 낼 때 남길 둘레 여백(픽셀)
MAX_TILT = 3.0           # 이보다 크게 나오면 잘못 잰 것으로 본다


def tilt(a):
    """가운데 세로 괘선을 따라가며 기울기(도)를 잰다. 못 재면 None."""
    ph, pw = a.shape
    ink = a < DARK
    lo, hi = int(pw * 0.30), int(pw * 0.70)
    ys, xs = [], []
    for y in range(int(ph * 0.20), int(ph * 0.90), 8):
        idx = np.flatnonzero(ink[y, lo:hi])
        if idx.size == 0:
            continue
        runs, s, p = [], idx[0], idx[0]
        for v in idx[1:]:
            if v - p > 1:
                runs.append((s, p)); s = v
            p = v
        runs.append((s, p))
        thin = [r for r in runs if r[1] - r[0] <= 8]
        if len(thin) != 1:          # 괘선 하나만 또렷할 때만 쓴다
            continue
        ys.append(y); xs.append(lo + (thin[0][0] + thin[0][1]) / 2.0)
    if len(ys) < 30:
        return None
    ys = np.array(ys, float); xs = np.array(xs, float)
    for _ in range(3):              # 튀는 점을 서너 번 걷어 내며 직선을 맞춘다
        k, b = np.polyfit(ys, xs, 1)
        r = xs - (k * ys + b)
        s = r.std() or 1.0
        keep = np.abs(r) < 2.5 * s
        if keep.sum() < 20:
            break
        ys, xs = ys[keep], xs[keep]
    k, _ = np.polyfit(ys, xs, 1)
    deg = math.degrees(math.atan(k))
    return deg if abs(deg) <= MAX_TILT else None


def trim(im):
    a = np.asarray(im)
    ink = a < DARK
    rows = np.flatnonzero(ink.any(axis=1))
    cols = np.flatnonzero(ink.any(axis=0))
    if rows.size == 0 or cols.size == 0:
        return im
    t = max(0, rows[0] - PAD); b = min(a.shape[0], rows[-1] + PAD)
    l = max(0, cols[0] - PAD); r = min(a.shape[1], cols[-1] + PAD)
    return im.crop((l, t, r, b))


def main():
    src, dst = sys.argv[1], sys.argv[2]
    d = pdfium.PdfDocument(src)
    a0 = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    a1 = int(sys.argv[4]) if len(sys.argv) > 4 else len(d)

    out = []
    for pi in range(a0, min(a1, len(d))):
        pg = d[pi]
        im = pg.render(scale=DPI / 72.0).to_pil().convert('L')
        pg.close()
        deg = tilt(np.asarray(im))
        if deg:
            # 되돌려 세운다. 빈자리는 흰색으로 채운다.
            # rotate() 는 시계 반대로 도니, 잰 기울기의 반대만큼 돌려야 펴진다.
            im = im.rotate(-deg, resample=Image.BICUBIC, expand=True, fillcolor=255)
        out.append(trim(im))
        print('  %2d쪽  기울기 %-8s → %dx%d'
              % (pi, ('%+.2f도' % deg) if deg else '거의 없음', out[-1].width, out[-1].height),
              flush=True)
    d.close()

    if not out:
        print('할 것이 없습니다.'); return
    out[0].save(dst, save_all=True, append_images=out[1:],
                resolution=DPI, quality=92)
    import os
    print('\n%d쪽 → %s (%.1fMB)' % (len(out), dst, os.path.getsize(dst) / 1e6))


if __name__ == '__main__':
    main()
