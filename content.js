// content.js

(async () => {
  console.log('%c[Highlight] content.js loaded','background:#222;color:#0f0;font-weight:bold;');

  // 1) Wait up to 10s for the real CRM PDF <object>/<embed> to appear
  let objectEl, embed, pdfUrl;
  for (let i = 0; i < 40; i++) {
    objectEl = document.querySelector('object[type="application/pdf"]');
    if (objectEl) {
      embed = objectEl.querySelector('embed[type*="pdf"]') 
           || document.querySelector('embed[type*="pdf"]');
    }
    if (!objectEl || !embed) {
      await new Promise(r => setTimeout(r, 250));
      continue;
    }
    // try several attributes, in order of reliability:
    const candidates = [
      objectEl.data,
      objectEl.getAttribute('data'),
      embed.getAttribute('original-url'),
      embed.getAttribute('src'),
      embed.src,
      location.href
    ];
    pdfUrl = candidates.find(u => typeof u === 'string' && u.startsWith('https://crm.medtronic.com/sap/bc/contentserver/'));
    if (pdfUrl) {
      console.log('[Highlight] found PDF URL →', pdfUrl);
      break;
    }
    await new Promise(r => setTimeout(r, 250));
  }
  if (!pdfUrl) {
    console.error('[Highlight] failed to locate a CRM PDF URL—exiting.');
    return;
  }

  // 2) Inject CSS so PDF.js canvas stays sharp and text layers align
  const css = document.createElement('style');
  css.textContent = `
    .modern-select { /* ... your existing select styles ... */ }
    .pdf-toggle   { /* ... your existing toggle styles ...  */ }

    /* position PDF.js layers over the original embed, keep canvas underneath */
    embed[type*="pdf"] { visibility: hidden!important; }
    .viewerContainer .canvasWrapper { position:absolute; top:0; left:0; z-index:1; }
    .viewerContainer .textLayer    { position:absolute; top:0; left:0; z-index:2; pointer-events:auto!important; }
    .viewerContainer .textLayer span { opacity:1!important; }
    .viewerContainer .textLayer span:not([data-hl]) { color:black!important; }
  `;
  document.head.appendChild(css);

  // load PDF.js CSS
  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = chrome.runtime.getURL('pdf_viewer.css');
  document.head.appendChild(link);

  // 3) Load your word lists & config
  const { defaultStyleWords, config } = await import(
    chrome.runtime.getURL('styles.js')
  );

  // 4) Determine BU/OU from storage or CRM GUIDE
  let currentBU = localStorage.getItem('highlight_BU') || '';
  let currentOU = localStorage.getItem('highlight_OU') || '';
  try {
    if (top.GUIDE?.PE) {
      const pe = top.GUIDE.PE[top.GUIDE.PE.curPrEv];
      currentBU = pe.PartnersTable.find(x=>x.PartnerFunction==='BU Responsible'&&x.MainPartner)?.Name || currentBU;
      currentOU = pe.PartnersTable.find(x=>x.PartnerFunction==='OU Responsible'&&x.MainPartner)?.Name || currentOU;
    }
  } catch {}

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

  // 5) Create BU/OU selects + toggle button
  const buSelect = document.createElement('select');
  buSelect.className = 'modern-select';
  buSelect.innerHTML = `<option value="">-- Select BU --</option>` +
    Object.keys(config).map(bu =>
      `<option value="${bu}" ${bu===currentBU?'selected':''}>${bu}</option>`
    ).join('');
  const ouSelect = document.createElement('select');
  ouSelect.className = 'modern-select';
  function refreshOU() {
    const ous = Object.keys(config[currentBU]||{}).filter(k=>'styleWords'!==k);
    ouSelect.innerHTML = `<option value="">-- Select OU --</option>` +
      ous.map(ou=>`<option value="${ou}" ${ou===currentOU?'selected':''}>${ou}</option>`).join('');
  }
  refreshOU();
  const toggle = document.createElement('button');
  toggle.className = 'pdf-toggle';
  toggle.textContent = 'Original';

  [buSelect, ouSelect].forEach(sel => sel.onchange = () => {
    currentBU = buSelect.value; currentOU = ouSelect.value;
    localStorage.setItem('highlight_BU', currentBU);
    localStorage.setItem('highlight_OU', currentOU);
    updateStyleWords();
    // reapply highlights on existing spans
    document.querySelectorAll('.textLayer span[data-hl]').forEach(span=>{
      const txt = span.textContent.replace(/\s+/g,' ').toLowerCase();
      const base = span.dataset.origStyle||'';
      let hit = false;
      styleWordsToUse.forEach(({style,words})=>{
        words.forEach(raw=>{
          if(txt.includes(raw.toLowerCase())){
            span.dataset.hlStyle = `${base};${style};opacity:1;pointer-events:auto`;
            if(highlightsOn) span.style.cssText = span.dataset.hlStyle;
            hit = true;
          }
        });
      });
      if(!hit){
        span.removeAttribute('data-hl');
        span.style.cssText = base;
      }
    });
  });

  Object.assign(buSelect.style,{position:'fixed',top:'16px',left:'16px',  zIndex:2147483648});
  Object.assign(ouSelect.style,{position:'fixed',top:'16px',left:'200px', zIndex:2147483648});
  Object.assign(toggle.style,  {position:'fixed',top:'16px',left:'380px', zIndex:2147483648});
  document.body.append(buSelect, ouSelect, toggle);

  // 6) Build our PDF.js container atop the hidden embed
  const rect = embed.getBoundingClientRect();
  const container = document.createElement('div');
  container.className = 'viewerContainer';
  Object.assign(container.style,{
    position:'absolute',
    top:`${rect.top+window.scrollY}px`,
    left:`${rect.left+window.scrollX}px`,
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

  // 7) Fetch the actual PDF bytes
  let data;
  try {
    const resp = await fetch(pdfUrl, { credentials:'include' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    data = await resp.arrayBuffer();
  } catch (e) {
    console.error('[Highlight] fetch PDF failed', e);
    return;
  }

  // 8) Initialize PDF.js
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

  // 9) Highlight on every text layer render
  eventBus.on('textlayerrendered', ({ pageNumber }) => {
    const pageView  = pdfViewer._pages[pageNumber - 1];
    const textLayer = pageView?.textLayer?.textLayerDiv;
    if (!textLayer) return;
    const spans = Array.from(textLayer.querySelectorAll('span'));
    const fullText = spans.map(s=>s.textContent).join('').toLowerCase();
    let pos = 0;
    const ranges = spans.map(s => {
      const start = pos; pos += s.textContent.length;
      return { span: s, start, end: pos };
    });
    ranges.forEach(({ span, start, end }) => span.dataset.origOrder = `${start}-${end}`);
    styleWordsToUse.forEach(({ style, words }) => {
      words.forEach(raw => {
        const needle = raw.toLowerCase();
        let idx = fullText.indexOf(needle);
        while (idx !== -1) {
          const hitEnd = idx + needle.length;
          ranges.forEach(({ span, start, end }) => {
            if (end > idx && start < hitEnd) {
              const base = span.getAttribute('style')||'';
              if (!span.dataset.origStyle) span.dataset.origStyle = base;
              span.dataset.hlStyle = `${base};${style};opacity:1;pointer-events:auto`;
              span.style.cssText = span.dataset.hlStyle;
              span.setAttribute('data-hl', '');
            }
          });
          idx = fullText.indexOf(needle, hitEnd);
        }
      });
    });
  });

  // 10) Load and render the PDF
  const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
  pdfViewer.setDocument(pdfDoc);
  linkService.setDocument(pdfDoc, null);

  // 11) Toggle styled/original on button click
  toggle.onclick = () => {
    document.querySelectorAll('.textLayer span[data-hl]').forEach(span => {
      span.style.cssText = highlightsOn
        ? span.dataset.origStyle
        : span.dataset.hlStyle;
    });
    toggle.textContent = highlightsOn ? 'Styled' : 'Original';
    highlightsOn = !highlightsOn;
  };
})();
