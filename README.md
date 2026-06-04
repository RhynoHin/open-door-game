# Mochi Moon Room

一隻 iPhone 玩到嘅 3D 解謎逃出密室小遊戲。玩家要幫可愛嘅 Mochi 喺月光玩具房搵齊三粒星光，啟動門口月亮水晶逃出房間。

## Gameplay

- 3D 程序化房間，包含 Mochi、月亮門、星星鐘、雲朵枕頭、三盞星燈同環境星光。
- 三個輕量密室謎題：轉啱星星鐘、拍開雲朵枕頭、按牆上顏色線索排列星燈。
- 完成謎題會收集星光，觸發粒子、閃光同物件變色特效。
- 收齊三粒星光後點月亮門，會播放開門同通關特效。
- 全程用觸控操作，適合 iPhone 直屏或橫屏。

## Controls

- 拖動畫面：望四周。
- 點物件：直接互動。
- `↺` / `↻`：左右轉視角。
- `摸`：同畫面中央物件互動。
- `?`：顯示提示。
- `重`：重新開始。

## Run Locally

```sh
node server.js
```

如果本機無系統 Node，可以用 Codex 內置 Node：

```sh
/Users/rhyno/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node server.js
```

開啟 `http://127.0.0.1:5173`。同一 Wi-Fi 入面，iPhone 可以開 server 顯示嘅 LAN 網址，例如 `http://192.168.x.x:5173`。

## Deployment

遊戲本身係靜態 HTML/CSS/JS，可以放上 GitHub Pages。`server.js` 只係本地預覽用。
