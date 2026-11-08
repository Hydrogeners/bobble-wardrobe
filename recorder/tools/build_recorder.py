"""Build only the recording add-on; no historical project inputs are read."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULES = (
    "native_reader.js", "video_store.js", "video.js", "video_index.js", "clip_share.js",
    "video_clip.js", "video_ui.js", "video_runtime.js",
)
hook = (ROOT / "tools" / "unity_hook.js").read_text(encoding="utf-8")
modules = "\n".join((ROOT / "replay_lab" / name).read_text(encoding="utf-8") for name in MODULES)
payload = """(function(){'use strict';
if(window.__blReplay)return;
""" + hook + "\nfunction boot(){if(window.__blReplay)return;try{\n" + modules + """
}catch(e){window.__blReplayBootError=String(e&&e.message||e);}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
"""
out = ROOT / "dist"
out.mkdir(exist_ok=True)
(out / "bl-recorder-payload.js").write_text(payload, encoding="utf-8")
(out / "bl-recorder-main.js").write_text(
    (ROOT / "integration" / "bl-recorder-main.js").read_text(encoding="utf-8"), encoding="utf-8")
print(f"Recorder-only build: {out} ({len(payload.encode('utf-8'))} payload bytes)")
