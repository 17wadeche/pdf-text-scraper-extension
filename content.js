// content.js
const ALLOWED_PREFIXES = [
  'https://crm.medtronic.com/sap/bc/contentserver/',
  'https://cpic1cs.corp.medtronic.com:8008/sap/bc/contentserver/'
];
if (ALLOWED_PREFIXES.some(p => location.href.startsWith(p))){

(async () => {
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

  // 2) Load styleWords config
  const { defaultStyleWords, config } = await import(
    chrome.runtime.getURL('styles.js')
  );

  // 3) Determine BU/OU
  let currentBU = null, currentOU = null;
  try {
    if (top.GUIDE?.PE) {
      const pe = top.GUIDE.PE[top.GUIDE.PE.curPrEv];
      currentBU = pe.PartnersTable.find(p => p.PartnerFunction==='BU Responsible'&&p.MainPartner)?.Name;
      currentOU = pe.PartnersTable.find(p => p.PartnerFunction==='OU Responsible'&&p.MainPartner)?.Name;
    }
  } catch {}
  if (!currentBU) currentBU = localStorage.getItem('highlight_BU');
  if (!currentOU) currentOU = localStorage.getItem('highlight_OU');

  // 4) Build styleWordsToUse
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

  // 5) HTML‐only helpers
  function escapeHTML(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function unwrapHighlights() {
    document.querySelectorAll('span[data-highlighted]').forEach(span=>
      span.replaceWith(document.createTextNode(span.textContent))
    );
  }
  function highlightHTML(words) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      const orig = node.textContent;
      let html = escapeHTML(orig);
      words.forEach(({style,words}) => {
        words.forEach(raw => {
          const safe = raw.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
          const re = new RegExp(`\\b(${safe})\\b`,'gi');
          html = html.replace(re, `<span style="${style}" data-highlighted="true">$1</span>`);
        });
      });
      if (html !== escapeHTML(orig)) {
        const frag = document.createRange().createContextualFragment(html);
        node.parentNode.replaceChild(frag,node);
      }
    }
  }

  // 6) Build BU/OU dropdowns
  const controlDiv = document.createElement('div');
  Object.assign(controlDiv.style, {
    position:'fixed',top:'10px',left:'10px',
    display:'flex',gap:'8px',padding:'6px',
    background:'#fff',border:'1px solid #ccc',
    zIndex:2147483647
  });
  const buSelect = document.createElement('select');
  buSelect.classList.add('modern-select');
  Object.keys(config).forEach(bu => {
    const opt = document.createElement('option');
    opt.value = bu; opt.textContent = bu;
    if (bu===currentBU) opt.selected=true;
    buSelect.appendChild(opt);
  });
  const ouSelect = document.createElement('select');
  ouSelect.classList.add('modern-select');
  function populateOUs() {
    ouSelect.innerHTML='';
    if (currentBU && config[currentBU]) {
      Object.keys(config[currentBU]).filter(k=>'styleWords'!==k).forEach(ou=>{
        const opt=document.createElement('option');
        opt.value=ou; opt.textContent=ou;
        if(ou===currentOU) opt.selected=true;
        ouSelect.appendChild(opt);
      });
    }
  }
  populateOUs();
  buSelect.addEventListener('change',()=>{
    currentBU=buSelect.value; currentOU=null;
    populateOUs(); currentOU=ouSelect.value;
    localStorage.setItem('highlight_BU',currentBU);
    localStorage.setItem('highlight_OU',currentOU);
    updateStyleWords(); applyAllHighlights();
  });
  ouSelect.addEventListener('change',()=>{
    currentOU=ouSelect.value;
    localStorage.setItem('highlight_OU',currentOU);
    updateStyleWords(); applyAllHighlights();
  });
  controlDiv.append(buSelect,ouSelect);
  document.body.appendChild(controlDiv);

  // 7) PDF render + manual text layer
  let pdfContainer = null;
  async function renderPDFStyled(bytes) {
    // clone so PDF.js won’t detach our master
    const clone = new Uint8Array(bytes.buffer.slice(0));
    const pdf = await pdfjsLib.getDocument({data:clone}).promise;
    pdfContainer.innerHTML = '';

    for (let i=1; i<=pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({scale:1.5});

      // canvas
      const canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;

      // wrapper
      const wrap = document.createElement('div');
      wrap.style.position='relative';
      wrap.appendChild(canvas);

      // manual text layer
      const textLayer = document.createElement('div');
      textLayer.style.cssText = `
        position:absolute; top:0; left:0;
        width:${vp.width}px; height:${vp.height}px;
        pointer-events:none;
      `;
      wrap.appendChild(textLayer);

      const textContent = await page.getTextContent();
      textContent.items.forEach(item => {
        // transform [a,b,c,d,e,f] matrix into screen coords
        const [a,b,c,d,e,f] = item.transform;
        const x = e,         // translation x
              y = viewportToY(f, vp.height); // convert PDF y to CSS y

        const span = document.createElement('span');
        span.textContent = item.str;
        span.style.cssText = `
          position:absolute;
          left:${x}px;
          top:${y}px;
          white-space:pre;
          font-family: sans-serif;
          font-size:${Math.hypot(a,b)}px;
          transform:scaleX(${a});
          transform-origin:0 0;
        `;
        textLayer.appendChild(span);
      });

      // apply highlights on spans
      styleWordsToUse.forEach(({style,words}) => {
        words.forEach(raw => {
          const safe = raw.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
          const re = new RegExp(`\\b(${safe})\\b`,'gi');
          textLayer.querySelectorAll('span').forEach(span => {
            if (re.test(span.textContent)) span.style.cssText += style;
          });
        });
      });

      pdfContainer.appendChild(wrap);
    }
  }

  // helper to convert PDF y to CSS y
  function viewportToY(pdfY, height) {
    // PDF origin is bottom, CSS origin is top
    return height - pdfY;
  }

  function applyAllHighlights() {
    unwrapHighlights();
    highlightHTML(styleWordsToUse);
    renderPDFStyled(uint8);
  }

  // 8) Find embed
  let embed = document.querySelector('pdf-viewer embed[type*="pdf"]')
           || document.querySelector('embed[type="application/pdf"]');
  if (!embed) {
    // no PDF → HTML highlight only
    highlightHTML(styleWordsToUse);
    const btn = document.createElement('button');
    btn.textContent = 'Original HTML';
    Object.assign(btn.style, {
      position:'fixed',top:'10px',right:'10px',
      padding:'6px 12px',background:'#ff0',color:'#000',
      fontSize:'14px',fontWeight:'bold',borderRadius:'4px',
      boxShadow:'0 0 6px rgba(0,0,0,0.5)',border:'2px solid #000',
      cursor:'pointer',zIndex:2147483648
    });
    let styled=true;
    btn.addEventListener('click',()=>{
      if(styled){
        unwrapHighlights(); btn.textContent='Styled HTML'; controlDiv.style.display='none';
      } else {
        highlightHTML(styleWordsToUse); btn.textContent='Original HTML'; controlDiv.style.display='flex';
      }
      styled=!styled;
    });
    document.body.appendChild(btn);
    return;
  }

  // 9) Fetch PDF into Uint8Array once
  const pdfUrl = embed.getAttribute('original-url') || location.href;
  let arrayBuffer;
  try {
    arrayBuffer = await fetch(pdfUrl, {credentials:'include'}).then(r=>r.arrayBuffer());
  } catch(e) {
    console.error('PDF fetch failed',e);
    return;
  }
  const uint8 = new Uint8Array(arrayBuffer);

  // 10) Import pdf.js core
  const pdfjsLib = await import(chrome.runtime.getURL('pdf.mjs'));
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs');

  // 11) Build container + toggle
  pdfContainer = document.createElement('div');
  Object.assign(pdfContainer.style, {
    position:'fixed',top:'50px',left:'10px',
    width:'100vw',height:'100vh',
    overflow:'auto',zIndex:2147483647,
    background:'#f0f0f0',border:'2px solid #444',
    padding:'8px',fontFamily:'monospace',whiteSpace:'pre-wrap'
  });

  const toggleBtn = document.createElement('button');
  toggleBtn.textContent='Original PDF';
  Object.assign(toggleBtn.style, {
    position:'fixed',top:'10px',right:'10px',
    padding:'6px 12px',background:'#ff0',color:'#000',
    fontSize:'14px',fontWeight:'bold',borderRadius:'4px',
    boxShadow:'0 0 6px rgba(0,0,0,0.5)',border:'2px solid #000',
    cursor:'pointer',zIndex:2147483648
  });
  let visible=true;
  toggleBtn.addEventListener('click',()=>{
    visible=!visible;
    pdfContainer.style.display = visible?'block':'none';
    controlDiv.style.display   = visible?'flex':'none';
    toggleBtn.textContent      = visible?'Original PDF':'Styled PDF';
  });

  // 12) Initial render
  renderPDFStyled(uint8);
  document.body.appendChild(pdfContainer);
  document.body.appendChild(toggleBtn);

})();
}