from pathlib import Path
import shutil
from recorder_bundle import compose,adapt_sharing_copy

root=Path(__file__).parent
bundle=root/'bundle';bundle.mkdir(exist_ok=True)
for name in ('main.cjs','activity.js'):
    shutil.copy2(root/name,bundle/name)
wardrobe=(root.parent/'hydro'/'integration'/'wardrobe-live.js').read_text(encoding='utf-8')
combined=compose(wardrobe,root.parent/'recorder')
assert len(combined.encode('utf-8'))<=24*1024*1024,'Combined addon payload exceeds signed-update file budget'
(bundle/'wardrobe-live.js').write_text(combined,encoding='utf-8')
shutil.copy2(root/'release-metadata.json',bundle/'release.json')
tools=root/'recorder-tools';tools.mkdir(exist_ok=True)
for source,name in [('tools/clip_host.cjs','clip_host.cjs'),('replay_lab/index.html','index.html'),('replay_lab/video_offline.js','video_offline.js')]:
    (tools/name).write_text(adapt_sharing_copy((root.parent/'recorder'/source).read_text(encoding='utf-8')),encoding='utf-8')
print('Prepared three-addon bundle: Wardrobe, Power Tracker, Recorder; no private assistance included')
