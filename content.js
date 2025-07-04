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
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('pdfjs/pdf_viewer.css');
    document.head.appendChild(link);
    const { defaultStyleWords, config } = await import(
      chrome.runtime.getURL('styles.js')
    ); 
    let currentBU = localStorage.getItem('highlight_BU'),
      currentOU = localStorage.getItem('highlight_OU');
  try {
    if (top.GUIDE?.PE) {
      const pe = top.GUIDE.PE[top.GUIDE.PE.curPrEv];
      currentBU = pe.PartnersTable.find(x => x.PartnerFunction==='BU Responsible'&&x.MainPartner)?.Name || currentBU;
      currentOU = pe.PartnersTable.find(x => x.PartnerFunction==='OU Responsible'&&x.MainPartner)?.Name || currentOU;
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

  // ───────────────────────────────────────────────────────────
  // 3) Fallback HTML-only highlighter
  // ───────────────────────────────────────────────────────────
  const escapeHTML = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  function unwrapHighlights() {
    document.querySelectorAll('span[data-highlighted]').forEach(sp =>
      sp.replaceWith(document.createTextNode(sp.textContent))
    );
  }
  function highlightHTML(words) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      const orig = node.textContent, esc = escapeHTML(orig);
      let html = esc;
      words.forEach(({ style, words }) => {
        words.forEach(raw => {
          const safe = raw.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
          html = html.replace(new RegExp(`\\b(${safe})\\b`, 'gi'),
            `<span style="${style}" data-highlighted="true">$1</span>`
          );
        });
      });
      if (html !== esc) {
        node.parentNode.replaceChild(
          document.createRange().createContextualFragment(html),
          node
        );
      }
    }
  }

  // ───────────────────────────────────────────────────────────
  // 4) Import PDF.js core + viewer (same version!)
  // ───────────────────────────────────────────────────────────
  const pdfjsLib    = await import(chrome.runtime.getURL('pdfjs/pdf.mjs'));
  const pdfjsViewer = await import(chrome.runtime.getURL('pdfjs/pdf_viewer.mjs'));
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdfjs/pdf.worker.mjs');
  const { PDFViewer, EventBus } = pdfjsViewer;

  // ───────────────────────────────────────────────────────────
  // 5) Find the native <embed> (or <pdf-viewer>)
  // ───────────────────────────────────────────────────────────
  const viewerEl = document.querySelector('pdf-viewer');
  const embed = viewerEl?.shadowRoot
    ? viewerEl.shadowRoot.querySelector('embed[type*="pdf"]')
    : document.querySelector('embed[type="application/pdf"],embed[type="application/x-google-chrome-pdf"]');

  if (!embed) {
    // HTML-only
    highlightHTML(styleWordsToUse);
    const btn = document.createElement('button');
    btn.textContent = 'Original HTML';
    Object.assign(btn.style, {
      position:'fixed',top:'10px',right:'10px',
      padding:'6px 12px',background:'#ff0',color:'#000',
      fontWeight:'bold',zIndex:2147483648,cursor:'pointer'
    });
    document.body.appendChild(btn);
    let on = true;
    btn.onclick = () => {
      on ? unwrapHighlights() : highlightHTML(styleWordsToUse);
      btn.textContent = on ? 'Styled HTML' : 'Original HTML';
      on = !on;
    };
    return;
  }

  // ───────────────────────────────────────────────────────────
  // 6) PDF Branch: hide native, build PDF.js viewer
  // ───────────────────────────────────────────────────────────
  const rect = embed.getBoundingClientRect();
  embed.style.display = 'none';

  // 6a) outer scroll container
  const container = document.createElement('div');
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

  // 6b) inner viewer element
  const viewerDiv = document.createElement('div');
  viewerDiv.className = 'pdfViewer';
  container.appendChild(viewerDiv);

  // 6c) toggle button
  const toggle = document.createElement('button');
  toggle.textContent = 'Original PDF';
  Object.assign(toggle.style, {
    position:'absolute',
    top:`${rect.top-32+window.scrollY}px`,
    left:`${rect.left+window.scrollX}px`,
    padding:'6px 12px',background:'#ff0',color:'#000',
    fontWeight:'bold',zIndex:2147483648,cursor:'pointer'
  });
  embed.parentNode.insertBefore(toggle, container);

  // 6d) fetch the PDF bytes
  let data;
  try {
    const url = embed.getAttribute('original-url') || location.href;
    data = await fetch(url, { credentials:'include' }).then(r=>r.arrayBuffer());
  } catch {
    console.error('Could not fetch PDF');
    return;
  }

  // 6e) initialize PDFViewer
  const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
  const eventBus = new EventBus();
  const pdfViewer = new PDFViewer({
    container,
    viewer: viewerDiv,
    eventBus,
    textLayerMode: 2
  });
  pdfViewer.setDocument(pdfDoc);

  // 6f) apply highlights whenever a page's text layer is rendered
  eventBus.on('textlayerrendered', ({ pageNumber }) => {
    const pageView    = pdfViewer._pages[pageNumber - 1];
    const textLayerEl = pageView.textLayer.textLayerDiv;
    Array.from(textLayerEl.querySelectorAll('div')).forEach(span => {
      const txt = span.textContent.trim();
      styleWordsToUse.forEach(({ style, words }) => {
        words.forEach(raw => {
          const safe = raw.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
          if (new RegExp(`\\b${safe}\\b`, 'i').test(txt)) {
            span.style.cssText += style;
          }
        });
      });
    });
  });

  // 6g) toggle back to native embed
  let styledOn = true;
  toggle.onclick = () => {
    if (styledOn) {
      container.style.display = 'none';
      embed.style.display     = 'block';
      toggle.textContent      = 'Styled PDF';
    } else {
      container.style.display = 'block';
      embed.style.display     = 'none';
      toggle.textContent      = 'Original PDF';
    }
    styledOn = !styledOn;
  };

})();
}