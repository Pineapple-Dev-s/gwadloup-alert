var ImageUpload = {
  files: [],
  maxFiles: 4,

  init: function() {
    var self = this;
    var dz = document.getElementById('photo-dropzone');
    var inp = document.getElementById('photo-input');
    if (!dz || !inp) return;

    dz.addEventListener('click', function() {
      // Show choice: gallery or camera
      self.showPhotoChoice();
    });
    inp.addEventListener('change', function(e) { self.handleFiles(Array.from(e.target.files)); inp.value = ''; });
    dz.addEventListener('dragover', function(e) { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', function() { dz.classList.remove('dragover'); });
    dz.addEventListener('drop', function(e) {
      e.preventDefault(); dz.classList.remove('dragover');
      self.handleFiles(Array.from(e.dataTransfer.files).filter(function(f) { return f.type.startsWith('image/'); }));
    });
  },

  showPhotoChoice: function() {
    var inp = document.getElementById('photo-input');
    if (!inp) return;

    // On mobile, show camera vs gallery choice
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      var existing = document.getElementById('photo-choice-popup');
      if (existing) { existing.remove(); return; }

      var popup = document.createElement('div');
      popup.id = 'photo-choice-popup';
      popup.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:var(--bg2);border-top:1px solid var(--border);padding:20px;z-index:3000;border-radius:16px 16px 0 0;box-shadow:0 -4px 20px rgba(0,0,0,.3);animation:mslide .25s ease';
      popup.innerHTML =
        '<div style="text-align:center;margin-bottom:16px"><div style="width:40px;height:4px;background:var(--bg4);border-radius:2px;margin:0 auto 12px"></div><h3 style="font-size:.95rem;font-weight:700">Ajouter une photo</h3><p style="font-size:.78rem;color:var(--text2);margin-top:4px">Les photos aident à comprendre le problème !</p></div>' +
        '<div style="display:flex;gap:10px;margin-bottom:12px">' +
          '<button class="btn btn--primary btn--lg" style="flex:1;padding:16px;flex-direction:column;gap:6px" onclick="ImageUpload.openCamera()"><i class="fas fa-camera" style="font-size:1.4rem"></i><span style="font-size:.78rem">Prendre une photo</span></button>' +
          '<button class="btn btn--outline btn--lg" style="flex:1;padding:16px;flex-direction:column;gap:6px" onclick="ImageUpload.openGallery()"><i class="fas fa-images" style="font-size:1.4rem"></i><span style="font-size:.78rem">Galerie</span></button>' +
        '</div>' +
        '<button class="btn btn--ghost btn--full" onclick="document.getElementById(\'photo-choice-popup\').remove()" style="font-size:.82rem">Annuler</button>';

      // Close on backdrop click
      var backdrop = document.createElement('div');
      backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:2999';
      backdrop.onclick = function() { popup.remove(); backdrop.remove(); };
      document.body.appendChild(backdrop);
      popup.addEventListener('remove', function() { backdrop.remove(); });

      document.body.appendChild(popup);
    } else {
      // Desktop: just open file picker
      inp.removeAttribute('capture');
      inp.click();
    }
  },

  openCamera: function() {
    var popup = document.getElementById('photo-choice-popup');
    if (popup) popup.remove();
    // Remove backdrop
    var backdrops = document.querySelectorAll('div[style*="z-index:2999"]');
    backdrops.forEach(function(b) { b.remove(); });

    var inp = document.getElementById('photo-input');
    if (inp) {
      inp.setAttribute('capture', 'environment');
      inp.click();
    }
  },

  openGallery: function() {
    var popup = document.getElementById('photo-choice-popup');
    if (popup) popup.remove();
    var backdrops = document.querySelectorAll('div[style*="z-index:2999"]');
    backdrops.forEach(function(b) { b.remove(); });

    var inp = document.getElementById('photo-input');
    if (inp) {
      inp.removeAttribute('capture');
      inp.click();
    }
  },

  handleFiles: function(newFiles) {
    var self = this;
    var remaining = this.maxFiles - this.files.length;
    if (remaining <= 0) { UI.toast('Max ' + this.maxFiles + ' photos', 'warning'); return; }
    newFiles.slice(0, remaining).forEach(function(file) {
      if (file.size > 15 * 1024 * 1024) { UI.toast(file.name + ' trop lourd (max 15MB)', 'warning'); return; }
      var id = Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      self.files.push({ id: id, file: file, url: null });
      self.renderThumb(id, file);
    });
  },

  renderThumb: function(id, file) {
    var preview = document.getElementById('photo-preview');
    var reader = new FileReader();
    reader.onload = function(e) {
      var div = document.createElement('div'); div.className = 'thumb'; div.id = 'thumb-' + id;
      div.innerHTML = '<img src="' + e.target.result + '"><button type="button" class="thumb__rm" onclick="ImageUpload.removeFile(\'' + id + '\')"><i class="fas fa-times"></i></button>';
      preview.appendChild(div);
    };
    reader.readAsDataURL(file);
  },

  removeFile: function(id) {
    this.files = this.files.filter(function(f) { return f.id !== id; });
    var el = document.getElementById('thumb-' + id); if (el) el.remove();
  },

  compress: function(file) {
    return imageCompression(file, {
      maxSizeMB: 0.3, maxWidthOrHeight: 1600, useWebWorker: true,
      fileType: 'image/webp', initialQuality: 0.7
    }).then(function(compressed) {
      if (compressed.size > 500 * 1024) {
        return imageCompression(compressed, { maxSizeMB: 0.2, maxWidthOrHeight: 1200, useWebWorker: true, fileType: 'image/webp', initialQuality: 0.5 });
      }
      return compressed;
    }).catch(function() { return file; });
  },

  uploadAll: function() {
    var self = this; var urls = []; var chain = Promise.resolve();
    this.files.forEach(function(item) {
      chain = chain.then(function() {
        if (item.url) { urls.push(item.url); return; }
        var thumb = document.getElementById('thumb-' + item.id);
        if (thumb) { var ld = document.createElement('div'); ld.className = 'thumb__loader'; ld.innerHTML = '<span class="spinner"></span>'; thumb.appendChild(ld); }
        return self.compress(item.file).then(function(compressed) {
          var fd = new FormData(); fd.append('image', compressed);
          return fetch('https://api.imgbb.com/1/upload?key=' + App.config.imgbbApiKey, { method: 'POST', body: fd });
        }).then(function(r) { return r.json(); }).then(function(data) {
          if (!data.success) throw new Error();
          item.url = data.data.display_url; urls.push(item.url);
          if (thumb) { var ld = thumb.querySelector('.thumb__loader'); if (ld) ld.remove(); }
        }).catch(function() {
          UI.toast('Erreur upload photo', 'error');
          if (thumb) { var ld = thumb.querySelector('.thumb__loader'); if (ld) ld.remove(); }
        });
      });
    });
    return chain.then(function() { return urls; });
  },

  reset: function() { this.files = []; var p = document.getElementById('photo-preview'); if (p) p.innerHTML = ''; }
};
