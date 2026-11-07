from pathlib import Path
import shutil

root=Path(__file__).parent
bundle=root/'bundle';bundle.mkdir(exist_ok=True)
for name in ('main.cjs','activity.js'):
    shutil.copy2(root/name,bundle/name)
shutil.copy2(root.parent/'hydro'/'integration'/'wardrobe-live.js',bundle/'wardrobe-live.js')
shutil.copy2(root/'release-metadata.json',bundle/'release.json')
print('Prepared Wardrobe-only bundle; no prediction/assistant overlay included')
