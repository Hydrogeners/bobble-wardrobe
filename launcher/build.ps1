param([string]$DistPath='release-preview')
$ErrorActionPreference='Stop'
Push-Location $PSScriptRoot
try {
    python build_payload.py
    if($LASTEXITCODE -ne 0){throw 'Bundle build failed'}
    python -m unittest -v test_install_core.py test_signed_updates.py test_maintenance.py test_channel_manager.py test_background.py test_sign_release.py test_windows_processes.py test_windows_signing.py
    if($LASTEXITCODE -ne 0){throw 'Installer tests failed'}
    node test_activity.cjs
    if($LASTEXITCODE -ne 0){throw 'Activity bootstrap tests failed'}
    node test_main.cjs
    if($LASTEXITCODE -ne 0){throw 'Electron bridge tests failed'}
    node --check bundle\main.cjs
    if($LASTEXITCODE -ne 0){throw 'Bridge syntax check failed'}
    node --check bundle\wardrobe-live.js
    if($LASTEXITCODE -ne 0){throw 'Wardrobe syntax check failed'}
    $work=if(Test-Path 'Z:\Temp\opencode'){Join-Path 'Z:\Temp\opencode' 'wardrobe-pyinstaller'}else{Join-Path $env:TEMP 'wardrobe-pyinstaller'}
    python -m PyInstaller --noconfirm --clean --onefile --windowed --name BobbleWardrobe-Preview --add-data 'bundle;bundle' --add-data 'update-policy.json;.' --distpath $DistPath --workpath $work launcher.py
    if($LASTEXITCODE -ne 0){throw 'Executable build failed'}
    $oldPackagedTest=$env:WARDROBE_PACKAGED_TEST
    $oldPackagedExe=$env:WARDROBE_PACKAGED_EXE
    try {
        $env:WARDROBE_PACKAGED_TEST='1'
        $env:WARDROBE_PACKAGED_EXE=Join-Path (Resolve-Path $DistPath) 'BobbleWardrobe-Preview.exe'
        python -m unittest -v test_packaged_background.py
        if($LASTEXITCODE -ne 0){throw 'Packaged maintenance lifecycle failed'}
    } finally { $env:WARDROBE_PACKAGED_TEST=$oldPackagedTest; $env:WARDROBE_PACKAGED_EXE=$oldPackagedExe }
} finally { Pop-Location }
