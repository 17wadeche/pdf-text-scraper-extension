// content.js
console.log("🧩 Scraper injected on", location.href);
(async () => {
  if (!location.href.startsWith('https://crm.medtronic.com/sap/bc/contentserver/')) {
    console.log('⚠️ URL not in target scope—skipping scraper');
    return;
  }
  const { default: defaultStyleWords } = await import(
    chrome.runtime.getURL('styles.js')
  );
  function escapeHTML(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  let embed = null;
  const viewer = document.querySelector("pdf-viewer");
  if (viewer?.shadowRoot) {
    embed = viewer.shadowRoot.querySelector(
      "embed#plugin, embed[type*='pdf']"
    );
  }
  if (!embed) {
    embed = document.querySelector(
      "embed[type='application/pdf'], embed[type='application/x-google-chrome-pdf']"
    );
  }
  if (!embed) {
    console.log("📄 No PDF detected — skipping");
    return;
  }
  console.log("📄 PDF embed detected — extracting text…");
  const orig = embed.getAttribute("original-url");
  const pdfUrl = orig || location.href;
  console.log("🚀 Fetching PDF from", pdfUrl);
  let data;
  try {
    data = await fetch(pdfUrl, { credentials: "include" }).then(r =>
      r.arrayBuffer()
    );
  } catch (err) {
    return console.error("❌ PDF fetch failed:", err);
  }
  const pdfjsLib = await import(chrome.runtime.getURL("pdf.mjs"));
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    chrome.runtime.getURL("pdf.worker.mjs");
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
          .join(" ")
      );
  }
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  console.log(`📄 PDF has ${pdf.numPages} pages — extracting…`);
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const lines = extractLines(textContent);
    fullText += lines.join("\n") + "\n\n";
  }
  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = 'Hide Highlights';
  Object.assign(toggleBtn.style, {
    position: 'fixed',
    top: '10px',
    right: '10px',
    zIndex: 2147483648,
    padding: '4px 8px',
    background: '#444',
    color: '#fff',
    border: 'none',
    cursor: 'pointer'
  });
  const container = document.createElement("div");
  Object.assign(container.style, {
    position:   "fixed",
    top:        "50px",
    left:       "10px",
    width:      "60vw",
    height:     "65vh",
    overflow:   "auto",
    zIndex:     2147483647,
    background: "#fff",
    border:     "2px solid #444",
    padding:    "8px",
    fontFamily: "monospace",
    whiteSpace: "pre-wrap"
  });
  const html = fullText
    .split("\n")
    .map(line => {
      let escaped = escapeHTML(line);
      defaultStyleWords.forEach(({ style, words }) => {
        words.forEach(w => {
          const safe = w.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
          const re = new RegExp(`\\b(${safe})\\b`, 'gi');
          escaped = escaped.replace(
            re,
            `<span style="${style}">$1</span>`
          );
        });
      });
      return escaped;
    })
    .join("<br>");
  container.innerHTML = html;
  document.body.appendChild(container);
  document.body.appendChild(toggleBtn);
  let visible = true;
  toggleBtn.addEventListener('click', () => {
    visible = !visible;
    container.style.display = visible ? 'block' : 'none';
    toggleBtn.textContent = visible ? 'Hide Highlights' : 'Show Highlights';
  });
})();
