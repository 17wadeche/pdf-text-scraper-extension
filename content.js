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
      }`
    document.head.appendChild(styleTag);
    const { defaultStyleWords, config } = await import(
      chrome.runtime.getURL('styles.js')
    );
    let currentBU = null, currentOU = null;
    try {
      if (top.GUIDE?.PE) {
        const pe = top.GUIDE.PE[top.GUIDE.PE.curPrEv];
        const primBU = pe.PartnersTable.find(p => p.PartnerFunction === 'BU Responsible' && p.MainPartner);
        currentBU = primBU?.Name || null;
        const primOU = pe.PartnersTable.find(p => p.PartnerFunction === 'OU Responsible' && p.MainPartner);
        currentOU = primOU?.Name || null;
      }
    } catch (e) {
    }
    if (!currentBU) currentBU = localStorage.getItem('highlight_BU');
    if (!currentOU) currentOU = localStorage.getItem('highlight_OU');
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
    function applyAllHighlights() {
      unwrapHighlights();
      highlightHTML(styleWordsToUse);
      renderPDFStyled();
    }
    let fullText = '';
    let pdfContainer = null;
    function renderPDFStyled() {
      if (!pdfContainer) return;
      pdfContainer.innerHTML = fullText
        .split('\n')
        .map(line => {
          let escaped = escapeHTML(line);
          styleWordsToUse.forEach(({style, words}) => {
            words.forEach(raw => {
              const safe = raw.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
              const re   = new RegExp('\\b(' + safe + ')\\b','gi');
              escaped = escaped.replace(
                re, 
                `<span style="${style}">$1</span>`
              );
            });
          });
          return escaped;
        }).join('<br>');
    }
    updateStyleWords();
    const controlDiv = document.createElement('div');
    Object.assign(controlDiv.style, {
      position:   'fixed',
      top:        '10px',
      left:       '10px',
      display:    'flex',
      gap:        '8px',
      padding:    '6px',
      background: '#fff',
      border:     '1px solid #ccc',
      zIndex:     2147483647
    });
    const buSelect = document.createElement('select');
    buSelect.classList.add('modern-select');
    buSelect.style.padding = '4px';
    Object.keys(config).forEach(bu => {
      const opt = document.createElement('option');
      opt.value       = bu;
      opt.textContent = bu;
      if (bu === currentBU) opt.selected = true;
      buSelect.appendChild(opt);
    });
    const ouSelect = document.createElement('select');
    ouSelect.classList.add('modern-select');
    function populateOUs() {
      ouSelect.innerHTML = '';
      if (currentBU && config[currentBU]) {
        Object.keys(config[currentBU])
          .filter(key => key !== 'styleWords')
          .forEach(ou => {
            const opt = document.createElement('option');
            opt.value       = ou;
            opt.textContent = ou;
            if (ou === currentOU) opt.selected = true;
            ouSelect.appendChild(opt);
          });
      }
    }
    populateOUs();
    buSelect.addEventListener('change', () => {
      currentBU = buSelect.value;
      currentOU = null;
      populateOUs();
      currentOU = ouSelect.value;
      localStorage.setItem('highlight_BU', currentBU);
      localStorage.setItem('highlight_OU', currentOU);
      updateStyleWords();
      applyAllHighlights();
    });
    ouSelect.addEventListener('change', () => {
      currentOU = ouSelect.value;
      localStorage.setItem('highlight_OU', currentOU);
      updateStyleWords();
      applyAllHighlights();
    });
    controlDiv.append(buSelect, ouSelect);
    document.body.appendChild(controlDiv);
    const commonToggleStyles = {
      position:   'fixed',
      padding:    '6px 12px',
      background: '#ff0',        // bright yellow
      color:      '#000',        // black text for contrast
      fontSize:   '14px',
      fontWeight: 'bold',
      borderRadius: '4px',
      boxShadow:  '0 0 6px rgba(0,0,0,0.5)',
      border:     '2px solid #000',
      cursor:     'pointer',
      zIndex:     2147483648,
    };
    let isHTMLContext = false;
    try { isHTMLContext = !!top.GUIDE?.PE; } catch {};
    if (isHTMLContext) {
      localStorage.setItem('highlight_BU', currentBU || '');
      localStorage.setItem('highlight_OU', currentOU || '');
      const controlDiv = document.createElement('div');
      Object.assign(controlDiv.style, {
        ...commonToggleStyles, top: '10px', left: '10px', display: 'flex', gap: '8px'
      });
      const buSelect = document.createElement('select');
      buSelect.classList.add('modern-select');
      Object.assign(buSelect.style, { ...commonToggleStyles, padding: '4px', background: '#fff', color: '#000', fontWeight: 'normal' });
      Object.keys(config).forEach(bu => {
        const opt = document.createElement('option'); opt.value = bu; opt.textContent = bu;
        if (bu === currentBU) opt.selected = true;
        buSelect.appendChild(opt);
      });
      const ouSelect = document.createElement('select');
      Object.assign(ouSelect.style, { ...commonToggleStyles, padding: '4px', background: '#fff', color: '#000', fontWeight: 'normal' });
      function populateOUs() {
        ouSelect.innerHTML = '';
        if (currentBU && config[currentBU]) {
          Object.keys(config[currentBU]).filter(k => k !== 'styleWords').forEach(ou => {
            const opt = document.createElement('option'); opt.value = ou; opt.textContent = ou;
            if (ou === currentOU) opt.selected = true;
            ouSelect.appendChild(opt);
          });
        }
      }
      populateOUs();
      buSelect.addEventListener('change', () => {
        currentBU = buSelect.value;
        currentOU = null;
        populateOUs();
        currentOU = ouSelect.value;
        localStorage.setItem('highlight_BU', currentBU);
        localStorage.setItem('highlight_OU', currentOU);
        updateStyleWords(); applyAllHighlights();
      });
      ouSelect.addEventListener('change', () => {
        currentOU = ouSelect.value;
        localStorage.setItem('highlight_OU', currentOU);
        updateStyleWords(); applyAllHighlights();
      });
      controlDiv.append(buSelect, ouSelect);
      document.body.appendChild(controlDiv);
    }
    function escapeHTML(s) {
      return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
    function unwrapHighlights() {
      document.querySelectorAll('span[data-highlighted]').forEach(span => {
        span.replaceWith(document.createTextNode(span.textContent));
      });
    }
    function highlightHTML(styleWords) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walker.nextNode()) {
        const originalText = node.textContent;
        let html = escapeHTML(originalText);
        styleWords.forEach(({ style, words }) => {
          words.forEach(raw => {
            const safe = raw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
            const re = new RegExp('\\b(' + safe + ')\\b', 'gi');
            html = html.replace(
              re,
              `<span style="${style}" data-highlighted="true">$1</span>`
            );
          });
        });
        if (html !== escapeHTML(originalText)) {
          const frag = document.createRange().createContextualFragment(html);
          node.parentNode.replaceChild(frag, node);
        }
      }
    }
    const viewer = document.querySelector('pdf-viewer');
    const embed = viewer?.shadowRoot
      ? viewer.shadowRoot.querySelector('embed[type*="pdf"], embed#plugin')
      : document.querySelector('embed[type="application/pdf"], embed[type="application/x-google-chrome-pdf"]');

    if (embed) {
      const orig   = embed.getAttribute('original-url');
      const pdfUrl = orig || location.href;
      let data;
      try {
        data = await fetch(pdfUrl, { credentials: 'include' }).then(r => r.arrayBuffer());
      } catch {
        return;
      }
      const pdfjsLib = await import(chrome.runtime.getURL('pdf.mjs'));
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs');
    } else {
      highlightHTML(styleWordsToUse);
      let htmlStyled = true;
      const htmlToggle = document.createElement('button');
      htmlToggle.textContent = 'Original HTML';
      Object.assign(htmlToggle.style, {
        ...commonToggleStyles,
        top:  '10px',
        right: '10px'
      });
      htmlToggle.addEventListener('click', () => {
        if (htmlStyled) {
          unwrapHighlights();
          htmlToggle.textContent = 'Styled HTML';
          controlDiv.style.display = 'none'; 
        } else {
          highlightHTML(styleWordsToUse);
          htmlToggle.textContent = 'Original HTML';
          controlDiv.style.display = 'flex'; 
        }
        htmlStyled = !htmlStyled;
      });
      document.body.appendChild(htmlToggle);
      return;
    }
    if (
      !location.href.startsWith('https://crm.medtronic.com/sap/bc/contentserver/') &&
      !location.href.startsWith('https://cpic1cs.corp.medtronic.com:8008/sap/bc/contentserver/') &&
      !location.href.startsWith('https://crmstage.medtronic.com/sap/bc/contentserver/')
    ) {
      highlightHTML(styleWordsToUse);
      let htmlStyled = true;
      const htmlToggle = document.createElement('button');
      htmlToggle.textContent = 'Original HTML';
      Object.assign(htmlToggle.style, {
        ...commonToggleStyles,
        top:  '10px',
        left: '10px'
      });
      htmlToggle.addEventListener('click', () => {
        if (htmlStyled) {
          unwrapHighlights();
          htmlToggle.textContent = 'Styled HTML';
          controlDiv.style.display = 'none'; 
        } else {
          highlightHTML(styleWordsToUse);
          htmlToggle.textContent = 'Original HTML';
          controlDiv.style.display = 'flex'; 
        }
        htmlStyled = !htmlStyled;
      });
      document.body.appendChild(htmlToggle);
      return;
    }
    const orig   = embed.getAttribute('original-url');
    const pdfUrl = orig || location.href;
    let data;
    try {
      data = await fetch(pdfUrl, { credentials: 'include' }).then(r => r.arrayBuffer());
    } catch (err) {
      return;
    }
    const pdfjsLib = await import(chrome.runtime.getURL('pdf.mjs'));
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      chrome.runtime.getURL('pdf.worker.mjs');
    function extractLines(textContent) {
      const rows = {};
      textContent.items.forEach(item => {
        const y = Math.round(item.transform[5] * 10) / 10;
        rows[y] = rows[y] || [];
        rows[y].push({ x: item.transform[4], str: item.str });
      });
      return Object.keys(rows)
        .map(Number)
        .sort((a, b) => b - a)
        .map(y =>
          rows[y]
            .sort((a, b) => a.x - b.x)
            .map(o => o.str)
            .join(' ')
        );
    }
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page        = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const lines       = extractLines(textContent);
      fullText += lines.join('\n') + '\n\n';
    }
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = 'Original PDF';
    Object.assign(toggleBtn.style, {
      ...commonToggleStyles,
      top:   '10px',
      right: '10px'
    });
    embed.style.display = 'none';
    const rect = embed.getBoundingClientRect();
    const container = document.createElement('div');
    pdfContainer = container;
    Object.assign(container.style, {
      position:   'absolute',
      top:        rect.top + window.scrollY + 'px',
      left:       rect.left + window.scrollX + 'px',
      width:      rect.width + 'px',
      height:     rect.height + 'px',
      overflow:   'auto',
      zIndex:     2147483647,
      background: '#f0f0f0',      // your styled background
      border:     '2px solid #444',
      padding:    '8px',
      fontFamily: 'monospace',
      whiteSpace: 'pre-wrap',
    });
    embed.parentNode.insertBefore(container, embed.nextSibling);
    renderPDFStyled();
    Object.assign(toggleBtn.style, {
      position: 'absolute',
      top:      (rect.top - 32) + window.scrollY + 'px',
      left:     rect.left + window.scrollX + 'px',
    });
    embed.parentNode.insertBefore(toggleBtn, container);
    let visible = true;
    toggleBtn.addEventListener('click', () => {
      visible = !visible;
      container.style.display = visible ? 'block' : 'none';
      toggleBtn.textContent  = visible ? 'Original PDF' : 'Styled PDF';
      controlDiv.style.display   = visible ? 'flex'  : 'none';
    });
  })();
}