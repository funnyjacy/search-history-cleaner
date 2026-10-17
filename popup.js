// 弹出面板：显示历史条数，一键清除全部历史
const $ = (id) => document.getElementById(id);

chrome.history.search({ text: '', startTime: 0, maxResults: 0 }).then((items) => {
  // maxResults: 0 表示不限制，返回全部
  $('n').textContent = items.length;
});

$('clear').addEventListener('click', async () => {
  const items = await chrome.history.search({ text: '', startTime: 0, maxResults: 0 });
  const n = items.length;
  await chrome.history.deleteAll();
  $('n').textContent = '0';
  $('done').textContent = `已清除 ${n} 条记录`;
  $('done').style.display = 'block';
});
