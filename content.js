// content.js
console.log("🧩 Scraper injected on", location.href);

(async () => {
  // 1) Look for a PDF embed (viewer or raw):
  let embed = null;

  // A) Chrome’s <pdf-viewer> component
  const viewer = document.querySelector("pdf-viewer");
  if (viewer?.shadowRoot) {
    embed = viewer.shadowRoot.querySelector(
      "embed#plugin, embed[type*='pdf']"
    );
  }

  // B) Raw <embed type="application/pdf">
  if (!embed) {
    embed = document.querySelector(
      "embed[type='application/pdf'], embed[type='application/x-google-chrome-pdf']"
    );
  }

  // 2) If we found one, it’s a PDF page → fetch & parse via pdf.js
  if (embed) {
    // Pick the real URL
    const orig = embed.getAttribute("original-url");
    let pdfUrl;
    if (orig) {
      pdfUrl = orig;
    } else if (
      embed.src &&
      !embed.src.startsWith("about:") &&
      !embed.src.startsWith("chrome-extension://")
    ) {
      pdfUrl = embed.src;
    } else {
      pdfUrl = location.href;
    }

    console.log("🚀 Fetching PDF from", pdfUrl);

    // Fetch bytes
    let arrayBuffer;
    try {
      arrayBuffer = await fetch(pdfUrl, { credentials: "include" })
        .then((r) => r.arrayBuffer());
    } catch (err) {
      return console.error("❌ PDF fetch failed:", err);
    }
    const pdfjsLib = await import(chrome.runtime.getURL("pdf.mjs"));
    const workerCode = await fetch(
      chrome.runtime.getURL("pdf.worker.min.js")
    ).then((r) => {
      if (!r.ok) throw new Error("Worker failed to load");
      return r.text();
    });
    const blobUrl = URL.createObjectURL(
      new Blob([workerCode], { type: "application/javascript" })
    );
    pdfjsLib.GlobalWorkerOptions.workerSrc = blobUrl;

    // Extract text
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log(`📄 PDF has ${pdf.numPages} pages — extracting…`);
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const { items } = await page.getTextContent();
      fullText += items.map((x) => x.str).join(" ") + "\n\n";
    }

    // Inject as textarea
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
    // 3) No PDF embed → walk HTML
    console.log("📄 No PDF detected — extracting HTML text");
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      { acceptNode: n => n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT
                                            : NodeFilter.FILTER_REJECT }
    );
    let htmlText = "";
    let node;
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
