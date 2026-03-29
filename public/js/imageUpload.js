const ImageUpload = {
  files: [], maxFiles: 4,

  init() {
    const dz = document.getElementById('photo-dropzone');
    const inp = document.getElementById('photo-input');
    dz.addEventListener('click', () => inp.click());
    inp.addEventListener('change', (e) => { this.handleFiles(Array.from(e.target.files)); inp.value = ''; });
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('dragover'); this.handleFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))); });
  },

  handleFiles(newFiles) {
    const rem = this.maxFiles - this.files.length;
    if (rem <= 0) { UI.toast(`Max ${this.maxFiles} photos`, 'warning'); return; }
    for (const file of newFiles.slice(0, rem)) {
      if (file.size > 10 * 1024 * 1024) { UI.toast(`${file.name} trop lourd`, 'warning'); continue; }
      const id = Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      this.files.push({ id, file, url: null });
      this.renderThumb({ id, file });
    }
  },

  renderThumb(item) {
    const preview = document.getElementById('photo-preview');
    const reader = new FileReader();
    reader.onload = (e) => {
      const d = document.createElement('div');
      d.className = 'thumb'; d.id = `thumb-${item.id}`;
      d.innerHTML = `<img src="${e.target.result}"><button type="button" class="thumb__rm" onclick="ImageUpload.remove('${item.id}')"><i class="fas fa-times"></i></button>`;
      preview.appendChild(d);
    };
    reader.readAsDataURL(item.file);
  },

  remove(id) {
    this.files = this.files.filter(f => f.id !== id);
    document.getElementById(`thumb-${id}`)?.remove();
  },

  async compress(file) {
    try {
      return await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1600, useWebWorker: true, fileType: 'image/webp', initialQuality: 0.8 });
    } catch (e) { return file; }
  },

  async uploadAll() {
    const urls = [];
    for (const item of this.files) {
      if (item.url) { urls.push(item.url); continue; }
      const thumb = document.getElementById(`thumb-${item.id}`);
      if (thumb) { const ld = document.createElement('div'); ld.className = 'thumb__loader'; ld.innerHTML = '<span class="spinner" style="border-color:rgba(0,135,90,.2);border-top-color:var(--primary)"></span>'; thumb.appendChild(ld); }
      try {
        const compressed = await this.compress(item.file);
        const fd = new FormData(); fd.append('image', compressed);
        const r = await fetch(`https://api.imgbb.com/1/upload?key=${App.config.imgbbApiKey}`, { method: 'POST', body: fd });
        const d = await r.json();
        if (!d.success) throw new Error('Upload failed');
        item.url = d.data.display_url;
        urls.push(item.url);
      } catch (e) { console.error('Upload error:', e); UI.toast('Erreur upload photo', 'error'); }
      if (thumb) { const ld = thumb.querySelector('.thumb__loader'); if (ld) ld.remove(); }
    }
    return urls;
  },

  reset() { this.files = []; document.getElementById('photo-preview').innerHTML = ''; }
};
