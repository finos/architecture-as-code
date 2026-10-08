# SPDX-FileCopyrightText: 2026 CalmStudio Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Minimal SPA static file server for Windows. No admin rights required.
# Listens on 127.0.0.1 only. SPA fallback → /index.html.

param(
	[Parameter(Mandatory = $true)][string]$Root,
	[int]$Port = 17890,
	[string]$PidFile = ''
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path $Root).Path

$mime = @{
	'.html' = 'text/html; charset=utf-8'
	'.htm'  = 'text/html; charset=utf-8'
	'.js'   = 'text/javascript; charset=utf-8'
	'.mjs'  = 'text/javascript; charset=utf-8'
	'.css'  = 'text/css; charset=utf-8'
	'.json' = 'application/json; charset=utf-8'
	'.svg'  = 'image/svg+xml'
	'.png'  = 'image/png'
	'.jpg'  = 'image/jpeg'
	'.jpeg' = 'image/jpeg'
	'.gif'  = 'image/gif'
	'.ico'  = 'image/x-icon'
	'.webp' = 'image/webp'
	'.woff' = 'font/woff'
	'.woff2'= 'font/woff2'
	'.ttf'  = 'font/ttf'
	'.map'  = 'application/json'
	'.txt'  = 'text/plain; charset=utf-8'
	'.wasm' = 'application/wasm'
}

function Get-SafePath([string]$urlPath) {
	$rel = [Uri]::UnescapeDataString(($urlPath -split '\?', 2)[0])
	if ([string]::IsNullOrWhiteSpace($rel) -or $rel -eq '/') { return Join-Path $Root 'index.html' }
	$rel = $rel.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
	$full = [IO.Path]::GetFullPath((Join-Path $Root $rel))
	if (-not $full.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase)) { return $null }
	return $full
}

$listener = [System.Net.HttpListener]::new()
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)
try {
	$listener.Start()
} catch {
	throw "Nelze spustit server na $prefix. Port je obsazený nebo blokovaný. Zkuste jiné číslo portu. $_"
}

if ($PidFile) {
	Set-Content -Path $PidFile -Value $PID -Encoding ASCII
}

Write-Host "CalmStudio server: $prefix"
Write-Host "Root: $Root"
Write-Host "PID: $PID"
Write-Host "Ukončení: Stop-CalmStudio.cmd nebo Ctrl+C"

try {
	while ($listener.IsListening) {
		$ctx = $listener.GetContext()
		$req = $ctx.Request
		$res = $ctx.Response
		try {
			$path = Get-SafePath $req.Url.AbsolutePath
			if (-not $path) {
				$res.StatusCode = 400
				$bytes = [Text.Encoding]::UTF8.GetBytes('Bad request')
				$res.OutputStream.Write($bytes, 0, $bytes.Length)
			} else {
				if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
					# SPA fallback
					$path = Join-Path $Root 'index.html'
				}
				if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
					$res.StatusCode = 404
					$bytes = [Text.Encoding]::UTF8.GetBytes('Not found')
					$res.OutputStream.Write($bytes, 0, $bytes.Length)
				} else {
					$ext = [IO.Path]::GetExtension($path).ToLowerInvariant()
					$res.ContentType = $(if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' })
					$res.StatusCode = 200
					$bytes = [IO.File]::ReadAllBytes($path)
					$res.ContentLength64 = $bytes.LongLength
					$res.OutputStream.Write($bytes, 0, $bytes.Length)
				}
			}
		} catch {
			try { $res.StatusCode = 500 } catch {}
		} finally {
			try { $res.OutputStream.Close() } catch {}
			try { $res.Close() } catch {}
		}
	}
} finally {
	try { $listener.Stop() } catch {}
	try { $listener.Close() } catch {}
	if ($PidFile -and (Test-Path $PidFile)) { Remove-Item $PidFile -Force -ErrorAction SilentlyContinue }
}
