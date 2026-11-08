param([string]$DistPath='release-preview-power-tracker',[switch]$Quality=$true)
$ErrorActionPreference='Stop'
Push-Location $PSScriptRoot
try {
    Push-Location (Join-Path $PSScriptRoot '..\hydro\integration')
    try {
        $variantArgs=@()
        if($Quality){$variantArgs=@('--quality');$env:BOBBLE_ASSET_VARIANT='quality'}else{throw 'The crumpled fitted model build is retired; use the quality build'}
        python build-wardrobe.py @variantArgs
        if($LASTEXITCODE -ne 0){throw 'Wardrobe asset bundle failed'}
        python -m unittest -v test_fitted_assets.py test_visual_envelope.py test_nebula_rig.py test_base_styles.py test_native_scale.py test_surface_repairs.py
        if($LASTEXITCODE -ne 0){throw 'Wardrobe geometry validation failed'}
        foreach($test in @('power-tracker-test.cjs','skin-team-test.cjs','compact-geometry-test.cjs','fitted-bundle-test.cjs','visual-test.cjs','preview-test.cjs','wardrobe-test.cjs','aim-accent-test.cjs')) {
            node $test @variantArgs
            if($LASTEXITCODE -ne 0){throw "Wardrobe test failed: $test"}
        }
    } finally { Pop-Location }
    python build_payload.py
    if($LASTEXITCODE -ne 0){throw 'Bundle build failed'}
    foreach($test in @('video-recorder.test.cjs','video-storage.test.cjs','native-lifecycle.test.cjs','video-offline.test.cjs')) {
        node (Join-Path '..\recorder\validation' $test)
        if($LASTEXITCODE -ne 0){throw "Recorder test failed: $test"}
    }
    python -m unittest -v test_recorder_bundle.py test_recorder_helper.py
    if($LASTEXITCODE -ne 0){throw 'Combined addon/clip helper validation failed'}
    python -m unittest -v test_install_core.py test_signed_updates.py test_launcher_updates.py test_quality_migration.py test_maintenance.py test_channel_manager.py test_background.py test_sign_release.py test_windows_processes.py test_windows_signing.py
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
    python -m PyInstaller --noconfirm --clean --onefile --windowed --name BobbleWardrobe-Preview --add-data 'bundle;bundle' --add-data 'update-policy.json;.' --add-data 'third_party;third_party' --add-data 'recorder-tools;recorder-tools' --distpath $DistPath --workpath $work launcher.py
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
