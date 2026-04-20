# Roughcut Tracker

影視初剪進度追蹤工具，給剪輯指導管理多個專案（劇集 / 電影）的場次狀態、剪輯長度與交片進度。以 Google Sheets 作為後端，在手機與電腦上都能即時更新。

- 正式站：<https://lthfilmstudio.github.io/Roughcut_tracker/>
- 架構說明（開發者）：[ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 主要功能

- **多專案管理**：一個登入頁同時服務多部作品，用密碼區分專案
- **劇集 / 電影兩種模式**
  - 劇集：總覽頁 + 各集進度表，可 `ep01 ~ epNN` 切換
  - 電影：跳過總覽，直接進場次頁
- **場次編輯**：行內編輯、狀態切換（已初剪 / 已精剪 / 整場刪除）、缺鏡筆記
- **批次操作**：批次新增場次、批次改狀態、批次刪除
- **多種匯出**
  - Markdown（自選欄位，單集 / 全劇）
  - CSV（UTF-8 BOM，可直接丟 Excel）
  - PDF（A4 直書，含浮水印、頁碼、彩色狀態欄）
- **管理者介面**：建立 / 編輯 / 刪除專案，新增專案時自動建立 Google Sheet 與對應分頁
- **三層權限**：Google OAuth + 應用密碼 + Sheet 共用清單

---

## 使用流程

### 一般使用者

1. 打開正式站
2. 以 Google 帳號完成 OAuth 授權（Gmail 登入）
3. 輸入剪輯指導提供的**專案密碼**，進入對應專案
4. 編輯場次、切換狀態、匯出進度表給導演 / 製片

### 管理者（剪輯指導本人）

1. 一般登入頁輸入 **admin 密碼**，會自動進入管理介面
   （備援入口：網址加 `#admin`）
2. 點「+ 新增」建立新專案
   - 系統會自動在你的 Google Drive 建一張 Sheet + 寫入 tabs / header
   - 拿到 Sheet URL 後，把該 Sheet 手動拖進「`00_Roughcut_Tracker`」資料夾集中管理
3. 需要新增協作者時，三層權限都要設定：
   - Google OAuth 帳號（用 Google Sheet 的共用清單）
   - 應用密碼（在管理介面設）
   - Google Sheet 共用權限（到對應 Sheet 直接分享）

---

## 注意事項

- **列印 / PDF 匯出只支援 Chrome**：用到 `zoom`、`counter(pages)`、fixed 浮水印等 Chrome 專屬 CSS，Safari 會排版異常
- **密碼只是前端遮罩**：`VITE_*` 前綴的環境變數會被編進前端 bundle，DevTools 看得到。真正的存取控制仰賴 **Google Sheets 共用權限**，不是應用密碼
- **Sheet 命名慣例**：`Roughcut Tracker_{專案名}`，例如 `Roughcut Tracker_北城百畫帖`
- **本地開發 `.env`**：含 `$` 的值（例如 bcrypt hash）必須 escape 成 `\$`，否則 Vite 的 dotenv 會吃掉。GitHub Secrets 則直接貼原文

---

## 本地開發

```bash
npm install
npm run dev      # 啟動 Vite dev server
npm run build    # TypeScript 型別檢查 + 產出 dist/
```

環境變數（放 `.env` 於專案根目錄）：

```
VITE_GOOGLE_CLIENT_ID=<Google OAuth client id>
VITE_META_SHEET_ID=<多專案索引 Sheet 的 id>
VITE_ADMIN_PASSWORD=<admin 密碼的 bcrypt hash，$ 要 escape 成 \$>
```

---

## 部署

- Push 到 `main` 會觸發 `.github/workflows/deploy.yml`，用官方 `actions/deploy-pages@v4` 自動部署到 GitHub Pages
- GitHub Secrets 要設在 **Repository secrets**（不是 Environment secrets），build job 才讀得到
