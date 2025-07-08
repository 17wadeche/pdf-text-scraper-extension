// content.js
const ALLOWED_PREFIXES = [
  'https://crm.medtronic.com/sap/bc/contentserver/',
  'https://cpic1cs.corp.medtronic.com:8008/sap/bc/contentserver/',
  'https://crmstage.medtronic.com/sap/bc/contentserver/'
];

if (ALLOWED_PREFIXES.some(p => location.href.startsWith(p))) {
  (async () => {
    // ───── Insert our dropdown styling ─────
    const styleTag = document.createElement('style');
    styleTag.textContent = `
      .modern-select {
        color: #000;
        -webkit-appearance: none;
        appearance: none;
        padding: 6px 32px 6px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background-color: #fff;
        font-size: 14px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.08);
        cursor: pointer;
        background-repeat: no-repeat;
        background-position: right 8px center;
        background-image: url("data:image/svg+xml;charset=UTF-8,\
<svg xmlns='http://www.w3.org/2000/svg' width='12' height='7' fill='%23666'>\
<path d='M1 1l5 5 5-5'/></svg>");
      }
      .modern-select:focus {
        outline: none;
        border-color: #4a90e2;
        box-shadow: 0 0 0 2px rgba(74,144,226,0.3);
      }
    `;
    document.head.appendChild(styleTag);

    // ───── PDF.js CSS ─────
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('pdf_viewer.css');
    document.head.appendChild(link);

    // ───── Load configuration ─────
    const { defaultStyleWords, config } = await import(chrome.runtime.getURL('styles.js'));

    // ───── State ─────
    let currentBU = localStorage.getItem('highlight_BU') || '';
    let currentOU = localStorage.getItem('highlight_OU') || '';
    let styleWordsToUse = [];

    // ───── Refined BU/OU merging ─────
    function updateStyleWords() {
      styleWordsToUse = [];
      // BU-level
      if (currentBU && config[currentBU]?.styleWords) {
        styleWordsToUse = [...config[currentBU].styleWords];
      }
      // OU-level
      if (currentBU && currentOU && config[currentBU][currentOU]?.styleWords) {
        styleWordsToUse.push(...config[currentBU][currentOU].styleWords);
      }
    }
    updateStyleWords();

    // ───── Create controls ─────
    const toggle   = document.createElement('button');
    toggle.textContent = 'Original';

    const buSelect = document.createElement('select');
    const ouSelect = document.createElement('select');
    [buSelect, ouSelect].forEach(el => el.className = 'modern-select');

    // HIGHLIGHT_ATTR
    const HIGHLIGHT_ATTR = 'data-hl';

    // ───── Debug/helper object ─────
    window._highlighter = {
      config,
      defaultStyleWords,
      get styleWordsToUse() { return styleWordsToUse; },
      updateStyleWords,
      buSelect,
      ouSelect,
      applyHighlights: () => {
        document.querySelectorAll('.textLayer span').forEach(span => {
          const txt  = span.textContent.trim();
          const base = span.dataset.origStyle || '';
          let applied = false;
          styleWordsToUse.forEach(({ style, words }) => {
            words.forEach(raw => {
              const safe = raw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
              if (new RegExp(`\\b${safe}\\b`, 'i').test(txt)) {
                span.style.cssText = `${base};${style} !important`;
                applied = true;
              }
            });
          });
          if (!applied) span.style.cssText = base;
        });
      }
    };

    // ───── Populate BU dropdown ─────
    buSelect.innerHTML = `<option value="">-- Select BU --</option>` +
      Object.keys(config)
            .map(bu => `<option value="${bu}" ${bu === currentBU ? 'selected' : ''}>${bu}</option>`)
            .join('');

    // ───── Dynamically populate OU ─────
    function updateOuOptions() {
      const ous = Object.keys(config[buSelect.value] || {})
                        .filter(k => k !== 'styleWords');
      ouSelect.innerHTML = `<option value="">-- Select OU --</option>` +
        ous.map(ou => `<option value="${ou}" ${ou === currentOU ? 'selected' : ''}>${ou}</option>`)
           .join('');
    }
    updateOuOptions();

    // ───── Handlers ─────
    buSelect.onchange = () => {
      currentBU = buSelect.value;
      localStorage.setItem('highlight_BU', currentBU);
      currentOU = '';
      localStorage.removeItem('highlight_OU');
      updateOuOptions();
      updateStyleWords();
      window._highlighter.applyHighlights();
    };

    ouSelect.onchange = () => {
      currentOU = ouSelect.value;
      localStorage.setItem('highlight_OU', currentOU);
      updateStyleWords();
      window._highlighter.applyHighlights();
    };

    // ───── Position and insert controls ─────
    Object.assign(buSelect.style, { position: 'fixed', top: '16px', left: '16px', zIndex: 2147483648 });
    Object.assign(ouSelect.style, { position: 'fixed', top: '16px', left: '190px', zIndex: 2147483648 });
    Object.assign(toggle.style, {
      position: 'fixed', top: '16px', right: '16px',
      background: '#ff0', color: '#000', fontWeight: 'bold',
      padding: '6px 12px', zIndex: 2147483648, cursor: 'pointer'
    });

    document.body.append(buSelect, ouSelect, toggle);

    // ───── Setup PDF.js viewer ─────
    const pdfjsLib    = await import(chrome.runtime.getURL('pdf.mjs'));
    const pdfjsViewer = await import(chrome.runtime.getURL('pdf_viewer.mjs'));
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs');
    const { PDFViewer, PDFLinkService, EventBus } = pdfjsViewer;

    // find and hide the native embed
    const viewerEl = document.querySelector('pdf-viewer');
    const embed    = viewerEl?.shadowRoot
      ? viewerEl.shadowRoot.querySelector('embed[type*="pdf"]')
      : document.querySelector('embed[type="application/pdf"],embed[type="application/x-google-chrome-pdf"]');
    const rect = embed.getBoundingClientRect();
    embed.style.display = 'none';

    // create our container
    const container = document.createElement('div');
    Object.assign(container.style, {
      position:   'absolute',
      top:        `${rect.top + window.scrollY}px`,
      left:       `${rect.left + window.scrollX}px`,
      width:      `${rect.width}px`,
      height:     `${rect.height}px`,
      overflow:   'auto',
      background: '#fff',
      zIndex:     2147483647
    });
    embed.parentNode.insertBefore(container, embed.nextSibling);
    const viewerDiv = document.createElement('div');
    viewerDiv.className = 'pdfViewer';
    container.appendChild(viewerDiv);
    let data;
    try {
      const url = embed.getAttribute('original-url') || location.href;
      data = await fetch(url, { credentials: 'include' }).then(r => r.arrayBuffer());
    } catch {
      console.error('Could not fetch PDF');
      return;
    }
    const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    const eventBus   = new EventBus();
    const linkService = new PDFLinkService({ eventBus });
    const pdfViewer   = new PDFViewer({ container, viewer: viewerDiv, eventBus, linkService });
    const visibilityFix = document.createElement('style');
    visibilityFix.textContent = `
      .textLayer,
      .textLayer div {
        opacity: 1 !important;
        pointer-events: auto !important;
      }
    `;
    document.head.appendChild(visibilityFix);
    linkService.setViewer(pdfViewer);
    pdfViewer.setDocument(pdfDoc);
    linkService.setDocument(pdfDoc, null);
    eventBus.on('textlayerrendered', ({ pageNumber }) => {
      const pageView   = pdfViewer._pages[pageNumber - 1];
      const textLayer  = pageView?.textLayer?.textLayerDiv;
      if (!textLayer) return;
      Array.from(textLayer.querySelectorAll('span')).forEach(span => {
        const txt       = span.textContent.trim();
        const baseStyle = span.getAttribute('style') || '';
        defaultStyleWords.concat(styleWordsToUse).forEach(({ style, words }) => {
          words.forEach(raw => {
            const safe = raw.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
            if (new RegExp(`\\b${safe}\\b`,'i').test(txt)) {
              span.dataset.origStyle = baseStyle;
              span.dataset.hlStyle   = `${baseStyle};${style} !important`;
              span.setAttribute(HIGHLIGHT_ATTR, '');
            }
          });
        });
      });
      window._highlighter.applyHighlights();
    });
    let highlightsOn = true;
    toggle.onclick = () => {
      highlightsOn = !highlightsOn;
      if (highlightsOn) {
        container.style.display = '';
        embed.style.display     = 'none';
        window._highlighter.applyHighlights();
      } else {
        container.style.display = 'none';
        embed.style.display     = '';
      }
      toggle.textContent = highlightsOn ? 'Original' : 'Styled';
    };
  })();
}
