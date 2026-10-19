// AificoApp methods: shared (36 methods). Part of the AificoApp prototype chain.
        class AificoAppShared extends AificoAppSchedules {
            // ---------- Shared & Split (Split & Share): trips/events, shared expenses, balances and settlements ----------
            /**
             * Handles the split data workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            splitData(){
                if(!this.data)return {people:[],trips:[],expenses:[],settlements:[]};
                let d=this.data.splitShare;
                if(!d||!Array.isArray(d.people)){ d=this.data.splitShare={version:1,people:[{id:'me',name:'Me'}],trips:[],expenses:[],settlements:[]}; this.migrateLegacyShared(d); this.importStandaloneSplit(d); }
                if(!d.people.some(p=>p.id==='me'))d.people.unshift({id:'me',name:'Me'});
                return d;
            }
            // Earlier "Shared Expenses" records become one event, so nothing is lost.
            /**
             * Handles the migrate legacy shared workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: d. Side effects, if any, are described by the statements below.
             */
            migrateLegacyShared(d){
                const old=Array.isArray(this.data.shared)?this.data.shared:[]; const names=new Set([...(this.data.members||[]),...old.flatMap(s=>[s.paidBy,...(s.members||[])])].map(n=>String(n||'').trim()).filter(Boolean));
                const idOf=n=>{ n=String(n||'').trim(); if(!n||/^(you|me)$/i.test(n))return 'me'; let p=d.people.find(x=>x.name.toLowerCase()===n.toLowerCase()); if(!p){ p={id:this.newUid(),name:n}; d.people.push(p); } return p.id; };
                names.forEach(idOf); if(!old.length)return;
                const trip={id:this.newUid(),name:'Earlier shared expenses',members:[...new Set(old.flatMap(s=>(s.members||[]).map(idOf)).concat('me'))],start:'',end:'',closed:false};
                d.trips.push(trip);
                old.forEach(s=>{ const shares={}; Object.entries(s.shares||{}).forEach(([n,v])=>{ if(Number(v)>0)shares[idOf(n)]=Number(v); }); const payer=idOf(s.paidBy); const date=String(s.createdAt||'').slice(0,10)||new Date().toISOString().slice(0,10);
                    d.expenses.push({id:this.newUid(),trip:trip.id,date,desc:s.title||'Shared expense',amount:Number(s.total)||0,payer,split:Object.keys(shares).length?'exact':'equal',among:[],shares});
                    Object.entries(s.settlements||{}).forEach(([n,v])=>{ const from=idOf(n); if(from===payer)return; const amt=typeof v==='number'?v:(v===true||v?.settled)?(shares[from]||0):0; if(amt>0)d.settlements.push({id:this.newUid(),date,from,to:payer,amount:amt,trip:trip.id}); });
                    if(s.settled&&!Object.keys(s.settlements||{}).length) Object.entries(shares).forEach(([pid,amt])=>{ if(pid!==payer&&amt>0)d.settlements.push({id:this.newUid(),date,from:pid,to:payer,amount:amt,trip:trip.id}); });
                });
            }
            // Data saved by the standalone Split & Share page on this device is brought in once.
            /**
             * Parses or imports standalone split and validates it before use.
             * Parameters: d. Side effects, if any, are described by the statements below.
             */
            importStandaloneSplit(d){
                try{ const raw=JSON.parse(localStorage.getItem('aifico_split_share_standalone_review_v1')||'null'); if(!raw||!Array.isArray(raw.trips)||!raw.trips.length)return;
                    const starter=/^Person(One|Two|Three|Four|Five)$/; const map={me:'me'};
                    (raw.people||[]).forEach(p=>{ if(p.id==='me')return; const used=(raw.expenses||[]).some(e=>e.payer===p.id||Object.keys(e.shares||{}).includes(p.id)||(e.among||[]).includes(p.id))||(raw.trips||[]).some(t=>(t.members||[]).includes(p.id)); if(starter.test(p.name)&&!used)return; const ex=d.people.find(x=>x.name.toLowerCase()===String(p.name).toLowerCase()); map[p.id]=ex?ex.id:(d.people.push({id:this.newUid(),name:p.name}),d.people.at(-1).id); });
                    const tmap={}; raw.trips.forEach(t=>{ const id=this.newUid(); tmap[t.id]=id; d.trips.push({...t,id,members:(t.members||[]).map(m=>map[m]).filter(Boolean)}); });
                    (raw.expenses||[]).forEach(e=>{ if(!tmap[e.trip])return; const shares={}; Object.entries(e.shares||{}).forEach(([k,v])=>{ if(map[k])shares[map[k]]=v; }); d.expenses.push({...e,id:this.newUid(),trip:tmap[e.trip],payer:map[e.payer]||'me',among:(e.among||[]).map(m=>map[m]).filter(Boolean),shares}); });
                    (raw.settlements||[]).forEach(s=>{ if(!map[s.from]||!map[s.to])return; d.settlements.push({...s,id:this.newUid(),from:map[s.from],to:map[s.to],trip:tmap[s.trip]||''}); });
                }catch(e){}
            }
            /**
             * Handles the ss person workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: id. Side effects, if any, are described by the statements below.
             */
            ssPerson(id){ return this.splitData().people.find(p=>p.id===id)?.name||'(removed person)'; }
            /**
             * Handles the ss trip workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: id. Side effects, if any, are described by the statements below.
             */
            ssTrip(id){ return this.splitData().trips.find(t=>t.id===id); }
            /**
             * Handles the ss money workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: n. Side effects, if any, are described by the statements below.
             */
            ssMoney(n){ return (CUR())+(Number(n)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); }
            /**
             * Calculates each participant’s share for an expense using the selected split method.
             * Parameters: e. Side effects, if any, are described by the statements below.
             */
            ssShares(e){
                const m=new Map();
                if(e.split==='exact'){ Object.entries(e.shares||{}).forEach(([id,v])=>{ if(Number(v)>0)m.set(id,Number(v)); }); return m; }
                const people=e.split==='some'&&e.among?.length?e.among:(this.ssTrip(e.trip)?.members||['me']); if(!people.length)return m;
                // split in whole paise so the shares add up exactly to the bill (the first people absorb the leftover paise)
                const cents=Math.round((Number(e.amount)||0)*100), base=Math.floor(cents/people.length); let rem=cents-base*people.length;
                people.forEach(id=>{ m.set(id,(base+(rem>0?1:0))/100); if(rem>0)rem--; }); return m;
            }
            // Balance = paid − share − sent + received. Positive: gets money back. Negative: owes.
            /**
             * Totals each participant’s paid amount minus their share to determine who owes/is owed.
             * Parameters: tid,includeClosed=false. Side effects, if any, are described by the statements below.
             */
            // Settlement balance = amount paid by a person − that person’s calculated share.
            // Positive balances are creditors; negative balances are debtors.
            ssBalances(tid,includeClosed=false){
                const d=this.splitData(); const inScope=x=>tid?x.trip===tid:(includeClosed||!this.ssTrip(x.trip)?.closed);
                const expenses=d.expenses.filter(inScope), settlements=d.settlements.filter(inScope);
                const map=new Map(); const row=id=>{ if(!map.has(id))map.set(id,{id,paid:0,share:0,sent:0,received:0,balance:0}); return map.get(id); }; row('me');
                expenses.forEach(e=>{ row(e.payer).paid+=Number(e.amount)||0; this.ssShares(e).forEach((v,id)=>{ row(id).share+=v; }); });
                settlements.forEach(s=>{ row(s.from).sent+=Number(s.amount)||0; row(s.to).received+=Number(s.amount)||0; });
                const rows=[...map.values()]; rows.forEach(r=>{ const b=Math.round((r.paid-r.share+r.sent-r.received)*100)/100; if(Math.abs(b)<0.5){ r.residue=b; r.balance=0; } else r.balance=b; });
                return rows.filter(r=>Math.abs(r.paid)+Math.abs(r.share)+Math.abs(r.sent)+Math.abs(r.received)>.004).sort((a,b)=>b.balance-a.balance);
            }
            // Fewest payments that settle everyone.
            /**
             * Matches debtors to creditors to produce a compact settlement-payment list.
             * Parameters: rows. Side effects, if any, are described by the statements below.
             */
            // Greedy settlement: pair the largest remaining debtor with a creditor.
            // Each suggested transfer is the smaller of the debtor amount and creditor amount; amounts are rounded to cents.
            ssSuggestions(rows){
                const cr=rows.filter(r=>r.balance>.005).map(r=>({id:r.id,n:r.balance})).sort((a,b)=>b.n-a.n), db=rows.filter(r=>r.balance<-.005).map(r=>({id:r.id,n:-r.balance})).sort((a,b)=>b.n-a.n); const out=[]; let i=0,j=0;
                while(i<db.length&&j<cr.length){ const a=Math.min(db[i].n,cr[j].n); if(a>.005)out.push({from:db[i].id,to:cr[j].id,amount:Math.round(a*100)/100}); db[i].n-=a; cr[j].n-=a; if(db[i].n<.005)i++; if(cr[j].n<.005)j++; }
                return out;
            }
            /**
             * Handles the ss fmt date workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: s. Side effects, if any, are described by the statements below.
             */
            ssFmtDate(s){ return s?new Date(s+'T12:00:00').toLocaleDateString('en-IN'):'—'; }
            /**
             * Handles the ss table workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: headers,rows. Side effects, if any, are described by the statements below.
             */
            ssTable(headers,rows,cls=''){ return rows.length?`<div class="ss-tablewrap"><table class="ss-table ${cls}"><thead><tr>${headers.map(h=>`<th class="${h.num?'r':''}">${h.label}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`:'<p class="ip-empty">Nothing here yet.</p>'; }
            /**
             * Handles the ss balance row workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: r. Side effects, if any, are described by the statements below.
             */
            ssBalanceRow(r){ const esc=v=>this.escapeHtml(String(v??'')); const m=v=>this.ssMoneyFit(v); return `<tr><td><b>${esc(this.ssPerson(r.id))}</b></td><td class="r" data-label="Paid">${m(r.paid)}</td><td class="r" data-label="Share">${m(r.share)}</td><td class="r" data-label="Settled">${r.sent>.004?`<small>paid</small>${m(r.sent)}`:r.received>.004?`<small>got</small>${m(r.received)}`:"—"}</td><td class="r ss-bal ${r.balance>.005?'ip-pos':r.balance<-.005?'ip-neg':''}"><small>${r.balance>.005?'gets':r.balance<-.005?'owes':'settled'}</small><b>${m(Math.abs(r.balance))}</b></td></tr>`; }
            /** "Who owes whom?" as a readable list: the person's position in large type, how it came about in one small line. */
            ssBalanceList(rows){
                if(!rows.length)return '<p class="ip-empty">Nothing here yet.</p>'; const esc=v=>this.escapeHtml(String(v??'')); const m=v=>this.ssMoneyFit(v);
                const order=r=>r.balance<0?0:r.balance>0?1:2; const list=rows.slice().sort((a,b)=>order(a)-order(b)||Math.abs(b.balance)-Math.abs(a.balance));
                return `<ul class="ss-owes-list">${list.map(r=>{ const st=r.balance<0?'owes':r.balance>0?'gets':'settled';
                    const bits=[`paid ${m(r.paid)}`,`share ${m(r.share)}`]; if(r.sent>.004)bits.push(`paid back ${m(r.sent)}`); if(r.received>.004)bits.push(`received ${m(r.received)}`);
                    const right=st==='settled'?'<span class="ss-pos-settled">Settled ✓</span>':`<span class="ss-pos-label">${st==='owes'?'owes':'gets back'}</span><b>${m(Math.abs(r.balance))}</b>`;
                    return `<li class="ss-owe ss-${st}"><div class="ss-owe-who"><b>${esc(this.ssPerson(r.id))}</b><span>${bits.join(' · ')}</span></div><div class="ss-owe-pos"${r.residue?` title="${m(Math.abs(r.residue))} rounding difference ignored"`:''}>${right}</div></li>`; }).join('')}</ul>`;
            }
            /** Amount for the fitted Shared & Split tables: no ".00" on whole rupees, paise kept otherwise. */
            ssMoneyFit(n){ const v=Math.round((Number(n)||0)*100)/100; return (CUR())+v.toLocaleString('en-IN',{minimumFractionDigits:Number.isInteger(v)?0:2,maximumFractionDigits:2}); }
            /**
             * Handles the ss payments workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: pays,actions=false. Side effects, if any, are described by the statements below.
             */
            ssPayments(pays,actions=false){ const esc=v=>this.escapeHtml(String(v??'')); return pays.length?`<div class="ss-tablewrap"><table class="ss-table ss-fit ss-pay"><thead><tr><th>Who pays</th><th>Who receives</th><th class="r">Amount</th>${actions?'<th><span class="sr-only">Action</span></th>':''}</tr></thead><tbody>${pays.map(p=>`<tr><td>${esc(this.ssPerson(p.from))}</td><td>${esc(this.ssPerson(p.to))}</td><td class="r"><b>${this.ssMoneyFit(p.amount)}</b></td>${actions?`<td><button type="button" class="ss-btn" onclick="app.ssSettleForm('${esc(p.from)}','${esc(p.to)}',${p.amount})">Mark paid</button></td>`:''}</tr>`).join('')}</tbody></table></div>`:'<p class="ip-empty">Everyone is settled up in the open events.</p>'; }
            /**
             * Handles the ss set tab workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: t,trip. Side effects, if any, are described by the statements below.
             */
            ssSetTab(t,trip){ this.ssTab=t; if(trip!==undefined)this.ssSelectedTrip=trip; this.renderShared(); }
            /**
             * Renders the  shared UI from the current app state.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            renderShared(){
                const root=document.getElementById('ss-root'); if(!root||!this.data)return; const d=this.splitData(); const esc=v=>this.escapeHtml(String(v??'')); const m=v=>this.ssMoney(v);
                const tab=this.ssTab||'overview'; document.querySelectorAll('#ss-tabs [data-ss]').forEach(b=>{ b.classList.toggle('on',b.dataset.ss===tab); b.setAttribute('aria-selected',String(b.dataset.ss===tab)); });
                const open=d.trips.filter(t=>!t.closed);
                if(tab==='overview'){
                    const rows=this.ssBalances(''); const spend=d.expenses.filter(e=>!this.ssTrip(e.trip)?.closed).reduce((s,e)=>s+Number(e.amount),0); const owed=rows.filter(r=>r.balance<-.005).reduce((s,r)=>s-r.balance,0); const get=rows.filter(r=>r.balance>.005).reduce((s,r)=>s+r.balance,0);
                    const me=rows.find(r=>r.id==='me')||{share:0,balance:0};
                    root.innerHTML=`<div class="ss-kpis"><div><span>Shared expenses · open events</span><b>${m(spend)}</b></div><div><span>Your share</span><b>${m(me.share)}</b></div><div><span>${me.balance<-.005?'You owe':'You get back'}</span><b class="${me.balance<-.005?'ip-neg':'ip-pos'}">${m(Math.abs(me.balance))}</b></div><div><span>Total still unsettled</span><b>${m(Math.max(owed,get))}</b></div></div>
                      <div class="ss-grid"><section class="ss-card"><div class="ss-head"><h4>Trips & events</h4></div>${open.length?open.map(t=>`<div class="ss-line"><div><b>${esc(t.name)}</b><div class="ss-sub">${t.members.length} people · ${d.expenses.filter(e=>e.trip===t.id).length} expenses · ${m(d.expenses.filter(e=>e.trip===t.id).reduce((s,e)=>s+Number(e.amount),0))}</div></div><button type="button" class="ss-btn" onclick="app.ssSetTab('expenses','${esc(t.id)}')">Review</button></div>`).join(''):'<p class="ip-empty">Create a trip or event to begin.</p>'}</section>
                      <section class="ss-card"><h4>Who owes whom?</h4>${this.ssBalanceList(rows)}</section>
                      <section class="ss-card ss-wide"><h4>Suggested payments</h4>${this.ssPayments(this.ssSuggestions(rows),true)}</section></div>`;
                } else if(tab==='events'){
                    root.innerHTML=`<div class="ss-head"><p class="ss-sub">Group expenses by trip, event or shared household. Close an event when it's done.</p></div><div class="ss-grid">${d.trips.map(t=>{ const ex=d.expenses.filter(e=>e.trip===t.id); return `<section class="ss-card"><div class="ss-head"><div><h4>${esc(t.name)} ${t.closed?'<span class="ss-pill">Closed</span>':''}</h4><div class="ss-sub">${t.start?this.ssFmtDate(t.start):'No start date'}${t.end?' – '+this.ssFmtDate(t.end):''}</div></div><button type="button" class="ss-btn" onclick="app.ssEventForm('${esc(t.id)}')">Edit</button></div><div class="ss-people">${t.members.map(id=>`<span>${esc(this.ssPerson(id))}</span>`).join('')}</div><div class="ss-sub">${ex.length} expenses · ${m(ex.reduce((s,e)=>s+Number(e.amount),0))}</div><div class="ss-actions"><button type="button" class="ss-btn" onclick="app.ssSetTab('expenses','${esc(t.id)}')">View expenses</button><button type="button" class="ss-btn" onclick="app.ssToggleClose('${esc(t.id)}')">${t.closed?'Reopen':'Close event'}</button></div></section>`; }).join('')||'<section class="ss-card"><p class="ip-empty">No trips or events yet.</p></section>'}</div>`;
                } else if(tab==='expenses'){
                    const sel=this.ssSelectedTrip||''; const list=d.expenses.filter(e=>!sel||e.trip===sel).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
                    const evRows=sel?this.ssBalances(sel):null;
                    root.innerHTML=`<div class="ss-head"><select class="s-select ss-filter" aria-label="Event" onchange="app.ssSetTab('expenses',this.value)"><option value="">All events</option>${d.trips.map(t=>`<option value="${esc(t.id)}" ${t.id===sel?'selected':''}>${esc(t.name)}</option>`).join('')}</select><button type="button" class="s-btn s-primary" onclick="app.ssExpenseForm()" ${open.length?'':'disabled'}>+ Add shared expense</button></div>
                      ${evRows?`<section class="ss-card"><h4>${esc(this.ssTrip(sel)?.name||'')}: balances</h4>${this.ssBalanceList(evRows)}</section>`:''}
                      ${this.ssTable([{label:'Date'},{label:'Event'},{label:'What'},{label:'Paid by'},{label:'Split'},{label:'Amount',num:true},{label:''}],list.map(e=>`<tr><td>${this.ssFmtDate(e.date)}</td><td>${esc(this.ssTrip(e.trip)?.name||'Unknown')}</td><td>${esc(e.desc)}</td><td>${esc(this.ssPerson(e.payer))}</td><td>${e.split==='exact'?'Exact amounts':e.split==='some'?'Selected people':'Everyone'}</td><td class="r">${m(e.amount)}</td><td class="ss-nowrap"><button type="button" class="ss-btn" onclick="app.ssExpenseForm('${esc(e.id)}')">Edit</button> <button type="button" class="ss-btn ss-danger" onclick="app.ssDeleteExpense('${esc(e.id)}')">Delete</button></td></tr>`))}`;
                } else if(tab==='people'){
                    root.innerHTML=`<div class="ss-grid"><section class="ss-card"><h4>Add person</h4><form id="ss-person-form" class="ss-inline"><label class="ip-field"><span>Name</span><input id="ss-person-name" maxlength="40" required placeholder="e.g. Alex"></label><button class="s-btn s-primary">Add person</button></form><p class="ss-sub">"Me" is you and can't be removed.</p></section><section class="ss-card"><h4>People</h4><div class="ss-people ss-people-edit">${d.people.map(p=>`<span>${esc(p.name)}${p.id!=='me'?` <button type="button" onclick="app.ssRenamePerson('${esc(p.id)}')">Rename</button> <button type="button" class="ss-danger" onclick="app.ssDeletePerson('${esc(p.id)}')" aria-label="Remove ${esc(p.name)}">×</button>`:''}</span>`).join('')}</div></section></div>`;
                    this.enhanceFields(root);
                    document.getElementById('ss-person-form').addEventListener('submit',e=>{ e.preventDefault(); const name=document.getElementById('ss-person-name').value.trim(); if(!name)return; if(d.people.some(p=>p.name.toLowerCase()===name.toLowerCase()))return alert('A person with that name already exists.'); d.people.push({id:this.newUid(),name}); this.ssChanged(); });
                } else {
                    const rows=this.ssBalances('');
                    root.innerHTML=`<div class="ss-grid"><section class="ss-card ss-wide"><h4>Suggested payments · open events</h4><p class="ss-sub">These settle all current balances with the fewest payments.</p>${this.ssPayments(this.ssSuggestions(rows),true)}</section><section class="ss-card ss-wide"><h4>Recorded settlements</h4>${this.ssTable([{label:'Date'},{label:'Event'},{label:'From'},{label:'To'},{label:'Amount',num:true},{label:''}],d.settlements.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(s=>`<tr><td>${this.ssFmtDate(s.date)}</td><td>${esc(this.ssTrip(s.trip)?.name||'All events')}</td><td>${esc(this.ssPerson(s.from))}</td><td>${esc(this.ssPerson(s.to))}</td><td class="r">${m(s.amount)}</td><td><button type="button" class="ss-btn ss-danger" onclick="app.ssDeleteSettlement('${esc(s.id)}')">Undo</button></td></tr>`))}</section></div>`;
                }
            }
            // ---------- Shared & Split → Core Ledger: one "Shared & Split" account holds what friends owe you (+) or you owe them (−) ----------
            /**
             * Handles the ss ledger account workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: create){ let a=(this.data.accounts||[]).find(x=>x.system==='split'); if(!a&&create. Side effects, if any, are described by the statements below.
             */
            ssLedgerAccount(create){ let a=(this.data.accounts||[]).find(x=>x.system==='split'); if(!a&&create){ a={id:'acc_split',uid:this.newUid(),name:'Shared & Split',type:'Receivable',balance:0,system:'split'}; let n=2; while((this.data.accounts||[]).some(x=>x.name===a.name))a.name=`Shared & Split ${n++}`; this.data.accounts.push(a); } return a; }
            /**
             * Handles the ss default account name workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            ssDefaultAccountName(){ const g=this.getGlobalDefaultAccount?.(); const list=(this.data.accounts||[]).filter(a=>a.system!=='split'); return (g&&g.system!=='split'?g.name:'')||list.find(a=>/checking|savings/i.test(a.type))?.name||list[0]?.name||''; }
            /**
             * Handles the ss account options workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: selected. Side effects, if any, are described by the statements below.
             */
            ssAccountOptions(selected){ const esc=v=>this.escapeHtml(String(v??'')); return (this.data.accounts||[]).filter(a=>a.system!=='split').map(a=>`<option value="${esc(a.name)}" ${a.name===selected?'selected':''}>${esc(a.name)}</option>`).join(''); }
            // Rebuilds the linked Core Ledger entries from the Shared & Split records (idempotent; keeps statement verification; leaves locked months alone).
            /**
             * Synchronizes Shared & Split expenses and settlements with their ledger entries.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            ssSyncLedger(){
                const d=this.splitData(); const old=(this.data.tx||[]).filter(t=>t.source==='split'); const keep=new Map();
                old.forEach(t=>{ if(this.isLockedDate(t.date)){ keep.set(t.splitKey,t); return; } this.applyTxEffects(t,-1); });
                const carry=new Map(old.map(t=>[t.splitKey,{uid:t.uid,verifiedBy:t.verifiedBy,bankDate:t.bankDate,bankRef:t.bankRef,verifiedAt:t.verifiedAt}]));
                this.data.tx=(this.data.tx||[]).filter(t=>t.source!=='split'||keep.has(t.splitKey));
                const want=[]; const ev=id=>this.ssTrip(id);
                d.expenses.forEach(e=>{ const t=ev(e.trip); if(!e.ledger||!t||t.noLedger)return; const mine=this.ssShares(e).get('me')||0; const name=t.name;
                    if(e.payer==='me'&&e.paidFrom){ want.push({key:e.id+':paid',date:e.date,type:'Transfer',amount:Number(e.amount),account:e.paidFrom,destinationAccount:'@split',payee:`${e.desc} (paid for the group)`,category:'Transfer',subcategory:'Shared & Split',ev:name}); if(mine>0)want.push({key:e.id+':share',date:e.date,type:'Expense',amount:Math.round(mine*100)/100,account:'@split',payee:e.desc,category:'Shared expenses',subcategory:name,ev:name}); }
                    else if(e.payer!=='me'&&mine>0) want.push({key:e.id+':share',date:e.date,type:'Expense',amount:Math.round(mine*100)/100,account:'@split',payee:`${e.desc} (paid by ${this.ssPerson(e.payer)})`,category:'Shared expenses',subcategory:name,ev:name}); });
                d.settlements.forEach(s=>{ if(!s.ledger||!s.account)return; if(s.trip&&ev(s.trip)?.noLedger)return; const name=ev(s.trip)?.name||'Shared & Split';
                    if(s.to==='me')want.push({key:s.id+':in',date:s.date,type:'Transfer',amount:Number(s.amount),account:'@split',destinationAccount:s.account,payee:`Settlement from ${this.ssPerson(s.from)}`,category:'Transfer',subcategory:'Shared & Split',ev:name});
                    else if(s.from==='me')want.push({key:s.id+':out',date:s.date,type:'Transfer',amount:Number(s.amount),account:s.account,destinationAccount:'@split',payee:`Settlement to ${this.ssPerson(s.to)}`,category:'Transfer',subcategory:'Shared & Split',ev:name}); });
                if(!want.length&&!this.ssLedgerAccount(false))return;
                const acc=this.ssLedgerAccount(true);
                want.forEach(w=>{ if(keep.has(w.key)||this.isLockedDate(w.date))return; const c=carry.get(w.key)||{}; const tx={id:'ss_'+w.key.replace(/[^a-z0-9:_-]/gi,''),uid:c.uid||this.newUid(),date:w.date,type:w.type,amount:w.amount,account:w.account==='@split'?acc.name:w.account,...(w.destinationAccount?{destinationAccount:w.destinationAccount==='@split'?acc.name:w.destinationAccount}:{}),payee:w.payee,category:w.category,subcategory:w.subcategory,notes:`Shared & Split · ${w.ev}`,source:'split',splitKey:w.key,...(c.verifiedBy?{verifiedBy:c.verifiedBy,bankDate:c.bankDate,bankRef:c.bankRef,verifiedAt:c.verifiedAt}:{})};
                    this.data.tx.unshift(tx); this.applyTxEffects(tx,1); });
            }
            /**
             * Handles the ss changed workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: ){ try{ this.ssSyncLedger(); }catch(e. Side effects, if any, are described by the statements below.
             */
            ssChanged(){ try{ this.ssSyncLedger(); }catch(e){ console.error('Shared & Split ledger sync failed',e); } this.saveVault(); this.renderAll(); this.renderShared(); }
            /**
             * Handles the ss toggle close workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: id){ const t=this.ssTrip(id); if(t. Side effects, if any, are described by the statements below.
             */
            ssToggleClose(id){ const t=this.ssTrip(id); if(t){ t.closed=!t.closed; this.ssChanged(); } }
            /**
             * Handles the ss delete expense workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: id. Side effects, if any, are described by the statements below.
             */
            async ssDeleteExpense(id){ if(!await this.uiConfirm('Delete this shared expense?',{danger:true}))return; const d=this.splitData(); d.expenses=d.expenses.filter(x=>x.id!==id); this.ssChanged(); }
            /**
             * Handles the ss delete settlement workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: id. Side effects, if any, are described by the statements below.
             */
            async ssDeleteSettlement(id){ if(!await this.uiConfirm('Remove this settlement record? The balances go back to unsettled.',{danger:true}))return; const d=this.splitData(); d.settlements=d.settlements.filter(s=>s.id!==id); this.ssChanged(); }
            /**
             * Handles the ss rename person workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: id. Side effects, if any, are described by the statements below.
             */
            async ssRenamePerson(id){ const d=this.splitData(); const p=d.people.find(x=>x.id===id); if(!p)return; const next=await this.uiInput('Rename person','New name:',p.name); if(next===null)return; const name=String(next).trim(); if(!name)return alert('Name cannot be empty.'); if(d.people.some(x=>x.id!==id&&x.name.toLowerCase()===name.toLowerCase()))return alert('A person with that name already exists.'); p.name=name; this.ssChanged(); }
            /**
             * Handles the ss delete person workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: id. Side effects, if any, are described by the statements below.
             */
            async ssDeletePerson(id){ const d=this.splitData(); const used=d.expenses.some(x=>x.payer===id||this.ssShares(x).has(id))||d.settlements.some(x=>x.from===id||x.to===id); if(used)return alert('This person is in an expense or settlement. Edit or remove those first.'); if(!await this.uiConfirm('Remove this person from all events?',{danger:true}))return; d.people=d.people.filter(p=>p.id!==id); d.trips.forEach(t=>t.members=t.members.filter(x=>x!==id)); this.ssChanged(); }
            /**
             * Handles the ss checks workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: people,chosen. Side effects, if any, are described by the statements below.
             */
            ssChecks(people,chosen){ const esc=v=>this.escapeHtml(String(v??'')); return `<div class="ss-checks">${people.map(p=>`<label class="lh-opt"><input type="checkbox" name="ss-members" value="${esc(p.id)}" ${chosen.includes(p.id)?'checked':''}><span>${esc(p.name)}</span></label>`).join('')}</div>`; }
            /**
             * Handles the ss event form workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: id. Side effects, if any, are described by the statements below.
             */
            ssEventForm(id){
                const d=this.splitData(); const t=id?this.ssTrip(id):null; const esc=v=>this.escapeHtml(String(v??'')); const today=new Date().toISOString().slice(0,10);
                const box=document.getElementById('modal-box');
                box.innerHTML=`<div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3"><h3 class="font-bold text-lg">${t?'Edit trip or event':'New trip or event'}</h3><button type="button" onclick="app.closeModal()" aria-label="Close">✕</button></div>
                  <form id="ss-event-form" class="ip-form"><label class="ip-field"><span>Trip or event name</span><input id="ss-ev-name" required maxlength="80" value="${esc(t?.name||'')}" placeholder="e.g. Goa trip, Diwali, Flat expenses"></label>
                  <div class="ip-two"><label class="ip-field"><span>Start date</span><input id="ss-ev-start" type="date" value="${esc(t?.start||today)}"></label><label class="ip-field"><span>End date</span><input id="ss-ev-end" type="date" value="${esc(t?.end||'')}"></label></div>
                  <fieldset class="ip-fieldset"><legend>Participants (include yourself if you share the costs)</legend>${this.ssChecks(d.people,t?.members||['me'])}</fieldset>
                  <label class="lh-opt"><input type="checkbox" id="ss-ev-ledger" ${t?.noLedger?'':'checked'}><span>Record my share and payments in Core Ledger</span></label>
                  <div class="ip-form-actions"><button type="button" class="s-btn s-secondary" onclick="app.closeModal()">Cancel</button><button type="submit" class="s-btn s-primary">${t?'Save changes':'Create event'}</button></div></form>`;
                document.getElementById('modal-container').classList.remove('hidden');
                document.getElementById('ss-event-form').addEventListener('submit',e=>{ e.preventDefault(); const members=[...box.querySelectorAll('input[name="ss-members"]:checked')].map(x=>x.value); if(!members.length)return alert('Choose at least one participant.'); const vals={name:document.getElementById('ss-ev-name').value.trim(),members,start:document.getElementById('ss-ev-start').value,end:document.getElementById('ss-ev-end').value,noLedger:!document.getElementById('ss-ev-ledger').checked};
                    if(t)Object.assign(t,vals); else d.trips.push({id:this.newUid(),...vals,closed:false}); this.closeModal(); this.ssChanged(); });
            }
            /**
             * Handles the ss expense form workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: id. Side effects, if any, are described by the statements below.
             */
            ssExpenseForm(id){
                const d=this.splitData(); const e=id?d.expenses.find(x=>x.id===id):null; const esc=v=>this.escapeHtml(String(v??'')); const today=new Date().toISOString().slice(0,10);
                const tripId=e?.trip||this.ssSelectedTrip||d.trips.find(t=>!t.closed)?.id||'';
                const box=document.getElementById('modal-box');
                box.innerHTML=`<div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3"><h3 class="font-bold text-lg">${e?'Edit shared expense':'Add shared expense'}</h3><button type="button" onclick="app.closeModal()" aria-label="Close">✕</button></div>
                  <form id="ss-ex-form" class="ip-form"><label class="ip-field"><span>Trip or event</span><select id="ss-ex-trip" required>${d.trips.filter(t=>!t.closed||t.id===tripId).map(t=>`<option value="${esc(t.id)}" ${t.id===tripId?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>
                  <label class="ip-field"><span>Total amount${CURL()}</span><input id="ss-ex-amount" type="number" min="0.01" step="0.01" inputmode="decimal" required value="${esc(e?.amount??'')}" placeholder="e.g. 3000"></label>
                  <label class="ip-field"><span>Description</span><input id="ss-ex-desc" required maxlength="120" value="${esc(e?.desc||'')}" placeholder="e.g. Dinner, hotel, groceries"></label>
                  <div class="ip-two"><label class="ip-field"><span>Date</span><input id="ss-ex-date" type="date" required value="${esc(e?.date||today)}"></label><label class="ip-field"><span>Paid by</span><select id="ss-ex-payer">${d.people.map(p=>`<option value="${esc(p.id)}" ${p.id===(e?.payer||'me')?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label></div>
                  <label class="ip-field"><span>Split</span><select id="ss-ex-split"><option value="equal" ${!e||e.split==='equal'?'selected':''}>Equally among everyone</option><option value="some" ${e?.split==='some'?'selected':''}>Selected people only</option><option value="exact" ${e?.split==='exact'?'selected':''}>Exact amount per person</option></select></label>
                  <div id="ss-split-opts"></div>
                  <div id="ss-ledger-opts" class="ip-fieldset"><label class="ip-field" id="ss-paidfrom-wrap"><span>Paid from (your account)</span><select id="ss-ex-account">${this.ssAccountOptions(e?.paidFrom||this.ssDefaultAccountName())}</select></label><label class="lh-opt"><input type="checkbox" id="ss-ex-ledger" ${e&&!e.ledger?'':'checked'}><span>Record my share in Core Ledger</span></label></div>
                  <div class="ip-form-actions"><button type="button" class="s-btn s-secondary" onclick="app.closeModal()">Cancel</button><button type="submit" class="s-btn s-primary">${e?'Save expense':'Add expense'}</button></div></form>`;
                document.getElementById('modal-container').classList.remove('hidden');
                const trip=document.getElementById('ss-ex-trip'), split=document.getElementById('ss-ex-split'), opts=document.getElementById('ss-split-opts'), amt=document.getElementById('ss-ex-amount');
                const draw=()=>{ const members=(this.ssTrip(trip.value)?.members||[]).map(i=>d.people.find(p=>p.id===i)).filter(Boolean); const total=Number(amt.value)||0;
                    if(split.value==='some')opts.innerHTML=`<fieldset class="ip-fieldset"><legend>People sharing this expense</legend>${this.ssChecks(members,e?.split==='some'?(e.among||[]):members.map(p=>p.id))}</fieldset>`;
                    else if(split.value==='exact')opts.innerHTML=`<fieldset class="ip-fieldset"><legend>Each person's share (must add up to ${this.ssMoney(total)})</legend><div class="ss-exact">${members.map(p=>`<label class="ip-field"><span>${esc(p.name)}${CURL()}</span><input type="number" min="0" step="0.01" inputmode="decimal" data-ss-exact="${esc(p.id)}" value="${esc(e?.shares?.[p.id]??'')}"></label>`).join('')}</div></fieldset>`;
                    else opts.innerHTML=`<p class="ss-sub">Split equally among ${members.length} event member${members.length===1?'':'s'}: ${this.ssMoney(members.length?total/members.length:0)} each.</p>`;
                    this.enhanceFields(opts); };
                const payerSel=document.getElementById('ss-ex-payer'); const ledgerBox=()=>{ const t=this.ssTrip(trip.value); document.getElementById('ss-ledger-opts').hidden=!!t?.noLedger; document.getElementById('ss-paidfrom-wrap').hidden=payerSel.value!=='me'; }; payerSel.addEventListener('change',ledgerBox); trip.addEventListener('change',ledgerBox); ledgerBox();
                trip.onchange=()=>{ draw(); ledgerBox(); }; split.onchange=draw; amt.addEventListener('input',()=>{ if(split.value!=='some')draw(); }); draw();
                document.getElementById('ss-ex-form').addEventListener('submit',ev=>{ ev.preventDefault(); const t=this.ssTrip(trip.value), amount=Number(amt.value), method=split.value; if(!t||!t.members.length)return alert('Choose an event with participants.'); if(!(amount>0))return alert('Enter an amount greater than zero.');
                    let among=[], shares={};
                    if(method==='some'){ among=[...opts.querySelectorAll('input[name="ss-members"]:checked')].map(x=>x.value); if(!among.length)return alert('Select at least one person to share this expense.'); }
                    if(method==='exact'){ opts.querySelectorAll('[data-ss-exact]').forEach(x=>{ const n=Number(x.value)||0; if(n>0)shares[x.dataset.ssExact]=n; }); const sum=Object.values(shares).reduce((a,b)=>a+b,0); if(Math.abs(sum-amount)>.011)return alert(`Exact shares add up to ${this.ssMoney(sum)}; they must equal ${this.ssMoney(amount)}.`); }
                    const rec={id:e?.id||this.newUid(),trip:t.id,date:document.getElementById('ss-ex-date').value,desc:document.getElementById('ss-ex-desc').value.trim(),amount,payer:document.getElementById('ss-ex-payer').value,split:method,among,shares,ledger:document.getElementById('ss-ex-ledger').checked,paidFrom:document.getElementById('ss-ex-payer').value==='me'?document.getElementById('ss-ex-account').value:''};
                    if(e)Object.assign(e,rec); else d.expenses.push(rec); this.ssSelectedTrip=t.id; this.closeModal(); this.ssChanged(); });
            }
            /**
             * Handles the ss settle form workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: from,to,amount,tid=''. Side effects, if any, are described by the statements below.
             */
            ssSettleForm(from,to,amount,tid=''){
                const d=this.splitData(); const esc=v=>this.escapeHtml(String(v??'')); const box=document.getElementById('modal-box');
                box.innerHTML=`<div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3"><div><h3 class="font-bold text-lg">Record settlement</h3><p class="ss-sub">${esc(this.ssPerson(from))} pays ${esc(this.ssPerson(to))}</p></div><button type="button" onclick="app.closeModal()" aria-label="Close">✕</button></div>
                  <form id="ss-settle-form" class="ip-form"><div class="ip-two"><label class="ip-field"><span>Date</span><input id="ss-st-date" type="date" required value="${new Date().toISOString().slice(0,10)}"></label><label class="ip-field"><span>Amount${CURL()}</span><input id="ss-st-amount" type="number" min="0.01" step="0.01" inputmode="decimal" required value="${esc(amount)}"></label></div>
                  <label class="ip-field"><span>Trip or event (optional)</span><select id="ss-st-trip"><option value="">All open events / general</option>${d.trips.map(t=>`<option value="${esc(t.id)}" ${t.id===tid?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>
                  ${(from==='me'||to==='me')?`<label class="ip-field"><span>${to==='me'?'Received into':'Paid from'}</span><select id="ss-st-account">${this.ssAccountOptions(this.ssDefaultAccountName())}</select></label><label class="lh-opt"><input type="checkbox" id="ss-st-ledger" checked><span>Record in Core Ledger</span></label>`:''}
                  <div class="ip-form-actions"><button type="button" class="s-btn s-secondary" onclick="app.closeModal()">Cancel</button><button type="submit" class="s-btn s-primary">Record as paid</button></div></form>`;
                document.getElementById('modal-container').classList.remove('hidden');
                document.getElementById('ss-settle-form').addEventListener('submit',e=>{ e.preventDefault(); const a=Number(document.getElementById('ss-st-amount').value); if(!(a>0))return alert('Enter a positive amount.'); const lg=document.getElementById('ss-st-ledger'); d.settlements.push({id:this.newUid(),date:document.getElementById('ss-st-date').value,from,to,amount:a,trip:document.getElementById('ss-st-trip').value,ledger:!!lg?.checked,account:document.getElementById('ss-st-account')?.value||''}); this.closeModal(); this.ssChanged(); });
            }
            /**
             * Renders the  shared legacy UI from the current app state.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            renderSharedLegacy() {
                const container = document.getElementById('shared-container');
                if (!this.data.shared.length) { container.innerHTML = '<p class="text-sm text-slate-500 py-8 text-center">No shared expenses yet. Add an expense to start splitting bills.</p>'; return; }
                container.innerHTML = this.data.shared.map(s => {
                    const people = Array.isArray(s.members) ? s.members : String(s.splitWith || '').split(',').map(x=>x.trim()).filter(Boolean);
                    const shareLines = people.map(name => { const m=(s.shares||{})[name]; const paid=Number((s.settlements||{})[name]||0); const owed=Number(m ?? (name===s.paidBy ? 0 : (Number(s.total)||0)/Math.max(people.length,1))); return `<div class="flex items-center justify-between gap-3 text-xs py-1"><span>${this.escapeHtml(name)}${name===s.paidBy?' (paid)':''}</span><span>Share ${CUR()}${owed.toLocaleString('en-IN',{maximumFractionDigits:2})} · Settled ${CUR()}${paid.toLocaleString('en-IN',{maximumFractionDigits:2})}</span></div>`; }).join('');
                    const totalSettled=Object.values(s.settlements||{}).reduce((a,v)=>a+(Number(v)||0),0);
                    const isSettled=s.settled || (Number(s.total)>0 && totalSettled >= Number(s.total)-0.01);
                    return `<div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3"><div class="min-w-0"><h4 class="font-bold text-sm">${this.escapeHtml(s.title)}</h4><p class="text-xs text-slate-500 mt-1">Total ${CUR()}${Number(s.total||0).toLocaleString('en-IN',{maximumFractionDigits:2})} · Paid by ${this.escapeHtml(s.paidBy||'—')} · Shared with ${this.escapeHtml(people.join(', ')||'—')}</p><p class="text-xs text-slate-500 mt-1">Your share: ${CUR()}${Number(s.myShare||0).toLocaleString('en-IN',{maximumFractionDigits:2})}</p></div><div class="flex items-center gap-2"><span class="px-3 py-1 rounded-full text-xs font-medium ${isSettled?'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400':'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'}">${isSettled?'Settled':'Pending Settlement'}</span><button onclick="app.openSettlementModal('${s.id}')" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white">${isSettled?'View / Edit':'Record Settlement'}</button><button onclick="app.deleteSharedExpense('${s.id}')" class="px-2 py-1.5 rounded-lg border text-xs">Delete</button></div></div>
                      <div class="border-t border-slate-200 dark:border-slate-700 pt-2">${shareLines}</div></div>`;
                }).join('');
            }

            /**
             * Opens the  members modal screen, dialog, or workflow.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            openMembersModal() {
                this.data.members ||= [];
                const box=document.getElementById('modal-box');
                box.innerHTML=`<div class="flex items-center justify-between"><h3 class="font-bold text-lg">Manage Members</h3><button type="button" onclick="app.closeModal()">✕</button></div><form id="member-form" class="flex gap-2"><input id="member-name" required maxlength="80" placeholder="Member name" class="flex-1 px-3 py-2 rounded-xl border dark:bg-slate-800"><button class="px-4 py-2 bg-emerald-600 text-white rounded-xl">Add</button></form><div id="member-list" class="space-y-2"></div><p class="text-xs text-slate-500">Members are stored only in your encrypted local vault.</p>`;
                const draw=()=>{document.getElementById('member-list').innerHTML=this.data.members.map((m,i)=>`<div class="flex items-center justify-between border rounded-xl p-3 dark:border-slate-700"><span>${this.escapeHtml(m)}</span><button type="button" class="text-rose-600 text-sm" onclick="app.removeMember(${i})">Remove</button></div>`).join('')||'<p class="text-sm text-slate-500">No members added.</p>';};
                document.getElementById('member-form').onsubmit=e=>{e.preventDefault();const name=document.getElementById('member-name').value.trim();if(!name)return;if(this.data.members.some(m=>m.toLowerCase()===name.toLowerCase()))return alert('Member already exists.');this.data.members.push(name);this.saveVault();draw();document.getElementById('member-name').value='';};
                this.removeMember=(i)=>{const name=this.data.members[i];if(this.data.shared.some(x=>(x.members||[]).includes(name)))return alert('This member is used in a shared expense. Remove them from that expense first.');this.data.members.splice(i,1);this.saveVault();draw();};
                draw();document.getElementById('modal-container').classList.remove('hidden');
            }
            /**
             * Opens the  shared modal screen, dialog, or workflow.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            openSharedModal() {
                this.data.members ||= [];
                const box=document.getElementById('modal-box');
                const members=this.data.members;
                box.innerHTML=`<div class="flex items-center justify-between"><h3 class="font-bold text-lg">Add Shared Expense</h3><button type="button" onclick="app.closeModal()">✕</button></div><form id="shared-form" class="space-y-3"><div><label class="block text-xs font-semibold text-slate-500 mb-1">Expense name</label><input id="sh-title" required class="w-full px-3 py-2 rounded-xl border dark:bg-slate-800" placeholder="e.g. Dinner, trip, rent"></div><div class="grid grid-cols-2 gap-3"><div><label class="block text-xs font-semibold text-slate-500 mb-1">Total amount${CURL()}</label><input id="sh-total" type="number" min="0.01" step="0.01" required class="w-full px-3 py-2 rounded-xl border dark:bg-slate-800"></div><div><label class="block text-xs font-semibold text-slate-500 mb-1">Paid by</label><select id="sh-paidby" required class="w-full px-3 py-2 rounded-xl border dark:bg-slate-800"><option value="You">You</option>${members.map(m=>`<option value="${this.escapeHtml(m)}">${this.escapeHtml(m)}</option>`).join('')}</select></div></div><div><label class="block text-xs font-semibold text-slate-500 mb-1">Share with</label><select id="sh-scope" class="w-full px-3 py-2 rounded-xl border dark:bg-slate-800"><option value="all">All members</option><option value="specific">Specific members</option></select></div><div id="sh-member-picks" class="grid grid-cols-2 gap-2">${members.map((m,i)=>`<label class="flex gap-2 items-center text-sm border rounded-lg p-2 dark:border-slate-700"><input type="checkbox" value="${this.escapeHtml(m)}" checked class="sh-member">${this.escapeHtml(m)}</label>`).join('')||'<p class="text-xs text-slate-500 col-span-2">No members yet. Add members with Manage Members.</p>'}</div><div><label class="block text-xs font-semibold text-slate-500 mb-1">Your share${CURL()}</label><input id="sh-myshare" type="number" min="0" step="0.01" value="0" required class="w-full px-3 py-2 rounded-xl border dark:bg-slate-800"><p class="text-xs text-slate-500 mt-1">Choose participants; equal shares are suggested automatically. You can edit your share.</p></div><div class="flex justify-end gap-2 pt-2"><button type="button" onclick="app.closeModal()" class="px-4 py-2 border rounded-xl">Cancel</button><button class="px-4 py-2 bg-emerald-600 text-white rounded-xl">Save Expense</button></div></form>`;
                const scope=document.getElementById('sh-scope');const picks=()=>{const all=scope.value==='all';document.querySelectorAll('.sh-member').forEach(c=>{c.checked=all;c.disabled=all;});};scope.onchange=picks;
                document.getElementById('shared-form').onsubmit=e=>{e.preventDefault();const total=Number(document.getElementById('sh-total').value);if(!(total>0))return alert('Enter a total amount greater than zero.');const chosen=[...document.querySelectorAll('.sh-member:checked')].map(c=>c.value);const participants=['You',...chosen.filter(n=>n!=='You')];if(!participants.length)return alert('Select at least one participant.');const share=total/participants.length;const shares=Object.fromEntries(participants.map(n=>[n,Number(share.toFixed(2))]));const myShare=Number(document.getElementById('sh-myshare').value);this.data.shared.push({id:'s_'+Date.now(),title:document.getElementById('sh-title').value.trim(),total,paidBy:document.getElementById('sh-paidby').value,members:participants,splitWith:participants.join(', '),shares,myShare,settlements:{},settled:false,createdAt:new Date().toISOString()});this.saveVault();this.renderAll();this.closeModal();};
                document.getElementById('modal-container').classList.remove('hidden');
            }
            /**
             * Opens the  settlement modal screen, dialog, or workflow.
             * Parameters: id. Side effects, if any, are described by the statements below.
             */
            openSettlementModal(id) {
                const s=this.data.shared.find(x=>String(x.id)===String(id));if(!s)return;const people=Array.isArray(s.members)?s.members:String(s.splitWith||'').split(',').map(x=>x.trim()).filter(Boolean);const box=document.getElementById('modal-box');
                box.innerHTML=`<div class="flex items-center justify-between"><h3 class="font-bold text-lg">Settlement — ${this.escapeHtml(s.title)}</h3><button type="button" onclick="app.closeModal()">✕</button></div><p class="text-sm text-slate-500">Record how much each participant has paid back. Partial settlements are supported.</p><form id="settlement-form" class="space-y-3">${people.map((n,i)=>`<div class="grid grid-cols-2 gap-3 items-center"><label class="text-sm">${this.escapeHtml(n)} — share ${CUR()}${Number((s.shares||{})[n]||0).toLocaleString('en-IN',{maximumFractionDigits:2})}</label><input type="number" min="0" step="0.01" id="settle-${i}" data-member="${this.escapeHtml(n)}" value="${Number((s.settlements||{})[n]||0)}" class="px-3 py-2 rounded-xl border dark:bg-slate-800" placeholder="Amount settled"></div>`).join('')}<div class="flex justify-end gap-2 pt-3"><button type="button" onclick="app.closeModal()" class="px-4 py-2 border rounded-xl">Cancel</button><button class="px-4 py-2 bg-emerald-600 text-white rounded-xl">Save Settlement</button></div></form>`;
                document.getElementById('settlement-form').onsubmit=e=>{e.preventDefault();s.settlements ||= {};for(let i=0;i<people.length;i++){const val=Number(document.getElementById('settle-'+i).value);if(!Number.isFinite(val)||val<0)return alert('Settlement amounts must be zero or greater.');s.settlements[people[i]]=val;}const outstanding=people.reduce((sum,n)=>sum+Math.max(0,Number((s.shares||{})[n]||0)-Number(s.settlements[n]||0)),0);s.settled=outstanding<=0.01;this.saveVault();this.renderAll();this.closeModal();};
                document.getElementById('modal-container').classList.remove('hidden');
            }
            /**
             * Removes shared expense, including associated cleanup where applicable.
             * Parameters: id. Side effects, if any, are described by the statements below.
             */
            async deleteSharedExpense(id) { if(!await this.uiConfirm('Delete this shared expense and its settlement records?'))return;this.data.shared=this.data.shared.filter(s=>String(s.id)!==String(id));this.saveVault();this.renderAll(); }

        }
