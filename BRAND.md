# 樂法 Le Phare 視覺規範（供遊戲 UI 換皮）

來源：樂法社群圖（父親節、兒童節、品牌底圖）。特徵：粉霧藍單色＋大量留白、白色或淺藍的線條插畫、細明體風格的「樂法」字標＋襯線「Le Phare」，沒有漸層、沒有木紋、沒有深色陰影。

## 色票（CSS 變數）
```
--brand:#88AEDC        主色 粉霧藍（品牌底色）
--brand-dark:#6B95C9   主色按下／hover、粗字
--brand-soft:#C9DAF0   淺藍（插畫色、選中底、標籤底）
--brand-tint:#E8F0F9   極淺藍（區塊底、分頁未選）
--bg:#F6F9FD           頁面底（帶一點藍的白）
--card:#FFFFFF         卡片
--line:#D7E3F2         邊線
--ink:#2B4460          主要文字（深藍灰，不用純黑、不用咖啡色）
--muted:#6E86A3        次要文字
--ice:#BFE3F2 / --ice-dark:#7CC4E0   冰塊、液體相關（維持可辨識，但往品牌藍靠）
--ok:#5FA98A  --warn:#E0A64B  --bad:#D9776B   語意色（低飽和）
--shadow:0 1px 2px rgba(43,68,96,.06)
```
- 主要按鈕（送出、倒入紙杯、選中的容器分頁、選中的 segmented）：`--brand` 底、白字、無深色邊。
- hover：`--brand-dark`。停用：40% 透明。
- 邊框 1px `--line`，圓角 12px，陰影只保留極淡一層或不用。
- 耐心條：綠→黃→紅改用 `--ok` → `--warn` → `--bad`。
- 客人身體色塊、頭像底：改用 `--brand-soft` 系列的淺藍變化（不要橘／紫／黃）。
- 液體顏色（茶湯、果汁）保留真實色（recipes.js ING.color），那是資訊。

## 字型
- 品牌字標「樂法」：`"Noto Serif TC", "Songti TC", "PMingLiU", serif`，字重 500，字距 .12em；「Le Phare」用同一襯線、小字、字距 .08em、大寫首字。
- 標題（卡片標題、Modal 標題、系列名）：Noto Serif TC 600。
- 內文與數字：`"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif`；數字用 `font-variant-numeric: tabular-nums`。
- Google Fonts 連結：`https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@500;600&family=Noto+Sans+TC:wght@400;500;700&display=swap`（離線時自然退回系統字型，不可因此壞版）。

## 元件對應
- HUD：白底、底部 1px `--line`；左側字標「樂法 Le Phare」用襯線；按鈕白底藍字，hover 淺藍底。
- 櫃台牆：`--bg`，不再用磁磚／木紋圖樣；客人泡泡白卡＋`--line` 邊；chips 用 `--brand-tint` 底、`--ink` 字。
- 工作區四張卡：白卡；卡片標題襯線；容器分頁選中 `--brand`。
- 素材台：分頁藥丸選中 `--brand`；素材格白底，液體色帶保留。
- 右側面板：白卡；分組標頭 `--muted`；送出按鈕 `--brand`。
- Modal：白卡、標題襯線；速記法分頁裡的口訣底、表頭底、chips 全部換成 `--brand-tint`／`--brand-soft`／`--ink`（不要綠、橘、咖啡）。
- 開始畫面：`--brand` 滿版底（像品牌底圖），中央白色襯線字標「樂法」＋「Le Phare」，下方白卡放 Day 選擇與說明。
- 暫停覆蓋層：`rgba(136,174,220,.35)` 藍色半透明。
