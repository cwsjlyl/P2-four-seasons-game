# 四季小探險家 3D (P2 Four Seasons Explorer)

專為**香港小學二年級學生**以 **iPad** 遊玩而設計的 3D 四季科學探索網頁遊戲。

## ✨ 核心特色

- **🎨 Switch 級別玩具微縮模型 3D 畫質**：採用 Three.js `PMREMGenerator` 工作室環境反射貼圖（IBL）、Blender Principled BSDF 清漆物理材質（`MeshPhysicalMaterial` Clearcoat）、程序化 Albedo + Bump 法線凹凸貼圖、動態接觸軟陰影（Contact Blob Shadows）及柔和光暈特效。
- **📐 精確物理引擎參數（SI 單位制）**：採用半隱式歐拉積分（重力 $g = -24.5\text{ m/s}^2$、跳躍初速 $v_0 = 10.8\text{ m/s}$），支援四季不同地面摩擦係數（如冬季雪地低摩擦微滑、夏季陣風阻力）、圓角膠囊碰撞檢測（Circle-vs-AABB）及幀率無關（60Hz / 120Hz iPad Pro 一致）的天氣粒子與鏡頭平滑系統。
- **🔊 全方位香港廣東話（`zh-HK`）語音導讀**：每道題目均可自由選擇「讀出問題及全部選項」（連讀並即時高亮顯示）、「只讀問題」、單獨點讀 A/B/C 選項或切換自動讀題開關。
- **📱 香港小二 iPad 專屬體驗**：支援 `100dvh` 安全區、獨立 `pointerId` 雙手多點觸控（左手搖桿＋右手跳躍／衝刺／轉鏡頭互不干擾）、隨機答案排序、40 題附「科學小知識」解說，以及 HTML5 Canvas 高清榮譽證書 PNG 下載。

## 🚀 部署方式

直接啟用 GitHub Pages，或將 `index.html` 嵌入 Google Sites 即可在 iPad Safari 流暢遊玩（零外部資產依賴）。
