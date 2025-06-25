// content.js
console.log('🧩 Scraper injected on', location.href);
(async () => {
  const { default: defaultStyleWords } = await import(
    chrome.runtime.getURL('styles.js')
  );
  const commonToggleStyles = {
    position:   'fixed',
    padding:    '6px 12px',
    background: '#ff0',               // bright yellow
    color:      '#000',               // black text for contrast
    fontSize:   '14px',
    fontWeight: 'bold',
    borderRadius: '4px',
    boxShadow:  '0 0 6px rgba(0,0,0,0.5)',
    border:     '2px solid #000',
    cursor:     'pointer',
    zIndex:     2147483648,
    top:        '10px',
    left:       '10px'
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
      ...commonToggleStyles
    });
    htmlToggle.addEventListener('click', () => {
      if (htmlStyled) {
        unwrapHighlights();                // ← remove spans in-place
        htmlToggle.textContent = 'Styled HTML';
      } else {
        highlightHTML(defaultStyleWords);  // ← reapply spans
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
      ...commonToggleStyles
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
    ...commonToggleStyles
  });
  const container = document.createElement('div');
  Object.assign(container.style, {
    ...commonToggleStyles
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
    toggleBtn.textContent = visible ? 'Original PDF' : 'Styled PDF';
  });
})();
