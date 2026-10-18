# GreenKit English

安親班英文練習網站（Unit 1～3）。非官方、粉絲自製教材，僅供學習使用。

- `index.html`：首頁，選單元和練習方式。
- `practice.html?u=1&m=s`：句型練習；`m=l` 是聽力練習（瀏覽器語音朗讀）。每回隨機 15 題。
- `banks/unit-N.md`：題庫。**改 .md 就是改網站題目**，寫法見 `banks/README.md`。
- `assets/`：程式、樣式、角色圖。

沒有產生（build）步驟。網站用 fetch 讀 .md，所以要用網址開啟（本機可以用 `py -m http.server`）。
