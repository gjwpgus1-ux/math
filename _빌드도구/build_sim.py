# -*- coding: utf-8 -*-
"""문항별 '비슷한 문항' 후보를 미리 계산해 data/sim.js 로 저장한다.

브라우저에서 5,390문항을 매번 비교하면 느리므로, 글자 유사도가 높은 후보만
미리 추려 둔다. 과목·배점·문항번호 같은 조건은 색인에 이미 있으므로
브라우저에서 그때그때 가중치를 바꿔 다시 정렬할 수 있다.

유사도는 두 가지를 함께 본다.
  ① 문장 유사도 — 한글 문장의 문자 3-gram TF-IDF 코사인
  ② 출제의도 유사도 — 해설에 적힌 «[출제의도] …» 한 마디의 3-gram TF-IDF 코사인

문장이 달라도 같은 것을 묻는 문항은 ②로 걸린다. 반대로 ①은 표현이 닮은
문항을 찾아 준다. 둘은 겹치는 부분이 적어(4% 남짓) 함께 쓰면 서로를 메운다.

sim.js 한 줄은 [문항번호, 문장유사도, 출제의도유사도] 이고,
출제의도가 없거나 안 닮았으면 셋째 값은 빼서 파일을 줄인다.

사용: python3 build_sim.py <앱폴더> [후보수]
"""
import sys, os, json, math, collections

TOPK_DEFAULT = 24
GRAM = 3
MAX_DF_RATIO = 0.06     # 너무 흔한 조각(상투구)은 변별력이 없어 제외
INTENT_W = 0.60         # 후보를 «뽑을» 때 출제의도에 주는 무게
MIN_KEEP = 0.02
# 문장이 아주 닮은 문항이 출제의도 때문에 밀려나면 안 되므로 자리를 나눠 준다.
TEXT_SLOTS = 16         # 문장 유사도만 보고 반드시 남기는 자리
INT_SLOTS = 8           # 출제의도만 보고 챙기는 자리


def grams(s, n=GRAM):
    return [s[i:i+n] for i in range(max(0, len(s)-n+1))]


def tfidf(texts):
    """글월 목록 → 길이 1로 맞춘 TF-IDF 벡터 목록, 그리고 되짚기 표."""
    n = len(texts)
    df = collections.Counter()
    docs = []
    for s in texts:
        g = set(grams(s)) if s else set()
        docs.append(g)
        df.update(g)
    limit = n * MAX_DF_RATIO
    idf = {t: math.log(n / (1.0 + c)) for t, c in df.items() if 2 <= c <= limit}
    vecs = []
    for g in docs:
        v = {t: idf[t] for t in g if t in idf}
        nrm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        vecs.append({t: x / nrm for t, x in v.items()})
    inv = collections.defaultdict(list)
    for i, v in enumerate(vecs):
        for t in v:
            inv[t].append(i)
    return vecs, inv


def scores(i, vecs, inv):
    sc = collections.defaultdict(float)
    for t, x in vecs[i].items():
        for j in inv[t]:
            if j != i:
                sc[j] += x * vecs[j][t]
    return sc


def main():
    app = sys.argv[1]
    topk = int(sys.argv[2]) if len(sys.argv) > 2 else TOPK_DEFAULT
    raw = open(os.path.join(app, 'data', 'index.js'), encoding='utf-8').read()
    D = json.loads(raw[raw.index('{'):raw.rindex('}') + 1])
    IT = D['items']
    N = len(IT)

    # ── 출제의도 (있는 문항만) ──
    ip = os.path.join(os.path.dirname(os.path.abspath(__file__)), '출제의도.json')
    INT = {}
    if os.path.exists(ip):
        INT = json.loads(open(ip, encoding='utf-8').read().split('=', 1)[1].rstrip(';\n'))
    exams = D['exams']
    itxt = [INT.get('%s#%d' % (exams[it[0]]['n'], it[1]), '') for it in IT]
    print('출제의도가 있는 문항 %d / %d' % (sum(1 for s in itxt if s), N))

    tv, ti = tfidf([it[5] for it in IT])          # 문장
    iv, ii = tfidf(itxt)                          # 출제의도

    out = []
    for i in range(N):
        ts = scores(i, tv, ti)
        isc = scores(i, iv, ii) if itxt[i] else {}
        # ① 문장이 닮은 순서로 몇 자리, ② 출제의도가 닮은 순서로 몇 자리,
        # ③ 남은 자리는 둘을 합친 점수로 채운다
        pick = []
        seen = set()
        for src, k in ((ts, TEXT_SLOTS), (isc, INT_SLOTS)):
            for j, s in sorted(src.items(), key=lambda z: -z[1])[:k]:
                if s > MIN_KEEP and j not in seen:
                    seen.add(j); pick.append(j)
        rest = ((j, ts.get(j, 0.0) + INTENT_W * isc.get(j, 0.0))
                for j in set(ts) | set(isc) if j not in seen)
        for j, s in sorted(rest, key=lambda z: -z[1]):
            if len(pick) >= topk:
                break
            if s > MIN_KEEP:
                seen.add(j); pick.append(j)

        pick.sort(key=lambda j: -(ts.get(j, 0.0) + INTENT_W * isc.get(j, 0.0)))
        row = []
        for j in pick[:topk]:
            a = int(round(ts.get(j, 0.0) * 1000))
            b = int(round(isc.get(j, 0.0) * 1000))
            row.append([j, a, b] if b else [j, a])
        out.append(row)
        if (i + 1) % 500 == 0:
            print('  %d / %d' % (i + 1, N), flush=True)

    path = os.path.join(app, 'data', 'sim.js')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('window.QSIM=')
        json.dump(out, f, separators=(',', ':'))
        f.write(';')
    avg = sum(len(x) for x in out) / float(N)
    print('문항 %d개 · 후보 평균 %.1f개 · %dKB'
          % (N, avg, os.path.getsize(path) // 1024))


if __name__ == '__main__':
    main()
