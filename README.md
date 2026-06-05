# Elite Ring Clash

一隻 AEW-style fan-made 摔角卡牌對戰 game。內容、角色、音樂同特效都係原創，玩法受電視摔角節奏啟發：出招、反擊、搶 hype，三個 falls 決勝。

## Gameplay

- Offline 兩個人：同一部機 hot-seat，輪流揀卡再 reveal。
- Online 兩個人：開房 / 入房，用 WebSocket 房號同步出招。
- 卡牌類型包括 strike、grapple、risk、counter、taunt。
- HP、hype、pin pressure 同 falls 會影響勝負。
- Web Audio 生成原創 entrance beat、bell、撞擊同 finisher 音效。
- Canvas 粒子、ring lights、crowd lights 同 card glow 特效。

## Controls

- 點 / tap 卡牌：出招。
- `音樂`：開關原創背景 beat。
- `F`：fullscreen。
- `Esc`：返回 menu。

## Run Locally

```sh
node server.js
```

開啟 `http://127.0.0.1:5173`。同一 Wi-Fi 入面，另一部機可以開 server 顯示嘅 LAN 網址，例如 `http://192.168.x.x:5173`。

## Deployment

Offline game 本身係靜態 HTML/CSS/JS，可以放上 GitHub Pages。Online 模式需要 `server.js` 或等效 WebSocket host。
