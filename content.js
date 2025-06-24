// content.js
console.log("🧩 Scraper injected on", location.href);

(async () => {
  // 1) Detect PDF embed (Chrome viewer or raw <embed>)
  let embed = null;
  const viewer = document.querySelector("pdf-viewer");
  if (viewer?.shadowRoot) {
    embed = viewer.shadowRoot.querySelector("embed#plugin, embed[type*='pdf']");
  }
  if (!embed) {
    embed = document.querySelector(
      "embed[type='application/pdf'], embed[type='application/x-google-chrome-pdf']"
    );
  }

  if (embed) {
    console.log("📄 PDF embed detected — extracting text…");

    // 2) Resolve the real URL
    const orig = embed.getAttribute("original-url");
    const pdfUrl = orig || location.href;
    console.log("🚀 Fetching PDF from", pdfUrl);

    // 3) Fetch the PDF bytes
    let data;
    try {
      data = await fetch(pdfUrl, { credentials: "include" })
        .then(r => r.arrayBuffer());
    } catch (err) {
      return console.error("❌ PDF fetch failed:", err);
    }

    // 4) Load pdf.js and point at the worker
    const pdfjsLib = await import(chrome.runtime.getURL("pdf.mjs"));
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      chrome.runtime.getURL("pdf.worker.mjs");

    // 5) Utility: turn TextContent into ordered lines
    function extractLines(textContent) {
      // Group items by rounded Y coordinate:
      const rows = {};
      textContent.items.forEach(item => {
        // transform = [a, b, c, d, x, y]
        const y = Math.round(item.transform[5] * 10) / 10;
        rows[y] = rows[y] || [];
        rows[y].push({ x: item.transform[4], str: item.str });
      });

      // Sort rows top-to-bottom (largest Y first may be top on PDF coordinate)
      return Object.keys(rows)
        .map(Number)
        .sort((a, b) => b - a)
        .map(y => {
          // For each row, sort by X (left-to-right) and join
          return rows[y]
            .sort((a, b) => a.x - b.x)
            .map(o => o.str)
            .join(" ");
        });
    }

    // 6) Extract page by page
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    console.log(`📄 PDF has ${pdf.numPages} pages — extracting…`);
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const lines = extractLines(textContent);
      fullText += lines.join("\n") + "\n\n";
    }

    // 7) Inject into a textarea
    console.log("✅ PDF extraction complete, injecting textarea");
    const ta = document.createElement("textarea");
    Object.assign(ta.style, {
      position:   "fixed",
      top:        "10px",
      left:       "10px",
      width:      "60vw",
      height:     "70vh",
      zIndex:     2147483647,
      fontFamily: "monospace",
      whiteSpace: "pre-wrap",
    });
    ta.value = fullText;
    document.body.appendChild(ta);

  } else {
    // 8) Fallback: walk HTML text (unchanged)
    console.log("📄 No PDF detected — extracting HTML text");
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: n =>
          n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
      }
    );
    let htmlText = "", node;
    while (node = walker.nextNode()) {
      htmlText += node.nodeValue.trim() + "\n";
    }
    console.log("✅ HTML extraction complete, injecting textarea");
    const ta = document.createElement("textarea");
    Object.assign(ta.style, {
      position:   "fixed",
      top:        "10px",
      left:       "10px",
      width:      "60vw",
      height:     "70vh",
      zIndex:     2147483647,
      fontFamily: "monospace",
      whiteSpace: "pre-wrap",
    });
    ta.value = htmlText;
    document.body.appendChild(ta);
  }
})();
