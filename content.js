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
    link.rel  = 'stylesheet';
    link.href = chrome.runtime.getURL('pdf_viewer.css');
    document.head.appendChild(link);

    // ─── load your config ───────────────────
    const { defaultStyleWords, config } = await import(chrome.runtime.getURL('styles.js'));

    // ─── state ──────────────────────────────
    let currentBU = localStorage.getItem('highlight_BU') || '';
    let currentOU = localStorage.getItem('highlight_OU') || '';
    let styleWordsToUse = [];

    function updateStyleWords() {
      styleWordsToUse = [];
      if (currentBU && config[currentBU]?.styleWords) {
        styleWordsToUse = [...config[currentBU].styleWords];
      }
      if (currentBU && currentOU && config[currentBU][currentOU]?.styleWords) {
        styleWordsToUse.push(...config[currentBU][currentOU].styleWords);
      }
    }
    updateStyleWords();

    // ─── build controls ──────────────────────
    const buSelect = document.createElement('select');
    const ouSelect = document.createElement('select');
    const toggle   = document.createElement('button');
    [buSelect, ouSelect].forEach(s => s.className = 'modern-select');
    toggle.textContent = 'Original';

    // populate BU
    buSelect.innerHTML =
      `<option value="">-- Select BU --</option>` +
      Object.keys(config)
            .map(bu => `<option value="${bu}" ${bu===currentBU?'selected':''}>${bu}</option>`)
            .join('');

    // populate OU
    function updateOuOptions() {
      const ous = Object.keys(config[buSelect.value]||{}).filter(k=>'styleWords'!==k);
      ouSelect.innerHTML =
        `<option value="">-- Select OU --</option>` +
        ous.map(ou => `<option value="${ou}" ${ou===currentOU?'selected':''}>${ou}</option>`).join('');
    }
    updateOuOptions();

    // change handlers
    function renderAllHighlights() {
      document.querySelectorAll('.textLayer span').forEach(span => {
        // reset to original
        span.style.cssText = span.dataset.origStyle || '';
        const txt = span.textContent.trim();
        styleWordsToUse.forEach(({style,words}) => {
          words.forEach(raw => {
            const safe = raw.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
            if (new RegExp(`\\b${safe}\\b`,'i').test(txt)) {
              span.style.cssText = `${span.dataset.origStyle};${style}`;
            }
          });
        });
      });
    }

    buSelect.onchange = () => {
      currentBU = buSelect.value;
      localStorage.setItem('highlight_BU', currentBU);
      currentOU = '';
      localStorage.removeItem('highlight_OU');
      updateOuOptions();
      updateStyleWords();
      renderAllHighlights();
    };
    ouSelect.onchange = () => {
      currentOU = ouSelect.value;
      localStorage.setItem('highlight_OU', currentOU);
      updateStyleWords();
      renderAllHighlights();
    };

    // insert controls
    Object.assign(buSelect.style, { position:'fixed', top:'16px', left:'16px', zIndex:2147483648 });
    Object.assign(ouSelect.style, { position:'fixed', top:'16px', left:'190px', zIndex:2147483648 });
    Object.assign(toggle.style, {
      position:'fixed', top:'16px', right:'16px',
      background:'#ff0', color:'#000', fontWeight:'bold',
      padding:'6px 12px', zIndex:2147483648, cursor:'pointer'
    });
    document.body.append(buSelect, ouSelect, toggle);

    // ─── PDF.js setup ───────────────────────
    const pdfjsLib    = await import(chrome.runtime.getURL('pdf.mjs'));
    const pdfjsViewer = await import(chrome.runtime.getURL('pdf_viewer.mjs'));
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs');
    const { PDFViewer, PDFLinkService, EventBus } = pdfjsViewer;

    // find & hide the native embed
    const viewerEl = document.querySelector('pdf-viewer');
    const embed    = viewerEl?.shadowRoot
      ? viewerEl.shadowRoot.querySelector('embed[type*="pdf"]')
      : document.querySelector('embed[type="application/pdf"],embed[type="application/x-google-chrome-pdf"]');
    const rect = embed.getBoundingClientRect();
    embed.style.display = 'none';

    // create our overlay container
    const container = document.createElement('div');
    Object.assign(container.style, {
      position:'absolute',
      top:   `${rect.top}px`,
      left:  `${rect.left}px`,
      width: `${rect.width}px`,
      height:`${rect.height}px`,
      overflow:'auto', background:'#fff', zIndex:2147483647
    });
    embed.parentNode.insertBefore(container, embed.nextSibling);
    const viewerDiv = document.createElement('div');
    viewerDiv.className = 'pdfViewer';
    container.appendChild(viewerDiv);

    // keep overlay in sync on scroll/resize
    function updateContainer() {
      const r = embed.getBoundingClientRect();
      Object.assign(container.style, {
        top:   `${r.top}px`,
        left:  `${r.left}px`,
        width: `${r.width}px`,
        height:`${r.height}px`
      });
    }
    window.addEventListener('scroll', updateContainer);
    window.addEventListener('resize', updateContainer);

    // fetch & load PDF
    let data;
    try {
      const url = embed.getAttribute('original-url')||location.href;
      data = await fetch(url, {credentials:'include'}).then(r=>r.arrayBuffer());
    } catch {
      console.error('Could not fetch PDF');
      return;
    }
    const pdfDoc      = await pdfjsLib.getDocument({data}).promise;
    const eventBus    = new EventBus();
    const linkService = new PDFLinkService({eventBus});
    const pdfViewer   = new PDFViewer({container, viewer:viewerDiv, eventBus, linkService});

    // reveal textLayer
    const fix = document.createElement('style');
    fix.textContent = `
      .textLayer, .textLayer div {
        opacity:1 !important; pointer-events:auto !important;
      }
    `;
    document.head.appendChild(fix);

    linkService.setViewer(pdfViewer);
    pdfViewer.setDocument(pdfDoc);
    linkService.setDocument(pdfDoc, null);

    // on render, stash origin and apply highlight
    eventBus.on('textlayerrendered', ({pageNumber}) => {
      const pageView  = pdfViewer._pages[pageNumber-1];
      const textLayer = pageView?.textLayer?.textLayerDiv;
      if (!textLayer) return;
      Array.from(textLayer.querySelectorAll('span')).forEach(span => {
        const txt       = span.textContent.trim();
        const baseStyle = span.getAttribute('style')||'';
        span.dataset.origStyle = baseStyle;
        styleWordsToUse.forEach(({style,words}) => {
          words.forEach(raw => {
            const safe = raw.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
            if (new RegExp(`\\b${safe}\\b`,'i').test(txt)) {
              span.style.cssText = `${baseStyle};${style}`;
            }
          });
        });
      });
    });

    // toggle
    let showingStyled = true;
    toggle.onclick = () => {
      showingStyled = !showingStyled;
      if (showingStyled) {
        container.style.display = '';
        embed.style.display     = 'none';
        renderAllHighlights();
      } else {
        container.style.display = 'none';
        embed.style.display     = '';
      }
      toggle.textContent = showingStyled ? 'Original' : 'Styled';
    };

  })();
}