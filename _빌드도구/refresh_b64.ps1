# 문항 이미지를 바꾼 뒤 '클릭 복사'용 데이터를 다시 만든다.
# img 폴더의 PNG 중 b64 파일보다 새 것이 있는 시험만 골라서 갱신하므로 빠르다.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$imgRoot = Join-Path $root 'img'
$b64Root = Join-Path $root 'b64'

if (-not (Test-Path $imgRoot)) { Write-Host "img folder not found: $imgRoot"; exit 1 }

$updated = 0
Get-ChildItem -Path $imgRoot -Directory | ForEach-Object {
    $key = $_.Name
    $outDir = Join-Path $b64Root $key
    if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

    Get-ChildItem -Path $_.FullName -Filter *.png |
        Group-Object { $_.Name.Split('_')[0] } | ForEach-Object {
            $prefix = $_.Name
            $files  = $_.Group | Sort-Object Name
            $out    = Join-Path $outDir ($prefix + '.js')

            $newest = ($files | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
            if ((Test-Path $out) -and ((Get-Item $out).LastWriteTime -ge $newest)) { return }

            $sb = New-Object System.Text.StringBuilder
            [void]$sb.Append('window.__B64=window.__B64||{};Object.assign(window.__B64,{')
            $first = $true
            foreach ($f in $files) {
                if (-not $first) { [void]$sb.Append(',') }
                $first = $false
                $b = [Convert]::ToBase64String([IO.File]::ReadAllBytes($f.FullName))
                [void]$sb.Append('"' + $key + '/' + $f.Name + '":"' + $b + '"')
            }
            [void]$sb.Append('});')
            [IO.File]::WriteAllText($out, $sb.ToString())
            $script:updated++
            Write-Host ("  갱신: " + $key + "/" + $prefix + ".js")
        }
}

if ($updated -eq 0) {
    Write-Host ""
    Write-Host "바뀐 이미지가 없습니다. 그대로 두어도 됩니다."
} else {
    Write-Host ""
    Write-Host ("완료: " + $updated + "개 시험의 복사 데이터를 다시 만들었습니다.")
}
