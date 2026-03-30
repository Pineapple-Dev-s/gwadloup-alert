var ImageUpload = {
  files: [],
  maxFiles: 4,

  init: function() {
    var self = this;
    var dz = document.getElementById('photo-dropzone');
    var inp = document.getElementById('photo-input');

    dz.addEventListener('click', function() { inp.click(); });

    inp.addEventListener('change', function(e) {
      self.handleFiles(Array.from(e.target.files));
      inp.value = '';
    });

    dz.addEventListener('dragover', function(e) { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', function() { dz.classList.remove('dragover'); });
    dz.addEventListener('drop', function(e) {
      e.preventDefault();
      dz.classList.remove('dragover');
      var files = Array.from(e.dataTransfer.files).filter(function(f) { return f.type.startsWith('image/'); });
      self.handleFiles(files);
    });
  },

  handleFiles: function(newFiles) {
    var self = this;
    var remaining = this.maxFiles - this.files.length;
    if (remaining <= 0) { UI.toast('Max ' + this.maxFiles + ' photos', 'warning'); return; }

    var toAdd = newFiles.slice(0, remaining);
    toAdd.forEach(function(file) {
      if (file.size > 10 * 1024 * 1024) {
        UI.toast(file.name + ' trop lourd (max 10MB)', 'warning');
        return;
      }
      var id = Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      self.files.push({ id: id, file: file, url: null });
      self.renderThumb(id, file);
    });
  },

  renderThumb: function(id, file) {
    var preview = document.getElementById('photo-preview');
    var reader = new FileReader();
    reader.onload = function(e) {
      var div = document.createElement('div');
      div.className = 'thumb';
      div.id = 'thumb-' + id;
      div.innerHTML = '<img src="' + e.target.result + '">' +
        '<button type="button" class="thumb__rm" onclick="ImageUpload.removeFile(\'' + id + '\')">' +
        '<i class="fas fa-times"></i></button>';
      preview.appendChild(div);
    };
    reader.readAsDataURL(file);
  },

  removeFile: function(id) {
    this.files = this.files.filter(function(f) { return f.id !== id; });
    var el = document.getElementById('thumb-' + id);
    if (el) el.remove();
  },

  compress: function(file) {
    var options = {
      maxSizeMB: 0.4,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: 0.75
    };

    return imageCompression(file, options).then(function(compressed) {
      var originalKB = (file.size / 1024).toFixed(0);
      var compressedKB = (compressed.size / 1024).toFixed(0);
      var ratio = Math.round((1 - compressed.size / file.size) * 100);
      console.log('Compression: ' + originalKB + 'KB -> ' + compressedKB + 'KB (' + ratio + '% reduit)');
      return compressed;
    }).catch(function() {
      return file;
    });
  },

  uploadAll: function() {
    var self = this;
    var urls = [];
    var chain = Promise.resolve();

    this.files.forEach(function(item) {
      chain = chain.then(function() {
        if (item.url) {
          urls.push(item.url);
          return;
        }

        var thumb = document.getElementById('thumb-' + item.id);
        if (thumb) {
          var loader = document.createElement('div');
          loader.className = 'thumb__loader';
          loader.innerHTML = '<span class="spinner"></span>';
          thumb.appendChild(loader);
        }

        return self.compress(item.file).then(function(compressed) {
          var fd = new FormData();
          fd.append('image', compressed);
          return fetch('https://api.imgbb.com/1/upload?key=' + App.config.imgbbApiKey, {
            method: 'POST',
            body: fd
          });
        }).then(function(resp) {
          return resp.json();
        }).then(function(data) {
          if (!data.success) throw new Error('Upload failed');
          item.url = data.data.display_url;
          urls.push(item.url);
          if (thumb) {
            var ld = thumb.querySelector('.thumb__loader');
            if (ld) ld.remove();
          }
        }).catch(function(err) {
          console.error('Upload error:', err);
          UI.toast('Erreur upload photo', 'error');
          if (thumb) {
            var ld = thumb.querySelector('.thumb__loader');
            if (ld) ld.remove();
          }
        });
      });
    });

    return chain.then(function() { return urls; });
  },

  reset: function() {
    this.files = [];
    var preview = document.getElementById('photo-preview');
    if (preview) preview.innerHTML = '';
  }
};
