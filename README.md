# 搜索历史清理器（Search History Cleaner）

Chrome 扩展：实时删除搜索引擎结果页的浏览记录，使**地址栏下拉不再弹出搜索历史**。

## 原理

Chrome 扩展无法直接控制地址栏下拉框（那是浏览器原生 UI），但下拉里的「搜索历史」来自历史数据库——记录不存在，就不会弹出。本扩展监听每一次页面访问，命中搜索引擎结果页特征时立即用 `chrome.history.deleteUrl` 删除该记录，搜索记录根本不会进入历史库。

## 特性

- 实时删除，无空窗期
- 覆盖 Google / Bing / 百度 / DuckDuckGo / 搜狗 / 360 的搜索结果页
- 无差别删除（不区分从地址栏发起还是从网页点过去）
- 保留普通网页的浏览历史

## 已知边界

- **不处理地址栏输入时的 Google 网络联想词**（来自 Google 联想服务，不是本机历史）。若也想关闭，请到 Chrome 设置 → 同步和 Google 服务 中关闭相关开关。
- 搜索记录被真删：Ctrl+H 里也不会再有搜索记录。

## 安装（开发者模式）

1. 下载本仓库到本地
2. 打开 `chrome://extensions`
3. 打开右上角「开发者模式」
4. 点「加载已解压的扩展程序」，选择本目录

> 注：Chrome 137+ 的正式版已移除 `--load-extension` 命令行参数支持；自动化场景可用 CDP 的 `Extensions.loadUnpacked`（需启动参数 `--enable-unsafe-extension-debugging`）。

## 文件

- `manifest.json` — MV3 清单，仅需 `history` 权限
- `background.js` — service worker，`onVisited` 监听 + URL 特征匹配 + 删除
