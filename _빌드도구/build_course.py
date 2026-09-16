# -*- coding: utf-8 -*-
"""문항마다 «어느 과목인가» 를 가려 data/course.js 로 낸다.

왜 필요한가
    색인에는 시험 단위 과목(공통·확통·미적·기하·가형·나형)만 있다.
    그런데 한 시험 안에 여러 과목이 섞여 있는 것이 3,460문항이나 된다.
      · 고2 3월제외 — 대수·미적분Ⅰ (옛 회차에는 확통도)
      · 고3·모평 공통 — 대수·미적분Ⅰ
      · 나형 — 대수·미적분Ⅰ·확통
      · 가형 — 대수·미적분Ⅰ·미적분Ⅱ·확통·기하
    그래서 「미적분Ⅱ만 보기」 같은 것이 안 된다.

어떻게 가리나
    ① 시험 범위로 먼저 가둔다. 이게 가장 중요하다.
       낱말만 보고 전체에 돌렸더니 고1 3월제외 문항 86개가 «미적분Ⅰ»로 갔다.
       원의 접선·넓이 같은 낱말이 걸린 탓이다. 고1에 미적분이 있을 리 없다.
    ② 갇힌 범위 안에서 해설의 «[출제의도] …» 한 마디를 낱말로 가른다.
    ③ 출제의도가 없으면 한글글·수식글로 같은 일을 한다.
    ④ 그래도 못 가린 것은 «과목_손입력.json» 에 눈으로 보고 적어 둔다.
       스캔본이라 글이 «의값은2점» 밖에 안 남은 문항이 여기 든다.

사용: python3 build_course.py            (만들어 저장)
      python3 build_course.py --dry      (저장하지 않고 세어만 봄)
      python3 build_course.py --show 가형 30   (그 갈래에서 30개를 뽑아 보여 줌)
"""
import sys, os, re, json, collections, random

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)

# 검색기 필터에 그대로 쓰는 이름이다. 차례도 이대로 보인다.
ORDER = ['중학교수학', '공통수학', '대수', '미적분Ⅰ', '미적분Ⅱ', '확통', '기하']

# 설문(교과목 고르기)에서 사람이 고른 값 → 여기 이름
FROM_SURVEY = {'중학교': '중학교수학', '고1': '공통수학', '대수': '대수',
               '미적분I': '미적분Ⅰ', '미적분II': '미적분Ⅱ',
               '확률과 통계': '확통', '기하': '기하'}


# ── 시험 범위 ────────────────────────────────────────────────
def scope_of(e):
    """이 시험에 나올 수 있는 과목만 추린다. 하나뿐이면 문항을 안 봐도 된다."""
    g, r, s = e['g'], e['r'], e['s']
    if g == '고1':
        # 고1 3월은 중학 범위, 그 뒤로는 공통수학1·2
        return ['중학교수학'] if r == '3월' else ['공통수학']
    if g == '고2' and s not in ('가형', '나형'):
        # 고2 3월은 아직 고1 범위
        if r == '3월':
            return ['공통수학']
        # 그 밖의 고2는 대수·미적분Ⅰ이 대부분이고, 옛 회차에는 확통도 있었다
        return ['대수', '미적분Ⅰ', '미적분Ⅱ', '확통']
    # 고2 가형·나형(2018~2019년)은 아래 가형·나형 칸에서 함께 본다.
    # 그 시절 고2 시험에는 집합·명제·함수(지금의 공통수학)가 그대로 나왔다.
    if s in ('확통',):
        return ['확통']
    if s in ('미적',):
        return ['미적분Ⅱ']
    if s in ('기하',):
        return ['기하']
    # 가형·나형에 «공통수학» 을 함께 두는 까닭 —
    # 2009 개정 시절(2014~2018학년도) 나형 범위인 «수학Ⅱ» 에는 집합과 명제,
    # 유리함수·무리함수·역함수가 들어 있었다. 지금 체계로는 공통수학이다.
    # 실제로 18학년도 6월 나형 12번은 «명제의 대우» 문항이다.
    # 낱말 표에서 공통수학을 맨 뒤에 두었으므로, 대수·미적분이 먼저 집어 간다.
    if s == '가형':
        return ['대수', '미적분Ⅰ', '미적분Ⅱ', '확통', '기하', '공통수학']
    if s == '나형':
        return ['대수', '미적분Ⅰ', '미적분Ⅱ', '확통', '공통수학']
    if s == '공통':
        return ['대수', '미적분Ⅰ']
    return list(ORDER)


# ── 낱말 표 ──────────────────────────────────────────────────
# 위에 있는 것부터 본다. 좁은 것을 먼저, 넓은 것을 나중에 둔다.
RULES = [
 ('기하', r'이차곡선|포물선|타원|쌍곡선|초점|주축|장축|단축|점근선'
          r'|벡터|내적|성분|공간도형|공간좌표|좌표공간|정사영|이면각|평면의방정식|구의방정식'),
 ('확통', r'순열|조합|중복|이항정리|이항분포|파스칼|확률|배반|여사건|조건부|독립시행'
          r'|기댓값|확률변수|확률분포|정규분포|표준정규|표본|신뢰구간|모평균|모비율'
          r'|통계|분할|경우의수|합의법칙|곱의법칙|같은것이있는'),
 ('미적분Ⅱ', r'수열의극한|급수|등비급수|매개변수|음함수|이계도함수|변곡점|치환적분|부분적분'
             r'|삼각함수의극한|지수함수의?미분|로그함수의?미분|합성함수의?미분|역함수의?미분'
             r'|몫의?미분|곱의?미분|여러가지미분|여러가지적분|입체도형의부피|곡선의길이'
             r'|자연로그|무리수e|지수함수와로그함수의미분|삼각함수의미분|극한값의계산'),
 ('미적분Ⅰ', r'함수의극한|함수의연속|좌극한|우극한|미분계수|도함수|접선|극댓값|극솟값|극대|극소'
             r'|증가와감소|속도|가속도|위치|부정적분|정적분|미분가능|평균변화율'
             r'|(곡선|적분).{0,12}넓이|넓이.{0,12}(곡선|적분)'
             r'|사잇값|롤의정리|평균값정리|다항함수의미분|다항함수의적분|미분법|적분법|미분|적분'),
 ('대수', r'지수|로그|거듭제곱근|제곱근|삼각함수|사인법칙|코사인법칙|호도법|일반각|부채꼴'
          r'|수열|등차|등비|귀납|시그마|수열의합|점화식'),
 ('공통수학', r'다항식|인수분해|나머지정리|항등식|복소수|허수|이차방정식|이차함수|판별식'
              r'|삼차방정식|사차방정식|연립|부등식|절댓값|행렬|근과계수'
              r'|직선의방정식|원의방정식|평행이동|대칭이동|내분|외분|자취'
              r'|집합의연산|부분집합|공집합|합집합|교집합|여집합|원소의개수'
              r'|명제|필요조건|충분조건|합성함수|역함수|유리함수|무리함수'),
]


# 출제의도가 없는 문항(스캔본·평가원)은 문제 글을 봐야 한다.
# 거기엔 «함수의 극한» 같은 말 대신 lim·∫·Σ 같은 기호가 그대로 있다.
# 그래서 기호까지 보는 표를 따로 둔다. 낱말 표가 먼저, 이것이 나중이다.
SIGNS = [
 ('기하', r'→⋅|⋅→|벡터|→=\(|정사영|이면각|좌표공간|공간좌표'
          r'|수선의발|삼수선|사면체|평면α|평면ABC|평면BCD|평면에수직|평면위에'),
 ('확통', r'P\(|E\(|V\(|\bC_|_\d+C_|_\d+P_|_\d+H_|σ|표준편차|정규분포|주사위|동전'
          r'|카드|뽑|나열|배열|경우의수|확률|_\d+[ΠH]_|Π_'),
 # 미적분 기호(lim·∫·′·변곡점·속력)와 초월함수(e·ln·sin…)가 한 문항에 함께 있으면
 # 다항함수 미적분이 아니라 미적분Ⅱ다. 가형에서 이 둘을 가르는 가장 든든한 표다.
 ('미적분Ⅱ', r'n→∞|Σ.{0,6}∞|∞\s*Σ|급수|매개변수|변곡점'
             r'|(?=.*(lim|∫|′|dy|dx|속력))(?=.*(e\^|ln|sin|cos|tan|log))'),
 ('미적분Ⅰ', r'lim|∫|′\(|f′|극댓값|극솟값|극값|접선|접할|속도|가속도|삼차함수|사차함수|도함수'
             r'|(곡선|∫).{0,40}넓이|넓이.{0,40}(곡선|∫)'
             # 평가원 문항은 출제의도가 없어 문제 글만 남는다. 거기 흔한 말들 —
             # 「실수 전체의 집합에서 연속」, 「서로 다른 세 실근」, 「증가하도록」
             r'|연속|실근|증가하도록|감소하도록|증가하는|감소하는'),
 ('대수', r'log|sin|cos|tan|θ|a_n|Σ|등차|등비|수열|외접원|내접원|사인법칙|코사인법칙'
          # 숫자에 붙은 지수(2^a·3^x)와 «제곱근» 은 지수·로그 단원의 표다.
          # x^2 처럼 «글자» 에 붙은 것은 어느 과목에나 있으므로 세지 않는다.
          r'|\^x|\d\^|\^\(?x|밑|거듭제곱근|제곱근'),
 ('공통수학', r'허수|i=√|판별식|인수분해|나머지|행렬|부분집합|∈|⊂|∅|명제|대우|역함수|합성함수'
              r'|유리함수|무리함수|이차함수|이차방정식|점근선|내분|외분|원의방정식'
              # 집합·함수 단원 — 「실수 전체의 집합」이라는 상투구에 걸리지 않게
              # «두 집합»·«전체집합»·n(A) 처럼 집합을 가리키는 꼴만 본다
              r'|두집합|전체집합|집합의연산|원소의합|n\(A|∘|f\^\(-1\)|f-1\('
              r'|f:X→|X에서X|일대일대응|정사각형|직사각형|정육면체|겉넓이'
              r'|서로수직|두직선|원x\^2|선분AB|자취'),
]


# 다항함수인가, 지수·로그·삼각함수인가 — 미적분Ⅰ과 Ⅱ를 가르는 마지막 잣대
# θ 도 넣는다 — 「부채꼴 넓이의 극한」처럼 삼각함수를 sin·cos 없이
# 각으로만 적은 문항이 미적분Ⅰ로 새어 나갔다.
TRANS = re.compile(r'e\^|ln|log|sin|cos|tan|sec|csc|cot|θ|\be\b')
# 「…을 계속하여 n번째 얻은 그림 R_n」 꼴은 등비급수 문항이다.
# 지금 체계로는 미적분Ⅱ 이지만 다항식만 나와 초월함수 표에 안 걸린다.
# 다항함수가 아니라는 표 — 근호·역함수·«정적분과 급수»(Σ 와 n→∞)
SERIES = re.compile(r'R_n|n번째얻은|계속하여n번째|그림R_\d'
                    r'|√|역함수|n→∞|Σ.{0,12}∞|∞.{0,12}Σ')


def refine(c, allow, fx):
    """미적분Ⅰ로 가린 것 가운데 초월함수가 든 것은 미적분Ⅱ로 옮긴다.

    출제의도는 «미분계수 계산하기» 처럼 무엇을 미분하는지까지는 말해 주지 않는다.
    그래서 f(x)=e^(3x-2) 의 f′(1) 을 묻는 가형 문항이 미적분Ⅰ로 갔다.
    다항함수 미적분이 아니면 미적분Ⅱ이므로, 문제 글에 e·ln·sin 이 있는지로 가른다.
    가형에서만 한다(«기하» 가 함께 열린 시험). 나형·고2에는 초월함수 미적분이
    아예 없어서 이 손질이 오히려 어긋난다."""
    if c == '미적분Ⅰ' and '기하' in allow and fx:
        t = re.sub(r'[\s_^]', '', fx.split('①')[0])
        if TRANS.search(t) or SERIES.search(t):
            return '미적분Ⅱ'
    return c


def guess(text, allow, signs=False):
    """낱말로 가린다. allow 안에 드는 것만 인정한다."""
    if not text:
        return None
    t = re.sub(r'\s', '', text)
    for name, pat in RULES:
        if name in allow and re.search(pat, t):
            return name
    if not signs:
        return None
    for name, pat in SIGNS:
        if name in allow and re.search(pat, t):
            return name
    return None


def load(path, head):
    s = open(path, encoding='utf-8').read()
    return json.loads(s.split('=', 1)[1].rstrip(';\n')) if head else \
           json.loads(s[s.index('{'):s.rindex('}') + 1])


def main():
    dry = '--dry' in sys.argv
    show = None
    if '--show' in sys.argv:
        k = sys.argv.index('--show')
        show = (sys.argv[k + 1], int(sys.argv[k + 2]) if len(sys.argv) > k + 2 else 20)

    D = load(os.path.join(APP, 'data', 'index.js'), False)
    EX, IT = D['exams'], D['items']
    INT = load(os.path.join(HERE, '출제의도.json'), True)
    # 낱말로는 끝내 못 가린 것을 눈으로 보고 적어 둔 표.
    # 스캔본이라 글이 «의값은2점» 밖에 안 남은 문항이 여기 든다.
    HAND = {}
    hp = os.path.join(HERE, '과목_손입력.json')
    if os.path.exists(hp):
        HAND = {k: v for k, v in json.load(open(hp, encoding='utf-8')).items()
                if not k.startswith('_')}

    out = {}
    stat = collections.defaultdict(collections.Counter)
    src = collections.Counter()
    miss = collections.Counter()
    samples = collections.defaultdict(list)

    for it in IT:
        e = EX[it[0]]
        allow = scope_of(e)
        why = ''
        if len(allow) == 1:                     # 시험만 보고 정해진다
            c, why = allow[0], '시험'
        else:
            intent = INT.get(e['n'] + '#' + str(it[1]))
            fx = (it[6] if len(it) > 6 else '') or it[5]
            c = guess(intent, allow)
            why = '출제의도'
            if not c:
                c = (guess(it[6] if len(it) > 6 else '', allow, True)
                     or guess(it[5], allow, True))
                why = '글'
            c = refine(c, allow, fx)
            if not c and it[2] in HAND:
                c, why = HAND[it[2]], '손입력'
            if not c:
                why = '못가림'
                miss[intent or '(출제의도 없음)'] += 1
        if c:
            out[it[2]] = c
            src[why] += 1
        stat[e['s'] or e['g']][c or '－'] += 1
        if show and (e['s'] == show[0] or e['g'] == show[0]):
            samples[c or '－'].append((e['n'], it[1], INT.get(e['n'] + '#' + str(it[1])) or it[5][:40]))

    tot = len(IT)
    print('문항 %d개 · 가린 것 %d개 (%.1f%%)' % (tot, len(out), 100 * len(out) / tot))
    print('  어떻게: ' + ' · '.join('%s %d' % (k, v) for k, v in src.most_common()))
    print()
    cols = ORDER + ['－']
    print('%-8s' % '' + ''.join('%8s' % c for c in cols))
    for k in sorted(stat, key=lambda x: -sum(stat[x].values())):
        print('%-8s' % k + ''.join('%8d' % stat[k][c] for c in cols))
    print()
    print('못 가린 출제의도 (많은 것부터)')
    for k, v in miss.most_common(20):
        print('  %3d  %s' % (v, k))

    if show:
        print('\n[%s] 갈래별 보기' % show[0])
        for c in cols:
            if not samples[c]:
                continue
            print('\n── %s (%d개)' % (c, len(samples[c])))
            for s in random.sample(samples[c], min(show[1], len(samples[c]))):
                print('   %-22s %2d  %s' % (s[0][:22], s[1], s[2]))

    if dry:
        return
    p = os.path.join(APP, 'data', 'course.js')
    js = 'window.QCRS=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
    open(p, 'w', encoding='utf-8').write(js)
    print('\ndata/course.js %.0fKB' % (len(js.encode('utf-8')) / 1024))


if __name__ == '__main__':
    main()
