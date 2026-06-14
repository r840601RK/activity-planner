# 活動整理網頁

這個資料夾可以直接上傳到 GitHub Pages。至少需要：

- `index.html`
- `styles.css`
- `app.js`

`apps-script.gs` 是 Google Apps Script 後端範例，不需要上傳到 GitHub。

## Google Apps Script 設定

1. 打開 Google Apps Script 專案。
2. 用 `apps-script.gs` 的內容替換原本程式。
3. 確認試算表分頁名稱是 `Data`。
4. 確認第一列表頭是：

```text
id | user | title | date | note | created_at
```

5. 部署為網頁應用程式。
6. 權限建議設定為：

```text
Execute as: Me
Who has access: Anyone
```

## 前端設定

API 位置在 `app.js` 第一行：

```js
const API_URL = "你的 Google Apps Script 網頁應用程式網址";
```

預設使用者在第二行：

```js
const DEFAULT_USER = "";
```

網頁右上角的使用者名稱預設為空白。輸入使用者名稱後按「讀取活動」，前端會依照 `user` 篩選 Google Sheet 裡該使用者的活動。

## 分享碼邏輯

- 勾選活動並產生分享碼：只會把選到的活動編碼成文字。
- 貼上別人的分享碼：只會整合到目前瀏覽器畫面與 localStorage。
- 匯入活動不會寫入 Google Sheets，也不會改到對方資料。
- 刪除自己的活動會呼叫 Apps Script 從 Google Sheets 移除；刪除匯入活動只會從目前瀏覽器畫面移除。

## 日期格式

確定日期會存成：

```text
2026-07-18
```

日期區間會存在同一個 `date` 欄位：

```text
2026-06-14..2026-06-18
```

月份區間會存在同一個 `date` 欄位：

```text
2026-07|early
2026-07|middle
2026-07|late
```

前端會顯示確定日期、日期區間、`2026/07 月初`、`2026/07 月中`、`2026/07 月末`，並標示同日衝突、區間重疊或可能衝突。
