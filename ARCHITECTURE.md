# Roughcut Tracker 架構說明

## 1. 專案概述

影視初剪統計工具，用來取代以 Google Sheets 手動維護的初剪進度表。

- 部署位置：GitHub Pages（`lthfilmstudio/Roughcut_tracker`）
- 目前後端：Google Sheets API v4 + OAuth 2.0
- 使用情境：剪輯指導追蹤多個專案（劇集 / 電影）的初剪與精剪進度

---

## 2. 技術棧

| 層級 | 技術 |
| --- | --- |
| 前端框架 | React 18 + TypeScript |
| 建置工具 | Vite |
| 資料儲存 | Google Sheets（透過 DataService 抽象，未來可換 Firebase） |
| 狀態管理 | React Context（ProjectContext） |
| 部署 | GitHub Pages + GitHub Actions 自動部署 |
| 密碼驗證 | bcryptjs + GitHub Secrets |

---

## 3. 資料結構

### DataService 抽象層

- `src/services/dataService.ts`：定義介面，呼叫端只依賴抽象
- `src/services/googleSheetsService.ts`：目前實作（Sheets API v4）
- `src/services/index.ts`：`getDataService(token)` 工廠函式
- 未來換 Firebase 只需新增 `firebaseService.ts` 並切換工廠回傳

### Meta Sheet（多專案中央索引）

| 欄位 | 說明 |
| --- | --- |
| id | 專案代碼（如 `beicheng`） |
| name | 顯示名稱 |
| type | `series`（劇集）或 `film`（電影） |
| passwordHash | bcrypt hash |
| sheetId | 該專案的 Google Sheets ID |
| episodeCount | 集數（劇集用） |
| episodePrefix | 集數前綴（如 `ep`） |
| createdAt | 建立時間 |

### 專案 Sheet 分頁

- 劇集（series）：`Summary` + `ep01` ~ `epNN`
- 電影（film）：單一場次分頁，無集數結構

### 場次欄位（ep 分頁）

| 欄位 | 格式 | 說明 |
| --- | --- | --- |
| 場次 | 字串 | 支援 `1`、`3A`、`3ins`、`3insA` 等混合格式 |
| 初剪長度 | `HH:MM:SS` | 時間長度 |
| 頁數 | 數字 | 劇本頁數 |
| 日期 | `YYYY/MM/DD` | 拍攝或剪輯日期 |
| 狀態 | 列舉 | `已初剪` / `已精剪` / `整場刪除` |
| 尚缺鏡頭 | 字串 | 缺鏡說明 |
| 備註 | 字串 | 自由備註 |

### Summary 欄位（劇集模式）

| 欄位 | 說明 |
| --- | --- |
| 集數 | ep01 ~ epNN |
| 已初剪 % | 該集初剪完成比例 |
| 已精剪 % | 該集精剪完成比例 |
| 已初剪時長 | 初剪累計時長 |
| 已精剪時長 | 精剪累計時長 |
| 總時長 | 該集全部場次時長 |
| 已初剪場次 | 初剪完成場次數 |
| 已精剪場次 | 精剪完成場次數 |
| 總場次 | 該集場次總數 |
| 已初剪頁數 | 初剪完成頁數 |
| 已精剪頁數 | 精剪完成頁數 |
| 頁均時長 | 平均每頁劇本長度 |

---

## 4. 核心功能

### 登入與導覽

- **統一登入入口**：密碼欄位同時比對 admin hash 與所有專案 hash
  - 命中 admin → 直接進管理介面
  - 命中專案 → 進入該專案
  - `#admin` 是備援入口，驗證邏輯相同
- **OAuth + 應用密碼**：先跑 Google OAuth 拿 token，再驗應用密碼
- Dashboard 總覽（劇集模式）：3 張統計卡片 + 各集進度表格
- 單集場次頁：ep 標籤列快速切換
- **電影模式**：跳過 Dashboard，直接進場次頁，使用 `SummaryBar` sticky 統計列；場次表格由 `SceneTable` 共用元件提供

### 場次管理

- **新增場次**：手動單筆 + 自動批次產生（指定起始到結束場次）
- **編輯場次**：行內編輯、Enter 儲存、Escape 取消，可修改場次名稱
- **場次排序**：數字排序邏輯（`1, 2, 3, 3A, 3ins, 3insA, 4...`）
- **篩選**：全部 / 已精剪 / 已初剪 / 尚缺鏡頭 / 整場刪除 / 有備註

### 匯出

- **Markdown**：可自選欄位，總覽頁與單集頁皆可匯出
- **CSV**：可自選欄位，UTF-8 BOM，總覽頁與單集頁皆可匯出

### 資料同步

- Google Sheets 即時同步
- 快取優化：批次讀取以減少 API 請求
- 403 錯誤友善提示

---

## 5. 多專案架構

### 運作方式

- 所有專案註冊在 **Meta Sheet**（`VITE_META_SHEET_ID`）
- 登入後依密碼命中的專案，從 Meta 取得 `sheetId` 動態載入該專案 Sheet
- 專案狀態由 `src/contexts/ProjectContext.tsx` 管理
- 既有專案：`beicheng`（北城百畫帖，劇集模式，12 集）

### 管理介面（AdminDashboard）

- 進入方式：登入頁輸入 admin 密碼，或網址加 `#admin`
- 功能：CRUD Meta Sheet 中的專案（新增、編輯、刪除）
- **進入專案 →**：admin 直接跳該專案，沿用現有 OAuth token，不需重新輸密碼
- **← 返回管理介面**：admin 進專案後，登出按鈕變成返回管理介面

### 三層權限模型

1. Google OAuth（gmail 認證）
2. 應用密碼（bcrypt 比對 Meta Sheet）
3. Google Sheets 共用權限（Google 端授權，每張 Sheet 各自獨立）

新增使用者時三層都要設定，缺一不可。詳細 SOP 與排查紀錄在 memory。

---

## 6. 未來規劃

- **後端遷移**：DataService 抽象已就位，可改用 Firebase Firestore（免費額度更充裕、即時同步原生支援）
- **多人協作 / 即時同步**：需要後端介入
- **PDF 製片報告匯出**
- **搜尋功能**

---

## 7. 重要連結

| 類型 | 連結 |
| --- | --- |
| 正式站 | https://lthfilmstudio.github.io/Roughcut_tracker/ |
| GitHub Repo | https://github.com/lthfilmstudio/Roughcut_tracker |
| Dev Repo（實驗環境） | https://github.com/lthfilmstudio/Roughcut_tracker_dev |
| Meta Sheet ID | `1h354ePt0-Oq9JsIzSmH6ZrM7GhH7biAJHoTL5YmnDFE` |
| 北城專案 Sheet ID | `1J5LdXoTVzf2xWE6YsjZ7Y1Wk6xOWLwTLHBi2ohkTeus` |
| 部署狀態 | https://github.com/lthfilmstudio/Roughcut_tracker/actions |
