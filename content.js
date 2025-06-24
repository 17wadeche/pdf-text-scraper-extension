// content.js
console.log('PDF-Scraper injected on', location.href);

(async () => {
  // 1) find the PDF embed
  const embed = document.querySelector('embed[type*="pdf"], embed#plugin');
  if (!embed) {
    console.warn('No PDF embed found on this page');
    return;
  }

  // 2) wait until embed.real URL (original-url or src) is populated
  const pdfUrl = await new Promise(resolve => {
    const getUrl = () => embed.getAttribute('original-url') || embed.src;
    if (getUrl() && !getUrl().startsWith('about:')) {
      return resolve(getUrl());
    }
    const obs = new MutationObserver(() => {
      if (getUrl() && !getUrl().startsWith('about:')) {
        obs.disconnect();
        resolve(getUrl());
      }
    });
    obs.observe(embed, { attributes: true, attributeFilter: ['src','original-url'] });
  });

  console.log('Fetching PDF from', pdfUrl);

  // 3) fetch the PDF bytes
  let data;
  try {
    data = await fetch(pdfUrl, { credentials: 'include' }).then(r => r.arrayBuffer());
  } catch (err) {
    return console.error('Failed to fetch PDF:', err);
  }

  // 4) load pdf.js and extract text
  const { GlobalWorkerOptions, getDocument } =
    await import(chrome.runtime.getURL('pdf.mjs'));
  GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');

  const pdf = await getDocument({ data }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const { items } = await page.getTextContent();
    fullText += items.map(item => item.str).join(' ') + '\n\n';
  }

  // 5) inject a textarea with all the text
  const ta = document.createElement('textarea');
  Object.assign(ta.style, {
    position: 'fixed',
    top: '10px',
    left: '10px',
    width: '50%',
    height: '60%',
    zIndex: 2147483647,
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap'
  });
  ta.value = fullText;
  document.body.appendChild(ta);

  console.log('PDF text injected');
})();
