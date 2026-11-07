"""Bundle the proven visual controller as an isolated per-bobble factory."""
from pathlib import Path
import json

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
data = json.loads((ROOT / 'visual-repaired-data.json').read_text())
nebula = json.loads((ROOT / 'visual-nebula-data.json').read_text())
catalog = [
    {'id': 'hydro', 'name': 'Hydro', 'description': 'Chestnut cap, glasses & tailored coat'},
    {'id': 'nebula', 'name': 'Nebula', 'description': 'Green field jacket, silver-panel cap & gold-leaf base'},
]
assets = ('window.__bobbleSkinAssets = ' + json.dumps({'hydro': data, 'nebula': nebula}, separators=(',', ':')) + ';\n'
          + 'window.__bobbleSkinCatalog = ' + json.dumps(catalog, separators=(',', ':')) + ';\n')
bundle = '\n'.join([
    '// Bobble wardrobe: session-local cosmetics. Build-specific; no gameplay writes.',
    '(function(){ if(window.__bobbleWardrobe){window.__bobbleWardrobe.show();return;}\n',
    (ROOT / 'native-probe.js').read_text(encoding='utf-8'),
    (ROOT / 'allocation-check.js').read_text(encoding='utf-8'),
    assets, factory,
    (ROOT / 'club-catalog.js').read_text(encoding='utf-8'),
    (ROOT / 'skin-manager.js').read_text(encoding='utf-8'),
    (ROOT / 'skin-accents.js').read_text(encoding='utf-8'),
    (ROOT / 'hydro-aim-accent.js').read_text(encoding='utf-8'),
    (ROOT / 'preview-rig.js').read_text(encoding='utf-8'),
    (ROOT / 'skin-preview.js').read_text(encoding='utf-8'),
    (ROOT / 'skin-showroom.js').read_text(encoding='utf-8'),
    '})();\n',
])
(ROOT / 'wardrobe-live.js').write_text(bundle, encoding='utf-8')
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
    'club-catalog.js', 'skin-manager.js', 'skin-accents.js', 'hydro-aim-accent.js', 'preview-rig.js', 'skin-preview.js', 'skin-showroom.js'])
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
