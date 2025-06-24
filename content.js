// content.js
console.log("🧩 PDF‐Scraper injected on", location.href);

(async () => {
  /** 1) Find whichever embed your page is using **/
  let embed = null;

  // A) Chrome’s <pdf-viewer> web component
  const viewer = document.querySelector("pdf-viewer");
  if (viewer?.shadowRoot) {
    embed = viewer.shadowRoot.querySelector(
      `embed#plugin, 
       embed[type="application/x-google-chrome-pdf"],
       embed[type*="pdf"]`
    );
  }

  // B) Direct PDF page embed
  if (!embed) {
    embed = document.querySelector(
      `embed[type="application/pdf"],
       embed[type="application/x-google-chrome-pdf"]`
    );
  }

  // If neither pattern matched, bail
  if (!embed) {
    console.log("📭 No PDF embed on this page — skipping.");
    return;
  }

  /** 2) Resolve the *real* PDF URL **/
  const getUrl = () =>
    embed.getAttribute("original-url") ||
    embed.src ||
    "";

  // Wait if it’s still about:blank
  let pdfUrl = getUrl();
  if (pdfUrl.startsWith("about:")) {
    console.log("⏳ waiting for embed to pick up real URL…");
    pdfUrl = await new Promise(res => {
      const mo = new MutationObserver(() => {
        const u = getUrl();
        if (u && !u.startsWith("about:")) {
          mo.disconnect();
          res(u);
        }
      });
      mo.observe(embed, { attributes: true, attributeFilter: ["src","original-url"] });
      // Failsafe after 10s
      setTimeout(() => {
        mo.disconnect();
        res(getUrl());
      }, 10000);
    });
  }

  // Special case: if it’s STILL about:… we assume a raw-PDF page,
  // so just use location.href
  if (!pdfUrl || pdfUrl.startsWith("about:")) {
    pdfUrl = location.href;
  }

  console.log("🚀 Fetching PDF from", pdfUrl);

  /** 3) Fetch the bytes **/
  let data;
  try {
    data = await fetch(pdfUrl, { credentials: "include" })
                 .then(r => r.arrayBuffer());
  } catch (err) {
    console.error("❌ fetch failed:", err);
    return;
  }

  /** 4) Run pdf.js in the page and extract text **/
  const { GlobalWorkerOptions, getDocument } =
    await import(chrome.runtime.getURL("pdf.mjs"));
  GlobalWorkerOptions.workerSrc =
    chrome.runtime.getURL("pdf.worker.min.js");

  const pdf = await getDocument({ data }).promise;
  let fullText = "";
  console.log(`📄 PDF has ${pdf.numPages} pages, extracting…`);
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const { items } = await page.getTextContent();
    fullText += items.map(x => x.str).join(" ") + "\n\n";
  }

  /** 5) Dump it into a textarea for you to see **/
  console.log("✅ Extraction complete, injecting textarea");
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
})();
