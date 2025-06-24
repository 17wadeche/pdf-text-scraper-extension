// content.js
console.log("🧩 Scraper injected on", location.href);

(async () => {
  /** 1) Detect PDF embed **/
  let embed = null;
  const viewer = document.querySelector("pdf-viewer");
  if (viewer?.shadowRoot) {
    embed = viewer.shadowRoot.querySelector(
      `embed#plugin,
       embed[type="application/x-google-chrome-pdf"],
       embed[type*="pdf"]`
    );
  }
  if (!embed) {
    embed = document.querySelector(
      `embed[type="application/pdf"],
       embed[type="application/x-google-chrome-pdf"]`
    );
  }

  if (embed) {
    /** → PDF path **/
    const getUrl = () =>
      embed.getAttribute("original-url") ||
      embed.src ||
      "";
    let pdfUrl = getUrl();
    if (pdfUrl.startsWith("about:")) {
      console.log("⏳ waiting for embed to pick up real URL…");
      pdfUrl = await new Promise((res) => {
        const mo = new MutationObserver(() => {
          const u = getUrl();
          if (u && !u.startsWith("about:")) {
            mo.disconnect(); res(u);
          }
        });
        mo.observe(embed, {
          attributes: true,
          attributeFilter: ["src", "original-url"],
        });
        setTimeout(() => {
          mo.disconnect(); res(getUrl());
        }, 10000);
      });
    }
    if (!pdfUrl || pdfUrl.startsWith("about:")) {
      pdfUrl = location.href;
    }

    console.log("🚀 Fetching PDF from", pdfUrl);
    let data;
    try {
      data = await fetch(pdfUrl, { credentials: "include" }).then(r =>
        r.arrayBuffer()
      );
    } catch (err) {
      return console.error("❌ fetch failed:", err);
    }

    const pdfjsLib = await import(chrome.runtime.getURL("pdf.mjs"));
    const workerCode = await fetch(
      chrome.runtime.getURL("pdf.worker.min.js")
    ).then(r => {
      if (!r.ok) throw new Error("Worker failed to load");
      return r.text();
    });
    const blob = new Blob([workerCode], { type: "application/javascript" });
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);

    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let fullText = "";
    console.log(`📄 PDF has ${pdf.numPages} pages, extracting…`);
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const { items } = await page.getTextContent();
      fullText += items.map(x => x.str).join(" ") + "\n\n";
    }

    console.log("✅ PDF extraction complete, injecting textarea");
    const ta = document.createElement("textarea");
    Object.assign(ta.style, {
      position: "fixed",
      top: "10px",
      left: "10px",
      width: "60vw",
      height: "70vh",
      zIndex: 2147483647,
      fontFamily: "monospace",
      whiteSpace: "pre-wrap",
    });
    ta.value = fullText;
    document.body.appendChild(ta);
  } else {
    /** → HTML path **/
    console.log("📄 No PDF embed, scraping HTML text");
    // Collect all visible text
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: node =>
          node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
      }
    );
    let node, htmlText = "";
    while ((node = walker.nextNode())) {
      htmlText += node.nodeValue.trim() + "\n";
    }

    console.log("✅ HTML extraction complete, injecting textarea");
    const ta = document.createElement("textarea");
    Object.assign(ta.style, {
      position: "fixed",
      top: "10px",
      left: "10px",
      width: "60vw",
      height: "70vh",
      zIndex: 2147483647,
      fontFamily: "monospace",
      whiteSpace: "pre-wrap",
    });
    ta.value = htmlText;
    document.body.appendChild(ta);
  }
})();
