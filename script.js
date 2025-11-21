/* Globals */
const fileInput = document.getElementById('fileInput');
const pickBtn = document.getElementById('pickBtn');
const dropArea = document.getElementById('dropArea');
const previewContainer = document.getElementById('previewContainer');
const maxFilesInput = document.getElementById('maxFiles');
const compressRange = document.getElementById('compressQuality');
const qualityVal = document.getElementById('qualityVal');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const generateBtn = document.getElementById('generateBtn');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const clearAllBtn = document.getElementById('clearAllBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const darkToggle = document.getElementById('darkToggle');

let filesData = []; // {name, base64, desc}
let uploading = false;

/* UI helpers */
qualityVal.innerText = parseFloat(compressRange.value).toFixed(2);
compressRange.addEventListener('input', () => {
  qualityVal.innerText = parseFloat(compressRange.value).toFixed(2);
});

/* Drag & Drop */
;['dragenter','dragover'].forEach(ev => {
  dropArea.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation();
    dropArea.classList.add('dragover');
  });
});
;['dragleave','drop'].forEach(ev => {
  dropArea.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation();
    if(ev === 'drop') handleFilesDrop(e);
    dropArea.classList.remove('dragover');
  });
});

pickBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFiles(Array.from(e.target.files)));

/* drop handler */
function handleFilesDrop(e) {
  const dt = e.dataTransfer;
  const items = dt.files ? Array.from(dt.files) : [];
  handleFiles(items);
}

/* main add files */
async function handleFiles(list) {
  const maxFiles = parseInt(maxFilesInput.value || 5, 10);
  if (filesData.filter(Boolean).length + list.length > maxFiles) {
    alert(`Maksimal ${maxFiles} gambar!`);
    return;
  }

  progressText.innerText = 'Processing...';
  for (const f of list) {
    if (!f.type.startsWith('image/')) continue;
    const compressed = await compressImageFile(f, parseFloat(compressRange.value));
    const renamed = autoRename(f.name);
    addToMemory({ name: renamed, base64: compressed, desc: '' });
  }
  progressText.innerText = 'Idle';
  renderPreviews();
}

/* compress image via canvas -> base64 */
function compressImageFile(file, quality = 0.8, maxDim = 1600) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = () => {
        // scale to maxDim
        const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const mime = 'image/jpeg';
        const dataUrl = canvas.toDataURL(mime, quality);
        resolve(dataUrl.split(',')[1]); // return base64 only
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* auto rename: timestamp + random */
function autoRename(original) {
  const ext = (original.split('.').pop() || 'jpg').toLowerCase();
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `img_${ts}_${rand}.${ext}`;
}

/* memory and render */
function addToMemory(obj) {
  filesData.push(obj);
}
function renderPreviews() {
  previewContainer.innerHTML = '';
  filesData.forEach((item, idx) => {
    if (!item) return;
    const el = document.createElement('div'); el.className = 'preview-item';
    el.dataset.index = idx;

    const wrap = document.createElement('div'); wrap.className = 'preview-img-wrapper';
    const img = document.createElement('img'); img.className = 'preview-img';
    img.src = `data:image/jpeg;base64,${item.base64}`;
    wrap.appendChild(img);

    const del = document.createElement('button'); del.className = 'delete-btn'; del.innerText = '×';
    del.title = 'Hapus gambar';
    del.onclick = () => { filesData[idx] = null; renderPreviews(); };
    wrap.appendChild(del);

    const meta = document.createElement('div'); meta.className = 'meta';
    const fname = document.createElement('div'); fname.className = 'filename'; fname.innerText = item.name;
    const ta = document.createElement('textarea'); ta.className = 'textarea'; ta.placeholder = 'Deskripsi model...';
    ta.value = item.desc || '';
    ta.oninput = (e) => item.desc = e.target.value;

    meta.appendChild(fname); meta.appendChild(ta);

    el.appendChild(wrap); el.appendChild(meta);
    previewContainer.appendChild(el);
  });
}

/* Export JSON */
exportJsonBtn.addEventListener('click', () => {
  const list = filesData.filter(Boolean).map(f => ({ name: f.name, desc: f.desc, base64: f.base64 }));
  if (list.length === 0) { alert('Belum ada file untuk diexport'); return; }
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `export_${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url);
});

/* Download all images (zip not included) - downloads individually */
downloadAllBtn.addEventListener('click', () => {
  const arr = filesData.filter(Boolean);
  if (!arr.length) return alert('Belum ada file');
  arr.forEach(f => {
    const a = document.createElement('a');
    a.href = `data:image/jpeg;base64,${f.base64}`;
    a.download = f.name;
    document.body.appendChild(a); a.click(); a.remove();
  });
});

/* Clear all */
clearAllBtn.addEventListener('click', () => {
  if (!confirm('Hapus semua file dari sesi ini?')) return;
  filesData = []; renderPreviews();
});

/* Generate (send to API) */
/* NOTE: ubah API_URL ke endpoint yang lu gunakan; disini contoh placeholder */
const API_URL = 'https://example.com/api/generate'; // <--- ganti ke endpoint beneran

generateBtn.addEventListener('click', async () => {
  const arr = filesData.filter(Boolean);
  if (!arr.length) return alert('Tidak ada file untuk diproses.');
  if (uploading) return alert('Sedang mengunggah, tunggu sebentar.');
  try {
    uploading = true;
    progressText.innerText = 'Starting upload...';
    // create FormData and append files as blobs
    const form = new FormData();
    arr.forEach((f, i) => {
      // convert base64 to blob
      const blob = base64ToBlob(f.base64, 'image/jpeg');
      form.append('file' + i, blob, f.name);
      form.append('desc' + i, f.desc || '');
    });

    // example additional field
    form.append('meta', JSON.stringify({ source: 'client-uploader' }));

    // use XMLHttpRequest to get upload progress
    await uploadWithProgress(API_URL, form);
  } catch (err) {
    console.error(err);
    alert('Upload gagal. Cek console untuk detail.');
  } finally {
    uploading = false;
  }
});

/* XMLHttpRequest upload with progress */
function uploadWithProgress(url, formData) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressFill.style.width = pct + '%';
        progressText.innerText = `Uploading ${pct}%`;
      }
    };
    xhr.onload = () => {
      progressFill.style.width = '100%';
      progressText.innerText = 'Upload complete';
      // try parse response
      let resp = null;
      try { resp = JSON.parse(xhr.responseText); } catch (e) { resp = xhr.responseText; }
      console.log('Server response:', resp);
      alert('Upload complete. Periksa console untuk response.');
      resolve(resp);
    };
    xhr.onerror = () => { progressText.innerText = 'Upload error'; reject(new Error('Network error')); };
    xhr.send(formData);
  });
}

/* util: base64 -> blob */
function base64ToBlob(base64, mime) {
  const binary = atob(base64);
  const len = binary.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/* dark mode toggle */
darkToggle.addEventListener('change', (e) => {
  document.body.classList.toggle('dark', e.target.checked);
});

/* quick load sample (optional) */
// You can add sample images here for testing by pushing to filesData and calling renderPreviews()

/* INIT */
renderPreviews();
progressText.innerText = 'Idle';
