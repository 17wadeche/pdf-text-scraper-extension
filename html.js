// html.js
import { defaultStyleWords, config } from './styles.js';
const ALLOWED_PREFIXES = [
  'https://crm.medtronic.com/sap/bc/contentserver/',
  'https://cpic1cs.corp.medtronic.com:8008/sap/bc/contentserver/'
];
if (ALLOWED_PREFIXES.some(p => location.href.startsWith(p))) {
    (async () => {
    const escapeHTML = s =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    function unwrapHighlights() {
        document
        .querySelectorAll('span[data-highlighted]')
        .forEach(span => span.replaceWith(document.createTextNode(span.textContent)));
    }
    function highlightHTML(styleWords) {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
        const orig = node.textContent;
        let html = escapeHTML(orig);
        styleWords.forEach(({ style, words }) =>
            words.forEach(raw => {
            const safe = raw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
            const re = new RegExp(`\\b(${safe})\\b`, 'gi');
            html = html.replace(
                re,
                `<span style="${style}" data-highlighted="true">$1</span>`
            );
            })
        );
        if (html !== escapeHTML(orig)) {
            const frag = document.createRange().createContextualFragment(html);
            node.parentNode.replaceChild(frag, node);
        }
        }
    }
    let currentBU = localStorage.getItem('highlight_BU') || null;
    let currentOU = localStorage.getItem('highlight_OU') || null;
    let styleWordsToUse = [];
    function updateStyleWords() {
        styleWordsToUse = [...defaultStyleWords];
        if (currentBU && config[currentBU]?.styleWords) {
        styleWordsToUse = [...config[currentBU].styleWords];
        if (currentOU && config[currentBU][currentOU]?.styleWords) {
            styleWordsToUse.push(...config[currentBU][currentOU].styleWords);
        }
        }
    }
    const controlDiv = document.createElement('div');
    Object.assign(controlDiv.style, {
        position: 'fixed',
        top: '10px',
        left: '10px',
        display: 'flex',
        gap: '8px',
        padding: '6px',
        background: '#fff',
        border: '1px solid #ccc',
        zIndex: 2147483647,
    });
    const makeSelect = () => {
        const sel = document.createElement('select');
        sel.classList.add('modern-select');
        sel.style.padding = '4px';
        return sel;
    };
    const buSelect = makeSelect();
    Object.keys(config).forEach(bu => {
        const o = new Option(bu, bu, bu === currentBU, bu === currentBU);
        buSelect.add(o);
    });
    const ouSelect = makeSelect();
    function populateOUs() {
        ouSelect.innerHTML = '';
        if (currentBU && config[currentBU]) {
        Object.keys(config[currentBU])
            .filter(k => k !== 'styleWords')
            .forEach(ou => {
            const o = new Option(ou, ou, ou === currentOU, ou === currentOU);
            ouSelect.add(o);
            });
        }
    }
    populateOUs();
    buSelect.addEventListener('change', () => {
        currentBU = buSelect.value;
        currentOU = null;
        populateOUs();
        currentOU = ouSelect.value;
        localStorage.setItem('highlight_BU', currentBU);
        localStorage.setItem('highlight_OU', currentOU);
        updateStyleWords();
        applyAllHighlights();
    });
    ouSelect.addEventListener('change', () => {
        currentOU = ouSelect.value;
        localStorage.setItem('highlight_OU', currentOU);
        updateStyleWords();
        applyAllHighlights();
    });
    controlDiv.append(buSelect, ouSelect);
    document.head.insertAdjacentHTML(
        'beforeend',
        `<style>
        .modern-select { /* your styles */ }
        .modern-select:focus { /* your styles */ }
        </style>`
    );
    document.body.append(controlDiv);
    let htmlStyled = true;
    const htmlToggle = document.createElement('button');
    htmlToggle.textContent = 'Original HTML';
    Object.assign(htmlToggle.style, {
        position: 'fixed',
        top: '10px',
        right: '10px',
        padding: '6px 12px',
        background: '#ff0',
        color: '#000',
        fontSize: '14px',
        fontWeight: 'bold',
        borderRadius: '4px',
        boxShadow: '0 0 6px rgba(0,0,0,0.5)',
        border: '2px solid #000',
        cursor: 'pointer',
        zIndex: 2147483648,
    });
    htmlToggle.addEventListener('click', () => {
        if (htmlStyled) {
        unwrapHighlights();
        htmlToggle.textContent = 'Styled HTML';
        controlDiv.style.display = 'none';
        } else {
        highlightHTML(styleWordsToUse);
        htmlToggle.textContent = 'Original HTML';
        controlDiv.style.display = 'flex';
        }
        htmlStyled = !htmlStyled;
    });
    document.body.append(htmlToggle);
    function applyAllHighlights() {
        unwrapHighlights();
        highlightHTML(styleWordsToUse);
    }
    updateStyleWords();
    applyAllHighlights();
    })();
}