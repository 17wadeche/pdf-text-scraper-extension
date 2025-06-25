// content.js
console.log('🧩 Scraper injected on', location.href);
(async () => {
  const { default: defaultStyleWords } = await import(
    chrome.runtime.getURL('styles.js')
  );
  let guideObj = null;
  if (typeof top.GUIDE !== 'undefined' && top.GUIDE.PE) {
    guideObj = top.GUIDE;
  } else if (window.opener && window.opener.GUIDE && window.opener.GUIDE.PE) {
    guideObj = window.opener.GUIDE;
  }
  const pe = guideObj ? guideObj.PE[guideObj.PE.curPrEv] : null;
  let currentBU = null, currentOU = null;
  if (pe) {
    const primBUP = pe.PartnersTable.find(
      p => p.PartnerFunction === 'BU Responsible' && p.MainPartner
    );
    currentBU = primBUP ? primBUP.Name : null;
    const primOUP = pe.PartnersTable.find(
      p => p.PartnerFunction === 'OU Responsible' && p.MainPartner
    );
    currentOU = primOUP ? primOUP.Name : null;
  }
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
  if (pe) {
    const controlDiv = document.createElement('div');
    Object.assign(controlDiv.style, {
      ...commonStyles, top: '10px', left: '10px', display: 'flex', gap: '8px'
    });
    const buSelect = document.createElement('select');
    Object.assign(buSelect.style, { ...commonStyles, padding: '4px', background: '#fff', color: '#000', fontWeight: 'normal' });
    Object.keys(config).forEach(bu => {
      const opt = document.createElement('option'); opt.value = bu; opt.textContent = bu;
      if (bu === currentBU) opt.selected = true;
      buSelect.appendChild(opt);
    });
    const ouSelect = document.createElement('select');
    Object.assign(ouSelect.style, { ...commonStyles, padding: '4px', background: '#fff', color: '#000', fontWeight: 'normal' });
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
      updateStyleWords(); applyAllHighlights();
    });
    ouSelect.addEventListener('change', () => {
      currentOU = ouSelect.value;
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
      console.log('⚠️ URL not in HTML-scope — skipping HTML highlighter');
      return;
    }
    console.log('🌐 No PDF detected — styling HTML…');
    highlightHTML(defaultStyleWords);
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
      } else {
        highlightHTML(defaultStyleWords);
        htmlToggle.textContent = 'Original HTML';
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
    console.log('⚠️ PDF embed found but URL out of PDF-scope — styling HTML…');
    highlightHTML(defaultStyleWords);
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
      } else {
        highlightHTML(defaultStyleWords);
        htmlToggle.textContent = 'Original HTML';
      }
      htmlStyled = !htmlStyled;
    });
    document.body.appendChild(htmlToggle);
    return;
  }
  console.log('📄 PDF embed detected — extracting text…');
  const orig   = embed.getAttribute('original-url');
  const pdfUrl = orig || location.href;
  console.log('🚀 Fetching PDF from', pdfUrl);
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
  let fullText = '';
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
  const container = document.createElement('div');
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
  const styledHTML = fullText
    .split('\n')
    .map(line => {
      let escaped = escapeHTML(line);
      defaultStyleWords.forEach(({ style, words }) => {
        words.forEach(w => {
          const safe = w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
          const re   = new RegExp('\\b(' + safe + ')\\b', 'gi');
          escaped = escaped.replace(
            re,
            `<span style="${style}">$1</span>`
          );
        });
      });
      return escaped;
    })
    .join('<br>');
  container.innerHTML = styledHTML;
  document.body.appendChild(container);
  document.body.appendChild(toggleBtn);
  let visible = true;
  toggleBtn.addEventListener('click', () => {
    visible = !visible;
    container.style.display = visible ? 'block' : 'none';
    toggleBtn.textContent  = visible ? 'Original PDF' : 'Styled PDF';
  });
})();
