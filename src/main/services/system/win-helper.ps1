# BetterDesktop Windows metrics helper.
#
# Runs as ONE long-lived PowerShell process. Reads commands line by line from
# stdin ("<id> <command>") and answers with one JSON line ("<id> <json>").
# Only the fixed commands below exist - nothing from stdin is ever executed.
#
# Using .NET performance counters inside a persistent process is orders of
# magnitude cheaper than spawning a new PowerShell for every probe.

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$script:gpuCat = $null
$script:gpuPrev = @{}
$script:disk = $null
$script:procMeta = @{}

function J([object]$v) { ConvertTo-Json -InputObject $v -Compress -Depth 5 }

function Esc([string]$s) {
  if ($null -eq $s) { return 'null' }
  return '"' + $s.Replace('\', '\\').Replace('"', '\"') + '"'
}

function Get-Net {
  $out = @()
  foreach ($n in [Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
    if ($n.NetworkInterfaceType -eq 'Loopback' -or $n.NetworkInterfaceType -eq 'Tunnel') { continue }
    $s = $n.GetIPStatistics()
    $ip = $null
    try {
      foreach ($a in $n.GetIPProperties().UnicastAddresses) {
        if ($a.Address.AddressFamily -eq 'InterNetwork') { $ip = $a.Address.ToString(); break }
      }
    } catch {}
    $gw = $false
    try { $gw = $n.GetIPProperties().GatewayAddresses.Count -gt 0 } catch {}
    $out += @{
      name = $n.Name; desc = $n.Description; type = [string]$n.NetworkInterfaceType
      up = ($n.OperationalStatus -eq 'Up'); rx = $s.BytesReceived; tx = $s.BytesSent
      speed = $n.Speed; mac = $n.GetPhysicalAddress().ToString(); ip = $ip; gateway = $gw
    }
  }
  return ,$out
}

function Get-Gpu {
  try {
    if ($null -eq $script:gpuCat) { $script:gpuCat = New-Object Diagnostics.PerformanceCounterCategory('GPU Engine') }
    $data = $script:gpuCat.ReadCategory()['Utilization Percentage']
    $sums = @{}
    $next = @{}
    foreach ($key in $data.Keys) {
      $cur = $data[$key].Sample
      $next[$key] = $cur
      $prev = $script:gpuPrev[$key]
      if ($null -eq $prev) { continue }
      $v = [Diagnostics.CounterSample]::Calculate($prev, $cur)
      if ($key -match 'luid_(0x[0-9a-fA-F]+_0x[0-9a-fA-F]+).*engtype_(.+)$') {
        $g = $matches[1] + '|' + $matches[2]
        $sums[$g] = [double]$sums[$g] + $v
      }
    }
    $script:gpuPrev = $next
    $adapters = @{}
    foreach ($g in $sums.Keys) {
      $luid = $g.Split('|')[0]
      $v = [Math]::Min(100, $sums[$g])
      if (-not $adapters.ContainsKey($luid) -or $adapters[$luid] -lt $v) { $adapters[$luid] = $v }
    }
    $mem = @{}
    try {
      $m = (New-Object Diagnostics.PerformanceCounterCategory('GPU Adapter Memory')).ReadCategory()['Dedicated Usage']
      foreach ($key in $m.Keys) {
        if ($key -match 'luid_(0x[0-9a-fA-F]+_0x[0-9a-fA-F]+)') { $mem[$matches[1]] = [double]$mem[$matches[1]] + $m[$key].RawValue }
      }
    } catch {}
    $list = @()
    foreach ($luid in (@($adapters.Keys) + @($mem.Keys) | Select-Object -Unique)) {
      $list += @{ luid = $luid; util = $adapters[$luid]; dedicated = $mem[$luid] }
    }
    return ,$list
  } catch { return $null }
}

function Get-Disk {
  try {
    if ($null -eq $script:disk) {
      $script:disk = @{
        r = New-Object Diagnostics.PerformanceCounter('PhysicalDisk', 'Disk Read Bytes/sec', '_Total')
        w = New-Object Diagnostics.PerformanceCounter('PhysicalDisk', 'Disk Write Bytes/sec', '_Total')
        i = New-Object Diagnostics.PerformanceCounter('PhysicalDisk', '% Idle Time', '_Total')
      }
    }
    return @{
      read = $script:disk.r.NextValue(); write = $script:disk.w.NextValue()
      busy = [Math]::Max(0, [Math]::Min(100, 100 - $script:disk.i.NextValue()))
    }
  } catch { return $null }
}

function Get-Drives {
  $out = @()
  foreach ($d in [IO.DriveInfo]::GetDrives()) {
    if (-not $d.IsReady) { continue }
    $out += @{
      mount = $d.Name.TrimEnd('\'); fs = $d.DriveFormat; type = [string]$d.DriveType
      label = $d.VolumeLabel; size = $d.TotalSize; free = $d.AvailableFreeSpace
    }
  }
  return ,$out
}

function Get-Page {
  try {
    $os = Get-CimInstance Win32_OperatingSystem -Property SizeStoredInPagingFiles, FreeSpaceInPagingFiles
    return @{ total = [double]$os.SizeStoredInPagingFiles * 1024; free = [double]$os.FreeSpaceInPagingFiles * 1024 }
  } catch { return $null }
}

function Get-Static {
  $os = Get-CimInstance Win32_OperatingSystem
  $cpu = @(Get-CimInstance Win32_Processor)[0]
  $gpus = @()
  try {
    $base = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
    foreach ($k in Get-ChildItem $base -ErrorAction SilentlyContinue) {
      if ($k.PSChildName -notmatch '^\d{4}$') { continue }
      $p = Get-ItemProperty $k.PSPath -ErrorAction SilentlyContinue
      if ($null -eq $p.DriverDesc) { continue }
      $vram = $p.'HardwareInformation.qwMemorySize'
      if ($null -eq $vram) { $vram = $p.'HardwareInformation.MemorySize' }
      if ($vram -is [byte[]]) { $vram = [BitConverter]::ToUInt32($vram, 0) }
      $gpus += @{ model = $p.DriverDesc; vendor = $p.ProviderName; vram = $vram }
    }
  } catch {}
  return @{
    os = @{ caption = $os.Caption; version = $os.Version; build = $os.BuildNumber }
    cpu = @{
      name = $cpu.Name.Trim(); manufacturer = $cpu.Manufacturer; cores = $cpu.NumberOfCores
      threads = $cpu.NumberOfLogicalProcessors; maxMHz = $cpu.MaxClockSpeed
    }
    gpus = $gpus
  }
}

function Get-Procs {
  $sb = New-Object Text.StringBuilder
  [void]$sb.Append('[')
  $first = $true
  $seen = @{}
  foreach ($p in [Diagnostics.Process]::GetProcesses()) {
    $cpu = 0
    try { $cpu = $p.TotalProcessorTime.TotalMilliseconds } catch {}
    # Path and start time never change for a PID: look them up once and cache.
    $meta = $script:procMeta[$p.Id]
    if ($null -eq $meta -or $meta.name -ne $p.ProcessName) {
      $path = $null; $start = $null
      try { $path = $p.MainModule.FileName } catch {}
      try { $start = $p.StartTime.ToString('o') } catch {}
      $meta = @{ name = $p.ProcessName; path = $path; start = $start }
      $script:procMeta[$p.Id] = $meta
    }
    $seen[$p.Id] = $true
    $path = $meta.path; $start = $meta.start
    if (-not $first) { [void]$sb.Append(',') }
    $first = $false
    [void]$sb.Append('{"pid":').Append($p.Id).Append(',"name":').Append((Esc $p.ProcessName)).Append(',"cpu":').Append([Math]::Round($cpu)).Append(',"ws":').Append($p.WorkingSet64).Append(',"path":').Append((Esc $path)).Append(',"start":').Append((Esc $start)).Append('}')
    $p.Dispose()
  }
  [void]$sb.Append(']')
  foreach ($k in @($script:procMeta.Keys)) { if (-not $seen.ContainsKey($k)) { $script:procMeta.Remove($k) } }
  return $sb.ToString()
}

[Console]::Out.WriteLine('ready')
[Console]::Out.Flush()

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $parts = $line.Split(' ', 2)
  if ($parts.Count -lt 2) { continue }
  $id = $parts[0]
  $cmd = $parts[1].Trim()
  try {
    switch ($cmd) {
      'sample' { $json = J @{ net = (Get-Net); gpu = (Get-Gpu); disk = (Get-Disk) } }
      'drives' { $json = J (Get-Drives) }
      'page' { $json = J (Get-Page) }
      'static' { $json = J (Get-Static) }
      'procs' { $json = Get-Procs }
      'exit' { exit 0 }
      default { $json = J @{ error = "unknown command" } }
    }
  } catch {
    $json = J @{ error = $_.Exception.Message }
  }
  [Console]::Out.WriteLine($id + ' ' + $json)
  [Console]::Out.Flush()
}
