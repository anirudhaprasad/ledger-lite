// AificoApp methods: PC access. The phone lends its vault to the PC over your own Wi-Fi or the phone's hotspot: the phone
// app runs a small server (PcAccessServer) with a one-time passcode and serves only the encrypted vault; the PC unlocks it
// with the master password on its own side and saves every change back to the phone. One copy of the data (the phone's),
// so nothing has to be merged. Developer: the PC app (file://) connects to the phone over http. Lite: the phone serves
// the app itself over https (its own certificate), so a browser on the PC opens https://<phone>:8765 and connects there.
        class AificoAppPcAccess extends AificoAppShared {
            // ---------- Phone side ----------
            pcAccessAvailable(){ return !!(window.AndroidBridge && typeof window.AndroidBridge.pcStart === 'function'); }
            /** This page was opened from the phone itself (Lite PC access: https://<phone>:8765). */
            servedByPhone(){ return location.protocol === 'https:' && ['8765', '8766', '8767'].includes(location.port); }
            pcStatus(){ try { return JSON.parse(window.AndroidBridge.pcStatus() || '{}'); } catch (e) { return {}; } }
            /** Start: a fresh passcode, the phone's current (encrypted) vault handed to the server, the screen kept on. */
            async startPcAccess(){
                if (!this.pcAccessAvailable() || !this.currentPassword) return;
                await this.saveVault(); const enc = await this.storage.getItem('aifico_vault'); if (!enc) return alert('Nothing to share yet: the vault is empty.');
                const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789', r = crypto.getRandomValues(new Uint8Array(6));
                const code = Array.from(r, b => abc[b % abc.length]).join('');
                window.AndroidBridge.pcSetVault(enc);
                let st = {}; try { st = JSON.parse(window.AndroidBridge.pcStart(code)); } catch (e) {}
                if (!st.running) return alert('PC access could not start' + (st.error ? ` (${st.error})` : '') + '. Turn Wi-Fi or the hotspot on and try again.');
                this.pcOn = { code, since: Date.now() };
                clearInterval(this._pcPoll); this._pcPoll = setInterval(() => this.renderPcAccess(), 2000);
                this.renderPcAccess();
            }
            stopPcAccess(reason){
                if (this.pcAccessAvailable()) window.AndroidBridge.pcStop();
                clearInterval(this._pcPoll); this.pcOn = null; this.renderPcAccess(); if (reason) alert(reason);
            }
            /** After every save here while PC access is on, the server gets the new copy (the PC reloads it on its next save). */
            afterVaultWrite(encrypted){ if (this.pcOn && this.pcAccessAvailable()) window.AndroidBridge.pcSetVault(encrypted); }
            /** The PC saved: store its (encrypted) vault here and show it. Locked meanwhile: stored now, shown after unlock. */
            async pcIncoming(){
                const enc = window.AndroidBridge.pcGetVault(); if (!enc) return;
                await this.storage.setItem('aifico_vault', enc);
                if (!this.currentPassword) return;
                try { this.data = this.prepareVaultData(await this.vault.decryptData(enc, this.currentPassword)); this.renderAll(); this.renderPcAccess(); }
                catch (e) { console.error('PC access: the PC copy could not be opened here', e); }
            }
            /** Settings card, and the "In use on PC" screen while a PC is connected. */
            renderPcAccess(){
                const card = document.getElementById('pc-access-card'); if (!card) return;
                card.hidden = !this.pcAccessAvailable(); if (card.hidden) return;
                const st = this.pcOn ? this.pcStatus() : {}; const esc = v => this.escapeHtml(String(v ?? ''));
                if (this.pcOn && !st.running) { this.stopPcAccess(); return; }
                if (this.pcOn) {
                    if (st.connected) { this.pcOn.lastActive = Date.now(); this.pcOn.everConnected = true; }
                    const idle = Date.now() - (this.pcOn.lastActive || this.pcOn.since), limit = (this.pcOn.everConnected ? 10 : 5) * 60000;
                    if (!st.connected && idle > limit) { this.stopPcAccess(this.pcOn.everConnected ? 'PC access stopped by itself: your PC was quiet for 10 minutes.' : 'PC access stopped by itself: no PC connected within 5 minutes.'); return; }
                }
                const body = document.getElementById('pc-access-body');
                // Lite (https): the PC's browser opens the phone's address and accepts the phone's own certificate once
                const how = st.https ? "On your PC, open this address in Edge or Chrome. It warns that the connection isn't private: that's this phone's own certificate, so choose <b>Advanced → Continue</b>. Then enter the passcode and your master password."
                    : "On your PC, open aifico ledger → <b>Open my phone's data</b> and enter:";
                body.innerHTML = this.pcOn ? `<div class="pca-live"><div class="pca-row"><span>${how}</span></div>
                    <div class="pca-row"><span>Address</span><b class="pca-addr">${(st.addresses || []).map(a => esc((st.https ? 'https://' : '') + a + ':' + st.port)).join('<br>') || 'No Wi-Fi: turn Wi-Fi or the hotspot on'}</b></div>
                    <div class="pca-row"><span>Passcode</span><b class="pca-code">${esc(this.pcOn.code)}</b></div>
                    <p class="set-note">${st.connected ? '<b class="pca-on"><i data-lucide="monitor-smartphone"></i> Your PC is connected.</b> Changes made there are saved on this phone, and this phone stays usable.' : 'Waiting for your PC… The screen stays on while PC access is on, and it stops by itself if no PC connects within 5 minutes.'}${st.wrong ? ` · ${st.wrong} wrong passcode${st.wrong === 1 ? '' : 's'}` : ''}</p>
                    <div class="set-actions"><button type="button" class="s-btn s-danger-outline s-wide" onclick="app.stopPcAccess()">Stop PC access</button></div></div>`
                    : `<div class="set-actions"><button type="button" class="s-btn s-primary s-wide" onclick="app.startPcAccess()"><i data-lucide="monitor-smartphone"></i><span>Start PC access</span></button></div>`;
                // While PC access is on, a small icon in the top bar (green dot when the PC is connected); tap it for PC access.
                // The phone stays usable: if both save, the phone's copy wins and the PC reloads it.
                let chip = document.getElementById('pc-chip');
                if (this.pcOn) {
                    if (!chip) { chip = document.createElement('button'); chip.type = 'button'; chip.id = 'pc-chip'; chip.onclick = () => { this.switchTab('settings'); document.getElementById('pc-access-card')?.scrollIntoView({ block: 'center' }); }; document.getElementById('mask-toggle')?.before(chip); }
                    chip.classList.toggle('on', !!st.connected); chip.title = chip.ariaLabel = st.connected ? 'PC access: your PC is connected' : 'PC access is on: waiting for your PC';
                    chip.innerHTML = '<i data-lucide="monitor-smartphone"></i><i class="pcc-dot" aria-hidden="true"></i>';
                } else chip?.remove();
                window.lucide?.createIcons?.();
            }

            // ---------- PC side ----------
            /** "Open my phone's data" on this PC's lock screen: address, passcode and master password. */
            openPhoneConnect(){
                const esc = v => this.escapeHtml(String(v ?? '')); let last = ''; try { last = localStorage.getItem('aifico_pc_phone') || ''; } catch (e) {}
                const served = this.servedByPhone(); if (served) last = location.host;
                const box = document.getElementById('modal-box');
                box.innerHTML = `<div class="flex justify-between items-center pb-2"><h3 class="font-bold text-base">Open my phone's data</h3><button type="button" onclick="app.closeModal()" class="text-slate-400" aria-label="Close"><i data-lucide="x" class="w-5 h-5"></i></button></div>
                  <p class="text-sm text-slate-500">${served ? 'Enter the passcode shown on the phone (Backup &amp; Settings → <b>PC access</b>) and your master password. The data opens here, in this browser, and every change is saved on the phone.' : "On the phone: aifico ledger → Backup &amp; Settings → <b>PC access</b> → Start. Both must be on the same Wi-Fi (or this PC on the phone's hotspot)."}</p>
                  <form id="pcc-form" class="ip-form" autocomplete="off">
                    <label class="ip-field"${served ? ' hidden' : ''}><span>Phone address</span><input id="pcc-addr" required placeholder="e.g. 192.168.1.13:8765" value="${esc(last)}" inputmode="url"></label>
                    <label class="ip-field"><span>Passcode</span><input id="pcc-code" required maxlength="12" placeholder="Shown on the phone"></label>
                    <label class="ip-field"><span>Master password</span><input id="pcc-pw" type="password" required autocomplete="current-password" placeholder="The phone vault's password"></label>
                    <p id="pcc-status" class="set-note" role="status" aria-live="polite"></p>
                    <div class="af-actions">${served ? '' : '<button type="button" class="s-btn s-secondary" onclick="app.closeModal()">Cancel</button>'}<button type="submit" class="s-btn s-primary" id="pcc-go">Connect</button></div>
                  </form>`;
                document.getElementById('modal-container').classList.remove('hidden'); window.lucide?.createIcons?.();
                document.getElementById('pcc-form').addEventListener('submit', async e => { e.preventDefault(); const st = document.getElementById('pcc-status'), go = document.getElementById('pcc-go'); go.disabled = true; st.textContent = 'Connecting…';
                    const msg = await this.connectToPhone(document.getElementById('pcc-addr').value, document.getElementById('pcc-code').value, document.getElementById('pcc-pw').value);
                    go.disabled = false; if (msg) st.textContent = msg; });
            }
            phoneBase(addr){ let a = String(addr || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, ''); if (this.servedByPhone() && (!a || a === location.host)) return location.origin; if (!a) return ''; if (!/:\d+$/.test(a)) a += ':8765'; return 'http://' + a; }
            async phoneFetch(path, opts = {}){
                const r = this.remote; const res = await fetch(r.base + path, { ...opts, cache: 'no-store', headers: { 'X-Passcode': r.code, ...(opts.body ? { 'Content-Type': 'application/json' } : {}) } });
                const json = await res.json().catch(() => ({})); return { status: res.status, json };
            }
            /** Connect, fetch the phone's encrypted vault and open it here with the master password. Returns an error message, or '' when open. */
            async connectToPhone(addr, code, pw){
                const base = this.phoneBase(addr); if (!base || !code || !pw) return 'Enter the address, passcode and password.';
                this.remote = { base, code: String(code).trim(), version: 0 };
                let r; try { r = await this.phoneFetch('/hello'); } catch (e) { this.remote = null; return "Can't reach the phone. Check that PC access is started on the phone and that both are on the same Wi-Fi (or this PC is on the phone's hotspot)."; }
                if (r.status === 401) { this.remote = null; return 'Wrong passcode: use the one shown on the phone now.'; }
                if (r.json.app !== 'aifico-ledger') { this.remote = null; return 'That address is not aifico ledger PC access.'; }
                let v; try { v = await this.phoneFetch('/vault'); } catch (e) { this.remote = null; return 'The phone stopped answering. Try again.'; }
                let data; try { data = await this.vault.decryptData(v.json.vault, pw); } catch (e) { this.remote = null; return "That password doesn't open the phone's data."; }
                if (!this.servedByPhone()) { try { localStorage.setItem('aifico_pc_phone', base.replace('http://', '')); } catch (e) {} }
                this.remote.version = v.json.version; this.remote.device = r.json.device || 'phone';
                this.data = this.prepareVaultData(data); this.currentPassword = pw; this.closeModal(); document.getElementById('vault-password').value = '';
                this.enterApp(); this.renderRemoteBanner();
                clearInterval(this._remoteBeat); this._remoteBeat = setInterval(() => this.remoteHeartbeat(), 10000);
                return '';
            }
            /** Every save on this PC goes to the phone, based on the copy last read; if the phone's copy changed meanwhile, reload it. */
            async remotePut(encrypted){
                const r = await this.phoneFetch('/vault', { method: 'PUT', body: JSON.stringify({ base: this.remote.version, vault: encrypted }) });
                if (r.status === 200) { this.remote.version = r.json.version; this.remote.lastOk = Date.now(); this.renderRemoteBanner(); return; }
                if (r.status === 409) { const e = new Error('changed'); e.code = 409; throw e; }
                if (r.status === 401) { const e = new Error('passcode'); e.code = 401; throw e; }
                throw new Error('status ' + r.status);
            }
            async remoteSaveFailed(err){
                if (err && err.code === 409) { alert("Your phone's data changed since this PC read it, so this change was not saved. The latest data from the phone is loaded now; make the change again."); return this.remoteReload(); }
                if (err && err.code === 401) { alert('PC access was stopped or restarted on the phone, so this change was not saved. Connect again with the new passcode.'); return this.disconnectPhone(); }
                this.remote.down = true; this.renderRemoteBanner();
                alert("Couldn't reach your phone, so this change is not saved. Check that PC access is still on and both are on the same Wi-Fi, then make the change again.");
            }
            async remoteReload(){ try { const v = await this.phoneFetch('/vault'); this.data = this.prepareVaultData(await this.vault.decryptData(v.json.vault, this.currentPassword)); this.remote.version = v.json.version; this.remote.down = false; this.renderAll(); this.renderRemoteBanner(); } catch (e) { this.remote.down = true; this.renderRemoteBanner(); } }
            /** Every 10 s: still there? Did the phone save meanwhile? (then load its copy, so the PC never works on an old one) */
            async remoteHeartbeat(){ if (!this.remote) return clearInterval(this._remoteBeat); try { const r = await this.phoneFetch('/hello'); if (r.status === 401) return this.remoteSaveFailed({ code: 401 }); const changed = r.json.version !== this.remote.version; this.remote.down = false; if (changed) await this.remoteReload(); else this.renderRemoteBanner(); } catch (e) { this.remote.down = true; this.renderRemoteBanner(); } }
            renderRemoteBanner(){
                let b = document.getElementById('remote-banner'); if (!this.remote) { b?.remove(); return; }
                if (!b) { b = document.createElement('div'); b.id = 'remote-banner'; b.setAttribute('role', 'status'); document.body.appendChild(b); }
                b.className = this.remote.down ? 'rb-down' : '';
                b.innerHTML = `<i data-lucide="${this.remote.down ? 'wifi-off' : 'smartphone'}"></i><span>${this.remote.down ? "Phone not reachable: changes can't be saved right now" : `Your phone's data (${this.escapeHtml(this.remote.device || 'phone')}) · changes save on the phone`}</span><button type="button" onclick="app.exportVaultBackup()" title="Download a backup of your phone's data to this PC">Back up</button><button type="button" onclick="app.disconnectPhone()">Disconnect</button>`;
                window.lucide?.createIcons?.();
            }
            /** Disconnect: tell the phone, forget the phone's data here and show this PC's own lock screen (its own vault is untouched). */
            async disconnectPhone(){
                const r = this.remote; clearInterval(this._remoteBeat);
                if (r) { try { await fetch(r.base + '/bye', { method: 'POST', headers: { 'X-Passcode': r.code } }); } catch (e) {} }
                this.remote = null; this.currentPassword = null; location.reload();
            }
            /** Actions that would replace or re-key the phone's data are done on the phone, not from a PC session. */
            remoteBlocked(what){ alert(`${what} isn't available while this PC has your phone's data open. Do it on the phone, or disconnect first.`); return true; }
        }
