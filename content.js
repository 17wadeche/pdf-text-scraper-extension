const ALLOWED_PREFIXES = [
  'https://crm.medtronic.com/sap/bc/contentserver/',
  'https://cpic1cs.corp.medtronic.com:8008/sap/bc/contentserver/',
  'https://crmstage.medtronic.com/sap/bc/contentserver/'
];

if (ALLOWED_PREFIXES.some(p => location.href.startsWith(p))) {
  (async () => {
    const HIGHLIGHT_ATTR = 'data-hl';
    let highlightsOn = true;

    // ─── inject your UI styles ───────────────────────────────────────────────────
    const css = document.createElement('style');
    css.textContent = `
      .modern-select {
        -webkit-appearance: none;
        appearance: none;
        padding: 6px 32px 6px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: #fff;
        font-size: 14px;
        color: #000;
        box-shadow: 0 2px 5px rgba(0,0,0,0.08);
        cursor: pointer;
        background-repeat: no-repeat;
        background-position: right 8px center;
        background-image: url("data:image/svg+xml;charset=UTF-8,\
<svg xmlns='http://www.w3.org/2000/svg' width='12' height='7' fill='%23666'>\
<path d='M1 1l5 5 5-5'/></svg>");
      }
      .modern-select option {
        color: #000;
      }
      .modern-select:focus {
        outline: none;
        border-color: #4a90e2;
        box-shadow: 0 0 0 2px rgba(74,144,226,0.3);
      }
      .pdf-toggle {
        background: #ff0 !important;
        color: #000 !important;
        font-weight: bold !important;
        padding: 6px 12px !important;
        border: none !important;
        cursor: pointer !important;
      }
    `;
    document.head.appendChild(css);

    const pdfCss = document.createElement('link');
    pdfCss.rel = 'stylesheet';
    pdfCss.href = chrome.runtime.getURL('pdf_viewer.css');
    document.head.appendChild(pdfCss);

    // ensure textLayer is visible & non–highlight spans stay black;
    // also keep the PDF canvas (for charts/graphics) intact, but put it behind the text
    const override = document.createElement('style');
    override.textContent = `
      .viewerContainer canvas {
        z-index: 1;
      }
      .textLayer, .textLayer span {
        z-index: 2 !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }
      .textLayer span:not([${HIGHLIGHT_ATTR}]) {
        color: black !important;
      }
    `;
    document.head.appendChild(override);
    // ──────────────────────────────────────────────────────────────────────────────

    // load your word-lists
    const { defaultStyleWords, config } = await import(
      chrome.runtime.getURL('styles.js')
    );

    // figure out which BU/OU to use
    let currentBU = localStorage.getItem('highlight_BU') || '';
    let currentOU = localStorage.getItem('highlight_OU') || '';
    try {
      if (top.GUIDE?.PE) {
        const pe = top.GUIDE.PE[top.GUIDE.PE.curPrEv];
        currentBU = pe.PartnersTable.find(x => x.PartnerFunction==='BU Responsible' && x.MainPartner)?.Name || currentBU;
        currentOU = pe.PartnersTable.find(x => x.PartnerFunction==='OU Responsible' && x.MainPartner)?.Name || currentOU;
      }
    } catch {}

    // build initial styleWordsToUse
    let styleWordsToUse = [];
    function updateStyleWords() {
      styleWordsToUse = [...defaultStyleWords];
      if (currentBU && config[currentBU]?.styleWords) {
        styleWordsToUse = [...config[currentBU].styleWords];
      }
      if (currentBU && currentOU && config[currentBU][currentOU]?.styleWords) {
        styleWordsToUse = [...config[currentBU][currentOU].styleWords];
      }
    }
    updateStyleWords();

    // build BU/OU selectors + toggle
    const buSelect = document.createElement('select');
    buSelect.className = 'modern-select';
    buSelect.innerHTML =
      `<option value="">-- Select BU --</option>` +
      Object.keys(config).map(bu =>
        `<option value="${bu}" ${bu===currentBU?'selected':''}>${bu}</option>`
      ).join('');
    const ouSelect = document.createElement('select');
    ouSelect.className = 'modern-select';
    function refreshOU() {
      const ous = Object.keys(config[currentBU]||{}).filter(k=>'styleWords'!==k);
      ouSelect.innerHTML =
        `<option value="">-- Select OU --</option>` +
        ous.map(ou =>
          `<option value="${ou}" ${ou===currentOU?'selected':''}>${ou}</option>`
        ).join('');
    }
    refreshOU();

    const toggle = document.createElement('button');
    toggle.className = 'pdf-toggle';
    toggle.textContent = 'Original';

    [buSelect, ouSelect].forEach(sel => {
      sel.onchange = () => {
        currentBU = buSelect.value;
        currentOU = ouSelect.value;
        localStorage.setItem('highlight_BU', currentBU);
        localStorage.setItem('highlight_OU', currentOU);
        updateStyleWords();

        // re-apply highlighting on all rendered spans
        document.querySelectorAll(`.textLayer span[${HIGHLIGHT_ATTR}]`).forEach(span => {
          const txt  = span.textContent.replace(/\s+/g, ' ').toLowerCase();
          const base = span.dataset.origStyle || '';
          let hit = false;
          styleWordsToUse.forEach(({ style, words }) => {
            words.forEach(raw => {
              if (txt.includes(raw.toLowerCase())) {
                span.dataset.hlStyle = `${base};${style};opacity:1;pointer-events:auto`;
                if (highlightsOn) span.style.cssText = span.dataset.hlStyle;
                hit = true;
              }
            });
          });
          if (!hit) {
            span.removeAttribute(HIGHLIGHT_ATTR);
            span.style.cssText = base;
          }
        });
      };
    });

    Object.assign(buSelect.style, { position:'fixed', top:'16px', left:'16px', zIndex:2147483648 });
    Object.assign(ouSelect.style, { position:'fixed', top:'16px', left:'200px', zIndex:2147483648 });
    Object.assign(toggle.style,  { position:'fixed', top:'16px', left:'380px', zIndex:2147483648 });
    document.body.append(buSelect, ouSelect, toggle);

    // ─── locate the PDF element & pick the real PDF URL ─────────────────────────
    const objectEl = document.querySelector('object[type="application/pdf"]');
    const embed    = objectEl?.querySelector('embed[type*="pdf"]')
                   || document.querySelector('embed[type*="pdf"]');

    if (!embed) {
      console.error('Could not find PDF embed/object');
      return;
    }

    let url = '';
    if (objectEl?.data?.startsWith('http')) {
      url = objectEl.data;
    } else if (embed.src?.startsWith('http')) {
      url = embed.src;
    } else if (embed.getAttribute('original-url')?.startsWith('http')) {
      url = embed.getAttribute('original-url');
    } else {
      url = location.href;
    }
    // ──────────────────────────────────────────────────────────────────────────────

    // hide Chrome’s built-in PDF plugin & build our PDF.js container
    const rect = embed.getBoundingClientRect();
    embed.style.display = 'none';

    const container = document.createElement('div');
    container.className = 'viewerContainer';
    Object.assign(container.style, {
      position: 'absolute',
      top:    `${rect.top + window.scrollY}px`,
      left:   `${rect.left + window.scrollX}px`,
      width:  `${rect.width}px`,
      height: `${rect.height}px`,
      overflow: 'auto',
      background: '#fff',
      zIndex: 2147483647
    });
    embed.parentNode.insertBefore(container, embed.nextSibling);

    const viewerDiv = document.createElement('div');
    viewerDiv.className = 'pdfViewer';
    container.appendChild(viewerDiv);

    // ─── fetch PDF bytes ─────────────────────────────────────────────────────────
    let data;
    try {
      const resp = await fetch(url, { credentials: 'include' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      data = await resp.arrayBuffer();
    } catch (err) {
      console.error('Could not fetch PDF →', err);
      return;
    }
    // ──────────────────────────────────────────────────────────────────────────────

    // ─── initialize PDF.js ───────────────────────────────────────────────────────
    const pdfjsLib    = await import(chrome.runtime.getURL('pdf.mjs'));
    const pdfjsViewer = await import(chrome.runtime.getURL('pdf_viewer.mjs'));
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs');
    const { PDFViewer, PDFLinkService, EventBus } = pdfjsViewer;

    const eventBus    = new EventBus();
    const linkService = new PDFLinkService({ eventBus });
    const pdfViewer   = new PDFViewer({
      container,
      viewer: viewerDiv,
      eventBus,
      linkService,
      textLayerMode: 2
    });
    linkService.setViewer(pdfViewer);

    // catch every page’s textLayer render
    eventBus.on('textlayerrendered', ({ pageNumber }) => {
      const pageView  = pdfViewer._pages[pageNumber - 1];
      const textLayer = pageView?.textLayer?.textLayerDiv;
      if (!textLayer) return;

      const spans     = Array.from(textLayer.querySelectorAll('span'));
      const fullText  = spans.map(s => s.textContent).join('');
      const lowerText = fullText.toLowerCase();

      let pos = 0;
      const spanRanges = spans.map(s => {
        const start = pos;
        pos += s.textContent.length;
        return { span: s, start, end: pos };
      });

      styleWordsToUse.forEach(({ style, words }) => {
        words.forEach(raw => {
          const needle = raw.toLowerCase();
          let idx = lowerText.indexOf(needle);
          while (idx !== -1) {
            const hitStart = idx, hitEnd = idx + needle.length;
            spanRanges.forEach(({ span, start, end }) => {
              if (end > hitStart && start < hitEnd) {
                const base = span.getAttribute('style') || '';
                if (!span.dataset.origStyle) span.dataset.origStyle = base;
                span.dataset.hlStyle = `${base};${style};opacity:1;pointer-events:auto`;
                span.style.cssText = span.dataset.hlStyle;
                span.setAttribute(HIGHLIGHT_ATTR, '');
              }
            });
            idx = lowerText.indexOf(needle, hitEnd);
          }
        });
      });
    });

    // load the PDF document
    const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    pdfViewer.setDocument(pdfDoc);
    linkService.setDocument(pdfDoc, null);

    // toggle between original & styled
    toggle.onclick = () => {
      document.querySelectorAll(`.textLayer span[${HIGHLIGHT_ATTR}]`).forEach(span => {
        span.style.cssText = highlightsOn
          ? span.dataset.origStyle
          : span.dataset.hlStyle;
      });
      toggle.textContent = highlightsOn ? 'Styled' : 'Original';
      highlightsOn = !highlightsOn;
    };
    // ──────────────────────────────────────────────────────────────────────────────

  })();
}
