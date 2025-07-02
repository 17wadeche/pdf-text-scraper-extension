// content.js

const ALLOWED_PREFIXES = [
  'https://crm.medtronic.com/sap/bc/contentserver/',
  'https://cpic1cs.corp.medtronic.com:8008/sap/bc/contentserver/',
  'https://crmstage.medtronic.com/sap/bc/contentserver/'
];
if (ALLOWED_PREFIXES.some(p => location.href.startsWith(p))) {
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
    const { defaultStyleWords, config } = await import(
      chrome.runtime.getURL('styles.js')
    );let currentBU = localStorage.getItem('highlight_BU');
  let currentOU = localStorage.getItem('highlight_OU');
  try {
    if (top.GUIDE?.PE) {
      const pe = top.GUIDE.PE[top.GUIDE.PE.curPrEv];
      currentBU = pe.PartnersTable.find(p => p.PartnerFunction === 'BU Responsible' && p.MainPartner)?.Name || currentBU;
      currentOU = pe.PartnersTable.find(p => p.PartnerFunction === 'OU Responsible' && p.MainPartner)?.Name || currentOU;
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

  // ───────────────────────────────────────────────────────────────────────────────
  // 3) Helpers for HTML‐only highlighting (unchanged)
  // ───────────────────────────────────────────────────────────────────────────────
  function escapeHTML(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function unwrapHighlights() {
    document.querySelectorAll('span[data-highlighted]').forEach(span => {
      span.replaceWith(document.createTextNode(span.textContent));
    });
  }
  function highlightHTML(words) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      const orig = node.textContent;
      let html = escapeHTML(orig);
      words.forEach(({ style, words }) => {
        words.forEach(raw => {
          const safe = raw.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
          const re = new RegExp(`\\b(${safe})\\b`,`gi`);
          html = html.replace(re, `<span style="${style}" data-highlighted="true">$1</span>`);
        });
      });
      if (html !== escapeHTML(orig)) {
        const frag = document.createRange().createContextualFragment(html);
        node.parentNode.replaceChild(frag, node);
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // 4) PDF.js text‐layer highlighting helpers
  // ───────────────────────────────────────────────────────────────────────────────
  function extractLines(textContent) {
    const rows = {};
    textContent.items.forEach(item => {
      const y = Math.round(item.transform[5]*10)/10;
      (rows[y] = rows[y]||[]).push({ x: item.transform[4], str: item.str });
    });
    return Object.keys(rows).map(Number)
      .sort((a,b)=>b-a)
      .map(y=> rows[y].sort((a,b)=>a.x-b.x).map(o=>o.str).join(' '));
  }
  function highlightTextLayer() {
    document.querySelectorAll('.pdfjs-textLayer span').forEach(span => {
      const txt = span.textContent.trim();
      styleWordsToUse.forEach(({ style, words }) => {
        words.forEach(raw => {
          if (new RegExp(`\\b${raw.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')}\\b`,`i`).test(txt)) {
            span.style.cssText += style;
          }
        });
      });
    });
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // 5) Locate the PDF embed
  // ───────────────────────────────────────────────────────────────────────────────
  const viewer = document.querySelector('pdf-viewer');
  const embed = viewer?.shadowRoot
    ? viewer.shadowRoot.querySelector('embed[type*="pdf"],embed#plugin')
    : document.querySelector('embed[type="application/pdf"],embed[type="application/x-google-chrome-pdf"]');

  if (!embed) {
    // ── HTML only ──
    highlightHTML(styleWordsToUse);
    const htmlBtn = document.createElement('button');
    htmlBtn.textContent = 'Original HTML';
    Object.assign(htmlBtn.style, {
      position:'fixed', top:'10px', right:'10px',
      padding:'6px 12px', background:'#ff0', color:'#000',
      fontWeight:'bold', zIndex:2147483648, cursor:'pointer'
    });
    document.body.appendChild(htmlBtn);
    let htmlOn = true;
    htmlBtn.onclick = () => {
      htmlOn ? unwrapHighlights() : highlightHTML(styleWordsToUse);
      htmlBtn.textContent = htmlOn ? 'Styled HTML' : 'Original HTML';
      htmlOn = !htmlOn;
    };
    return;
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // 6) PDF branch: hide native embed, replace with PDF.js viewer
  // ───────────────────────────────────────────────────────────────────────────────
  // measure where it sat
  const rect = embed.getBoundingClientRect();
  embed.style.display = 'none';

  // container for our PDF.js rendering
  const container = document.createElement('div');
  container.id = 'pdfjs-container';
  Object.assign(container.style, {
    position: 'absolute',
    top:      `${rect.top  + window.scrollY}px`,
    left:     `${rect.left + window.scrollX}px`,
    width:    `${rect.width}px`,
    height:   `${rect.height}px`,
    overflow: 'auto',
    zIndex:   2147483647,
    background:'#fff'
  });
  embed.parentNode.insertBefore(container, embed.nextSibling);

  // toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = 'Original PDF';
  Object.assign(toggleBtn.style, {
    position:'absolute',
    top:     `${rect.top - 32 + window.scrollY}px`,
    left:    `${rect.left + window.scrollX}px`,
    padding:'6px 12px', background:'#ff0', color:'#000',
    fontWeight:'bold', zIndex:2147483648, cursor:'pointer'
  });
  embed.parentNode.insertBefore(toggleBtn, container);

  // load PDF.js
  const pdfjsLib = await import(chrome.runtime.getURL('pdf.mjs'));
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs');
  let arrayBuffer;
  try {
    const origUrl = embed.getAttribute('original-url') || location.href;
    arrayBuffer = await fetch(origUrl, { credentials:'include' }).then(r=>r.arrayBuffer());
  } catch {
    console.error('Failed to fetch PDF');
    return;
  }
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale:1.2 });
    const pageWrapper = document.createElement('div');
    pageWrapper.style.position = 'relative';
    container.appendChild(pageWrapper);
    const canvas = document.createElement('canvas');
    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    pageWrapper.appendChild(canvas);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'pdfjs-textLayer';
    Object.assign(textLayerDiv.style, {
      position:'absolute', top:'0', left:'0',
      width:`${viewport.width}px`, height:`${viewport.height}px`,
      pointerEvents:'none'
    });
    pageWrapper.appendChild(textLayerDiv);
    const textContent = await page.getTextContent();
    pdfjsLib.renderTextLayer({
      textContent,
      container: textLayerDiv,
      viewport,
      textDivs: []
    });
  }
  highlightTextLayer();
  let showingStyled = true;
  toggleBtn.onclick = () => {
    showingStyled
      ? (container.style.display = 'none', embed.style.display = '')
      : (container.style.display = 'block', embed.style.display = 'none');
    toggleBtn.textContent = showingStyled ? 'Styled PDF' : 'Original PDF';
    showingStyled = !showingStyled;
  };

})();
}