# -*- coding: utf-8 -*-
"""비공개 문항을 암호로 잠가 data/aux.bin 으로 만든다.

왜 이렇게 하나
  이 저장소는 공개(Public)라 올린 파일은 누구나 내려받을 수 있다.
  «메뉴를 숨긴다»는 눈속임일 뿐이므로, 아예 내용을 못 읽게 잠가서 올린다.
  암호를 모르면 aux.bin 은 뜻 없는 바이트 덩어리다.

잠그는 법 (브라우저 기본 기능만 쓰도록 맞췄다)
  열쇠  PBKDF2-HMAC-SHA256, 소금 16바이트, 250,000번
  자물쇠 AES-256-GCM, 12바이트 nonce
  파일  JJ1 | 소금(16) | nonce(12) | 잠긴 내용

담기는 것
  {"exams":[...], "items":[[…]], "img":{"이름.png":"base64", …}}
  공개본 data/index.js 와 같은 모양이라 앱이 그대로 이어 붙일 수 있다.

쓰는 법
  1) 시험지 PDF 를 공개본과 똑같이 크롭한다 (extract → assemble → render)
  2) python build_secret.py <작업폴더> <작업이름> [작업이름…]
  3) 암호를 물어보면 오프라인으로 나눠 줄 그 암호를 넣는다

주의
  · 암호는 어디에도 저장하지 않는다. 잊으면 되살릴 수 없다.
  · 원본 PDF·작업폴더는 저장소 밖에 두어야 한다.
"""
import sys, os, json, base64, getpass, secrets, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import layout
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, 'data', 'aux.bin')

MAGIC = b'JJ1'
ROUNDS = 250000
SALT_N = 16
NONCE_N = 12
MIN_PW = 8


def derive(pw, salt):
    return hashlib.pbkdf2_hmac('sha256', pw.encode('utf-8'), salt, ROUNDS, 32)


def seal(obj, pw):
    salt = secrets.token_bytes(SALT_N)
    nonce = secrets.token_bytes(NONCE_N)
    raw = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    ct = AESGCM(derive(pw, salt)).encrypt(nonce, raw, None)
    return MAGIC + salt + nonce + ct, len(raw)


def unseal(blob, pw):
    """확인용 — 앱이 하는 일과 같은 것을 파이썬으로 한 번 해 본다."""
    assert blob[:3] == MAGIC, '우리 파일이 아님'
    salt = blob[3:3 + SALT_N]
    nonce = blob[3 + SALT_N:3 + SALT_N + NONCE_N]
    ct = blob[3 + SALT_N + NONCE_N:]
    return json.loads(AESGCM(derive(pw, salt)).decrypt(nonce, ct, None))


def collect(work, keys):
    """공개본 add_exams.py 와 같은 자리에서 시험·문항·그림을 모은다."""
    exams, items, imgs = [], [], {}
    for key in keys:
        w = os.path.join(work, key)
        Q = json.load(open(os.path.join(w, 'q.json'), encoding='utf-8'))
        man = {}
        for line in open(os.path.join(w, 'manifest.jsonl'), encoding='utf-8'):
            line = line.strip()
            if not line:
                continue
            for m in json.loads(line):
                man[(m['exam'], m['num'])] = m
        n = 0
        for ei, e in enumerate(Q['exams']):
            idx = len(exams)
            exams.append(dict(n=e['name'], y=e.get('year', ''), r=e.get('round', ''),
                              s=e.get('subject', ''), g=e.get('grade', ''),
                              f=Q.get('file', ''), x=1))          # x=1 → 비공개 표시
            for q in e['questions']:
                m = man.get((ei, q['num']))
                if not m:
                    continue
                src = os.path.join(w, 'img', m['img'])
                if not os.path.exists(src):
                    continue
                name = key + '/' + m['img']
                imgs[name] = base64.b64encode(open(src, 'rb').read()).decode('ascii')
                items.append([idx, q['num'], name, m['w'], m['h'],
                              layout.norm_key(q['text'])])
                n += 1
        print('  %-12s 시험 %d개 · 문항 %d개' % (key, len(Q['exams']), n))
    return dict(exams=exams, items=items, img=imgs)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return
    work, keys = sys.argv[1], sys.argv[2:]
    data = collect(work, keys)
    if not data['items']:
        print('넣을 문항이 없습니다.')
        return

    pw = os.environ.get('AUX_PW') or getpass.getpass('암호 (오프라인으로 나눠 줄 것): ')
    if len(pw) < MIN_PW:
        print('암호는 %d자 이상이어야 합니다.' % MIN_PW)
        return
    if not os.environ.get('AUX_PW'):
        if pw != getpass.getpass('한 번 더: '):
            print('두 번 넣은 암호가 다릅니다.')
            return

    blob, plain = seal(data, pw)
    open(OUT, 'wb').write(blob)

    back = unseal(blob, pw)              # 되풀어 보고 같은지 확인
    ok = (len(back['items']) == len(data['items'])
          and len(back['img']) == len(data['img']))
    print('\n시험 %d개 · 문항 %d개 · 그림 %d장'
          % (len(data['exams']), len(data['items']), len(data['img'])))
    print('data/aux.bin  %.1fMB (잠그기 전 %.1fMB)' % (len(blob) / 1e6, plain / 1e6))
    print('되풀어 확인: %s' % ('통과' if ok else '실패'))
    print('\n암호는 저장하지 않았습니다. 잊으면 되살릴 수 없습니다.')


if __name__ == '__main__':
    main()
