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
                    const stored = await this.activeVaultText();
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
            // ── Selective restore ("Bring back missing items") and partial backups ─────────────────────────────────────────
            // A restore can add only what this device is missing, section by section, without changing or deleting anything
            // that is here now (today's version always wins). Items are matched by their id (transactions also by uid,
            // accounts and categories by name, project steps by id inside their project).
            restoreSections(){ return [
                ['projects','Projects and their steps'],['tx','Core Ledger transactions'],['accounts','Accounts & wallets'],['categories','Categories & subcategories'],
                ['budgets','Budgets'],['goals','Goals'],['yearly','Schedules'],['smsInbox','SMS review records'],['shared','Shared & split'],['extras','My fields, SMS rules, project templates']]; }
            /** What a backup has that this device is missing: {key: {count, detail}} */
            restorePlan(cur,inc){
                const idSet=(list,...keys)=>new Set((list||[]).flatMap(x=>keys.map(k=>x&&x[k]).filter(v=>v!=null&&v!=='').map(String)));
                const missing=(list,have,...keys)=>(list||[]).filter(x=>x&&!keys.some(k=>x[k]!=null&&x[k]!==''&&have.has(String(x[k]))));
                const plan={};
                // Projects: whole projects missing here, and steps missing inside projects that are here
                const curP=new Map((cur.projects||[]).map(p=>[String(p.id),p])); let newProjects=0,newSteps=0; const stepTx=new Set();
                (inc.projects||[]).forEach(p=>{ const here=curP.get(String(p.id)); if(!here){ newProjects++; (p.steps||[]).forEach(s=>s.txId&&stepTx.add(String(s.txId))); return; }
                    const have=new Set((here.steps||[]).map(s=>String(s.id))); (p.steps||[]).forEach(s=>{ if(!have.has(String(s.id))){ newSteps++; if(s.txId)stepTx.add(String(s.txId)); } }); });
                plan.projects={count:newProjects+newSteps,detail:[newProjects&&`${newProjects} project${newProjects===1?'':'s'}`,newSteps&&`${newSteps} step${newSteps===1?'':'s'}`].filter(Boolean).join(', '),stepTx};
                const tx=missing(inc.tx,idSet(cur.tx,'id','uid'),'id','uid'); plan.tx={count:tx.length,detail:`${tx.length} entr${tx.length===1?'y':'ies'}`};
                const acc=missing(inc.accounts,new Set([...idSet(cur.accounts,'id'),...(cur.accounts||[]).map(a=>'name:'+String(a.name).toLowerCase())]),'id').filter(a=>!(cur.accounts||[]).some(c=>String(c.name).toLowerCase()===String(a.name).toLowerCase()));
                plan.accounts={count:acc.length,detail:acc.map(a=>a.name).slice(0,4).join(', ')};
                const cats=(inc.categories||[]).filter(c=>!(cur.categories||[]).includes(c)); let subs=0; Object.entries(inc.subcategories||{}).forEach(([c,l])=>{ const h=new Set(((cur.subcategories||{})[c]||[]).map(s=>typeof s==='string'?s:s.name)); (l||[]).forEach(s=>{ if(!h.has(typeof s==='string'?s:s.name))subs++; }); });
                plan.categories={count:cats.length+subs,detail:[cats.length&&`${cats.length} categor${cats.length===1?'y':'ies'}`,subs&&`${subs} subcategor${subs===1?'y':'ies'}`].filter(Boolean).join(', ')};
                const bud=[...Object.keys(inc.budgets||{}).filter(k=>!Object.prototype.hasOwnProperty.call(cur.budgets||{},k)), ...Object.entries(inc.subBudgets||{}).flatMap(([c,m])=>Object.keys(m||{}).filter(s=>cur.subBudgets?.[c]?.[s]==null).map(s=>c+' › '+s))]; plan.budgets={count:bud.length,detail:bud.slice(0,4).join(', ')};
                const goals=missing(inc.goals,idSet(cur.goals,'id'),'id'); plan.goals={count:goals.length,detail:goals.map(g=>g.title).slice(0,3).join(', ')};
                const yr=missing(inc.yearly,idSet(cur.yearly,'id'),'id'); plan.yearly={count:yr.length,detail:yr.map(g=>g.title).slice(0,3).join(', ')};
                const sms=missing(inc.smsInbox,idSet(cur.smsInbox,'id','messageKey'),'id','messageKey'); plan.smsInbox={count:sms.length,detail:`${sms.length} SMS`};
                const ss=inc.splitShare||{}, cs=cur.splitShare||{}; let shared=0; ['people','trips','expenses','settlements'].forEach(k=>{ shared+=missing(ss[k],idSet(cs[k],'id'),'id').length; }); plan.shared={count:shared,detail:`${shared} item${shared===1?'':'s'}`};
                const cf=missing(inc.customFields,idSet(cur.customFields,'id'),'id').length, tpl=Object.keys(inc.projectTemplates||{}).filter(k=>!(cur.projectTemplates||{})[k]).length;
                const ir=inc.smsRules||{}, cr=cur.smsRules||{}; const rules=Object.keys(ir.senders||{}).filter(k=>!(cr.senders||{})[k]).length+(ir.payeeCats||[]).filter(r=>!(cr.payeeCats||[]).some(x=>String(x.match).toLowerCase()===String(r.match).toLowerCase())).length;
                const ip=missing(inc.interestPlans,idSet(cur.interestPlans,'id'),'id').length;
                plan.extras={count:cf+tpl+rules+ip,detail:[cf&&`${cf} field${cf===1?'':'s'}`,rules&&`${rules} SMS rule${rules===1?'':'s'}`,tpl&&`${tpl} template${tpl===1?'':'s'}`,ip&&`${ip} loan/deposit plan${ip===1?'':'s'}`].filter(Boolean).join(', ')};
                return plan;
            }
            /** Adds the chosen sections' missing items to this.data. Account balances: transactions brought back move the
             * balances of accounts that are already here; accounts brought back keep the balance they had in the backup. */
            applyRestorePlan(inc,keys){
                const d=this.data, sel=new Set(keys), added={}; const idSet=(list,...k)=>new Set((list||[]).flatMap(x=>k.map(f=>x&&x[f]).filter(v=>v!=null&&v!=='').map(String)));
                const take=(arr,have,...k)=>(arr||[]).filter(x=>x&&!k.some(f=>x[f]!=null&&x[f]!==''&&have.has(String(x[f])))).map(x=>JSON.parse(JSON.stringify(x)));
                const newAccNames=new Set();
                if(sel.has('accounts')){ const acc=take(inc.accounts,idSet(d.accounts,'id'),'id').filter(a=>!(d.accounts||[]).some(c=>String(c.name).toLowerCase()===String(a.name).toLowerCase())); acc.forEach(a=>newAccNames.add(a.name)); (d.accounts||=[]).push(...acc); added.accounts=acc.length; }
                if(sel.has('categories')){ const cats=(inc.categories||[]).filter(c=>!(d.categories||[]).includes(c)); (d.categories||=[]).push(...cats); let subs=0;
                    Object.entries(inc.subcategories||{}).forEach(([c,l])=>{ (l||[]).forEach(s=>{ const n=typeof s==='string'?s:s.name; const h=((d.subcategories||={})[c]||[]).map(x=>typeof x==='string'?x:x.name); if(!h.includes(n)){ (d.subcategories[c]||=[]).push(s); subs++; } }); });
                    Object.entries(inc.categoryColors||{}).forEach(([c,v])=>{ (d.categoryColors||={})[c]??=v; }); added.categories=cats.length+subs; }
                // Transactions: the chosen section, plus entries that brought-back project steps were posted as
                const stepTx=sel.has('projects')?this.restorePlan(d,inc).projects.stepTx:new Set();
                const haveTx=idSet(d.tx,'id','uid'); const txIn=(inc.tx||[]).filter(t=>t&&!haveTx.has(String(t.id))&&!(t.uid&&haveTx.has(String(t.uid)))&&(sel.has('tx')||stepTx.has(String(t.id)))).map(t=>JSON.parse(JSON.stringify(t)));
                if(txIn.length){ const keep=new Map((d.accounts||[]).filter(a=>newAccNames.has(a.name)).map(a=>[a.name,a.balance]));
                    d.tx=[...txIn,...(d.tx||[])]; txIn.forEach(t=>this.applyTxEffects(t,1)); (d.accounts||[]).forEach(a=>{ if(keep.has(a.name))a.balance=keep.get(a.name); }); added.tx=txIn.length; }
                if(sel.has('projects')){ let n=0; const curP=new Map((d.projects||=[]).map(p=>[String(p.id),p]));
                    (inc.projects||[]).forEach(p=>{ const here=curP.get(String(p.id)); if(!here){ d.projects.push(JSON.parse(JSON.stringify(p))); n+=1+(p.steps||[]).length; return; }
                        const have=new Set((here.steps||[]).map(s=>String(s.id))); const miss=(p.steps||[]).filter(s=>!have.has(String(s.id))).map(s=>JSON.parse(JSON.stringify(s)));
                        if(miss.length){ here.steps=[...(here.steps||[]),...miss].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))); n+=miss.length; } }); added.projects=n; }
                if(sel.has('budgets')){ let n=0; Object.entries(inc.budgets||{}).forEach(([k,v])=>{ if(!Object.prototype.hasOwnProperty.call(d.budgets||={},k)){ d.budgets[k]=v; n++; } });
                    if(inc.budgetMeta&&typeof inc.budgetMeta==='object'){ d.budgetMeta||={}; Object.entries(inc.budgetMeta).forEach(([k,v])=>{ if(d.budgetMeta[k]==null)d.budgetMeta[k]=v; }); }
                    if(inc.subBudgets&&typeof inc.subBudgets==='object'){ d.subBudgets||={}; Object.entries(inc.subBudgets).forEach(([c,m])=>Object.entries(m||{}).forEach(([s,v])=>{ d.subBudgets[c]||={}; if(d.subBudgets[c][s]==null){ d.subBudgets[c][s]=v; n++; } })); } added.budgets=n; }
                if(sel.has('goals')){ const g=take(inc.goals,idSet(d.goals,'id'),'id'); (d.goals||=[]).push(...g); added.goals=g.length; }
                if(sel.has('yearly')){ const y=take(inc.yearly,idSet(d.yearly,'id'),'id'); (d.yearly||=[]).push(...y); added.yearly=y.length; }
                if(sel.has('smsInbox')){ const s=take(inc.smsInbox,idSet(d.smsInbox,'id','messageKey'),'id','messageKey'); (d.smsInbox||=[]).push(...s); added.smsInbox=s.length; }
                if(sel.has('shared')&&inc.splitShare){ let n=0; d.splitShare||={version:inc.splitShare.version||1,people:[],trips:[],expenses:[],settlements:[]}; ['people','trips','expenses','settlements'].forEach(k=>{ const s=take(inc.splitShare[k],idSet(d.splitShare[k],'id'),'id'); (d.splitShare[k]||=[]).push(...s); n+=s.length; }); added.shared=n; }
                if(sel.has('extras')){ let n=0; const cf=take(inc.customFields,idSet(d.customFields,'id'),'id'); (d.customFields||=[]).push(...cf); n+=cf.length;
                    Object.entries(inc.projectTemplates||{}).forEach(([k,v])=>{ if(!(d.projectTemplates||={})[k]){ d.projectTemplates[k]=v; n++; } });
                    Object.entries(inc.payeeFields||{}).forEach(([k,v])=>{ (d.payeeFields||={})[k]??=v; });
                    const ir=inc.smsRules||{}; const r=this.smsRules?this.smsRules():(d.smsRules||={senders:{},outWords:[],inWords:[],ignoreWords:[],payeeCats:[]});
                    Object.entries(ir.senders||{}).forEach(([k,v])=>{ if(!r.senders[k]){ r.senders[k]=v; n++; } }); ['outWords','inWords','ignoreWords'].forEach(k=>{ r[k]=[...new Set([...(r[k]||[]),...(ir[k]||[])])]; });
                    (ir.payeeCats||[]).forEach(x=>{ if(!r.payeeCats.some(y=>String(y.match).toLowerCase()===String(x.match).toLowerCase())){ r.payeeCats.push(x); n++; } });
                    const ip=take(inc.interestPlans,idSet(d.interestPlans,'id'),'id'); (d.interestPlans||=[]).push(...ip); n+=ip.length; added.extras=n; }
                return added;
            }
            /** Before any restore: the current vault is kept in storage (newest 3), so "Undo last restore" can bring it back */
            async saveRestoreSnapshot(kind){
                const stored=await this.storage.getItem('aifico_vault'); if(!stored)return null;
                const key='aifico_vault_pre_restore_'+new Date().toISOString().replace(/[:.]/g,'-'); await this.storage.setItem(key,stored);
                if(await this.storage.getItem(key)!==stored)throw new Error('The safety copy could not be verified.');
                let list=[]; try{ list=JSON.parse(localStorage.getItem('aifico_restore_snapshots')||'[]'); }catch(e){}
                list.unshift({key,at:new Date().toISOString(),kind}); for(const old of list.slice(3)){ try{ await this.storage.removeItem(old.key); }catch(e){} }
                try{ localStorage.setItem('aifico_restore_snapshots',JSON.stringify(list.slice(0,3))); }catch(e){} return key; }
            restoreSnapshots(){ try{ return JSON.parse(localStorage.getItem('aifico_restore_snapshots')||'[]'); }catch(e){ return []; } }
            /** Settings: put the vault back as it was just before the last restore */
            async undoLastRestore(){ if (this.remote) return this.remoteBlocked?.('Undoing a restore');
                const s=this.restoreSnapshots()[0]; if(!s)return alert('There is no restore to undo on this device.');
                const when=new Date(s.at).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'});
                if(!await this.uiConfirm(`Undo the restore of ${when}?\n\nThe data goes back to exactly how it was just before that restore${s.kind==='merge'?' (the items it brought back are removed)':''}. Anything added since then is lost, so back up first if you need it.\n\nAfter the app reloads, unlock with the master password you used before that restore.`,{okLabel:'Undo restore',danger:true}))return;
                const stored=await this.storage.getItem(s.key); if(!stored)return alert('The safety copy is no longer on this device.');
                await this.storage.setItem('aifico_vault',stored); const list=this.restoreSnapshots().slice(1); try{ localStorage.setItem('aifico_restore_snapshots',JSON.stringify(list)); }catch(e){}
                try{ await this.storage.removeItem(s.key); }catch(e){} location.reload(); }
            renderUndoRestore(){ const b=document.getElementById('undo-restore-btn'); if(!b)return; const s=this.restoreSnapshots()[0]; b.hidden=!s; if(s)b.querySelector('span').textContent='Undo last restore ('+new Date(s.at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})+')'; }
            /** Ask how to restore: bring back missing items, or replace everything. Resolves 'merge', 'replace' or null. */
            chooseRestoreMode(fileName,partial){
                return new Promise(resolve=>{ const box=document.getElementById('modal-box'); const esc=v=>this.escapeHtml(String(v??''));
                    box.innerHTML=`<div class="flex justify-between items-center pb-2"><h3 class="font-bold text-lg">How do you want to restore?</h3><button type="button" id="rm-x" aria-label="Close">✕</button></div>
                    <p class="text-sm text-slate-500 mb-3">${esc(fileName)}</p>
                    <div class="rm-choices"><button type="button" class="rm-choice rm-merge" id="rm-merge"><b>Bring back missing items</b><span>Choose what to bring back. Nothing you have now is changed or deleted; only items missing on this device are added.</span></button>
                    ${partial?'<p class="text-xs text-slate-500">This is a partial backup, so it can only bring back items.</p>':`<button type="button" class="rm-choice rm-replace" id="rm-replace"><b>Replace everything</b><span>This device becomes exactly the backup. Anything newer here is replaced. A safety copy is kept so you can undo.</span></button>`}</div>`;
                    document.getElementById('modal-container').classList.remove('hidden');
                    const done=v=>{ this.closeModal(); resolve(v); };
                    document.getElementById('rm-x').onclick=()=>done(null); document.getElementById('rm-merge').onclick=()=>done('merge'); const r=document.getElementById('rm-replace'); if(r)r.onclick=()=>done('replace'); });
            }
            /** The section picker with counts, then the merge; resolves true when items were brought back */
            bringBackFromBackup(inc,fileName){
                return new Promise(resolve=>{ const plan=this.restorePlan(this.data,inc); const esc=v=>this.escapeHtml(String(v??'')); const rows=this.restoreSections();
                    const any=rows.some(([k])=>plan[k]?.count>0); const box=document.getElementById('modal-box');
                    box.innerHTML=`<div class="flex justify-between items-center pb-2"><h3 class="font-bold text-lg">Bring back from the backup</h3><button type="button" id="bb-x" aria-label="Close">✕</button></div>
                    <p class="text-sm text-slate-500 mb-2">Only items missing on this device are added. Everything you have now stays as it is.</p>
                    ${any?`<form id="bb-form" class="space-y-2">${rows.map(([k,label])=>{ const c=plan[k]?.count||0; return `<label class="bb-row ${c?'':'bb-none'}"><input type="checkbox" name="${k}" ${c?'checked':'disabled'}><span><b>${esc(label)}</b><small>${c?esc(plan[k].detail||c+' missing'):'Nothing missing'}</small></span></label>`; }).join('')}
                    <p class="text-xs text-slate-500">A safety copy of this device is kept first, so you can undo this from Backup &amp; Settings.</p>
                    <div class="flex justify-end gap-2 pt-1"><button type="button" class="s-btn s-secondary" id="bb-cancel">Cancel</button><button class="s-btn s-primary">Bring back</button></div></form>`:'<p class="text-sm">This device already has everything in this backup. Nothing to bring back.</p><div class="flex justify-end pt-2"><button type="button" class="s-btn s-secondary" id="bb-cancel">Close</button></div>'}`;
                    document.getElementById('modal-container').classList.remove('hidden');
                    const done=v=>{ this.closeModal(); resolve(v); }; document.getElementById('bb-x').onclick=()=>done(false); document.getElementById('bb-cancel').onclick=()=>done(false);
                    const f=document.getElementById('bb-form'); if(f)f.onsubmit=async e=>{ e.preventDefault(); const keys=[...f.querySelectorAll('input:checked')].map(i=>i.name); if(!keys.length)return alert('Tick at least one section.');
                        try{ await this.saveVault(); await this.saveQueue; await this.saveRestoreSnapshot('merge'); }catch(err){ return alert('Stopped: a safety copy of this device could not be saved, so nothing was changed.\n\n'+(err?.message||err)); }
                        const added=this.applyRestorePlan(inc,keys); await this.saveVault(); this.closeModal(); this.renderAll(); this.renderUndoRestore();
                        const lines=rows.filter(([k])=>added[k]).map(([k,label])=>`${label}: ${added[k]}`);
                        alert('BROUGHT BACK\n\n'+(lines.length?lines.join('\n'):'Nothing was missing.')+'\n\nNothing that was already here was changed. To reverse this, use Backup & Settings → Undo last restore.'); resolve(true); }; });
            }
            /** Partial backup: only the chosen sections (plus the lists every backup needs, left empty) */
            backupSubset(data,keys){ const sel=new Set(keys); const out={tx:[],accounts:[],categories:[],budgets:{},_partial:keys};
                const copy=k=>{ if(data[k]!==undefined)out[k]=JSON.parse(JSON.stringify(data[k])); };
                if(sel.has('projects')){ copy('projects'); copy('projectTemplates'); const ids=new Set((data.projects||[]).flatMap(p=>(p.steps||[]).map(s=>s.txId).filter(Boolean)).map(String)); if(!sel.has('tx'))out.tx=(data.tx||[]).filter(t=>ids.has(String(t.id))); }
                if(sel.has('tx'))copy('tx'); if(sel.has('accounts'))copy('accounts'); if(sel.has('categories')){ copy('categories'); copy('subcategories'); copy('categoryColors'); }
                if(sel.has('budgets')){ copy('budgets'); copy('subBudgets'); copy('budgetMeta'); } if(sel.has('goals'))copy('goals'); if(sel.has('yearly'))copy('yearly'); if(sel.has('smsInbox'))copy('smsInbox'); if(sel.has('shared'))copy('splitShare');
                if(sel.has('extras')){ ['customFields','smsRules','projectTemplates','payeeFields','interestPlans'].forEach(copy); }
                return out; }
            /** Which restore: "merge" handled here (returns "done"), "replace" continues the full restore, null = cancelled */
            async restoreModeFor(restoredData,fileName,backupMeta,oldStored){
                const partial=!!(backupMeta&&backupMeta.partial)||Array.isArray(restoredData._partial);
                if(!(this.currentPassword&&this.data&&oldStored)){ if(partial)throw new Error('This is a partial backup (only some sections). Open your vault first, then restore it from Backup & Settings to bring its items back. Your data has not been changed.'); return 'replace'; }
                const m=await this.chooseRestoreMode(fileName,partial); if(!m)return null;
                if(m==='merge'){ await this.bringBackFromBackup(restoredData,fileName); return 'done'; }
                return 'replace'; }
            /** Back up some sections: pick, then the usual encrypted backup + backup code, named …-partial-backup-… */
            openPartialBackup(){
                const box=document.getElementById('modal-box'); const rows=this.restoreSections(); const esc=v=>this.escapeHtml(String(v??''));
                box.innerHTML=`<div class="flex justify-between items-center pb-2"><h3 class="font-bold text-lg">Back up some sections</h3><button type="button" onclick="app.closeModal()" aria-label="Close">✕</button></div>
                <p class="text-sm text-slate-500 mb-2">A smaller encrypted backup with its own backup code. Restoring it only brings back missing items; it never replaces your other data.</p>
                <form id="pb-form" class="space-y-2">${rows.map(([k,label])=>`<label class="bb-row"><input type="checkbox" name="${k}" ${k==='projects'?'checked':''}><span><b>${esc(label)}</b></span></label>`).join('')}
                <div class="flex justify-end gap-2 pt-1"><button type="button" class="s-btn s-secondary" onclick="app.closeModal()">Cancel</button><button class="s-btn s-primary">Back up</button></div></form>`;
                document.getElementById('modal-container').classList.remove('hidden');
                document.getElementById('pb-form').onsubmit=e=>{ e.preventDefault(); const keys=[...e.target.querySelectorAll('input:checked')].map(i=>i.name); if(!keys.length)return alert('Tick at least one section.'); this.closeModal(); this.exportVaultBackup(false,{sections:keys}); };
            }

            validateBackupData(data) {
                if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Decrypted content is not a database object.');
                if (!Array.isArray(data.tx)) throw new Error('The backup is missing the Transactions list.');
                if (!Array.isArray(data.accounts)) throw new Error('The backup is missing the Accounts & Wallets list.');
                if (!Array.isArray(data.categories)) throw new Error('The backup is missing the Categories list.');
                if (!data.budgets || typeof data.budgets !== 'object' || Array.isArray(data.budgets)) throw new Error('The backup has an invalid Budgets section.');
                return data;
            }

            /**
             * Hands a file to the device's share sheet: the Android app's own (AndroidBridge.shareFile), else the browser's
             * (Web Share with files). Returns 'android' / 'web' when the share sheet opened, 'cancel' when it was closed,
             * or null when this device has no share sheet for files (the caller then saves the file as usual).
             */
            async shareBackupFile(blob, name) {
                if (window.AndroidBridge && typeof window.AndroidBridge.shareFile === 'function') {
                    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const d = String(r.result || ''); res(d.slice(d.indexOf(',') + 1)); }; r.onerror = rej; r.readAsDataURL(blob); });
                    window.AndroidBridge.shareFile(b64, name, 'application/json'); return 'android';
                }
                const file = new File([blob], name, { type: 'application/json' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    try { await navigator.share({ files: [file], title: name }); return 'web'; } catch (e) { return e && e.name === 'AbortError' ? 'cancel' : null; }
                }
                return null;
            }
            /**
             * Creates a vault backup and its metadata; erase-related exports use the guarded path.
             * Parameters: forFullErase = false; opts.sections (partial backup), opts.share (send it through the share sheet).
             */
            async exportVaultBackup(forFullErase = false, opts = {}) {
                const kind = opts.sections && opts.sections.length ? 'partial' : 'full';   // partial: only the chosen sections
                if (!this.currentPassword) return alert('Unlock the vault first so the backup can be verified before export.');
                // Flush all pending saves and persist the latest in-memory state before reading the backup source.
                // This prevents a backup taken immediately after an edit/import from capturing an older vault.
                const saveSucceeded = await this.saveVault();
                if (saveSucceeded !== true) return alert('Backup stopped because the latest vault state could not be saved. No backup was downloaded and no data was reset.');
                try { await this.saveQueue; } catch (_) {
                    return alert('Backup stopped because a pending vault save failed. No backup was downloaded and no data was reset.');
                }
                // During PC access this is the phone's data: the backup downloaded on this PC is of the phone
                let stored; try { stored = await this.activeVaultText(); } catch (e) { return alert("Backup stopped: couldn't read your phone's data (" + (e?.message || e) + '). Check PC access is still on.'); }
                if (!stored) return alert('No vault data found. Nothing was exported.');
                let data;
                try {
                    data = this.validateBackupData(await this.vault.decryptData(stored, this.currentPassword));
                } catch (err) {
                    return alert('Backup was not created because the current vault could not be verified. No file was downloaded.\n\n' + (err && err.message ? err.message : 'Vault verification failed.'));
                }
                let parsedEncrypted = JSON.parse(stored);
                if (kind === 'partial') { data = this.backupSubset(data, opts.sections); parsedEncrypted = JSON.parse(await this.vault.encryptData(data, this.currentPassword)); }
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
                    ...(kind === 'partial' ? { partial: opts.sections } : {}),
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
                // File name: aificoledger-YYMMDD-HHmm (see fileStamp)
                const stamp = this.fileStamp();
                // Back up & share: the verified backup goes to the share sheet (Quick Share / Nearby Share to a PC,
                // Bluetooth, email…) instead of being saved. Only the encrypted file is sent; its backup code is not.
                if (opts.share) {
                    const sent = await this.shareBackupFile(blob, `${stamp}-${kind}-backup-encrypted.json`);
                    if (sent === 'cancel') return false;
                    if (sent) {
                        alert(`BACKUP VERIFIED AND READY TO SEND\n\nChoose your PC (Quick Share / Nearby Share), Bluetooth or email in the list.\nFile: ${stamp}-${kind}-backup-encrypted.json (encrypted)\n\nTo bring it back: send it from the PC to this phone, then Restore from backup and pick it (usually in Downloads). It opens with your master password.\n\nIts backup code (only needed if you forget the password) — keep it somewhere safe, apart from the file:\n${recoveryCode}`);
                        return true;
                    }
                    // No share sheet here (older browser): save it as usual instead
                }
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${stamp}-${kind}-backup-encrypted.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1500);
                const c = backup.recordCounts;
                // The backup code goes in its own file (never inside the encrypted backup)
                const codeText = `aifico ledger — Backup Code\n\nBackup file: ${stamp}-${kind}-backup-encrypted.json\nCreated: ${backup.createdAt}\n\nBackup code:\n${recoveryCode}\n\nTo restore: on the lock screen tap ? → Restore from a backup (or Backup & Settings → Restore from backup) → choose the backup file above → enter this code → set a new master password. The old master password is not needed.\n\nKeep this file separate from the backup file: anyone with both can open your financial data. Do not upload either file to public storage.\n`;
                const codeBlob = new Blob([codeText], { type: 'text/plain;charset=utf-8' });
                const codeUrl = URL.createObjectURL(codeBlob);
                const codeAnchor = document.createElement('a');
                codeAnchor.href = codeUrl;
                codeAnchor.download = `${stamp}-${kind}-backup-code.txt`;
                document.body.appendChild(codeAnchor);
                codeAnchor.click();
                codeAnchor.remove();
                setTimeout(() => URL.revokeObjectURL(codeUrl), 1500);
                alert(`${forFullErase ? 'FULL ERASE BACKUP VERIFIED' : 'BACKUP VERIFIED'}\n\nTwo files are saved:\n1. ${stamp}-${kind}-backup-encrypted.json (your data, encrypted)\n2. ${stamp}-${kind}-backup-code.txt (its backup code)\n\nBackup code — keep it apart from the backup file:\n\n${recoveryCode}\n\nTo restore this backup you only need the code; you then set a new master password. (The code is not copied to the clipboard, where clipboard history or sync could keep it.)\n\nIncluded: ${c.transactions} Core Ledger transactions (${c.ledgerActive} active, ${c.ledgerExcluded} excluded), ${c.accounts} accounts, ${c.categories} categories, ${c.budgets} budgets, ${c.goals} goals, ${c.sharedSplits} shared splits.`);
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
                if (this.remote) { if (event?.target) event.target.value = ''; return this.remoteBlocked?.('Restoring a backup'); }
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
                        // Unlocked with data here: bring back missing items, or replace everything (asked before any new password)
                        { const m = await this.restoreModeFor(restoredData, file.name, backupMeta, oldStored); if (m !== 'replace') return; }
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
                        { const m = await this.restoreModeFor(restoredData, file.name, backupMeta, oldStored); if (m !== 'replace') return; }
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
                            // listed for Backup & Settings → Undo last restore (newest 3 kept)
                            try { const list = this.restoreSnapshots(); list.unshift({ key: recoveryKey, at: new Date().toISOString(), kind: 'replace' }); for (const old of list.slice(3)) { try { await this.storage.removeItem(old.key); } catch (_) {} } localStorage.setItem('aifico_restore_snapshots', JSON.stringify(list.slice(0, 3))); } catch (_) {}
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
