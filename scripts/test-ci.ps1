$act = if (Get-Command act -ErrorAction SilentlyContinue) { "act" } else { (Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter "act.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName -First 1) ?? "act" }
$artifactDir = "$env:TEMP\act-artifacts"
New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
& $act -j deploy -r --secret-file .env --artifact-server-path $artifactDir @args
