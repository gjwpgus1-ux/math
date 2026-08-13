# -*- coding: utf-8 -*-
"""standards.json → 앱이 읽는 data/std.js

싣는 것: 코드 · 과목 · 영역 · 성취기준 문장 · 자동 초안용 낱말
(해설과 고려 사항은 싣지 않는다)

사용: python3 build_std.py standards.json <앱폴더>
"""
import sys, os, json, re, collections

# 수능·모평·학평 출제 범위가 되는 과목만 싣는다.
# (기본수학·직무수학·경제수학·인공지능수학·수학과문화·실용통계·수학과제탐구는 출제된 적이 없다)
ORD = ['수학','공통수학1','공통수학2','대수','미적분Ⅰ','미적분Ⅱ','기하','확률과 통계']

# 성취기준 문장에 흔해서 변별력이 없는 말
STOP = set('''있다 있고 이해 이해한다 설명 문제 해결 알고 방법 활용 이용 탐구 성질 관계
개념 원리 의미 표현 해석 분석 조사 판단 계산 수행 인식 태도 필요성 유용성 다양 여러 가지
상황 실생활 경우 사이 내용 결과 과정 자신 스스로 서로 함께 대한 대해 대하여 통하여 통해
관련된 관련 위해 위하여 따라 각각 또는 만들 만들고 그릴 그리고 나타낼 나타내고 구하
간단 수학적 현상 공학 도구 데이터 자료 설명한다 이해하게 발표 반성 평가 산출물
직무 인공지능 경제 그래프'''.split())

# 어미·조사 떼기 (긴 것부터)
TAIL = re.compile(r'(으로써|하여|이며|이고|이다|에서|부터|까지|으로|한다|된다|하고|들|을|를|이|가|은|는|의|에|와|과|로|한|할|함|임)$')


def words(s):
    out = []
    for w in re.findall(r'[가-힣]{2,}', s):
        w2 = TAIL.sub('', w)
        w2 = TAIL.sub('', w2)          # '나타낸다' → '나타내' 처럼 두 겹인 경우
        if len(w2) >= 2 and w2 not in STOP and w not in STOP:
            out.append(w2)
    return out


def main():
    src = sys.argv[1]
    app = sys.argv[2]
    D = json.load(open(src, encoding='utf-8'))
    R = [r for r in D['성취기준'] if r['학교급'] != '초등학교' and r['과목'] in ORD]
    AR = {(a['과목'], a['영역번호']): a for a in D['영역']}

    subs = [s for s in ORD if any(r['과목'] == s for r in R)]
    si = {s: i for i, s in enumerate(subs)}
    lv = {}
    for r in R: lv[r['과목']] = r['학교급']

    # 흔한 낱말은 초안에 도움이 안 되므로 제외 (문서 빈도 기준)
    raw, nsent = {}, {}
    for r in R:
        a = AR.get((r['과목'], r['영역번호']), {})
        ws = words(r['성취기준'])
        nsent[r['코드']] = len(ws)
        for t in re.split(r'[,·]', a.get('용어와기호', '')):
            ws += words(t)
        raw[r['코드']] = ws
    df = collections.Counter()
    for ws in raw.values(): df.update(set(ws))
    limit = max(6, len(R) // 12)

    items = []
    for r in sorted(R, key=lambda x: (si[x['과목']], x['코드'])):
        kw, seen, ns = [], set(), 0
        for idx, w in enumerate(raw[r['코드']]):
            if w in seen or df[w] > limit: continue
            seen.add(w); kw.append(w)
            if idx < nsent[r['코드']]: ns = len(kw)
        kw = kw[:14]
        # ns = 앞에서 몇 개가 «성취기준 문장»에서 나온 낱말인지 (뒤는 영역 용어)
        items.append([r['코드'], si[r['과목']], r['영역명'], r['성취기준'], kw, min(ns, len(kw))])

    out = {'subjects': [[s, lv[s]] for s in subs], 'items': items}
    path = os.path.join(app, 'data', 'std.js')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('window.QSTD=')
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';')
    n0 = sum(1 for it in items if not it[4])
    print('성취기준 %d개 · 과목 %d개 · %dKB · 낱말 없는 항목 %d개'
          % (len(items), len(subs), os.path.getsize(path) // 1024, n0))
    for it in items[:3] + items[-2:]:
        print('  %-12s %s' % (it[0], ', '.join(it[4][:8])))


if __name__ == '__main__':
    main()
