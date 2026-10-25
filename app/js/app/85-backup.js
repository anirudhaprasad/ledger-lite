// AificoApp methods: backup (10 methods). Part of the AificoApp prototype chain.
        class AificoAppBackup extends AificoAppSms {
            /**
             * Checks saved account and transaction records for structural problems and duplicate IDs.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            async runDataIntegrityCheck() {
                const findings = [];
                const add = (level, message) => findings.push({ level, message });
                const d = this.data;
                if (!this.currentPassword) return alert('Unlock the vault before running an integrity check.');
                const arrays = ['accounts','tx','categories','smsInbox','yearly','goals','shared','importHistory'];
                for (const key of arrays) if (!Array.isArray(d[key])) add('error', `Expected "${key}" to be a list.`);
                if (!d.budgets || typeof d.budgets !== 'object' || Array.isArray(d.budgets)) add('error', 'Budgets are not stored as an object.');
                if (!d.bankProfiles || typeof d.bankProfiles !== 'object' || Array.isArray(d.bankProfiles)) add('error', 'Bank profiles are not stored as an object.');
                const accounts = Array.isArray(d.accounts) ? d.accounts : [];
                const txs = Array.isArray(d.tx) ? d.tx : [];
                const ids = new Set();
                for (const [i, a] of accounts.entries()) {
                    if (!a || typeof a !== 'object') { add('error', `Account row ${i+1} is not a valid object.`); continue; }
                    if (!String(a.name || '').trim()) add('error', `Account row ${i+1} has no name.`);
                    if (a.id != null) { const id=String(a.id); if(ids.has(id)) add('error', `Duplicate account ID: ${id}.`); ids.add(id); }
                    if (a.balance != null && !Number.isFinite(Number(a.balance))) add('error', `Account "${a.name || i+1}" has a non-numeric balance.`);
                }
                const accountNames = new Set(accounts.map(a => String(a && a.name || '').trim()).filter(Boolean));
                const txIds = new Set();
                for (const [i, t] of txs.entries()) {
                    if (!t || typeof t !== 'object') { add('error', `Transaction row ${i+1} is not a valid object.`); continue; }
                    if (t.id != null) { const id=String(t.id); if(txIds.has(id)) add('warning', `Duplicate transaction ID: ${id}.`); txIds.add(id); }
                    if (t.amount == null || !Number.isFinite(Number(t.amount))) add('error', `Transaction ${t.id ?? (i+1)} has a missing or invalid amount.`);
                    if (t.date && Number.isNaN(Date.parse(t.date))) add('warning', `Transaction ${t.id ?? (i+1)} has an unrecognized date: ${t.date}.`);
                    if (t.account && !accountNames.has(String(t.account).trim())) add('warning', `Transaction ${t.id ?? (i+1)} references account "${t.account}" which is not in Accounts & Wallets.`);
                    if (t.type === 'Transfer' && t.destinationAccount && !accountNames.has(String(t.destinationAccount).trim())) add('warning', `Transfer ${t.id ?? (i+1)} references missing destination account "${t.destinationAccount}".`);
                }
                // Verify that the currently saved encrypted vault can be read and decrypted without changing it.
                try {
                    await this.saveQueue;
                    const stored = await this.storage.getItem('aifico_vault');
                    if (!stored) add('error', 'No encrypted vault was found in persistent storage.');
                    else {
                        const roundTrip = await this.vault.decryptData(stored, this.currentPassword);
                        if (!roundTrip || typeof roundTrip !== 'object' || !Array.isArray(roundTrip.tx) || !Array.isArray(roundTrip.accounts)) add('error', 'Stored vault decrypted, but its core data structure is invalid.');
                        else {
                            const current = JSON.stringify(this.data);
                            const saved = JSON.stringify(roundTrip);
                            if (current !== saved) add('error', 'Saved vault differs from the current in-memory data. Save may be pending or unsaved changes exist.');
                            else add('pass', `Encrypted storage round-trip verified (${roundTrip.accounts.length} accounts, ${roundTrip.tx.length} transactions).`);
                        }
                    }
                } catch (e) { add('error', `Storage/decryption verification failed: ${e && e.message ? e.message : 'unknown error'}.`); }
                if (!findings.length) add('pass', 'Core data structure checks passed.');
                const errors = findings.filter(x=>x.level==='error').length;
                const warnings = findings.filter(x=>x.level==='warning').length;
                const lines = findings.map(x => `${x.level==='error'?'ERROR':x.level==='warning'?'WARNING':'PASS'} — ${x.message}`);
                const summary = `AIFICO DATA INTEGRITY CHECK

Result: ${errors ? 'ISSUES FOUND' : warnings ? 'PASSED WITH WARNINGS' : 'PASSED'}
Errors: ${errors} | Warnings: ${warnings}

${lines.join('\n')}`;
                console.info(summary);
                alert(summary);
            }

            /**
             * Validates imported or saved records and prepares safe, normalized data.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            validateAndCleanData() {
                if (!this.data) return alert('Unlock your vault before validating data.');
                const validISO = value => {
                    const s=String(value??'').trim();
                    if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
                    const d=new Date(s+'T00:00:00Z');
                    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===s;
                };
                const cleanText = value => typeof value==='string' ? value.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g,'').replace(/[\t\r\n]+/g,' ').replace(/\s{2,}/g,' ').trim() : value;
                const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
                // Says in words what a text cleanup removes, and shows the invisible characters in the current value
                const explain = (before, after) => { const b=String(before??''), out=[]; const inv=(b.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g)||[]).length; const lead=(b.match(/^[ \t]+/)||[''])[0].length, trail=(b.match(/[ \t]+$/)||[''])[0].length, breaks=(b.match(/[\r\n]+/g)||[]).length, doubles=(b.trim().match(/ {2,}/g)||[]).length;
                    if(inv)out.push(inv+' invisible character'+(inv>1?'s':'')+' (zero-width or formatting, often from copied or imported text)'); if(lead)out.push(lead+' space'+(lead>1?'s':'')+' at the start'); if(trail)out.push(trail+' space'+(trail>1?'s':'')+' at the end'); if(breaks)out.push(breaks+' line break'+(breaks>1?'s':'')+' (joined into one line)'); if(doubles)out.push(doubles+' double space'+(doubles>1?'s':'')); return out.length?'Removes '+out.join(', ')+'. The visible text stays the same.':''; };
                const markInvisible = value => esc(value).replace(/^( +)/,m=>'<mark title="space at the start">'+'␣'.repeat(m.length)+'</mark>').replace(/( +)$/,m=>'<mark title="space at the end">'+'␣'.repeat(m.length)+'</mark>').replace(/ {2,}/g,m=>'<mark title="double space">'+'␣'.repeat(m.length)+'</mark>').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g,c=>'<mark title="invisible character">[U+'+c.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0')+']</mark>').replace(/\r?\n/g,'<mark title="line break">↵</mark>');
                const changes=[]; const invalid=[];
                const addChange=(label,before,after,apply,kind='Text')=>{ if(before!==after&&!changes.some(c=>c.label===label&&c.before===String(before??''))) changes.push({label,before:String(before??''),after:String(after??''),apply,kind,selected:true}); };
                const dateFields = [
                    {items:this.data.tx||[], field:'date', label:'Transaction date'},
                    {items:this.data.yearly||[], field:'startDate', label:'Schedule start date'},
                    {items:this.data.yearly||[], field:'dueDate', label:'Schedule due date'},
                    {items:this.data.yearly||[], field:'endDate', label:'Schedule end date'},
                    {items:this.data.goals||[], field:'deadline', label:'Goal deadline'},
                    {items:this.data.goals||[], field:'nextDue', label:'Goal next contribution date'}
                ];
                for(const group of dateFields) for(const item of group.items) {
                    if(!item || item[group.field]===undefined || item[group.field]===null || String(item[group.field]).trim()==='') continue;
                    const before=String(item[group.field]); let iso=validISO(before.trim())?before.trim():this.normalizeLedgerDate(before.trim());
                    if(iso && validISO(iso)) addChange(`${group.label} · ${item.title||item.payee||item.id||'record'}`,before,iso,()=>item[group.field]=iso,'Date');
                    else invalid.push({label:`${group.label} · ${item.title||item.payee||item.id||'record'}`,value:before});
                }
                const textKeys=['payee','notes','description','reference','category','subcategory','account','title','name','memo','merchant'];
                const scanObject=(obj,label)=>{ if(!obj||typeof obj!=='object')return; for(const key of textKeys){ if(typeof obj[key]==='string'){const before=obj[key],after=cleanText(before);addChange(`${label} · ${key}`,before,after,()=>obj[key]=after,'Text');} } };
                (this.data.tx||[]).forEach((t,i)=>{
                    const label=`Core Ledger · ${t.date||'undated'} · ${t.payee||t.description||t.id||i+1}`;
                    scanObject(t,label);
                    // Core Ledger commonly carries both notes/note and description. If their cleaned text is identical, offer (never force) removal of the duplicate description.
                    const note=cleanText(t.notes ?? t.note ?? '');
                    const desc=cleanText(t.description ?? '');
                    if(note && desc && note.toLocaleLowerCase()===desc.toLocaleLowerCase()) {
                        addChange(`${label} · duplicate Description (matches Notes)`,desc,'',()=>{t.description='';},'Duplicate text');
                    }
                    // Check all common ledger text fields, including aliases used by imports and SMS parsing.
                    for(const key of ['note','notes','description','payee','reference','category','subcategory','account','merchant','memo']) {
                        if(typeof t[key]==='string') {
                            const before=t[key],after=cleanText(before);
                            addChange(`${label} · ${key}`,before,after,()=>t[key]=after,'Text');
                        }
                    }
                });
                (this.data.accounts||[]).forEach((a,i)=>scanObject(a,`Account ${a.name||i+1}`));
                (this.data.yearly||[]).forEach((a,i)=>scanObject(a,`Schedule ${a.title||i+1}`));
                (this.data.goals||[]).forEach((a,i)=>scanObject(a,`Goal ${a.name||a.title||i+1}`));
                if(Array.isArray(this.data.categories)) this.data.categories.forEach((v,i)=>{if(typeof v==='string'){const after=cleanText(v);addChange(`Category ${i+1}`,v,after,()=>this.data.categories[i]=after,'Text');}});
                if(this.data.subcategories && typeof this.data.subcategories==='object') for(const [cat,subs] of Object.entries(this.data.subcategories)) if(Array.isArray(subs)) subs.forEach((v,i)=>{if(typeof v==='string'){const after=cleanText(v);addChange(`Subcategory · ${cat}`,v,after,()=>this.data.subcategories[cat][i]=after,'Text');}});
                this.pendingCleanupChanges=changes;
                const review=document.getElementById('cleanup-review'),status=document.getElementById('data-validation-status');
                if(!review)return;
                status.textContent=`Review found ${changes.length} proposed cleanup(s) and ${invalid.length} date(s) that need manual review. No data has been changed.`;
                status.className='text-sm '+((changes.length||invalid.length)?'text-amber-600 dark:text-amber-400':'text-emerald-600 dark:text-emerald-400');
                review.classList.remove('hidden');
                const invalidHtml=invalid.length?`<div class="rounded-xl border border-amber-300 dark:border-amber-800 p-3 space-y-2"><h4 class="font-semibold text-amber-700 dark:text-amber-300">Dates needing manual review (${invalid.length})</h4>${invalid.map(x=>`<div class="text-sm"><div class="font-medium">${esc(x.label)}</div><code class="text-amber-700 dark:text-amber-300 break-all">${esc(x.value)}</code><p class="text-xs text-slate-500">Not changed. Please correct this date in the relevant record.</p></div>`).join('')}</div>`:'';
                const rows=changes.map((c,i)=>`<label class="block rounded-lg border border-slate-200 dark:border-slate-700 p-3"><span class="flex items-start gap-2"><input type="checkbox" class="cleanup-change-check mt-1" data-index="${i}" ${c.selected?'checked':''}><span class="min-w-0 flex-1"><span class="block text-sm font-medium">${esc(c.label)} <span class="text-xs text-slate-500">(${esc(c.kind)})</span></span>${c.kind==='Text'&&explain(c.before,c.after)?`<span class="block text-xs mt-1 text-slate-600 dark:text-slate-300">${esc(explain(c.before,c.after))}</span>`:''}<span class="grid md:grid-cols-2 gap-2 mt-2"><span class="block min-w-0"><span class="text-xs text-slate-500">Current</span><code class="block text-xs break-all bg-slate-50 dark:bg-slate-950 rounded p-2">${c.kind==='Text'?markInvisible(c.before):esc(c.before)}</code></span><span class="block min-w-0"><span class="text-xs text-slate-500">Proposed</span><code class="block text-xs break-all bg-emerald-50 dark:bg-emerald-950 rounded p-2">${esc(c.after)}</code></span></span></span></span></label>`).join('');
                review.innerHTML=`<div class="flex flex-wrap items-center justify-between gap-2"><h4 class="font-semibold">Review proposed changes (${changes.length})</h4><div class="flex flex-wrap gap-2"><button type="button" onclick="app.setCleanupSelection(true)" class="text-sm underline">Select all</button><button type="button" onclick="app.setCleanupSelection(false)" class="text-sm underline">Select none</button></div></div><p class="text-xs text-slate-500">Core Ledger transactions are checked directly, including Notes/Note, Description, Payee, Reference, Category, Subcategory and Account. Review each before/after pair. Only checked changes are applied. Invisible control/format characters are removed and whitespace is normalized; meaningful punctuation is preserved. Matching Notes and Description values are offered as an optional duplicate cleanup.</p>${invalidHtml}${changes.length?`<div class="max-h-96 overflow-y-auto space-y-2 pr-1">${rows}</div><div class="flex flex-wrap gap-2"><button type="button" onclick="app.applySelectedCleanup()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">Apply selected changes</button><button type="button" onclick="app.cancelCleanupReview()" class="px-4 py-2 border rounded-lg text-sm">Cancel</button></div>`:`<p class="text-sm text-emerald-600">No cleanup changes are needed.</p><button type="button" onclick="app.cancelCleanupReview()" class="px-4 py-2 border rounded-lg text-sm">Close review</button>`}`;
            }
            /**
             * Updates cleanup selection.
             * Parameters: selected. Side effects, if any, are described by the statements below.
             */
            setCleanupSelection(selected) {
                document.querySelectorAll('.cleanup-change-check').forEach(el=>el.checked=!!selected);
            }
            /**
             * Returns or checks cancel cleanup review.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            cancelCleanupReview() {
                const review=document.getElementById('cleanup-review'); if(review){review.classList.add('hidden');review.innerHTML='';}
                this.pendingCleanupChanges=[];
            }
            /**
             * Handles the apply selected cleanup workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            async applySelectedCleanup() {
                const changes=this.pendingCleanupChanges||[];
                const selected=[...document.querySelectorAll('.cleanup-change-check:checked')].map(el=>Number(el.dataset.index));
                if(!selected.length) return alert('Select at least one proposed change to apply.');
                if(!await this.uiConfirm(`Apply ${selected.length} selected cleanup change(s)? A backup is recommended. Unselected fields and invalid dates will remain unchanged.`)) return;
                selected.forEach(i=>{if(changes[i])changes[i].apply();});
                this.saveVault();this.renderAll();
                const status=document.getElementById('data-validation-status');
                if(status){status.textContent=`Applied ${selected.length} selected cleanup change(s). Invalid dates were left unchanged for manual review.`;status.className='text-sm text-emerald-600 dark:text-emerald-400';}
                this.cancelCleanupReview();
                alert(`Applied ${selected.length} selected cleanup change(s).`);
            }

            /**
             * Counts key record collections for backup/restore preview and validation.
             * Parameters: data. Side effects, if any, are described by the statements below.
             */
            getBackupRecordCounts(data) {
                const d = data && typeof data === 'object' ? data : {};
                const tx = Array.isArray(d.tx) ? d.tx : [];
                const yearly = Array.isArray(d.yearly) ? d.yearly : [];
                const bankProfiles = d.bankProfiles && typeof d.bankProfiles === 'object' && !Array.isArray(d.bankProfiles) ? d.bankProfiles : {};
                const subcategories = d.subcategories && typeof d.subcategories === 'object' && !Array.isArray(d.subcategories) ? d.subcategories : {};
                return {
                    transactions: tx.length,
                    ledgerActive: tx.filter(t => t && !t.excludedFromLedger).length,
                    ledgerExcluded: tx.filter(t => t && !!t.excludedFromLedger).length,
                    accounts: Array.isArray(d.accounts) ? d.accounts.length : 0,
                    categories: Array.isArray(d.categories) ? d.categories.length : 0,
                    subcategories: Object.values(subcategories).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0),
                    budgets: d.budgets && typeof d.budgets === 'object' && !Array.isArray(d.budgets) ? Object.keys(d.budgets).length : 0,
                    yearlyScheduledItems: yearly.length,
                    goals: Array.isArray(d.goals) ? d.goals.length : 0,
                    sharedSplits: Array.isArray(d.shared) ? d.shared.length : 0,
                    splitMembers: Array.isArray(d.members) ? d.members.length : 0,
                    salarySchedule: d.salarySchedule && typeof d.salarySchedule === 'object' ? 1 : 0,
                    bankProfiles: Object.keys(bankProfiles).length,
                    importHistory: Array.isArray(d.importHistory) ? d.importHistory.length : 0,
                    recurringSchedules: tx.filter(t => t && (t.source === 'recurring-schedule' || t.recurringScheduleMarker)).length,
                    settings: d.settings && typeof d.settings === 'object' ? Object.keys(d.settings).length : 0
                };
            }

            /**
             * Checks a backup payload and required collections before restore.
             * Parameters: data. Side effects, if any, are described by the statements below.
             */
            validateBackupData(data) {
                if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Decrypted content is not a database object.');
                if (!Array.isArray(data.tx)) throw new Error('The backup is missing the Transactions list.');
                if (!Array.isArray(data.accounts)) throw new Error('The backup is missing the Accounts & Wallets list.');
                if (!Array.isArray(data.categories)) throw new Error('The backup is missing the Categories list.');
                if (!data.budgets || typeof data.budgets !== 'object' || Array.isArray(data.budgets)) throw new Error('The backup has an invalid Budgets section.');
                return data;
            }

            /**
             * Creates a vault backup and its metadata; erase-related exports use the guarded path.
             * Parameters: forFullErase = false. Side effects, if any, are described by the statements below.
             */
            async exportVaultBackup(forFullErase = false) {
                if (!this.currentPassword) return alert('Unlock the vault first so the backup can be verified before export.');
                // Flush all pending saves and persist the latest in-memory state before reading the backup source.
                // This prevents a backup taken immediately after an edit/import from capturing an older vault.
                const saveSucceeded = await this.saveVault();
                if (saveSucceeded !== true) return alert('Backup stopped because the latest vault state could not be saved. No backup was downloaded and no data was reset.');
                try { await this.saveQueue; } catch (_) {
                    return alert('Backup stopped because a pending vault save failed. No backup was downloaded and no data was reset.');
                }
                const stored = await this.storage.getItem('aifico_vault');
                if (!stored) return alert('No vault data found. Nothing was exported.');
                let data;
                try {
                    data = this.validateBackupData(await this.vault.decryptData(stored, this.currentPassword));
                } catch (err) {
                    return alert('Backup was not created because the current vault could not be verified. No file was downloaded.\n\n' + (err && err.message ? err.message : 'Vault verification failed.'));
                }
                const parsedEncrypted = JSON.parse(stored);
                // Every backup gets a separate, high-entropy backup code and a second encrypted copy that only the code opens.
                // Restoring with the code never needs the old master password; you set a new one after it opens.
                let recoveryCode = null;
                let recoveryEncryptedVault = null;
                {
                    const random = window.crypto.getRandomValues(new Uint8Array(24));
                    const recoveryHex = Array.from(random, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
                    recoveryCode = recoveryHex.match(/.{1,6}/g).join('-');
                    try {
                        // Derive the recovery encryption key from canonical hex only; hyphens are display formatting.
                        recoveryEncryptedVault = JSON.parse(await this.vault.encryptData(data, recoveryHex));
                        const recoveryCheck = this.validateBackupData(await this.vault.decryptData(JSON.stringify(recoveryEncryptedVault), recoveryHex));
                        if (JSON.stringify(this.getBackupRecordCounts(recoveryCheck)) !== JSON.stringify(this.getBackupRecordCounts(data))) throw new Error('Recovery payload record-count verification failed.');
                    } catch (err) {
                        return alert((forFullErase ? 'Full Erase stopped' : 'Backup stopped') + ': the backup-code copy could not be verified. No backup was downloaded and no data was reset.\n\n' + (err?.message || err));
                    }
                }
                const backup = {
                    app: 'aifico-ledger',
                    backupType: 'full-encrypted-vault',
                    backupFormatVersion: 2,
                    createdAt: new Date().toISOString(),
                    encryption: 'AES-GCM-256 / PBKDF2-SHA-256',
                    recordCounts: this.getBackupRecordCounts(data),
                    encryptedVault: parsedEncrypted,
                    recovery: { scheme: 'AES-GCM-256 / PBKDF2-SHA-256; separate random backup code', encryptedVault: recoveryEncryptedVault }
                };
                const json = JSON.stringify(backup);
                // Round-trip the generated file structure and encrypted payload before offering the download.
                try {
                    const check = JSON.parse(json);
                    const checkData = this.validateBackupData(await this.vault.decryptData(JSON.stringify(check.encryptedVault), this.currentPassword));
                    const counts = this.getBackupRecordCounts(checkData);
                    if (JSON.stringify(counts) !== JSON.stringify(backup.recordCounts)) throw new Error('Record-count verification failed.');
                } catch (err) {
                    return alert('Backup verification failed; no file was downloaded.\n\n' + (err && err.message ? err.message : 'Unknown verification error.'));
                }
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                // File name: aificoledger-YYMMDD-HHmm (see fileStamp)
                const stamp = this.fileStamp();
                a.href = url;
                a.download = `${stamp}-full-backup-encrypted.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1500);
                const c = backup.recordCounts;
                // The backup code goes in its own file (never inside the encrypted backup)
                const codeText = `aifico ledger — Backup Code\n\nBackup file: ${stamp}-full-backup-encrypted.json\nCreated: ${backup.createdAt}\n\nBackup code:\n${recoveryCode}\n\nTo restore: Restore backup → choose the backup file above → enter this code → set a new master password. The old master password is not needed.\n\nKeep this file separate from the backup file: anyone with both can open your financial data. Do not upload either file to public storage.\n`;
                const codeBlob = new Blob([codeText], { type: 'text/plain;charset=utf-8' });
                const codeUrl = URL.createObjectURL(codeBlob);
                const codeAnchor = document.createElement('a');
                codeAnchor.href = codeUrl;
                codeAnchor.download = `${stamp}-full-backup-code.txt`;
                document.body.appendChild(codeAnchor);
                codeAnchor.click();
                codeAnchor.remove();
                setTimeout(() => URL.revokeObjectURL(codeUrl), 1500);
                alert(`${forFullErase ? 'FULL ERASE BACKUP VERIFIED' : 'BACKUP VERIFIED'}\n\nTwo files are saved:\n1. ${stamp}-full-backup-encrypted.json (your data, encrypted)\n2. ${stamp}-full-backup-code.txt (its backup code)\n\nBackup code — keep it apart from the backup file:\n\n${recoveryCode}\n\nTo restore this backup you only need the code; you then set a new master password. (The code is not copied to the clipboard, where clipboard history or sync could keep it.)\n\nIncluded: ${c.transactions} Core Ledger transactions (${c.ledgerActive} active, ${c.ledgerExcluded} excluded), ${c.accounts} accounts, ${c.categories} categories, ${c.budgets} budgets, ${c.goals} goals, ${c.sharedSplits} shared splits.`);
                return true;
            }

            /**
             * Handles the show restore preview workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: currentCounts, backupCounts, fileName, formatLabel, createdAt. Side effects, if any, are described by the statements below.
             */
            showRestorePreview(currentCounts, backupCounts, fileName, formatLabel, createdAt) {
                return new Promise(resolve => {
                    const container = document.getElementById('modal-container');
                    const box = document.getElementById('modal-box');
                    const esc = value => this.escapeHtml(String(value ?? ''));
                    const keys = [
                        ['Accounts & Wallets','accounts'], ['Core Ledger transactions','transactions'],
                        ['Active ledger transactions','ledgerActive'], ['Excluded ledger transactions','ledgerExcluded'],
                        ['Categories','categories'], ['Subcategories','subcategories'], ['Budgets','budgets'],
                        ['Yearly scheduled items','yearlyScheduledItems'], ['Recurring schedule entries','recurringSchedules'],
                        ['Goals','goals'], ['Shared expense splits','sharedSplits'], ['Split members','splitMembers'],
                        ['Salary schedule','salarySchedule'], ['Bank/import profiles','bankProfiles'],
                        ['Import history','importHistory'], ['Settings fields','settings']
                    ];
                    const hasCurrent = !!currentCounts;
                    const rows = keys.map(([label,key]) => {
                        const incoming = Number(backupCounts[key] ?? 0);
                        const before = hasCurrent ? Number(currentCounts[key] ?? 0) : null;
                        const delta = hasCurrent ? incoming - before : null;
                        const lower = hasCurrent && delta < 0;
                        return `<tr class="${lower ? 'bg-rose-50 dark:bg-rose-950/30' : ''}"><td class="px-3 py-2 text-slate-700 dark:text-slate-200">${esc(label)}${lower ? '<span class="ml-2 text-xs font-semibold text-rose-700 dark:text-rose-300">DECREASE</span>' : ''}</td><td class="px-3 py-2 text-right tabular-nums">${hasCurrent ? before : '—'}</td><td class="px-3 py-2 text-right font-semibold tabular-nums">${incoming}</td><td class="px-3 py-2 text-right tabular-nums ${lower ? 'text-rose-700 dark:text-rose-300 font-semibold' : ''}">${hasCurrent ? (delta > 0 ? '+' : '') + delta : '—'}</td></tr>`;
                    }).join('');
                    const decreases = hasCurrent ? keys.filter(([,key]) => Number(backupCounts[key] ?? 0) < Number(currentCounts[key] ?? 0)) : [];
                    const warning = decreases.length ? `<div class="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><strong>Data-loss warning:</strong> the backup contains fewer records in ${decreases.length} compared section(s): ${esc(decreases.map(([label])=>label).join(', '))}. Restoring replaces the current vault; it does not merge records.</div>` : `<div class="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">${hasCurrent ? 'No decrease detected in these record counts. Matching counts do not guarantee that every individual record is identical.' : 'No existing vault could be compared. Verify you have a separate backup before continuing.'}</div>`;
                    box.innerHTML = `<section class="space-y-4" role="dialog" aria-modal="true" aria-labelledby="restore-preview-title"><div class="flex items-start justify-between gap-3"><div><h3 id="restore-preview-title" class="text-xl font-bold text-slate-900 dark:text-slate-100">Restore Preview — Review Before Replacing</h3><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Backup: ${esc(fileName)}</p><p class="text-sm text-slate-500 dark:text-slate-400">Format: ${esc(formatLabel)}${createdAt ? ' · Created: ' + esc(createdAt) : ''}</p></div><button type="button" id="restore-preview-x" class="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close preview">✕</button></div>${warning}<div class="overflow-auto max-h-[42dvh] rounded-xl border border-slate-200 dark:border-slate-700"><table class="w-full text-sm"><thead class="sticky top-0 bg-slate-100 dark:bg-slate-800"><tr><th class="px-3 py-2 text-left">Record type</th><th class="px-3 py-2 text-right">Current</th><th class="px-3 py-2 text-right">Backup</th><th class="px-3 py-2 text-right">Change</th></tr></thead><tbody class="divide-y divide-slate-200 dark:divide-slate-800">${rows}</tbody></table></div><p class="text-xs text-slate-500 dark:text-slate-400">Counts are a structural comparison, not a record-by-record diff. A local encrypted recovery snapshot will be saved before replacement, if browser storage allows it. Keep a separate downloaded full backup too.</p><div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" id="restore-preview-cancel" class="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancel — Keep Current Vault</button><button type="button" id="restore-preview-continue" class="rounded-xl ${decreases.length ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'} px-5 py-2.5 text-sm font-semibold text-white">${decreases.length ? 'I Reviewed the Warning — Continue' : 'Continue Restore'}</button></div></section>`;
                    container.classList.remove('hidden');
                    let finished = false;
                    const finish = value => { if (finished) return; finished = true; document.removeEventListener('keydown', onKey); this.closeModal(); resolve(value); };
                    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); finish(false); } };
                    document.addEventListener('keydown', onKey);
                    document.getElementById('restore-preview-x').onclick = () => finish(false);
                    document.getElementById('restore-preview-cancel').onclick = () => finish(false);
                    document.getElementById('restore-preview-continue').onclick = () => finish(true);
                    document.getElementById('restore-preview-cancel').focus();
                });
            }

            /**
             * Validates a selected backup, shows recovery safeguards, and restores its data.
             * Parameters: event. Side effects, if any, are described by the statements below.
             */
            async restoreVaultBackup(event) {
                const input = event && event.target;
                const file = input && input.files && input.files[0];
                if (!file) return;
                // Initialize the persistent database even in a fresh browser profile/new environment.
                try {
                    await this.storage.ensurePersistentStore();
                } catch (dbErr) {
                    alert('Restore stopped because the persistent database could not be initialized. No vault was changed. Close other AIFICO tabs and retry.\n\n' + (dbErr?.message || dbErr));
                    if (input) input.value = '';
                    return;
                }
                // Drain pending writes before capturing the pre-restore recovery snapshot.
                try {
                    const latestSave = await this.saveQueue;
                    if (latestSave === false) throw new Error('The latest vault save failed. Export a verified backup and retry after resolving the storage issue.');
                } catch (saveErr) {
                    alert('Restore stopped because the latest save could not be confirmed. The active vault was not intentionally changed.\n\n' + (saveErr?.message || saveErr));
                    if (input) input.value = '';
                    return;
                }
                let oldStored;
                try { oldStored = await this.storage.getItem('aifico_vault'); }
                catch (storageErr) {
                    alert('Restore stopped because the current vault could not be read safely. No restore was performed.\n\n' + (storageErr?.message || storageErr));
                    if (input) input.value = '';
                    return;
                }
                let recoveryKey = null;
                let changedVault = false;
                try {
                    if (file.size <= 0) throw new Error('The selected backup file is empty.');
                    if (file.size > 250 * 1024 * 1024) throw new Error('The selected backup is unusually large (over 250 MB) and was rejected for safety.');
                    if (!/\.json$/i.test(file.name)) throw new Error('Please select the encrypted Full Backup JSON file (aificoledger-…-full-backup-encrypted.json). Do not select the recovery-code TXT file or a raw .db file.');
                    const content = await file.text();
                    let payload;
                    try { payload = JSON.parse(content); }
                    catch (_) { throw new Error('The selected file is not valid JSON. Choose the matching aificoledger-…-full-backup-encrypted.json file, not a database file or recovery-code TXT file.'); }
                    let encryptedPayload;
                    let backupMeta = null;
                    if (payload && ['aifico-ledger','aifico-money-manager'].includes(payload.app) && payload.backupType === 'full-encrypted-vault') {
                        if (payload.backupFormatVersion !== 2) throw new Error('Unsupported full-backup format version: ' + String(payload.backupFormatVersion));
                        if (!payload.encryptedVault || !Array.isArray(payload.encryptedVault.salt) || payload.encryptedVault.salt.length === 0 || !Array.isArray(payload.encryptedVault.iv) || payload.encryptedVault.iv.length === 0 || !Array.isArray(payload.encryptedVault.ciphertext) || payload.encryptedVault.ciphertext.length === 0) throw new Error('The full backup is missing or has an incomplete encrypted vault payload.');
                        if (!payload.recordCounts || typeof payload.recordCounts !== 'object' || Array.isArray(payload.recordCounts)) throw new Error('Backup integrity check failed: record-count metadata is missing or invalid. The current vault has not been changed.');
                        if (typeof payload.createdAt !== 'string' || !Number.isFinite(Date.parse(payload.createdAt))) throw new Error('Backup integrity check failed: the backup creation timestamp is missing or invalid. The current vault has not been changed.');
                        encryptedPayload = JSON.stringify(payload.encryptedVault);
                        backupMeta = payload;
                    } else if (Array.isArray(payload.salt) && Array.isArray(payload.iv) && Array.isArray(payload.ciphertext)) {
                        // Backward compatibility: accept the earlier raw encrypted-vault JSON format.
                        encryptedPayload = content;
                    } else {
                        throw new Error('This is not a supported aifico full encrypted database backup. Settings-only JSON files cannot restore the full vault.');
                    }
                    let pwd;
                    let restoredData;
                    let usedRecoveryCode = false;
                    if (backupMeta?.recovery?.encryptedVault) {
                        // Backup code: the old master password is not asked for
                        const recoveryCode = await this.uiInput('Enter the backup code', 'Enter the backup code saved with this backup (the …-full-backup-code.txt file). The old master password is not needed: after the backup opens you set a new master password. Your current data is not replaced unless the backup opens and checks out.', '', {inputType:'text', okLabel:'Open backup'});
                        if (recoveryCode === null) return;
                        const normalizedRecoveryCode = recoveryCode.trim().toUpperCase().replace(/\s+/g, '').replace(/[^A-F0-9]/g, '');
                        if (normalizedRecoveryCode.length !== 48) throw new Error('That backup code is not complete: it has 8 groups of 6 letters/numbers (48 in all). Copy it from the matching …-full-backup-code.txt file. Your current data has not been changed.');
                        // Older backups were encrypted with the hyphenated code as shown; newer ones with the plain hex. Try both.
                        const recoveryCandidates = [normalizedRecoveryCode, normalizedRecoveryCode.match(/.{1,6}/g).join('-')];
                        let recoveryFailure = null;
                        for (const candidate of recoveryCandidates) {
                            try { restoredData = this.validateBackupData(await this.vault.decryptData(JSON.stringify(backupMeta.recovery.encryptedVault), candidate)); recoveryFailure = null; break; }
                            catch (candidateErr) { recoveryFailure = candidateErr; }
                        }
                        if (!restoredData || recoveryFailure) throw new Error('This backup code does not open this backup. Check that the code and the backup file are from the same backup (same date and time in their names). Your current data has not been changed.');
                        usedRecoveryCode = true;
                        const newPassword = await this.uiInput('Set a new master password', 'The backup opened. Choose a new master password for the restored data (at least 8 characters). Write it down somewhere safe.', '', {inputType:'password', okLabel:'Continue'});
                        if (newPassword === null) return;
                        if (String(newPassword).length < 8) throw new Error('The new master password must be at least 8 characters. Your current data has not been changed.');
                        const confirmPassword = await this.uiInput('Confirm the new master password', 'Enter the new master password again.', '', {inputType:'password', okLabel:'Confirm'});
                        if (confirmPassword === null) return;
                        if (newPassword !== confirmPassword) throw new Error('The two passwords do not match. Your current data has not been changed.');
                        pwd = newPassword;
                        // The code opened the data; save it encrypted with the new master password
                        encryptedPayload = await this.vault.encryptData(restoredData, pwd);
                    } else {
                        // Backups made before backup codes: their master password opens them
                        pwd = await this.uiInput('Enter the backup\'s password', 'This backup has no backup code. Enter the master password that was in use when it was made. Your current data is not replaced unless the backup opens and checks out.', '', {inputType:'password', okLabel:'Open backup'});
                        if (pwd === null) return;
                        restoredData = this.validateBackupData(await this.vault.decryptData(encryptedPayload, pwd));
                    }
                    const actualCounts = this.getBackupRecordCounts(restoredData);
                    if (backupMeta) {
                        const expectedKeys = Object.keys(actualCounts);
                        const metadataKeys = Object.keys(backupMeta.recordCounts);
                        const missingCountKeys = expectedKeys.filter(key => !Object.prototype.hasOwnProperty.call(backupMeta.recordCounts, key));
                        const invalidCountValues = expectedKeys.filter(key => !Number.isFinite(backupMeta.recordCounts[key]) || backupMeta.recordCounts[key] !== actualCounts[key]);
                        const unexpectedCountKeys = metadataKeys.filter(key => !expectedKeys.includes(key));
                        if (missingCountKeys.length || invalidCountValues.length || unexpectedCountKeys.length) {
                            throw new Error('Backup integrity check failed: record-count metadata is incomplete, unexpected, or does not match the decrypted data. The current vault has not been changed.');
                        }
                    }
                    const summary = `Backup file: ${file.name}\nFormat: ${backupMeta ? 'Full backup v2' : 'Legacy encrypted backup'}${usedRecoveryCode ? ' · Opened with the backup code: unlock with your NEW master password' : ''}${backupMeta && backupMeta.createdAt ? '\nCreated: ' + backupMeta.createdAt : ''}\n\nCore Ledger transactions (all records): ${actualCounts.transactions}\n  Active in Ledger: ${actualCounts.ledgerActive}\n  Excluded from Ledger but retained: ${actualCounts.ledgerExcluded}\nAccounts & Wallets: ${actualCounts.accounts}\nCategories / subcategories: ${actualCounts.categories} / ${actualCounts.subcategories}\nBudgets: ${actualCounts.budgets}\nYearly scheduled items: ${actualCounts.yearlyScheduledItems}\nRecurring schedule entries: ${actualCounts.recurringSchedules}\nGoals: ${actualCounts.goals}\nShared expense splits: ${actualCounts.sharedSplits}\nSplit members: ${actualCounts.splitMembers}\nSalary schedule: ${actualCounts.salarySchedule ? 'included' : 'not present'}\nBank/import profiles: ${actualCounts.bankProfiles}\nImport history: ${actualCounts.importHistory}\nSettings fields: ${actualCounts.settings}`;
                    // Compare the verified backup with the currently saved vault before any replacement.
                    let currentCounts = null;
                    let comparisonText = 'CURRENT VAULT COMPARISON: unavailable (current vault could not be decrypted for comparison). Do not proceed unless you have verified a separate current backup.';
                    if (oldStored && this.currentPassword) {
                        try {
                            const currentData = this.validateBackupData(await this.vault.decryptData(oldStored, this.currentPassword));
                            currentCounts = this.getBackupRecordCounts(currentData);
                            const compareKeys = [
                                ['Accounts & Wallets', 'accounts'],
                                ['Core Ledger transactions', 'transactions'],
                                ['Categories', 'categories'],
                                ['Subcategories', 'subcategories'],
                                ['Budgets', 'budgets'],
                                ['Goals', 'goals'],
                                ['Shared expense splits', 'sharedSplits'],
                                ['Split members', 'splitMembers'],
                                ['Import history entries', 'importHistory']
                            ];
                            const rows = compareKeys.map(([label, key]) => {
                                const before = currentCounts[key], incoming = actualCounts[key];
                                const delta = incoming - before;
                                return `${label}: current ${before} → backup ${incoming} (${delta > 0 ? '+' : ''}${delta})`;
                            });
                            const lower = compareKeys.filter(([label, key]) => actualCounts[key] < currentCounts[key]).map(([label, key]) => `${label} decreases from ${currentCounts[key]} to ${actualCounts[key]}`);
                            comparisonText = 'CURRENT VAULT vs BACKUP\n' + rows.join('\n') + (lower.length ? '\n\nDATA-LOSS WARNING: The backup has fewer records in one or more sections:\n• ' + lower.join('\n• ') : '\n\nNo decrease detected in the compared record counts. This does not guarantee every individual record is identical.');
                        } catch (compareErr) {
                            comparisonText = 'CURRENT VAULT COMPARISON FAILED: ' + (compareErr && compareErr.message ? compareErr.message : 'unknown error') + '. The current vault has not been changed.';
                        }
                    } else if (!oldStored) {
                        comparisonText = 'CURRENT VAULT: no existing saved vault detected; this restore will create the vault from the selected backup.';
                    }
                    const suspiciouslyEmpty = actualCounts.accounts === 0 && actualCounts.transactions === 0;
                    const currentHasData = !!oldStored;
                    if (suspiciouslyEmpty && currentHasData) {
                        const emptyChoice = await this.uiDialog('WARNING — backup contains no financial records', 'This backup has 0 Accounts & Wallets and 0 Core Ledger transactions. If you expected your existing financial data, STOP and select a different backup. Restoring this file would replace the current vault with an empty one.\n\nTo proceed only if an empty vault is intentional, type RESTORE EMPTY.', {type:'input', inputType:'text', okLabel:'Continue', cancelLabel:'Cancel', danger:true});
                        if (emptyChoice !== 'RESTORE EMPTY') {
                            alert('Restore cancelled. Your current vault was not changed.');
                            return;
                        }
                    }
                    if (!await this.showRestorePreview(currentCounts, actualCounts, file.name, backupMeta ? 'Full backup v2' : 'Legacy encrypted backup', backupMeta && backupMeta.createdAt ? backupMeta.createdAt : '')) return;

                    // Require a recovery snapshot before changing the active vault. If this fails, abort restore.
                    if (oldStored) {
                        recoveryKey = 'aifico_vault_pre_restore_' + new Date().toISOString().replace(/[:.]/g, '-');
                        try {
                            await this.storage.setItem(recoveryKey, oldStored);
                            if (await this.storage.getItem(recoveryKey) !== oldStored) throw new Error('Recovery snapshot read-back mismatch.');
                        } catch (snapshotErr) {
                            if (recoveryKey) { try { await this.storage.removeItem(recoveryKey); } catch (_) {} }
                            recoveryKey = null;
                            throw new Error('Restore cancelled because a recovery copy of the current vault could not be saved in browser storage. Export a full backup of the current vault and try again. Details: ' + (snapshotErr && snapshotErr.message ? snapshotErr.message : 'Browser storage unavailable.'));
                        }
                    }
                    await this.storage.setItem('aifico_vault', encryptedPayload);
                    changedVault = true;
                    const saved = await this.storage.getItem('aifico_vault');
                    if (!saved) throw new Error('The restored vault was not found after saving.');
                    const verifyData = this.validateBackupData(await this.vault.decryptData(saved, pwd));
                    const verifiedCounts = this.getBackupRecordCounts(verifyData);
                    if (JSON.stringify(verifiedCounts) !== JSON.stringify(actualCounts)) throw new Error('Post-restore verification failed: saved record counts do not match the preview.');
                    // The restore is committed only after the saved vault decrypts and validates.
                    alert('RESTORE SUCCESSFUL — the saved vault was decrypted and verified.\n\n' + summary + (recoveryKey ? '\n\nA recovery snapshot of the previous vault was also saved in this browser under aifico_vault_pre_restore_… . Keep a separate downloaded backup as well.' : '') + '\n\nThe app will reload. Unlock with the master password for the restored backup.');
                    try { localStorage.setItem('aifico_restored', usedRecoveryCode ? 'code' : 'password'); } catch (_) {}
                    location.reload();
                } catch (err) {
                    // Roll back if the active vault was changed but any verification failed.
                    if (changedVault) {
                        try { if (oldStored) await this.storage.setItem('aifico_vault', oldStored); else await this.storage.removeItem('aifico_vault'); } catch (_) {}
                    }
                    alert('RESTORE STOPPED — ' + (err && err.message ? err.message : 'The selected backup could not be restored.') + '\n\nThe active vault was not intentionally changed. If a failure occurred during saving, the previous encrypted vault was restored where browser storage allowed.');
                } finally {
                    if (input) input.value = '';
                }
            }

        }
