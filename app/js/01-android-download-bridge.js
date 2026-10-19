    (function(){
      if (!window.AndroidBridge || typeof window.AndroidBridge.saveFile !== 'function') return;
      var blobs = new Map();
      var create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = function(obj){ var u = create(obj); if (obj instanceof Blob) blobs.set(u, obj); return u; };
      URL.revokeObjectURL = function(u){ setTimeout(function(){ blobs.delete(u); revoke(u); }, 60000); };
      function send(blob, name){
        var r = new FileReader();
        r.onload = function(){ var d = String(r.result || ''); window.AndroidBridge.saveFile(d.slice(d.indexOf(',') + 1), name, blob.type || 'application/octet-stream'); };
        r.onerror = function(){ alert('Could not prepare ' + name + ' for saving.'); };
        r.readAsDataURL(blob);
      }
      function handle(a){
        var name = a.getAttribute('download'); if (name === null) return false;
        var href = a.href || ''; name = name || 'download';
        if (href.indexOf('blob:') !== 0 && href.indexOf('data:') !== 0) return false;
        var b = blobs.get(href);
        if (b) send(b, name);
        else fetch(href).then(function(x){ return x.blob(); }).then(function(x){ send(x, name); }).catch(function(){ alert('Could not save ' + name + '.'); });
        return true;
      }
      var click = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function(){ if (handle(this)) return; return click.apply(this, arguments); };
      document.addEventListener('click', function(e){ var a = e.target && e.target.closest && e.target.closest('a[download]'); if (a && handle(a)) e.preventDefault(); }, true);
    })();
