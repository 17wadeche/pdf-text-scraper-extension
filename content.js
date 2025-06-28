// content.js
const ALLOWED_PREFIXES = [
  'https://crm.medtronic.com/sap/bc/contentserver/',
  'https://cpic1cs.corp.medtronic.com:8008/sap/bc/contentserver/'
];

if (ALLOWED_PREFIXES.some(p => location.href.startsWith(p))) {
  (async () => {
    // Inject modern-select styles
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
  <path d='M1 1l5 5 5-5'/>\
  </svg>");
      }
      .modern-select:focus {
        outline: none;
        border-color: #4a90e2;
        box-shadow: 0 0 0 2px rgba(74,144,226,0.3);
      }
    `;
    document.head.appendChild(styleTag);

    // Load highlight words and config
    const { defaultStyleWords, config } = await import(
      chrome.runtime.getURL('styles.js')
    );

    // Determine current BU/OU
    let currentBU = null, currentOU = null;
    try {
      if (top.GUIDE?.PE) {
        const pe = top.GUIDE.PE[top.GUIDE.PE.curPrEv];
        currentBU = pe.PartnersTable.find(p => p.PartnerFunction === 'BU Responsible' && p.MainPartner)?.Name;
        currentOU = pe.PartnersTable.find(p => p.PartnerFunction === 'OU Responsible' && p.MainPartner)?.Name;
      }
    } catch (e) {}
    if (!currentBU) currentBU = localStorage.getItem('highlight_BU');
    if (!currentOU) currentOU = localStorage.getItem('highlight_OU');

    // Build styleWordsToUse
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

    // Helpers for HTML-highlighter
    function escapeHTML(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function unwrapHighlights() {
      document.querySelectorAll('span[data-highlighted]').forEach(span => {
        span.replaceWith(document.createTextNode(span.textContent));
      });
    }
    function highlightHTML(styles) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent;
        let html = escapeHTML(text);
        styles.forEach(({ style, words }) => {
          words.forEach(raw => {
            const safe = raw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
            const re = new RegExp('\\b(' + safe + ')\\b','gi');
            html = html.replace(re, `<span style="${style}" data-highlighted>\\$1</span>`);
          });
        });
        if (html !== escapeHTML(text)) {
          const frag = document.createRange().createContextualFragment(html);
          node.parentNode.replaceChild(frag, node);
        }
      }
    }

    // Common toggle-style button
    const commonToggleStyles = {
      position:   'fixed',
      padding:    '6px 12px',
      background: '#ff0',
      color:      '#000',
      fontSize:   '14px',
      fontWeight: 'bold',
      borderRadius: '4px',
      boxShadow:  '0 0 6px rgba(0,0,0,0.5)',
      border:     '2px solid #000',
      cursor:     'pointer',
      zIndex:     2147483648,
    };

    // Build BU/OU control panel
    const controlDiv = document.createElement('div');
    Object.assign(controlDiv.style, {
      position: 'fixed', top: '10px', left: '10px',
      display:  'flex', gap: '8px', padding: '6px',
      background:'#fff', border:'1px solid #ccc', zIndex:2147483647
    });
    const buSelect = document.createElement('select'); buSelect.classList.add('modern-select');
    const ouSelect = document.createElement('select'); ouSelect.classList.add('modern-select');
    function populateBU() {
      buSelect.innerHTML='';
      Object.keys(config).forEach(bu => {
        const opt = new Option(bu, bu, bu===currentBU, bu===currentBU);
        buSelect.add(opt);
      });
    }
    function populateOU() {
      ouSelect.innerHTML='';
      if (currentBU && config[currentBU]) {
        Object.keys(config[currentBU]).filter(k=>'styleWords'!==k)
          .forEach(ou=>ouSelect.add(new Option(ou,ou,ou===currentOU,ou===currentOU)));
      }
      currentOU = ouSelect.value;
      localStorage.setItem('highlight_OU', currentOU);
    }
    buSelect.addEventListener('change',()=>{
      currentBU = buSelect.value;
      localStorage.setItem('highlight_BU', currentBU);
      populateOU(); updateStyleWords(); redrawAll();
    });
    ouSelect.addEventListener('change',()=>{
      currentOU = ouSelect.value;
      localStorage.setItem('highlight_OU', currentOU);
      updateStyleWords(); redrawAll();
    });
    populateBU(); populateOU();
    controlDiv.append(buSelect, ouSelect);
    document.body.appendChild(controlDiv);

    // Attempt to find PDF embed
    const viewer = document.querySelector('pdf-viewer');
    let embed = viewer?.shadowRoot?.querySelector('embed#plugin,embed[type*="pdf"]')
              || document.querySelector('embed[type="application/pdf"]');

    // HTML-fallback: if no PDF embed, just style the page text
    if (!embed) {
      highlightHTML(styleWordsToUse);
      let htmlStyled = true;
      const htmlToggle = document.createElement('button');
      htmlToggle.textContent = 'Original HTML';
      Object.assign(htmlToggle.style, { ...commonToggleStyles, top:'10px', right:'10px' });
      htmlToggle.addEventListener('click',()=>{
        if (htmlStyled) { unwrapHighlights(); htmlToggle.textContent='Styled HTML'; controlDiv.style.display='none'; }
        else { highlightHTML(styleWordsToUse); htmlToggle.textContent='Original HTML'; controlDiv.style.display='flex'; }
        htmlStyled = !htmlStyled;
      });
      document.body.appendChild(htmlToggle);
      return;
    }

    // PDF path: overlay highlights via PDF.js
    const pdfUrl = embed.getAttribute('original-url') || location.href;
    const raw = await fetch(pdfUrl,{credentials:'include'}).then(r=>r.arrayBuffer());
    const pdfjs = await import(chrome.runtime.getURL('pdf.mjs'));
    pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs');
    const pdf    = await pdfjs.getDocument({ data: raw }).promise;
    const scale  = 1.5;

    // Transparent overlay container
    const overlay = document.createElement('div');
    Object.assign(overlay.style,{
      position:'fixed',top:'0',left:'0',
      width:'100vw',height:'100vh',pointerEvents:'none',
      zIndex:2147483647,background:'transparent'
    });
    document.body.appendChild(overlay);

    // Store canvases for redraw
    let canvases = [];

    async function drawAllPages() {
      canvases.forEach(c=>c.remove()); canvases = [];
      const rect = embed.getBoundingClientRect();

      for (let i=1; i<=pdf.numPages; i++) {
        const page    = await pdf.getPage(i);
        const vp      = page.getViewport({ scale });
        const canvas  = document.createElement('canvas');
        canvas.width  = vp.width; canvas.height = vp.height;
        Object.assign(canvas.style,{
          position:'absolute',
          top:`${rect.top+window.scrollY}px`, left:`${rect.left+window.scrollX}px`,
          width:`${vp.width}px`,   height:`${vp.height}px`
        });
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext:ctx,viewport:vp }).promise;

        const txt = await page.getTextContent();
        txt.items.forEach(item=>{
          const str = item.str.trim(); if(!str) return;
          styleWordsToUse.forEach(({style,words})=>{
            if (words.some(w=>w.toLowerCase()===str.toLowerCase())) {
              const [,b,,d,x,y] = item.transform;
              const h = Math.hypot(b,d)*scale;
              const w = ctx.measureText(str).width*scale;
              let color='yellow';
              const m = style.match(/(?:background|color)\s*:\s*([^;]+)/i);
              if(m) color=m[1];
              ctx.save(); ctx.globalAlpha=0.3; ctx.fillStyle=color;
              ctx.fillRect(x*scale, vp.height-y*scale-h, w, h);
              ctx.restore();
            }
          });
        });

        overlay.appendChild(canvas);
        canvases.push(canvas);
      }
    }
    function redrawAll() { drawAllPages(); }

    // Initial render
    await drawAllPages();
  })();
}