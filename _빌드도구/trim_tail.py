# -*- coding: utf-8 -*-
"""문항 그림 꼬리를 잘라낸다.

단 마지막에 놓인 문항(30번·22번이 많다)은 글이 끝난 뒤에도 단 아래까지
잘려 나와, 빈칸이 1,000px 넘게 붙고 그 끝에 다음 구역 표지(「단답형」 상자)나
쪽 바닥 조각이 딸려 들어왔다. 카드가 가로에 맞춰 줄이니 문제 글씨가
깨알만 해져서 「문제 잘림」 으로 제보가 들어왔다.

무엇을 버리는가
  ① 글이 끝난 뒤의 빈칸
  ② 글과 25px 넘게 떨어진 채 아래에 남은 «낮은» 덩어리
     (「단답형」 표지 상자, 쪽 바닥 상자의 윗선 따위)

무엇을 지키는가
  - 세로로 길게 뻗은 줄(단 경계선·상자 옆선)은 글로 세지 않는다.
    이것을 글로 세면 «빈칸이 없다» 고 잘못 보게 된다.
  - 버릴 덩어리는 220px 아래이고 그림 높이의 4분의 1을 넘지 않아야 한다.
    <보기> 상자처럼 문항의 일부가 통째로 날아가는 일을 막는 빗장이다.
  - 자르고 나면 반드시 글이 남아야 한다. 아니면 손대지 않는다.

쓰는 법
    python3 trim_tail.py --dry      # 몇 개가 걸리는지만 본다
    python3 trim_tail.py            # 실제로 자르고 index.js 높이를 고친다
"""
import os, sys, json, csv, collections
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
IMG = os.path.join(APP, 'img')
IDX = os.path.join(APP, 'data', 'index.js')

INK = 170          # 이보다 어두우면 잉크
ROW = 0            # 잉크가 한 점이라도 있으면 «내용 있는 줄»
                   # (6 으로 두었더니 빗금·원호처럼 얇은 그림 줄이 빈칸으로 보여
                   #  글 아래에 있던 도형이 통째로 잘려 나갔다. 0 이 안전하다.)
GAP = 25           # 글과 이만큼 떨어져 있으면 딴 덩어리
BIG = 250          # 이만큼 넓은 빈칸이면 그 아래는 통째로 군더더기
BLK = 130          # 버릴 덩어리는 이보다 낮아야 한다
RULE = 0.25        # 덩어리 안에 가로로 이만큼 이어진 줄이 있어야 «상자»로 본다
DENS = 0.15        # 그리고 속이 비어 있어야 한다. 새까맣게 칠한 덩어리는 그림이다
                   # (2022년 3월 고3 30번의 «쌓아 놓은 원판» 그림이 그랬다)
PAD = 12           # 자른 뒤 아래에 남길 여백
MIN = 300          # 이만큼은 버려야 손을 댄다 (자잘한 여백은 그냥 둔다)


def longest_run(row):
    """한 줄에서 잉크가 가로로 가장 길게 이어진 길이."""
    best = cur = 0
    for v in row:
        cur = cur + 1 if v else 0
        if cur > best:
            best = cur
    return best


def rows_of(a):
    """글이 있는 줄 표. 세로로 길게 뻗은 줄은 글로 세지 않는다."""
    ink = a < INK
    H, W = ink.shape
    vert = ink.sum(0) > 0.6 * H
    ink2 = ink.copy()
    ink2[:, vert] = False
    return ink2.sum(1) > ROW, ink2, W, H


def gaps_of(on):
    """(시작, 끝, 길이) 꼴로 빈 구간을 모은다."""
    out, run = [], None
    for i, v in enumerate(on):
        if not v:
            run = i if run is None else run
        elif run is not None:
            out.append((run, i - 1, i - run)); run = None
    if run is not None:
        out.append((run, len(on) - 1, len(on) - run))
    return out


def cut_at(path):
    """(자를 높이, 까닭) 을 돌려준다. 손댈 것이 없으면 None."""
    a = np.array(Image.open(path).convert('L'))
    on, ink2, W, H = rows_of(a)
    idx = np.where(on)[0]
    if len(idx) < 3:
        return None
    gs = gaps_of(on)
    body_end = int(idx[-1])          # 글이 끝난 곳
    dropped = 0                      # 걷어낸 덩어리 수

    # ② 글과 뚝 떨어진 아래 덩어리를 뒤에서부터 걷어낸다.
    #    버릴 것은 «상자» 여야 한다 — 가로로 길게 이어진 줄이 있는 것.
    #    ①②③④⑤ 보기 줄도 글과 떨어져 있지만 이어진 줄이 없어 살아남는다.
    #    <조건> 상자는 이어진 줄이 있지만 130px 보다 높아 살아남는다.
    for _ in range(3):
        big = [g for g in gs if g[2] >= GAP and g[0] > idx[0] and g[1] < body_end]
        if not big:
            break
        g = big[-1]
        tall = body_end - g[1]
        blk = ink2[g[1] + 1:body_end + 1]
        boxy = (len(blk) and max(longest_run(r) for r in blk) >= RULE * W
                and blk.mean() <= DENS)
        wide = g[2] >= BIG           # 빈칸이 아주 넓으면 그 아래는 쪽 바닥 조각이다
        if tall <= BLK and tall <= H * 0.25 and (boxy or wide):
            body_end = g[0] - 1
            dropped += 1
            while body_end > 0 and not on[body_end]:
                body_end -= 1
        else:
            break

    keep = min(H, body_end + 1 + PAD)
    # 자르고도 글이 남아야 한다
    if not on[:keep].any():
        return None
    if dropped:
        return keep, '조각'
    # 딸려 온 덩어리가 없다면, 여백이 많이 남을 때만 손을 댄다.
    # 자잘한 여백까지 건드리면 5,800장이 통째로 바뀌어 되돌리기가 어렵다.
    if H - keep < MIN:
        return None
    return keep, '여백'


def main():
    dry = '--dry' in sys.argv
    src = open(IDX, encoding='utf-8').read()
    D = json.loads(src[src.index('=') + 1:].rstrip().rstrip(';'))
    EX, IT = D['exams'], D['items']

    hits = []
    for it in IT:
        p = os.path.join(IMG, it[2].replace('/', os.sep))
        if not os.path.exists(p):
            continue
        try:
            r = cut_at(p)
        except Exception as e:
            print('  ! 못 읽음', it[2], e); continue
        if r is None:
            continue
        k, why = r
        hits.append((it, k, it[4], why))

    print('꼬리를 자를 문항 %d / %d' % (len(hits), len(IT)))
    print('까닭별', collections.Counter(h[3] for h in hits).most_common())
    print('번호별', collections.Counter(h[0][1] for h in hits).most_common(10))
    with open(os.path.join(HERE, '꼬리자른문항.csv'), 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['그림', '시험', '번호', '까닭', '전 높이', '후 높이', '버린 세로'])
        for it, k, H, why in hits:
            w.writerow([it[2], EX[it[0]]['n'], it[1], why, H, k, H - k])
    if dry:
        return

    for it, k, H, why in hits:
        p = os.path.join(IMG, it[2].replace('/', os.sep))
        im = Image.open(p)
        im.crop((0, 0, im.width, k)).save(p)
        it[4] = k
    open(IDX, 'w', encoding='utf-8').write(
        'window.QDATA=' + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + ';')
    print('그림 %d개를 자르고 index.js 높이를 고쳤습니다.' % len(hits))


if __name__ == '__main__':
    main()
