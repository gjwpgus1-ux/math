# -*- coding: utf-8 -*-
"""문항별 '비슷한 문항' 후보를 미리 계산해 data/sim.js 로 저장한다.

브라우저에서 5,390문항을 매번 비교하면 느리므로, 글자 유사도가 높은 후보만
미리 추려 둔다. 과목·배점·문항번호 같은 조건은 색인에 이미 있으므로
브라우저에서 그때그때 가중치를 바꿔 다시 정렬할 수 있다.

유사도: 한글 문장의 문자 3-gram TF-IDF 코사인.
        (수식은 색인에 없으므로 문장 표현이 비슷한 문항이 걸린다)

사용: python3 build_sim.py <앱폴더> [후보수]
"""
import sys, os, json, math, collections

TOPK_DEFAULT = 24
GRAM = 3
MAX_DF_RATIO = 0.06     # 너무 흔한 조각(상투구)은 변별력이 없어 제외


def grams(s, n=GRAM):
    return [s[i:i+n] for i in range(max(0, len(s)-n+1))]


def main():
    app = sys.argv[1]
    topk = int(sys.argv[2]) if len(sys.argv) > 2 else TOPK_DEFAULT
    raw = open(os.path.join(app, 'data', 'index.js'), encoding='utf-8').read()
    D = json.loads(raw[len('window.QDATA='):-1])
    IT = D['items']
    N = len(IT)

    df = collections.Counter()
    docs = []
    for it in IT:
        g = set(grams(it[5]))
        docs.append(g)
        df.update(g)

    limit = N * MAX_DF_RATIO
    idf = {t: math.log(N / (1.0 + c)) for t, c in df.items() if c <= limit and c >= 2}

    vecs = []
    for g in docs:
        v = {t: idf[t] for t in g if t in idf}
        nrm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        vecs.append({t: x / nrm for t, x in v.items()})

    inv = collections.defaultdict(list)
    for i, v in enumerate(vecs):
        for t in v:
            inv[t].append(i)

    out = []
    for i in range(N):
        sc = collections.defaultdict(float)
        for t, x in vecs[i].items():
            vj = inv[t]
            for j in vj:
                if j != i:
                    sc[j] += x * vecs[j][t]
        best = sorted(sc.items(), key=lambda z: -z[1])[:topk]
        out.append([[j, int(round(s * 1000))] for j, s in best if s > 0.02])
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
