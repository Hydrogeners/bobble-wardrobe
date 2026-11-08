"""Explicitly started, launcher-owned localhost clip helper; no auto uploads."""
import os
from pathlib import Path
import shutil
import socket
import subprocess
import time

class RecorderHelper:
    def __init__(self,base:Path):
        self.script=base/'recorder-tools'/'clip_host.cjs'
        self.process=None

    def running(self):
        return self.process is not None and self.process.poll() is None

    def start(self):
        if self.running():return 'Clip sharing helper is already running. Keep this launcher open while sharing.'
        if not self.script.is_file():raise RuntimeError('Bundled clip helper is missing. Download the current launcher.')
        node=shutil.which('node')
        if not node:raise RuntimeError('Recording and saving work without Node.js. For optional public clip links, install Node.js 22+ from nodejs.org, then reopen this launcher.')
        environment=os.environ.copy()
        for name in ('NODE_OPTIONS','NODE_PATH'):environment.pop(name,None)
        flags=getattr(subprocess,'CREATE_NO_WINDOW',0)
        version=subprocess.run([node,'--version'],capture_output=True,text=True,timeout=5,env=environment,creationflags=flags,check=True)
        try:major=int(version.stdout.strip().lstrip('v').split('.')[0])
        except ValueError:raise RuntimeError('Could not identify Node.js. Install Node.js 22+ for optional clip links.')
        if major<22:raise RuntimeError('Public clip links need Node.js 22+. Recording and local saving do not.')
        # Never take over or kill an unknown listener. The host also handles the
        # small bind race by exiting rather than choosing a different endpoint.
        try:
            with socket.socket(socket.AF_INET,socket.SOCK_STREAM) as probe:probe.bind(('127.0.0.1',8789))
        except OSError:raise RuntimeError('Port 8789 is already in use. An existing clip helper may already be running; this launcher will not stop it.')
        self.process=subprocess.Popen([node,str(self.script)],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env=environment,creationflags=flags)
        deadline=time.monotonic()+5
        while time.monotonic()<deadline:
            if self.process.poll() is not None:
                self.process=None;raise RuntimeError('The clip helper could not start. Port 8789 may already be in use.')
            try:
                with socket.create_connection(('127.0.0.1',8789),timeout=.1):
                    return 'Clip sharing is ready. Keep this launcher open; create a clip in Recordings and confirm Upload clip. Links are public and expire. Nothing uploads automatically.'
            except OSError:time.sleep(.05)
        self.stop();raise RuntimeError('The clip helper did not become ready. Recording and local saving are unaffected.')

    def stop(self):
        process=self.process
        if process is None:return
        if process.poll() is None:
            process.terminate()
            try:process.wait(timeout=5)
            except subprocess.TimeoutExpired:process.kill();process.wait(timeout=5)
        self.process=None
