
const ALLOWED_PREFIXES = [
  'https://crm.medtronic.com/sap/bc/contentserver/',
  'https://cpic1cs.corp.medtronic.com:8008/sap/bc/contentserver/',
  'https://crmstage.medtronic.com/sap/bc/contentserver/'
];

if (ALLOWED_PREFIXES.some(p => location.href.startsWith(p))) {

(async () => {
  function escapeHTML(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  const styleTag = document.createElement('style');
  styleTag.textContent = `
    .modern-select{ -webkit-appearance:none;appearance:none;padding:6px 32px 6px 12px;border:1px solid #ddd;border-radius:6px;background:#fff;font-size:14px;box-shadow:0 2px 5px rgba(0,0,0,.08);cursor:pointer;background-repeat:no-repeat;background-position:right 8px center;background-image:url("data:image/svg+xml;charset=UTF-8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='7' fill='%23666'><path d='M1 1l5 5 5-5'/></svg>"); }
    .modern-select:focus{ outline:none;border-color:#4a90e2;box-shadow:0 0 0 2px rgba(74,144,226,.3);}  
    /* optional – dim un‑highlighted glyphs when toggled on              */
    .with-highlights .textLayer span:not([data-highlighted]){opacity:.65}
  `;
  document.head.appendChild(styleTag);
  const commonToggleStyles = {
    position:   'fixed',
    padding:    '6px 12px',
    background: '#ff0',
    color:      '#000',
    fontSize:   '14px',
    fontWeight: 'bold',
    borderRadius: '4px',
    boxShadow:  '0 0 6px rgba(0,0,0,.5)',
    border:     '2px solid #000',
    cursor:     'pointer',
    zIndex:     2147483648
  };
  const { defaultStyleWords, config } = await import(chrome.runtime.getURL('styles.js'));
  let currentBU = null, currentOU = null;
  try {
    if (top.GUIDE?.PE) {
      const pe = top.GUIDE.PE[top.GUIDE.PE.curPrEv];
      const primBU = pe.PartnersTable.find(p => p.PartnerFunction === 'BU Responsible' && p.MainPartner);
      currentBU = primBU?.Name || null;
      const primOU = pe.PartnersTable.find(p => p.PartnerFunction === 'OU Responsible' && p.MainPartner);
      currentOU = primOU?.Name || null;
    }
  } catch (_) {}
  if (!currentBU) currentBU = localStorage.getItem('highlight_BU');
  if (!currentOU) currentOU = localStorage.getItem('highlight_OU');

  let styleWordsToUse = [];
  function updateStyleWords() {
    styleWordsToUse = [...defaultStyleWords];
    if (currentBU && config[currentBU]?.styleWords) {
      styleWordsToUse = [...config[currentBU].styleWords];
      if (currentOU && config[currentBU][currentOU]?.styleWords) {
        styleWordsToUse.push(...config[currentBU][currentOU].styleWords);
      }
    }
  }
  updateStyleWords();

  /* --------------------------------------------------------------------- */
  /*  3.  BU / OU dropdown controls                                       */
  /* --------------------------------------------------------------------- */
  const controlDiv = document.createElement('div');
  Object.assign(controlDiv.style, {
    position:'fixed', top:'10px', left:'10px', display:'flex', gap:'8px',
    padding:'6px', background:'#fff', border:'1px solid #ccc', zIndex:2147483647
  });

  const buSelect = document.createElement('select');
  buSelect.classList.add('modern-select');
  Object.keys(config).forEach(bu => {
    const opt = new Option(bu, bu, false, bu === currentBU);
    buSelect.add(opt);
  });

  const ouSelect = document.createElement('select');
  ouSelect.classList.add('modern-select');
  function populateOUs(){
    ouSelect.innerHTML = '';
    if (currentBU && config[currentBU]) {
      Object.keys(config[currentBU])
        .filter(k => k !== 'styleWords')
        .forEach(ou => ouSelect.add(new Option(ou, ou, false, ou === currentOU)));
    }
  }
  populateOUs();

  buSelect.addEventListener('change', () => {
    currentBU = buSelect.value; currentOU = null; populateOUs(); currentOU = ouSelect.value;
    localStorage.setItem('highlight_BU', currentBU);
    localStorage.setItem('highlight_OU', currentOU);
    updateStyleWords();
    applyAllHighlights();
  });

  ouSelect.addEventListener('change', () => {
    currentOU = ouSelect.value;
    localStorage.setItem('highlight_OU', currentOU);
    updateStyleWords();
    applyAllHighlights();
  });

  controlDiv.append(buSelect, ouSelect);
  document.body.appendChild(controlDiv);

  /* --------------------------------------------------------------------- */
  /*  4.  HTML highlighting path (non‑PDF)                                */
  /* --------------------------------------------------------------------- */
  function unwrapHighlights(){
    document.querySelectorAll('span[data-highlighted]').forEach(s=>s.replaceWith(document.createTextNode(s.textContent)));
  }

  function highlightHTML(words){
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const original = node.textContent;
      let html = escapeHTML(original);
      words.forEach(({style, words}) => {
        words.forEach(raw => {
          const safe = raw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
          const re   = new RegExp(`\\b(${safe})\\b`, 'gi');
          html = html.replace(re, `<span style="${style}" data-highlighted>$1</span>`);
        });
      });
      if (html !== escapeHTML(original)) {
        node.parentNode.replaceChild(document.createRange().createContextualFragment(html), node);
      }
    }
  }

  function applyAllHighlights(){
    unwrapHighlights();
    highlightHTML(styleWordsToUse);
    // PDF highlights handled separately page‑by‑page
  }

  /* --------------------------------------------------------------------- */
  /*  5.  Detect PDF embed                                                */
  /* --------------------------------------------------------------------- */
  let embed = null;
  const viewer = document.querySelector('pdf-viewer');
  if (viewer?.shadowRoot) {
    embed = viewer.shadowRoot.querySelector('embed#plugin, embed[type*="pdf"]');
  } else {
    embed = document.querySelector('embed[type="application/pdf"], embed[type="application/x-google-chrome-pdf"]');
  }

  // ----------------------------------------------------------------------
  // If NO PDF detected, just run HTML highlighter and exit ---------------
  if (!embed) {
    highlightHTML(styleWordsToUse);
    return; // done
  }

  /* --------------------------------------------------------------------- */
  /*  6.  PDF path – render with pdf.js                                   */
  /* --------------------------------------------------------------------- */
  embed.style.display = 'none'; // hide native viewer underneath

  const pdfContainer = document.createElement('div');
  pdfContainer.classList.add('with-highlights'); // default on
  pdfContainer.style.cssText = 'position:fixed;inset:50px 0 0 0;overflow:auto;background:#f0f0f0;z-index:2147483647;';
  document.body.appendChild(pdfContainer);

  // Toggle button ---------------------------------------------------------
  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = 'Original PDF';
  Object.assign(toggleBtn.style, commonToggleStyles, { top:'10px', right:'10px' });
  toggleBtn.addEventListener('click', () => {
    const showingStyled = pdfContainer.style.display !== 'none';
    pdfContainer.style.display = showingStyled ? 'none' : 'block';
    embed.style.display        = showingStyled ? 'block' : 'none';
    toggleBtn.textContent      = showingStyled ? 'Styled PDF' : 'Original PDF';
  });
  document.body.appendChild(toggleBtn);

  // Fetch PDF bytes -------------------------------------------------------
  const pdfUrl = embed.getAttribute('original-url') || location.href;
  let pdfBytes;
  try {
    pdfBytes = await fetch(pdfUrl, { credentials:'include' }).then(r => r.arrayBuffer());
  } catch (e) {
    console.error('PDF fetch failed', e);
    return;
  }

  // Load pdf.js  ----------------------------------------------------------
  const pdfjsLib = await import(chrome.runtime.getURL('pdf.mjs'));
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs');
  const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;

  // Highlight helper ------------------------------------------------------
  function highlightPDFTextLayer(layer){
    styleWordsToUse.forEach(({style, words}) => {
      words.forEach(raw => {
        const safe = raw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const re   = new RegExp(`\\b(${safe})\\b`, 'i');
        layer.querySelectorAll('span').forEach(span => {
          if (re.test(span.textContent)) {
            span.setAttribute('data-highlighted','');
            span.style.cssText += ';' + style;
          }
        });
      });
    });
  }

  // Render each page ------------------------------------------------------
  for (let p = 1; p <= pdf.numPages; p++) {
    const page     = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1.3 });

    const pageDiv = document.createElement('div');
    pageDiv.style.position = 'relative';
    pageDiv.style.width  = `${viewport.width }px`;
    pageDiv.style.height = `${viewport.height}px`;
    pdfContainer.appendChild(pageDiv);

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    pageDiv.appendChild(canvas);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    textLayerDiv.style.position = 'absolute';
    textLayerDiv.style.inset = '0';
    pageDiv.appendChild(textLayerDiv);

    const textContent = await page.getTextContent({ includeMarkedContent:true });
    await pdfjsLib.renderTextLayer({ container:textLayerDiv, textContent, viewport, textDivs:[] }).promise;

    highlightPDFTextLayer(textLayerDiv);
  }
})();
}