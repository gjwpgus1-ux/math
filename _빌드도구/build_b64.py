# -*- coding: utf-8 -*-
"""클립보드 복사용 데이터 생성.

브라우저는 file:// 로 연 페이지에서 file:// 이미지를 캔버스로 읽는 것을 막는다(보안 정책).
그래서 이미지를 복사하려면 data URI 가 필요하고, 이를 시험 단위 .js 청크로 미리 만들어 둔다.
클릭한 문항이 속한 시험의 청크만 그때그때 불러오므로 평소 메모리 부담은 없다.

사용: python3 build_b64.py <앱폴더>
"""
import sys, os, json, base64, collections


def main():
    app = sys.argv[1]
    raw = open(os.path.join(app, 'data', 'index.js'), encoding='utf-8').read()
    D = json.loads(raw[len('window.QDATA='):-1])

    groups = collections.defaultdict(list)
    for it in D['items']:
        key, name = it[2].split('/', 1)
        groups[(key, name.split('_')[0])].append(name)

    total = 0
    for (key, prefix), names in sorted(groups.items()):
        outdir = os.path.join(app, 'b64', key)
        os.makedirs(outdir, exist_ok=True)
        blob = {}
        for n in names:
            p = os.path.join(app, 'img', key, n)
            with open(p, 'rb') as f:
                blob[key + '/' + n] = base64.b64encode(f.read()).decode('ascii')
        path = os.path.join(outdir, prefix + '.js')
        with open(path, 'w', encoding='utf-8') as f:
            f.write('window.__B64=window.__B64||{};Object.assign(window.__B64,')
            json.dump(blob, f, separators=(',', ':'))
            f.write(');')
        total += os.path.getsize(path)
    print('청크 %d개 · %dMB' % (len(groups), total // 1024 // 1024))


if __name__ == '__main__':
    main()
