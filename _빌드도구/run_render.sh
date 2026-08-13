#!/usr/bin/env bash
# 문항 이미지 렌더링. 메모리 누수를 피해 시험 10개씩 별도 프로세스로 돌린다.
# 사용: bash run_render.sh <pdf> <작업이름>
set -u
PDF="$1"; KEY="$2"
DIR=/sessions/serene-festive-hamilton/mnt/outputs
WORK=/tmp/qbuild/$KEY
IMG=$WORK/img
rm -rf "$IMG"; mkdir -p "$IMG"
NE=$(python3 -c "import json;print(len(json.load(open('$WORK/questions.json'))['exams']))")
: > "$WORK/manifest.jsonl"
for ((a=0; a<NE; a+=10)); do
  timeout 550 python3 "$DIR/render.py" "$PDF" "$WORK/questions.json" "$IMG" $a $((a+10)) >> "$WORK/manifest.jsonl" || echo "  FAIL $a"
done
echo "이미지 $(ls "$IMG" | wc -l)개, $(du -sh "$IMG" | cut -f1)"
