// content.js
console.log("🔍 Scraper injected on", location.href);

(async () => {
  // 1) Do we have CRM’s <pdf-viewer> component?
  const viewer = document.querySelector("pdf-viewer");
  if (viewer?.shadowRoot) {
    console.log("🗂️  Detected <pdf-viewer> — extracting PDF text");

    // 2) Pull the embed out of its shadow DOM
    const embed = viewer.shadowRoot.querySelector("embed#plugin");
    if (!embed) {
      return console.error("❌  No #plugin embed inside <pdf-viewer>");
    }

    // 3) Get the real URL from its original-url attribute
    let pdfUrl = embed.getAttribute("original-url");
    if (!pdfUrl) {
      console.warn("⚠️  No original-url on embed, falling back to src");
      pdfUrl = embed.src;
    }
    console.log("🚀 Fetching PDF from", pdfUrl);

    // 4) Grab the bytes
    let data;
    try {
      data = await fetch(pdfUrl, { credentials: "include" }).then((r) =>
        r.arrayBuffer()
      );
    } catch (err) {
      return console.error("❌  PDF fetch failed", err);
    }

    // 5) Load pdf.js and bundle its worker into a Blob
    const pdfjsLib = await import(chrome.runtime.getURL("pdf.mjs"));
    const workerCode = await fetch(
      chrome.runtime.getURL("pdf.worker.min.js")
    ).then((r) => {
      if (!r.ok) throw new Error("Worker load failed");
      return r.text();
    });
    const blobUrl = URL.createObjectURL(
      new Blob([workerCode], { type: "application/javascript" })
    );
    pdfjsLib.GlobalWorkerOptions.workerSrc = blobUrl;

    // 6) Extract text page-by-page
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    console.log(`📄 PDF has ${pdf.numPages} pages — extracting…`);
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const { items } = await page.getTextContent();
      fullText += items.map((x) => x.str).join(" ") + "\n\n";
    }

    // 7) Show it in a big textarea
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
    // 8) No <pdf-viewer> → just scrape the DOM as plain text
    console.log("📄 No PDF viewer detected — extracting HTML text");
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (n) =>
          n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
      }
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
