#!/usr/bin/env bash
# 파일 이름(확장자 없이)만 주면 어디에 있든 찾아 준다.
# «데이터베이스» 폴더를 먼저 뒤지고, 없으면 제작 폴더 전체를 뒤진다.
# 그래서 PDF를 어느 하위 폴더로 옮기셔도 그대로 동작한다.
name="$1"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"          # …/기출문제검색기 제작
for d in "$root/데이터베이스" "$root"; do
  [ -d "$d" ] || continue
  f=$(find "$d" -name "${name}.pdf" -type f 2>/dev/null | head -1)
  [ -n "$f" ] && { echo "$f"; exit 0; }
done
echo "PDF를 찾지 못했습니다: ${name}.pdf" >&2
exit 1
