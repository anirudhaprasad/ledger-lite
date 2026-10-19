# Bundle app\ back into one self-contained HTML file (for opening on a phone).
# Usage: powershell -File tools\build.ps1 [-App app] [-Out dist\aifico_money_manager.html]
param([string]$App = 'app', [string]$Out = 'dist\aifico_money_manager.html')
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding $false
$root = (Resolve-Path $App).Path
$read = { param($rel) [IO.File]::ReadAllText((Join-Path $root $rel), $utf8).TrimEnd() }
$outLines = foreach ($x in [IO.File]::ReadAllLines((Join-Path $root 'index.html'), $utf8)) {
  if ($x -match '^(\s*)<link rel="stylesheet" href="(css/[^"]+)">\s*$') { "$($Matches[1])<style>`n$(& $read $Matches[2])`n$($Matches[1])</style>" }
  elseif ($x -match '^(\s*)<script src="(js/[^"]+)"></script>\s*$') { "$($Matches[1])<script>`n$(& $read $Matches[2])`n$($Matches[1])</script>" }
  else { $x }
}
New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
[IO.File]::WriteAllText((Join-Path (Get-Location) $Out), ($outLines -join "`n") + "`n", $utf8)
"Built $Out ($([math]::Round((Get-Item $Out).Length/1KB)) KB)"
