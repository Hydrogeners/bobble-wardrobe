"""Limited process-image checks. Never reads Discord command lines or profiles."""
import csv
import ctypes
from ctypes import wintypes
import io
from pathlib import Path
import subprocess

def image_path(pid):
    kernel=ctypes.WinDLL('kernel32',use_last_error=True)
    kernel.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD]
    kernel.OpenProcess.restype=wintypes.HANDLE
    kernel.QueryFullProcessImageNameW.argtypes=[wintypes.HANDLE,wintypes.DWORD,wintypes.LPWSTR,ctypes.POINTER(wintypes.DWORD)]
    kernel.QueryFullProcessImageNameW.restype=wintypes.BOOL
    kernel.CloseHandle.argtypes=[wintypes.HANDLE]
    handle=kernel.OpenProcess(0x1000,False,pid)
    if not handle:raise ctypes.WinError(ctypes.get_last_error())
    try:
        size=wintypes.DWORD(32768);buffer=ctypes.create_unicode_buffer(size.value)
        if not kernel.QueryFullProcessImageNameW(handle,0,buffer,ctypes.byref(size)):raise ctypes.WinError(ctypes.get_last_error())
        return Path(buffer.value)
    finally:kernel.CloseHandle(handle)

def discord_running(root: Path):
    result=subprocess.run(['tasklist','/FI','IMAGENAME eq Discord.exe','/FO','CSV','/NH'],capture_output=True,text=True,creationflags=0x08000000,check=True)
    for row in csv.reader(io.StringIO(result.stdout)):
        if not row or row[0].lower()!='discord.exe':continue
        try:path=image_path(int(row[1]))
        except (OSError,ValueError):return True # Refuse writes if ownership cannot be established.
        if path.is_relative_to(root.absolute()):return True
    return False
