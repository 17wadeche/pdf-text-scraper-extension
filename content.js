// content.js
const ALLOWED_PREFIXES = [
  'https://crm.medtronic.com/sap/bc/contentserver/',
  'https://cpic1cs.corp.medtronic.com:8008/sap/bc/contentserver/',
  'https://crmstage.medtronic.com/sap/bc/contentserver/'
];
let initialized = false;
function isPdfEmbedPresent() {
  return document.querySelector(
    'embed[type="application/pdf"], embed[type="application/x-google-chrome-pdf"]'
  );
}
function esc(re) { return re.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function makeRegex(word) {
  const p = esc(word.trim());
  return new RegExp(`(?<![\\p{L}\\p{N}])(${p})(?![\\p{L}\\p{N}])`, 'giu');
}
const FORCE_TEXT_VISIBLE = ';color:#000 !important;-webkit-text-fill-color:#000 !important;';
function waitForPdfEmbed() {
  if (initialized) return;
  const embed = isPdfEmbedPresent();
  if (embed) {
    initialized = true;
    main();
  } else {
    setTimeout(waitForPdfEmbed, 200);
  }
}
if (ALLOWED_PREFIXES.some(p => location.href.startsWith(p))) {
  waitForPdfEmbed();
}
async function main() {
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
  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = chrome.runtime.getURL('pdf_viewer.css');
  document.head.appendChild(link);
  const { defaultStyleWords, config } = await import(chrome.runtime.getURL('styles.js'));
  let currentBU = localStorage.getItem('highlight_BU') || '';
  let currentOU = localStorage.getItem('highlight_OU') || '';
  let styleWordsToUse = [];
  function updateStyleWords() {
    styleWordsToUse = [];
    styleWordsToUse.push(...defaultStyleWords); 
    if (currentBU && config[currentBU]?.styleWords) {
      styleWordsToUse.push(...config[currentBU].styleWords);             // middle
    }
    if (currentBU && currentOU && config[currentBU]?.[currentOU]?.styleWords) {
      styleWordsToUse.push(...config[currentBU][currentOU].styleWords);  // ← highest
    }
    styleWordsToUse.forEach(r => r._regexes = r.words.map(makeRegex));
    console.log('[Highlight] Active BU:', currentBU);
    console.log('[Highlight] Active OU:', currentOU);
    console.log('[Highlight] Using rules:', styleWordsToUse.map(r => ({ words: r.words, style: r.style })));
  }
  updateStyleWords();
  const buSelect = document.createElement('select');
  const ouSelect = document.createElement('select');
  ouSelect.disabled = true;
  const toggle   = document.createElement('button');
  [buSelect, ouSelect].forEach(s => s.className = 'modern-select');
  toggle.textContent = 'Original';
  buSelect.innerHTML =
    `<option value="">-- Select BU --</option>` +
    Object.keys(config)
          .map(bu => `<option value="${bu}" ${bu===currentBU?'selected':''}>${bu}</option>`)
          .join('');
  function updateOuOptions() {
    ouSelect.options.length = 0;
    ouSelect.add(new Option('-- Select OU --', ''));
    const selectedBU = buSelect.value;
    if (!selectedBU) {
      ouSelect.disabled = true;
      return;
    }
    ouSelect.disabled = false;
    const ous = Object
      .keys(config[selectedBU])
      .filter(key => key !== 'styleWords');
    for (const ou of ous) {
      const opt = new Option(ou, ou);
      if (ou === currentOU) opt.selected = true;
      ouSelect.add(opt);
    }
  }
  updateOuOptions();
  function clearHighlights(scope = container) {
    scope.querySelectorAll('.styled-word').forEach(w => {
      const p = w.parentNode;
      while (w.firstChild) p.insertBefore(w.firstChild, w);
      w.remove();
    });
    scope.querySelectorAll('.word-highlight').forEach(box => box.remove());
  }
  function highlightSpan(span, rules, page) {
    const walker = document.createTreeWalker(
      span,
      NodeFilter.SHOW_TEXT,
      { acceptNode: n => n.data.trim() 
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT 
      }
    );
    const jobsByKey = Object.create(null);
    for (let textNode; (textNode = walker.nextNode()); ) {
      const text = textNode.data;
      for (const rule of rules) {
        for (const rx of rule._regexes) {
          rx.lastIndex = 0;
          let m;
          while ((m = rx.exec(text))) {
            if (!textNode.__highlightId) {
              textNode.__highlightId = Symbol();
            }
            const key = `${String(textNode.__highlightId)}|${m.index}|${m[0].length}`;
            const before = text[m.index - 1];
            const shift  = before === '*' || (before === ' ' && text[m.index - 2] === '*');
            jobsByKey[key] = {
              node:  textNode,
              start: m.index,
              end:   m.index + m[0].length,
              style: rule.style,
              shift
            };
            console.log('[Highlight] Matched:', m[0], 'with style:', rule.style);
          }
        }
      }
    }
    const jobs = Object.values(jobsByKey);
    jobs.sort((a, b) => {
      if (a.node === b.node) return b.start - a.start;
      return a.node.compareDocumentPosition(b.node) &
            Node.DOCUMENT_POSITION_FOLLOWING ? 1 : -1;
    });
    for (const { node, start, end, style } of jobs) {
      if (end > node.length) continue;
      if (/background\s*:/.test(style)) {
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd  (node, end);
        const pageRect = page.getBoundingClientRect();
        let   scale    = 1;
        const m = page.style.transform.match(/scale\(([^)]+)\)/);
        if (m) scale = parseFloat(m[1]);
        for (const r of range.getClientRects()) {
          const box = document.createElement('div');
          box.className = 'word-highlight';
          const x = (r.left - pageRect.left - 8) / scale;
          const y = (r.top  - pageRect.top - 8) / scale;
          box.style.cssText = `${style};
            position:absolute;
            left:${x}px;
            top:${y}px;
            width:${r.width  / scale}px;
            height:${r.height / scale}px;
            pointer-events:none;
            mix-blend-mode:
            multiply;z-index:5`;
            page.appendChild(box);   
        }
        range.detach();
      } else {
        const after  = node.splitText(end);
        const target = node.splitText(start);
        const wrap   = document.createElement('span');
        wrap.classList.add('styled-word');
        if (jobs.shift) wrap.classList.add('shift-left');
        wrap.className = 'styled-word';
        wrap.style.cssText = style +
          (!/color\s*:/.test(style) ? FORCE_TEXT_VISIBLE : '');
        wrap.appendChild(target.cloneNode(true));
        target.parentNode.replaceChild(wrap, target);
      }
    }
  }
  function renderAllHighlights() {
    clearHighlights(); 
    container.querySelectorAll('.page').forEach(page => {
      page.style.position = 'relative';
      page.querySelectorAll('.textLayer span').forEach(span => {
        highlightSpan(span, styleWordsToUse, page);
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
  Object.assign(buSelect.style, { position:'fixed', top:'16px', left:'16px', zIndex:2147483648 });
  Object.assign(ouSelect.style, { position:'fixed', top:'16px', left:'190px', zIndex:2147483648 });
  Object.assign(toggle.style, {
    position:'fixed', top:'16px', right:'16px',
    background:'#ff0', color:'#000', fontWeight:'bold',
    padding:'6px 12px', zIndex:2147483648, cursor:'pointer'
  });
  document.body.append(buSelect, ouSelect, toggle);
  buSelect.value = currentBU;
  updateOuOptions();
  if (currentOU) {
    ouSelect.value = currentOU;
  }
  updateStyleWords();
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
    top:   `${rect.top}px`,
    left:  `${rect.left}px`,
    width: `${rect.width}px`,
    height:`${rect.height}px`,
    overflow:'auto', 
    background:'#fff', 
    zIndex:2147483647
  });
  embed.parentNode.insertBefore(container, embed.nextSibling);
  const viewerDiv = document.createElement('div');
  viewerDiv.className = 'pdfViewer';
  container.appendChild(viewerDiv);
  window.addEventListener('resize', () => {
    const r = embed.getBoundingClientRect();
    Object.assign(container.style, {
      top:   `${r.top}px`,
      left:  `${r.left}px`,
      width: `${r.width}px`,
      height:`${r.height}px`,
    });
  });
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
  const fix = document.createElement('style');
  fix.textContent = `
    .textLayer span {
      pointer-events:auto !important;
      opacity:1 !important;
      mix-blend-mode:multiply;
    }
    .styled-word { 
      display: contents !important;
      font:inherit;
      letter-spacing: inherit !important;
    }
    .word-highlight {
      position: absolute;
      pointer-events: none;
      mix-blend-mode: multiply;  
    }
  `;
  fix.textContent += `
    .word-highlight.shift-left {
      transform: translateX(-1px);
    }
    .styled-word.shift-left {
      position: relative !important;
      left: -3px !important;
      display: inline-block !important;
    }
  `;
  document.head.appendChild(fix);
  linkService.setViewer(pdfViewer);
  await new Promise(resolve => requestAnimationFrame(resolve));
  pdfViewer.setDocument(pdfDoc);
  pdfViewer.currentScaleValue = 'page-width';
  linkService.setDocument(pdfDoc, null);
  eventBus.on('pagesloaded', () => {
    setTimeout(() => {
      renderAllHighlights();
    }, 300);
  });
  renderAllHighlights();
  eventBus.on('pagesloaded', () => {
    renderAllHighlights();
  });
  const renderedPages = new Set();
  eventBus.on('textlayerrendered', ({ pageNumber }) => {
    const pageView = pdfViewer._pages[pageNumber - 1];
    const textLayer = pageView?.textLayer?.textLayerDiv;
    if (!textLayer) return;
    Array.from(textLayer.querySelectorAll('span')).forEach(span => {
      if (!span.dataset.origStyle) {
        span.dataset.origStyle = span.getAttribute('style') || '';
      }
    });
    renderedPages.add(pageNumber);
    renderAllHighlights();
  });
  let showingStyled = true;
  toggle.onclick = () => {
    showingStyled = !showingStyled;
    if (showingStyled) {
      container.style.display = '';
      embed.style.display     = 'none';
      buSelect.style.display  = '';
      ouSelect.style.display  = '';
      renderAllHighlights();
      toggle.textContent = 'Original';
    } else {
      container.style.display = 'none';
      embed.style.display     = '';
      buSelect.style.display  = 'none';
      ouSelect.style.display  = 'none';
      toggle.textContent = 'Styled';
    }
  };
}