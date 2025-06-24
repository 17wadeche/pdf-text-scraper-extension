// content.js
console.log("🧩 Scraper injected on", location.href);

(async () => {
  // 1) Find PDF embed (Chrome viewer or raw <embed>)
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

  // 2) PDF path
  if (embed) {
    console.log("📄 PDF embed detected — scraping PDF text…");

    // Resolve real URL
    const orig = embed.getAttribute("original-url");
    const pdfUrl = orig || location.href;
    console.log("🚀 Fetching PDF from", pdfUrl);

    // Fetch PDF bytes via page context (CORS/cookies OK)
    let data;
    try {
      data = await fetch(pdfUrl, { credentials: "include" })
        .then((r) => r.arrayBuffer());
    } catch (err) {
      return console.error("❌ PDF fetch failed:", err);
    }

    // Load pdf.js and disable workers so we never inject blob: scripts
    const pdfjsLib = await import(chrome.runtime.getURL("pdf.mjs"));
    pdfjsLib.GlobalWorkerOptions.disableWorker = true;

    // Extract text
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    console.log(`📄 PDF has ${pdf.numPages} pages — extracting…`);
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const { items } = await page.getTextContent();
      fullText += items.map((x) => x.str).join(" ") + "\n\n";
    }

    // Inject into a textarea
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
    // 3) HTML path
    console.log("📄 No PDF detected — extracting HTML text");
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (n) =>
          n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
      }
    );
    let htmlText = "", node;
    while ((node = walker.nextNode())) {
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
