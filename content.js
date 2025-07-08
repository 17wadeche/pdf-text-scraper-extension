const ALLOWED_PREFIXES = [
  'https://crm.medtronic.com/sap/bc/contentserver/',
  'https://cpic1cs.corp.medtronic.com:8008/sap/bc/contentserver/',
  'https://crmstage.medtronic.com/sap/bc/contentserver/'
];

if (ALLOWED_PREFIXES.some(p => location.href.startsWith(p))) {
  (async () => {
    // Style for dropdown
    const styleTag = document.createElement('style');
    styleTag.textContent = `
      .modern-select {
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

    // Add PDF.js CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('pdf_viewer.css');
    document.head.appendChild(link);

    // Import configuration
    const { defaultStyleWords, config } = await import(chrome.runtime.getURL('styles.js'));

    let currentBU = localStorage.getItem('highlight_BU');
    let currentOU = localStorage.getItem('highlight_OU');

    try {
      if (top.GUIDE?.PE) {
        const pe = top.GUIDE.PE[top.GUIDE.PE.curPrEv];
        currentBU = pe.PartnersTable.find(x => x.PartnerFunction === 'BU Responsible' && x.MainPartner)?.Name || currentBU;
        currentOU = pe.PartnersTable.find(x => x.PartnerFunction === 'OU Responsible' && x.MainPartner)?.Name || currentOU;
      }
    } catch {}

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
    const toggle = document.createElement('button');
    toggle.textContent = 'Original';

    const buSelect = document.createElement('select');
    const ouSelect = document.createElement('select');
    [buSelect, ouSelect].forEach(el => el.className = 'modern-select');

    buSelect.innerHTML = `<option value="">-- Select BU --</option>` +
      Object.keys(config).map(bu =>
        `<option value="${bu}" ${bu === currentBU ? 'selected' : ''}>${bu}</option>`
      ).join('');

    function updateOuOptions() {
      const selectedBU = buSelect.value;
      const ous = Object.keys(config[selectedBU] || {}).filter(k => k !== 'styleWords');
      ouSelect.innerHTML = `<option value="">-- Select OU --</option>` +
        ous.map(ou =>
          `<option value="${ou}" ${ou === currentOU ? 'selected' : ''}>${ou}</option>`
        ).join('');
    }
    updateOuOptions();
    [buSelect, ouSelect].forEach(select => {
      select.onchange = () => {
        currentBU = buSelect.value;
        currentOU = ouSelect.value;
        localStorage.setItem('highlight_BU', currentBU);
        localStorage.setItem('highlight_OU', currentOU);
        updateStyleWords();
        document.querySelectorAll(`.textLayer span[${HIGHLIGHT_ATTR}]`).forEach(span => {
          const txt = span.textContent.trim();
          const baseStyle = span.dataset.origStyle || '';
          let styled = false;
          styleWordsToUse.forEach(({ style, words }) => {
            words.forEach(raw => {
              const safe = raw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
              if (new RegExp(`\\b${safe}\\b`, 'i').test(txt)) {
                span.dataset.hlStyle = `${baseStyle};${style};opacity:1;pointer-events:auto;`;
                if (highlightsOn) span.setAttribute('style', span.dataset.hlStyle);
                styled = true;
              }
            });
          });
          if (!styled) {
            span.removeAttribute(HIGHLIGHT_ATTR);
            span.setAttribute('style', baseStyle);
          }
        });
      };
    });
    Object.assign(buSelect.style, {
      position: 'fixed',
      top: '16px',
      left: '16px',
      zIndex: 2147483648
    });
    Object.assign(ouSelect.style, {
      position: 'fixed',
      top: '16px',
      left: '190px',
      zIndex: 2147483648
    });
    Object.assign(toggle.style, {
      position: 'fixed',
      top: '16px',
      left: '364px',
      background: '#ff0',
      color: '#000',
      fontWeight: 'bold',
      padding: '6px 12px',
      zIndex: 2147483648,
      cursor: 'pointer'
    });
    document.body.appendChild(buSelect);
    document.body.appendChild(ouSelect);
    document.body.appendChild(toggle);
    let highlightsOn = true;
    const HIGHLIGHT_ATTR = 'data-hl';
    const pdfjsLib = await import(chrome.runtime.getURL('pdf.mjs'));
    const pdfjsViewer = await import(chrome.runtime.getURL('pdf_viewer.mjs'));
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs');
    const { PDFViewer, PDFLinkService, EventBus } = pdfjsViewer;
    const viewerEl = document.querySelector('pdf-viewer');
    const embed = viewerEl?.shadowRoot
      ? viewerEl.shadowRoot.querySelector('embed[type*="pdf"]')
      : document.querySelector('embed[type="application/pdf"],embed[type="application/x-google-chrome-pdf"]');
    const rect = embed.getBoundingClientRect();
    embed.style.display = 'none';
    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'absolute',
      top: `${rect.top + window.scrollY}px`,
      left: `${rect.left + window.scrollX}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      overflow: 'auto',
      background: '#fff',
      zIndex: 2147483647
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
    const eventBus = new EventBus();
    const linkService = new PDFLinkService({ eventBus });
    const pdfViewer = new PDFViewer({
      container,
      viewer: viewerDiv,
      eventBus,
      linkService
    });
    const visibilityFix = document.createElement('style');
    visibilityFix.textContent = `
      .textLayer {
        opacity: 1 !important;
        pointer-events: auto !important;
        color: inherit !important;
      }
      .textLayer div {
        opacity: 1 !important;
        color: inherit !important;
      }
    `;
    document.head.appendChild(visibilityFix);
    linkService.setViewer(pdfViewer);
    pdfViewer.setDocument(pdfDoc);
    linkService.setDocument(pdfDoc, null);
    eventBus.on('textlayerrendered', ({ pageNumber }) => {
      const pageView = pdfViewer._pages[pageNumber - 1];
      const textLayerEl = pageView?.textLayer?.textLayerDiv;
      if (!textLayerEl) return;
      Array.from(textLayerEl.querySelectorAll('span')).forEach(span => {
        const txt = span.textContent.trim();
        const baseStyle = span.getAttribute('style') || '';
        styleWordsToUse.forEach(({ style, words }) => {
          words.forEach(raw => {
            const safe = raw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
            if (new RegExp(`\\b${safe}\\b`, 'i').test(txt)) {
              span.dataset.origStyle = baseStyle;
              span.dataset.hlStyle = `${baseStyle};${style}`;
              span.style.opacity = '1';
              span.style.color = 'black'; // fallback if no color is applied
              span.style.pointerEvents = 'auto';
              span.setAttribute('style', span.dataset.hlStyle);
              span.setAttribute(HIGHLIGHT_ATTR, '');
            }
          });
        });
      });
    });
    toggle.onclick = () => {
      highlightsOn = !highlightsOn;
      if (highlightsOn) {
        container.style.display = '';
        embed.style.display     = 'none';
      } else {
        container.style.display = 'none';
        embed.style.display     = '';
      }
      document
        .querySelectorAll(`.textLayer span[${HIGHLIGHT_ATTR}]`)
        .forEach(span => {
          span.setAttribute(
            'style',
            highlightsOn ? span.dataset.origStyle : span.dataset.hlStyle
          );
          span.style.cssText = highlightsOn
            ? span.dataset.hlStyle    // styled
            : span.dataset.origStyle; // original
        });
      toggle.textContent = highlightsOn
        ? 'Original' 
        : 'Styled';  
    };
  })();
}
