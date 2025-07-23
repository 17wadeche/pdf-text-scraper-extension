// content.js
const ALLOWED_PREFIXES = [
  'https://crm.medtronic.com/sap/bc/contentserver/',
  'https://cpic1cs.corp.medtronic.com:8008/sap/bc/contentserver/',
  'https://crmstage.medtronic.com/sap/bc/contentserver/'
];
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
    } catch { /* ignore cross-origin */ }
  }
  return { viewerEl, embedEl };
}
function startWhenReady() {
  if (initialized) return;
  if (!urlIsAllowed()) return;
  const host = findPdfHostElements();
  if (host.viewerEl || host.embedEl) {
    initialized = true;
    main(host);
    return;
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (document.contentType === 'application/pdf') {
      initialized = true;
      main(host);   // host may have nulls; main handles fallback sizing
    }
    return;
  }
  setTimeout(startWhenReady, 200);
}
startWhenReady();
function normWord(w) { return w.trim().toLowerCase(); }
function esc(re) { return re.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function makeRegex(word) {
  const p = esc(word.trim());
  return new RegExp(`(?<![\\p{L}\\p{N}])(${p})(?![\\p{L}\\p{N}])`, 'giu');
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
async function main(host = {}) {
  const { viewerEl = null, embedEl = null } = host;
  let container = null;
  window.__AFT_VERSION = '0.1.3c';
  console.log('[AFT] init v' + window.__AFT_VERSION, location.href);
  const styleTag = document.createElement('style');
  styleTag.textContent = `
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
  `;
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
      styleWordsToUse.push(...customRules);
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
  updateStyleWords();
  prevActiveWordsSet = new Set(activeWordsSet);
  newWordsSet.clear();
  pulseMode = false;
  const buSelect = document.createElement('select');
  const ouSelect = document.createElement('select');
  ouSelect.disabled = true;
  const toggle   = document.createElement('button');
  [buSelect, ouSelect].forEach(s => s.className = 'modern-select');
  toggle.textContent = 'Original';
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
    scope.querySelectorAll('.word-highlight').forEach(box => box.remove());
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
      if (!/background\s*:/.test(job.style)) continue;
      const { node, start, end, style, shift } = job;
      if (end > node.length) continue;
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      const pageRect = page.getBoundingClientRect();
      let scale = 1;
      const m = page.style.transform.match(/scale\(([^)]+)\)/);
      if (m) scale = parseFloat(m[1]);
      for (const r of range.getClientRects()) {
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
      range.detach();
    }
    const spanJobs = jobs
      .filter(j => !/background\s*:/.test(j.style))
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
      if (shift) wrap.classList.add('shift-left');
      if (pulseMode && job.isNew) wrap.classList.add('pulse');
      wrap.style.cssText = style +
        (!/color\s*:/.test(style) ? FORCE_TEXT_VISIBLE : '');
      wrap.appendChild(target.cloneNode(true));
      target.parentNode.replaceChild(wrap, target);
    }
  }
  function renderAllHighlights() {
    if (!container) return;
    clearHighlights(container);
    container.querySelectorAll('.page').forEach(page => {
      page.style.position = 'relative';
      page.querySelectorAll('.textLayer span').forEach(span => {
        const txt = span.textContent.trim();
        if (txt.startsWith('* ')) {
          const yellowRules = styleWordsToUse.map(rule => ({
            _regexes: rule._regexes,
            style:    'background: orange; color: black;'
          }));
          highlightSpan(span, yellowRules, page);
          return;
        }
        highlightSpan(span, styleWordsToUse, page);
      });
    });
    if (pulseMode) {
      setTimeout(() => { pulseMode = false; }, 100);
    }
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
    padding:'6px 12px', zIndex:2147483648, cursor:'pointer'
  });
  document.body.append(toggle);
  buSelect.value = currentBU;
  updateOuOptions();
  if (currentOU) {
    ouSelect.value = currentOU;
  }
  const addBtn = document.createElement('button');
  addBtn.textContent = '➕ Custom';
  const customChk = document.createElement('input');
  customChk.type = 'checkbox';
  customChk.checked = includeCustom;
  customChk.id = 'highlightUseCustom';
  const customLbl = document.createElement('label');
  customLbl.htmlFor = customChk.id;
  customLbl.textContent = 'Use Custom';
  customChk.addEventListener('change', () => {
    includeCustom = customChk.checked;
    updateStyleWords();
    clearHighlights(container);
    renderAllHighlights();
  });
  const customPanel = document.createElement('div');
  customPanel.style.cssText = `
    position:fixed;
    top:48px;
    left:450px;
    z-index:2147483648;
    background:#fff;
    border:1px solid #ccc;
    border-radius:6px;
    padding:8px;
    box-shadow:0 2px 10px rgba(0,0,0,.2);
    font:12px sans-serif;
    color:#000;
    width:280px;
    max-width:90vw;
    display:none;
  `;
  const customWordsTA = document.createElement('textarea');
  customWordsTA.rows = 3;
  customWordsTA.placeholder = 'word1, word2\n(or newline separated)';
  customWordsTA.style.width = '100%';
  const customPropSel = document.createElement('select');
  ['color','background'].forEach(v=>{
    const opt=document.createElement('option');
    opt.value=v;
    opt.textContent = v === 'color' ? 'Text Color' : 'Background';
    customPropSel.appendChild(opt);
  });
  customPropSel.style.width='100%';
  customPropSel.style.marginTop='4px';
  const customColorSel = document.createElement('select');
  customColorSel.style.width='100%';
  customColorSel.style.marginTop='4px';
  function populateColorSel(sel){
    sel.innerHTML='';
    const optDefault = new Option('-- choose named color --','');
    sel.add(optDefault);
    CSS_COLOR_KEYWORDS.forEach(name=>{
      const opt = new Option(name, name);
      opt.style.background = name;
      opt.style.color = '#000';
      sel.add(opt);
    });
    const optSep = new Option('────────','__sep__');
    optSep.disabled = true;
    sel.add(optSep);
    const optCustom = new Option('Custom Hex…','__custom__');
    sel.add(optCustom);
  }
  const hlPanel = document.createElement('div');
  hlPanel.id = 'highlightControlPanel';
  hlPanel.style.cssText = `
    position:fixed;
    top:16px;
    left:16px;
    z-index:2147483648;
    background:#fff;
    border:1px solid #ddd;
    border-radius:6px;
    box-shadow:0 2px 8px rgba(0,0,0,.15);
    font:12px/1.2 sans-serif;
    color:#000;
    max-width:320px;
    min-width:220px;
  `;
  const hlPanelHdr = document.createElement('div');
  hlPanelHdr.style.cssText = `
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:4px 8px;
    cursor:pointer;
    user-select:none;
    background:#f5f5f5;
    border-bottom:1px solid #ddd;
    font-weight:bold;
  `;
  hlPanelHdr.textContent = 'Highlight Controls';
  const hlPanelChevron = document.createElement('span');
  hlPanelChevron.textContent = '▾';
  hlPanelChevron.style.marginLeft = '8px';
  hlPanelHdr.appendChild(hlPanelChevron);
  const hlPanelBody = document.createElement('div');
  hlPanelBody.style.cssText = `
    display:flex;
    flex-direction:column;
    gap:6px;
    padding:8px;
  `;
  Object.assign(buSelect.style, {position:'static', width:'100%', margin:0});
  Object.assign(ouSelect.style, {position:'static', width:'100%', margin:0});
  Object.assign(addBtn.style,   {position:'static', margin:0, padding:'4px 8px', width:'auto'});
  Object.assign(customChk.style,{position:'static', margin:'0 4px 0 0', verticalAlign:'middle'});
  Object.assign(customLbl.style,{position:'static', margin:0, verticalAlign:'middle', fontSize:'12px'});
  const hlPanelCustomRow = document.createElement('div');
  hlPanelCustomRow.style.cssText = `
    display:flex;
    align-items:center;
    gap:8px;
  `;
  hlPanelCustomRow.appendChild(addBtn);
  const hlPanelCustomChkWrap = document.createElement('label');
  hlPanelCustomChkWrap.style.cssText = `
    display:inline-flex;
    align-items:center;
    gap:4px;
    cursor:pointer;
    font-size:12px;
  `;
  hlPanelCustomChkWrap.append(customChk, customLbl);
  hlPanelCustomRow.appendChild(hlPanelCustomChkWrap);
  hlPanelBody.append(buSelect, ouSelect, hlPanelCustomRow);
  hlPanel.append(hlPanelHdr, hlPanelBody);
  document.body.appendChild(hlPanel);
  const PANEL_COLLAPSED_KEY = 'highlight_panel_collapsed';
  let panelCollapsed = localStorage.getItem(PANEL_COLLAPSED_KEY) === '1';
  function applyPanelCollapsedState() {
    if (panelCollapsed) {
      hlPanelBody.style.display = 'none';
      hlPanelChevron.textContent = '▸';
    } else {
      hlPanelBody.style.display = 'flex';
      hlPanelChevron.textContent = '▾';
    }
  }
  applyPanelCollapsedState();
  hlPanelHdr.addEventListener('click', () => {
    panelCollapsed = !panelCollapsed;
    localStorage.setItem(PANEL_COLLAPSED_KEY, panelCollapsed ? '1' : '0');
    applyPanelCollapsedState();
  });
  populateColorSel(customColorSel);
  const customColorInput = document.createElement('input');
  customColorInput.type = 'color';
  customColorInput.value = '#ffff00';
  customColorInput.style.width='100%';
  customColorInput.style.marginTop='4px';
  customColorInput.style.display='none';
  const customAddBtn = document.createElement('button');
  customAddBtn.textContent = 'Add';
  customAddBtn.style.marginTop='8px';
  customAddBtn.style.marginRight='8px';
  const customCancelBtn = document.createElement('button');
  customCancelBtn.textContent = 'Cancel';
  customCancelBtn.style.marginTop='8px';
  customPanel.append(
    customWordsTA,
    customPropSel,
    customColorSel,
    customColorInput,
    customAddBtn,
    customCancelBtn
  );
  document.body.appendChild(customPanel);
  const LS_PROP_KEY  = 'highlight_custom_prop';
  const LS_COLOR_KEY = 'highlight_custom_color';
  customPropSel.value = localStorage.getItem(LS_PROP_KEY)  || 'background';
  const savedColor = localStorage.getItem(LS_COLOR_KEY);
  if (savedColor) {
    const opt = Array.from(customColorSel.options).find(o=>o.value===savedColor);
    if (opt) customColorSel.value = savedColor;
    else {
      customColorSel.value='__custom__';
      customColorInput.value = savedColor;
      customColorInput.style.display='';
    }
  }
  customColorSel.addEventListener('change', () => {
    if (customColorSel.value === '__custom__') {
      customColorInput.style.display='';
    } else {
      customColorInput.style.display='none';
    }
  });
  function openCustomPanel(prefillWords='') {
    customWordsTA.value = prefillWords;
    if (panelCollapsed) {
      panelCollapsed = false;
      localStorage.setItem(PANEL_COLLAPSED_KEY, '0');
      applyPanelCollapsedState();
    }
    customPanel.style.display='';
    customWordsTA.focus();
  }
  function closeCustomPanel() {
    customPanel.style.display='none';
  }
  customCancelBtn.addEventListener('click', closeCustomPanel);
  customPanel.addEventListener('keydown', (ev)=>{
    if (ev.key === 'Escape') closeCustomPanel();
  });
  function showCustomListString() {
    if (!customRules.length) return '(none)';
    return customRules.map((r,i)=>`${i+1}. [${r.style}] ${r.words.join(', ')}`).join('\n');
  }
  function manageCustomRules() {
    if (!customRules.length) {
      alert('No custom rules saved.');
      return;
    }
    const list = customRules
      .map((r,i)=>`${i+1}. [${r.style}] ${r.words.join(', ')}`)
      .join('\n');
    const choice = prompt(
      `Custom highlight rules:\n${list}\n\n` +
      'Enter # to edit/delete, "*" to delete ALL, or blank to cancel:',
      ''
    );
    if (choice == null || choice.trim() === '') return;
    if (choice.trim() === '*') {
      if (!confirm('Delete ALL custom rules?')) return;
      customRules = [];
    } else {
      const idx = Number(choice) - 1;
      if (!Number.isInteger(idx) || idx < 0 || idx >= customRules.length) {
        alert('Invalid selection.');
        return;
      }
      const rule = customRules[idx];
      const action = prompt(
        `Rule #${idx+1}\nStyle: ${rule.style}\nWords: ${rule.words.join(', ')}\n\n` +
        'Action: (D)elete, (E)dit, or blank to cancel:',
        ''
      );
      if (action == null || action.trim() === '') return;
      const a = action.trim().toLowerCase();
      if (a === 'd') {
        if (confirm('Delete this rule?')) customRules.splice(idx,1);
      } else if (a === 'e') {
        let prop = 'background';
        let col  = 'yellow';
        const mColor = /color\s*:\s*([^;]+)/i.exec(rule.style);
        const mBg    = /background\s*:\s*([^;]+)/i.exec(rule.style);
        if (mBg) { prop = 'background'; col = mBg[1].trim(); }
        if (mColor && !mBg) { prop = 'color'; col = mColor[1].trim(); }
        customPropSel.value = prop;
        const opt = Array.from(customColorSel.options).find(o=>o.value===col.toLowerCase());
        if (opt) {
          customColorSel.value = opt.value;
          customColorInput.style.display='none';
        } else {
          customColorSel.value='__custom__';
          if (!col.startsWith('#')) {
            col = '#ffff00';
          }
          customColorInput.value = col;
          customColorInput.style.display='';
        }
        customWordsTA.value = rule.words.join(', ');
        const origHandler = customAddBtn.onclick;
        customAddBtn.onclick = () => {
          const words = customWordsTA.value.split(/[\n,]/).map(w=>w.trim()).filter(Boolean);
          if (!words.length) { alert('Please enter at least one word.'); return; }
          let colorValue;
          if (customColorSel.value === '__custom__') {
            colorValue = customColorInput.value || '#ffff00';
          } else if (customColorSel.value) {
            colorValue = customColorSel.value;
          } else {
            colorValue = 'yellow';
          }
          const prop = customPropSel.value === 'color' ? 'color' : 'background';
          rule.style = `${prop}:${colorValue};`;
          rule.words = words;
          localStorage.setItem('highlight_custom_rules', JSON.stringify(customRules));
          localStorage.setItem(LS_PROP_KEY, prop);
          localStorage.setItem(LS_COLOR_KEY, colorValue);
          includeCustom = true;
          customChk.checked = true;
          updateStyleWords();
          clearHighlights(container);
          renderAllHighlights();
          refreshCustomTitle();
          customAddBtn.onclick = origHandler;
          closeCustomPanel();
        };
        openCustomPanel();
        return;
      } else {
        alert('Unknown action.');
        return;
      }
    }
    localStorage.setItem('highlight_custom_rules', JSON.stringify(customRules));
    if (!customRules.length) {
      includeCustom = false;
      customChk.checked = false;
    }
    updateStyleWords();
    clearHighlights(container);
    renderAllHighlights();
    refreshCustomTitle();
  }
  function refreshCustomTitle() {
    addBtn.title = customRules.length
      ? 'Custom rules:\n' + showCustomListString() + '\n\nClick = Add | Shift-Click = Manage | Right-Click = Manage'
      : 'No custom rules. Click to add.';
  }
  addBtn.title = 'Add custom terms (Shift- or right-click to manage/delete)';
  addBtn.onclick = (e) => {
    if (e.shiftKey) { manageCustomRules(); refreshCustomTitle(); return; }
    openCustomPanel();
  };
  addBtn.oncontextmenu = (e) => {
    e.preventDefault();
    manageCustomRules();
    refreshCustomTitle();
  };
  customAddBtn.addEventListener('click', () => {
    const termsRaw = customWordsTA.value;
    const words = termsRaw
      .split(/[\n,]/)
      .map(w=>w.trim())
      .filter(Boolean);
    if (!words.length) {
      alert('Please enter at least one word.');
      return;
    }
    let colorValue;
    if (customColorSel.value === '__custom__') {
      colorValue = customColorInput.value || '#ffff00';
    } else if (customColorSel.value) {
      colorValue = customColorSel.value;
    } else {
      colorValue = 'yellow';
    }
    const prop = customPropSel.value === 'color' ? 'color' : 'background';
    let style = `${prop}:${colorValue};`;
    customRules.push({ style, words });
    localStorage.setItem('highlight_custom_rules', JSON.stringify(customRules));
    localStorage.setItem(LS_PROP_KEY, prop);
    localStorage.setItem(LS_COLOR_KEY, colorValue);
    includeCustom = true;
    customChk.checked = true;
    updateStyleWords();
    clearHighlights(container);
    renderAllHighlights();
    refreshCustomTitle();
    closeCustomPanel();
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
    } catch { /* ignore */ }
  }
  container = document.createElement('div');
  container.className = 'aft-container';
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',              // top/right/bottom/left 0
    width: '100vw',
    height: '100vh',
    overflow: 'auto',
    background: '#fff',
    zIndex: 2147483647
  });

  if (embed) {
    embed.style.display = 'none';
  }
  document.body.appendChild(container);
  const viewerDiv = document.createElement('div');
  viewerDiv.className = 'pdfViewer';
  container.appendChild(viewerDiv);
  window.addEventListener('resize', () => {
    const r = embed.getBoundingClientRect();
    Object.assign(container.style, {
      top:   `${r.top}px`,
      left:  `${r.left}px`,
      width: `${r.width}px`,
      height:`${r.height}px`,
    });
  });
  function updateContainer() {
    let r;
    if (embed) {
      const er = embed.getBoundingClientRect();
      r = {top:er.top, left:er.left, width:er.width, height:er.height};
    } else {
      r = {top:0, left:0, width:window.innerWidth, height:window.innerHeight};
    }
    Object.assign(container.style, {
      top:   `${r.top}px`,
      left:  `${r.left}px`,
      width: `${r.width}px`,
      height:`${r.height}px`
    });
  }
  updateContainer();
  window.addEventListener('scroll', updateContainer);
  window.addEventListener('resize', updateContainer);
  let data, fetchUrl, resp;
  try {
    fetchUrl = (embed && embed.getAttribute && embed.getAttribute('original-url')) || location.href;
    resp = await fetch(fetchUrl, { credentials: 'include' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    data = await resp.arrayBuffer();
    console.log('[AFT] fetched PDF bytes:', data.byteLength, 'from', fetchUrl);
  } catch (err) {
    console.error('[AFT] Could not fetch PDF:', err);
    return;
  }
  const pdfDoc      = await pdfjsLib.getDocument({data}).promise;
  const eventBus    = new EventBus();
  const linkService = new PDFLinkService({eventBus});
  const pdfViewer   = new PDFViewer({container, viewer:viewerDiv, eventBus, linkService});
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
      0%   { filter: brightness(1.8) saturate(1.4); transform: scale(1);   }
      50%  { filter: brightness(2.2) saturate(1.8); transform: scale(1.04); }
      100% { filter: brightness(1.0) saturate(1.0); transform: scale(1);   }
    }
    .word-highlight.pulse {
      animation: pulseHighlight 0.9s ease-out 0s 2 alternate;
    }
    .styled-word.pulse {
      animation: pulseHighlight 0.9s ease-out 0s 2 alternate;
    }
  `;
  document.head.appendChild(fix);
  linkService.setViewer(pdfViewer);
  await new Promise(resolve => requestAnimationFrame(resolve));
  pdfViewer.setDocument(pdfDoc);
  pdfViewer.currentScaleValue = 'page-width';
  linkService.setDocument(pdfDoc, null);
  eventBus.on('pagesloaded', () => {
    setTimeout(() => {
      renderAllHighlights();
    }, 300);
  });
  renderAllHighlights();
  eventBus.on('pagesloaded', () => {
    renderAllHighlights();
  });
  const renderedPages = new Set();
  eventBus.on('textlayerrendered', ({ pageNumber }) => {
    const pageView = pdfViewer._pages[pageNumber - 1];
    const textLayer = pageView?.textLayer?.textLayerDiv;
    if (!textLayer) return;
    Array.from(textLayer.querySelectorAll('span')).forEach(span => {
      if (!span.dataset.origStyle) {
        span.dataset.origStyle = span.getAttribute('style') || '';
      }
    });
    renderedPages.add(pageNumber);
    renderAllHighlights();
  });
  let showingStyled = true;
  toggle.onclick = () => {
    showingStyled = !showingStyled;
    if (showingStyled) {
      includeCustom = customChk.checked;
      updateStyleWords();
      container.style.display = '';
      embed.style.display     = 'none';
      hlPanel.style.display   = '';   // show panel
      renderAllHighlights();
      toggle.textContent = 'Original';
    } else {
      includeCustom = false;
      customChk.checked = false;
      updateStyleWords();
      container.style.display = 'none';
      embed.style.display     = '';
      hlPanel.style.display   = 'none'; // hide panel
      toggle.textContent = 'Styled';
    }
  };
  setInterval(() => {
    if (showingStyled && container?.offsetParent !== null) {
      renderAllHighlights();
    }
  }, 100);
}