# Roughcut Tracker 架構說明

## 1. 專案概述

影視初剪統計工具，用來取代以 Google Sheets 手動維護的初剪進度表。

- 部署位置：GitHub Pages（`lthfilmstudio/Roughcut_tracker`）
- 目前後端：Google Sheets API v4 + OAuth 2.0
- 使用情境：剪輯指導追蹤單一劇集各集數、各場次的初剪與精剪進度

---

## 2. 技術棧

| 層級 | 技術 |
| --- | --- |
| 前端框架 | React 18 + TypeScript |
| 建置工具 | Vite |
| 資料儲存 | Google Sheets（未來考慮遷移至 Firebase） |
| 部署 | GitHub Pages + GitHub Actions 自動部署 |
| 密碼驗證 | bcryptjs + GitHub Secrets |

---

## 3. 資料結構

### Google Sheets 分頁

- `Summary`：各集彙總統計
- `ep01` ~ `ep12`：每集獨立分頁，存放單集所有場次資料

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

### Summary 欄位

| 欄位 | 說明 |
| --- | --- |
| 集數 | ep01 ~ ep12 |
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

- 密碼登入：統一入口，動態路由隱藏多專案
- Dashboard 總覽：3 張統計卡片 + 各集進度表格
- 單集場次頁：ep 標籤列快速切換

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

### 現況

- 單一專案運作：劇集《北城百畫帖》，共 12 集
- 密碼：存於 `.env` + GitHub Secrets（`VITE_APP_PASSWORD`）

### 新增專案流程

- 手動修改 `src/config/sheets.ts`
- 調整 `src/components` 對應元件

### 未來方向

- 支援電影模式（無集數結構，直接進場次頁）

---

## 6. 未來規劃

- **後端遷移**：改用 Firebase Firestore（免費額度更充裕、即時同步原生支援）
- **電影模式**：無集數結構，提供「返回總覽」按鈕
- **多專案管理介面**：取代目前手動修改設定檔的流程
- **PDF 製片報告匯出**
- **搜尋功能**

---

## 7. 重要連結

| 類型 | 連結 |
| --- | --- |
| 正式站 | https://lthfilmstudio.github.io/Roughcut_tracker/ |
| GitHub Repo | https://github.com/lthfilmstudio/Roughcut_tracker |
| Google Sheets ID | `1J5LdXoTVzf2xWE6YsjZ7Y1Wk6xOWLwTLHBi2ohkTeus` |
| 部署狀態 | https://github.com/lthfilmstudio/Roughcut_tracker/actions |
