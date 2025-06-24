// content.js
console.log("🧩 Scraper injected on", location.href);
(async () => {
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
    console.log("📄 PDF embed detected — extracting text");
    const orig = embed.getAttribute("original-url");
    const pdfUrl = orig || location.href;
    console.log("🚀 Fetching PDF from", pdfUrl);
    let arrayBuffer;
    try {
      arrayBuffer = await fetch(pdfUrl, { credentials: "include" })
        .then(r => r.arrayBuffer());
    } catch (err) {
      return console.error("❌ PDF fetch failed:", err);
    }
    const pdfjsLib = await import(chrome.runtime.getURL("pdf.mjs"));
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      chrome.runtime.getURL("pdf.worker.mjs");
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log(`📄 PDF has ${pdf.numPages} pages — extracting…`);
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const { items } = await page.getTextContent();
      fullText += items.map(x => x.str).join(" ") + "\n\n";
    }
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
    console.log("📄 No PDF detected — extracting HTML text");
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: n =>
          n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
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
