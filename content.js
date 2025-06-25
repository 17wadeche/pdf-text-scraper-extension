// content.js
import interact from './libs/interact.min.js';
import Choices from './libs/choices.min.js';

(async () => {
  // 1) Inject Styles (modern-select, panel, themes)
  const styleTag = document.createElement('style');
  styleTag.textContent = `
    /* modern-select */
    .modern-select {
      -webkit-appearance: none;
      appearance: none;
      padding: 6px 32px 6px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: #fff url("data:image/svg+xml;charset=UTF-8,\
<svg xmlns='http://www.w3.org/2000/svg' width='12' height='7' fill='%23666'>\
<path d='M1 1l5 5 5-5'/></svg>") no-repeat right 8px center;
      box-shadow: 0 2px 5px rgba(0,0,0,0.08);
      cursor: pointer;
      font-size: 14px;
    }
    .modern-select:focus {
      outline: none;
      border-color: #4a90e2;
      box-shadow: 0 0 0 2px rgba(74,144,226,0.3);
    }

    /* control panel */
    .control-panel {
      position: fixed;
      top: 10px; left: 10px;
      display: flex; align-items: center; gap: 8px;
      padding: 8px;
      background: var(--panel-bg, #fff);
      border: 1px solid #ccc;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 2147483647;
    }
    .control-panel.collapsed {
      height: 32px; overflow: hidden;
    }

    /* theme vars */
    body.theme-light { --panel-bg: #fff; }
    body.theme-dark  { --panel-bg: #2e2e2e; }
    body.theme-mid   { --panel-bg: #001f3f; }
  `;
  document.head.appendChild(styleTag);

  // 2) Load your config & defaults
  const { defaultStyleWords, config } = await import(
    chrome.runtime.getURL('styles.js')
  );

  // 3) State
  let currentBU = localStorage.getItem('highlight_BU') || null;
  let currentOU = localStorage.getItem('highlight_OU') || null;
  const savedTheme = localStorage.getItem('pdf-scraper-theme') || 'auto';

  // 4) Create panel
  const panel = document.createElement('div');
  panel.className = 'control-panel';
  document.body.appendChild(panel);

  // — Collapse button
  const btnCollapse = document.createElement('button');
  btnCollapse.textContent = '▼';
  btnCollapse.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('collapsed');
    btnCollapse.textContent = collapsed ? '▶' : '▼';
  });
  panel.appendChild(btnCollapse);

  // — Theme selector
  const themeSel = document.createElement('select');
  ['auto','light','dark','mid'].forEach(val => {
    const opt = new Option(val.charAt(0).toUpperCase() + val.slice(1), val);
    if (val === savedTheme) opt.selected = true;
    themeSel.add(opt);
  });
  panel.appendChild(themeSel);

  const themeChoices = new Choices(themeSel, { searchEnabled: false, shouldSort: false });
  function applyTheme(t) {
    document.body.classList.remove('theme-light','theme-dark','theme-mid');
    const resolved = t === 'auto'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : t;
    document.body.classList.add(`theme-${resolved}`);
    localStorage.setItem('pdf-scraper-theme', t);
  }
  themeSel.addEventListener('change', () => applyTheme(themeSel.value));
  applyTheme(savedTheme);

  // — BU & OU selects
  const buSel = document.createElement('select');
  const ouSel = document.createElement('select');
  buSel.className = ouSel.className = 'modern-select';
  panel.append(buSel, ouSel);

  const buChoices = new Choices(buSel, { searchEnabled: true, placeholderValue: 'BU' });
  const ouChoices = new Choices(ouSel, { searchEnabled: true, placeholderValue: 'OU' });

  function populateBUs() {
    buChoices.clearChoices();
    Object.keys(config).forEach(bu =>
      buChoices.setChoices([{ value: bu, label: bu }], 'value','label', false)
    );
  }
  function populateOUs() {
    ouChoices.clearChoices();
    const entry = config[buSel.value] || {};
    Object.keys(entry)
      .filter(k => k !== 'styleWords')
      .forEach(ou =>
        ouChoices.setChoices([{ value: ou, label: ou }], 'value','label', false)
      );
  }

  buSel.addEventListener('change', () => {
    currentBU = buSel.value;
    currentOU = null;
    localStorage.setItem('highlight_BU', currentBU);
    populateOUs();
    applyAllHighlights();
  });
  ouSel.addEventListener('change', () => {
    currentOU = ouSel.value;
    localStorage.setItem('highlight_OU', currentOU);
    applyAllHighlights();
  });

  populateBUs();
  if (currentBU) buChoices.setChoiceByValue(currentBU);
  populateOUs();
  if (currentOU) ouChoices.setChoiceByValue(currentOU);

  // 5) Make panel draggable
  interact(panel).draggable({
    listeners: {
      move(event) {
        const x = (parseFloat(panel.style.left) || 0) + event.dx;
        const y = (parseFloat(panel.style.top)  || 0) + event.dy;
        panel.style.left = `${x}px`;
        panel.style.top  = `${y}px`;
      }
    }
  });

  // 6) Highlight logic
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
      const original = node.textContent;
      let html = escapeHTML(original);
      words.forEach(({ style, words }) => {
        words.forEach(raw => {
          const safe = raw.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
          const re = new RegExp('\\b(' + safe + ')\\b','gi');
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
        let esc = escapeHTML(line);
        styleWordsToUse.forEach(({ style, words }) => {
          words.forEach(raw => {
            const safe = raw.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
            const re = new RegExp('\\b(' + safe + ')\\b','gi');
            esc = esc.replace(re, `<span style="${style}">$1</span>`);
          });
        });
        return esc;
      })
      .join('<br>');
  }

  function applyAllHighlights() {
    unwrapHighlights();
    highlightHTML(styleWordsToUse);
    renderPDFStyled();
  }

  // 7) PDF extraction & toggle
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

  // Detect embed
  let embed = null;
  const viewer = document.querySelector('pdf-viewer');
  if (viewer?.shadowRoot) {
    embed = viewer.shadowRoot.querySelector('embed#plugin, embed[type*="pdf"]');
  }
  if (!embed) {
    embed = document.querySelector('embed[type="application/pdf"], embed[type="application/x-google-chrome-pdf"]');
  }

  // Non-PDF HTML fallback
  if (!embed) {
    console.log('⚠️ No PDF embed — styling HTML…');
    updateStyleWords();
    highlightHTML(styleWordsToUse);
    let styled = true;
    const toggleHTML = document.createElement('button');
    toggleHTML.textContent = 'Original HTML';
    Object.assign(toggleHTML.style, commonToggleStyles, { top: '10px', right: '10px' });
    toggleHTML.addEventListener('click', () => {
      if (styled) {
        unwrapHighlights();
        toggleHTML.textContent = 'Styled HTML';
        panel.style.display = 'none';
      } else {
        highlightHTML(styleWordsToUse);
        toggleHTML.textContent = 'Original HTML';
        panel.style.display = 'flex';
      }
      styled = !styled;
    });
    document.body.appendChild(toggleHTML);
    return;
  }

  // PDF extraction
  console.log('📄 PDF embed detected — extracting text…');
  const pdfUrl = embed.getAttribute('original-url') || location.href;
  console.log('🚀 Fetching PDF from', pdfUrl);
  let data;
  try {
    data = await fetch(pdfUrl, { credentials: 'include' }).then(r => r.arrayBuffer());
  } catch (err) {
    console.error('❌ PDF fetch failed:', err);
    return;
  }
  const pdfjsLib = await import(chrome.runtime.getURL('pdf.mjs'));
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs');

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
      .map(y => rows[y].sort((a, b) => a.x - b.x).map(o => o.str).join(' '));
  }

  const pdf = await pdfjsLib.getDocument({ data }).promise;
  console.log(`📄 PDF has ${pdf.numPages} pages — extracting…`);
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const lines = extractLines(textContent);
    fullText += lines.join('\n') + '\n\n';
  }

  // Styled PDF container & toggle
  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = 'Original PDF';
  Object.assign(toggleBtn.style, commonToggleStyles, { top: '10px', right: '10px' });

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
    background: '#f0f0f0',
    border:     '2px solid #444',
    padding:    '8px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
  });

  renderPDFStyled();
  document.body.appendChild(container);
  document.body.appendChild(toggleBtn);

  let visible = true;
  toggleBtn.addEventListener('click', () => {
    visible = !visible;
    container.style.display = visible ? 'block' : 'none';
    toggleBtn.textContent = visible ? 'Original PDF' : 'Styled PDF';
    panel.style.display = visible ? 'flex' : 'none';
  });

  // Initial highlights
  updateStyleWords();
  applyAllHighlights();

})();
