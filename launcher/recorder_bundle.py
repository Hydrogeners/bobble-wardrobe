"""Build the pinned recorder as a third isolated addon in the shared JS payload."""
import hashlib
import json
from pathlib import Path

MODULES=('native_reader.js','video_store.js','video.js','video_index.js','clip_share.js','video_clip.js','video_ui.js','video_runtime.js')
UPSTREAM_COMMIT='def896d4caef38776714dafbad888c6731835263'

def adapt_sharing_copy(source:str)->str:
    # Copy-only host adaptation: the combined launcher starts the same reviewed
    # localhost worker, so users should not hunt for a standalone .cmd file.
    return source.replace('Start clip sharing.cmd','Start clip sharing in the Bobble Addons launcher')

def verify_source(root:Path):
    record=json.loads((root/'UPSTREAM.json').read_text(encoding='utf-8'))
    if record['commit']!=UPSTREAM_COMMIT or record['version']!='0.3.0':
        raise ValueError('Review recorder provenance before changing its pinned version')
    for name,digest in record['files'].items():
        relative=Path(name)
        if relative.is_absolute() or '..' in relative.parts:raise ValueError('Unsafe recorder source path')
        data=(root/relative).read_bytes().replace(b'\r\n',b'\n')
        if hashlib.sha256(data).hexdigest()!=digest:raise ValueError('Recorder source differs from reviewed upstream: '+name)
    return record

def compose(wardrobe:str,root:Path)->str:
    verify_source(root)
    recorder='\n'.join(adapt_sharing_copy((root/'replay_lab'/name).read_text(encoding='utf-8')) for name in MODULES)
    # The shared activity bootstrap already captures Unity. Do NOT install the
    # standalone Unity hook again or expose a second Electron/Node bridge.
    return ('// Bobble Addons: Wardrobe + manual Power Tracker + Recorder 0.3.0.\n'
        '(function(){\ntry {\n'+wardrobe+'\n} catch(error) { window.__bobbleWardrobeBootError=String(error); }\n'
        'try { if(!window.__blReplay){\n'+recorder+'\n} } catch(error) { window.__blReplayBootError=String(error); }\n'
        '})();\n')
