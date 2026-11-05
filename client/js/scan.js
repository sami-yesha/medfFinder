/**
 * MedFinder - Prescription Scan Module
 * Reads a prescription photo with Tesseract.js (in the browser — the image is
 * never uploaded), then fuzzy-matches the text against medicines in our database.
 */

const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const MAX_IMAGE_SIDE = 2000; // downscale big phone photos so OCR stays fast

let tesseractLoading = null;

/** Load Tesseract.js on first use only (it's large) */
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve();
  if (!tesseractLoading) {
    tesseractLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = TESSERACT_URL;
      script.onload = resolve;
      script.onerror = () => { tesseractLoading = null; reject(new Error(i18n.t('scan.load_failed'))); };
      document.head.appendChild(script);
    });
  }
  return tesseractLoading;
}

// ── Fuzzy matching ────────────────────────────────────────────

function levenshtein(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** 1 = identical, 0 = nothing in common */
const similarity = (a, b) => 1 - levenshtein(a, b) / Math.max(a.length, b.length);

// OCR often reads letters as look-alike digits inside words ("Metf0rmin", "Amoxici1lin")
const DIGIT_LOOKALIKES = { 0: 'o', 1: 'l', 5: 's', 8: 'b' };

const lettersOnly = (str) => str.toLowerCase()
  .replace(/(?<=[a-z])[0158](?=[a-z])/g, d => DIGIT_LOOKALIKES[d])
  .replace(/[^a-z]+/g, ' ')
  .trim();

/**
 * Find which known medicine names appear in OCR text.
 * OCR often gets a letter or two wrong ("Paracetam0l"), so each name is compared
 * against every same-length run of words and accepted at ≥ 80% similarity.
 * Returns [{ name, confidence }] in the order they appear in the text.
 */
function matchMedicines(text, knownNames) {
  const words = lettersOnly(text).split(' ').filter(Boolean);
  const found = [];

  knownNames.forEach(name => {
    const target = lettersOnly(name);
    if (target.length < 4) return;
    const size = target.split(' ').length;

    let best = { score: 0, index: -1 };
    for (let i = 0; i + size <= words.length; i++) {
      const score = similarity(words.slice(i, i + size).join(' '), target);
      if (score > best.score) best = { score, index: i };
    }
    if (best.score >= 0.8) found.push({ name, confidence: best.score, index: best.index });
  });

  return found.sort((a, b) => a.index - b.index);
}

// ── Image → text ──────────────────────────────────────────────

/** Downscale to MAX_IMAGE_SIDE, clean up, and return a canvas Tesseract can read */
function prepareImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      // Smooth camera noise and boost contrast — tested to recover names OCR misses on noisy photos
      ctx.filter = 'grayscale(1) blur(1px) contrast(1.6)';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error(i18n.t('scan.bad_image')));
    img.src = URL.createObjectURL(file);
  });
}

async function readPrescription(file, onProgress) {
  await loadTesseract();
  const image = await prepareImage(file);
  const worker = await Tesseract.createWorker('eng', 1, {
    logger: m => { if (m.status === 'recognizing text') onProgress(m.progress); }
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

// ── Results ───────────────────────────────────────────────────

/** Per medicine name: where it's in stock, cheapest price, nearest distance */
function summarizeAvailability(name, allResults) {
  const rows = allResults.filter(r => normalizeName(r.medicine.name) === normalizeName(name));
  const inStock = rows.filter(r => r.medicine.stock.isAvailable);
  const cheapest = [...inStock].sort((a, b) => a.medicine.pricing.amount - b.medicine.pricing.amount)[0];
  const distances = inStock.map(r => Nearby.distanceTo(r.pharmacy.location)).filter(d => d != null);
  return {
    pharmacies: rows.length,
    inStock: inStock.length,
    cheapest: cheapest?.medicine.pricing,
    nearest: distances.length ? Math.min(...distances) : null
  };
}

function renderScanResults(matches, allResults, text) {
  const list = matches.length
    ? matches.map(m => {
        const s = summarizeAvailability(m.name, allResults);
        const stockLine = s.inStock
          ? `<span class="ds-pill ds-pill-ok">${icon('check')}${i18n.t('scan.in_stock_at', { count: s.inStock })}</span>`
          : `<span class="ds-pill ds-pill-bad">${icon('x')}${i18n.t('compare.none_in_stock')}</span>`;
        return `
          <div class="scan-match">
            <div class="scan-match-main">
              <div class="scan-match-name">${icon('pill')}${escapeHtml(m.name)}</div>
              <div class="scan-match-meta">
                ${stockLine}
                ${s.cheapest ? `<span>${icon('banknote')} ${i18n.t('scan.from_price', { price: `${escapeHtml(s.cheapest.amount)} ${escapeHtml(s.cheapest.currency)}` })}</span>` : ''}
                ${s.nearest != null ? `<span>${icon('navigation')} ${i18n.t('near.away', { distance: Nearby.formatDistance(s.nearest) })}</span>` : ''}
              </div>
            </div>
            <div class="scan-match-actions">
              <button class="btn-chip" data-scan-show="${escapeHtml(m.name)}">${icon('search')}${i18n.t('scan.show')}</button>
              ${s.pharmacies > 1 ? `<button class="btn-chip btn-chip-primary" data-compare="${escapeHtml(m.name)}">${icon('scale')}${i18n.t('compare.prices', { count: s.pharmacies })}</button>` : ''}
            </div>
          </div>`;
      }).join('')
    : `<div class="compare-summary compare-summary-empty">${i18n.t('scan.none_found')}</div>`;

  return `
    ${matches.length ? `<div class="compare-summary"><strong>${i18n.t('scan.found', { count: matches.length })}</strong></div>` : ''}
    <div class="scan-matches">${list}</div>
    <details class="scan-raw">
      <summary>${i18n.t('scan.raw_text')}</summary>
      <pre>${escapeHtml(text.trim()) || '—'}</pre>
    </details>`;
}

// ── Sample prescription (for demos without a real one) ───────

/** Draw a printed-style prescription on a canvas and return it as a PNG File */
function makeSamplePrescription() {
  const c = document.createElement('canvas');
  c.width = 900; c.height = 1100;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#1e3a8a'; g.fillRect(0, 0, c.width, 14);

  g.fillStyle = '#111';
  g.font = 'bold 40px Georgia, serif';   g.fillText('Bole Family Clinic', 60, 90);
  g.font = '24px Georgia, serif';        g.fillText('Addis Ababa  |  Tel 0116 000 000', 60, 130);
  g.fillRect(60, 155, 780, 2);
  g.font = '26px Georgia, serif';
  g.fillText('Patient: Hana Bekele          Age: 34', 60, 210);
  g.fillText('Date: 05/11/2026', 60, 250);
  g.font = 'bold 64px Georgia, serif';   g.fillText('Rx', 60, 350);

  g.font = '34px Georgia, serif';
  [
    '1. Amoxicillin 500 mg capsules',
    '    1 capsule three times daily, 7 days',
    '2. Paracetamol 500 mg tablets',
    '    1-2 tablets when needed for fever',
    '3. Omeprazole 20 mg',
    '    1 capsule before breakfast'
  ].forEach((line, i) => g.fillText(line, 60, 430 + i * 62));

  g.fillRect(520, 940, 320, 2);
  g.font = 'italic 26px Georgia, serif'; g.fillText('Dr. Solomon Tadesse', 540, 980);

  return new Promise(resolve => c.toBlob(blob => resolve(new File([blob], 'sample-prescription.png', { type: 'image/png' })), 'image/png'));
}

// ── Modal ─────────────────────────────────────────────────────

function ensureScanModal() {
  let overlay = document.getElementById('scan-modal');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'scan-modal';
  overlay.className = 'compare-overlay';
  overlay.innerHTML = `
    <div class="compare-modal" role="dialog" aria-modal="true" aria-labelledby="scan-title">
      <div class="compare-modal-header">
        <h2 id="scan-title"></h2>
        <button class="compare-close" aria-label="Close">${icon('x')}</button>
      </div>
      <div id="scan-start">
        <p class="scan-intro"></p>
        <label class="scan-drop">
          <input type="file" id="scan-file" accept="image/*" capture="environment" hidden />
          <span class="scan-drop-icon">${icon('camera')}</span>
          <span class="scan-drop-text"></span>
        </label>
        <button type="button" class="scan-sample-btn" id="scan-sample"></button>
        <p class="compare-disclaimer scan-privacy"></p>
      </div>
      <div id="scan-work" hidden>
        <img id="scan-preview" class="scan-preview" alt="" />
        <div id="scan-progress" class="scan-progress">
          <div class="scan-progress-label"></div>
          <div class="scan-progress-track"><div class="scan-progress-bar"></div></div>
        </div>
        <div id="scan-results"></div>
        <button type="button" class="scan-again-btn" id="scan-again" hidden></button>
      </div>
      <p class="compare-disclaimer scan-medical"></p>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => { overlay.style.display = 'none'; document.body.style.overflow = ''; };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('.compare-close').addEventListener('click', close);
  // Escape closes only the top modal: leave it to the comparison if that's open over us
  document.addEventListener('keydown', e => {
    const compareOpen = document.getElementById('compare-modal')?.style.display === 'flex';
    if (e.key === 'Escape' && overlay.style.display === 'flex' && !compareOpen) close();
  });

  overlay.querySelector('#scan-file').addEventListener('change', e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) runScan(file);
  });
  overlay.querySelector('#scan-sample').addEventListener('click', async () => runScan(await makeSamplePrescription()));
  overlay.querySelector('#scan-again').addEventListener('click', showScanStart);

  // Result buttons: compare opens the comparison; show filters the medicine list
  overlay.querySelector('#scan-results').addEventListener('click', e => {
    const compareBtn = e.target.closest('[data-compare]');
    if (compareBtn) return openCompare(compareBtn.dataset.compare);
    const showBtn = e.target.closest('[data-scan-show]');
    if (showBtn) {
      close();
      searchFor(showBtn.dataset.scanShow);
    }
  });
  return overlay;
}

/** Fill in translated text (also re-run after a language switch) */
function translateScanModal(overlay) {
  overlay.querySelector('#scan-title').textContent        = i18n.t('scan.title');
  overlay.querySelector('.scan-intro').textContent        = i18n.t('scan.intro');
  overlay.querySelector('.scan-drop-text').textContent    = i18n.t('scan.choose_photo');
  overlay.querySelector('#scan-sample').innerHTML         = `${icon('flask-conical')} ${i18n.t('scan.try_sample')}`;
  overlay.querySelector('.scan-privacy').innerHTML        = `${icon('lock')} ${i18n.t('scan.privacy')}`;
  overlay.querySelector('#scan-again').innerHTML          = `${icon('camera')} ${i18n.t('scan.scan_another')}`;
  overlay.querySelector('.scan-medical').innerHTML        = `${icon('info')} ${i18n.t('scan.medical_note')}`;
}

function showScanStart() {
  const overlay = ensureScanModal();
  overlay.querySelector('#scan-start').hidden = false;
  overlay.querySelector('#scan-work').hidden = true;
}

function setScanProgress(label, fraction) {
  const box = document.getElementById('scan-progress');
  box.hidden = false;
  box.querySelector('.scan-progress-label').textContent = label;
  box.querySelector('.scan-progress-bar').style.width = `${Math.round(fraction * 100)}%`;
}

async function runScan(file) {
  const overlay = ensureScanModal();
  const results = overlay.querySelector('#scan-results');
  const again   = overlay.querySelector('#scan-again');
  const preview = overlay.querySelector('#scan-preview');

  overlay.querySelector('#scan-start').hidden = true;
  overlay.querySelector('#scan-work').hidden = false;
  results.innerHTML = '';
  again.hidden = true;
  if (preview.src.startsWith('blob:')) URL.revokeObjectURL(preview.src);
  preview.src = URL.createObjectURL(file);
  setScanProgress(i18n.t('scan.loading_reader'), 0.05);

  try {
    const [text, allResults] = await Promise.all([
      readPrescription(file, p => setScanProgress(i18n.t('scan.reading'), 0.1 + p * 0.9)),
      API.search('')
    ]);
    const knownNames = [...new Map(allResults.map(r => [normalizeName(r.medicine.name), r.medicine.name])).values()];
    document.getElementById('scan-progress').hidden = true;
    results.innerHTML = renderScanResults(matchMedicines(text, knownNames), allResults, text);
  } catch (err) {
    document.getElementById('scan-progress').hidden = true;
    results.innerHTML = `<div class="compare-summary compare-summary-empty">${icon('x')} ${escapeHtml(err.message)}</div>`;
  } finally {
    again.hidden = false;
  }
}

function openScan() {
  const overlay = ensureScanModal();
  translateScanModal(overlay);
  showScanStart();
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

window.addEventListener('languageChanged', () => {
  const overlay = document.getElementById('scan-modal');
  if (overlay) translateScanModal(overlay);
});

window.openScan = openScan;
