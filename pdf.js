// pdf.js
import { defaultStyleWords, config } from './styles.js';
const ALLOWED_PREFIXES = [
  'https://crm.medtronic.com/sap/bc/contentserver/',
  'https://cpic1cs.corp.medtronic.com:8008/sap/bc/contentserver/'
];
if (ALLOWED_PREFIXES.some(p => location.href.startsWith(p))) {
    (async () => {
    const origUrl = document.querySelector('embed')?.getAttribute('original-url') || location.href;
    let data;
    try {
        data = await fetch(origUrl, { credentials: 'include' }).then(r => r.arrayBuffer());
    } catch {
        return;
    }
    const pdfjs = await import(chrome.runtime.getURL('pdf.mjs'));
    pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs');
    const pdf = await pdfjs.getDocument({ data }).promise;
    let fullText = '';
    function extractLines(tc) {
        const rows = {};
        tc.items.forEach(item => {
        const y = Math.round(item.transform[5] * 10) / 10;
        rows[y] = rows[y] || [];
        rows[y].push({ x: item.transform[4], str: item.str });
        });
        return Object.keys(rows)
        .map(Number)
        .sort((a, b) => b - a)
        .map(y =>
            rows[y]
            .sort((a, b) => a.x - b.x)
            .map(o => o.str)
            .join(' ')
        );
    }
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        extractLines(tc).forEach(line => (fullText += line + '\n'));
        fullText += '\n';
    }
    let currentBU = localStorage.getItem('highlight_BU') || null;
    let currentOU = localStorage.getItem('highlight_OU') || null;
    let styleWords = [];
    function updateStyleWords() {
        styleWords = [...defaultStyleWords];
        if (currentBU && config[currentBU]?.styleWords) {
        styleWords = [...config[currentBU].styleWords];
        if (currentOU && config[currentBU][currentOU]?.styleWords) {
            styleWords.push(...config[currentBU][currentOU].styleWords);
        }
        }
    }
    function escapeHTML(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function renderStyled(container) {
        container.innerHTML = fullText
        .split('\n')
        .map(line => {
            let e = escapeHTML(line);
            styleWords.forEach(({ style, words }) =>
            words.forEach(raw => {
                const safe = raw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
                const re = new RegExp(`\\b(${safe})\\b`, 'gi');
                e = e.replace(re, `<span style="${style}">$1</span>`);
            })
            );
            return e;
        })
        .join('<br>');
    }
    updateStyleWords();
    const container = document.createElement('div');
    Object.assign(container.style, {
        position: 'fixed',
        top: '50px',
        left: '10px',
        width: '100vw',
        height: 'calc(100vh - 60px)',
        overflow: 'auto',
        zIndex: 2147483647,
        background: '#f0f0f0',
        border: '2px solid #444',
        padding: '8px',
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
    });
    renderStyled(container);
    document.body.append(container);
    let pdfStyled = true;
    const pdfToggle = document.createElement('button');
    pdfToggle.textContent = 'Original PDF';
    Object.assign(pdfToggle.style, {
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
    pdfToggle.addEventListener('click', () => {
        if (pdfStyled) {
        container.style.display = 'none';
        pdfToggle.textContent = 'Styled PDF';
        document.querySelectorAll('.modern-select, button').forEach(el => {
            if (el !== pdfToggle) el.style.display = 'none';
        });
        } else {
        container.style.display = 'block';
        pdfToggle.textContent = 'Original PDF';
        document.querySelectorAll('.modern-select, button').forEach(el => {
            if (el !== pdfToggle) el.style.display = '';
        });
        }
        pdfStyled = !pdfStyled;
    });
    document.body.append(pdfToggle);
    })();
}