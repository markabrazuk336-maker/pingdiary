# Локальный статический сервер для разработки: .\dev-server.ps1 [-Port 8080]
# Нужен потому, что ES-модули не грузятся с file:// — браузер блокирует их по CORS.

param([int]$Port = 8080)

$root = $PSScriptRoot
$prefix = "http://localhost:$Port/"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try { $listener.Start() }
catch {
  Write-Host "Не удалось занять порт $Port. Попробуйте другой: .\dev-server.ps1 -Port 8081" -ForegroundColor Red
  exit 1
}

Write-Host "PingDiary: $prefix" -ForegroundColor Green
Write-Host "Остановить — Ctrl+C" -ForegroundColor DarkGray

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.ico'  = 'image/x-icon'
}

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $path = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)
  if ($path -eq '/') { $path = '/index.html' }

  $file = Join-Path $root ($path.TrimStart('/') -replace '/', '\')
  $full = [System.IO.Path]::GetFullPath($file)

  # не выпускаем запросы за пределы папки проекта
  if (-not $full.StartsWith([System.IO.Path]::GetFullPath($root))) {
    $context.Response.StatusCode = 403
    $context.Response.Close()
    continue
  }

  if (Test-Path $full -PathType Leaf) {
    $ext = [System.IO.Path]::GetExtension($full).ToLower()
    $bytes = [System.IO.File]::ReadAllBytes($full)
    $context.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
    $context.Response.Headers.Add('Cache-Control', 'no-store')
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $context.Response.StatusCode = 404
  }

  $context.Response.Close()
}
