// content.js
const ALLOWED_PREFIXES = [
  'https://crm.medtronic.com/sap/bc/contentserver/',
  'https://cpic1cs.corp.medtronic.com:8008/sap/bc/contentserver/',
  'https://crmstage.medtronic.com/sap/bc/contentserver/'
];
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
    } catch { /* ignore cross-origin */ }
  }
  return { viewerEl, embedEl };
}
function startWhenReady() {
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
  let container = null;
  window.__AFT_VERSION = '0.1.3d';
  console.log('[AFT] init v' + window.__AFT_VERSION, location.href);
  const AFT_UI_Z = 21474837000;
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
      #aftCustomPanel {
  border-radius: 10px;
  padding: 12px;
  background: #fff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  font-family: system-ui, sans-serif;
  font-size: 13px;
  width: 320px;
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
  width: 30px;
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
  toggle.textContent = 'Original';
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
    width:300px; max-width:90vw; display:none; z-index:${AFT_UI_Z};
  `;

  const customPanelHdr = document.createElement('div');
  customPanelHdr.textContent = 'Custom Highlights';
  customPanelHdr.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;">
      <span style="font-weight:bold;">☰</span>
      <span style="font-weight:bold;">Custom Highlights</span>
    </div>
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
    font-size: 14px;
    color: red;
    font-weight: bold;
    border: none;
    background: transparent;
    position: absolute;
    top: 6px;
    right: 8px;
    cursor: pointer;
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
    customPanelBody.innerHTML = '';
    if (!customRules.length) {
      const empty = document.createElement('div');
      empty.textContent = 'No custom rules yet.';
      empty.style.marginBottom = '8px';
      customPanelBody.appendChild(empty);
    } else {
      customRules.forEach((rule, idx) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:1fr auto auto;gap:4px;align-items:start;margin-bottom:4px;';
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
        colorInput.style.width='22px'; colorInput.style.padding='0'; colorInput.style.border='none';
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
          updateStyleWords();
          clearHighlights(container);
          renderAllHighlights();
          renderCustomPanel(); // re-render to normalize display
        };

        delBtn.onclick = () => {
          if (!confirm('Delete this custom highlight?')) return;
          customRules.splice(idx,1);
          persistCustomRules();
          if (!customRules.length) {
            includeCustom=false;
            customChk.checked=false;
          }
          updateStyleWords();
          clearHighlights(container);
          renderAllHighlights();
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
      updateStyleWords();
      clearHighlights(container);
      renderAllHighlights();
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
  const hlDragHdr = document.createElement('div');
  hlDragHdr.textContent = 'Style Settings';
  hlDragHdr.style.cssText = 'cursor:move;font-weight:bold;padding:4px;';
  hlPanel.prepend(hlDragHdr);
  hlHeader.textContent = 'Style Settings';
  hlHeader.style.cssText = `
    font-weight:bold; margin-bottom:4px; cursor:move;
    display:flex; align-items:center; justify-content:space-between;
  `;
  let draggingHl = false, hlOffsetX, hlOffsetY;
  hlDragHdr.addEventListener('mousedown', (e) => {
    draggingHl = true;
    const rect = hlPanel.getBoundingClientRect();
    hlOffsetX = e.clientX - rect.left;
    hlOffsetY = e.clientY - rect.top;
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mouseup', () => {
    draggingHl = false;
    document.body.style.userSelect = '';
  });
  document.addEventListener('mousemove', (e) => {
    if (!draggingHl) return;
    hlPanel.style.left = `${e.clientX - hlOffsetX}px`;
    hlPanel.style.top = `${e.clientY - hlOffsetY}px`;
    hlPanel.style.position = 'fixed'; // ensure it's positioned
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
    .word-underline {
      position:absolute;
      pointer-events:none;
      z-index:6;
      height:4px;                /* wave height; scaled in JS */
      background-repeat:repeat-x;
      background-position:left bottom;
      background-size:auto 100%;
      mix-blend-mode:multiply;
    }
  `;
  document.head.appendChild(fix);
  linkService.setViewer(pdfViewer);
  await new Promise(resolve => requestAnimationFrame(resolve));
  pdfViewer.setDocument(pdfDoc);
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
  pdfViewer.currentScaleValue = 'page-width';
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
    if (!hasEmbedForToggle) {
      window.open(fetchUrl + '#noaft', '_blank', 'noopener,noreferrer');
      return;
    }
    showingStyled = !showingStyled;
    if (showingStyled) {
      includeCustom = customChk.checked;
      updateStyleWords();
      container.style.display = '';
      embed.style.display     = 'none';
      hlPanel.style.display   = '';   // show panel
      aftRefreshHighlights('toggle-on');
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
}