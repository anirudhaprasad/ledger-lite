# Bundle app\ back into one self-contained HTML file (for opening on a phone).
# Inlines local stylesheets, scripts (including vendor\ libraries) and fonts, so the file works offline.
# Usage: powershell -File tools\build.ps1 [-App app] [-Out dist\aifico_money_manager.html]
param([string]$App = 'app', [string]$Out = 'dist\aifico_money_manager.html')
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding $false
$root = (Resolve-Path $App).Path
$read = { param($rel) [IO.File]::ReadAllText((Join-Path $root $rel), $utf8).TrimEnd() }
# Fonts referenced from CSS (url(../fonts/x.woff2)) become data: URIs.
$inlineFonts = { param($css, $cssRel)
  [regex]::Replace($css, 'url\((["'']?)(\.\./fonts/[^)"'']+)\1\)', {
    param($m) $p = [IO.Path]::GetFullPath((Join-Path (Join-Path $root (Split-Path $cssRel)) $m.Groups[2].Value))
    'url(data:font/woff2;base64,' + [Convert]::ToBase64String([IO.File]::ReadAllBytes($p)) + ')' })
}
$outLines = foreach ($x in [IO.File]::ReadAllLines((Join-Path $root 'index.html'), $utf8)) {
  if ($x -match '^(\s*)<link rel="stylesheet" href="((?!https?:)[^"]+\.css)">\s*$') { "$($Matches[1])<style>`n$(& $inlineFonts (& $read $Matches[2]) $Matches[2])`n$($Matches[1])</style>" }
  elseif ($x -match '^(\s*)<script src="((?!https?:)[^"]+\.js)"></script>\s*$') { "$($Matches[1])<script>`n$((& $read $Matches[2]).Replace('</script', '<\/script'))`n$($Matches[1])</script>" }
  else { $x }
}
$html = ($outLines -join "`n") + "`n"
if ($html -match '<(link|script)[^>]+(href|src)="(?!https?:|data:)[^"]+"') { throw "build: a local file was not inlined: $($Matches[0])" }
New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
[IO.File]::WriteAllText((Join-Path (Get-Location) $Out), $html, $utf8)
"Built $Out ($([math]::Round((Get-Item $Out).Length/1KB)) KB)"
