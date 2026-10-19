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
                const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
                root.innerHTML=cats.map((cat,i)=>{const list=Array.isArray(subs[cat])?subs[cat]:[]; const safe=esc(cat); return `<section class="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900"><div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div class="flex flex-wrap items-center gap-2 min-w-0"><label class="cat-swatch" style="--c:${this.categoryColor(cat)}" title="Change colour"><input type="color" value="${this.categoryColor(cat)}" onchange="app.setCategoryColor(${i},this.value)" aria-label="Colour for ${safe}"></label><span class="font-semibold text-sm sm:text-base break-words">${safe}</span><span class="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 text-[11px]">${list.length} subcategor${list.length===1?'y':'ies'}</span></div><div class="flex items-center gap-2 shrink-0"><button onclick="app.editCategory(${i})" class="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800">Edit category</button><button onclick="app.deleteCategory(${i})" class="px-3 py-1.5 text-xs rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">Delete</button></div></div><div class="border-t border-slate-100 dark:border-slate-800 px-4 py-3"><div class="sm:ml-2 sm:pl-4 sm:border-l-2 border-slate-200 dark:border-slate-700 space-y-1.5">${list.length?list.map((sub,j)=>{const st=esc(typeof sub==='string'?sub:sub.name);return `<div class="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/70"><div class="flex items-center gap-2 min-w-0"><span class="text-slate-300 dark:text-slate-600">↳</span><span class="text-sm break-words">${st}</span></div><div class="flex gap-2 shrink-0"><button onclick="app.editSubcategory(${i},${j})" class="px-2.5 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-900">Edit</button><button onclick="app.deleteSubcategory(${i},${j})" class="px-2.5 py-1 text-xs rounded-md border border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">Delete</button></div></div>`;}).join(''):`<p class="text-xs text-slate-500 py-1">No subcategories yet.</p>`}<div class="pt-1"><button onclick="app.addSubcategory(${i})" class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">＋ Add subcategory</button></div></div></div></section>`;}).join('');
            }
            /**
             * Handles the add category workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            async addCategory(){const name=await this.uiPrompt('Add category','Enter a name for the new category.');if(name===null)return;const v=name.trim();if(!v)return alert('Category name cannot be empty.');if(this.data.categories.some(c=>String(c).toLowerCase()===v.toLowerCase()))return alert('That category already exists.');this.data.categories.push(v);this.categorySubcategoryMap();this.saveVault();this.renderAll();}
            /**
             * Updates category.
             * Parameters: index){const old=this.data.categories[index];if(old===undefined)return;const name=await this.uiPrompt('Rename category','Update the category name.',old);if(name===null)return;const v=name.trim();if(!v)return alert('Category name cannot be empty.');if(this.data.categories.some((c,i)=>i!==index&&String(c).toLowerCase()===v.toLowerCase()))return alert('That category already exists.');if(v===old)return;this.data.categories[index]=v;const subs=this.categorySubcategoryMap();if(subs[old]){subs[v]=subs[old];delete subs[old];}if(this.data.categoryColors?.[old]){this.data.categoryColors[v]=this.data.categoryColors[old];delete this.data.categoryColors[old];}this.data.tx.forEach(t=>{if(t.category===old)t.category=v;});if(this.data.budgets&&Object.prototype.hasOwnProperty.call(this.data.budgets,old). Side effects, if any, are described by the statements below.
             */
            async editCategory(index){const old=this.data.categories[index];if(old===undefined)return;const name=await this.uiPrompt('Rename category','Update the category name.',old);if(name===null)return;const v=name.trim();if(!v)return alert('Category name cannot be empty.');if(this.data.categories.some((c,i)=>i!==index&&String(c).toLowerCase()===v.toLowerCase()))return alert('That category already exists.');if(v===old)return;this.data.categories[index]=v;const subs=this.categorySubcategoryMap();if(subs[old]){subs[v]=subs[old];delete subs[old];}if(this.data.categoryColors?.[old]){this.data.categoryColors[v]=this.data.categoryColors[old];delete this.data.categoryColors[old];}this.data.tx.forEach(t=>{if(t.category===old)t.category=v;});if(this.data.budgets&&Object.prototype.hasOwnProperty.call(this.data.budgets,old)){this.data.budgets[v]=this.data.budgets[old];delete this.data.budgets[old];}this.saveVault();this.renderAll();}
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
                const cat=String(category||'').trim();
                const sub=String(subcategory||'').trim();
                if(!cat)return;
                if(!Array.isArray(this.data.categories))this.data.categories=[];
                if(!this.data.categories.some(c=>String(c).toLowerCase()===cat.toLowerCase()))this.data.categories.push(cat);
                // subcategories is a {category: [names]} map. (An Array.isArray check here used to reset it on every call,
                // so each new subcategory wiped all the others.)
                const subs=this.categorySubcategoryMap();
                if(!Array.isArray(subs[cat]))subs[cat]=[];
                if(sub&&!subs[cat].some(s=>String(typeof s==='string'?s:s.name).toLowerCase()===sub.toLowerCase()))subs[cat].push(sub);
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
        }
