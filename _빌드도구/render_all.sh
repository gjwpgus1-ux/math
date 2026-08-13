#!/usr/bin/env bash
# 한 파일의 모든 문항 이미지를 렌더링한다. 메모리 누수를 피해 시험 10개씩 나눠 실행.
set -u
DIR=/sessions/serene-festive-hamilton/mnt/outputs
BASE="/sessions/serene-festive-hamilton/mnt/클로드 코워크/기출문제검색기 제작"
key="$1"; file="$2"
P="$BASE/${file}.pdf"; W=/tmp/qbuild/$key
rm -rf "$W/img"; mkdir -p "$W/img"; : > "$W/manifest.jsonl"
NE=$(python3 -c "import json;print(len(json.load(open('$W/questions.json'))['exams']))")
for ((a=0; a<NE; a+=10)); do
  timeout 580 python3 "$DIR/render.py" "$P" "$W/questions.json" "$W/img" $a $((a+10)) >> "$W/manifest.jsonl" || echo "  FAIL $key $a"
done
printf '%-8s 이미지 %5d개  %s\n' "$key" "$(ls "$W/img" | wc -l)" "$(du -sh "$W/img" | cut -f1)"
