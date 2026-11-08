"""Bobble Addons: Wardrobe + Power Tracker + Recorder.

The installer owns their shared activity loader. Each mod has independent UI and
state; no assistance code or arbitrary plugin loader is included.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import queue
import sys
import threading
import tkinter as tk
from tkinter import ttk, messagebox
from install_core import Installer
from maintenance import check_updates
from signed_updates import fetch
from channel_manager import ChannelManager
from background import default_home, install_persistent, uninstall_persistent, run_background
from windows_processes import discord_running as channel_running
import launcher_updates
from recorder_helper import RecorderHelper

# THESIS: a calm, Xbox-inspired add-on library rather than an installer form.
# OWN-WORLD: pearl surfaces, deep forest rail, leaf-green actions, Segoe UI.
# STORY: manage cosmetics and run a manual match-side power checklist independently.
# FIRST VIEWPORT: navigation rail, Wardrobe install, minimal Power Tracker mod.
# FORM: native Windows controls; no fake add-ons or arbitrary plugin execution.

def candidates() -> list[Path]:
    root=Path(os.environ.get('LOCALAPPDATA',''))/'Discord'
    def version(p):
        try:return tuple(int(n) for n in p.name.removeprefix('app-').split('.'))
        except ValueError:return ()
    return [p/'resources' for p in sorted(root.glob('app-*'),key=version,reverse=True)
            if (p/'Discord.exe').is_file() and (p/'resources'/'app.asar').exists()]

def discord_running() -> bool:
    if sys.platform!='win32':return False
    return channel_running(Path(os.environ['LOCALAPPDATA'])/'Discord')

def main():
    base=Path(getattr(sys,'_MEIPASS',Path(__file__).parent))
    manager=ChannelManager(default_home(),Path(os.environ['LOCALAPPDATA'])/'Discord',base/'bundle',discord_running)
    policy=json.loads((base/'update-policy.json').read_text('utf-8'))
    bundled_release=json.loads((base/'bundle'/'release.json').read_text('utf-8'))['release']
    update_home=default_home().parent/'launcher-updates'
    helper=RecorderHelper(base)
    app=tk.Tk();app.title('Bobble Addons · Preview');app.geometry('1040x860');app.minsize(960,810)
    C={'bg':'#edf1e9','rail':'#1c3327','railmuted':'#bdd1b9','green':'#447d2f','white':'#ffffff',
       'text':'#1e3023','muted':'#586c5b','line':'#d5dfd2','pale':'#e2eedb','darkgreen':'#244f28'}
    app.configure(bg=C['bg'])
    style=ttk.Style(app);style.theme_use('clam')
    style.configure('TCombobox',font=('Segoe UI',10),padding=8,fieldbackground=C['white'],bordercolor=C['line'],arrowsize=14)
    style.configure('Primary.TButton',font=('Segoe UI',10,'bold'),padding=(18,10),background=C['green'],foreground='white',borderwidth=0)
    style.map('Primary.TButton',background=[('disabled','#a7b5a3'),('active','#356a26')],foreground=[('disabled','#f1f4ef')])
    style.configure('Quiet.TButton',font=('Segoe UI',10),padding=(14,10),background=C['white'],foreground=C['text'],bordercolor=C['line'])
    style.map('Quiet.TButton',background=[('active',C['pale'])],foreground=[('disabled','#8b998b')])
    def label(parent,text='',bg=None,fg=None,font=None,**kw):
        return tk.Label(parent,text=text,bg=bg or C['bg'],fg=fg or C['text'],font=font or ('Segoe UI',10),anchor='w',justify='left',**kw)

    shell=tk.Frame(app,bg=C['bg']);shell.pack(fill='both',expand=True)
    rail=tk.Frame(shell,bg=C['rail'],width=188);rail.pack(side='left',fill='y');rail.pack_propagate(False)
    brand=tk.Frame(rail,bg=C['rail']);brand.pack(fill='x',padx=21,pady=(26,0))
    mark=tk.Canvas(brand,width=33,height=33,bg=C['rail'],highlightthickness=0);mark.pack(side='left',padx=(0,10))
    mark.create_oval(2,2,31,31,fill='#acd78c',outline='');mark.create_arc(7,8,26,24,start=20,extent=140,style='arc',outline=C['rail'],width=2)
    label(brand,'BOBBLE',C['rail'],'#ffffff',('Segoe UI',11,'bold')).pack(anchor='w')
    label(brand,'ADDONS',C['rail'],C['railmuted'],('Segoe UI',8,'bold')).pack(anchor='w')
    label(rail,'Local add-ons',C['rail'],C['railmuted'],('Segoe UI',10)).pack(anchor='w',padx=22,pady=(42,12))
    nav=tk.Frame(rail,bg='#35553b',height=44);nav.pack(fill='x',padx=10);nav.pack_propagate(False)
    label(nav,'  Your add-ons', '#35553b','#ffffff',('Segoe UI',10,'bold')).pack(fill='both',expand=True,padx=8)
    label(rail,'BOBBLE LEAGUE',C['rail'],C['railmuted'],('Segoe UI',8,'bold')).pack(side='bottom',anchor='w',padx=22,pady=28)

    content=tk.Frame(shell,bg=C['bg']);content.pack(side='left',fill='both',expand=True,padx=30,pady=(20,16))
    top=tk.Frame(content,bg=C['bg']);top.pack(fill='x')
    label(top,'Your add-ons',font=('Segoe UI',23,'bold')).pack(side='left')
    label(top,f'Preview · release {bundled_release}',fg=C['muted'],font=('Segoe UI',9)).pack(side='right',anchor='e')
    label(content,'Skins, power tracking and match recordings. One install.',fg=C['muted'],font=('Segoe UI',11)).pack(anchor='w',pady=(2,14))

    feature=tk.Frame(content,bg=C['white'],highlightbackground=C['line'],highlightthickness=1);feature.pack(fill='x')
    card=tk.Frame(feature,bg=C['white']);card.pack(fill='x',padx=22,pady=20)
    art=tk.Canvas(card,width=104,height=104,bg=C['pale'],highlightthickness=0);art.pack(side='left',padx=(0,19))
    art.create_polygon(35,24,45,20,59,20,69,24,83,34,75,47,69,43,69,82,35,82,35,43,29,47,21,34,fill='',outline=C['darkgreen'],width=2,joinstyle='round')
    art.create_arc(43,15,61,32,start=180,extent=180,style='arc',outline=C['darkgreen'],width=2)
    details=tk.Frame(card,bg=C['white']);details.pack(side='left',fill='both',expand=True)
    label(details,'Wardrobe',C['white'],C['text'],('Segoe UI',17,'bold')).pack(anchor='w',pady=(2,3))
    label(details,'Preview nine skins and choose Use on my team.\nCosmetics only — no gameplay changes.',C['white'],C['muted'],('Segoe UI',10),wraplength=390).pack(anchor='w')
    status=tk.StringVar(value='Checking installation…')
    label(details,bg=C['white'],fg=C['green'],font=('Segoe UI',9,'bold'),textvariable=status,wraplength=410).pack(anchor='w',pady=(10,0))
    actions=tk.Frame(feature,bg='#f8faf6');actions.pack(fill='x',padx=1,pady=(0,1))
    install_button=ttk.Button(actions,text='Install activity mods',style='Primary.TButton');install_button.pack(side='left',padx=(20,8),pady=12)
    uninstall_button=ttk.Button(actions,text='Uninstall all three',style='Quiet.TButton');uninstall_button.pack(side='left',pady=12)
    label(actions,'Install / remove with Discord closed.', '#f8faf6',C['muted'],('Segoe UI',9),wraplength=210).pack(side='right',padx=18)

    library=tk.Frame(content,bg=C['bg']);library.pack(fill='x',pady=(14,0))
    library.columnconfigure((0,1),weight=1,uniform='addons')
    future=tk.Frame(library,bg=C['white'],highlightbackground=C['line'],highlightthickness=1);future.grid(row=0,column=0,sticky='nsew',padx=(0,6))
    label(future,'Power Tracker',C['white'],C['text'],('Segoe UI',17,'bold')).pack(anchor='w',padx=20,pady=(12,3))
    label(future,'A tiny checklist inside the activity. Click a name or use 1–4 to mark an observed power.\nManual only; no automatic detection.',C['white'],C['muted'],('Segoe UI',10),wraplength=290).pack(anchor='w',padx=20)
    tracker_actions=tk.Frame(future,bg=C['white']);tracker_actions.pack(fill='x',padx=20,pady=(8,14))
    tracker_install=ttk.Button(tracker_actions,text='Install / update all three',style='Quiet.TButton');tracker_install.pack(side='left')
    label(future,'In Bobble League → Powers. Hide anytime.\nNames and preferences save; match marks do not.',C['white'],C['muted'],('Segoe UI',9),wraplength=290).pack(anchor='w',padx=20,pady=(0,12))

    recorder_card=tk.Frame(library,bg=C['white'],highlightbackground=C['line'],highlightthickness=1);recorder_card.grid(row=0,column=1,sticky='nsew',padx=(6,0))
    label(recorder_card,'Recorder',C['white'],C['text'],('Segoe UI',17,'bold')).pack(anchor='w',padx=20,pady=(12,3))
    label(recorder_card,'Silent match video, playback and clips.\nCompact default: ~450 MB/hour.\nRecording starts only when you turn it on.',C['white'],C['muted'],('Segoe UI',10),wraplength=290).pack(anchor='w',padx=20)
    recorder_actions=tk.Frame(recorder_card,bg=C['white']);recorder_actions.pack(fill='x',padx=20,pady=(8,10))
    share_button=ttk.Button(recorder_actions,text='Start clip sharing',style='Quiet.TButton');share_button.pack(side='left')
    label(recorder_card,'In Bobble League → Recordings. Save important videos: cache may be deleted. Optional public links need Node.js 22+ and this launcher open.',C['white'],C['muted'],('Segoe UI',9),wraplength=290).pack(anchor='w',padx=20,pady=(0,12))

    setup=tk.Frame(content,bg=C['bg']);setup.pack(fill='x',pady=(12,0))
    label(setup,'Discord installation',font=('Segoe UI',10,'bold')).pack(anchor='w')
    found=candidates();selected=tk.StringVar(value=str(found[0]) if found else '')
    choice=ttk.Combobox(setup,textvariable=selected,values=[str(p) for p in found],state='readonly');choice.pack(fill='x',pady=(6,0))
    update_status=tk.StringVar(value='Checking maintenance…')
    footer=tk.Frame(content,bg=C['bg']);footer.pack(fill='x',pady=(12,0))
    update_button=ttk.Button(footer,text='Check for updates',style='Quiet.TButton');update_button.pack(side='right')
    label(footer,bg=C['bg'],fg=C['muted'],font=('Segoe UI',9),textvariable=update_status,wraplength=400).pack(side='left',fill='x',expand=True,padx=(0,12))
    label(content,'One shared install / uninstall for all three; each has independent in-activity controls.\nUpdates wait for Discord to exit. No private assister. Preview · not Windows code-signed.',fg=C['muted'],font=('Segoe UI',9),wraplength=700).pack(anchor='w',pady=(10,0))

    results=queue.Queue();busy=False
    def refresh(*_):
        current=selected.get();found[:]=candidates();choice.configure(values=[str(p) for p in found])
        if current not in [str(p) for p in found]:selected.set(str(found[0]) if found else '')
        if not selected.get():status.set('Discord Stable not found');return
        try:
            state=Installer(Path(selected.get()),base/'bundle').status()
            if state.get('phase') in ('prepared','restored'):status.set('Recovery needed · quit Discord and choose Uninstall')
            elif state['installed']:
                maintenance=manager.load()
                cached=maintenance.get('current') or 0
                installed=state.get('release',1)
                suffix=f' · update {cached} ready after Discord exits' if cached>installed else ''
                status.set(f'Installed · release {installed} · automatic updates {"on" if maintenance["enabled"] else "off"}'+suffix)
                install_button.configure(text='Update / repair mods')
            else:status.set('Not installed');install_button.configure(text='Install activity mods')
        except Exception as exc:status.set('Needs attention: '+str(exc))
    def begin(work,text,quiet=True):
        nonlocal busy
        if busy:return
        busy=True;choice.configure(state='disabled')
        for button in (install_button,uninstall_button,update_button,tracker_install,share_button):button.state(['disabled'])
        update_status.set(text)
        def run():
            try:results.put((True,quiet,work()))
            except Exception as exc:results.put((False,quiet,str(exc)))
        threading.Thread(target=run,daemon=True).start()
    def action(remove=False):
        chosen=selected.get()
        def work():
            if remove:
                helper.stop()
                return uninstall_persistent(manager)['message']
            if not chosen:raise RuntimeError('No Discord installation selected')
            if not getattr(sys,'frozen',False):raise RuntimeError('Use the packaged portable executable to install its self-contained background helper.')
            install_persistent(manager,Path(sys.executable),resources=Path(chosen))
            return 'All three add-ons installed with signed automatic updates. Open Discord normally, then Bobble League: Wardrobe, Powers or Recordings. Recorder starts off. Save important videos to Downloads; cached and unfinished videos can be lost. Optional public sharing: install Node.js 22+ and select Start clip sharing here.'
        if remove and not messagebox.askyesno('Remove all three add-ons?','This removes Wardrobe, Power Tracker and Recorder from the shared installation, and stops this launcher’s clip helper.\n\nFully quit Discord first. Save important recordings and check Downloads. This does not delete downloaded videos or revoke public clip links.'):
            return
        begin(work,'Removing all three add-ons…' if remove else 'Installing all three add-ons…',quiet=False)
    def updates():
        if busy:return
        refresh();paths=list(found)
        def payload_updates():
            if manager.config.exists():
                state=manager.load()
                if not state['enabled']:return 'Automatic maintenance is disabled.'
                manager.tick()
                if not policy.get('feed') or not policy.get('publicKey'):return 'Version repair is on. Signed update feed is not configured.'
                release=fetch(policy,manager.load()['current'])
                if release is not None:
                    phase=manager.accept_release(release)
                    if phase=='disabled':return 'Maintenance was disabled; update not applied.'
                    return 'Verified update cached until Discord exits.' if phase=='update-cached-until-discord-exits' else f'Updated Wardrobe to release {release.number}.'
                return 'Signed updates checked. Installed payload is current.'
            return check_updates(paths,base/'bundle',policy,discord_running,Path(os.environ['LOCALAPPDATA'])/'BobbleWardrobe'/'update-staging')
        def work():
            try:message=payload_updates()
            except Exception as exc:message='Skin update check unavailable: '+str(exc)
            # Source runs never download/execute an EXE. Packaged launchers
            # hand off only to a separately signed, digest-checked newer file.
            target=None
            if getattr(sys,'frozen',False):
                try:target=launcher_updates.check(update_home,policy['publicKey'],bundled_release)
                except Exception as exc:message+=' Launcher update check unavailable: '+str(exc)
            return {'message':message,'launcher':target}
        begin(work,'Checking maintenance and signed updates…')
    def poll_updates():
        nonlocal busy
        try:ok,quiet,result=results.get_nowait()
        except queue.Empty:pass
        else:
            busy=False
            if ok and isinstance(result,dict):
                target=result.get('launcher');message=result['message']
                if target and helper.running():
                    target=None;message+=' A newer launcher is cached. Stop clip sharing before reopening the launcher to finish the update.'
                if target:
                    try:
                        launcher_updates.launch_verified(target,update_home,policy['publicKey'],bundled_release)
                        app.destroy();return
                    except Exception as exc:message+=' Could not open the verified launcher: '+str(exc)
                result=message
            update_status.set(result if ok else 'Needs attention: '+result);refresh();choice.configure(state='readonly')
            for button in (install_button,uninstall_button,update_button,tracker_install,share_button):button.state(['!disabled'])
            share_button.configure(text='Stop clip sharing' if helper.running() else 'Start clip sharing')
            if not quiet:
                if ok:messagebox.showinfo('Bobble Addons',result)
                else:messagebox.showerror('Bobble Addons needs attention',result)
        app.after(100,poll_updates)
    def close():
        if busy:update_status.set('Please wait for the current operation to finish before closing.')
        else:
            if helper.running() and not messagebox.askyesno('Stop clip sharing and close?','Closing stops this launcher’s clip helper and can cancel an upload. Bytes already received by the public host cannot be recalled. Recording/local saving in the activity remain independent. Close anyway?'):return
            helper.stop();app.destroy()
    def sharing():
        if helper.running():
            if messagebox.askyesno('Stop clip sharing?','This can cancel an upload. Already uploaded bytes cannot be recalled. Stop the helper?'):
                begin(lambda:(helper.stop() or 'Clip sharing stopped. Activity recording and local saving are unchanged.'),'Stopping local clip helper…',quiet=False)
        else:begin(helper.start,'Starting the optional local clip helper…',quiet=False)
    install_button.configure(command=action);uninstall_button.configure(command=lambda:action(True));update_button.configure(command=updates)
    tracker_install.configure(command=action)
    share_button.configure(command=sharing)
    app.protocol('WM_DELETE_WINDOW',close);choice.bind('<<ComboboxSelected>>',refresh)
    refresh();app.after(100,poll_updates);app.after(200,updates);app.mainloop()

if __name__=='__main__':
    if sys.argv[1:]==['--maintain']:
        base=Path(getattr(sys,'_MEIPASS',Path(__file__).parent))
        manager=ChannelManager(default_home(),Path(os.environ['LOCALAPPDATA'])/'Discord',base/'bundle',discord_running)
        try:run_background(manager,json.loads((base/'update-policy.json').read_text('utf-8')))
        except RuntimeError:pass
    else:main()
