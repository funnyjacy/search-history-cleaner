// 实时删除搜索引擎结果页的浏览记录。
// 地址栏下拉的「搜索历史」来自历史库，记录不存在就不会弹出。

// 各搜索引擎结果页的 URL 特征（仅匹配路径与关键参数，非整域）。
const SEARCH_PATTERNS = [
  // Google: /search?q= 或 /search?...&q=
  { host: /(^|\.)google\.[a-z.]+$/, test: (u) => u.pathname === '/search' && u.searchParams.has('q') },
  // Bing: /search?q=
  { host: /(^|\.)bing\.com$/, test: (u) => u.pathname === '/search' && u.searchParams.has('q') },
  // 百度: /s?wd=
  { host: /(^|\.)baidu\.com$/, test: (u) => u.pathname === '/s' && u.searchParams.has('wd') },
  // DuckDuckGo: /?q=
  { host: /(^|\.)duckduckgo\.com$/, test: (u) => u.pathname === '/' && u.searchParams.has('q') },
  // 搜狗: /web?query=
  { host: /(^|\.)sogou\.com$/, test: (u) => u.pathname === '/web' && u.searchParams.has('query') },
  // 360: /s?q=
  { host: /(^|\.)so\.com$/, test: (u) => u.pathname === '/s' && u.searchParams.has('q') },
];

function isSearchUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  for (const p of SEARCH_PATTERNS) {
    if (p.host.test(u.hostname) && p.test(u)) return true;
  }
  return false;
}

chrome.history.onVisited.addListener((item) => {
  if (isSearchUrl(item.url)) {
    chrome.history.deleteUrl({ url: item.url });
  }
});
