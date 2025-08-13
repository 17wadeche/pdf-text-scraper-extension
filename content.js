// content.js
const ALLOWED_PREFIXES = [
  'https://cpic1cs.corp.medtronic.com:8008/sap/bc/contentserver/',
  'https://crmstage.medtronic.com/sap/bc/contentserver/',
  "https://crm.medtronic.com/sap/bc/contentserver/"
];
(function offerOpenStyledButton() {
  if (location.hash !== '#noaft') return;
  if (!urlIsAllowed(location.href.replace(/#noaft$/, ''))) return;
  function injectButton() {
    if (document.getElementById('__aft_open_styled')) return;
    const btn = document.createElement('button');
    btn.id = '__aft_open_styled';
    btn.textContent = 'Open Styled';
    btn.style.cssText = `
      position:fixed; top:16px; right:16px;
      z-index:2147483647; padding:6px 12px;
      background:#ff0; color:#000; font-weight:bold;
      cursor:pointer; border:1px solid #888; border-radius:4px;
    `;
    btn.onclick = () => {
      const extViewerBase = chrome.runtime.getURL('viewer.html');
      const pdfUrl = location.href.replace(/#noaft$/, '');
      location.href = extViewerBase + '?src=' + encodeURIComponent(pdfUrl);
    };
    document.body.appendChild(btn);
  }
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', injectButton, { once: true });
  } else {
    injectButton();
  }
  return;
})();
(function redirectIfPluginPdf() {
  try {
    const extViewerBase = chrome.runtime.getURL('viewer.html');
    if (location.href.startsWith(extViewerBase)) return;
    if (window.__AFT_FROM_VIEWER) return;
    if (!urlIsAllowed()) return;
    if (location.hash === '#noaft') return;
    if ((document.contentType || '').toLowerCase() === 'application/pdf') {
      const target = extViewerBase + '?src=' + encodeURIComponent(location.href);
      location.replace(target);
    }
  } catch (err) {
    console.warn('[AFT] redirect shim error:', err);
  }
})();
function urlIsAllowed(href = location.href) {
  return ALLOWED_PREFIXES.some(p => href.startsWith(p));
}
let initialized = false;
let prevActiveWordsSet = new Set();
let activeWordsSet     = new Set();
let newWordsSet        = new Set();
let pulseMode          = false;
let customRules = [];
let includeCustom = true;
try {
  customRules = JSON.parse(localStorage.getItem('highlight_custom_rules') || '[]');
  if (!Array.isArray(customRules)) customRules = [];
} catch { customRules = []; }
function findPdfHostElements() {
  let embedEl = document.querySelector('embed[type*="pdf"],object[type*="pdf"]');
  let viewerEl = document.querySelector('pdf-viewer');
  if (viewerEl && !embedEl) {
    try {
      const sr = viewerEl.shadowRoot;
      if (sr) {
        embedEl = sr.querySelector('embed[type*="pdf"],object[type*="pdf"]') || null;
      }
    } catch { }
  }
  return { viewerEl, embedEl };
}
function startWhenReady() {
  if (location.hash === '#noaft') return;
  if (initialized) return;
  const fromViewer = !!window.__AFT_FROM_VIEWER;
  if (!fromViewer && !urlIsAllowed()) return;
  const host = fromViewer ? {} : findPdfHostElements();
  if (fromViewer) {
    initialized = true;
    main(host, window.__AFT_FETCH_URL || undefined);
    return;
  }
  if (host.viewerEl || host.embedEl) {
    initialized = true;
    main(host);
    return;
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (document.contentType === 'application/pdf') {
      initialized = true;
      main(host);   // host may be nulls; main can handle
    }
    return;
  }
  setTimeout(startWhenReady, 200);
}
startWhenReady();
function normWord(w) { return w.trim().toLowerCase(); }
function esc(re) { return re.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function makeRegex(word) {
  const w = word.trim().toLowerCase();
  let pattern;
  if (/[^aeiou]y$/.test(w)) {
    const stem = esc(w.slice(0, -1));
    pattern = `${stem}(?:y|ies)`;
  } else if (/[^aeiou]ies$/.test(w)) {
    const stem = esc(w.slice(0, -3));
    pattern = `${stem}(?:y|ies)`;
  } else if (/(?:ch|sh|x|s|z|o)$/.test(w)) {
    pattern = esc(w) + '(?:es)?';
  } else if (/(?:ches|shes|xes|ses|zes|oes)$/.test(w)) {
    pattern = esc(w.replace(/es$/, '')) + '(?:es)?';
  } else if (/ed$/.test(w)) {                 // word **already ends in -ed**
    const stem = esc(w.slice(0, -2));         // resolv
    pattern = `${stem}(?:e?d?)?`;             // resolv | resolve | resolved
  } else if (/e$/.test(w)) {                  // word ends in **lone e** (resolve)
    pattern = esc(w) + '(?:s|d)?';                // resolve | resolved
  } else if (w.endsWith('s')) {
    pattern = esc(w.slice(0, -1)) + 's?';
  } else {
    pattern = esc(w) + '(?:s|ed)?';
  }
  return new RegExp(`(?<![\\p{L}\\p{N}])(${pattern})(?![\\p{L}\\p{N}])`, 'giu');
}
const FORCE_TEXT_VISIBLE = ';color:#000 !important;-webkit-text-fill-color:#000 !important;';
const CSS_COLOR_KEYWORDS = [
  'aliceblue','antiquewhite','aqua','aquamarine','azure','beige','bisque','black',
  'blanchedalmond','blue','blueviolet','brown','burlywood','cadetblue','chartreuse',
  'chocolate','coral','cornflowerblue','cornsilk','crimson','cyan','darkblue','darkcyan',
  'darkgoldenrod','darkgray','darkgreen','darkgrey','darkkhaki','darkmagenta','darkolivegreen',
  'darkorange','darkorchid','darkred','darksalmon','darkseagreen','darkslateblue','darkslategray',
  'darkslategrey','darkturquoise','darkviolet','deeppink','deepskyblue','dimgray','dimgrey',
  'dodgerblue','firebrick','floralwhite','forestgreen','fuchsia','gainsboro','ghostwhite','gold',
  'goldenrod','gray','green','greenyellow','grey','honeydew','hotpink','indianred','indigo','ivory',
  'khaki','lavender','lavenderblush','lawngreen','lemonchiffon','lightblue','lightcoral',
  'lightcyan','lightgoldenrodyellow','lightgray','lightgreen','lightgrey','lightpink','lightsalmon',
  'lightseagreen','lightskyblue','lightslategray','lightslategrey','lightsteelblue','lightyellow',
  'lime','limegreen','linen','magenta','maroon','mediumaquamarine','mediumblue','mediumorchid',
  'mediumpurple','mediumseagreen','mediumslateblue','mediumspringgreen','mediumturquoise',
  'mediumvioletred','midnightblue','mintcream','mistyrose','moccasin','navajowhite','navy',
  'oldlace','olive','olivedrab','orange','orangered','orchid','palegoldenrod','palegreen',
  'paleturquoise','palevioletred','papayawhip','peachpuff','peru','pink','plum','powderblue',
  'purple','rebeccapurple','red','rosybrown','royalblue','saddlebrown','salmon','sandybrown',
  'seagreen','seashell','sienna','silver','skyblue','slateblue','slategray','slategrey','snow',
  'springgreen','steelblue','tan','teal','thistle','tomato','turquoise','violet','wheat','white',
  'whitesmoke','yellow','yellowgreen'
];
function parseStyleToFields(styleStr) {
  const s = styleStr.toLowerCase();
  if (/\btext-decoration-line\s*:\s*underline\b/.test(s) || /\btext-decoration\b[^;]*underline/.test(s)) {
    const m = /text-decoration-color\s*:\s*([^;]+)/i.exec(styleStr) ||
              /text-decoration\s*:[^;]*\b([^;\s]+)\s*$/i.exec(styleStr);
    return {prop:'underline', color:(m?m[1].trim():'red')};
  }
  const bg = /background\s*:\s*([^;]+)/i.exec(styleStr);
  if (bg) return {prop:'background', color:bg[1].trim()};
  const col = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(styleStr);
  if (col) return {prop:'color', color:col[1].trim()};
  return {prop:'background', color:'yellow'}; // default
}
function buildStyleFromFields(prop, color) {
  if (prop === 'underline') {
    return `text-decoration-line:underline;text-decoration-style:wavy;text-decoration-color:${color};text-decoration-thickness:auto;`;
  }
  const cssProp = (prop === 'color') ? 'color' : 'background';
  return `${cssProp}:${color};`;
}
function normalizeRuleFromStorage(r) {
  if (!r || typeof r !== 'object') return null;
  let words = Array.isArray(r.words) ? r.words.slice() : [];
  if (!words.length && typeof r.word === 'string') words = [r.word];
  let prop = r.prop, color = r.color, style = r.style;
  if (!style) style = buildStyleFromFields(prop || 'background', color || 'yellow');
  ({prop, color} = parseStyleToFields(style)); // ensure
  return {
    id: r.id || (Date.now().toString(36) + Math.random().toString(36).slice(2)),
    words,
    prop,
    color,
    style: buildStyleFromFields(prop, color)
  };
}
function getPageScale(pageEl) {
  let scale = 1;
  const m = pageEl?.style?.transform?.match(/scale\(([^)]+)\)/);
  if (m) scale = parseFloat(m[1]) || 1;
  return scale;
}
function flashRectsOnPage(pageEl, rects) {
  const pageRect = pageEl.getBoundingClientRect();
  const scale = getPageScale(pageEl);
  const overlays = [];
  rects.forEach(r => {
    const box = document.createElement('div');
    box.className = 'aft-ql-flash';
    const x = (r.left - pageRect.left - 8) / scale;
    const y = (r.top  - pageRect.top  - 8) / scale;
    box.style.left   = `${x}px`;
    box.style.top    = `${y}px`;
    box.style.width  = `${r.width / scale}px`;
    box.style.height = `${r.height / scale}px`;
    pageEl.appendChild(box);
    overlays.push(box);
  });
  setTimeout(() => overlays.forEach(o => o.remove()), 1600);
}
function findFirstMatchRangeInSpan(span, needleLC) {
  if (!span || !span.firstChild || span.firstChild.nodeType !== Node.TEXT_NODE) return null;
  const text = span.textContent || '';
  const idx = text.toLowerCase().indexOf(needleLC);
  if (idx < 0) return null;
  const rng = document.createRange();
  rng.setStart(span.firstChild, idx);
  rng.setEnd(span.firstChild, idx + needleLC.length);
  return rng;
}
function scrollToPage(pageEl) {
  if (!pageEl) return;
  const top = pageEl.offsetTop - 24;
  container.scrollTo({ top, behavior: 'smooth' });
}
function persistCustomRules() {
  const storageShape = customRules.map(r => ({style:r.style, words:r.words}));
  localStorage.setItem('highlight_custom_rules', JSON.stringify(storageShape));
}
function rebuildRuleStyles() {
  customRules.forEach(r => { r.style = buildStyleFromFields(r.prop, r.color); });
}
customRules = customRules
  .map(normalizeRuleFromStorage)
  .filter(Boolean);
async function main(host = {}, fetchUrlOverride) {
  const { viewerEl = null, embedEl = null } = host;
  function getPageScale(pageEl) {
    let scale = 1;
    const m = pageEl?.style?.transform?.match(/scale\(([^)]+)\)/);
    if (m) scale = parseFloat(m[1]) || 1;
    return scale;
  }
  function flashRectsOnPage(pageEl, rects) {
    const pageRect = pageEl.getBoundingClientRect();
    const scale = getPageScale(pageEl);
    const overlays = [];
    rects.forEach(r => {
      const box = document.createElement('div');
      box.className = 'aft-ql-flash';
      const x = (r.left - pageRect.left - 8) / scale;
      const y = (r.top  - pageRect.top  - 8) / scale;
      box.style.left   = `${x}px`;
      box.style.top    = `${y}px`;
      box.style.width  = `${r.width / scale}px`;
      box.style.height = `${r.height / scale}px`;
      pageEl.appendChild(box);
      overlays.push(box);
    });
    setTimeout(() => overlays.forEach(o => o.remove()), 1600);
  }
  function getRangeForPhraseInSpan(span, phrase) {
    if (!span) return null;
    const needleLC = (phrase || '').toLowerCase();
    if (!needleLC) return null;
    const walker = document.createTreeWalker(
      span,
      NodeFilter.SHOW_TEXT,
      { acceptNode: n => n.data ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
    );
    const nodes = [];
    const lengths = [];
    let full = '';
    for (let n; (n = walker.nextNode()); ) {
      const t = n.data;
      nodes.push(n);
      lengths.push(t.length);
      full += t;
    }
    if (!full) return null;
    const haystack = full.toLowerCase();
    const idx = haystack.indexOf(needleLC);
    if (idx < 0) return null;
    const endPos = idx + needleLC.length;
    let pos = 0;
    let startNode = null, startOffset = 0;
    let endNode = null, endOffset = 0;
    for (let i = 0; i < nodes.length; i++) {
      const len = lengths[i];
      if (!startNode && idx < pos + len) {
        startNode = nodes[i];
        startOffset = idx - pos;
      }
      if (endPos <= pos + len) {
        endNode = nodes[i];
        endOffset = endPos - pos;
        break;
      }
      pos += len;
    }
    if (!startNode || !endNode) return null;
    const clamp = (node, off) => Math.max(0, Math.min(off, (node.data || '').length));
    const rng = document.createRange();
    rng.setStart(startNode, clamp(startNode, startOffset));
    rng.setEnd(endNode, clamp(endNode, endOffset));
    return rng;
  }
  function getFirstTextNode(el) {
    const walker = document.createTreeWalker(
      el,
      NodeFilter.SHOW_TEXT,
      { acceptNode: n => n.data ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
    );
    return walker.nextNode();
  }
  function scrollToLocalY(pageEl, yLocal) {
    const target = pageEl.offsetTop + Math.max(0, yLocal - 60);
    container.scrollTo({ top: target, behavior: 'smooth' });
  }
  function collectMatchesOnPage(pageEl, phrase) {
    if (!phrase) return [];
    const pageRect = pageEl.getBoundingClientRect();
    const scale = getPageScale(pageEl);
    const isNonWord = s => /^[^\p{L}\p{N}]+$/u.test(s || "");
    const tokenAlts = t => (t === "and" ? ["and", "&"] : [t]);
    const toLC = s => (s || "").toLowerCase();
    const spans = pageEl.querySelectorAll(".textLayer span");
    const results = [];
    for (const s of spans) {
      const tn = getFirstTextNode(s);
      if (!tn) continue;
      const lc = toLC(s.textContent || "");
      let idx = 0, needle = toLC(phrase);
      while (needle && (idx = lc.indexOf(needle, idx)) !== -1) {
        const rng = document.createRange();
        rng.setStart(tn, idx);
        rng.setEnd(tn, Math.min(idx + needle.length, tn.length));
        const rects = Array.from(rng.getClientRects()).filter(r => r.width && r.height);
        try { rng.detach?.(); } catch {}
        if (rects.length) results.push(rects);
        idx = needle.length;
      }
    }
    const allSpans = Array.from(spans);
    const tokens = toLC(phrase).trim().split(/\s+/).filter(Boolean);
    if (tokens.length) {
      let i = 0;
      while (i < allSpans.length) {
        let j = i, pos = 0, k = 0;
        const ranges = [];
        while (k < tokens.length && j < allSpans.length) {
          const span = allSpans[j];
          const lc = toLC(span.textContent || "");
          const tn = getFirstTextNode(span);
          if (!tn || !lc.trim()) { j++; pos = 0; continue; }
          let foundHere = false;
          for (const alt of tokenAlts(tokens[k])) {
            const rx = new RegExp(`(?<![\\p{L}\\p{N}])${alt.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\$&")}(?![\\p{L}\\p{N}])`, "u");
            const sub = lc.slice(pos);
            const m = rx.exec(sub);
            if (m) {
              const hit = pos + m.index;
              const r = document.createRange();
              r.setStart(tn, hit);
              r.setEnd(tn, Math.min(hit + alt.length, tn.length));
              ranges.push(r);
              pos = hit + alt.length;
              k++;
              foundHere = true;
              break;
            }
          }
          if (foundHere) continue;
          const tail = lc.slice(pos).trim();
          if (!tail || isNonWord(tail) || /^-+$/.test(tail)) { j++; pos = 0; continue; }
          ranges.forEach(r => { try { r.detach?.(); } catch {} });
          i++; j = i; pos = 0; k = 0; ranges.length = 0;
        }
        if (k === tokens.length) {
          const rects = [];
          for (const r of ranges) {
            rects.push(...Array.from(r.getClientRects()).filter(rr => rr.width && rr.height));
            try { r.detach?.(); } catch {}
          }
          if (rects.length) results.push(rects);
          i = j; // continue after the match we just consumed
        }
      }
    }
    results.sort((a, b) => a[0].top - b[0].top);
    return results;
  }
  function flashMatchOnPage(pageEl, phrase, { afterY = -Infinity } = {}) {
    const pageRect = pageEl.getBoundingClientRect();
    const scale = getPageScale(pageEl);
    const hits = collectMatchesOnPage(pageEl, phrase);
    if (!hits.length) return { ok:false };
    const pick = hits.find(rects => ((rects[0].top - pageRect.top - 8) / scale) > (afterY + 1)) || hits[0];
    const yLocal = (pick[0].top - pageRect.top - 8) / scale;
    container.scrollTo({ top: pageEl.offsetTop + Math.max(0, yLocal - 60), behavior: "smooth" });
    flashRectsOnPage(pageEl, pick);
    const wrapped = !(hits.find(rects => ((rects[0].top - pageRect.top - 8) / scale) > (afterY + 1)));
    return { ok:true, yLocal, wrapped };
  }
  const normalize = s => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const pageTextCache = new Map();
  async function getPageText(pageNumber) {
    const cached = pageTextCache.get(pageNumber);
    if (cached) {
      return typeof cached.then === "function" ? await cached : cached;
    }
    const pending = (async () => {
      const page = await pdfDoc.getPage(pageNumber);
      const tc = await page.getTextContent();
      return normalize(tc.items.map(it => it.str || "").join(" "));
    })();
    pageTextCache.set(pageNumber, pending);
    const text = await pending;
    pageTextCache.set(pageNumber, text);
    return text;
  }
  async function findFirstPageFor(label) {
    const needle = normalize(label);
    for (let n = 1; n <= pdfDoc.numPages; n++) {
      const text = await getPageText(n);
      if (text.includes(needle)) return n;
    }
    return null;
  }
  async function findPageNumberByPhrase(phrase) {
    const needle = normalize(phrase);
    for (let n = 1; n <= pdfDoc.numPages; n++) {
      const text = await getPageText(n);
      if (text.includes(needle)) return n;
    }
    return null;
  }
  function ensureTextLayerRendered(pageNumber) {
    const pv = pdfViewer._pages?.[pageNumber - 1];
    if (!pv) return Promise.resolve();
    if (pv.textLayer && pv.textLayer.renderingDone) return Promise.resolve();
    return new Promise(resolve => {
      const on = ({ pageNumber: num }) => {
        if (num === pageNumber) {
          eventBus.off("textlayerrendered", on);
          resolve();
        }
      };
      eventBus.on("textlayerrendered", on);
    });
  }
  function waitForPageReady(pageNumber, timeout = 1000) {
    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        eventBus.off('textlayerrendered', onText);
        eventBus.off('pagerendered', onPage);
        clearTimeout(to);
        resolve();
      };
      const onText = ({ pageNumber: n }) => { if (n === pageNumber) finish(); };
      const onPage = ({ pageNumber: n }) => { if (n === pageNumber) finish(); };
      const pv = pdfViewer?._pages?.[pageNumber - 1];
      if (pv && pv.textLayer?.renderingDone) return resolve();
      eventBus.on('textlayerrendered', onText);
      eventBus.on('pagerendered', onPage);
      const to = setTimeout(finish, timeout); // best-effort fallback
    });
  }
  async function jumpTo({ pageNumber, phrase, afterY }) {
    if (!pageNumber && phrase) {
      pageNumber = await findPageNumberByPhrase(phrase);
    }
    if (!pageNumber) return false;
    pdfViewer.scrollPageIntoView({ pageNumber });
    await ensureTextLayerRendered(pageNumber);
    const page =
      pdfViewer._pages?.[pageNumber - 1]?.div ||
      container.querySelector(`.page[data-page-number="${pageNumber}"]`);
    if (!page) return true;
    if (!phrase) return true;
    return flashMatchOnPage(page, phrase, { afterY }).ok;
  }
  async function jumpToPhrase(phrase, opts = {}) {
    const pageNumber = await findPageNumberByPhrase(phrase);
    if (!pageNumber) return false;
    pdfViewer.scrollPageIntoView({ pageNumber });
    await ensureTextLayerRendered(pageNumber);
    const page =
      pdfViewer._pages?.[pageNumber - 1]?.div ||
      container.querySelector(`.page[data-page-number="${pageNumber}"]`);
    if (!page) return true; 
    return flashMatchOnPage(page, phrase, opts).ok;
  }
  let container = null;
  window.__AFT_VERSION = '0.1.3d';
  console.log('[AFT] init v' + window.__AFT_VERSION, location.href);
  const AFT_UI_Z = 21474837000;
  const styleTag = document.createElement('style');
  const QUICK_LINKS = [
    'Device Summary',
    'Reason for Transmission',
    'Alert and Event Summary',
    'Observations',
    'Notable Data Section',
    'Notes',
    'Device Status',
    'Episodes List',
    'Other Hardware Notes',
    'CareAlert Event List'
  ];
  styleTag.textContent = `
    .aft-ql-flash { pointer-events: none; }
    .modern-select {
      color: #000;
      -webkit-appearance: none;
      appearance: none;
      padding: 6px 32px 6px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      background-color: #fff;
      font-size: 14px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.08);
      cursor: pointer;
      background-repeat: no-repeat;
      background-position: right 8px center;
      background-image: url("data:image/svg+xml;charset=UTF-8,\
<svg xmlns='http://www.w3.org/2000/svg' width='12' height='7' fill='%23666'>\
<path d='M1 1l5 5 5-5'/></svg>");
    }
    .modern-select:focus {
      outline: none;
      border-color: #4a90e2;
      box-shadow: 0 0 0 2px rgba(74,144,226,0.3);
    }
      #aftCustomPanel {
  border-radius: 10px;
  padding: 12px;
  background: #fff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  font-family: system-ui, sans-serif;
  font-size: 13px;
  width: 400px;
}
#aftCustomPanel input[type="text"],
#aftCustomPanel select {
  font-size: 13px;
  padding: 5px 6px;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 100%;
  box-sizing: border-box;
}
#aftCustomPanel input[type="color"] {
  width: 20px;
  height: 30px;
  border: none;
  background: none;
  padding: 0;
}
#aftCustomPanel button {
  font-size: 12px;
  padding: 4px 10px;
  border: 1px solid #888;
  border-radius: 4px;
  background: #f3f3f3;
  cursor: pointer;
  transition: background 0.2s ease;
}
#aftCustomPanel button:hover {
  background: #e0e0e0;
}
#aftCustomPanel hr {
  border: none;
  border-top: 1px solid #eee;
  margin: 8px 0;
}
.aft-row {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.aft-row > * {
  flex: 1;
  min-width: 0;
}
.aft-row.actions {
  justify-content: flex-end;
  margin-top: 4px;
}
  #aftQuickLinks {
    margin-top: 8px;
  }
  #aftQuickLinksHeader {
    font-weight: bold;
    margin: 8px 0 4px;
  }
  .aft-ql-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
  }
  .aft-ql-btn { width: 100%; }
  .aft-ql-btn {
    display: inline-block;
    padding: 6px 8px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: #fff;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0,0,0,.06);
    transition: transform .04s ease, background .15s ease, border-color .15s ease;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }
  .aft-ql-btn:hover {
    background: #f7f9ff;
    border-color: #cfe0ff;
    transform: translateY(-1px);
  }
  .aft-ql-notfound {
    opacity: .7;
  }
  /* Flash highlight for quick-jump */
  .aft-ql-flash {
    position: absolute;
    pointer-events: none;
    background: rgba(255, 235, 59, .65); /* warm yellow */
    outline: 1px solid rgba(0,0,0,.12);
    z-index: 9999;
    animation: aftQlFlash 1.4s ease-out 1 forwards;
    mix-blend-mode: multiply;
  }
  @keyframes aftQlFlash {
    0%   { filter: brightness(1.8) saturate(1.6); }
    60%  { filter: brightness(2.2) saturate(2.0); }
    100% { filter: brightness(1)   saturate(1);   opacity: .15; }
  }
  #aftQuickLinks.collapsed .aft-ql-grid { display: none; }
  #aftQuickLinksHeader {
    display:flex; align-items:center; justify-content:space-between;
    cursor:pointer; user-select:none;
  }
  #aftQuickLinksHeader .aft-caret {
    margin-left:8px; transition: transform .15s ease;
    font-size:12px; opacity:.8;
  }
  #aftQuickLinks.collapsed #aftQuickLinksHeader .aft-caret {
    transform: rotate(-90deg);
  }
  `;
  let showingStyled = true;
  document.head.appendChild(styleTag);
  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = chrome.runtime.getURL('pdf_viewer.css');
  document.head.appendChild(link);
  const { defaultStyleWords, config } = await import(chrome.runtime.getURL('styles.js'));
  let currentBU = localStorage.getItem('highlight_BU') || '';
  let currentOU = localStorage.getItem('highlight_OU') || '';
  let styleWordsToUse = [];
  function updateStyleWords() {
    prevActiveWordsSet = activeWordsSet;
    styleWordsToUse = [];
    if (currentBU && config[currentBU]?.styleWords) {
      styleWordsToUse.push(...config[currentBU].styleWords);
    }
    if (currentBU && currentOU && config[currentBU]?.[currentOU]?.styleWords) {
      styleWordsToUse.push(...config[currentBU][currentOU].styleWords);
    }
    if (includeCustom && customRules.length) {
      styleWordsToUse.push(...customRules.map(r => ({style:r.style, words:r.words})));
    }
    activeWordsSet = new Set();
    styleWordsToUse.forEach(r => {
      r.words.forEach(w => activeWordsSet.add(normWord(w)));
    });
    newWordsSet = new Set([...activeWordsSet].filter(w => !prevActiveWordsSet.has(w)));
    styleWordsToUse.forEach(r => {
      r._regexes = r.words.map(w => ({
        word: w,
        rx: makeRegex(w),
        isNew: newWordsSet.has(normWord(w)),
      }));
    });
    pulseMode = newWordsSet.size > 0;
  }
  updateStyleWords({suppressPulse:true});
  const buSelect = document.createElement('select');
  buSelect.style.marginLeft = '-200px';
  buSelect.style.width = 'calc(100% + 23px)';
  const ouSelect = document.createElement('select');
  ouSelect.style.marginLeft = '-200px';
  ouSelect.style.width = 'calc(100% + 16px)';
  ouSelect.disabled = true;
  const toggle   = document.createElement('button');
  toggle.id = 'aftToggle';
  [buSelect, ouSelect].forEach(s => s.className = 'modern-select');
  toggle.textContent = 'Open Original';
  const addBtn      = document.createElement('button');
  addBtn.textContent = 'Edit Personal Styles';
  const customChk   = document.createElement('input');
  customChk.type    = 'checkbox';
  customChk.checked = includeCustom;
  customChk.id      = 'highlightUseCustom';
  const customLbl   = document.createElement('label');
  customLbl.htmlFor = customChk.id;
  customLbl.textContent = 'Use Custom';
  const hlPanel = document.createElement('div');
  hlPanel.id = 'aftHlPanel';
  hlPanel.style.cssText = `
    position:fixed; top:60px; left:16px; min-width: 50px;
    background:#fff; border:1px solid #ccc; border-radius:6px;
    padding:8px; box-shadow:0 2px 10px rgba(0,0,0,.2);
    font:12px sans-serif; color:#000;
    width:300px; max-width:90vw; display:none; z-index:${AFT_UI_Z};
  `;
  hlPanel.textContent = 'Highlight panel';
  const customPanel = document.createElement('div');
  customPanel.id = 'aftCustomPanel';
  customPanel.style.cssText = `
    position:fixed; top:60px; left:16px;
    background:#fff; border:1px solid #ccc; border-radius:6px;
    padding:8px; box-shadow:0 2px 10px rgba(0,0,0,.2);
    font:12px sans-serif; color:#000;
    width:400px; max-width:95vw; display:none; z-index:${AFT_UI_Z};
  `;
  const customPanelHdr = document.createElement('div');
  customPanelHdr.textContent = 'Custom Highlights';
  customPanelHdr.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;">
      <span style="font-weight:bold;"></span>
      <span style="font-weight:bold;">Custom Highlights</span>
    </div>
  `;
  customPanelHdr.style.cssText = `
    font-weight: bold;
    margin-bottom: 4px;
    cursor: move;
    user-select: none;
    background: #f7f7f7;
    border-bottom: 1px solid #ddd;
    padding: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  customPanelHdr.style.cursor = 'move';
  let isDragging = false, offsetX, offsetY;
  customPanelHdr.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = customPanel.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.userSelect = '';
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    customPanel.style.left = `${e.clientX - offsetX}px`;
    customPanel.style.top = `${e.clientY - offsetY}px`;
  });
  const customPanelClose = document.createElement('button');
  customPanelClose.textContent = '✕';
  customPanelClose.style.cssText = `
    position: relative;
    top: 0px;
    right: 0px;
    font-size: 12px;
    padding: 0 6px;
    cursor: pointer;
    background-color: red;
    color: white;
    border: none;
    border-radius: 4px;
    z-index: 1;
  `;
  customPanelHdr.appendChild(customPanelClose);
  const customPanelBody = document.createElement('div');
  customPanel.append(customPanelHdr, customPanelBody);
  function makeColorSelect(selected) {
    const sel = document.createElement('select');
    sel.style.width = '100%';
    sel.innerHTML = '<option value="">(named)</option>';
    CSS_COLOR_KEYWORDS.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      opt.style.backgroundColor = name;
      opt.style.color = name === 'yellow' || name === 'white' ? '#000' : '#fff';
      if (name === selected) opt.selected = true;
      sel.appendChild(opt);
    });
    const optCustom = document.createElement('option');
    optCustom.value = '__custom__';
    optCustom.textContent = 'Custom Hex…';
    sel.appendChild(optCustom);
    return sel;
  }
  function renderCustomPanel() {
    while (customPanelBody.firstChild) {
      customPanelBody.removeChild(customPanelBody.firstChild);
    }
    if (!customRules.length) {
      const empty = document.createElement('div');
      empty.textContent = 'No custom rules yet.';
      empty.style.marginBottom = '8px';
      customPanelBody.appendChild(empty);
    } else {
      customRules.forEach((rule, idx) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:2fr auto auto;gap:4px;align-items:start;margin-bottom:4px;';
        const wordsInput = document.createElement('input');
        wordsInput.type='text';
        wordsInput.value = rule.words.join(', ');
        wordsInput.title = 'Comma or newline separated words';
        wordsInput.style.width='100%';
        row.appendChild(wordsInput);
        const propSel = document.createElement('select');
        [['background','Background'],['color','Text'],['underline','Underline']].forEach(([v,l])=>{
          const opt=document.createElement('option');
          opt.value=v; opt.textContent=l;
          if (rule.prop===v) opt.selected=true;
          propSel.appendChild(opt);
        });
        row.appendChild(propSel);
        const colorWrap = document.createElement('div');
        colorWrap.style.cssText='display:flex;gap:4px;align-items:center;';
        const colorSel = makeColorSelect(rule.color.toLowerCase?.()||rule.color);
        const colorInput = document.createElement('input');
        colorInput.type='color';
        colorInput.value = /^#/.test(rule.color) ? rule.color : '#ffff00';
        colorInput.style.display = /^#/.test(rule.color)?'':'none';
        colorInput.style.width='18px'; colorInput.style.padding='0'; colorInput.style.border='none';
        colorInput.style.background='transparent';
        colorSel.addEventListener('change',()=>{
          if (colorSel.value==='__custom__'){
            colorInput.style.display='';
          } else {
            colorInput.style.display='none';
          }
        });
        colorWrap.append(colorSel,colorInput);
        row.appendChild(colorWrap);
        const actionRow = document.createElement('div');
        actionRow.style.cssText='grid-column:1/-1;display:flex;justify-content:flex-end;gap:4px;margin-bottom:2px;';
        const saveBtn=document.createElement('button'); saveBtn.textContent='Save'; saveBtn.style.fontSize='11px';
        const delBtn=document.createElement('button'); delBtn.textContent='Delete'; delBtn.style.fontSize='11px';
        actionRow.append(saveBtn,delBtn);
        row.appendChild(actionRow);
        saveBtn.onclick = () => {
          const raw = wordsInput.value;
          const words = raw.split(/[\n,]/).map(w=>w.trim()).filter(Boolean);
          if (!words.length) { alert('Please enter at least one word.'); return; }
          let colorValue;
          if (colorSel.value==='__custom__') {
            colorValue = colorInput.value || '#ffff00';
          } else if (colorSel.value) {
            colorValue = colorSel.value;
          } else {
            colorValue = 'yellow';
          }
          rule.words = words;
          rule.prop  = propSel.value;
          rule.color = colorValue;
          rule.style = buildStyleFromFields(rule.prop, rule.color);
          persistCustomRules();
          includeCustom = true;
          customChk.checked = true;
          refreshAll();
          renderCustomPanel();
        };
        delBtn.onclick = () => {
          if (!confirm('Delete this custom highlight?')) return;
          customRules.splice(idx,1);
          persistCustomRules();
          if (!customRules.length) {
            includeCustom=false;
            customChk.checked=false;
          }
          refreshAll();
          renderCustomPanel();
        };
        customPanelBody.appendChild(row);
        const hr=document.createElement('hr'); hr.style.margin='4px 0'; customPanelBody.appendChild(hr);
      });
    }
    const addHdr=document.createElement('div');
    addHdr.textContent='Add New';
    addHdr.style.cssText='font-weight:bold;margin:4px 0;';
    customPanelBody.appendChild(addHdr);
    const newRow=document.createElement('div');
    newRow.style.cssText='display:grid;grid-template-columns:1fr auto auto;gap:4px;align-items:start;';
    const newWords=document.createElement('input'); newWords.type='text'; newWords.placeholder='word1, word2';
    const newProp=document.createElement('select');
    [['background','Background'],['color','Text'],['underline','Underline']].forEach(([v,l])=>{
      const opt=document.createElement('option');opt.value=v;opt.textContent=l;newProp.appendChild(opt);
    });
    const newColorWrap=document.createElement('div'); newColorWrap.style.cssText='display:flex;gap:4px;align-items:center;';
    const newColorSel=makeColorSelect('');
    const newColorInput=document.createElement('input'); newColorInput.type='color'; newColorInput.value='#ffff00'; newColorInput.style.display='none'; newColorInput.style.width='22px';
    newColorSel.addEventListener('change',()=>{
      newColorInput.style.display = (newColorSel.value==='__custom__')?'':'none';
    });
    newColorWrap.append(newColorSel,newColorInput);
    newRow.append(newWords,newProp,newColorWrap);
    customPanelBody.appendChild(newRow);
    const newRowBtns=document.createElement('div');
    newRowBtns.style.cssText='margin-top:4px;display:flex;justify-content:flex-end;gap:4px;';
    const newAddBtn=document.createElement('button'); newAddBtn.textContent='Add'; newAddBtn.style.fontSize='11px';
    const newCancelBtn=document.createElement('button'); newCancelBtn.textContent='Clear'; newCancelBtn.style.fontSize='11px';
    newRowBtns.append(newCancelBtn,newAddBtn);
    customPanelBody.appendChild(newRowBtns);
    const footer = document.createElement('div');
    footer.style.cssText = `
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding-top: 8px;
      border-top: 1px solid #ccc;
    `;
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '⬇ Export';
    exportBtn.style.cssText = `
      background-color: #007bff;
      color: white;
      border-color: #007bff;
    `;
    exportBtn.onclick = () => {
      const exportData = customRules.map(r => ({
        words: r.words,
        prop: r.prop,
        color: r.color
      }));
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'custom_highlight_styles.json';
      a.click();
      URL.revokeObjectURL(url);
    };
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = 'application/json';
    importInput.style.display = 'none';
    const importBtn = document.createElement('button');
    importBtn.textContent = '⬆ Import';
    importBtn.style.cssText = `
      background-color: #28a745;
      color: white;
      border-color: #28a745;
    `;
    importBtn.onclick = () => importInput.click();
    importInput.onchange = () => {
      const file = importInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(reader.result);
          if (!Array.isArray(imported)) throw new Error('Invalid format');
          const newRules = imported.map(r => normalizeRuleFromStorage(r)).filter(Boolean);
          customRules.push(...newRules);
          persistCustomRules();
          includeCustom = true;
          customChk.checked = true;
          refreshAll();
          renderCustomPanel();
        } catch (err) {
          alert('Failed to import styles: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    footer.appendChild(importBtn);
    footer.appendChild(exportBtn);
    customPanelBody.appendChild(importInput);  // invisible, but needed for file upload
    customPanelBody.appendChild(footer);
    newCancelBtn.onclick=()=>{newWords.value='';newColorSel.value='';newColorInput.style.display='none';};
    newAddBtn.onclick=()=>{
      const words = newWords.value.split(/[\n,]/).map(w=>w.trim()).filter(Boolean);
      if(!words.length){alert('Please enter at least one word.');return;}
      let colorValue;
      if (newColorSel.value==='__custom__') colorValue=newColorInput.value||'#ffff00';
      else if (newColorSel.value) colorValue=newColorSel.value;
      else colorValue='yellow';
      const newRule={
        id: Date.now().toString(36)+Math.random().toString(36).slice(2),
        words,
        prop:newProp.value,
        color:colorValue,
        style:buildStyleFromFields(newProp.value,colorValue)
      };
      customRules.push(newRule);
      persistCustomRules();
      includeCustom = true;
      customChk.checked = true;
      refreshAll();
      renderCustomPanel();
      newWords.value='';
      newColorSel.value='';
      newColorInput.style.display='none';
    };
  }
  customPanelClose.onclick = () => { customPanel.style.display='none'; };
  function toggleCustomPanel() {
    if (customPanel.style.display==='none' || customPanel.style.display==='') {
      renderCustomPanel();
      customPanel.style.display='';
    } else {
      customPanel.style.display='none';
    }
  }
  addBtn.title = 'Add / Manage custom highlights';
  addBtn.onclick = (e) => { e.preventDefault(); toggleCustomPanel(); };
  addBtn.oncontextmenu = (e) => { e.preventDefault(); toggleCustomPanel(); };
  buSelect.innerHTML =
    `<option value="">-- Select BU --</option>` +
    Object.keys(config)
          .map(bu => `<option value="${bu}" ${bu===currentBU?'selected':''}>${bu}</option>`)
          .join('');
  function updateOuOptions() {
    ouSelect.options.length = 0;
    ouSelect.add(new Option('-- Select OU --', ''));
    const selectedBU = buSelect.value;
    if (!selectedBU) {
      ouSelect.disabled = true;
      return;
    }
    ouSelect.disabled = false;
    const ous = Object
      .keys(config[selectedBU])
      .filter(key => key !== 'styleWords');
    for (const ou of ous) {
      const opt = new Option(ou, ou);
      if (ou === currentOU) opt.selected = true;
      ouSelect.add(opt);
    }
  }
  updateOuOptions();
  function clearHighlights(scope) {
    if (!scope) return;
    scope.querySelectorAll('.styled-word').forEach(w => {
      const p = w.parentNode;
      while (w.firstChild) p.insertBefore(w.firstChild, w);
      w.remove();
    });
    scope.querySelectorAll('.word-highlight, .word-underline').forEach(el => el.remove());
  }
  function makeWavyDataURI(color = 'red', amp = 2, wave = 6) {
    const h = amp * 2;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${wave}" height="${h}" viewBox="0 0 ${wave} ${h}" preserveAspectRatio="none">` +
        `<path d="M0 ${amp} Q ${wave/4} 0 ${wave/2} ${amp} T ${wave} ${amp}" ` +
        `fill="none" stroke="${color}" stroke-width="1"/>` +
      `</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }
  function getUnderlineColorFromStyle(style) {
    const m = /text-decoration-color\s*:\s*([^;]+)/i.exec(style);
    if (m) return m[1].trim();
    const m2 = /text-decoration\s*:[^;]*?\b(#?[\\w]+)\b/i.exec(style);
    if (m2) return m2[1].trim();
    return 'red';
  }
  function highlightSpan(span, rules, page) {
    const walker = document.createTreeWalker(
      span,
      NodeFilter.SHOW_TEXT,
      { acceptNode: n => n.data.trim() 
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT 
      }
    );
    const jobsByKey = Object.create(null);
    for (let textNode; (textNode = walker.nextNode()); ) {
      const text = textNode.data;
      for (const rule of rules) {
        for (const rxObj of (rule._regexes || [])) {
          const re = rxObj.rx || rxObj;
          if (!(re instanceof RegExp)) continue;
          re.lastIndex = 0;
          let m;
          while ((m = re.exec(text))) {  
            if (!textNode.__highlightId) {
              textNode.__highlightId = Symbol();
            }
            const key = `${String(textNode.__highlightId)}|${m.index}|${m[0].length}`;
            const before = text[m.index - 1];
            const shift  = before === '*' || (before === ' ' && text[m.index - 2] === '*');
            (jobsByKey[key] ??= []).push({
              node: textNode,
              start: m.index,
              end:   m.index + m[0].length,
              style: rule.style,
              shift,
              isNew: rxObj.isNew === true
            });
          }
        }
      }
    }
    const jobs = Object.values(jobsByKey).flat();
    for (const job of jobs) {
      const { style } = job;
      const hasBg   = /background\s*:/.test(style);
      const hasUL   = /text-decoration-line\s*:\s*underline/i.test(style);
      if (!hasBg && !hasUL) continue;
      const { node, start, end, shift } = job;
      if (end > node.length) continue;
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      const pageRect = page.getBoundingClientRect();
      let scale = 1;
      const m = page.style.transform.match(/scale\(([^)]+)\)/);
      if (m) scale = parseFloat(m[1]);
      for (const r of range.getClientRects()) {
        if (hasBg) {
          const box = document.createElement('div');
          box.className = 'word-highlight';
          if (shift) box.classList.add('shift-left');
          if (pulseMode && job.isNew) box.classList.add('pulse');
          const x = (r.left - pageRect.left - 8) / scale;
          const y = (r.top  - pageRect.top  - 8) / scale;
          box.style.cssText = `${style};
            position:absolute;
            left:${x}px;
            top:${y}px;
            width:${r.width  / scale}px;
            height:${r.height / scale}px;
            pointer-events:none;
            mix-blend-mode:multiply;
            z-index:5`;
          page.appendChild(box);
        }
        if (hasUL) {
          const ul = document.createElement('div');
          ul.className = 'word-underline';
          if (shift) ul.classList.add('shift-left');
          if (pulseMode && job.isNew) ul.classList.add('pulse');
          const ulColor = getUnderlineColorFromStyle(style);
          const x = (r.left - pageRect.left - 8) / scale;
          const y = (r.bottom - pageRect.top - 8 - 3) / scale; // 3px tweak
          const w = r.width / scale;
          const h = 4; // matches .word-underline height; small constant
          ul.style.left  = `${x}px`;
          ul.style.top   = `${y}px`;
          ul.style.width = `${w}px`;
          ul.style.height= `${h}px`;
          ul.style.backgroundImage = makeWavyDataURI(ulColor, 2, 6);
          page.appendChild(ul);
        }
      }
      range.detach();
    }
    const spanJobs = jobs
      .filter(j => {
        const st = j.style;
        return !/background\s*:/.test(st) && !/text-decoration-line\s*:\s*underline/i.test(st);
      })
      .sort((a, b) => {
        if (a.node === b.node) return b.start - a.start;
        return a.node.compareDocumentPosition(b.node) &
              Node.DOCUMENT_POSITION_FOLLOWING ? 1 : -1;
      });
    const seen = new Set();
    const uniqueSpanJobs = [];
    for (const j of spanJobs) {
      const k = `${j.node}|${j.start}|${j.end}`;
      if (seen.has(k)) continue;
      seen.add(k);
      uniqueSpanJobs.push(j);
    }
    for (const job of uniqueSpanJobs) {
      const { node, start, end, style, shift } = job;
      if (end > node.length) continue;
      const target = start ? node.splitText(start) : node;
      target.splitText(end - start);
      const wrap = document.createElement('span');
      wrap.classList.add('styled-word');
      const isUnderline = /text-decoration-line\s*:\s*underline/i.test(style);
      if (isUnderline) wrap.classList.add('aft-ul'); // marker class
      if (shift) wrap.classList.add('shift-left');
      if (pulseMode && job.isNew) wrap.classList.add('pulse');
      const needsForce =
        !/color\s*:/.test(style) &&
        !isUnderline; 
      wrap.style.cssText = style + (needsForce ? FORCE_TEXT_VISIBLE : '');
      wrap.appendChild(target.cloneNode(true));
      target.parentNode.replaceChild(wrap, target);
    }
  }
  function isTextStyle(rule) {
    if (rule.prop) return rule.prop === 'color';       // custom rules already carry .prop
    const css = rule.style || '';
    return  /(?:^|;)\s*color\s*:/.test(css) &&         // has a text colour
            !/background\s*:/.test(css) &&             // …but no background
            !/text-decoration-line\s*:\s*underline/i.test(css); // …and no underline
  }
  function renderAllHighlights() {
    if (!container) return;
    clearHighlights(container);
    container.querySelectorAll('.page').forEach(page => {
      page.style.position = 'relative';
      page.querySelectorAll('.textLayer span').forEach(span => {
        const txt = span.textContent.trim();
        if (txt.startsWith('* ')) {
          const orangeRules = styleWordsToUse.map(rule =>
            isTextStyle(rule)
              ? {                          // clone & override only text-style rules
                  ...rule,
                  style: 'background: orange; color: black;'
                }
              : rule                       // leave underline / background untouched
          );
          highlightSpan(span, orangeRules, page);
          return;
        }
        highlightSpan(span, styleWordsToUse, page);
      });
    });
    if (pulseMode) setTimeout(() => { pulseMode = false; }, 1000);
  }
  function refreshAll() {
    updateStyleWords();
    clearHighlights(container);
    renderAllHighlights();
    renderCustomPanel();
  }
  buSelect.onchange = () => {
    currentBU = buSelect.value;
    localStorage.setItem('highlight_BU', currentBU);
    currentOU = '';
    localStorage.removeItem('highlight_OU');
    updateOuOptions();
    updateStyleWords();
    clearHighlights(container); 
    renderAllHighlights();
  };
  ouSelect.onchange = () => {
    currentOU = ouSelect.value;
    localStorage.setItem('highlight_OU', currentOU);
    updateStyleWords();
    clearHighlights(container); 
    renderAllHighlights();
  };
  Object.assign(toggle.style, {
    position:'fixed', top:'16px', right:'16px',
    background:'#ff0', color:'#000', fontWeight:'bold',
    padding:'6px 12px', cursor:'pointer'
  });
  buSelect.value = currentBU;
  updateOuOptions();
  if (currentOU) {
    ouSelect.value = currentOU;
  }
  customChk.addEventListener('change', () => {
    includeCustom = customChk.checked;
    updateStyleWords();
    clearHighlights(container);
    renderAllHighlights();
  });

  updateStyleWords();
  const pdfjsLib    = await import(chrome.runtime.getURL('pdf.mjs'));
  const pdfjsViewer = await import(chrome.runtime.getURL('pdf_viewer.mjs'));
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs');
  const { PDFViewer, PDFLinkService, EventBus } = pdfjsViewer;
  let embed = embedEl;
  if (!embed && viewerEl) {
    try {
      embed = viewerEl.shadowRoot?.querySelector('embed[type*="pdf"],object[type*="pdf"]') || null;
    } catch {  }
  }
  container = document.createElement('div');
  container.className = 'aft-container';
  if (embed) {
    const rect = embed.getBoundingClientRect();
    const heightPx = Math.max(
      Math.round(rect?.height || embed.clientHeight || parseInt(embed.getAttribute?.('height') || '0', 10) || 800),
      300
    );
    Object.assign(container.style, {
      position: 'relative',
      width: '100%',
      maxWidth: '100%',
      height: heightPx + 'px',
      overflow: 'auto',
      background: '#000'
    });
    embed.replaceWith(container);
  } else {
    Object.assign(container.style, {
      position: 'fixed',
      inset: '0',
      width: '100vw',
      height: '100vh',
      overflow: 'auto',
      background: '#000',
      zIndex: 2147483647
    });
    document.body.appendChild(container);
  }
  const loader = document.createElement('div');
  loader.id = 'aftLoader';
  Object.assign(loader.style, {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#000',          // same black you set on container
    zIndex: 2147483648           // one above container
  });
  loader.innerHTML = '<div class="pulse-ring"></div>';
  document.body.appendChild(loader);
  const spinnerCSS = document.createElement('style');
  spinnerCSS.textContent = `
    .pulse-ring {
      position: relative;
      width: 120px;
      height: 120px;
    }
    .pulse-ring::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: #1804F0;
      opacity: 0.25;
      filter: blur(10px);
      pointer-events: none;
    }
    .pulse-ring::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 50%;
      box-shadow: 0 0 0 0 #1804F0;
      animation: pulseBig 1.6s ease-out infinite;
      filter: drop-shadow(0 0 8px #1804F0);
      pointer-events: none;
    }
    @keyframes pulseBig {
      0%   { box-shadow: 0 0 0   0   #1804F0; }
      60%  { box-shadow: 0 0 0  80px rgba(24,4,240,0); }
      100% { box-shadow: 0 0 0   0   rgba(24,4,240,0); }
    }
  `;
  document.head.appendChild(spinnerCSS);
  const viewerDiv = document.createElement('div');
  viewerDiv.className = 'pdfViewer';
  container.appendChild(viewerDiv);
  rebuildRuleStyles();
  addBtn.title = 'Add / Manage custom highlights'; 
  addBtn.onclick = (e) => { e.preventDefault(); toggleCustomPanel(); };
  addBtn.oncontextmenu = (e) => { e.preventDefault(); toggleCustomPanel(); };
  document.body.appendChild(toggle);
  document.body.appendChild(hlPanel);
  if (showingStyled) {
    hlPanel.style.display = '';
  }
  document.body.appendChild(customPanel);
  hlPanel.dataset.aftRole = 'panel';
  customPanel.dataset.aftRole = 'custom';
  hlPanel.style.zIndex = AFT_UI_Z;
  const hlHeader = document.createElement('div');
  hlHeader.textContent = 'Style Settings';
  hlHeader.style.cssText = `
    font-weight: bold;
    margin-bottom: 4px;
    cursor: move;
    user-select: none;
    background: #f7f7f7;
    border-bottom: 1px solid #ddd;
    padding: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  let isHlDragging = false, hlDragOffsetX = 0, hlDragOffsetY = 0;
  hlHeader.addEventListener('mousedown', (e) => {
    isHlDragging = true;
    const rect = hlPanel.getBoundingClientRect();
    hlDragOffsetX = e.clientX - rect.left;
    hlDragOffsetY = e.clientY - rect.top;
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mouseup', () => {
    isHlDragging = false;
    document.body.style.userSelect = '';
  });
  document.addEventListener('mousemove', (e) => {
    if (!isHlDragging) return;
    hlPanel.style.left = `${e.clientX - hlDragOffsetX}px`;
    hlPanel.style.top = `${e.clientY - hlDragOffsetY}px`;
  });
  const hlClose = document.createElement('button');
  hlClose.textContent = '✕';
  hlClose.style.cssText = `
    font-size: 12px;
    padding: 0 6px;
    cursor: pointer;
    background-color: red;
    color: white;
    border: none;
    border-radius: 4px;
  `;
  hlHeader.appendChild(hlClose);
  const hlBody = document.createElement('div');
  hlBody.id = 'aftHlPanelBody';
  const buLabel = document.createElement('label');
  buLabel.textContent = 'BU:';
  buLabel.style.fontWeight = 'bold';

  const ouLabel = document.createElement('label');
  ouLabel.textContent = 'OU:';
  ouLabel.style.fontWeight = 'bold';

  const buRow = document.createElement('div');
  buRow.className = 'aft-row';
  buRow.append(buLabel, buSelect);

  const ouRow = document.createElement('div');
  ouRow.className = 'aft-row';
  ouRow.append(ouLabel, ouSelect);

  hlBody.append(
    buRow,
    ouRow,
    toggle,
    addBtn,
    customChk,
    customLbl
  );
  const qlWrap = document.createElement('div');
  qlWrap.id = 'aftQuickLinks';
  const qlHeader = document.createElement('div');
  qlHeader.id = 'aftQuickLinksHeader';
  qlHeader.innerHTML = `<span>Quick Links</span><span class="aft-caret">▾</span>`;
  const qlGrid = document.createElement('div');
  qlGrid.className = 'aft-ql-grid';
  let qlCollapsed = (localStorage.getItem('aft_ql_collapsed') === '1');
  function updateQlCollapseUI() {
    qlWrap.classList.toggle('collapsed', qlCollapsed);
    qlHeader.setAttribute('aria-expanded', String(!qlCollapsed));
  }
  qlHeader.addEventListener('click', () => {
    qlCollapsed = !qlCollapsed;
    localStorage.setItem('aft_ql_collapsed', qlCollapsed ? '1' : '0');
    updateQlCollapseUI();
  });
  QUICK_LINKS.forEach(label => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'aft-ql-btn';
    btn.title = `Jump to "${label}"`;
    btn.textContent = label;
    btn.onclick = async () => {
      const ok = await jumpToPhrase(label);
      if (!ok) {
        btn.classList.add('aft-ql-notfound');
        setTimeout(() => btn.classList.remove('aft-ql-notfound'), 900);
      }
    };
    qlGrid.appendChild(btn);
  });
  qlWrap.append(qlHeader, qlGrid);
  hlBody.appendChild(qlWrap);
  updateQlCollapseUI();
  hlBody.style.display = ''; // show by default
  hlPanel.innerHTML = ''; // clear previous text
  hlPanel.append(hlHeader, hlBody);
  customPanel.style.zIndex = AFT_UI_Z;
  toggle.dataset.aftRole   = 'toggle';
  toggle.style.zIndex      = AFT_UI_Z;
  let isCollapsed = false;
  hlClose.onclick = () => {
    isCollapsed = !isCollapsed;
    if (isCollapsed) {
      hlBody.style.display = 'none';
      hlClose.textContent = '☰';
      hlPanel.style.width = '80px';
      hlPanel.style.padding = '4px';
      hlPanel.style.left = '8px';
    } else {
      hlBody.style.display = '';
      hlClose.textContent = '✕';
      hlPanel.style.width = '300px';  // or your preferred expanded width
      hlPanel.style.padding = '8px';
      hlPanel.style.left = '16px';
    }
  };
  let data, fetchUrl, resp;
  try {
    fetchUrl = fetchUrlOverride ||
           (embed && embed.getAttribute && embed.getAttribute('original-url')) ||
           location.href;
    resp = await fetch(fetchUrl, { credentials: 'include', cache: 'force-cache' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    data = await resp.arrayBuffer();
    console.log('[AFT] fetched PDF bytes:', data.byteLength, 'from', fetchUrl);
  } catch (err) {
    if (DEBUG) console.debug('[AFT] PDF fetch failed:', err);
    return;
  }
  const pdfDoc      = await pdfjsLib.getDocument({data}).promise;
  const eventBus    = new EventBus();
  const linkService = new PDFLinkService({eventBus});
  const pdfViewer   = new PDFViewer({container, viewer:viewerDiv, eventBus, linkService});
  eventBus.on('pagerendered',       () => loader.remove());
  eventBus.on('pagesloaded',        () => loader.remove());
  eventBus.on('pagesinit',          () => loader.remove());
  eventBus.on('documentloadfailed', () => loader.remove());
  const fix = document.createElement('style');
  fix.textContent = `
    .textLayer span {
      pointer-events:auto !important;
      opacity:1 !important;
      mix-blend-mode:multiply;
    }
    .styled-word { 
      display: contents !important;
      font:inherit;
      letter-spacing: inherit !important;
    }
    .word-highlight {
      position: absolute;
      pointer-events: none;
      mix-blend-mode: multiply;  
    }
  `;
  fix.textContent += `
    @keyframes pulseHighlight {
      0%   { filter: brightness(2.5) saturate(2); transform: scale(1);   }
      50%  { filter: brightness(3) saturate(3); transform: scale(1.08); }
      100% { filter: brightness(1.0) saturate(1.0); transform: scale(1);   }
    }
    .word-highlight.pulse {
      animation: pulseHighlight 0.9s ease-out 0s 2 alternate;
      mix-blend-mode: normal !important;
      z-index: 10 !important;
      opacity: 1 !important;
    }
    .styled-word.pulse {
      animation: pulseHighlight 0.9s ease-out 0s 2 alternate;
    }
    .word-underline {
      position:absolute;
      pointer-events:none;
      z-index:6;
      height:4px;
      background-repeat:repeat-x;
      background-position:left bottom;
      background-size:auto 100%;
      mix-blend-mode:multiply;
    }
    .page { box-shadow: 0 0 6px rgba(0,0,0,.12); margin:0 auto 24px; }
    .page::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: -16px;
      border-bottom: 1px dashed #888;
      opacity: .7;
      pointer-events: none;
    }
  `;
  document.head.appendChild(fix);
  linkService.setViewer(pdfViewer);
  await new Promise(resolve => requestAnimationFrame(resolve));
  pdfViewer.setDocument(pdfDoc);
  const linkStates = new Map();
  function setBtnProgressText(btn, label, idxOneBased, total) {
    btn.textContent = (total && idxOneBased)
      ? `${label} (${idxOneBased} of ${total})`
      : label;
  }
  async function findAllTargetsFor(phrase) {
    const needle = (phrase || "").toLowerCase().replace(/\s+/g, " ").trim();
    const targets = [];
    for (let n = 1; n <= pdfDoc.numPages; n++) {
      const text = await getPageText(n);
      if (!text.includes(needle)) continue;
      await ensureTextLayerRendered(n);
      const page =
        pdfViewer._pages?.[n - 1]?.div ||
        container.querySelector(`.page[data-page-number="${n}"]`);
      if (!page) continue;
      const pageRect = page.getBoundingClientRect();
      const scale = getPageScale(page);
      const hits = collectMatchesOnPage(page, phrase);
      for (const rects of hits) {
        const yLocal = (rects[0].top - pageRect.top - 8) / scale;
        targets.push({ pageNumber: n, yLocal });
      }
    }
    targets.sort((a,b)=> a.pageNumber - b.pageNumber || a.yLocal - b.yLocal);
    return targets;
  }
  async function computeAndRenderQuickLinks() {
    const results = await Promise.all(
      QUICK_LINKS.map(async label => [label, await findAllTargetsFor(label)])
    );
    const present = results
      .filter(([, targets]) => targets.length > 0)
      .sort((a, b) => (a[1][0]?.pageNumber || 1e9) - (b[1][0]?.pageNumber || 1e9));
    qlGrid.innerHTML = "";
    for (const [label, targets] of present) {
      const state = linkStates.get(label) || { targets, idx: 0 };
      state.targets = targets;
      state.idx = Math.min(state.idx || 0, Math.max(0, targets.length - 1));
      linkStates.set(label, state);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "aft-ql-btn";
      btn.title = `Jump to "${label}" — ${targets.length} occurrence${targets.length > 1 ? 's' : ''}`;
      setBtnProgressText(btn, label, null, null); // show just the label initially
      btn.onclick = async (ev) => {
        if (btn.__busy) return;
        btn.__busy = true;
        try {
          const st = linkStates.get(label);
          if (!st.targets || !st.targets.length) {
            st.targets = await findAllTargetsFor(label);
          }
          const total = st.targets.length;
          if (!total) return;
          const step = ev.shiftKey ? -1 : 1;
          const idx = ((st.idx % total) + total) % total; // keep in [0..total-1]
          const displayIdx = idx + 1;                      // 1-based for the label
          const target = st.targets[idx];
          setBtnProgressText(btn, label, displayIdx, total);
          await jumpTo({ pageNumber: target.pageNumber, phrase: label, afterY: target.yLocal - 0.5 });
          st.idx = (idx + step + total) % total;
        } finally {
          btn.__busy = false;
        }
      };
      qlGrid.appendChild(btn);
    }
    qlWrap.style.display = qlGrid.children.length ? "" : "none";
    updateQlCollapseUI();
  }
  eventBus.on('pagesinit', async () => {
    pdfViewer.currentScaleValue = 'auto'; // or 'page-fit'
    await computeAndRenderQuickLinks();
  });
  let _aftRefreshScheduled = false;
  let _aftLastReason = '';
  function aftRefreshHighlights(reason = '') {
    _aftLastReason = reason;
    if (_aftRefreshScheduled) return;          // coalesce
    _aftRefreshScheduled = true;
    requestAnimationFrame(() => {
      _aftRefreshScheduled = false;
      if (!showingStyled) return;
      renderAllHighlights();
    });
  }
  setTimeout(() => aftRefreshHighlights('initDelay'), 500);
  linkService.setDocument(pdfDoc, null);
  eventBus.on('pagesloaded', () => {
    setTimeout(() => aftRefreshHighlights('pagesloadedDelay'), 300);
  });
  renderAllHighlights();
  eventBus.on('textlayerrendered', ({ pageNumber }) => {
    const pageView = pdfViewer._pages[pageNumber - 1];
    const textLayer = pageView?.textLayer?.textLayerDiv;
    if (!textLayer) return;
    Array.from(textLayer.querySelectorAll('span')).forEach(span => {
      if (!span.dataset.origStyle) {
        span.dataset.origStyle = span.getAttribute('style') || '';
      }
    });
    aftRefreshHighlights('tlr-' + pageNumber);
  });
  const AFT_POLL_MS = 800;  // tune: smaller = more responsive, larger = less CPU
  let _aftLastSig = '';
  function aftComputeSig() {
    if (!container) return '';
    const pages = container.querySelectorAll('.page').length;
    const spans = container.querySelectorAll('.textLayer span').length;
    return pages + ':' + spans;
  }
  setInterval(() => {
    if (!showingStyled) return;
    const sig = aftComputeSig();
    if (sig !== _aftLastSig) {
      _aftLastSig = sig;
      aftRefreshHighlights('poll-change');   // coalesced via wrapper
    }
  }, AFT_POLL_MS);
  let _aftScrollDebounce;
  container.addEventListener('scroll', () => {
    if (!showingStyled) return;
    clearTimeout(_aftScrollDebounce);
    _aftScrollDebounce = setTimeout(() => aftRefreshHighlights('scroll'), 100);
  }, { passive: true });
  setInterval(() => {
    if (!showingStyled) return;
    aftRefreshHighlights('poll-forced');
  }, 500);
  const hasEmbedForToggle = !!embed;
  if (!hasEmbedForToggle) {
    toggle.textContent = 'Open Original';
  }
  toggle.onclick = () => {
    if (embed) {
      embed.style.display = '';
    } else if (window.__AFT_FETCH_URL) {
      location.href = window.__AFT_FETCH_URL + (window.__AFT_FETCH_URL.includes('#') ? '' : '#noaft');
      return;
    }
    container?.remove();
    hlPanel?.remove();
    customPanel?.remove();
    toggle?.remove();
    document.body.classList.remove('aft-active');
    styleTag?.remove();
    link?.remove();
  };
}