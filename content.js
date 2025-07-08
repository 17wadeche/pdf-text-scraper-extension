const ALLOWED_PREFIXES = [
  'https://crm.medtronic.com/sap/bc/contentserver/',
  'https://cpic1cs.corp.medtronic.com:8008/sap/bc/contentserver/',
  'https://crmstage.medtronic.com/sap/bc/contentserver/'
];
if (ALLOWED_PREFIXES.some(p => location.href.startsWith(p))) {
  (async () => {
    const HIGHLIGHT_ATTR = 'data-hl';
    let highlightsOn = true;
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
        color: #000;
        box-shadow: 0 2px 5px rgba(0,0,0,0.08);
        cursor: pointer;
        background-repeat: no-repeat;
        background-position: right 8px center;
        background-image: url("data:image/svg+xml;charset=UTF-8,\
<svg xmlns='http://www.w3.org/2000/svg' width='12' height='7' fill='%23666'>\
<path d='M1 1l5 5 5-5'/></svg>");
      }
      .modern-select option { color: #000; }
      .modern-select:focus {
        outline: none;
        border-color: #4a90e2;
        box-shadow: 0 0 0 2px rgba(74,144,226,0.3);
      }
    `;
    document.head.appendChild(styleTag);
    const pdfCss = document.createElement('link');
    pdfCss.rel = 'stylesheet';
    pdfCss.href = chrome.runtime.getURL('pdf_viewer.css');
    document.head.appendChild(pdfCss);
    const { defaultStyleWords, config } = await import(
      chrome.runtime.getURL('styles.js')
    );
    let currentBU = localStorage.getItem('highlight_BU') || '';
    let currentOU = localStorage.getItem('highlight_OU') || '';
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
    const buSelect = document.createElement('select');
    buSelect.className = 'modern-select';
    const ouSelect = document.createElement('select');
    ouSelect.className = 'modern-select';
    const toggle   = document.createElement('button');
    toggle.textContent = 'Original';
    Object.assign(toggle.style, {
      background: '#ff0',
      color: '#000',
      fontWeight: 'bold',
      padding: '6px 12px',
      cursor: 'pointer'
    });
    buSelect.innerHTML = 
      `<option value="">-- Select BU --</option>` +
      Object.keys(config)
            .map(bu => `<option value="${bu}" ${bu===currentBU?'selected':''}>${bu}</option>`)
            .join('');
    function updateOuOptions() {
      const ous = Object.keys(config[currentBU]||{})
                       .filter(k => k!=='styleWords');
      ouSelect.innerHTML = 
        `<option value="">-- Select OU --</option>` +
        ous.map(ou => `<option value="${ou}" ${ou===currentOU?'selected':''}>${ou}</option>`).join('');
    }
    updateOuOptions();
    [buSelect, ouSelect].forEach(sel => {
      sel.onchange = () => {
        currentBU = buSelect.value;
        currentOU = ouSelect.value;
        localStorage.setItem('highlight_BU', currentBU);
        localStorage.setItem('highlight_OU', currentOU);
        updateStyleWords();
        document.querySelectorAll(`.textLayer span[${HIGHLIGHT_ATTR}]`)
                .forEach(span => {
          const txt = span.textContent.trim();
          const base = span.dataset.origStyle || '';
          let matched = false;
          styleWordsToUse.forEach(({style, words}) => {
            words.forEach(raw => {
              const rx = new RegExp(`\\b${raw.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')}\\b`, 'i');
              if (rx.test(txt)) {
                span.dataset.hlStyle = `${base};${style};opacity:1;pointer-events:auto`;
                if (highlightsOn) span.setAttribute('style', span.dataset.hlStyle);
                matched = true;
              }
            });
          });
          if (!matched) {
            span.removeAttribute(HIGHLIGHT_ATTR);
            span.setAttribute('style', base);
          }
        });
      };
    });
    Object.assign(buSelect.style, { position:'fixed', top:'16px', left:'16px', zIndex:2147483648 });
    Object.assign(ouSelect.style, { position:'fixed', top:'16px', left:'200px', zIndex:2147483648 });
    Object.assign(toggle.style,  { position:'fixed', top:'16px', left:'380px', zIndex:2147483648 });
    document.body.append(buSelect, ouSelect, toggle);
    const pdfjsLib    = await import(chrome.runtime.getURL('pdf.mjs'));
    const pdfjsViewer = await import(chrome.runtime.getURL('pdf_viewer.mjs'));
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs');
    const { PDFViewer, PDFLinkService, EventBus } = pdfjsViewer;
    const viewerEl = document.querySelector('pdf-viewer');
    const embed    = viewerEl?.shadowRoot
      ? viewerEl.shadowRoot.querySelector('embed[type*="pdf"]')
      : document.querySelector('embed[type="application/pdf"],embed[type="application/x-google-chrome-pdf"]');
    const rect = embed.getBoundingClientRect();
    embed.style.display = 'none';
    const container = document.createElement('div');
    Object.assign(container.style, {
      position:'absolute',
      top: `${rect.top + scrollY}px`,
      left:`${rect.left + scrollX}px`,
      width:`${rect.width}px`,
      height:`${rect.height}px`,
      overflow:'auto',
      background:'#fff',
      zIndex:2147483647
    });
    embed.parentNode.insertBefore(container, embed.nextSibling);
    const viewerDiv = document.createElement('div');
    viewerDiv.className = 'pdfViewer';
    container.appendChild(viewerDiv);
    const forceShow = document.createElement('style');
    forceShow.textContent = `
      .textLayer, .textLayer span {
        opacity: 1 !important;
        pointer-events: auto !important;
        color: inherit !important;
      }
    `;
    document.head.appendChild(forceShow);
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
    const linkService= new PDFLinkService({ eventBus });
    const pdfViewer  = new PDFViewer({
      container,
      viewer: viewerDiv,
      eventBus,
      linkService,
      textLayerMode: 2
    });
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
        styleWordsToUse.forEach(({ style, words }) => {
          words.forEach(raw => {
            const rx = new RegExp(`\\b${raw.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')}\\b`, 'i');
            if (rx.test(txt)) {
              span.dataset.origStyle = baseStyle;
              span.dataset.hlStyle   = `${baseStyle};${style};opacity:1;pointer-events:auto`;
              span.setAttribute('style', span.dataset.hlStyle);
              span.setAttribute(HIGHLIGHT_ATTR, '');
            }
          });
        });
      });
    });
    toggle.onclick = () => {
      document.querySelectorAll(`.textLayer span[${HIGHLIGHT_ATTR}]`)
              .forEach(span => {
        span.setAttribute(
          'style',
          highlightsOn ? span.dataset.origStyle : span.dataset.hlStyle
        );
      });
      toggle.textContent = highlightsOn ? 'Styled' : 'Original';
      highlightsOn = !highlightsOn;
    };
  })();
}
