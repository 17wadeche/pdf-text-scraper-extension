// content.js
(async () => {
  const styleTag = document.createElement('style');
  styleTag.textContent = `
    /* Theme variables */
    :root {
      --bg-color: #fff;
      --text-color: #000;
      --panel-bg: #fff;
      --panel-border: #ccc;
    }
    body.dark-mode {
      --bg-color: #222;
      --text-color: #eee;
      --panel-bg: #333;
      --panel-border: #555;
    }
    /* apply variables */
    body {
      background: var(--bg-color);
      color: var(--text-color);
    }
    .control-panel {
      position: fixed;
      top: 10px;
      left: 10px;
      width: 240px;               /* full open width */
      height: auto;
      overflow: hidden;           /* hides inner content when too small */
      transition: width 0.3s ease;
      z-index: 2147483650;
    }
    .control-panel.collapsed {
      width: 40px;                /* just enough to show the header/arrow */
    }
    .control-panel .panel-content {
      display: block;             /* always in the flow */
    }
    .control-panel .panel-header {
      white-space: nowrap;        /* keep header on one line */
    }
    .control-panel .panel-header .arrow {
      display: inline-block;
      transition: transform 0.3s ease;
    }
    /* rotate the arrow when collapsed */
    .control-panel.collapsed .panel-header .arrow {
      transform: rotate(180deg);
    }
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
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 12px;
      cursor: pointer;
      font-weight: bold;
      user-select: none;
    }
    .panel-content {
      display: flex;
      flex-direction: column;
      padding: 8px;
      gap: 8px;
    }
    .panel-content.collapsed {
      display: none;
    }
  `;
  document.head.appendChild(styleTag);
  const { defaultStyleWords, config } = await import(
    chrome.runtime.getURL('styles.js')
  );
  let currentBU = null, currentOU = null;
  try {
    if (top.GUIDE?.PE) {
      const pe = top.GUIDE.PE[top.GUIDE.PE.curPrEv];
      const primBU = pe.PartnersTable.find(
        p => p.PartnerFunction === 'BU Responsible' && p.MainPartner
      );
      const primOU = pe.PartnersTable.find(
        p => p.PartnerFunction === 'OU Responsible' && p.MainPartner
      );
      currentBU = primBU?.Name || null;
      currentOU = primOU?.Name || null;
    }
  } catch (e) { /* ignore */ }
  if (!currentBU) currentBU = localStorage.getItem('highlight_BU') || null;
  if (!currentOU) currentOU = localStorage.getItem('highlight_OU') || null;
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
  function unwrapHighlights() {
    document.querySelectorAll('span[data-highlighted]').forEach(span => {
      span.replaceWith(document.createTextNode(span.textContent));
    });
  }
  function escapeHTML(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function highlightHTML(words) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      const original = node.textContent;
      let html = escapeHTML(original);
      words.forEach(({ style, words }) => {
        words.forEach(raw => {
          const safe = raw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const re = new RegExp(`\\b(${safe})\\b`, 'gi');
          html = html.replace(re, `<span style="${style}" data-highlighted="true">$1</span>`);
        });
      });
      if (html !== escapeHTML(original)) {
        const frag = document.createRange().createContextualFragment(html);
        node.parentNode.replaceChild(frag, node);
      }
    }
  }
  let fullText = '';
  let pdfContainer = null;
  function renderPDFStyled() {
    if (!pdfContainer) return;
    pdfContainer.innerHTML = fullText
      .split('\n')
      .map(line => {
        let escaped = escapeHTML(line);
        styleWordsToUse.forEach(({ style, words }) => {
          words.forEach(raw => {
            const safe = raw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const re = new RegExp(`\\b(${safe})\\b`, 'gi');
            escaped = escaped.replace(re, `<span style="${style}">$1</span>`);
          });
        });
        return escaped;
      })
      .join('<br>');
  }
  updateStyleWords();
  const buSelect = document.createElement('select');
  buSelect.classList.add('modern-select');
  Object.keys(config).forEach(bu => {
    const opt = document.createElement('option');
    opt.value = bu;
    opt.textContent = bu;
    if (bu === currentBU) opt.selected = true;
    buSelect.appendChild(opt);
  });
  buSelect.style.padding = '4px';
  buSelect.addEventListener('change', () => {
    currentBU = buSelect.value;
    currentOU = null;
    populateOUs();
    localStorage.setItem('highlight_BU', currentBU);
    updateStyleWords();
    unwrapHighlights();
    highlightHTML(styleWordsToUse);
    renderPDFStyled();
  });
  const ouSelect = document.createElement('select');
  ouSelect.classList.add('modern-select');
  ouSelect.style.padding = '4px';
  function populateOUs() {
    ouSelect.innerHTML = '';
    if (currentBU && config[currentBU]) {
      Object.keys(config[currentBU])
        .filter(k => k !== 'styleWords')
        .forEach(ou => {
          const opt = document.createElement('option');
          opt.value = ou;
          opt.textContent = ou;
          if (ou === currentOU) opt.selected = true;
          ouSelect.appendChild(opt);
        });
      currentOU = ouSelect.value;
    }
  }
  populateOUs();
  ouSelect.addEventListener('change', () => {
    currentOU = ouSelect.value;
    localStorage.setItem('highlight_OU', currentOU);
    updateStyleWords();
    unwrapHighlights();
    highlightHTML(styleWordsToUse);
    renderPDFStyled();
  });
  let darkMode = localStorage.getItem('highlight_darkMode') === 'true';
  document.body.classList.toggle('dark-mode', darkMode);
  const panel = document.createElement('div');
  panel.classList.add('control-panel');
  Object.assign(panel.style, {
    position: 'fixed',
    top: '10px',
    left: '10px',
    zIndex: 2147483650,
    width: 'auto'
  });
  const header = document.createElement('div');
  header.classList.add('panel-header');
  header.textContent = 'Settings';
  const arrow = document.createElement('span');
  let collapsed = false;
  arrow.textContent = '▾';
  header.appendChild(arrow);
  panel.appendChild(header);
  const content = document.createElement('div');
  content.classList.add('panel-content');
  panel.appendChild(content);
  header.addEventListener('click', () => {
    collapsed = !collapsed;
    content.classList.toggle('collapsed', collapsed);
    arrow.textContent = collapsed ? '▸' : '▾';
  });
  const themeBtn = document.createElement('button');
  themeBtn.textContent = darkMode ? 'Light Mode' : 'Dark Mode';
  Object.assign(themeBtn.style, {
    padding: '4px 8px',
    cursor: 'pointer',
    borderRadius: '4px',
    border: 'none'
  });
  themeBtn.addEventListener('click', () => {
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode', darkMode);
    themeBtn.textContent = darkMode ? 'Light Mode' : 'Dark Mode';
    localStorage.setItem('highlight_darkMode', darkMode);
  });
  content.append(themeBtn, buSelect, ouSelect);
  document.body.appendChild(panel);
  const commonToggleStyles = {
    position: 'fixed',
    padding: '6px 12px',
    background: '#ff0',
    color: '#000',
    fontSize: '14px',
    fontWeight: 'bold',
    borderRadius: '4px',
    boxShadow: '0 0 6px rgba(0,0,0,0.5)',
    border: '2px solid #000',
    cursor: 'pointer',
    zIndex: 2147483648
  };
  let isHTMLContext = false;
  try { isHTMLContext = !!top.GUIDE?.PE; } catch {};
  if (isHTMLContext) {
    localStorage.setItem('highlight_BU', currentBU || '');
    localStorage.setItem('highlight_OU', currentOU || '');
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
  let embed = null;
  const viewer = document.querySelector('pdf-viewer');
  if (viewer && viewer.shadowRoot) {
    embed = viewer.shadowRoot.querySelector(
      'embed#plugin, embed[type*="pdf"]'
    );
  }
  if (!embed) {
    embed = document.querySelector(
      'embed[type="application/pdf"], embed[type="application/x-google-chrome-pdf"]'
    );
  }
  if (!embed) {
    if (
      !location.href.startsWith('https://crm.medtronic.com/sap/bc/contentserver/') &&
      !location.href.startsWith('https://cpic1cs.corp.medtronic.com:8008/sap/bc/contentserver/')
    ) {
      return;
    }
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
        panel.style.display = 'none'; 
      } else {
        highlightHTML(styleWordsToUse);
        htmlToggle.textContent = 'Original HTML';
        panel.style.display = 'block'; 
      }
      htmlStyled = !htmlStyled;
    });
    document.body.appendChild(htmlToggle);
    return;
  }
  if (
    !location.href.startsWith('https://crm.medtronic.com/sap/bc/contentserver/') &&
    !location.href.startsWith('https://cpic1cs.corp.medtronic.com:8008/sap/bc/contentserver/')
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
        panel.style.display = 'none'; 
      } else {
        highlightHTML(styleWordsToUse);
        htmlToggle.textContent = 'Original HTML';
        panel.style.display      = 'block'; 
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
    console.error('❌ PDF fetch failed:', err);
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
  console.log(`📄 PDF has ${pdf.numPages} pages — extracting…`);
  for (let i = 1; i <= pdf.numPages; i++) {
    const page        = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const lines       = extractLines(textContent);
    fullText += lines.join('\n') + '\n\n';
  }
  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = 'Original PDF';
  let showingStyled = true;
  toggleBtn.addEventListener('click', () => {
    showingStyled = !showingStyled;
    container.style.display = showingStyled ? 'block' : 'none';
    panel.style.display = 'block';
    document.body.classList.toggle('native-pdf', !showingStyled);
    toggleBtn.textContent = showingStyled
      ? 'Original PDF'
      : 'Styled PDF';
  });
  Object.assign(toggleBtn.style, {
    ...commonToggleStyles,
    top:   '10px',
    right: '10px'
  });
  const container = document.createElement('div');
  pdfContainer = container;   
  Object.assign(container.style, {
    position:   'fixed',
    top:        '50px',
    left:       '10px',
    width:      '100vw',
    height:     '100vh',
    overflow:   'auto',
    zIndex:     2147483647,
    background: '#f0f0f0',  // light grey for styled background
    border:     '2px solid #444',
    padding:    '8px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
  });
  renderPDFStyled();
  document.body.appendChild(container);
  document.body.appendChild(toggleBtn);
  embed.style.display = 'none';
  let visible = true;
  toggleBtn.addEventListener('click', () => {
    visible = !visible;
    container.style.display = visible ? 'block' : 'none';
    panel.style.display     = 'block';
    toggleBtn.textContent   = visible
      ? 'Original PDF' 
      : 'Styled PDF';
    embed.style.display = visible ? 'none' : 'block';
  });
})();
