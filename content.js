// content.js
console.log('PDF-Scraper injected on', location.href);

(async () => {
  // 1) Utility to find the PDF <embed> inside the <pdf-viewer> shadow DOM
  function findPdfEmbed() {
    const viewer = document.querySelector('pdf-viewer');
    if (viewer && viewer.shadowRoot) {
      // first try the Chrome plugin ID, then any embed[type*="pdf"]
      return (
        viewer.shadowRoot.querySelector('embed#plugin') ||
        viewer.shadowRoot.querySelector('embed[type*="pdf"]')
      );
    }
    return null;
  }

  // 2) Wait until the embed shows up (or time out after 10s)
  const embed = await new Promise((resolve, reject) => {
    const existing = findPdfEmbed();
    if (existing) return resolve(existing);

    const obs = new MutationObserver(() => {
      const e = findPdfEmbed();
      if (e) {
        obs.disconnect();
        resolve(e);
      }
    });
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'original-url']
    });

    setTimeout(() => {
      obs.disconnect();
      reject(new Error('Timed out waiting for PDF embed'));
    }, 10000);
  });

  // 3) Pull the “real” URL off of original-url (or fallback to src)
  const pdfUrl = embed.getAttribute('original-url') || embed.src;
  console.log('Found PDF URL:', pdfUrl);

  // 4) Fetch it
  let data;
  try {
    data = await fetch(pdfUrl, { credentials: 'include' })
                   .then(r => r.arrayBuffer());
  } catch (err) {
    return console.error('Failed to fetch PDF:', err);
  }

  // 5) Scrape via pdf.js
  const { GlobalWorkerOptions, getDocument } =
    await import(chrome.runtime.getURL('pdf.mjs'));
  GlobalWorkerOptions.workerSrc =
    chrome.runtime.getURL('pdf.worker.min.js');

  const pdf = await getDocument({ data }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const { items } = await page.getTextContent();
    fullText += items.map(i => i.str).join(' ') + '\n\n';
  }

  // 6) Show it!
  const ta = document.createElement('textarea');
  Object.assign(ta.style, {
    position: 'fixed',
    top: '10px',
    left: '10px',
    width: '60vw',
    height: '70vh',
    zIndex: 2147483647,
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap'
  });
  ta.value = fullText;
  document.body.appendChild(ta);

  console.log('✅ PDF text injected');
})();
