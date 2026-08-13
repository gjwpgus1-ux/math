#!/usr/bin/env bash
# 한 PDF의 추출 → 단 경계 보정 → 재추출 → 문항 확정
set -u
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# PDF 위치는 findpdf.sh 가 찾아 준다
key="$1"; file="$2"; label="$3"
P="$(bash "$DIR/findpdf.sh" "$file")" || exit 1
W=/tmp/qbuild/$key; mkdir -p "$W"
N=$(python3 -c "import pypdfium2 as p;print(len(p.PdfDocument(r'''$P''')))")
rm -f "$W/pass1.jsonl" "$W/pass2.jsonl"
for ((a=0;a<N;a+=40)); do timeout 300 python3 "$DIR/extract.py" "$P" $a $((a+40)) "$W/pass1.jsonl" || echo "  FAIL1 $a"; done
python3 "$DIR/calibrate_split.py" "$W/pass1.jsonl" "$W/split.json" >/dev/null
for ((a=0;a<N;a+=40)); do timeout 300 python3 "$DIR/extract.py" "$P" $a $((a+40)) "$W/pass2.jsonl" "$W/split.json" || echo "  FAIL2 $a"; done
printf '%-8s %4s쪽  ' "$key" "$N"
python3 "$DIR/assemble.py" "$W/pass2.jsonl" "$W/questions.json" "$label"
