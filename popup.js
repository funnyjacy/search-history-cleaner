// 弹出面板：历史记录列表（分组/过滤/排序/多选删除）+ 一键清除全部
const $ = (id) => document.getElementById(id);

const PAGE_SIZE = 100;

let items = [];               // 已加载的历史记录
let endTime = null;           // 翻页游标：上一批最后一条的 lastVisitTime
let hasMore = false;
let selected = new Set();     // 已勾选记录的 id
const openGroups = new Set(); // 已展开的域名组

// ---------- 主域名提取 ----------
// 两段式公共后缀清单（常见值），命中时主域名取最后三段。
const TWO_PART_SUFFIXES = new Set([
  'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn', 'ac.cn',
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk',
  'com.hk', 'org.hk', 'edu.hk', 'com.tw', 'org.tw', 'edu.tw',
  'co.jp', 'ne.jp', 'or.jp', 'com.jp',
  'co.kr', 'com.kr', 'com.sg', 'com.au', 'net.au', 'org.au',
]);

function registrableDomain(hostname) {
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return hostname;
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  const last2 = parts.slice(-2).join('.');
  if (TWO_PART_SUFFIXES.has(last2)) return parts.slice(-3).join('.');
  return last2;
}

// ---------- 时间格式化 ----------
function fmtTime(t) {
  if (!t) return '';
  const d = new Date(t);
  const now = new Date();
  const hm = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
  if (d.toDateString() === now.toDateString()) return '今天 ' + hm;
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return '昨天 ' + hm;
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm;
}

// ---------- 数据加载 ----------
async function loadPage() {
  const opts = { text: '', startTime: 0, maxResults: PAGE_SIZE };
  if (endTime !== null) opts.endTime = endTime;
  const batch = await chrome.history.search(opts);
  const seen = new Set(items.map((it) => it.id));
  const fresh = batch.filter((it) => !seen.has(it.id));
  if (fresh.length) {
    items.push(...fresh);
    endTime = fresh[fresh.length - 1].lastVisitTime;
  }
  hasMore = batch.length >= 100;
  return fresh.length > 0;
}

// ---------- 分组构建 ----------
function buildGroups(filtered) {
  const map = new Map();
  for (const it of filtered) {
    const u = new URL(it.url);
    // 非常规 URL（file:///、chrome://newtab 等）可能没有 hostname
    const main = u.hostname
      ? registrableDomain(u.hostname)
      : (u.protocol === 'file:' ? '本地文件' : u.protocol.replace(/:$/, '') || '其他');
    if (!map.has(main)) map.set(main, { subs: new Map(), latest: 0, total: 0 });
    const g = map.get(main);
    if (!g.subs.has(u.hostname)) g.subs.set(u.hostname, []);
    g.subs.get(u.hostname).push(it);
    if (it.lastVisitTime > g.latest) g.latest = it.lastVisitTime;
    g.total += it.visitCount || 1;
  }
  const groups = [];
  for (const [main, g] of map) {
    groups.push({ main, subs: g.subs, latest: g.latest, total: g.total });
  }
  const mode = document.getElementById('sort').value;
  const byTime = (a, b) => b.latest - a.latest;
  const byCount = (a, b) => (b.total - a.total) || byTime(a, b);
  if (mode === 'count-desc') {
    groups.sort(byCount);
  } else if (mode === 'count-asc') {
    groups.sort((a, b) => (a.total - b.total) || byTime(a, b));
  } else {
    groups.sort(byTime);
  }
  for (const g of groups) {
    for (const arr of g.subs.values()) {
      arr.sort((a, b) => b.lastVisitTime - a.lastVisitTime);
    }
  }
  return groups;
}

// ---------- 渲染 ----------
function render() {
  const list = $('list');
  list.textContent = '';
  const q = $('filter').value.trim().toLowerCase();
  const filtered = q
    ? items.filter((it) =>
        (it.title || '').toLowerCase().includes(q) || it.url.toLowerCase().includes(q))
    : items;

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = q ? '无匹配记录' : '暂无历史记录';
    list.appendChild(empty);
    $('more').style.display = hasMore ? 'block' : 'none';
    return;
  }

  const groups = buildGroups(filtered);
  for (const g of groups) {
    const wrap = document.createElement('div');
    wrap.className = 'group' + (openGroups.has(g.main) ? ' open' : '');
    wrap.dataset.main = g.main;

    // 组头：三角 + 主域名 + 展开按钮语义
    const head = document.createElement('div');
    head.className = 'group-head';
    head.title = '点击展开/折叠';
    const tri = document.createElement('span');
    tri.className = 'tri';
    head.appendChild(tri);
    const name = document.createElement('span');
    name.className = 'gname';
    name.textContent = g.main;
    head.appendChild(name);
    const cnt = document.createElement('span');
    cnt.className = 'gcount';
    const subCount = g.subs.size;
    const recCount = [...g.subs.values()].reduce((s, a) => s + a.length, 0);
    cnt.textContent = subCount + '个子域/' + recCount + '条';
    head.appendChild(cnt);
    head.addEventListener('click', () => {
      if (openGroups.has(g.main)) openGroups.delete(g.main);
      else openGroups.add(g.main);
      render();
    });
    wrap.appendChild(head);

    // 展开区：子域名小标题 + 记录行
    if (openGroups.has(g.main)) {
      for (const [sub, arr] of g.subs) {
        const sh = document.createElement('div');
        sh.className = 'subhead';
        sh.textContent = sub + ' (' + arr.length + ')';
        wrap.appendChild(sh);
        for (const it of arr) {
          const row = document.createElement('div');
          row.className = 'row';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = selected.has(it.id);
          cb.addEventListener('change', () => {
            if (cb.checked) selected.add(it.id);
            else selected.delete(it.id);
            updateDelBtn();
          });
          row.appendChild(cb);

          const info = document.createElement('div');
          info.className = 'info';
          const a = document.createElement('a');
          a.href = it.url;
          a.target = '_blank';
          a.textContent = it.title || it.url;
          info.appendChild(a);
          const meta = document.createElement('div');
          meta.className = 'meta';
          meta.textContent = fmtTime(it.lastVisitTime) + ' · ' + it.visitCount + ' 次';
          info.appendChild(meta);
          row.appendChild(info);

          const del = document.createElement('button');
          del.className = 'del';
          del.textContent = '×';
          del.title = '删除该条';
          del.addEventListener('click', () => deleteItems([it.id]));
          row.appendChild(del);

          wrap.appendChild(row);
        }
      }
    }
    list.appendChild(wrap);
  }
  $('more').style.display = hasMore ? 'block' : 'none';
}

// ---------- 删除 ----------
async function deleteItems(ids) {
  const byId = new Map(items.map((it) => [it.id, it]));
  const urls = ids.map((id) => byId.get(id)).filter(Boolean).map((it) => it.url);
  await Promise.all(urls.map((url) => chrome.history.deleteUrl({ url: url })));
  const idSet = new Set(ids);
  items = items.filter((it) => !idSet.has(it.id));
  ids.forEach((id) => selected.delete(id));
  updateDelBtn();
  refreshTotal();
  render();
}

// ---------- 事件绑定 ----------
$('filter').addEventListener('input', () => {
  $('clearFilter').style.display = $('filter').value ? 'block' : 'none';
  render();
});

$('clearFilter').addEventListener('click', () => {
  $('filter').value = '';
  $('clearFilter').style.display = 'none';
  render();
});

$('sort').addEventListener('change', render);
$('more').addEventListener('click', async () => {
  $('more').disabled = true;
  await loadPage();
  $('more').disabled = false;
  updateDelBtn();
  render();
});

$('delSelected').addEventListener('click', async () => {
  if (!selected.size) return;
  $('delSelected').disabled = true;
  await deleteItems([...selected]);
});

$('selAll').addEventListener('click', () => {
  const q = $('filter').value.trim().toLowerCase();
  const filtered = q
    ? items.filter((it) =>
        (it.title || '').toLowerCase().includes(q) || it.url.toLowerCase().includes(q))
    : items;
  const ids = filtered.map((it) => it.id);
  const allSel = ids.length && ids.every((id) => selected.has(id));
  if (allSel) ids.forEach((id) => selected.delete(id));
  else ids.forEach((id) => selected.add(id));
  updateDelBtn();
  render();
});

$('clear').addEventListener('click', async () => {
  await chrome.history.deleteAll();
  items = [];
  selected.clear();
  openGroups.clear();
  endTime = null;
  hasMore = false;
  $('n').textContent = '0';
  $('done').textContent = '已清除全部历史';
  $('done').style.display = 'block';
  render();
});

function updateDelBtn() {
  $('delSelected').disabled = selected.size === 0;
  $('delSelected').textContent = selected.size
    ? '删除选中项 (' + selected.size + ')'
    : '删除选中项';
}

function refreshTotal() {
  chrome.history.search({ text: '', startTime: 0, maxResults: 0 }).then((all) => {
    $('n').textContent = String(all.length);
  });
}

// ---------- 启动 ----------
(async function init() {
  await loadPage();
  updateDelBtn();
  render();
  refreshTotal();
})();
