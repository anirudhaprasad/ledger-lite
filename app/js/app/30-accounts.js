// AificoApp methods: accounts (24 methods). Part of the AificoApp prototype chain.
        class AificoAppAccounts extends AificoAppDashboard {
            /**
             * Calculates an account balance at a specified date from its recorded balance and later transactions.
             * Parameters: accountName,isoDate. Side effects, if any, are described by the statements below.
             */
            balanceOn(accountName,isoDate){ const acc=(this.data.accounts||[]).find(a=>a.name===accountName); if(!acc)return null; let bal=Number(acc.balance)||0;
                for(const t of (this.data.tx||[])){ if(t.balanceEffectRemoved)continue; const d=(this.parseLedgerDate(t.date)||'').slice(0,10); if(!d||d<=isoDate)continue; this.txEffects(t).forEach(e=>{ if(e.account===accountName)bal-=e.delta; }); }
                return Math.round(bal*100)/100; }
            /**
             * Handles the rebuild account balance from ledger by index workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: index. Side effects, if any, are described by the statements below.
             */
            async rebuildAccountBalanceFromLedgerByIndex(index) {
                const account=this.data.accounts?.[Number(index)];
                if(!account) return alert('Account not found. Refresh the dashboard and try again.');
                const name=String(account.name||'');
                const rows=(this.data.tx||[]).filter(t=>!t.balanceEffectRemoved&&(String(t.account||'')===name || String(t.destinationAccount||t.toAccount||'')===name));
                const n=v=>{if(typeof v==='string')v=v.replace(/[₹,\s]/g,'');const x=Number(v);return Number.isFinite(x)?x:NaN;};
                const invalid=rows.filter(t=>!Number.isFinite(n(t.amount))||n(t.amount)<0);
                if(invalid.length) return alert(`Cannot safely rebuild ${name}: ${invalid.length} linked transaction(s) have invalid or negative amounts. Review those rows first. No data was changed.`);
                let movement=0;
                for(const t of rows){
                    const amount=n(t.amount); const source=String(t.account||'')===name; const dest=String(t.destinationAccount||t.toAccount||'')===name;
                    if(t.type==='Transfer'){ if(source) movement-=amount; if(dest) movement+=amount; }
                    else if(source){ if(t.type==='Income') movement+=amount; else if(['Expense','EMI','Installment','Insurance','Investment'].includes(t.type)) movement-=amount; }
                }
                const fmt=v=>`${CUR()}${v.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
                const existingOpening=Number(account.openingBalance);
                const suggestedOpening=Number.isFinite(existingOpening)?existingOpening:0;
                const openingRaw=await this.uiInput('Rebuild account balance', `Rebuild balance for ${name} from ${rows.length} linked Core Ledger transaction(s).\n\nCalculated net ledger movement: ${fmt(movement)}\n\nEnter the account's opening balance before these transactions. If you never recorded an opening balance, enter 0. This is needed because current balance alone cannot reveal the historical opening balance.`,String(suggestedOpening));
                if(openingRaw===null)return;
                const normalized=String(openingRaw).trim().replace(/[₹,\s]/g,'');
                if(!/^-?\d+(?:\.\d{1,2})?$/.test(normalized))return alert('Enter a valid opening balance. No data was changed.');
                const opening=Number(normalized); const rebuilt=opening+movement;
                if(!Number.isFinite(rebuilt)||Math.abs(rebuilt)>=1000000000)return alert('The reconstructed balance is still unusually large. No data was changed; inspect the linked entries and opening balance.');
                const preview=rows.slice(0,8).map(t=>`${t.date||'No date'} · ${t.type||'Unknown'} · ${t.payee||t.description||t.notes||t.note||'Transaction'} · ${fmt(n(t.amount))}`).join('\n');
                if(!await this.uiConfirm(`Rebuild ${name} from ledger?\n\nLinked transactions: ${rows.length}\nOpening balance: ${fmt(opening)}\nNet movement: ${fmt(movement)}\nNew balance: ${fmt(rebuilt)}\n\nSample entries:\n${preview||'No linked entries'}\n\nThis changes only the stored account balance; it does not delete or rewrite transactions. Confirm only if the opening balance and ledger entries are complete.`))return;
                account.balance=rebuilt; account.openingBalance=opening; account.balanceRebuiltFromLedgerAt=new Date().toISOString();
                this.saveVault(); this.renderAll();
                alert(`Balance rebuilt for ${name}: ${fmt(rebuilt)} using ${rows.length} linked ledger transaction(s). Please compare it with your bank statement.`);
            }

            /**
             * Handles the reconcile account balance by index workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: index. Side effects, if any, are described by the statements below.
             */
            reconcileAccountBalanceByIndex(index) {
                const account=this.data.accounts?.[Number(index)];
                if(!account) return alert('Account not found. Refresh the dashboard and try again.');
                return this.reconcileAccountBalance(String(account.id??account.name));
            }
            /**
             * Opens the  account ledger entries by index screen, dialog, or workflow.
             * Parameters: index. Side effects, if any, are described by the statements below.
             */
            openAccountLedgerEntriesByIndex(index) {
                const account=this.data.accounts?.[Number(index)];
                if(!account) return alert('Account not found. Refresh the dashboard and try again.');
                return this.openAccountLedgerEntries(account.name);
            }

            /**
             * Handles the reconcile account balance workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: accountKey. Side effects, if any, are described by the statements below.
             */
            async reconcileAccountBalance(accountKey) {
                const account = (this.data.accounts||[]).find(a => String(a.id??a.name) === String(accountKey));
                if (!account) return alert('Account not found. Refresh the dashboard and try again.');
                const current = Number(account.balance);
                const currentText = Number.isFinite(current) ? current.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}) : String(account.balance);
                const raw = await this.uiInput('Verify current balance', `Set the VERIFIED current balance for ${account.name}.\nCurrent stored value: ${CUR()}${currentText}\n\nEnter the balance shown by your bank statement. This does not alter transactions.`, Number.isFinite(current) && Math.abs(current)<1000000000 ? String(current) : '');
                if (raw === null) return;
                const normalized = String(raw).trim().replace(/[₹,\s]/g,'');
                if (!normalized || !/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) return alert('Enter a valid balance, e.g. 12500.50 or -500.00. No data was changed.');
                const value = Number(normalized);
                if (!Number.isFinite(value) || Math.abs(value) >= 1000000000) return alert('That balance is still unusually large. Please check the value and try again.');
                if (!await this.uiConfirm(`Replace the stored balance for ${account.name} with ${CUR()}${value.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}?

This only changes the account balance; all Core Ledger transactions remain unchanged.`)) return;
                account.balance = value;
                this.saveVault(); this.renderAll();
                alert(`Verified balance saved for ${account.name}. Review Core Ledger and dashboard totals.`);
            }

            /**
             * Opens the  account ledger entries screen, dialog, or workflow.
             * Parameters: accountName. Side effects, if any, are described by the statements below.
             */
            openAccountLedgerEntries(accountName) {
                const name=String(accountName||'');
                const account=(this.data.accounts||[]).find(a=>String(a.name||'')===name);
                if(!account)return alert('Account not found. Refresh the Accounts & Wallets view and try again.');
                this.accountLedgerPanelAccount=name;
                this.accountLedgerSelectedIds=new Set();
                this.renderAccountLedgerEntriesPanel();
                const panel=document.getElementById('account-ledger-panel');
                if(panel){panel.scrollIntoView({behavior:'smooth',block:'start'});}
            }

            /**
             * Renders the  account ledger entries panel UI from the current app state.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            renderAccountLedgerEntriesPanel() {
                const name=String(this.accountLedgerPanelAccount||'');
                const panel=document.getElementById('account-ledger-panel');
                if(!panel)return;
                const account=(this.data.accounts||[]).find(a=>String(a.name||'')===name);
                if(!account){panel.classList.add('hidden');panel.innerHTML='';return;}
                const rows=(this.data.tx||[]).filter(t=>String(t.account||'')===name||String(t.destinationAccount||t.toAccount||'')===name).sort((a,b)=>(this.parseLedgerDate(b.date)||'').localeCompare(this.parseLedgerDate(a.date)||''));
                const esc=v=>this.escapeHtml(String(v??''));
                const fmt=v=>`${CUR()}${(Number(v)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
                const selected=this.accountLedgerSelectedIds instanceof Set?this.accountLedgerSelectedIds:new Set();
                const rowsHtml=rows.map(t=>{
                    const id=String(t.id??'');
                    const desc=t.payee||t.description||t.notes||t.note||'Transaction';
                    const excluded=!!t.excludedFromLedger, duplicate=!!t.duplicateOf;
                    return `<tr class="border-b border-slate-100 dark:border-slate-800 align-top ${excluded?'opacity-70':''}"><td class="p-2"><input type="checkbox" aria-label="Select transaction ${esc(id)}" ${selected.has(id)?'checked':''} onchange="app.toggleAccountLedgerSelection(this.dataset.txid,this.checked)" data-txid="${esc(id)}" class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"></td><td class="p-2 whitespace-nowrap">${esc(t.date||'—')}</td><td class="p-2">${esc(t.type||'Unknown')}${excluded?'<div class="text-xs text-amber-600">Excluded</div>':''}${duplicate?'<div class="text-xs text-amber-600">SMS duplicate</div>':''}</td><td class="p-2 min-w-44"><div class="font-medium">${esc(desc)}</div>${t.category?`<div class="text-xs text-slate-500">${esc(t.category)}${t.subcategory?' / '+esc(t.subcategory):''}</div>`:''}</td><td class="p-2 min-w-32">${esc(t.account||'—')}${(t.destinationAccount||t.toAccount)?`<div class="text-xs text-slate-500">→ ${esc(t.destinationAccount||t.toAccount)}</div>`:''}</td><td class="p-2 text-right whitespace-nowrap">${fmt(t.amount)}</td><td class="p-2 text-right"><button type="button" data-txid="${esc(id)}" onclick="app.deleteAccountLedgerTransaction(this.dataset.txid)" class="px-2 py-1 rounded-lg border border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-300 text-xs">Delete</button></td></tr>`;
                }).join('');
                panel.innerHTML=`<div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4"><div><h3 class="font-bold text-lg">${esc(name)} — Core Ledger</h3><p class="text-sm text-slate-500 mt-1">${rows.length} linked transaction(s). Deleting selected entries here also removes them from the master Core Ledger.</p><p class="text-sm font-semibold mt-2">Stored account balance: ${fmt(account.balance)}</p></div><button type="button" onclick="app.closeAccountLedgerPanel()" class="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm">Close entries</button></div><div class="flex flex-wrap items-center justify-between gap-3"><p class="text-xs text-slate-500">Transfers appear when this account is the source or destination. Selecting a transfer deletes the complete ledger transaction.</p><div class="flex flex-wrap gap-2"><button type="button" onclick="app.deleteSelectedAccountLedgerEntries()" class="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm" ${selected.size?'':'disabled'}>Delete selected (${selected.size})</button><button type="button" onclick="app.deleteAllAccountLedgerEntries()" class="px-3 py-2 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950 text-sm" ${rows.length?'':'disabled'}>Delete all ${rows.length} entries</button></div></div><div class="overflow-auto max-h-[65vh] rounded-xl border border-slate-200 dark:border-slate-800"><table class="w-full text-sm"><thead class="sticky top-0 bg-slate-50 dark:bg-slate-900"><tr class="text-left border-b border-slate-200 dark:border-slate-800"><th class="p-2"><input type="checkbox" aria-label="Select all visible transactions" onchange="app.toggleAllAccountLedgerSelection(this.checked)" ${rows.length&&rows.every(t=>selected.has(String(t.id??'')))?'checked':''} class="h-4 w-4 rounded border-slate-300 text-emerald-600"></th><th class="p-2">Date</th><th class="p-2">Type / status</th><th class="p-2">Description</th><th class="p-2">Account</th><th class="p-2 text-right">Amount</th><th class="p-2"><span class="sr-only">Delete</span></th></tr></thead><tbody>${rowsHtml||'<tr><td colspan="6" class="p-5 text-center text-slate-500">No transactions linked to this account.</td></tr>'}</tbody></table></div><p class="text-xs text-rose-700 dark:text-rose-300">Deletion is permanent. Create a verified backup first. Canceling a confirmation leaves all records unchanged.</p>`;
                panel.classList.remove('hidden');
            }

            /**
             * Changes the account ledger selection and refreshes dependent UI.
             * Parameters: id, checked. Side effects, if any, are described by the statements below.
             */
            toggleAccountLedgerSelection(id, checked) {
                if(!(this.accountLedgerSelectedIds instanceof Set))this.accountLedgerSelectedIds=new Set();
                checked?this.accountLedgerSelectedIds.add(String(id)):this.accountLedgerSelectedIds.delete(String(id));
                this.renderAccountLedgerEntriesPanel();
            }

            /**
             * Changes the all account ledger selection and refreshes dependent UI.
             * Parameters: checked. Side effects, if any, are described by the statements below.
             */
            toggleAllAccountLedgerSelection(checked) {
                const name=String(this.accountLedgerPanelAccount||'');
                const rows=(this.data.tx||[]).filter(t=>String(t.account||'')===name||String(t.destinationAccount||t.toAccount||'')===name);
                this.accountLedgerSelectedIds=new Set(checked?rows.map(t=>String(t.id??'')):[]);
                this.renderAccountLedgerEntriesPanel();
            }

            /**
             * Handles the close account ledger panel workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            closeAccountLedgerPanel() {
                const panel=document.getElementById('account-ledger-panel');
                if(panel){panel.classList.add('hidden');panel.innerHTML='';}
                this.accountLedgerPanelAccount=null;
                this.accountLedgerSelectedIds=new Set();
            }

            /**
             * Removes account ledger ids, including associated cleanup where applicable.
             * Parameters: ids, confirmMessage. Side effects, if any, are described by the statements below.
             */
            async deleteAccountLedgerIds(ids, confirmMessage) {
                const unique=[...new Set((ids||[]).map(String))];
                if(!unique.length)return;
                if(!await this.uiConfirm(confirmMessage))return;
                const beforeDelete=JSON.parse(JSON.stringify(this.data));
                const rows=(this.data.tx||[]).filter(t=>unique.includes(String(t.id)));
                for(const tx of rows){
                    const amount=Number(tx.amount)||0;
                    if(tx.balanceEffectRemoved)continue;
                    const source=this.data.accounts.find(a=>String(a.name)===String(tx.account||''));
                    if(source){if(tx.type==='Income')source.balance=(Number(source.balance)||0)-amount;else if(['Expense','EMI','Installment','Insurance'].includes(tx.type))source.balance=(Number(source.balance)||0)+amount;else if(tx.type==='Transfer'||tx.type==='Investment')source.balance=(Number(source.balance)||0)+amount;}
                    if(tx.type==='Transfer'){const dest=this.data.accounts.find(a=>String(a.name)===String(tx.destinationAccount||tx.toAccount||''));if(dest)dest.balance=(Number(dest.balance)||0)-amount;}
                }
                this.data.tx=(this.data.tx||[]).filter(t=>!unique.includes(String(t.id)));
                await this.releaseDuplicatesOf(rows.map(t=>t.id));
                const saved=await this.saveVault();
                if(!saved){this.data=beforeDelete;this.renderAll();this.renderAccountLedgerEntriesPanel();return;}
                this.accountLedgerSelectedIds=new Set();
                this.renderAll();
                this.renderAccountLedgerEntriesPanel();
            }

            /**
             * Removes selected account ledger entries, including associated cleanup where applicable.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            async deleteSelectedAccountLedgerEntries() {
                const name=String(this.accountLedgerPanelAccount||'');
                const selected=this.accountLedgerSelectedIds instanceof Set?[...this.accountLedgerSelectedIds]:[];
                const linked=(this.data.tx||[]).filter(t=>(String(t.account||'')===name||String(t.destinationAccount||t.toAccount||'')===name)&&selected.includes(String(t.id)));
                if(!linked.length)return alert('Select at least one transaction first.');
                return this.deleteAccountLedgerIds(linked.map(t=>t.id),`Permanently delete ${linked.length} selected Core Ledger transaction(s) linked to ${name}?\n\nThese records will also be removed from the master Core Ledger. Transfers will be deleted in full, including their source/destination effects where supported. This cannot be undone. Create a verified backup first.`);
            }

            /**
             * Removes account ledger transaction, including associated cleanup where applicable.
             * Parameters: id. Side effects, if any, are described by the statements below.
             */
            async deleteAccountLedgerTransaction(id) {
                const name=String(this.accountLedgerPanelAccount||'');
                const tx=(this.data.tx||[]).find(t=>String(t.id)===String(id));
                if(!tx||!(String(tx.account||'')===name||String(tx.destinationAccount||tx.toAccount||'')===name))return alert('This transaction is no longer linked to the selected account. Refresh and try again.');
                const amountLabel=`${CUR()}${(Number(tx.amount)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
                return this.deleteAccountLedgerIds([tx.id],`Permanently delete this Core Ledger transaction?\n\n${tx.date||'No date'} · ${tx.payee||tx.description||tx.notes||tx.note||'Transaction'} · ${amountLabel}\n\nThis removes it from the master Core Ledger too. Balances will be reversed where supported. This cannot be undone.`);
            }

            /**
             * Removes all account ledger entries, including associated cleanup where applicable.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            async deleteAllAccountLedgerEntries() {
                const name=String(this.accountLedgerPanelAccount||'');
                const rows=(this.data.tx||[]).filter(t=>String(t.account||'')===name||String(t.destinationAccount||t.toAccount||'')===name);
                if(!rows.length)return;
                return this.deleteAccountLedgerIds(rows.map(t=>t.id),`Permanently delete all ${rows.length} Core Ledger transaction(s) linked to ${name}?\n\nThis includes transfers where the account is source or destination. All these transactions will also be removed from the master Core Ledger. Balances will be reversed where supported. This cannot be undone. Create a verified backup first.`);
            }

            /**
             * Returns or checks  global default account.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            getGlobalDefaultAccount(){
                const key=this.data.settings?.defaultAccountId||this.data.defaultAccountId||'';
                return (this.data.accounts||[]).find(a=>String(a.id||a.name)===String(key)) || (this.data.accounts||[]).find(a=>String(a.name).toLowerCase()===String(this.data.settings?.defaultAccountName||this.data.defaultAccountName||'').toLowerCase()) || (this.data.accounts||[]).find(a=>/checking|salary/i.test(String(a.type||'')+' '+String(a.name||''))) || (this.data.accounts||[]).find(a=>!/cash/i.test(String(a.type||'')+' '+String(a.name||''))) || (this.data.accounts||[])[0] || null;
            }
            /**
             * Validates and saves  global default account.
             * Parameters: key. Side effects, if any, are described by the statements below.
             */
            saveGlobalDefaultAccount(key){
                const account=(this.data.accounts||[]).find(a=>String(a.id||a.name)===String(key));
                if(!account)return;
                if(!this.data.settings)this.data.settings={};
                this.data.settings.defaultAccountId=String(account.id||account.name);
                this.data.settings.defaultAccountName=account.name;
                this.data.defaultAccountId=String(account.id||account.name);
                this.data.defaultAccountName=account.name;
                this.saveVault();this.renderAll();
                const status=document.getElementById('global-default-account-status');
                if(status)status.textContent='Saved — default account: '+account.name;
            }
            /**
             * Renders the  global default account UI from the current app state.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            renderGlobalDefaultAccount(){
                const select=document.getElementById('global-default-account');if(!select)return;
                const accounts=this.data.accounts||[],def=this.getGlobalDefaultAccount();
                select.innerHTML=accounts.map(a=>`<option value="${this.escapeHtml(String(a.id||a.name))}">${this.escapeHtml(a.name||'Unnamed account')} — ${this.escapeHtml(a.type||'Account')}</option>`).join('')||'<option value="">Create an account first</option>';
                if(def)select.value=String(def.id||def.name);
                if(def&&!(this.data.settings?.defaultAccountId||this.data.defaultAccountId)) {
                    if(!this.data.settings)this.data.settings={};
                    this.data.settings.defaultAccountId=String(def.id||def.name);this.data.settings.defaultAccountName=def.name;
                    this.data.defaultAccountId=String(def.id||def.name);this.data.defaultAccountName=def.name;
                    this.saveVault();
                }
            }
            /**
             * Renders the  accounts dropdown UI from the current app state.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            renderAccountsDropdown() {
                const select = document.getElementById('import-target-account');
                if (!select) return;
                const accounts = Array.isArray(this.data.accounts) ? this.data.accounts : [];
                // Preserve only an account the user explicitly selected in this import session.
                // Never silently route a statement to the global default account.
                const previous = select.dataset.userSelected === 'true' ? select.value : '';
                select.innerHTML = '<option value="">Select the account for this statement…</option><option value="__create_from_statement__">＋ Create account from this statement…</option>' + accounts.map(a => {
                    const key = String(a.id || a.name);
                    const label = `${a.name || 'Unnamed account'} (${a.type || 'Account'} · ${CUR()}${Number(a.balance || 0).toLocaleString('en-IN')})`;
                    return `<option value="${this.escapeHtml(key)}">${this.escapeHtml(label)}</option>`;
                }).join('');
                if (!accounts.length) select.innerHTML = '<option value="">Select an option…</option><option value="__create_from_statement__">＋ Create account from this statement…</option>'; 
                const validPrevious = accounts.find(a => String(a.id || a.name) === String(previous));
                select.value = validPrevious ? String(validPrevious.id || validPrevious.name) : '';
                select.dataset.userSelected = validPrevious ? 'true' : 'false';
                if (!select.dataset.mappingChangeBound) {
                    select.addEventListener('change', () => { select.dataset.userSelected = select.value ? 'true' : 'false'; });
                    select.dataset.mappingChangeBound = 'true';
                }
            }

            /**
             * Handles the resolve import target account workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: value. Side effects, if any, are described by the statements below.
             */
            resolveImportTargetAccount(value) {
                const key = String(value || '');
                return (this.data.accounts || []).find(a => String(a.id || a.name) === key || String(a.name || '') === key) || null;
            }

            /**
             * Renders the  accounts grid UI from the current app state.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            renderAccountsGrid() {
                const grid = document.getElementById('accounts-grid');
                const assetTypes=['Receivable','Checking','Cash','Savings','Investment','Fixed Deposit','Recurring Deposit','RD'];
                const liabilityTypes=['Loan Account','Loan'];
                const assets=this.data.accounts.filter(a=>assetTypes.includes(a.type)).reduce((n,a)=>n+(Number(a.balance)||0),0);
                const liabilities=this.data.accounts.filter(a=>liabilityTypes.includes(a.type)).reduce((n,a)=>n+Math.abs(Number(a.balance)||0),0); const cardDues=this.data.accounts.filter(a=>this.isCardType(a.type)).reduce((n,a)=>n+this.cardStatements(a).outstanding,0);
                const ordered=this.data.accounts.map((a, originalIndex) => ({a, originalIndex})).sort((left, right) => {
                    const leftIsCard=this.isCardType(left.a.type), rightIsCard=this.isCardType(right.a.type);
                    return Number(leftIsCard)-Number(rightIsCard) || left.originalIndex-right.originalIndex;
                });
                grid.innerHTML = `<div id="acct-kpis" class="kpi-row"><div class="kpi-tile"><div class="text-xs text-emerald-700">Total Assets</div><div class="text-2xl font-bold text-emerald-800">${CUR()}${assets.toLocaleString('en-IN',{minimumFractionDigits:2})}</div><div class="text-xs text-emerald-700">Includes savings, cash and investments</div></div><div class="kpi-tile"><div class="text-xs text-slate-600">Net Worth</div><div class="text-2xl font-bold">${CUR()}${(assets-liabilities).toLocaleString('en-IN',{minimumFractionDigits:2})}</div></div></div>` + `<ul id="acct-rows" class="acct-rows" aria-label="Accounts">${ordered.map(({a, originalIndex}) => this.accountRowHtml(a, originalIndex)).join('')}</ul>` + ordered.map(({a, originalIndex: accountIndex}) => {
                    const linkedCount=this.accountLinkedCount(a);
                    return `
                    <div class="acct-card p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                        <div class="flex items-center justify-between gap-2">
                            <button type="button" onclick="app.openAccountLedgerEntriesByIndex(${accountIndex})" class="text-left font-bold text-sm hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline" title="View this account's Core Ledger entries">${this.escapeHtml(a.name)}</button>
                            <span class="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">${this.escapeHtml(({'Loan Account':'Loan','Fixed Deposit':'Fixed Deposit','Recurring Deposit':'Recurring Deposit','RD':'Recurring Deposit'})[a.type]||a.type)}</span>
                        </div>
                        <button type="button" onclick="app.openAccountLedgerEntriesByIndex(${accountIndex})" class="text-xs text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400">${linkedCount} linked Core Ledger entr${linkedCount===1?'y':'ies'} · View entries</button>
                        <div class="text-xl font-bold ${Number(a.balance)<0?'text-rose-600 dark:text-rose-400':''}">${Number(a.balance)<0?('-'+CUR()):(CUR())}${Math.abs(Number(a.balance)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                        <div class="flex flex-wrap gap-x-3 gap-y-1">
                            <button onclick="app.editAccount('${a.id}')" class="text-xs text-blue-600 hover:underline">Edit</button>
                            <button onclick="app.deleteAccount('${a.id}')" class="text-xs text-rose-600 hover:underline">Delete</button>
                        </div>${this.isCardType(a.type)?this.cardAccountSummary(a):''}
                    </div>`;
                }).join('');
            }

            accountLinkedCount(a){ const n=String(a?.name||''); return (this.data.tx||[]).filter(t=>String(t.account||'')===n||String(t.destinationAccount||t.toAccount||'')===n).length; }
            accountMoney(a){ const v=Number(a?.balance)||0; return (v<0?'-':'')+CUR()+Math.abs(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); }
            accountTypeLabel(type){ return ({'Loan Account':'Loan','RD':'Recurring Deposit'})[type]||type||'Account'; }
            accountIcon(type){ const t=String(type||''); if(this.isCardType(t))return ['credit-card','card']; if(/loan/i.test(t))return ['hand-coins','loan']; if(/cash/i.test(t))return ['wallet','cash'];
                if(/fixed|recurring|^rd$/i.test(t))return ['piggy-bank','save']; if(/invest/i.test(t))return ['trending-up','invest']; if(/receivable/i.test(t))return ['handshake','recv']; return ['landmark','bank']; }
            /** One compact row per account on phones: icon, name, type and entries, balance. Tap for details and actions. */
            accountRowHtml(a,index){
                const esc=v=>this.escapeHtml(String(v??'')); const [icon,kind]=this.accountIcon(a.type); const n=this.accountLinkedCount(a);
                const due=this.isCardType(a.type)&&this.cardStatements?this.cardStatements(a).outstanding:0;
                const sub=[this.accountTypeLabel(a.type), due?`${CUR()}${due.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})} due`:`${n} entr${n===1?'y':'ies'}`].map(esc).join(' · ');
                return `<li><button type="button" class="acct-row" onclick="app.openAccountSheet(${index})" aria-label="${esc(a.name)}, ${esc(this.accountTypeLabel(a.type))}, balance ${esc(this.accountMoney(a))}"><span class="acct-ic acct-ic-${kind}" aria-hidden="true"><i data-lucide="${icon}"></i></span><span class="acct-main"><span class="acct-name">${esc(a.name)}</span><span class="acct-sub">${sub}</span></span><span class="acct-bal${Number(a.balance)<0?' neg':''}">${esc(this.accountMoney(a))}</span></button></li>`;
            }
            /** Bottom sheet for one account: balance, entries, card summary, and View entries / Edit / Delete. */
            openAccountSheet(index){
                const a=(this.data.accounts||[])[index]; if(!a)return; const esc=v=>this.escapeHtml(String(v??'')); const id=esc(String(a.id).replace(/\\/g,'\\\\').replace(/'/g,"\\'"));
                const n=this.accountLinkedCount(a); const [icon,kind]=this.accountIcon(a.type); const card=this.isCardType(a.type);
                document.getElementById('modal-box').innerHTML=`<div class="more-head"><h3 class="font-bold text-lg min-w-0 truncate"><span class="acct-ic acct-ic-${kind}" aria-hidden="true"><i data-lucide="${icon}"></i></span>${esc(a.name)}</h3><button type="button" onclick="app.closeModal()" aria-label="Close">✕</button></div>
                <div class="txa-amt${Number(a.balance)<0?' lx-out':''}">${esc(this.accountMoney(a))}</div>
                <dl class="txa-info"><div><dt>Type</dt><dd>${esc(this.accountTypeLabel(a.type))}</dd></div><div><dt>Core Ledger</dt><dd>${n} linked entr${n===1?'y':'ies'}</dd></div></dl>
                ${card&&this.cardAccountSummary?`<div class="acct-sheet-card">${this.cardAccountSummary(a)}</div>`:''}
                <div class="txa-actions acct-actions"><button type="button" class="s-btn s-primary" onclick="app.closeModal();app.openAccountLedgerEntriesByIndex(${index})"><i data-lucide="list"></i><span>View entries</span></button><button type="button" class="s-btn s-secondary" onclick="app.closeModal();app.editAccount('${id}')"><i data-lucide="pencil"></i><span>Edit</span></button><button type="button" class="s-btn s-danger-outline" onclick="app.closeModal();app.deleteAccount('${id}')"><i data-lucide="trash-2"></i><span>Delete</span></button></div>`;
                const mc=document.getElementById('modal-container'); mc.classList.add('more-sheet'); mc.classList.remove('hidden'); window.lucide?.createIcons?.();
            }

            /**
             * Updates account.
             * Parameters: id. Side effects, if any, are described by the statements below.
             */
            editAccount(id) {
                const a=this.data.accounts.find(x=>String(x.id)===String(id)); if(!a)return;
                const box=document.getElementById('modal-box');
                const types=['Checking','Savings','Cash','Credit Card','Loan Account','Investment','Fixed Deposit','Recurring Deposit']; if(a.type&&!types.includes(a.type))types.push(a.type);
                box.innerHTML=`<div class="flex items-center justify-between border-b pb-3"><h3 class="font-bold text-lg">Edit Account</h3><button type="button" onclick="app.closeModal()">✕</button></div>
                <form onsubmit="app.saveAccountEdit(event,'${String(a.id).replace(/'/g,"\\'")}')" class="space-y-4">
                <label class="block text-sm">Account name<input id="edit-account-name" required maxlength="80" value="${this.escapeHtml(a.name)}" class="mt-1 w-full px-3 py-2 rounded-xl border dark:bg-slate-800"></label>
                <label class="block text-sm">Account type<select id="edit-account-type" class="mt-1 w-full px-3 py-2 rounded-xl border dark:bg-slate-800">${types.map(t=>`<option ${t===a.type?'selected':''} value="${t}">${t}</option>`).join('')}</select></label>
                <label class="block text-sm">Current balance${CURL()}<input id="edit-account-balance" type="number" step="0.01" required value="${Number(a.balance)||0}" class="mt-1 w-full px-3 py-2 rounded-xl border dark:bg-slate-800"></label>
                <p class="text-xs text-slate-500">This edits the account's stored balance; it does not rewrite historical transactions.</p>
                <div class="flex justify-end gap-2"><button type="button" onclick="app.closeModal()" class="px-4 py-2 border rounded-lg">Cancel</button><button class="px-4 py-2 bg-emerald-600 text-white rounded-lg">Save changes</button></div></form>`;
                document.getElementById('modal-container').classList.remove('hidden');
            }
            /**
             * Validates and saves  account edit.
             * Parameters: event,id. Side effects, if any, are described by the statements below.
             */
            saveAccountEdit(event,id) {
                event.preventDefault();
                const a=this.data.accounts.find(x=>String(x.id)===String(id));if(!a)return;
                const oldName=a.name,newName=document.getElementById('edit-account-name').value.trim();
                const balance=Number(document.getElementById('edit-account-balance').value);
                const type=document.getElementById('edit-account-type').value;
                if(!newName||!Number.isFinite(balance))return alert('Enter a valid account name and balance.');
                if(this.data.accounts.some(x=>x.id!==a.id&&x.name.toLowerCase()===newName.toLowerCase()))return alert('An account with this name already exists.');
                if(oldName!==newName){this.data.tx.forEach(t=>{if(t.account===oldName)t.account=newName;if(t.destinationAccount===oldName)t.destinationAccount=newName;});}
                a.name=newName;a.type=type;a.balance=balance;
                this.saveVault();this.renderAll();this.closeModal();
            }
            /**
             * Opens the  account modal screen, dialog, or workflow.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            openAccountModal() { if((this.data.accounts||[]).length>=5)return alert('Lite supports up to 5 accounts.'); this.showSimpleForm('Add Account', [['name','Account name','text'],['type','Account type','select:Checking,Savings,Cash,Investment'],['balance',('Current / opening balance'+CURL()),'number']], values=>{if(this.data.accounts.some(a=>a.name.toLowerCase()===values.name.trim().toLowerCase()))return alert('An account with this name already exists.');this.data.accounts.push({id:'acc_'+Date.now(),name:values.name.trim(),type:values.type,balance:Number(values.balance)||0});this.saveVault();this.renderAll();this.closeModal();}); }
            /**
             * Removes account, including associated cleanup where applicable.
             * Parameters: id. Side effects, if any, are described by the statements below.
             */
            async deleteAccount(id) { const a=this.data.accounts.find(x=>String(x.id)===String(id)); if(!a)return; if(this.data.tx.some(t=>t.account===a.name))return alert('This account has transactions. Delete or reassign those transactions first.'); if(!await this.uiConfirm('Remove account '+a.name+'?'))return; this.data.accounts=this.data.accounts.filter(x=>String(x.id)!==String(id));this.saveVault();this.renderAll(); }
        }
