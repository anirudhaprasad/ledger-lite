// AificoApp methods: core (68 methods). Part of the AificoApp prototype chain.
        class AificoAppCore {
            /**
             * Handles the constructor workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            constructor() {
                this.vault = new AificoVault();
                this.storage = new AificoStorage();
                this.data = this.getDefaultData();
                this.currentPassword = null;
                // Serialize vault writes so concurrent UI actions cannot overwrite newer data with an older save.
                this.saveQueue = Promise.resolve();
                this.charts = {};
                this.parsedImportRows = [];
                this.selectedTransactionIds = new Set();
            }

            /**
             * Creates the initial app data model and default collections/categories.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            getDefaultData() {
                return {
                    accounts: [],
                    categories: ['Food & Dining','Groceries','Rent & Housing','Utilities','Transportation','Shopping','Entertainment','Salary','Investment','Bank Charges','Healthcare','Cash Withdrawal','Transfer','Uncategorized','Other Income'],
                    tx: [], smsInbox: [], budgets: {}, yearly: [], goals: [], shared: [], interestPlans: [],
                    bankProfiles: {}, importHistory: []
                };
            }

            /**
             * Initializes the app, loads persisted data, and wires startup behavior.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            async init() {
                // Login and storage setup must not depend on optional icon/CDN scripts.
                try { window.lucide?.createIcons?.(); } catch (iconError) { console.warn('Optional icon library unavailable:', iconError); }
                const passwordInput = document.getElementById('vault-password');
                const passwordToggle = document.getElementById('vault-password-toggle');
                passwordToggle?.addEventListener('click', () => {
                    const reveal = passwordInput.type === 'password';
                    passwordInput.type = reveal ? 'text' : 'password';
                    passwordToggle.textContent = reveal ? 'Hide' : 'Show';
                    passwordToggle.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
                    passwordToggle.setAttribute('aria-pressed', reveal ? 'true' : 'false');
                    passwordInput.focus();
                });
                passwordInput?.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        document.getElementById('vault-action-btn')?.click();
                    }
                });
                passwordInput?.addEventListener('input', () => this.setVaultLoginStatus('', ''));
                try {
                    await this.storage.ensurePersistentStore();
                } catch (storageInitError) {
                    console.error('AIFICO persistent database initialization failed:', storageInitError);
                    this.setVaultLoginStatus('Persistent storage could not be initialized. Do not reset or erase data. Reload the app or close other AIFICO tabs, then retry. Details: ' + (storageInitError?.message || ''), 'error');
                    // Continue to show the login screen; all write operations remain guarded by storage verification.
                }
                const storedVault = await this.storage.getItem('aifico_vault');
                const persistenceGranted = await this.storage.requestPersistentStorage();
                console.info('AIFICO storage mode:', this.storage.mode, '| browser persistent-storage grant:', persistenceGranted ? 'granted' : 'not granted/unsupported');
                if (!storedVault) {
                    const vaultSubtitle = document.getElementById('vault-subtitle'); if (vaultSubtitle) vaultSubtitle.innerText = 'Create a master password to secure your local financial vault';
                    document.getElementById('vault-action-btn').innerText = 'Initialize Vault';
                    document.getElementById('vault-action-btn').onclick = () => this.createVault();
                    const dh=document.getElementById('vault-default-hint'); if(dh)dh.hidden=false;
                } else {
                    document.getElementById('vault-action-btn').onclick = () => this.unlockVault();
                }

                document.getElementById('vault-restore-file').onchange = (e) => this.restoreVaultBackup(e);
                document.getElementById('vault-reset-link').onclick = () => this.resetVault();
            }

            /**
             * Updates vault login status.
             * Parameters: message, kind = 'error'. Side effects, if any, are described by the statements below.
             */
            setVaultLoginStatus(message, kind = 'error') {
                const status = document.getElementById('vault-login-status');
                if (!status) return;
                status.textContent = message || '';
                status.classList.toggle('hidden', !message);
                status.classList.remove('text-rose-700','bg-rose-50','dark:text-rose-300','dark:bg-rose-950/40','text-emerald-700','bg-emerald-50','dark:text-emerald-300','dark:bg-emerald-950/40');
                if (message) {
                    const success = kind === 'success';
                    status.classList.add(...(success
                        ? ['text-emerald-700','bg-emerald-50','dark:text-emerald-300','dark:bg-emerald-950/40']
                        : ['text-rose-700','bg-rose-50','dark:text-rose-300','dark:bg-rose-950/40']));
                }
            }

            /**
             * Updates vault action busy.
             * Parameters: busy, label. Side effects, if any, are described by the statements below.
             */
            setVaultActionBusy(busy, label) {
                const button = document.getElementById('vault-action-btn');
                if (!button) return;
                if (busy) {
                    button.dataset.originalLabel = button.textContent;
                    button.disabled = true;
                    button.textContent = label || 'Please wait…';
                    button.setAttribute('aria-busy', 'true');
                } else {
                    button.disabled = false;
                    button.textContent = label || button.dataset.originalLabel || 'Unlock Vault';
                    button.removeAttribute('aria-busy');
                }
            }

            /**
             * Creates the encrypted vault after validating password and browser crypto support.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            async createVault() {
                const input = document.getElementById('vault-password');
                // New vaults must use the person's own password. Existing vaults still on 12345 keep unlocking and see the change-password banner.
                const pwd = input.value;
                if (!pwd || pwd.length < 5) {
                    this.setVaultLoginStatus('Choose a master password with at least 5 characters.');
                    input.focus();
                    return;
                }
                if (pwd === '12345') {
                    this.setVaultLoginStatus('12345 is too easy to guess. Choose your own master password.');
                    input.focus();
                    return;
                }
                const button = document.getElementById('vault-action-btn');
                if (button?.disabled) return;
                this.setVaultLoginStatus('', '');
                this.setVaultActionBusy(true, 'Creating vault…');
                try {
                    if (!window.crypto?.subtle || !window.crypto?.getRandomValues) {
                        throw new Error('This browser context does not provide Web Crypto. Open this HTML in a current browser, preferably from localhost or HTTPS, then retry.');
                    }
                    await this.storage.ensurePersistentStore();
                    const existing = await this.storage.getItem('aifico_vault');
                    if (existing) {
                        document.getElementById('vault-action-btn').onclick = () => this.unlockVault();
                        document.getElementById('vault-action-btn').textContent = 'Unlock Vault';
                        throw new Error('An existing vault was found. The app switched to Unlock Vault to protect it.');
                    }
                    const encrypted = await this.vault.encryptData(this.getDefaultData(), pwd);
                    await this.storage.setItem('aifico_vault', encrypted);
                    const saved = await this.storage.getItem('aifico_vault');
                    if (!saved) throw new Error('The new vault could not be read back from persistent storage.');
                    await this.vault.decryptData(saved, pwd);
                    this.currentPassword = pwd; setTimeout(()=>this.checkDefaultPassword(),300);
                    input.value = '';
                    this.enterApp();
                } catch (e) {
                    this.currentPassword = null;
                    this.setVaultLoginStatus('Vault setup failed. No existing vault was intentionally erased. ' + (e?.message || 'Unknown error'), 'error');
                } finally {
                    this.setVaultActionBusy(false);
                }
            }

            /**
             * Authenticates the password and opens the encrypted vault.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            // ---------- Password help (login "?") and the default-password reminder ----------
            passwordHelpHtml(){ return `<h4>First time on this device</h4><ol><li>The screen says <b>Create a master password</b>.</li><li>Type your own password (at least 5 characters). Avoid simple passwords such as a run of numbers.</li><li>Tap <b>Initialize Vault</b>. Your data is encrypted on this device with that password.</li></ol>
<h4>Still using the old default password?</h4><p>Vaults created by earlier versions may still use it, and the app shows a reminder after every unlock. Change it immediately: <b>Backup &amp; Settings → Security → Change password</b>. Until you do, anyone who knows the default can open your data.</p>
<h4>Forgot your password?</h4><p>There is no "forgot password" — the data never leaves your device. You can recover only with a <b>Full Erase backup plus its recovery code</b>. Otherwise use <b>Reset / New Vault</b> (this deletes the data on this device; a normal backup can be restored with its original password).</p>
<h4>Good habits</h4><ul><li>Write your password down somewhere safe.</li><li>Back up regularly: Backup &amp; Settings → Back up now.</li><li>New phone: back up on the old one, then <b>Restore Encrypted Backup</b> on the new one with the same password.</li></ul>`; }
            openPasswordHelp(){
                document.getElementById('pw-help-overlay')?.remove();
                const o=document.createElement('div'); o.id='pw-help-overlay'; o.setAttribute('role','dialog'); o.setAttribute('aria-modal','true'); o.setAttribute('aria-label','Password help');
                o.innerHTML=`<div class="pw-help-box"><div class="pw-help-head"><h3>Your master password</h3><button type="button" aria-label="Close" onclick="document.getElementById('pw-help-overlay').remove()">✕</button></div><div class="pw-help-body">${this.passwordHelpHtml()}</div></div>`;
                o.addEventListener('click',e=>{ if(e.target===o)o.remove(); }); document.body.appendChild(o); o.querySelector('button').focus();
            }
            usingDefaultPassword(){ return this.currentPassword==='12345'; }
            checkDefaultPassword(){
                const on=this.usingDefaultPassword(); let b=document.getElementById('default-pw-banner');
                if(on&&!b){ b=document.createElement('div'); b.id='default-pw-banner'; b.setAttribute('role','alert'); b.innerHTML='<span>You are using the default password <b>12345</b>. Change it now to protect your data.</span><button type="button" onclick="app.openPasswordChangeModal()">Change now</button>'; const scroll=document.getElementById('app-scroll'); scroll?.parentElement?.insertBefore(b,scroll.previousElementSibling?.id==='page-title-bar'?scroll.previousElementSibling:scroll); }
                if(!on&&b)b.remove();
                const sec=document.getElementById('security-default-note'); if(sec)sec.hidden=!on;
            }
            async unlockVault() {
                const input = document.getElementById('vault-password');
                const pwd = input.value;
                if (!pwd) {
                    this.setVaultLoginStatus('Enter your master password to unlock the vault.');
                    input.focus();
                    return;
                }
                const button = document.getElementById('vault-action-btn');
                if (button?.disabled) return;
                this.setVaultLoginStatus('', '');
                this.setVaultActionBusy(true, 'Unlocking vault…');
                try {
                    let stored;
                    try {
                        stored = await this.storage.getItem('aifico_vault');
                    } catch (e) {
                        this.setVaultLoginStatus('Unable to access local vault storage. Your data has not been changed.');
                        return;
                    }
                    if (!stored) {
                        this.setVaultLoginStatus('No existing vault was found. Use Reset / New Vault only if you intend to create a new vault, or restore a verified backup.');
                        return;
                    }
                    try {
                        this.data = await this.vault.decryptData(stored, pwd);
                    } catch (e) {
                        this.setVaultLoginStatus('Could not unlock the vault. Check the password or restore a verified backup if you suspect the vault file is damaged.');
                        input.select();
                        input.focus();
                        return;
                    }
                    this.data.accounts ||= []; this.data.tx ||= []; this.data.smsInbox ||= []; this.data.categories ||= ['Food & Dining','Groceries','Rent & Housing','Utilities','Transportation','Shopping','Entertainment','Salary','Investment','Bank Charges','Healthcare','Cash Withdrawal','Transfer','Uncategorized','Other Income']; this.data.budgets ||= {}; this.data.yearly ||= []; this.data.goals ||= []; this.data.shared ||= []; this.data.members ||= []; this.data.bankProfiles ||= {}; this.data.importHistory ||= [];
                    this.currentPassword = pwd; setTimeout(()=>this.checkDefaultPassword(),300); setTimeout(()=>{ try{ this.afterUnlock?.(); }catch(e){ console.error(e); } },900); // e.g. the Developer edition checks the phone for new bank SMS
                    input.value = '';
                    this.enterApp();
                } finally {
                    this.setVaultActionBusy(false);
                }
            }

            /**
             * Saves the current app data into the encrypted vault.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            async saveVault() {
                if (!this.currentPassword) return false;
                // Snapshot synchronously at the moment save is requested. Encrypting the live object after an
                // await allowed later edits to leak into earlier saves and concurrent writes to finish out of order.
                let snapshot;
                try {
                    snapshot = JSON.parse(JSON.stringify(this.data));
                } catch (err) {
                    console.error('Vault save snapshot failed:', err);
                    alert('Your changes could not be saved because the data snapshot failed. Do not close this page; export a backup if possible.');
                    return false;
                }
                const password = this.currentPassword;
                const write = this.saveQueue.catch(() => {}).then(async () => {
                    const encrypted = await this.vault.encryptData(snapshot, password);
                    await this.storage.setItem('aifico_vault', encrypted);
                    return true;
                });
                this.saveQueue = write;
                try {
                    return await write;
                } catch (err) {
                    console.error('Vault save failed:', err);
                    alert('The vault could not be saved to browser storage. Your latest changes may not be persistent. Please export a verified backup before leaving this page.');
                    return false;
                }
            }

            /**
             * Handles the enter app workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            enterApp() {
                document.getElementById('vault-screen').classList.add('hidden');
                document.getElementById('main-layout').classList.remove('hidden');
                this.renderAll();
            }

            /**
             * Handles the lock vault workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            lockVault() {
                this.currentPassword = null;
                this.data = this.getDefaultData();
                document.getElementById('main-layout').classList.add('hidden');
                document.getElementById('vault-screen').classList.remove('hidden');
                document.getElementById('vault-password').value = '';
            }

            /**
             * Performs a guarded vault reset, including recovery/backup safeguards.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            async resetVault() {
                const stored = await this.storage.getItem('aifico_vault');
                if (!stored) {
                    await this.uiDialog('No vault found','No existing vault was found. You are already at the new-vault setup screen. Enter a new master password and choose Initialize Vault.',{type:'notice'});
                    return;
                }

                // Allow Reset / New Vault directly from the login screen. Prefer the
                // password already entered in the login field; prompt only if it is blank.
                let resetPassword = this.currentPassword || document.getElementById('vault-password').value || '';
                if (!resetPassword) {
                    resetPassword = await this.uiDialog('Verify current master password','Enter the current vault master password to authorize Zero Reset. No data will change if verification fails.',{type:'input',inputType:'password',okLabel:'Verify',cancelLabel:'Cancel'});
                }
                if (resetPassword === null || resetPassword === undefined || resetPassword.length === 0) {
                    await this.uiDialog('Reset cancelled','Your current vault has not been changed.',{type:'notice'});
                    return;
                }
                let verifiedData;
                try {
                    verifiedData = await this.vault.decryptData(stored, resetPassword);
                    if (!verifiedData || typeof verifiedData !== 'object' || !Array.isArray(verifiedData.tx) || !Array.isArray(verifiedData.accounts)) throw new Error('Vault structure validation failed');
                } catch (e) {
                    await this.uiDialog('Verification failed','The current vault password is incorrect or the vault cannot be verified. No data was changed.',{type:'notice',danger:true});
                    return;
                }
                // Keep the authenticated password available for backup creation and the
                // final pre-delete authentication even when Reset started from login.
                this.currentPassword = resetPassword;
                this.data = verifiedData;
                const wantsBackup = await this.uiDialog('Step 1 · Create a verified backup','A full encrypted backup is required before Reset can continue. It includes Core Ledger, Accounts & Wallets, yearly and recurring schedules, goals, shared splits and members, categories, budgets, and supported settings. Choose Continue to create the backup, or Cancel to leave all data unchanged.',{type:'confirm',okLabel:'Create backup',cancelLabel:'Cancel'});
                if (!wantsBackup) return;
                const backupCreated = await this.exportVaultBackup(true);
                if (backupCreated !== true) {
                    await this.uiDialog('Reset stopped','A verified backup was not created. Your current vault has not been changed.',{type:'notice',danger:true});
                    return;
                }
                const downloadConfirmed = await this.uiDialog('Confirm backup download','Did you download the verified Full Erase backup and securely save the recovery code shown by the app? You need BOTH the backup file and the recovery code to recover the data if you forget the master password. Cancel if either is missing; your vault will remain unchanged.',{type:'confirm',okLabel:'Yes, backup saved',cancelLabel:'Cancel'});
                if (!downloadConfirmed) return;
                const typed = await this.uiDialog('Step 2 · Confirm permanent reset','This removes the active vault from this browser and starts a new user setup. It does not delete the downloaded backup file. Type RESET to continue.',{type:'input',okLabel:'Continue',cancelLabel:'Cancel',danger:true});
                if (typed !== 'RESET') {
                    await this.uiDialog('Reset cancelled','The confirmation did not match RESET. Your current vault has not been changed.',{type:'notice'});
                    return;
                }
                const finalConfirm = await this.uiDialog('Final warning · Start as a new user','All active vault data will be removed from this browser: Core Ledger transactions (including excluded entries), accounts, categories, subcategories, budgets, yearly and recurring schedules, goals, shared expenses and members, salary schedule, bank profiles, import history, and settings. A fresh vault will start with default categories and no financial records. Continue only if your verified backup is safely stored.',{type:'confirm',okLabel:'Reset vault',cancelLabel:'Keep my data',danger:true});
                if (!finalConfirm) return;
                // Creating the verified backup flushes pending saves and may re-encrypt
                // the same vault, so ciphertext equality with the pre-backup snapshot is
                // not a reliable change detector. Re-read and authenticate the current
                // vault immediately before deletion instead.
                const currentStored = await this.storage.getItem('aifico_vault');
                if (!currentStored) {
                    await this.uiDialog('Reset stopped','The active vault is no longer available. No additional data was removed. Please reopen the app and verify its state.',{type:'notice',danger:true});
                    return;
                }
                try {
                    const currentData = await this.vault.decryptData(currentStored, resetPassword);
                    if (!currentData || typeof currentData !== 'object' || !Array.isArray(currentData.tx) || !Array.isArray(currentData.accounts)) {
                        throw new Error('Vault structure validation failed');
                    }
                } catch (e) {
                    await this.uiDialog('Reset stopped','The current vault could not be authenticated with the verified master password. No data was removed.',{type:'notice',danger:true});
                    return;
                }
                try {
                    await this.storage.removeVaultData();
                    if (await this.storage.getItem('aifico_vault') !== null) throw new Error('The active vault could not be removed.');
                    // Reopen and verify the persistent DB connection after clearing the old vault.
                    // Keep the database schema; the next initialization creates a fresh encrypted vault record.
                    this.storage.dbPromise = null;
                    await this.storage.ensurePersistentStore();
                    if (await this.storage.getItem('aifico_vault') !== null) throw new Error('The persistent database still contains an active vault after reset.');
                    this.currentPassword = null;
                    this.data = this.getDefaultData();
                    await this.uiDialog('Reset complete','The active vault and saved pre-restore recovery snapshots have been removed from this browser. Downloaded backup files are not deleted. Reloading will let you create a new master password and start with default categories and no financial records.',{type:'notice'});
                    location.reload();
                } catch (err) {
                    await this.uiDialog('Reset could not be verified','The app could not verify that the active vault was removed. Please do not continue making changes until you check the vault state.',{type:'notice',danger:true});
                }
            }

            // ---------- Editions: Lite (free) and Pro ----------
            /**
             * Returns or checks is pro.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            isPro(){ return true; }
            /**
             * Updates name.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            editionName(){ return this.isDeveloper()?'Developer':this.isPro()?'Pro':'Lite'; }
            /**
             * Handles the pro feature info workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: key. Side effects, if any, are described by the statements below.
             */
            proFeatureInfo(key){ return ({
                yearly:['Schedules','Scheduled payments, salary auto-entries, and loans, FDs and RDs with bank-style interest.'],
                goals:['Goals','Savings goals with targets, deadlines and contributions.'],
                shared:['Shared & Split','Shared expenses and split settlements with family and friends.'],
                sms:['SMS import & reconciliation','Read bank SMS, match them with Core Ledger and merge only what is missing.'],
                importer:['Bank statement import','Import Excel, CSV, XML or OFX statements and review them before adding.'],
                spreadsheet:['Money Manager spreadsheet sync','Import and export your ledger as Excel or CSV for Money Manager.'],
                card:['Credit card statements','Statement cycles, due dates, minimum due, and Settled/Unsettled spends.'],
                plans:['Loans, FDs & RDs','EMIs, FD and RD maturity, activation and automatic Core Ledger entries.'],
                accounts:['More than 3 accounts','Lite includes up to 3 accounts. Pro has no limit.']})[key]||['This feature','Available in aifico Pro.']; }
            /**
             * Handles the require pro workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: key. Side effects, if any, are described by the statements below.
             */
            requirePro(key){
                if(this.isPro())return true;
                const [title,desc]=this.proFeatureInfo(key); const url=String(window.AIFICO_PRO_STORE_URL||'');
                const box=document.getElementById('modal-box');
                box.innerHTML=`<div class="pro-gate"><span class="pro-badge">PRO</span><h3 class="font-bold text-lg">${this.escapeHtml(title)}</h3><p class="text-sm text-slate-600 dark:text-slate-300">${this.escapeHtml(desc)}</p><p class="text-sm text-slate-500">This is part of <strong>aifico Pro</strong>. Your data stays the same: a backup from Lite restores into Pro with nothing lost.</p><div class="ip-form-actions">${url?`<button type="button" class="s-btn s-secondary" onclick="app.closeModal()">Not now</button><a class="s-btn s-primary" href="${this.escapeHtml(url)}" target="_blank" rel="noopener">Get aifico Pro</a>`:`<button type="button" class="s-btn s-primary" style="grid-column:1/-1" onclick="app.closeModal()">OK</button>`}</div></div>`;
                document.getElementById('modal-container').classList.remove('hidden');
                return false;
            }
            /**
             * Handles the apply edition workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            applyEdition(){
                const pro=this.isPro(); if(!this.isDeveloper())document.querySelectorAll('[data-dev-only]').forEach(e=>e.remove()); document.body.classList.toggle('edition-lite',!pro); document.body.classList.toggle('edition-pro',pro);
                // Version from js/04-version.js: "Money Manager v1.2610.85 · Developer" (the edition is a word, not a letter on the number)
                const v=window.aificoVersion?window.aificoVersion():{label:'',detail:''}; const label=`Money Manager ${v.label} · ${this.editionName()}`;
                document.querySelectorAll('[data-app-version]').forEach(el=>{el.textContent=`${v.label} · ${this.editionName()} · ${v.detail}`;});
                document.querySelectorAll('[data-edition-label]').forEach(el=>{el.textContent=label;});
                document.querySelectorAll('[data-edition-title]').forEach(el=>{el.textContent=`aifico Money Manager ${this.editionName()}`;});
                document.title=`aifico Money Manager ${v.label} · ${this.editionName()}`;
                if(!pro){
                    ['yearly','goals','shared'].forEach(t=>document.querySelectorAll(`#app-sidebar [data-tab="${t}"]`).forEach(b=>{ if(!b.querySelector('.pro-badge'))b.insertAdjacentHTML('beforeend','<span class="pro-badge pro-badge-sm">PRO</span>'); }));
                    document.querySelectorAll('.set-card .set-title').forEach(h=>{ if(/^(Import|Money Manager spreadsheet)$/.test(h.textContent.trim())&&!h.querySelector('.pro-badge'))h.insertAdjacentHTML('beforeend',' <span class="pro-badge pro-badge-sm">PRO</span>'); });
                    const sched=document.querySelector('#bottom-nav button[data-tab="yearly"]');
                    if(sched){ sched.dataset.tab='budgets'; sched.setAttribute('onclick',"app.switchTab('budgets')"); sched.innerHTML='<i data-lucide="pie-chart"></i><span>Budgets</span>'; window.lucide?.createIcons?.(); }
                }
            }
            // ---------- Projects (Developer edition): a purchase or job tracked step by step, with money spent per step ----------
            /**
             * Returns or checks is developer.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            isDeveloper(){ return true; }
            // ---------- One balance rule for every manual add, edit and delete ----------
            // Income adds; Expense, EMI, Installment, Insurance, Investment subtract; a Transfer moves money from source to destination.
            /**
             * Handles the tx effects workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: t. Side effects, if any, are described by the statements below.
             */
            txEffects(t){
                const a=Math.abs(Number(t&&t.amount)||0); if(!t||!a)return [];
                if(t.type==='Income')return [{account:t.account,delta:a}];
                if(t.type==='Transfer'){ if(t.transferDirection==='in')return [{account:t.account,delta:a}]; if(t.transferDirection==='out')return [{account:t.account,delta:-a}]; const dest=t.destinationAccount||t.toAccount; return dest&&dest!==t.account?[{account:t.account,delta:-a},{account:dest,delta:a}]:[{account:t.account,delta:-a}]; }
                return [{account:t.account,delta:-a}];
            }
            /**
             * Applies or reverses the balance effects of a transaction on its account(s).
             * Parameters: t,sign. Side effects, if any, are described by the statements below.
             */
            applyTxEffects(t,sign){ if(!t||t.balanceEffectRemoved)return; this.txEffects(t).forEach(e=>{ const acc=(this.data.accounts||[]).find(x=>x.name===e.account); if(acc)acc.balance=Math.round(((Number(acc.balance)||0)+sign*e.delta)*100)/100; }); }

            // ---------- UUID on every record: stored in the database and exports, never shown on screen ----------
            /**
             * Handles the new uid workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: ){ try{ if(window.crypto&&crypto.randomUUID)return crypto.randomUUID(); }catch(e. Side effects, if any, are described by the statements below.
             */
            newUid(){ try{ if(window.crypto&&crypto.randomUUID)return crypto.randomUUID(); }catch(e){} return 'u-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12); }
            /**
             * Handles the ensure uids workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            ensureUids(){
                const D=this.data; if(!D)return false; let changed=false;
                // one name per account type (older versions stored synonyms such as "Credit" and "Credit Card")
                const canon={'Savings Account':'Savings','Investment Account':'Investment','Fixed Deposit Account':'Fixed Deposit','RD':'Recurring Deposit','Credit':'Credit Card','Loan':'Loan Account'};
                (D.accounts||[]).forEach(a=>{ if(a&&canon[a.type]){ a.type=canon[a.type]; changed=true; } });
                if(D.splitShare){ const ss=D.splitShare; ['trips','expenses','settlements'].forEach(k=>(ss[k]||[]).forEach(r=>{ if(r&&!r.uid){ r.uid=r.id||this.newUid(); changed=true; } })); }
                const tag=arr=>{ (Array.isArray(arr)?arr:[]).forEach(r=>{ if(r&&typeof r==='object'&&!r.uid){ r.uid=this.newUid(); changed=true; } }); };
                ['tx','accounts','goals','yearly','interestPlans','projects','smsInbox','shared'].forEach(k=>tag(D[k])); (D.projects||[]).forEach(p=>tag(p.steps));
                // The same UUID twice in Core Ledger = the same record entered twice (e.g. a backup or export imported again)
                const seen=new Map();
                for(const t of (D.tx||[])){ if(!t||!t.uid)continue; const prev=seen.get(t.uid); if(!prev){ seen.set(t.uid,t); continue; }
                    const same=['date','type','amount','account','destinationAccount','payee'].every(k=>String(prev[k]??'')===String(t[k]??''));
                    if(same){ if(!t.excludedFromLedger){ t.excludedFromLedger=true; t.duplicateReason='Same UUID as another entry'; changed=true; } }
                    else { t.uid=this.newUid(); changed=true; } }
                return changed;
            }

            // ---------- Swipe left/right between pages (phones and tablets) ----------
            /**
             * Handles the swipe pages workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            swipePages(){ return ['dashboard','ledger','stats','budgets','accounts','yearly','goals','shared','guide','configuration','settings','sms'].filter(t=>document.getElementById('panel-'+t)&&(t!=='projects'||this.isDeveloper())&&(this.isPro()||!['yearly','goals','shared','sms'].includes(t))); }
            /**
             * Handles the swipe enabled workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: ){ try{ return localStorage.getItem('aifico_swipe')!=='off'; }catch(e. Side effects, if any, are described by the statements below.
             */
            swipeEnabled(){ try{ return localStorage.getItem('aifico_swipe')!=='off'; }catch(e){ return true; } }
            /**
             * Updates swipe enabled.
             * Parameters: on){ try{ localStorage.setItem('aifico_swipe',on?'on':'off'); }catch(e. Side effects, if any, are described by the statements below.
             */
            setSwipeEnabled(on){ try{ localStorage.setItem('aifico_swipe',on?'on':'off'); }catch(e){} }
            /**
             * Handles the init swipe workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            initSwipe(){
                const area=document.getElementById('app-scroll'); if(!area||area.dataset.swipe)return; area.dataset.swipe='1'; let s=null;
                const blocked=el=>{ for(let n=el;n&&n!==area;n=n.parentElement){ if(/^(INPUT|SELECT|TEXTAREA|CANVAS|BUTTON)$/.test(n.tagName))return true; const cs=getComputedStyle(n); if(/(auto|scroll)/.test(cs.overflowX)&&n.scrollWidth>n.clientWidth+2)return true; } return false; };
                const busy=()=>!document.getElementById('modal-container')?.classList.contains('hidden')||!!document.getElementById('aifico-calculator-overlay')||document.getElementById('aifico-alert-overlay')?.style.display==='flex'||document.getElementById('ledger-bulk-bar')?.dataset.hasSelection==='1'||document.getElementById('app-sidebar')?.classList.contains('mobile-nav-open');
                area.addEventListener('touchstart',e=>{ s=null; if(e.touches.length!==1||!this.swipeEnabled()||busy())return; const t=e.touches[0]; if(t.clientX<24||t.clientX>window.innerWidth-24||blocked(e.target))return; s={x:t.clientX,y:t.clientY,at:Date.now()}; },{passive:true});
                area.addEventListener('touchend',e=>{ if(!s)return; const t=e.changedTouches[0]; const dx=t.clientX-s.x, dy=t.clientY-s.y, dt=Date.now()-s.at; s=null;
                    if(dt>700||Math.abs(dx)<70||Math.abs(dx)<Math.abs(dy)*1.6||busy())return;
                    const pages=this.swipePages(); const i=pages.indexOf(this.currentTab); if(i<0)return; const j=i+(dx<0?1:-1); if(j<0||j>=pages.length)return;
                    this.switchTab(pages.at(j)); const panel=document.getElementById('panel-'+pages.at(j)); if(panel){ panel.classList.remove('swipe-in-left','swipe-in-right'); void panel.offsetWidth; panel.classList.add(dx<0?'swipe-in-left':'swipe-in-right'); }
                    document.getElementById('app-scroll').scrollTop=0; },{passive:true});
            }
            // ---------- Locale-aware examples and a calculator on every money field ----------
            // Amounts are in rupees, so Indian grouping (1,00,000) is used; an Indian-region language on the phone (e.g. hi-IN, mr-IN) is respected.
            /**
             * Handles the ui locale workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: ){ const l=(navigator.languages&&navigator.languages[0])||navigator.language||''; try{ if(/-IN$/i.test(l)){ new Intl.NumberFormat(l); return l; } }catch(e. Side effects, if any, are described by the statements below.
             */
            uiLocale(){ const l=(navigator.languages&&navigator.languages[0])||navigator.language||''; try{ if(/-IN$/i.test(l)){ new Intl.NumberFormat(l); return l; } }catch(e){} return 'en-IN'; }
            /**
             * Formats or safely prepares example money for display.
             * Parameters: n){ try{ return new Intl.NumberFormat(this.uiLocale(),{style:'currency',currency:'INR',maximumFractionDigits:Number.isInteger(n)?0:2}).format(n); }catch(e. Side effects, if any, are described by the statements below.
             */
            formatExampleMoney(n){ try{ return CUR()+new Intl.NumberFormat(this.uiLocale(),{maximumFractionDigits:Number.isInteger(n)?0:2}).format(n); }catch(e){ return CUR()+n; } }
            /**
             * Formats or safely prepares example percent for display.
             * Parameters: n){ try{ return new Intl.NumberFormat(this.uiLocale(),{style:'percent',maximumFractionDigits:2}).format(n/100); }catch(e. Side effects, if any, are described by the statements below.
             */
            formatExamplePercent(n){ try{ return new Intl.NumberFormat(this.uiLocale(),{style:'percent',maximumFractionDigits:2}).format(n/100); }catch(e){ return n+'%'; } }
            /**
             * Returns or checks is money field.
             * Parameters: ctl,labelText. Side effects, if any, are described by the statements below.
             */
            isMoneyField(ctl,labelText){
                if(!ctl||ctl.tagName!=='INPUT'||ctl.type!=='number')return false;
                if(ctl.dataset.money==='0')return false; if(ctl.dataset.money==='1')return true;
                const t=String(labelText||'')+' '+(ctl.getAttribute('aria-label')||'');
                if(/%|percent|\b(rate|years?|yrs?|months?|days?|tenure|count)\b|instal?ments? paid/i.test(t))return false;
                return /₹|amount|balance|value|cost|price|limit|instal?ment|salary|contribution|target|saved|principal|spent|payment|budget|deposit|fee|emi|minimum due|at least|income|expense/i.test(t);
            }
            /**
             * Handles the localise field workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: ctl,labelText. Side effects, if any, are described by the statements below.
             */
            localiseField(ctl,labelText){
                if(!ctl||ctl.tagName!=='INPUT'||ctl.type!=='number'||ctl.dataset.localised)return; ctl.dataset.localised='1';
                const ph=String(ctl.getAttribute('placeholder')||'').trim(); const digits=(ph.match(/-?\d[\d,]*\.?\d*/)||[])[0]; const n=digits?Number(digits.replace(/,/g,'')):NaN;
                const percent=/%/.test(String(labelText||''));
                if(this.isMoneyField(ctl,labelText)){ const t=String(labelText||''); const guess=/limit/i.test(t)?200000:/target|cost|value|principal|loan/i.test(t)?500000:/salary|income/i.test(t)?75000:/balance/i.test(t)?25000:/at least|minimum/i.test(t)?200:/contribution|instal?ment|deposit/i.test(t)?10000:2500; const ex=Number.isFinite(n)&&n>0?n:guess; ctl.setAttribute('placeholder','e.g. '+this.formatExampleMoney(ex)); }
                else if(percent&&Number.isFinite(n)){ ctl.setAttribute('placeholder','e.g. '+this.formatExamplePercent(n)); }
            }
            /**
             * Handles the add calculator workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: field,ctl,labelText. Side effects, if any, are described by the statements below.
             */
            addCalculator(field,ctl,labelText){
                if(!this.isMoneyField(ctl,labelText)||field.querySelector(':scope > .fl-calc'))return;
                if(!ctl.id)ctl.id='money-'+Math.random().toString(36).slice(2,9);
                field.querySelectorAll('button').forEach(b=>{ if(/openAmountCalculator/.test(b.getAttribute('onclick')||''))b.remove(); });
                const b=document.createElement('button'); b.type='button'; b.className='fl-calc'; b.textContent='🧮'; b.title='Calculator'; b.setAttribute('aria-label','Open calculator for '+String(labelText||'amount').trim());
                b.addEventListener('click',e=>{ e.preventDefault(); e.stopPropagation(); this.openAmountCalculator(ctl.id); });
                ctl.after(b); field.classList.add('has-calc');
            }
            // ---------- Compact fields: floating labels, hints shown as placeholders (and behind an ⓘ once filled) ----------
            /**
             * Handles the enhance fields workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: root. Side effects, if any, are described by the statements below.
             */
            enhanceFields(root){
                // Older forms (e.g. New Transaction): <div class="space-y-1"><label>Text</label><input></div> → same floating style
                (root||document).querySelectorAll('.space-y-1').forEach(w=>{ const lab=w.firstElementChild; if(!lab||lab.tagName!=='LABEL')return; const ctl=[...w.children].find(c=>/^(INPUT|SELECT|TEXTAREA)$/.test(c.tagName)&&!/^(checkbox|radio|file)$/.test(c.type)); if(!ctl)return;
                    const sp=document.createElement('span'); sp.textContent=lab.textContent.trim(); w.replaceChild(sp,lab); w.classList.remove('space-y-1'); w.classList.add('ip-field'); if(!ctl.getAttribute('aria-label'))ctl.setAttribute('aria-label',sp.textContent); });
                // <label>Text <input></label> forms (e.g. Edit Account) → same style
                (root||document).querySelectorAll('label:not(.ip-field):not(.lh-opt):not(.gp-type)').forEach(l=>{ const ctl=[...l.children].find(c=>/^(INPUT|SELECT|TEXTAREA)$/.test(c.tagName)&&!/^(checkbox|radio|file)$/.test(c.type)); if(!ctl)return; const t=[...l.childNodes].find(n=>n.nodeType===3&&n.textContent.trim()); if(!t||l.firstElementChild!==ctl&&l.firstElementChild?.tagName!=='INPUT'&&l.firstElementChild?.tagName!=='SELECT'&&l.firstElementChild?.tagName!=='TEXTAREA')return;
                    const sp=document.createElement('span'); sp.textContent=t.textContent.trim(); l.replaceChild(sp,t); l.insertBefore(sp,l.firstChild); l.classList.add('ip-field'); ctl.classList.remove('mt-1'); });
                (root||document).querySelectorAll('.ip-field:not(.fl)').forEach(f=>{
                    const label=f.querySelector(':scope > span'); const ctl=f.querySelector(':scope > input:not([type=checkbox]):not([type=radio]), :scope > select, :scope > textarea');
                    if(!label||!ctl)return;
                    f.classList.add('fl');
                    const labelText=label.textContent.trim(); this.localiseField(ctl,labelText); this.addCalculator(f,ctl,labelText);
                    const hint=f.querySelector(':scope > .gp-hint, :scope > small');
                    if(ctl.tagName!=='SELECT'&&ctl.type!=='date'){
                        if(hint&&!ctl.getAttribute('placeholder'))ctl.setAttribute('placeholder',hint.textContent.trim());
                        if(!ctl.getAttribute('placeholder'))ctl.setAttribute('placeholder',' ');
                    }
                    if(hint){ hint.classList.add('fl-hint'); const b=document.createElement('button'); b.type='button'; b.className='fl-info'; b.textContent='i'; b.setAttribute('aria-label','About '+label.textContent.trim()); b.setAttribute('aria-expanded','false'); b.title=hint.textContent.trim();
                        b.addEventListener('click',e=>{ e.preventDefault(); e.stopPropagation(); const on=f.classList.toggle('show-hint'); b.setAttribute('aria-expanded',String(on)); });
                        label.appendChild(b); }
                });
            }
            /**
             * Validates and saves  ledger header prefs.
             * Parameters: p){ try{ localStorage.setItem('aifico_ledger_header',JSON.stringify(p)); }catch(e. Side effects, if any, are described by the statements below.
             */
            saveLedgerHeaderPrefs(p){ try{ localStorage.setItem('aifico_ledger_header',JSON.stringify(p)); }catch(e){} this.applyLedgerHeader(); }
            // Backup & Settings: an icon on every card; descriptions sit behind an ⓘ button
            decorateSettings(){
                const icons={'backup & restore':'archive-restore','default account':'landmark','navigation':'navigation','import':'file-down','money manager spreadsheet':'sheet','data health':'heart-pulse','security':'shield-check','sms entries in core ledger':'message-square','erase all data':'trash-2','reconciliation':'scale'};
                document.querySelectorAll('#panel-settings .set-card').forEach(card=>{ if(card.dataset.decorated)return; const h=card.querySelector('.set-title'); if(!h)return; card.dataset.decorated='1';
                    const key=h.childNodes[0]?.textContent?.trim().toLowerCase()||h.textContent.trim().toLowerCase(); const ic=icons[Object.keys(icons).find(k=>key.startsWith(k))]||'settings';
                    h.insertAdjacentHTML('afterbegin',`<i data-lucide="${ic}" class="set-ic"></i>`);
                    const info=[...card.querySelectorAll(':scope > .set-desc')].filter(d=>!d.id);
                    if(info.length){ const b=document.createElement('button'); b.type='button'; b.className='set-info'; b.textContent='i'; b.setAttribute('aria-label','About '+h.textContent.trim()); b.setAttribute('aria-expanded','false'); b.addEventListener('click',()=>{ const on=card.classList.toggle('show-info'); b.setAttribute('aria-expanded',String(on)); }); h.appendChild(b); info.forEach(d=>d.classList.add('set-info-text')); }
                });
                window.lucide?.createIcons?.();
            }
            // ---------- Header (app level) and Page Title (page level) ----------
            setupPageTitleBar(){
                const hdrLeft=document.getElementById('hdr-app')?.parentElement; const title=document.getElementById('tab-title'), meta=document.getElementById('ptb-meta');
                if(hdrLeft&&title&&!hdrLeft.querySelector('#tab-title')){ const box=document.createElement('div'); box.className='hdr-title'; box.appendChild(title); if(meta)box.appendChild(meta); hdrLeft.appendChild(box); document.getElementById('hdr-app')?.remove(); }
                const act=document.getElementById('header-page-action'), plus=document.querySelector('#app-main-header button[onclick="app.openTransactionModal()"]'); if(act&&plus&&act.nextElementSibling!==plus)plus.parentElement.insertBefore(act,plus);
                const tools=document.querySelector('#ptb-tools [data-ptb="ledger"]'); const sticky=document.getElementById('ledger-sticky');
                if(tools&&sticky&&sticky.parentElement!==tools)tools.appendChild(sticky);
            }
            syncHeadSelect(){ const main=document.getElementById('ledger-select-all'), head=document.getElementById('ledger-select-all-head'); if(!head)return; const n=this.selectedTransactionIds?.size||0; head.checked=!!main?.checked; head.indeterminate=n>0&&!head.checked; }
            renderPageTitle(tab){
                tab=tab||this.currentTab||'dashboard'; const bar=document.getElementById('page-title-bar'); if(!bar)return;
                document.querySelectorAll('#ptb-tools [data-ptb]').forEach(el=>{ el.hidden=el.dataset.ptb!==tab; });
                const meta=document.getElementById('ptb-meta'); if(meta)meta.textContent='';
                const crumb=document.getElementById('hdr-crumb'); if(crumb)crumb.textContent=new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
                const D=this.data||{}; const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`; const month=new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'});
                const metaFor={ledger:()=>plural(Number(String(document.getElementById('ledger-total-count')?.textContent||'0').replace(/[^0-9]/g,''))||0,'transaction'),
                    budgets:()=>`${plural(Object.keys(D.budgets||{}).length,'category')} · ${month}`.replace('categorys','categories'),
                    accounts:()=>plural((D.accounts||[]).length,'account'), yearly:()=>plural((D.yearly||[]).length,'schedule'),
                    goals:()=>plural((D.goals||[]).length,'goal'), projects:()=>plural((D.projects||[]).length,'project'),
                    shared:()=>{ const t=(D.splitShare?.trips||[]); return `${plural(t.filter(x=>!x.closed).length,'open event')}`; },
                    configuration:()=>plural((D.categories||[]).length,'category').replace('categorys','categories'),
                    sms:()=>plural((D.smsInbox||[]).filter(x=>(x.status||'pending')==='pending').length,'SMS')+' to review',
                    settings:()=>'', guide:()=>'', importer:()=>'', dashboard:()=>month,
                    stats:()=>{ const s=this.statsState?.(); if(!s)return ''; return (s.mode==='year'?s.key:this.monthLabel(s.key,true))+' · '+(s.kind==='income'?'Income':'Expenses'); }};
                if(meta){ try{ meta.textContent=(metaFor[tab]||(()=>''))(); }catch(e){ meta.textContent=''; } }
                // The dashboard's monthly figures are in its own tiles, so the title bar shows only the month.
                if(tab==='dashboard'&&meta)meta.textContent=new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'});
            }
            // ---------- Title bar: one page title, the page's main action at the far right ----------
            /**
             * Handles the header actions workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            headerActions(){ return {budgets:['Set Budget',/^set budget$/i],accounts:['Add Account',/^add account$/i],goals:['Add Goal',/^add goal$/i],projects:['New Project',/new project/i],shared:['New event',null,"app.ssEventForm()"],configuration:['Add Category',/^add category$/i,'app.toggleCategoryEdit(true);app.addCategory()']}; }
            /**
             * Handles the sync header action workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: tab. Side effects, if any, are described by the statements below.
             */
            syncHeaderAction(tab){
                const slot=document.getElementById('header-page-action'); if(!slot)return; const cfg=this.headerActions()[tab]; const panel=document.getElementById('panel-'+tab);
                slot.innerHTML=''; slot.hidden=!cfg; document.body.classList.toggle('has-page-action',!!cfg); if(!cfg||!panel)return;
                let handler=cfg[2]||'';
                if(cfg[1]){ const src=[...panel.querySelectorAll('button')].find(b=>cfg[1].test(b.textContent.trim())); if(src){ handler=handler||src.getAttribute('onclick')||''; src.classList.add('moved-to-header'); } }
                if(!handler)return; const b=document.createElement('button'); b.type='button'; b.className='hdr-action'; b.setAttribute('onclick',handler); b.innerHTML='<i data-lucide="plus"></i><span>'+cfg[0]+'</span>'; slot.appendChild(b); window.lucide?.createIcons?.();
            }
            /**
             * Handles the hide duplicate titles workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: tab. Side effects, if any, are described by the statements below.
             */
            hideDuplicateTitles(tab){
                if(tab==='settings')return; // its cards are sections (Backup & restore, Security…), not repeats of the page title
                const panel=document.getElementById('panel-'+tab); if(!panel)return; const title=(document.getElementById('tab-title')?.textContent||'').toLowerCase();
                const words=t=>String(t).toLowerCase().replace(/&/g,' ').split(/[^a-z]+/).filter(w=>w.length>2&&!['and','the','expenses','overview','financial','monthly','statement','unified','allocation','savings'].includes(w));
                const tw=words(title); const h=panel.querySelector('h2, h3'); if(!h||!tw.length)return; const hw=words(h.textContent);
                const overlap=hw.filter(w=>tw.some(x=>x.startsWith(w.slice(0,5))||w.startsWith(x.slice(0,5)))).length;
                if(hw.length&&overlap/Math.max(hw.length,1)>=0.5)h.classList.add('dup-title');
                // a header row left with nothing visible (title hidden, button moved to the title bar) is removed too
                let row=h.parentElement; for(let k=0;k<3&&row&&row!==panel;k++){ const visible=[...row.children].some(c=>!c.classList.contains('dup-title')&&!c.classList.contains('moved-to-header')&&c.offsetParent!==null&&(c.textContent.trim()||c.querySelector('input,select,button:not(.moved-to-header)'))); if(visible)break; row.classList.add('dup-title'); row=row.parentElement; }
            }
            // ---------- Navigation: side menu on PC, bottom bar on phones/tablets (user can choose) ----------
            /**
             * Handles the nav mode workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: ){ try{ return localStorage.getItem('aifico_nav_mode')||'auto'; }catch(e. Side effects, if any, are described by the statements below.
             */
            navMode(){ try{ return localStorage.getItem('aifico_nav_mode')||'auto'; }catch(e){ return 'auto'; } }
            /**
             * Handles the apply nav mode workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            applyNavMode(){
                const mode=this.navMode(); const narrow=window.matchMedia('(max-width: 1023px)').matches; const touch=window.matchMedia('(pointer: coarse)').matches;
                const bottom=narrow&&(mode==='bottom'||(mode==='auto'&&touch));
                document.body.classList.toggle('nav-bottom',bottom); if(bottom)this.closeNavigation();
                const sel=document.getElementById('nav-mode-select'); if(sel&&sel.value!==mode)sel.value=mode; const sw=document.getElementById('swipe-toggle'); if(sw)sw.checked=this.swipeEnabled();
                this.syncBottomNav();
            }
            /**
             * Updates nav mode.
             * Parameters: v){ try{ localStorage.setItem('aifico_nav_mode',v); }catch(e. Side effects, if any, are described by the statements below.
             */
            setNavMode(v){ try{ localStorage.setItem('aifico_nav_mode',v); }catch(e){} this.applyNavMode(); }
            /**
             * Handles the sync bottom nav workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: tab. Side effects, if any, are described by the statements below.
             */
            syncBottomNav(tab){
                tab=tab||this.currentTab||'dashboard'; const main=['ledger','stats','dashboard','accounts'];
                document.querySelectorAll('#bottom-nav button').forEach(b=>{ const on=b.dataset.tab===tab||(b.dataset.tab==='more'&&!main.includes(tab)); b.classList.toggle('active',on); if(on)b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
            }
            /**
             * Opens the  more sheet screen, dialog, or workflow.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            openMoreSheet(){
                const items=[['yearly','calendar-range','Schedules'],['budgets','pie-chart','Budgets'],['goals','target','Goals'],...(this.isDeveloper()?[['projects','clipboard-list','Projects']]:[]),['shared','users','Shared & Split'],['sms','message-square-text','SMS messages'],['configuration','sliders-horizontal','Categories'],['settings','shield-check','Backup & Settings'],['guide','book-open','User Guide']];
                const dark=document.documentElement.classList.contains('dark');
                const box=document.getElementById('modal-box');
                box.innerHTML=`<div class="more-head"><h3 class="font-bold text-lg">More</h3><button type="button" onclick="app.closeModal()" aria-label="Close">✕</button></div><div class="more-grid">${items.map(([t,icon,label])=>`<button type="button" class="more-item ${this.currentTab===t?'active':''}" onclick="app.closeModal();app.switchTab('${t}')"><i data-lucide="${icon}"></i><span>${label}</span>${!this.isPro()&&['yearly','goals','shared','sms'].includes(t)?'<em class="pro-badge pro-badge-sm">PRO</em>':''}</button>`).join('')}</div><div class="more-row"><button type="button" class="s-btn s-secondary" onclick="app.toggleTheme();app.closeModal()"><i data-lucide="${dark?'sun':'moon'}"></i><span>${dark?'Light mode':'Dark mode'}</span></button><button type="button" class="s-btn s-danger-outline" onclick="app.closeModal();app.lockVault()"><i data-lucide="lock"></i><span>Lock</span></button></div>`;
                document.getElementById('modal-container').classList.add('more-sheet');
                document.getElementById('modal-container').classList.remove('hidden');
                window.lucide?.createIcons?.();
            }
            /**
             * Changes the navigation and refreshes dependent UI.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            toggleNavigation() {
                const sidebar = document.getElementById('app-sidebar');
                const backdrop = document.getElementById('nav-backdrop');
                if (!sidebar || !backdrop) return;
                const open = sidebar.classList.toggle('mobile-nav-open');
                backdrop.classList.toggle('mobile-nav-open', open);
                document.body.classList.toggle('overflow-hidden', open && window.matchMedia('(max-width: 1023px)').matches);
            }
            /**
             * Handles the close navigation workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            closeNavigation() {
                const sidebar = document.getElementById('app-sidebar');
                const backdrop = document.getElementById('nav-backdrop');
                if (sidebar) sidebar.classList.remove('mobile-nav-open');
                if (backdrop) backdrop.classList.remove('mobile-nav-open');
                document.body.classList.remove('overflow-hidden');
            }
            /**
             * Changes the settings menu and refreshes dependent UI.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            toggleSettingsMenu() {
                const menu=document.getElementById('settings-submenu');
                const icon=document.getElementById('settings-menu-chevron');
                if(!menu)return;
                menu.classList.toggle('hidden');
                if(icon)icon.setAttribute('data-lucide',menu.classList.contains('hidden')?'chevron-right':'chevron-down');
                if(window.lucide)window.lucide?.createIcons?.();
                this.switchTab('settings');
            }
            /**
             * Changes the tab and refreshes dependent UI.
             * Parameters: tabId. Side effects, if any, are described by the statements below.
             */
            switchTab(tabId) {
                if(tabId==='projects'&&!this.isDeveloper())return;
                if(!this.isPro()&&['yearly','goals','shared','sms'].includes(tabId)){ this.closeNavigation(); return this.requirePro(tabId); }
                this.closeNavigation();
                this.currentTab=tabId; this.syncBottomNav(tabId);
                { const mc=document.getElementById('modal-container'); if(mc&&mc.classList.contains('more-sheet')) mc.classList.remove('more-sheet'); }
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
                document.getElementById(`panel-${tabId}`).classList.remove('hidden');
                if(tabId==='ledger'){ try{ this.applyLedgerHeader(); }catch(e){} }
                try{ this.renderPageTitle(tabId); }catch(e){} setTimeout(()=>{ try{ this.renderPageTitle(tabId); }catch(e){} },0);
                try{ this.syncHeaderAction(tabId); }catch(e){} setTimeout(()=>{ try{ this.hideDuplicateTitles(tabId); }catch(e){} },0);
                
                document.querySelectorAll('.nav-btn').forEach(b => {
                    b.className = "nav-btn w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors";
                });
                const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
                if (activeBtn) {
                    activeBtn.className = "nav-btn w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400";
                }
                
                const titles = {
                    dashboard: 'Dashboard Overview',
                    ledger: 'Core Ledger', stats: 'Stats',
                    importer: 'Unified Bank Importer',
                    budgets: 'Monthly Budgets',
                    accounts: 'Accounts & Wallets',
                    yearly: 'Schedules',
                    goals: 'Financial Goals', projects: 'Projects',
                    shared: 'Shared & Split Expenses',
                    sms: 'SMS Reconciliation',
                    settings: 'Backup & Settings',
                    configuration: 'Categories',
                    guide: 'User Guide'
                };
                document.getElementById('tab-title').innerText = titles[tabId] || 'Dashboard';
                if(tabId==='sms') this.renderSmsReconciliation();
                if(tabId==='stats') { try{ this.renderStats(); }catch(e){ console.error('Stats could not be shown', e); } }
                window.lucide?.createIcons?.();
            }

            /**
             * Handles the ui dialog workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: title, message, options={}. Side effects, if any, are described by the statements below.
             */
            uiDialog(title, message, options={}) {
                return new Promise(resolve => {
                    const container=document.getElementById('modal-container');
                    const box=document.getElementById('modal-box');
                    const esc=v=>this.escapeHtml(String(v??''));
                    const type=options.type||'confirm';
                    const inputType=options.inputType||'text';
                    const value=options.initialValue??'';
                    const okLabel=options.okLabel||(type==='input'?'Continue':type==='notice'?'OK':'Continue');
                    const cancelLabel=options.cancelLabel||'Cancel';
                    const inputHtml=type==='input'?`<input id="aifico-dialog-value" type="${inputType==='password'?'password':'text'}" class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" value="${inputType==='password'?'':esc(value)}" autocomplete="${inputType==='password'?'current-password':'off'}" spellcheck="false">`:'';
                    const messageHtml=esc(message).replace(/\n/g,'<br>');
                    box.innerHTML=`<section class="w-full space-y-5" role="dialog" aria-modal="true" aria-labelledby="aifico-dialog-title"><div class="flex items-start gap-3"><div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${options.danger?'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300':'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'}"><span class="text-lg">${options.danger?'!':'i'}</span></div><div class="min-w-0 flex-1"><h3 id="aifico-dialog-title" class="text-lg font-semibold text-slate-900 dark:text-slate-100">${esc(title)}</h3><p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">${messageHtml}</p></div><button type="button" id="aifico-dialog-x" class="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close dialog">✕</button></div>${inputHtml}<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" id="aifico-dialog-cancel" class="${type==='notice'?'hidden ':''}rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">${esc(cancelLabel)}</button><button type="button" id="aifico-dialog-ok" class="rounded-xl ${options.danger?'bg-rose-600 hover:bg-rose-700':'bg-emerald-600 hover:bg-emerald-700'} px-5 py-2.5 text-sm font-semibold text-white shadow-sm">${esc(okLabel)}</button></div></section>`;
                    container.classList.remove('hidden');
                    let finished=false;
                    const finish=result=>{if(finished)return;finished=true;document.removeEventListener('keydown',onKey);this.closeModal();resolve(result);};
                    const onKey=e=>{if(e.key==='Escape'){e.preventDefault();finish(type==='input'?null:type==='notice'?true:false);}else if(e.key==='Enter'&&type==='input'){e.preventDefault();finish(document.getElementById('aifico-dialog-value')?.value??'');}};
                    document.addEventListener('keydown',onKey);
                    document.getElementById('aifico-dialog-ok').onclick=()=>finish(type==='input'?(document.getElementById('aifico-dialog-value')?.value??''):true);
                    document.getElementById('aifico-dialog-cancel').onclick=()=>finish(false);
                    document.getElementById('aifico-dialog-x').onclick=()=>finish(type==='input'?null:type==='notice'?true:false);
                    const input=document.getElementById('aifico-dialog-value');
                    if(input)setTimeout(()=>{input.focus();if(inputType!=='password')input.select();},0);else document.getElementById('aifico-dialog-ok').focus();
                });
            }
            /**
             * Handles the ui confirm workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: message, options={}. Side effects, if any, are described by the statements below.
             */
            uiConfirm(message, options={}) {
                return this.uiDialog(options.title || 'Please confirm', message, {
                    type: 'confirm', danger: !!options.danger,
                    okLabel: options.okLabel || (options.danger ? 'Delete' : 'Continue'),
                    cancelLabel: options.cancelLabel || 'Cancel'
                });
            }
            /**
             * Handles the ui input workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: title, message, initialValue='', options={}. Side effects, if any, are described by the statements below.
             */
            uiInput(title, message, initialValue='', options={}) {
                return this.uiDialog(title, message, {type:'input', initialValue, inputType:options.inputType||'text', okLabel:options.okLabel||'Continue', cancelLabel:'Cancel'});
            }
            /**
             * Handles the ui prompt workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: title, message, initialValue=''. Side effects, if any, are described by the statements below.
             */
            uiPrompt(title, message, initialValue='') {
                return new Promise(resolve => {
                    const container=document.getElementById('modal-container');
                    const box=document.getElementById('modal-box');
                    const esc=v=>this.escapeHtml(String(v??''));
                    box.innerHTML=`<form id="aifico-standard-prompt" class="space-y-4" role="dialog" aria-modal="true" aria-labelledby="aifico-prompt-title"><div class="flex items-start justify-between gap-3"><div><h3 id="aifico-prompt-title" class="text-lg font-semibold text-slate-900 dark:text-slate-100">${esc(title)}</h3><p class="mt-1 text-sm text-slate-600 dark:text-slate-300">${esc(message)}</p></div><button type="button" id="aifico-prompt-x" aria-label="Close dialog" class="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button></div><input id="aifico-prompt-value" type="text" maxlength="120" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" value="${esc(initialValue)}" autocomplete="off"><div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" id="aifico-prompt-cancel" class="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Cancel</button><button type="submit" class="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Save</button></div></form>`;
                    container.classList.remove('hidden');
                    const input=document.getElementById('aifico-prompt-value');
                    let finished=false;
                    const finish=value=>{if(finished)return;finished=true;document.removeEventListener('keydown',onKey);this.closeModal();resolve(value);};
                    const onKey=e=>{if(e.key==='Escape'){e.preventDefault();finish(null);}};
                    document.addEventListener('keydown',onKey);
                    document.getElementById('aifico-standard-prompt').onsubmit=e=>{e.preventDefault();finish(input.value);};
                    document.getElementById('aifico-prompt-cancel').onclick=()=>finish(null);
                    document.getElementById('aifico-prompt-x').onclick=()=>finish(null);
                    setTimeout(()=>{input.focus();input.select();},0);
                });
            }
            /**
             * Changes the theme and refreshes dependent UI.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            toggleTheme() {
                const dark = document.documentElement.classList.toggle('dark');
                // Remember the choice on this device (a display preference, not vault data).
                try { localStorage.setItem('aifico-theme', dark ? 'dark' : 'light'); } catch (e) {}
            }

            /**
             * Renders the  all UI from the current app state.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            /**
             * Shows the saved currency choice in Backup & Settings → Currency.
             */
            renderCurrencySetting() {
                const sel = document.getElementById('currency-symbol'); if (!sel) return;
                const s = aificoCurrencySymbol();
                let opt = [...sel.options].find(o => o.value === s);
                if (!opt) { opt = new Option(s + ' (custom)', s); sel.insertBefore(opt, sel.querySelector('option[value="__custom"]')); }
                sel.value = s;
                const p = document.getElementById('currency-preview'); if (p) p.textContent = 'Example: ' + CUR() + (12345.5).toLocaleString('en-IN', { minimumFractionDigits: 2 }) + (s ? '' : ' (no symbol)');
            }
            /**
             * Saves the display currency symbol ('' for none) in the vault and refreshes every screen.
             */
            async setCurrencySymbol(value) {
                let s = value;
                if (value === '__custom') {
                    s = await this.uiInput('Custom currency', 'Type the symbol or code to show before amounts (up to 4 characters), for example KES or ₨.', '');
                    if (s === null || s === undefined) return this.renderCurrencySetting();
                    s = String(s).trim().slice(0, 4);
                }
                this.data.settings ||= {};
                this.data.settings.currencySymbol = s;
                this.saveVault();
                this.renderAll();
            }
            renderAll() {
                try { if (this.ensureUids()) this.saveVault(); } catch (e) { console.error('UUID check failed', e); }
                try { if (this.repairSubcategoriesOnce()) this.saveVault(); } catch (e) { console.error('Subcategory repair failed', e); }
                try { if (this.ensureCategoryColors()) this.saveVault(); } catch (e) { console.error('Category colours could not be set', e); }
                this.data.smsInbox ||= [];
                try { this.renderInterestPlans(); } catch (e) { console.error('Loans & deposits could not be shown', e); }
                try { this.renderReconSettings(); } catch (e) {}
                try { if (this.isDeveloper()) this.renderProjects(); } catch (e) { console.error('Projects could not be shown', e); }
                this.renderGlobalDefaultAccount();
                try { this.renderCurrencySetting(); aificoApplyCurrencyToPage(); } catch (e) { console.error('Currency display could not be updated', e); }
                this.processSalarySchedule();
                if (this.isPro()) this.processRecurringPayments();
                try { if (this.isPro() && this.processInterestPlans()) this.saveVault(); } catch (e) { console.error('Loan/deposit entries could not be posted', e); }
                this.renderSalarySchedule();
                this.renderDashboard();
                this.renderLedger();
                this.renderAccountsDropdown();
                this.renderBudgets();
                this.renderAccountsGrid();
                this.renderYearly();
                this.renderGoals();
                this.renderShared();
                this.renderCategoriesManager();
                if (this.currentTab === 'stats') { try { this.renderStats(); } catch (e) { console.error('Stats could not be shown', e); } }
                window.lucide?.createIcons?.();
            }

            /**
             * Opens the  salary schedule modal screen, dialog, or workflow.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            openSalaryScheduleModal(){
                const s=this.data.salarySchedule||{};
                const accounts=this.data.accounts||[];
                const options=accounts.filter(a=>/checking|salary|saving/i.test(String(a.type||'')+' '+String(a.name||''))).map(a=>`<option value="${this.escapeHtml(String(a.id||a.name))}" ${String(s.accountId||s.accountName||'')===String(a.id||a.name)?'selected':''}>${this.escapeHtml(a.name)} (${this.escapeHtml(a.type||'Account')})</option>`).join('');
                const box=document.getElementById('modal-box');
                box.innerHTML=`<div class="flex items-center justify-between border-b pb-3"><h3 class="font-bold text-lg">Monthly Salary Auto-Entry</h3><button type="button" onclick="app.closeModal()">✕</button></div>
                <form onsubmit="app.saveSalarySchedule(event)" class="space-y-3">
                  <label class="block text-sm">Salary description<input id="salary-title" required value="${this.escapeHtml(s.title||'Monthly Salary')}" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"></label>
                  <label class="block text-sm">Net salary amount${CURL()}<input id="salary-amount" type="number" min="0.01" step="0.01" required value="${Number(s.amount)||''}" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"><button type="button" onclick="app.openAmountCalculator('salary-amount')" class="mt-1 text-xs text-emerald-600 hover:underline">🧮 Calculator</button></label>
                  <label class="block text-sm">Checking / salary account<select id="salary-account" required class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"><option value="">Select account</option>${options}</select></label>
                  <div class="grid grid-cols-2 gap-3"><label class="block text-sm">Salary day of month<input id="salary-day" type="number" min="1" max="28" required value="${Number(s.day)||1}" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"></label><label class="block text-sm">Start month<input id="salary-start" type="month" required value="${this.escapeHtml(s.startMonth||this.todayISO().slice(0,7))}" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"></label></div>
                  <p class="text-xs text-slate-500">When the app is opened after the salary date, it adds one income entry for each missed month from the start month, without duplicating months already recorded. It does not contact your bank.</p>
                  <div class="flex justify-end gap-2"><button type="button" onclick="app.closeModal()" class="px-4 py-2 border rounded-lg">Cancel</button><button type="submit" class="px-4 py-2 bg-emerald-600 text-white rounded-lg">Save schedule</button></div>
                </form>`;
                document.getElementById('modal-container').classList.remove('hidden');
            }
            /**
             * Opens the  amount calculator screen, dialog, or workflow.
             * Parameters: targetId. Side effects, if any, are described by the statements below.
             */
            openAmountCalculator(targetId){
                const target=document.getElementById(targetId);
                if(!target)return alert('Amount field not found. Please reopen the form and try again.');
                const prior=document.getElementById('aifico-calculator-overlay');if(prior)prior.remove();
                const overlay=document.createElement('div');overlay.id='aifico-calculator-overlay';
                overlay.className='fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4';
                overlay.innerHTML=`<div class="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-2xl p-4 space-y-3">
                  <div class="flex items-center justify-between"><h3 class="font-bold">Amount Calculator</h3><button type="button" onclick="document.getElementById('aifico-calculator-overlay').remove()" class="px-2 py-1 rounded-lg border dark:border-slate-700">✕</button></div>
                  <input id="aifico-calculator-expression" type="text" inputmode="decimal" value="${String(target.value||'').replace(/[^0-9.+*/() -]/g,'')}" placeholder="e.g. 12500+2500" class="w-full px-3 py-3 text-right text-xl rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white">
                  <div class="grid grid-cols-4 gap-2">${['7','8','9','÷','4','5','6','×','1','2','3','−','C','0','.','+','(',')','⌫','='].map(k=>`<button type="button" onclick="app.calculatorKey('${k}')" class="py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 font-semibold">${k}</button>`).join('')}</div>
                  <p class="text-xs text-slate-500">Supports addition, subtraction, multiplication, division and parentheses.</p>
                  <div class="flex justify-end gap-2"><button type="button" onclick="document.getElementById('aifico-calculator-overlay').remove()" class="px-4 py-2 rounded-xl border dark:border-slate-700">Cancel</button><button type="button" onclick="app.applyAmountCalculator('${targetId}')" class="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold">Use amount</button></div>
                </div>`;
                document.body.appendChild(overlay);
                this.calculatorTargetId=targetId;
                const expr=document.getElementById('aifico-calculator-expression');expr.focus();expr.select();
            }
            /**
             * Calculates key from current inputs and records.
             * Parameters: key. Side effects, if any, are described by the statements below.
             */
            calculatorKey(key){
                const input=document.getElementById('aifico-calculator-expression');if(!input)return;
                if(key==='C'){input.value='';return;}
                if(key==='⌫'){input.value=input.value.slice(0,-1);return;}
                if(key==='='){try{input.value=this.calculateAmountExpression(input.value).toString();}catch(e){alert('Please enter a valid calculation.');}return;}
                const mapped={'÷':'/','×':'*','−':'-'};
                input.value+=(mapped[key]||key);
            }
            /**
             * Calculates amount expression from current inputs and records.
             * Parameters: expression. Side effects, if any, are described by the statements below.
             */
            calculateAmountExpression(expression){
                const exp=String(expression||'').replace(/[₹,\s]/g,'').replace(/[×]/g,'*').replace(/[÷]/g,'/');
                if(!exp||!/^[0-9.+*/()\-]+$/.test(exp))throw new Error('Invalid characters');
                // Restrict evaluation to arithmetic characters only.
                const result=Function('"use strict";return ('+exp+')')();
                if(typeof result!=='number'||!Number.isFinite(result))throw new Error('Invalid result');
                return Math.round((result+Number.EPSILON)*100)/100;
            }
            /**
             * Handles the apply amount calculator workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: targetId. Side effects, if any, are described by the statements below.
             */
            applyAmountCalculator(targetId){
                const target=document.getElementById(targetId),input=document.getElementById('aifico-calculator-expression');
                if(!target||!input)return;
                try{
                    const value=this.calculateAmountExpression(input.value);
                    if(value<0 && Number(target.min||0)>=0)return alert('This amount field does not allow negative values.');
                    target.value=String(value);
                    target.dispatchEvent(new Event('input',{bubbles:true}));
                    target.dispatchEvent(new Event('change',{bubbles:true}));
                    document.getElementById('aifico-calculator-overlay').remove();
                }catch(e){alert('Please enter a valid calculation, for example 12500+2500.');}
            }
            /**
             * Formats or safely prepares html for display.
             * Parameters: value. Side effects, if any, are described by the statements below.
             */
            escapeHtml(value) { return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
            /**
             * Handles the show simple form workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: title, fields, callback. Side effects, if any, are described by the statements below.
             */
            showSimpleForm(title, fields, callback) { const box=document.getElementById('modal-box'); const controls=fields.map(([id,label,type])=>`<label class="ip-field sf-field"><span>${this.escapeHtml(label)}</span>${type.startsWith('select:')?`<select id="sf-${id}" class="w-full px-3 py-2 rounded-xl border dark:bg-slate-800">${type.slice(7).split(',').map(v=>`<option>${this.escapeHtml(v)}</option>`).join('')}</select>`:`<input id="sf-${id}" ${type==='number'?'min="0" step="0.01"':''} type="${type}" ${type==='text'?'required':''} class="w-full px-3 py-2 rounded-xl border dark:bg-slate-800" required>`}</label>`).join(''); box.innerHTML=`<div class="flex justify-between items-center"><h3 class="font-bold">${this.escapeHtml(title)}</h3><button onclick="app.closeModal()">✕</button></div><form id="simple-form">${controls}<div class="flex justify-end gap-3 pt-3"><button type="button" onclick="app.closeModal()" class="px-4 py-2 border rounded-xl">Cancel</button><button class="px-4 py-2 bg-emerald-600 text-white rounded-xl">Save</button></div></form>`; document.getElementById('modal-container').classList.remove('hidden'); document.getElementById('simple-form').onsubmit=e=>{e.preventDefault();const values={};fields.forEach(([id])=>values[id]=document.getElementById('sf-'+id).value);if(fields.some(([id])=>!String(values[id]??'').trim()))return alert('Please complete all required fields.');callback(values);}; }
            /**
             * Opens the  password change modal screen, dialog, or workflow.
             * Parameters: ) { const box=document.getElementById('modal-box');box.innerHTML=`<h3 class="font-bold text-lg border-b border-slate-200 dark:border-slate-800 pb-3">Change master password</h3><form id="pw-form" class="ip-form"><label class="ip-field"><span>Current password</span><input id="pw-old" type="password" required autocomplete="current-password" placeholder="Your password today" class="w-full px-3 border rounded-xl dark:bg-slate-800"></label><label class="ip-field"><span>New password</span><input id="pw-new" type="password" minlength="5" required autocomplete="new-password" placeholder="At least 5 characters" class="w-full px-3 border rounded-xl dark:bg-slate-800"></label><label class="ip-field"><span>Confirm new password</span><input id="pw-confirm" type="password" minlength="5" required autocomplete="new-password" placeholder="Type it again" class="w-full px-3 border rounded-xl dark:bg-slate-800"></label><div class="flex justify-end gap-3"><button type="button" onclick="app.closeModal()" class="px-4 py-2 border rounded-xl">Cancel</button><button class="px-4 py-2 bg-emerald-600 text-white rounded-xl">Change Password</button></div></form>`;document.getElementById('modal-container').classList.remove('hidden');document.getElementById('pw-form').onsubmit=async e=>{e.preventDefault();const old=document.getElementById('pw-old').value,nw=document.getElementById('pw-new').value,cf=document.getElementById('pw-confirm').value; if(nw==='12345'){ alert('Choose a password other than the default 12345.'); return; }if(nw.length<5)return alert('Use at least 5 characters.');if(nw!==cf)return alert('New passwords do not match.');try{await this.vault.decryptData(await this.storage.getItem('aifico_vault'),old);this.currentPassword=nw;const saved=await this.saveVault();if(saved!==true)throw new Error('The new encrypted vault could not be saved.');this.closeModal();alert('Master password changed successfully.');}catch(_. Side effects, if any, are described by the statements below.
             */
            openPasswordChangeModal() {
                setTimeout(()=>{ const f=document.getElementById('pw-form'); if(f&&!f.dataset.dpw){ f.dataset.dpw='1'; f.addEventListener('submit',()=>setTimeout(()=>this.checkDefaultPassword(),1500)); } },0); const box=document.getElementById('modal-box');box.innerHTML=`<h3 class="font-bold text-lg border-b border-slate-200 dark:border-slate-800 pb-3">Change master password</h3><p class="pw-default-note">The default password is <b>12345</b>. If you are still using it, change it immediately.</p><form id="pw-form" class="ip-form"><label class="ip-field"><span>Current password</span><input id="pw-old" type="password" required autocomplete="current-password" placeholder="Your password today" class="w-full px-3 border rounded-xl dark:bg-slate-800"></label><label class="ip-field"><span>New password</span><input id="pw-new" type="password" minlength="5" required autocomplete="new-password" placeholder="At least 5 characters" class="w-full px-3 border rounded-xl dark:bg-slate-800"></label><label class="ip-field"><span>Confirm new password</span><input id="pw-confirm" type="password" minlength="5" required autocomplete="new-password" placeholder="Type it again" class="w-full px-3 border rounded-xl dark:bg-slate-800"></label><div class="flex justify-end gap-3"><button type="button" onclick="app.closeModal()" class="px-4 py-2 border rounded-xl">Cancel</button><button class="px-4 py-2 bg-emerald-600 text-white rounded-xl">Change Password</button></div></form>`;document.getElementById('modal-container').classList.remove('hidden');document.getElementById('pw-form').onsubmit=async e=>{e.preventDefault();const old=document.getElementById('pw-old').value,nw=document.getElementById('pw-new').value,cf=document.getElementById('pw-confirm').value; if(nw==='12345'){ alert('Choose a password other than the default 12345.'); return; }if(nw.length<5)return alert('Use at least 5 characters.');if(nw!==cf)return alert('New passwords do not match.');try{await this.vault.decryptData(await this.storage.getItem('aifico_vault'),old);this.currentPassword=nw;const saved=await this.saveVault();if(saved!==true)throw new Error('The new encrypted vault could not be saved.');this.closeModal();alert('Master password changed successfully.');}catch(_){alert('Current password is incorrect.');}}; }

            /**
             * Handles the close modal workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            closeModal() {
                // Bottom-sheet styling (More, row actions) belongs to that sheet only, not to the next dialog.
                document.getElementById('modal-container').classList.add('hidden');
                document.getElementById('modal-container').classList.remove('more-sheet');
            }
        }
