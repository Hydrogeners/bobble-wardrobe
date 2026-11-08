"""Bundle the proven visual controller as an isolated per-bobble factory."""
from pathlib import Path
import json
import base64
import gzip
import hashlib
import argparse
from compact_geometry import compact

parser=argparse.ArgumentParser()
parser.add_argument('--quality',action='store_true',default=True)
args=parser.parse_args()

ROOT = Path(__file__).parent
source = (ROOT / 'visual-template.js').read_text(encoding='utf-8')

def replace_once(old, new):
    global source
    assert source.count(old) == 1, old
    source = source.replace(old, new)

replace_once("if(window.__hydroModel)return JSON.stringify(window.__hydroModel.status());", '')
replace_once('const D=__VISUAL_DATA__;', 'const D=options.data;')
replace_once("if(root&&/^Team \\d+ /.test(P.name(root))) {", "if(root===options.root&&/^Team \\d+ /.test(P.name(root))) {")
replace_once("phase='ready';window.addEventListener('keydown',key,true);", "phase='ready';")
replace_once('window.__hydroModel=Object.freeze(', 'const controller=Object.freeze(')
replace_once('return JSON.stringify(status());', 'return controller;')
assert source.startswith('// TEMPORARY') and source.endswith('})();\n')
body = source[source.index("  'use strict';"):source.rfind('})();')]
factory = 'window.__bobbleCreateVisual = function(options) {\n' + body + '};\n'
catalog = [
    {'id': 'hydro', 'name': 'HYDRO', 'description': 'Redesigned detective cap, glasses, lavender tie & brown cape'},
    {'id': 'miko', 'name': 'MIKO', 'description': 'Teal detective, brown fedora, gold monocle & tuxedo'},
    {'id': 'todo', 'name': 'TODO', 'description': 'Scarred grin, purple shirt, silver pendant & dark jacket'},
    {'id': 'jjcho', 'name': 'JJCHO', 'description': 'Graduation cap, gold tassel, curled moustache & red tie'},
    {'id': 'augusto', 'name': 'AUGUSTO', 'description': 'White cloak, blue eyes, ornate gold crown & armor'},
    {'id': 'flair', 'name': 'FLAIR', 'description': 'White feathers, red eyes, gold beak & regal brown coat'},
    {'id': 'supa', 'name': 'SUPA', 'description': 'Red-and-white cap, blue jacket & yellow piping'},
    {'id': 'duolingo', 'name': 'DUOLINGO', 'description': 'Top hat, carrot nose, checked blue scarf & snowy coat'},
    {'id': 'spark', 'name': 'SPARK', 'description': 'Green hair and cape, flower cap, planet pendant & gold-leaf base'},
]
suffix='quality' if args.quality else 'fitted'
models = {row['id']: json.loads((ROOT / ('visual-'+row['id']+'-'+suffix+'.json')).read_text()) for row in catalog}
raw = json.dumps(compact(models), separators=(',', ':')).encode()
assert len(raw) <= 64*1024*1024, 'Decoded asset budget exceeded'
compressed = base64.b64encode(gzip.compress(raw, compresslevel=9, mtime=0)).decode()
# Data-only compression, not code obfuscation. The decoder is vendored with
# its MIT license; it has no runtime network dependency or game bindings.
assets = ('// BEGIN WARDROBE ASSETS\n(function(){const module={exports:{}};const exports=module.exports;\n'
          + '/* fflate 0.8.3 — third-party data decompression library\n' + (ROOT / 'lib/fflate-LICENSE.txt').read_text() + '\n*/\n'
          + (ROOT / 'lib/fflate-0.8.3.js').read_text() + '\n'
          + 'const packed=Uint8Array.from(atob('+json.dumps(compressed)+'),c=>c.charCodeAt(0));\n'
          + 'const decoded=module.exports.gunzipSync(packed,{out:new Uint8Array('+str(len(raw))+')});\n'
          + 'if(decoded.length!=='+str(len(raw))+')throw Error("Invalid bundled assets");\n'
          + (ROOT / 'expand-geometry.js').read_text() + '\n'
          + 'window.__bobbleSkinAssets=expandQualityGeometry(JSON.parse(module.exports.strFromU8(decoded)));})();\n'
          + 'window.__bobbleSkinCatalog = ' + json.dumps(catalog, separators=(',', ':')) + ';\n// END WARDROBE ASSETS\n')
bundle = '\n'.join([
    '// Power Tracker: independent manual activity mod, no game-memory access.\n/*\n'+(ROOT.parent.parent/'launcher/third_party/BLPT-LICENSE.txt').read_text(encoding='utf-8')+'\n*/\ntry {',
    (ROOT / 'power-tracker-core.js').read_text(encoding='utf-8'),
    (ROOT / 'power-tracker.js').read_text(encoding='utf-8'),
    '} catch(error) { window.__bobblePowerTrackerError=String(error); }',
    '// Bobble wardrobe: session-local cosmetics. Build-specific; no gameplay writes.',
    '(function(){ if(window.__bobbleWardrobe){window.__bobbleWardrobe.show();return;}\n',
    (ROOT / 'native-probe.js').read_text(encoding='utf-8'),
    (ROOT / 'allocation-check.js').read_text(encoding='utf-8'),
    assets, factory,
    (ROOT / 'club-catalog.js').read_text(encoding='utf-8'),
    (ROOT / 'skin-team.js').read_text(encoding='utf-8'),
    (ROOT / 'skin-manager.js').read_text(encoding='utf-8'),
    (ROOT / 'skin-accents.js').read_text(encoding='utf-8'),
    (ROOT / 'hydro-aim-accent.js').read_text(encoding='utf-8'),
    (ROOT / 'preview-rig.js').read_text(encoding='utf-8'),
    (ROOT / 'skin-preview.js').read_text(encoding='utf-8'),
    (ROOT / 'skin-showroom.js').read_text(encoding='utf-8'),
    '})();\n',
])
assert len(bundle.encode()) <= (24 if args.quality else 6)*1024*1024, 'Signed update file-size budget exceeded: '+str(len(bundle.encode()))+' bytes'
(ROOT / 'wardrobe-live.js').write_text(bundle, encoding='utf-8')
(ROOT / 'fitted-bundle-report.json').write_text(json.dumps({'variant':suffix,'assetBytes':len(raw),'bundledBytes':len(bundle.encode()),'decodedSHA256':hashlib.sha256(raw).hexdigest(),'skins':len(catalog),'compression':'gzip; fflate 0.8.3, MIT; quality geometry and lossless texture row-delta byte planes'},indent=2))
(ROOT / 'visual-factory.js').write_text(factory, encoding='utf-8')
upgrade = """(() => {
  const old=window.__bobbleWardrobe;
  if(!old)throw Error('Install wardrobe-live.js first');
  const saved={state:old.status(),create:window.__bobbleCreateVisual,assets:window.__bobbleSkinAssets};
  window.__wardrobeUpgradeRecovery=saved;
  if(window.__hydroAimAccent&&!window.__hydroAimAccent.dispose())throw Error('Accent restoration failed');
  if(!old.uninstall())throw Error('Restore failed; old panel retained');
  window.__bobbleCreateVisual=saved.create;window.__bobbleSkinAssets=saved.assets;
"""
upgrade += '\n'.join((ROOT / name).read_text(encoding='utf-8') for name in [
    'club-catalog.js', 'skin-team.js', 'skin-manager.js', 'skin-accents.js', 'hydro-aim-accent.js', 'preview-rig.js', 'skin-preview.js', 'skin-showroom.js'])
upgrade += """
  const engine=window.__bobbleWardrobeEngine;
  for(const club of engine.clubs)engine.assign(club,saved.state.assignments[club]||'original');
  if(saved.state.autoSkin)engine.auto(saved.state.autoSkin);
  engine.remember(saved.state.remember);
  if(saved.state.enabled)engine.setEnabled(true);
  window.__bobbleWardrobe.show();delete window.__wardrobeUpgradeRecovery;
  return JSON.stringify({installed:true,preview:window.__bobbleWardrobe.preview(),enabled:engine.state().enabled});
})();
"""
(ROOT / 'showroom-update.js').write_text(upgrade, encoding='utf-8')
preview_fix = "(() => {if(!window.__bobbleWardrobe?.detachUI)throw Error('Showroom required');window.__bobbleWardrobe.detachUI();\n"
preview_fix += '\n'.join((ROOT / name).read_text(encoding='utf-8') for name in ['skin-accents.js','preview-rig.js','skin-preview.js','skin-showroom.js'])
preview_fix += "\nwindow.__bobbleWardrobe.show();return JSON.stringify(window.__bobbleWardrobe.preview());})();\n"
(ROOT / 'preview-update.js').write_text(preview_fix, encoding='utf-8')
print('Built wardrobe-live.js, visual-factory.js, and showroom-update.js')
