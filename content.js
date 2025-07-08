// content.js

(async () => {
  // 1) Confirm injection
  console.log('%c[Highlight] content.js loaded','background:#222;color:#0f0;font-weight:bold;');

  // 2) Wait up to 10s for the real CRM PDF embed to appear
  let embed, objectEl, pdfUrl;
  for (let i = 0; i < 40; i++) {
    objectEl = document.querySelector('object[type="application/pdf"]');
    embed    = objectEl?.querySelector('embed[type*="pdf"]')
             || document.querySelector('embed[type*="pdf"]');
    pdfUrl   = embed?.getAttribute('original-url') || embed?.src;
    if (pdfUrl && pdfUrl.startsWith('https://crm.medtronic.com/sap/bc/contentserver/')) {
      console.log('[Highlight] found PDF embed →', pdfUrl);
      break;
    }
    await new Promise(r => setTimeout(r, 250));
  }
  if (!embed || !pdfUrl) {
    console.error('[Highlight] could not find CRM PDF embed – exiting.');
    return;
  }

  // 3) Inject styles (including stacking so canvas stays crisp and text layers align)
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .modern-select { /* your select CSS */ }
    .pdf-toggle   { /* your toggle CSS  */ }

    /* stack PDF.js canvas below text layer */
    .viewerContainer .canvasWrapper { position: absolute; top:0; left:0; z-index:1; }
    .viewerContainer .textLayer    { position: absolute; top:0; left:0; z-index:2; }
    /* hide the original <embed> entirely */
    embed[type*="pdf"] { visibility: hidden !important; }
  `;
  document.head.appendChild(styleEl);
  const pdfCss = document.createElement('link');
  pdfCss.rel  = 'stylesheet';
  pdfCss.href = chrome.runtime.getURL('pdf_viewer.css');
  document.head.appendChild(pdfCss);

  // 4) Load your word-lists
  const { defaultStyleWords, config } = await import(
    chrome.runtime.getURL('styles.js')
  );

  // 5) Determine BU/OU, build styleWordsToUse
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

  // 6) Create BU/OU selects + toggle (your existing code here)
  const buSelect = document.createElement('select');
  buSelect.className = 'modern-select';
  buSelect.innerHTML = `<option value="">-- Select BU --</option>` +
    Object.keys(config).map(bu => `<option value="${bu}" ${bu===currentBU?'selected':''}>${bu}</option>`).join('');
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
    currentBU = buSelect.value;
    currentOU = ouSelect.value;
    localStorage.setItem('highlight_BU', currentBU);
    localStorage.setItem('highlight_OU', currentOU);
    updateStyleWords();
    // reapply highlights on existing spans
    document.querySelectorAll(`.textLayer span[data-hl]`).forEach(span=>{
      const txt = span.textContent.replace(/\s+/g,' ').toLowerCase();
      const base = span.dataset.origStyle||'';
      let hit=false;
      styleWordsToUse.forEach(({style,words})=>{
        words.forEach(raw=>{
          if(txt.includes(raw.toLowerCase())){
            span.dataset.hlStyle = `${base};${style};opacity:1;pointer-events:auto`;
            if(highlightsOn) span.style.cssText = span.dataset.hlStyle;
            hit=true;
          }
        });
      });
      if(!hit){
        span.removeAttribute('data-hl');
        span.style.cssText = base;
      }
    });
  });
  Object.assign(buSelect.style, {position:'fixed',top:'16px',left:'16px',zIndex:2147483648});
  Object.assign(ouSelect.style, {position:'fixed',top:'16px',left:'200px',zIndex:2147483648});
  Object.assign(toggle.style,   {position:'fixed',top:'16px',left:'380px',zIndex:2147483648});
  document.body.append(buSelect, ouSelect, toggle);

  // 7) Set up PDF.js container over the original embed region
  const rect = embed.getBoundingClientRect();
  const container = document.createElement('div');
  container.className = 'viewerContainer';
  Object.assign(container.style, {
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

  // 8) Fetch PDF bytes
  let data;
  try {
    const resp = await fetch(pdfUrl, {credentials:'include'});
    if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
    data = await resp.arrayBuffer();
  } catch(e){
    console.error('[Highlight] fetch PDF failed',e);
    return;
  }

  // 9) Init PDF.js
  const pdfjsLib    = await import(chrome.runtime.getURL('pdf.mjs'));
  const pdfjsViewer = await import(chrome.runtime.getURL('pdf_viewer.mjs'));
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs');
  const {PDFViewer,PDFLinkService,EventBus} = pdfjsViewer;
  const eventBus    = new EventBus();
  const linkService = new PDFLinkService({eventBus});
  const pdfViewer   = new PDFViewer({
    container,
    viewer:viewerDiv,
    eventBus,
    linkService,
    textLayerMode:2
  });
  linkService.setViewer(pdfViewer);

  // 10) Highlight on every textlayerrendered
  eventBus.on('textlayerrendered',({pageNumber})=>{
    const pageView  = pdfViewer._pages[pageNumber-1];
    const textLayer = pageView?.textLayer?.textLayerDiv;
    if(!textLayer) return;
    const spans = Array.from(textLayer.querySelectorAll('span'));
    const allText = spans.map(s=>s.textContent).join('').toLowerCase();
    let pos=0;
    const ranges = spans.map(s=>{
      const start=pos; pos+=s.textContent.length;
      return {span:s,start,end:pos};
    });
    styleWordsToUse.forEach(({style,words})=>{
      words.forEach(raw=>{
        const needle=raw.toLowerCase();
        let idx=allText.indexOf(needle);
        while(idx!==-1){
          const end=idx+needle.length;
          ranges.forEach(({span,start, end:spanEnd})=>{
            if(spanEnd>idx && start<end){
              const base=span.getAttribute('style')||'';
              if(!span.dataset.origStyle) span.dataset.origStyle=base;
              span.dataset.hlStyle=`${base};${style};opacity:1;pointer-events:auto`;
              span.style.cssText=span.dataset.hlStyle;
              span.setAttribute('data-hl','');
            }
          });
          idx=allText.indexOf(needle,end);
        }
      });
    });
  });

  // 11) Load the document
  const pdfDoc = await pdfjsLib.getDocument({data}).promise;
  pdfViewer.setDocument(pdfDoc);
  linkService.setDocument(pdfDoc,null);

  // 12) Toggle button
  toggle.onclick = ()=>{
    document.querySelectorAll('.textLayer span[data-hl]').forEach(span=>{
      span.style.cssText = highlightsOn
        ? span.dataset.origStyle
        : span.dataset.hlStyle;
    });
    toggle.textContent = highlightsOn ? 'Styled' : 'Original';
    highlightsOn = !highlightsOn;
  };
})();
