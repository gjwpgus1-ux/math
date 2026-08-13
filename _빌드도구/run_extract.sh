#!/usr/bin/env bash
# 한 PDF에 대해 1차 추출 → 단 경계 보정 → 2차 추출 → 문항 확정까지 실행한다.
# 사용: bash run_extract.sh <pdf경로> <작업이름> <표시이름>
set -u
PDF="$1"; KEY="$2"; LABEL="$3"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK=/tmp/qbuild/$KEY
mkdir -p "$WORK"
N=$(python3 -c "import pypdfium2 as p;print(len(p.PdfDocument(r'''$PDF''')))")
echo "[$LABEL] $N쪽"

run_pass() {   # $1=출력 jsonl  $2=splitmap(선택)
  rm -f "$1"
  for ((a=0; a<N; a+=40)); do
    timeout 300 python3 "$DIR/extract.py" "$PDF" $a $((a+40)) "$1" ${2:-} || echo "  FAIL $a"
  done
}

run_pass "$WORK/pass1.jsonl"
python3 "$DIR/calibrate_split.py" "$WORK/pass1.jsonl" "$WORK/split.json"
run_pass "$WORK/pass2.jsonl" "$WORK/split.json"
python3 "$DIR/assemble.py" "$WORK/pass2.jsonl" "$WORK/questions.json" "$LABEL"
