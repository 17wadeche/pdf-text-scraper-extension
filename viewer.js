const params = new URLSearchParams(location.search);
window.__AFT_FROM_VIEWER = true;
window.__AFT_FETCH_URL   = params.get('src') || '';
import(chrome.runtime.getURL('content.js'));