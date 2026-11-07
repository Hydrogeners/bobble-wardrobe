"""Bobble Addons desktop hub; Wardrobe is its only implemented add-on.

The existing Wardrobe installer and helper remain authoritative. This UI does
not load external plugins or claim independent multi-add-on management yet.
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

# THESIS: a calm, Xbox-inspired add-on library rather than an installer form.
# OWN-WORLD: pearl surfaces, deep forest rail, leaf-green actions, Segoe UI.
# STORY: discover the only available add-on, understand its state, manage it.
# FIRST VIEWPORT: navigation rail, Wardrobe feature, real install and status.
# FORM: native Windows controls; future add-ons are explicitly unavailable.

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
    app=tk.Tk();app.title('Bobble Wardrobe · Preview');app.geometry('930x710');app.minsize(800,690)
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
    label(rail,'Local cosmetics',C['rail'],C['railmuted'],('Segoe UI',10)).pack(anchor='w',padx=22,pady=(42,12))
    nav=tk.Frame(rail,bg='#35553b',height=44);nav.pack(fill='x',padx=10);nav.pack_propagate(False)
    label(nav,'  Wardrobe', '#35553b','#ffffff',('Segoe UI',10,'bold')).pack(fill='both',expand=True,padx=8)
    label(rail,'BOBBLE LEAGUE',C['rail'],C['railmuted'],('Segoe UI',8,'bold')).pack(side='bottom',anchor='w',padx=22,pady=28)

    content=tk.Frame(shell,bg=C['bg']);content.pack(side='left',fill='both',expand=True,padx=30,pady=(23,20))
    top=tk.Frame(content,bg=C['bg']);top.pack(fill='x')
    label(top,'Your wardrobe',font=('Segoe UI',23,'bold')).pack(side='left')
    label(top,f'Preview · release {bundled_release}',fg=C['muted'],font=('Segoe UI',9)).pack(side='right',anchor='e')
    label(content,'Nine custom skins. Your view of the game.',fg=C['muted'],font=('Segoe UI',11)).pack(anchor='w',pady=(2,18))

    feature=tk.Frame(content,bg=C['white'],highlightbackground=C['line'],highlightthickness=1);feature.pack(fill='x')
    card=tk.Frame(feature,bg=C['white']);card.pack(fill='x',padx=22,pady=20)
    art=tk.Canvas(card,width=104,height=104,bg=C['pale'],highlightthickness=0);art.pack(side='left',padx=(0,19))
    art.create_polygon(35,24,45,20,59,20,69,24,83,34,75,47,69,43,69,82,35,82,35,43,29,47,21,34,fill='',outline=C['darkgreen'],width=2,joinstyle='round')
    art.create_arc(43,15,61,32,start=180,extent=180,style='arc',outline=C['darkgreen'],width=2)
    details=tk.Frame(card,bg=C['white']);details.pack(side='left',fill='both',expand=True)
    label(details,'Wardrobe',C['white'],C['text'],('Segoe UI',17,'bold')).pack(anchor='w',pady=(2,3))
    label(details,'Rotate real 3D previews, choose a club, then apply.\nCosmetics only — no gameplay changes.',C['white'],C['muted'],('Segoe UI',10),wraplength=390).pack(anchor='w')
    status=tk.StringVar(value='Checking installation…')
    label(details,bg=C['white'],fg=C['green'],font=('Segoe UI',9,'bold'),textvariable=status,wraplength=410).pack(anchor='w',pady=(10,0))
    actions=tk.Frame(feature,bg='#f8faf6');actions.pack(fill='x',padx=1,pady=(0,1))
    install_button=ttk.Button(actions,text='Install Wardrobe',style='Primary.TButton');install_button.pack(side='left',padx=(20,8),pady=12)
    uninstall_button=ttk.Button(actions,text='Uninstall',style='Quiet.TButton');uninstall_button.pack(side='left',pady=12)
    label(actions,'Install / remove with Discord closed.', '#f8faf6',C['muted'],('Segoe UI',9),wraplength=210).pack(side='right',padx=18)

    library=tk.Frame(content,bg=C['bg']);library.pack(fill='x',pady=(20,0))
    label(library,'Automatic updates',font=('Segoe UI',13,'bold')).pack(anchor='w')
    future=tk.Frame(library,bg='#e7ede3',highlightbackground=C['line'],highlightthickness=1);future.pack(fill='x',pady=(8,0))
    label(future,'Signed skins + in-game UI', '#e7ede3',C['text'],('Segoe UI',10,'bold')).pack(anchor='w',padx=15,pady=(12,3))
    label(future,'The installed helper checks hourly. Updates wait until you fully quit Discord.\nThis launcher checks for a signed newer launcher when opened.', '#e7ede3',C['muted'],('Segoe UI',9),wraplength=565).pack(anchor='w',padx=15,pady=(0,12))

    setup=tk.Frame(content,bg=C['bg']);setup.pack(fill='x',pady=(18,0))
    label(setup,'Discord installation',font=('Segoe UI',10,'bold')).pack(anchor='w')
    found=candidates();selected=tk.StringVar(value=str(found[0]) if found else '')
    choice=ttk.Combobox(setup,textvariable=selected,values=[str(p) for p in found],state='readonly');choice.pack(fill='x',pady=(6,0))
    update_status=tk.StringVar(value='Checking maintenance…')
    footer=tk.Frame(content,bg=C['bg']);footer.pack(fill='x',pady=(12,0))
    update_button=ttk.Button(footer,text='Check for updates',style='Quiet.TButton');update_button.pack(side='right')
    label(footer,bg=C['bg'],fg=C['muted'],font=('Segoe UI',9),textvariable=update_status,wraplength=400).pack(side='left',fill='x',expand=True,padx=(0,12))
    label(content,'Install adds a sign-in helper for updates and Discord version repair. Uninstall removes it.\nDevelopment preview · Windows executable is not code-signed. Never enter Discord credentials here.',fg=C['muted'],font=('Segoe UI',9),wraplength=620).pack(anchor='w',pady=(12,0))

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
                install_button.configure(text='Update / repair Wardrobe')
            else:status.set('Not installed');install_button.configure(text='Install Wardrobe')
        except Exception as exc:status.set('Needs attention: '+str(exc))
    def begin(work,text,quiet=True):
        nonlocal busy
        if busy:return
        busy=True;choice.configure(state='disabled')
        for button in (install_button,uninstall_button,update_button):button.state(['disabled'])
        update_status.set(text)
        def run():
            try:results.put((True,quiet,work()))
            except Exception as exc:results.put((False,quiet,str(exc)))
        threading.Thread(target=run,daemon=True).start()
    def action(remove=False):
        chosen=selected.get()
        def work():
            if remove:return uninstall_persistent(manager)['message']
            if not chosen:raise RuntimeError('No Discord installation selected')
            if not getattr(sys,'frozen',False):raise RuntimeError('Use the packaged portable executable to install its self-contained background helper.')
            install_persistent(manager,Path(sys.executable),resources=Path(chosen))
            return 'Wardrobe installed with signed automatic updates. Open Discord normally, then Bobble League.'
        begin(work,'Removing Wardrobe…' if remove else 'Installing Wardrobe…',quiet=False)
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
                if target:
                    try:
                        launcher_updates.launch_verified(target,update_home,policy['publicKey'],bundled_release)
                        app.destroy();return
                    except Exception as exc:message+=' Could not open the verified launcher: '+str(exc)
                result=message
            update_status.set(result if ok else 'Needs attention: '+result);refresh();choice.configure(state='readonly')
            for button in (install_button,uninstall_button,update_button):button.state(['!disabled'])
            if not quiet:
                if ok:messagebox.showinfo('Bobble Addons',result)
                else:messagebox.showerror('Bobble Addons needs attention',result)
        app.after(100,poll_updates)
    def close():
        if busy:update_status.set('Please wait for the current operation to finish before closing.')
        else:app.destroy()
    install_button.configure(command=action);uninstall_button.configure(command=lambda:action(True));update_button.configure(command=updates)
    app.protocol('WM_DELETE_WINDOW',close);choice.bind('<<ComboboxSelected>>',refresh)
    refresh();app.after(100,poll_updates);app.after(200,updates);app.mainloop()

if __name__=='__main__':
    if sys.argv[1:]==['--maintain']:
        base=Path(getattr(sys,'_MEIPASS',Path(__file__).parent))
        manager=ChannelManager(default_home(),Path(os.environ['LOCALAPPDATA'])/'Discord',base/'bundle',discord_running)
        try:run_background(manager,json.loads((base/'update-policy.json').read_text('utf-8')))
        except RuntimeError:pass
    else:main()
