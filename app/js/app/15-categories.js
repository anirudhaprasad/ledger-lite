// AificoApp methods: categories (10 methods). Part of the AificoApp prototype chain.
        class AificoAppCategories extends AificoAppCore {
            /**
             * Changes the category edit and refreshes dependent UI.
             * Parameters: force){ const m=document.getElementById('categories-manager'), b=document.getElementById('cat-edit-toggle'); if(!m)return; const on=force===undefined?m.hidden:!!force; m.hidden=!on; if(b. Side effects, if any, are described by the statements below.
             */
            toggleCategoryEdit(force){ const m=document.getElementById('categories-manager'), b=document.getElementById('cat-edit-toggle'); if(!m)return; const on=force===undefined?m.hidden:!!force; m.hidden=!on; if(b){ b.textContent=on?'Done':'Edit'; b.setAttribute('aria-expanded',String(on)); } }
            /**
             * Handles the category subcategory map workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            categorySubcategoryMap() {
                if (!this.data.subcategories || Array.isArray(this.data.subcategories) || typeof this.data.subcategories !== 'object') this.data.subcategories = {};
                return this.data.subcategories;
            }
            /**
             * Renders the  categories manager UI from the current app state.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            renderCategoriesManager() {
                const root=document.getElementById('categories-manager'); if(!root)return;
                const cats=Array.isArray(this.data.categories)?this.data.categories:[]; const subs=this.categorySubcategoryMap(); { const sm=document.getElementById('cat-summary'); if(sm){ const subCount=cats.reduce((n,c)=>n+(Array.isArray(subs[c])?subs[c].length:0),0); sm.textContent=`${cats.length} categor${cats.length===1?'y':'ies'} · ${subCount} subcategor${subCount===1?'y':'ies'}`; } }
                if(!cats.length){root.innerHTML='<p class="text-sm text-slate-500">No categories yet. Add your first category.</p>';return;}
                const dup=this.duplicateCategoryGroups(); const dupHtml=dup.length?`<div class="cat-dups" role="status"><b>${dup.length} set${dup.length===1?'':'s'} of look-alike categories</b><span>${dup.map(g=>g.map(c=>String(c).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))).join(' = ')).join(' · ')}</span><button type="button" class="s-btn s-primary" onclick="app.openCategoryCleanup()">Clean up categories</button></div>`:'';
                const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
                { let dupBox=document.getElementById("cat-dups-box"); if(!dupBox){ dupBox=document.createElement("div"); dupBox.id="cat-dups-box"; root.parentElement.insertBefore(dupBox,root); } dupBox.innerHTML=dupHtml||`<button type="button" class="s-btn s-secondary cat-cleanup-btn" onclick="app.openCategoryCleanup()">Clean up categories</button>`; }
                root.innerHTML=cats.map((cat,i)=>{const list=Array.isArray(subs[cat])?subs[cat]:[]; const safe=esc(cat); return `<section class="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900"><div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div class="flex flex-wrap items-center gap-2 min-w-0"><label class="cat-swatch" style="--c:${this.categoryColor(cat)}" title="Change colour"><input type="color" value="${this.categoryColor(cat)}" onchange="app.setCategoryColor(${i},this.value)" aria-label="Colour for ${safe}"></label><span class="font-semibold text-sm sm:text-base break-words">${safe}</span><span class="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 text-[11px]">${list.length} subcategor${list.length===1?'y':'ies'}</span></div><div class="flex items-center gap-2 shrink-0"><button onclick="app.editCategory(${i})" class="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800">Edit category</button><button onclick="app.deleteCategory(${i})" class="px-3 py-1.5 text-xs rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">Delete</button></div></div><div class="border-t border-slate-100 dark:border-slate-800 px-4 py-3"><div class="sm:ml-2 sm:pl-4 sm:border-l-2 border-slate-200 dark:border-slate-700 space-y-1.5">${list.length?list.map((sub,j)=>{const st=esc(typeof sub==='string'?sub:sub.name);return `<div class="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/70"><div class="flex items-center gap-2 min-w-0"><span class="text-slate-300 dark:text-slate-600">↳</span><span class="text-sm break-words">${st}</span></div><div class="flex gap-2 shrink-0"><button onclick="app.editSubcategory(${i},${j})" class="px-2.5 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-900">Edit</button><button onclick="app.deleteSubcategory(${i},${j})" class="px-2.5 py-1 text-xs rounded-md border border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">Delete</button></div></div>`;}).join(''):`<p class="text-xs text-slate-500 py-1">No subcategories yet.</p>`}<div class="pt-1"><button onclick="app.addSubcategory(${i})" class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">＋ Add subcategory</button></div></div></div></section>`;}).join('');
            }
            /**
             * Handles the add category workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            async addCategory(){const name=await this.uiPrompt('Add category','Enter a name for the new category.');if(name===null)return;const v=name.trim();if(!v)return alert('Category name cannot be empty.');{ const same=this.matchCategory(v); if(same)return alert(same===v?'That category already exists.':`"${same}" already exists and is the same category. Use it, or choose a clearly different name.`); }this.data.categories.push(v);this.categorySubcategoryMap();this.saveVault();this.renderAll();}
            /**
             * Updates category.
             * Parameters: index){const old=this.data.categories[index];if(old===undefined)return;const name=await this.uiPrompt('Rename category','Update the category name.',old);if(name===null)return;const v=name.trim();if(!v)return alert('Category name cannot be empty.');if(this.data.categories.some((c,i)=>i!==index&&String(c).toLowerCase()===v.toLowerCase()))return alert('That category already exists.');if(v===old)return;this.data.categories[index]=v;const subs=this.categorySubcategoryMap();if(subs[old]){subs[v]=subs[old];delete subs[old];}if(this.data.categoryColors?.[old]){this.data.categoryColors[v]=this.data.categoryColors[old];delete this.data.categoryColors[old];}this.data.tx.forEach(t=>{if(t.category===old)t.category=v;});if(this.data.budgets&&Object.prototype.hasOwnProperty.call(this.data.budgets,old). Side effects, if any, are described by the statements below.
             */
            async editCategory(index){const old=this.data.categories[index];if(old===undefined)return;const name=await this.uiPrompt('Rename category','Update the category name.',old);if(name===null)return;const v=name.trim();if(!v)return alert('Category name cannot be empty.');{ const k=this.categoryKey(v); const same=this.data.categories.find((c,i)=>i!==index&&this.categoryKey(c)===k); if(same)return alert(`"${same}" already exists and is the same category. To combine them, use Clean up categories on this page.`); }if(v===old)return;this.data.categories[index]=v;const subs=this.categorySubcategoryMap();if(subs[old]){subs[v]=subs[old];delete subs[old];}if(this.data.categoryColors?.[old]){this.data.categoryColors[v]=this.data.categoryColors[old];delete this.data.categoryColors[old];}this.data.tx.forEach(t=>{if(t.category===old)t.category=v;});if(this.data.budgets&&Object.prototype.hasOwnProperty.call(this.data.budgets,old)){this.data.budgets[v]=this.data.budgets[old];delete this.data.budgets[old];}this.saveVault();this.renderAll();}
            /**
             * Removes category, including associated cleanup where applicable.
             * Parameters: index. Side effects, if any, are described by the statements below.
             */
            async deleteCategory(index){const cat=this.data.categories[index];if(cat===undefined)return;const used=this.data.tx.filter(t=>t.category===cat).length;const msg=`Remove category "${cat}" from category settings?${used?` ${used} existing transaction(s) use it; their history will be preserved.`:''} Its budget and subcategory list will also be removed.`;if(!await this.uiConfirm(msg))return;this.data.categories.splice(index,1);const subs=this.categorySubcategoryMap();delete subs[cat];if(this.data.categoryColors)delete this.data.categoryColors[cat];if(this.data.budgets)delete this.data.budgets[cat];this.saveVault();this.renderAll();}
            /**
             * Handles the add subcategory workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: index. Side effects, if any, are described by the statements below.
             */
            async addSubcategory(index){const cat=this.data.categories[index];if(cat===undefined)return;const name=await this.uiPrompt(`Add subcategory to ${cat}` ,`Enter a name for the new subcategory under "${cat}".`);if(name===null)return;const v=name.trim();if(!v)return alert('Subcategory name cannot be empty.');const subs=this.categorySubcategoryMap();subs[cat] ||= [];if(subs[cat].some(x=>String(typeof x==='string'?x:x.name).toLowerCase()===v.toLowerCase()))return alert('That subcategory already exists.');subs[cat].push(v);this.saveVault();this.renderCategoriesManager();}
            /**
             * Updates subcategory.
             * Parameters: index,subIndex. Side effects, if any, are described by the statements below.
             */
            async editSubcategory(index,subIndex){const cat=this.data.categories[index];const subs=this.categorySubcategoryMap();if(!cat||!Array.isArray(subs[cat]))return;const old=subs[cat][subIndex];if(old===undefined)return;const name=await this.uiPrompt('Rename subcategory','Update the subcategory name.',typeof old==='string'?old:old.name);if(name===null)return;const v=name.trim();if(!v)return alert('Subcategory name cannot be empty.');if(subs[cat].some((x,j)=>j!==subIndex&&String(typeof x==='string'?x:x.name).toLowerCase()===v.toLowerCase()))return alert('That subcategory already exists.');subs[cat][subIndex]=v;this.data.tx.forEach(t=>{if(t.category===cat&&t.subcategory===(typeof old==='string'?old:old.name))t.subcategory=v;});this.saveVault();this.renderAll();}
            /**
             * Removes subcategory, including associated cleanup where applicable.
             * Parameters: index,subIndex. Side effects, if any, are described by the statements below.
             */
            async deleteSubcategory(index,subIndex){const cat=this.data.categories[index];const subs=this.categorySubcategoryMap();if(!cat||!Array.isArray(subs[cat]))return;const old=subs[cat][subIndex];if(old===undefined)return;const name=typeof old==='string'?old:old.name;const used=this.data.tx.filter(t=>t.category===cat&&t.subcategory===name).length;if(!await this.uiConfirm(`Remove subcategory "${name}"?${used?` ${used} existing transaction(s) use it; their history will be preserved.`:''}`))return;subs[cat].splice(subIndex,1);this.saveVault();this.renderCategoriesManager();}
            /**
             * Handles the ensure category and subcategory workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: category, subcategory. Side effects, if any, are described by the statements below.
             */
            ensureCategoryAndSubcategory(category, subcategory){
                let cat=String(category||'').trim();
                const sub=String(subcategory||'').trim();
                if(!cat)return ''; if(/^(uncategori[sz]ed|none)$/i.test(cat))return 'Uncategorized';   // "None" is not a category of its own
                if(!Array.isArray(this.data.categories))this.data.categories=[];
                // A name that differs only in case, spaces, punctuation or a plural "s" is the same category: use yours
                const same=this.matchCategory(cat); if(same)cat=same; else this.data.categories.push(cat);
                // subcategories is a {category: [names]} map. (An Array.isArray check here used to reset it on every call,
                // so each new subcategory wiped all the others.)
                const subs=this.categorySubcategoryMap();
                if(!Array.isArray(subs[cat]))subs[cat]=[];
                if(sub&&!subs[cat].some(s=>this.categoryKey(typeof s==='string'?s:s.name)===this.categoryKey(sub)))subs[cat].push(sub);
                return cat;
            }
            /** "Outing-EatingOut", "outing eatingout" and "OutingEatingOuts" all give "outingeatingout"; "Investments" gives "investment". */
            categoryKey(name){ return String(name||'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,'').replace(/(?<=..)(ies)$/,'y').replace(/(?<=...)s$/,''); }
            /** Your existing category that is the same as this name (see categoryKey), or '' when there is none. */
            matchCategory(name){ const k=this.categoryKey(name); if(!k)return ''; return (this.data.categories||[]).find(c=>this.categoryKey(c)===k)||''; }
            /** Categories that are the same apart from spelling: [["Investment","Investments"], …], each group most used first. */
            duplicateCategoryGroups(){ const use=new Map(); (this.data.tx||[]).forEach(t=>{ if(t&&t.category)use.set(t.category,(use.get(t.category)||0)+1); });
                const g=new Map(); (this.data.categories||[]).forEach(c=>{ const k=this.categoryKey(c); if(!k)return; (g.get(k)||g.set(k,[]).get(k)).push(c); });
                return [...g.values()].filter(x=>x.length>1).map(x=>x.sort((a,b)=>(use.get(b)||0)-(use.get(a)||0))); }
            /** Move everything that uses category "old" to "keep": entries, SMS, schedules, projects, SMS rules, budget, subcategories, colour. */
            moveCategory(old,keep){ const subs=this.categorySubcategoryMap(); this.data.budgets ||= {};
                (this.data.tx||[]).forEach(t=>{ if(t&&t.category===old)t.category=keep; });
                (this.data.smsInbox||[]).forEach(t=>{ if(t&&t.category===old)t.category=keep; });
                (Array.isArray(this.data.yearly)?this.data.yearly:[]).forEach(y=>{ if(y&&y.category===old)y.category=keep; });
                (this.data.projects||[]).forEach(p=>{ if(p&&p.category===old)p.category=keep; });
                (this.smsRules?.().payeeCats||[]).forEach(r=>{ if(r&&r.category===old)r.category=keep; });
                if(this.data.budgets[old]!=null){ if(this.data.budgets[keep]==null)this.data.budgets[keep]=this.data.budgets[old]; delete this.data.budgets[old]; }
                (Array.isArray(subs[old])?subs[old]:[]).forEach(x=>this.ensureCategoryAndSubcategory(keep,typeof x==='string'?x:x.name)); delete subs[old];
                if(this.data.categoryColors?.[old]){ this.data.categoryColors[keep] ||= this.data.categoryColors[old]; delete this.data.categoryColors[old]; }
                this.data.categories=(this.data.categories||[]).filter(c=>c!==old); }
            /**
             * What Clean up categories would do: look-alike categories to merge (into the most used name), look-alike subcategories
             * within a category, categories and subcategories nothing uses, and "Transfer"/"Uncategorized"/"None" kept as if they
             * were categories. Each item has a key so the sheet can offer it as a tick box.
             */
            categoryCleanupPlan(){
                const cats=this.data.categories||[], subs=this.categorySubcategoryMap(), name=x=>typeof x==='string'?x:x?.name;
                const usedCat=new Map(), usedSub=new Map(); const useC=c=>{ if(c)usedCat.set(c,(usedCat.get(c)||0)+1); }, useS=(c,x)=>{ if(c&&x){ const k=c+'\u0000'+x; usedSub.set(k,(usedSub.get(k)||0)+1); } };
                (this.data.tx||[]).forEach(t=>{ if(!t)return; useC(t.category); useS(t.category,t.subcategory); });
                (this.data.smsInbox||[]).forEach(t=>{ if(t&&(t.status||'pending')==='pending'){ useC(t.category); useS(t.category,t.subcategory); } });
                (Array.isArray(this.data.yearly)?this.data.yearly:[]).forEach(y=>{ if(!y)return; useC(y.category); useS(y.category,y.subcategory); });
                (this.data.projects||[]).forEach(p=>useC(p?.category)); Object.keys(this.data.budgets||{}).forEach(useC);
                (this.smsRules?.().payeeCats||[]).forEach(r=>{ useC(r?.category); useS(r?.category,r?.subcategory); });
                const pseudo=cats.filter(c=>/^(uncategori[sz]ed|none|transfer)$/i.test(String(c).trim()));
                const real=cats.filter(c=>!pseudo.includes(c));
                const groups=this.duplicateCategoryGroups().filter(g=>g.every(c=>real.includes(c)));
                const merging=new Set(groups.flatMap(g=>g.slice(1)));
                const subGroups=[]; real.forEach(c=>{ const m=new Map(); (Array.isArray(subs[c])?subs[c]:[]).map(name).filter(Boolean).forEach(x=>{ const k=this.categoryKey(x); (m.get(k)||m.set(k,[]).get(k)).push(x); });
                    m.forEach(list=>{ if(list.length>1)subGroups.push({cat:c,names:list.sort((x,y)=>(usedSub.get(c+'\u0000'+y)||0)-(usedSub.get(c+'\u0000'+x)||0))}); }); });
                const unusedCats=real.filter(c=>!usedCat.get(c)&&!merging.has(c)&&!groups.some(g=>g[0]===c));
                const dupSubs=new Set(subGroups.flatMap(g=>g.names.slice(1).map(x=>g.cat+'\u0000'+x)));
                const unusedSubs=[]; real.forEach(c=>{ if(unusedCats.includes(c)||merging.has(c))return; (Array.isArray(subs[c])?subs[c]:[]).map(name).filter(Boolean).forEach(x=>{ const k=c+'\u0000'+x; if(!usedSub.get(k)&&!dupSubs.has(k)&&!subGroups.some(g=>g.cat===c&&g.names[0]===x))unusedSubs.push({cat:c,name:x}); }); });
                return {groups,subGroups,unusedCats,unusedSubs,pseudo,uses:c=>usedCat.get(c)||0,
                    count:groups.length+subGroups.length+unusedCats.length+unusedSubs.length+pseudo.length}; }
            /** Clean up categories: every proposed change as a tick box (look-alikes and stray names ticked, unused ones too); nothing changes until Clean up. */
            openCategoryCleanup(){
                const plan=this.categoryCleanupPlan(); const esc=v=>this.escapeHtml(String(v??'')); const box=document.getElementById('modal-box');
                const row=(key,title,small,on=true)=>`<label class="cu-row"><input type="checkbox" data-k="${esc(key)}" ${on?'checked':''}><span><b>${title}</b>${small?`<small>${small}</small>`:''}</span></label>`;
                const sec=(h,rows)=>rows.length?`<h4 class="cc-h">${h}</h4><div class="cu-list">${rows.join('')}</div>`:'';
                const n=c=>{ const u=plan.uses(c); return u?`${u} use${u===1?'':'s'}`:'not used'; };
                box.innerHTML=`<div id="cu" class="space-y-3"><div class="flex justify-between items-center"><h3 class="font-bold text-base">Clean up categories</h3><button type="button" data-x class="text-slate-400" aria-label="Close"><i data-lucide="x" class="w-5 h-5"></i></button></div>
                  ${plan.count?`<p class="text-sm text-slate-500">Untick anything you want to keep as it is. Entries keep their amounts and dates; only category names change. Back up first if unsure.</p>
                  ${sec('Look-alike categories: merged into the first name',plan.groups.map((g,i)=>row('g'+i,`${g.slice(1).map(esc).join(', ')} → ${esc(g[0])}`,g.map(c=>`${esc(c)}: ${n(c)}`).join(' · '))))}
                  ${sec('Look-alike subcategories: merged into the first name',plan.subGroups.map((g,i)=>row('s'+i,`${esc(g.cat)}: ${g.names.slice(1).map(esc).join(', ')} → ${esc(g.names[0])}`,'')))}
                  ${sec('Not real categories: taken off the list (entries keep "None" / "Transfer")',plan.pseudo.map((c,i)=>row('p'+i,esc(c),'')))}
                  ${sec('Categories nothing uses: removed',plan.unusedCats.map((c,i)=>row('c'+i,esc(c),'No entries, SMS, budgets, schedules, projects or rules use it')))}
                  ${sec('Subcategories nothing uses: removed',plan.unusedSubs.map((x,i)=>row('u'+i,`${esc(x.cat)} › ${esc(x.name)}`,'')))}
                  <div class="af-actions"><button type="button" class="s-btn s-secondary" data-x>Cancel</button><button type="button" class="s-btn s-primary" data-go>Clean up</button></div>`
                  :`<p class="text-sm text-slate-500">Nothing to clean up: no look-alike or unused categories or subcategories.</p><div class="af-actions"><span></span><button type="button" class="s-btn s-primary" data-x>OK</button></div>`}</div>`;
                document.getElementById('modal-container').classList.remove('hidden'); window.lucide?.createIcons?.();
                document.getElementById('cu').addEventListener('click',async e=>{ const btn=e.target.closest('button'); if(!btn)return; if('x' in btn.dataset)return this.closeModal(); if(!('go' in btn.dataset))return;
                    const on=new Set([...document.querySelectorAll('#cu input[data-k]:checked')].map(i=>i.dataset.k)); if(!on.size)return this.closeModal();
                    const subs=this.categorySubcategoryMap(); let done=0;
                    plan.groups.forEach((g,i)=>{ if(!on.has('g'+i))return; g.slice(1).forEach(old=>{ this.moveCategory(old,g[0]); done++; }); });
                    plan.subGroups.forEach((g,i)=>{ if(!on.has('s'+i))return; const [keep,...gone]=g.names;
                        const fix=t=>{ if(t&&t.category===g.cat&&gone.includes(t.subcategory))t.subcategory=keep; };
                        (this.data.tx||[]).forEach(fix); (this.data.smsInbox||[]).forEach(fix); (Array.isArray(this.data.yearly)?this.data.yearly:[]).forEach(fix); (this.smsRules?.().payeeCats||[]).forEach(fix);
                        subs[g.cat]=(subs[g.cat]||[]).filter(x=>!gone.includes(typeof x==='string'?x:x.name)); done+=gone.length; });
                    plan.pseudo.forEach((c,i)=>{ if(!on.has('p'+i))return; this.data.categories=this.data.categories.filter(x=>x!==c); delete subs[c]; done++; });
                    plan.unusedCats.forEach((c,i)=>{ if(!on.has('c'+i))return; this.data.categories=this.data.categories.filter(x=>x!==c); delete subs[c]; if(this.data.categoryColors)delete this.data.categoryColors[c]; done++; });
                    plan.unusedSubs.forEach((x,i)=>{ if(!on.has('u'+i)||!Array.isArray(subs[x.cat]))return; subs[x.cat]=subs[x.cat].filter(y=>(typeof y==='string'?y:y.name)!==x.name); done++; });
                    await this.saveVault(); this.closeModal(); this.renderAll(); this.showToast?.(`Categories cleaned up: ${done} change${done===1?'':'s'}.`); });
            }
            // ---------- Category colours: one colour per category, used by ledger rows, Stats, the dashboard pie and budgets ----------
            categoryPalette(){ return ['#f97316','#3b82f6','#22c55e','#ec4899','#a855f7','#eab308','#14b8a6','#ef4444','#6366f1','#84cc16','#0ea5e9','#d946ef','#b45309','#64748b','#0f766e','#be123c','#1d4ed8','#ca8a04','#7c3aed','#4d7c0f','#c2410c','#0891b2','#9d174d','#78716c']; }
            /**
             * Gives every category without a colour the palette colour used least so far, so neighbours never look alike.
             * Deterministic for the same category list, so it gives the same answer even before the vault is saved.
             */
            ensureCategoryColors(){
                const D=this.data; if(!D)return false; D.categoryColors ||= {}; const map=D.categoryColors, pal=this.categoryPalette(); let changed=false;
                const used=new Map(pal.map(c=>[c,0])); Object.values(map).forEach(c=>{ if(used.has(c))used.set(c,used.get(c)+1); });
                // Listed categories first, then any a transaction uses that is not in the list (old imports, Shared & Split).
                const names=[...new Set([...(D.categories||[]),...(D.tx||[]).map(t=>t&&t.category).filter(Boolean)])];
                names.forEach(cat=>{ if(map[cat])return; let best=pal[0]; pal.forEach(c=>{ if(used.get(c)<used.get(best))best=c; }); map[cat]=best; used.set(best,used.get(best)+1); changed=true; });
                return changed;
            }
            /** The colour of a category; categories not in the list (old imports) get a stable colour from their name. */
            categoryColor(name){
                const n=String(name||'Uncategorized'); const set=this.data?.categoryColors?.[n]; if(set)return set;
                let h=0; for(const ch of n.toLowerCase())h=(h*31+ch.charCodeAt(0))>>>0; const pal=this.categoryPalette(); return pal[h%pal.length];
            }
            setCategoryColor(index,color){ const cat=this.data.categories[index]; if(cat===undefined||!/^#[0-9a-f]{6}$/i.test(color))return; this.data.categoryColors ||= {}; this.data.categoryColors[cat]=color; this.saveVault(); this.renderAll(); }
            /**
             * One-time repair: rebuild subcategories lost to the old reset bug from the ones transactions still use.
             * Runs once per vault, so subcategories the user deleted later are not brought back.
             */
            repairSubcategoriesOnce(){
                this.data.settings ||= {};
                if(this.data.settings.subcategoriesRepaired)return false;
                (this.data.tx||[]).forEach(t=>{ if(t&&t.category&&t.subcategory)this.ensureCategoryAndSubcategory(t.category,t.subcategory); });
                this.data.settings.subcategoriesRepaired=1;
                return true;
            }

            // ── My fields: the person's own fields on transactions (Person, Purpose, Reimbursable…) ──
            // Defined in data.customFields [{id,name,type:'text'|'list'|'yesno'|'number'|'date',options:[]}]; values live in
            // tx.custom / smsItem.custom as {fieldId: value}; data.payeeFields remembers the last values per payee.
            myFields(){ return Array.isArray(this.data.customFields)?this.data.customFields.filter(f=>f&&f.id&&f.name):[]; }
            myFieldTypes(){ return {text:'Text',list:'List of choices',yesno:'Yes / No',number:'Number',date:'Date'}; }
            renderMyFields(){
                const box=document.getElementById('my-fields-list'); if(!box)return; const esc=v=>this.escapeHtml(String(v??'')); const fields=this.myFields(); const types=this.myFieldTypes();
                box.innerHTML=fields.length?fields.map(f=>`<div class="flex items-center justify-between gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700"><span><b>${esc(f.name)}</b> <span class="text-xs text-slate-500">${esc(types[f.type]||f.type)}${f.type==='list'?': '+esc((f.options||[]).join(', ')):''}</span></span><span class="flex gap-1"><button type="button" class="s-btn s-secondary" onclick="app.editMyField('${esc(f.id)}')">Edit</button><button type="button" class="s-btn s-secondary" onclick="app.deleteMyField('${esc(f.id)}')">Delete</button></span></div>`).join(''):'<p class="set-note">No fields yet.</p>';
            }
            editMyField(id){
                const f=id?this.myFields().find(x=>x.id===id):null; if(!f&&this.myFields().length>=10)return alert('You can have up to 10 fields.');
                const esc=v=>this.escapeHtml(String(v??'')); const types=this.myFieldTypes(); const box=document.getElementById('modal-box');
                box.innerHTML=`<div class="flex justify-between items-center pb-2"><h3 class="font-bold">${f?'Edit field':'Add field'}</h3><button type="button" onclick="app.closeModal()" aria-label="Close">✕</button></div>
                <form id="mf-form" class="space-y-3"><label class="block text-sm">Name<input id="mf-name" required maxlength="30" placeholder="e.g. Person" value="${esc(f?.name||'')}" class="mt-1 w-full px-3 py-2 rounded-xl border dark:bg-slate-800"></label>
                <label class="block text-sm">Type<select id="mf-type" class="mt-1 w-full px-3 py-2 rounded-xl border dark:bg-slate-800">${Object.entries(types).map(([k,v])=>`<option value="${k}" ${k===(f?.type||'text')?'selected':''}>${v}</option>`).join('')}</select></label>
                <label class="block text-sm" id="mf-options-row">Choices, separated by commas<input id="mf-options" maxlength="300" placeholder="e.g. Me, Wife, Kids" value="${esc((f?.options||[]).join(', '))}" class="mt-1 w-full px-3 py-2 rounded-xl border dark:bg-slate-800"></label>
                <div class="flex justify-end gap-2"><button type="button" onclick="app.closeModal()" class="px-4 py-2 border rounded-xl">Cancel</button><button class="px-4 py-2 bg-emerald-600 text-white rounded-xl">Save</button></div></form>`;
                document.getElementById('modal-container').classList.remove('hidden');
                const sync=()=>{ document.getElementById('mf-options-row').hidden=document.getElementById('mf-type').value!=='list'; }; document.getElementById('mf-type').addEventListener('change',sync); sync();
                document.getElementById('mf-form').onsubmit=e=>{ e.preventDefault();
                    const name=document.getElementById('mf-name').value.trim(), type=document.getElementById('mf-type').value;
                    const options=[...new Set(document.getElementById('mf-options').value.split(',').map(s=>s.trim()).filter(Boolean))].slice(0,30);
                    if(!name)return alert('Enter a name.'); if(this.myFields().some(x=>x!==f&&x.name.toLowerCase()===name.toLowerCase()))return alert('A field with this name already exists.');
                    if(type==='list'&&!options.length)return alert('Enter at least one choice.');
                    if(f)Object.assign(f,{name,type,options:type==='list'?options:[]}); else (this.data.customFields||=[]).push({id:'cf_'+Date.now().toString(36),name,type,options:type==='list'?options:[]});
                    this.saveVault(); this.closeModal(); this.renderAll(); };
            }
            async deleteMyField(id){
                const f=this.myFields().find(x=>x.id===id); if(!f)return; const used=(this.data.tx||[]).filter(t=>t?.custom&&t.custom[id]!=null&&t.custom[id]!=='').length;
                if(!await this.uiConfirm(`Delete the field "${f.name}"?${used?` Its values on ${used} transaction${used===1?'':'s'} are removed too.`:''}`,{okLabel:'Delete'}))return;
                this.data.customFields=this.myFields().filter(x=>x.id!==id);
                [...(this.data.tx||[]),...(this.data.smsInbox||[])].forEach(t=>{ if(t?.custom){ delete t.custom[id]; if(!Object.keys(t.custom).length)delete t.custom; } });
                Object.values(this.data.payeeFields||{}).forEach(v=>delete v[id]);
                this.saveVault(); this.renderAll();
            }
            /** Shown value: Yes/No for yes-no fields, the date as written, otherwise the text */
            myFieldText(f,v){ if(v==null||v==='')return ''; if(f.type==='yesno')return v===true||v==='yes'?'Yes':'No'; return String(v); }
            /** "Person: Wife · Reimbursable: Yes" for details and search */
            myFieldsSummary(custom){ if(!custom)return []; return this.myFields().map(f=>[f.name,this.myFieldText(f,custom[f.id])]).filter(([,v])=>v); }
            /** Inputs for every field; prefix keeps ids apart (form vs SMS row); onchange is optional inline code. */
            myFieldsInputs(values,prefix,onchange='',compact=false){
                const esc=v=>this.escapeHtml(String(v??'')); const v=values||{};
                return this.myFields().map(f=>{ const id=`${prefix}-${f.id}`, val=v[f.id]??'', on=onchange?` onchange="${onchange.replace('%ID%',esc(f.id))}"`:'';
                    const ctl=f.type==='list'?`<select id="${id}" data-field="${esc(f.id)}"${on}><option value="">—</option>${(f.options||[]).map(o=>`<option ${o===val?'selected':''}>${esc(o)}</option>`).join('')}</select>`
                        :f.type==='yesno'?`<select id="${id}" data-field="${esc(f.id)}"${on}><option value="">—</option><option value="yes" ${val==='yes'?'selected':''}>Yes</option><option value="no" ${val==='no'?'selected':''}>No</option></select>`
                        :`<input id="${id}" data-field="${esc(f.id)}" type="${f.type==='number'?'number':f.type==='date'?'date':'text'}" ${f.type==='number'?'step="any"':'maxlength="80"'} value="${esc(val)}"${on}>`;
                    return `<label class="${compact?'mf-compact':'af-row mf-row'}"><span>${esc(f.name)}</span>${ctl}</label>`; }).join('');
            }
            /** Values from inputs made by myFieldsInputs (empty ones left out); null when there are none */
            readMyFields(prefix){ const out={}; this.myFields().forEach(f=>{ const el=document.getElementById(`${prefix}-${f.id}`); const v=el?String(el.value).trim():''; if(v)out[f.id]=v; }); return Object.keys(out).length?out:null; }
            /** Remember the values for this payee, so the next entry or SMS from them starts with the same values */
            rememberPayeeFields(payee,custom){ const k=String(payee||'').trim().toLowerCase(); if(!k||!custom)return; (this.data.payeeFields||={})[k]={...custom}; }
            payeeFieldsFor(payee){ const k=String(payee||'').trim().toLowerCase(); const v=k&&this.data.payeeFields?.[k]; if(!v)return null; const ids=new Set(this.myFields().map(f=>f.id)); const out={}; Object.entries(v).forEach(([id,x])=>{ if(ids.has(id))out[id]=x; }); return Object.keys(out).length?out:null; }
        }
