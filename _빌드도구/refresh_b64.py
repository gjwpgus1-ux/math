# -*- coding: utf-8 -*-
"""문항 이미지를 바꾼 뒤 '클릭 복사'용 데이터를 다시 만든다 (파이썬 버전).

img 폴더의 PNG 중 b64 파일보다 새 것이 있는 시험만 갱신하므로 빠르다.
사용: python refresh_b64.py          (이 파일이 있는 폴더의 상위 폴더를 앱 폴더로 봄)
      python refresh_b64.py <앱폴더>
"""
import sys, os, base64, collections

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(here)
    img_root = os.path.join(root, 'img')
    b64_root = os.path.join(root, 'b64')
    if not os.path.isdir(img_root):
        print('img 폴더를 찾을 수 없습니다:', img_root); return

    updated = 0
    for key in sorted(os.listdir(img_root)):
        kdir = os.path.join(img_root, key)
        if not os.path.isdir(kdir):
            continue
        groups = collections.defaultdict(list)
        for name in sorted(os.listdir(kdir)):
            if name.lower().endswith('.png'):
                groups[name.split('_')[0]].append(name)

        outdir = os.path.join(b64_root, key)
        os.makedirs(outdir, exist_ok=True)
        for prefix, names in sorted(groups.items()):
            out = os.path.join(outdir, prefix + '.js')
            newest = max(os.path.getmtime(os.path.join(kdir, n)) for n in names)
            if os.path.exists(out) and os.path.getmtime(out) >= newest:
                continue
            parts = []
            for n in names:
                with open(os.path.join(kdir, n), 'rb') as f:
                    b = base64.b64encode(f.read()).decode('ascii')
                parts.append('"%s/%s":"%s"' % (key, n, b))
            with open(out, 'w', encoding='utf-8') as f:
                f.write('window.__B64=window.__B64||{};Object.assign(window.__B64,{')
                f.write(','.join(parts))
                f.write('});')
            updated += 1
            print('  갱신: %s/%s.js' % (key, prefix))

    print()
    if updated:
        print('완료: %d개 시험의 복사 데이터를 다시 만들었습니다.' % updated)
    else:
        print('바뀐 이미지가 없습니다. 그대로 두어도 됩니다.')


if __name__ == '__main__':
    main()
