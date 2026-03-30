var ImageUpload = {
  files: [],
  maxFiles: 4,

  init: function() {
    var self = this;
    var dz = document.getElementById('photo-dropzone');
    var inp = document.getElementById('photo-input');
    if (!dz || !inp) return;

    dz.addEventListener('click', function() { inp.click(); });
    inp.addEventListener('change', function(e) { self.handleFiles(Array.from(e.target.files)); inp.value = ''; });
    dz.addEventListener('dragover', function(e) { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', function() { dz.classList.remove('dragover'); });
    dz.addEventListener('drop', function(e) {
      e.preventDefault(); dz.classList.remove('dragover');
      self.handleFiles(Array.from(e.dataTransfer.files).filter(function(f) { return f.type.startsWith('image/'); }));
    });
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
    // Progressive compression: try aggressive first, fallback to lighter
    var options = {
      maxSizeMB: 0.3,          // Target 300KB (was 400KB)
      maxWidthOrHeight: 1600,   // Keep decent resolution for detail
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: 0.7,
      alwaysKeepResolution: false,
      exifOrientation: undefined  // Auto-rotate based on EXIF
    };

    return imageCompression(file, options).then(function(compressed) {
      var originalKB = (file.size / 1024).toFixed(0);
      var compressedKB = (compressed.size / 1024).toFixed(0);
      var ratio = Math.round((1 - compressed.size / file.size) * 100);
      console.log('Compression: ' + originalKB + 'KB → ' + compressedKB + 'KB (-' + ratio + '%)');
      
      // If still over 500KB, compress again more aggressively
      if (compressed.size > 500 * 1024) {
        return imageCompression(compressed, {
          maxSizeMB: 0.2,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
          fileType: 'image/webp',
          initialQuality: 0.5
        });
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
        }).catch(function(err) {
          console.error('Upload error:', err); UI.toast('Erreur upload photo', 'error');
          if (thumb) { var ld = thumb.querySelector('.thumb__loader'); if (ld) ld.remove(); }
        });
      });
    });
    return chain.then(function() { return urls; });
  },

  reset: function() { this.files = []; var p = document.getElementById('photo-preview'); if (p) p.innerHTML = ''; }
};
