// content.js
console.log("🧩 Scraper injected on", location.href);

(async () => {
  // 0) Dynamically load our styles configuration
  const { default: defaultStyleWords } = await import(
    chrome.runtime.getURL('styles.js')
  );

  // helper to escape HTML
  function escapeHTML(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // 1) Find PDF embed…
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

  // 2) PDF path
  if (embed) {
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

    // 3) Load pdf.js
    const pdfjsLib = await import(chrome.runtime.getURL("pdf.mjs"));
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      chrome.runtime.getURL("pdf.worker.mjs");

    // 4) Line‐reconstruction helper
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

    // 5) Extract text page-by-page
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    console.log(`📄 PDF has ${pdf.numPages} pages — extracting…`);

    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const lines = extractLines(textContent);
      fullText += lines.join("\n") + "\n\n";
    }

    // 6) Apply default styling and inject as HTML
    console.log("✅ Styling default keywords and injecting panel");
    const container = document.createElement("div");
    Object.assign(container.style, {
      position:   "fixed",
      top:        "10px",
      left:       "10px",
      width:      "60vw",
      height:     "70vh",
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

  } else {
    console.log("📄 No PDF detected — extracting HTML text");
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      { acceptNode: n =>
          n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
      }
    );
    let htmlText = "", node;
    while ((node = walker.nextNode())) {
      htmlText += node.nodeValue.trim() + "\n";
    }
    console.log("✅ HTML extraction complete, injecting panel");
    const ta = document.createElement("textarea");
    Object.assign(ta.style, {
      position:   "fixed",
      top:        "10px",
      left:       "10px",
      width:      "60vw",
      height:     "70vh",
      zIndex:     2147483647,
      fontFamily: "monospace",
      whiteSpace: "pre-wrap"
    });
    ta.value = htmlText;
    document.body.appendChild(ta);
  }
})();
