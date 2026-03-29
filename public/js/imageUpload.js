// ============================================
// GWADLOUP ALÈRT — Upload et compression d'images
// Utilise browser-image-compression + ImgBB API
// ============================================

const ImageUpload = {
  files: [],
  uploadedUrls: [],
  maxFiles: 4,
  maxSizeMB: 10,

  init() {
    const dropzone = document.getElementById('photo-dropzone');
    const input = document.getElementById('photo-input');

    // Clic sur la dropzone
    dropzone.addEventListener('click', () => input.click());

    // Sélection de fichiers
    input.addEventListener('change', (e) => {
      this.handleFiles(Array.from(e.target.files));
      input.value = '';
    });

    // Drag & Drop
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      this.handleFiles(files);
    });
  },

  handleFiles(newFiles) {
    const remaining = this.maxFiles - this.files.length;
    if (remaining <= 0) {
      UI.toast(`Maximum ${this.maxFiles} photos autorisées`, 'warning');
      return;
    }

    const filesToAdd = newFiles.slice(0, remaining);

    for (const file of filesToAdd) {
      if (file.size > this.maxSizeMB * 1024 * 1024) {
        UI.toast(`${file.name} dépasse ${this.maxSizeMB}MB`, 'warning');
        continue;
      }

      const id = Date.now() + Math.random().toString(36).substr(2, 9);
      this.files.push({ id, file, status: 'pending', url: null });
      this.renderPreview({ id, file });
    }
  },

  renderPreview(item) {
    const preview = document.getElementById('photo-preview');
    const reader = new FileReader();

    reader.onload = (e) => {
      const thumb = document.createElement('div');
      thumb.className = 'photo-thumb';
      thumb.id = `thumb-${item.id}`;
      thumb.innerHTML = `
        <img src="${e.target.result}" alt="Preview">
        <button type="button" class="photo-thumb__remove" onclick="ImageUpload.removeFile('${item.id}')">
          <i class="fas fa-times"></i>
        </button>
      `;
      preview.appendChild(thumb);
    };

    reader.readAsDataURL(item.file);
  },

  removeFile(id) {
    this.files = this.files.filter(f => f.id !== id);
    const thumb = document.getElementById(`thumb-${id}`);
    if (thumb) thumb.remove();
  },

  async compressImage(file) {
    const options = {
      maxSizeMB: 0.8,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: 0.8
    };

    try {
      const compressed = await imageCompression(file, options);
      console.log(
        `Compression: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB`
      );
      return compressed;
    } catch (error) {
      console.error('Erreur compression:', error);
      return file;
    }
  },

  async uploadToImgBB(file) {
    const compressed = await this.compressImage(file);

    const formData = new FormData();
    formData.append('image', compressed);

    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${App.config.imgbbApiKey}`,
      {
        method: 'POST',
        body: formData
      }
    );

    const data = await response.json();

    if (!data.success) {
      throw new Error('Échec upload ImgBB');
    }

    return data.data.display_url;
  },

  async uploadAll() {
    const urls = [];

    for (const item of this.files) {
      if (item.url) {
        urls.push(item.url);
        continue;
      }

      const thumb = document.getElementById(`thumb-${item.id}`);
      if (thumb) {
        const loader = document.createElement('div');
        loader.className = 'photo-thumb__uploading';
        loader.innerHTML = '<span class="spinner-inline" style="border-color:rgba(0,135,90,0.3);border-top-color:#00875A;"></span>';
        thumb.appendChild(loader);
      }

      try {
        const url = await this.uploadToImgBB(item.file);
        item.url = url;
        urls.push(url);

        if (thumb) {
          const loader = thumb.querySelector('.photo-thumb__uploading');
          if (loader) loader.remove();
        }
      } catch (error) {
        console.error('Erreur upload image:', error);
        UI.toast('Erreur lors de l\'upload d\'une photo', 'error');

        if (thumb) {
          const loader = thumb.querySelector('.photo-thumb__uploading');
          if (loader) loader.remove();
        }
      }
    }

    return urls;
  },

  reset() {
    this.files = [];
    this.uploadedUrls = [];
    document.getElementById('photo-preview').innerHTML = '';
  }
};
