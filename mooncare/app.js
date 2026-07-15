const views = [...document.querySelectorAll(".view")];
const navButtons = [...document.querySelectorAll(".bottom-nav [data-view-target]")];
const overlay = document.querySelector("#overlay");
const sheets = [...document.querySelectorAll(".sheet")];
const toast = document.querySelector("#toast");
let toastTimer;

const articles = {
  feeding: {
    kicker: "餵哺 · 衞生署家庭健康服務",
    title: "點樣知道初生寶寶食得夠？",
    source: "https://www.fhs.gov.hk/tc_chi/health_info/child/12172.html",
    body: `<p>初生寶寶每餐奶量可以唔同，重點係回應寶寶嘅餵哺訊號，同留意整體狀況。</p><h3>可以觀察</h3><ul><li>第 5 日後每日通常有 5–6 塊重身濕尿片，尿液清澈或淡黃色。</li><li>便便會由胎糞逐步變成黃色；首月通常每日有至少 2 次較大量黃色便便。</li><li>出生後頭幾日體重稍跌可以係正常，一般會喺第 1–2 星期回復出生體重。</li></ul><p>如對餵哺、尿片或體重有疑問，應盡快聯絡母嬰健康院或醫護人員評估。</p>`,
  },
  mood: {
    kicker: "媽媽情緒 · 衞生署家庭健康服務",
    title: "Baby blues 定產後抑鬱？",
    source: "https://www.fhs.gov.hk/tc_chi/health_info/woman/14750.html",
    body: `<p>產後 3–5 日出現短暫易哭、煩躁或情緒不穩並唔罕見，通常數日內會慢慢緩解。</p><h3>幾時要搵人幫手？</h3><ul><li>情緒低落、失去興趣、過分焦慮或自責等情況持續超過兩星期。</li><li>已經明顯影響睡眠、飲食或日常照顧。</li><li>如有幻聽、妄想，或傷害自己／寶寶嘅念頭，屬急症，要立即到急症室或致電 999。</li></ul><p>可向母嬰健康院、家庭醫生、婦產科醫生、社工或心理專業人員求助。</p>`,
  },
  jaundice: {
    kicker: "寶寶健康 · 衞生署家庭健康服務",
    title: "初生黃疸要留意啲咩？",
    source: "https://www.fhs.gov.hk/tc_chi/health_info/child/15666.html",
    body: `<p>新生嬰兒黃疸常喺出生後第 2–3 日出現，但黃疸水平太高或升得太快可以影響腦部。</p><h3>照護重點</h3><ul><li>出院後盡快到母嬰健康院或醫生跟進黃疸、餵哺及體重。</li><li>確保寶寶食得足夠，並留意大小便數量及狀態。</li><li>曬太陽並唔係合適治療方法；治療應由醫護人員監察。</li><li>大便變淡、黃疸超過 2–3 星期或退咗再出現，都要見醫生。</li></ul>`,
  },
  cord: {
    kicker: "日常護理 · 衞生署家庭健康服務",
    title: "臍帶清潔及異常警號",
    source: "https://www.fhs.gov.hk/tc_chi/health_info/child/15669.html",
    body: `<p>照顧臍帶嘅原則係保持清潔同乾爽，處理前後洗手，尿片邊緣唔好遮住臍帶。</p><h3>需要求醫嘅情況</h3><ul><li>周邊皮膚紅腫、流膿、有異味或寶寶發燒。</li><li>少量血漬有時會喺脫落前後出現；如果大量出血，應立即到急症室。</li></ul>`,
  },
};

const helperData = {
  chan: { name: "陳美儀姨姨", initial: "陳", cls: "photo-chan", meta: "12 年經驗 · 港島及九龍", rating: "4.9", reviews: "46 個家庭評價", price: "$29,800 / 26日", credentials: ["陪月員基礎證書", "嬰兒急救證書", "母乳餵哺支援"] },
  leung: { name: "梁慧珊姨姨", initial: "梁", cls: "photo-leung", meta: "8 年經驗 · 新界及九龍", rating: "4.8", reviews: "31 個家庭評價", price: "$1,480 / 晚", credentials: ["陪月員證書", "嬰兒急救證書", "孖胎照護經驗"] },
  wong: { name: "黃秀蘭姨姨", initial: "黃", cls: "photo-wong", meta: "15 年經驗 · 全港", rating: "5.0", reviews: "68 個家庭評價", price: "$35,800 / 26日", credentials: ["陪月導師資歷", "嬰兒急救證書", "母乳餵哺支援"] },
};

const logOptions = {
  feed: { title: "餵奶", label: "餵哺方式", options: ["母乳 · 左邊", "母乳 · 右邊", "樽餵母乳", "配方奶"], className: "peach", icon: "奶" },
  diaper: { title: "換尿片", label: "尿片狀況", options: ["小便", "便便", "小便及便便", "乾爽檢查"], className: "sage", icon: "片" },
  sleep: { title: "睡眠", label: "記錄項目", options: ["寶寶開始睡眠", "寶寶醒來", "媽媽開始休息", "媽媽醒來"], className: "blue", icon: "眠" },
  mood: { title: "媽媽心情", label: "而家感覺", options: ["平穩", "有啲攰", "有啲低落", "焦慮不安", "需要支援"], className: "rose", icon: "心" },
};
let activeLogKind = "feed";

function switchView(name) {
  views.forEach((view) => view.classList.toggle("active", view.dataset.view === name));
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.viewTarget === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openSheet(id) {
  sheets.forEach((sheet) => sheet.classList.add("hidden"));
  document.querySelector(id).classList.remove("hidden");
  overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeSheets() {
  sheets.forEach((sheet) => sheet.classList.add("hidden"));
  overlay.classList.add("hidden");
  document.body.style.overflow = "";
}

function showToast(copy) {
  clearTimeout(toastTimer);
  document.querySelector("#toast-copy").textContent = copy;
  toast.classList.remove("hidden");
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 2800);
}

function configureLog(kind) {
  activeLogKind = kind;
  const config = logOptions[kind];
  document.querySelector("#log-title").textContent = `記錄${config.title}`;
  document.querySelector("#detail-label").textContent = config.label;
  document.querySelector("#log-detail").innerHTML = config.options.map((option) => `<option>${option}</option>`).join("");
  document.querySelectorAll(".log-types button").forEach((button) => button.classList.toggle("active", button.dataset.kind === kind));
}

function openArticle(key) {
  const article = articles[key];
  document.querySelector("#article-kicker").textContent = article.kicker;
  document.querySelector("#article-title").textContent = article.title;
  document.querySelector("#article-body").innerHTML = article.body;
  document.querySelector("#article-source").href = article.source;
  openSheet("#article-sheet");
}

document.querySelectorAll("[data-view-target]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.viewTarget)));
document.querySelectorAll("[data-toast]").forEach((button) => button.addEventListener("click", () => showToast(button.dataset.toast)));
document.querySelectorAll("[data-article]").forEach((button) => button.addEventListener("click", () => openArticle(button.dataset.article)));
document.querySelectorAll(".sheet-close").forEach((button) => button.addEventListener("click", closeSheets));
overlay.addEventListener("click", closeSheets);
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeSheets(); });

document.querySelectorAll("[data-log]").forEach((button) => button.addEventListener("click", () => { configureLog(button.dataset.log); openSheet("#log-sheet"); }));
document.querySelector("#quick-add").addEventListener("click", () => openSheet("#log-sheet"));
document.querySelector("#nav-add").addEventListener("click", () => openVoiceSheet());
document.querySelectorAll(".log-types button").forEach((button) => button.addEventListener("click", () => configureLog(button.dataset.kind)));

document.querySelector("#save-log").addEventListener("click", () => {
  const config = logOptions[activeLogKind];
  const time = document.querySelector("#log-time").value || "現在";
  const detail = document.querySelector("#log-detail").value;
  const item = document.createElement("div");
  item.innerHTML = `<time>${time}</time><span class="log-icon ${config.className}">${config.icon}</span><p><strong>${config.title}</strong><small>${detail} · 自己記錄</small></p>`;
  document.querySelector("#full-log").prepend(item);
  if (activeLogKind === "feed") document.querySelector("#feed-count").textContent = Number(document.querySelector("#feed-count").textContent) + 1;
  if (activeLogKind === "diaper") document.querySelector("#diaper-count").textContent = Number(document.querySelector("#diaper-count").textContent) + 1;
  closeSheets();
  showToast(`${config.title}記錄已同步俾家人`);
});

document.querySelectorAll(".helper-detail").forEach((button) => button.addEventListener("click", () => {
  const helper = helperData[button.dataset.helper];
  const photo = document.querySelector("#sheet-photo");
  photo.className = `helper-photo large ${helper.cls}`;
  photo.textContent = helper.initial;
  document.querySelector("#helper-sheet-name").textContent = helper.name;
  document.querySelector("#helper-sheet-meta").textContent = helper.meta;
  document.querySelector("#sheet-rating").textContent = helper.rating;
  document.querySelector("#sheet-reviews").textContent = helper.reviews;
  document.querySelector("#sheet-price").textContent = helper.price;
  document.querySelector("#sheet-credentials").innerHTML = helper.credentials.map((item) => `<span>${item}</span>`).join("");
  openSheet("#helper-sheet");
}));

document.querySelector("#book-helper").addEventListener("click", () => {
  const name = document.querySelector("#helper-sheet-name").textContent;
  closeSheets();
  showToast(`已建立向 ${name} 查詢檔期嘅草稿`);
});

function filterHelpers() {
  const active = document.querySelector("#filter-row .active").dataset.filter;
  const query = document.querySelector("#helper-search").value.trim().toLowerCase();
  let visible = 0;
  document.querySelectorAll(".caregiver-card").forEach((card) => {
    const tagMatch = active === "all" || card.dataset.tags.includes(active);
    const textMatch = !query || card.dataset.name.toLowerCase().includes(query);
    const show = tagMatch && textMatch;
    card.classList.toggle("hidden", !show);
    if (show) visible += 1;
  });
  document.querySelector("#result-count").textContent = visible;
  document.querySelector("#helper-empty").classList.toggle("hidden", visible !== 0);
}

document.querySelectorAll("#filter-row .chip").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("#filter-row .chip").forEach((chip) => chip.classList.remove("active"));
  button.classList.add("active");
  filterHelpers();
}));
document.querySelector("#helper-search").addEventListener("input", filterHelpers);

document.querySelectorAll(".topic-tabs button").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".topic-tabs button").forEach((tab) => tab.classList.remove("active"));
  button.classList.add("active");
  document.querySelectorAll(".article-card").forEach((card) => card.classList.toggle("hidden", button.dataset.topic !== "all" && card.dataset.topic !== button.dataset.topic));
}));

document.querySelector("#help-btn").addEventListener("click", () => openSheet("#urgent-sheet"));
document.querySelector("#urgent-btn").addEventListener("click", () => openSheet("#urgent-sheet"));

const mealWeeks = {
  1: { number: "01", kicker: "產後第 1–7 日", title: "清淡、均衡、容易入口", copy: "先照顧胃口、補充水分及均衡營養；餐單按媽媽實際情況及醫護／中醫建議調整。", foods: ["番茄薯仔瘦肉湯", "節瓜魚片湯", "雞蛋、豆腐、深綠色蔬菜", "魚、瘦肉、全穀物"] },
  2: { number: "02", kicker: "產後第 8–14 日", title: "溫和調理，配合胃口", copy: "保持蛋白質、蔬果和全穀物攝取；如已接受中醫評估，可套用醫師確認的食療方向。", foods: ["紅棗淮山瘦肉湯", "粟米豆腐魚湯", "蒸雞、鱸魚、菜心", "水果、低糖芝麻糊"] },
  3: { number: "03", kicker: "產後第 15–21 日", title: "補充體力，留意餵哺需要", copy: "按活動量和餵哺方式調整份量，保持足夠水分；避免將『補身』等同進食大量高脂或高糖食物。", foods: ["蓮藕章魚瘦肉湯", "南瓜雞肉糙米飯", "豆類、魚、蛋、奶類替代品", "時令蔬果"] },
  4: { number: "04", kicker: "產後第 22–28 日", title: "穩定過渡，建立長期習慣", copy: "逐步回復全家都適合的均衡餐單，保留個人禁忌及中醫師已確認的調理原則。", foods: ["合掌瓜魚尾湯", "冬菇蒸雞配時蔬", "全穀物、豆腐、瘦肉", "低糖小食及水果"] },
};

const tcmDoctors = {
  lam: { initial: "林", name: "林曉晴醫師", meta: "婦科及產後調理 · 11 年經驗" },
  ho: { initial: "何", name: "何俊賢醫師", meta: "內科及食療 · 8 年經驗" },
};

function openVoiceSheet() {
  document.querySelector("#voice-record-btn").classList.remove("recording");
  document.querySelector("#voice-record-btn b").textContent = "按一下開始示範";
  document.querySelector("#voice-wave").classList.add("hidden");
  document.querySelector("#structured-records").classList.add("hidden");
  document.querySelector("#voice-save").classList.add("hidden");
  openSheet("#voice-sheet");
}

document.querySelectorAll("#records-voice, #ai-voice, #voice-card-btn").forEach((button) => button.addEventListener("click", openVoiceSheet));

let voiceTimer;
document.querySelector("#voice-record-btn").addEventListener("click", () => {
  const button = document.querySelector("#voice-record-btn");
  if (button.classList.contains("recording")) return;
  clearTimeout(voiceTimer);
  button.classList.add("recording");
  button.querySelector("b").textContent = "AI 正在整理你講嘅內容…";
  document.querySelector("#voice-wave").classList.remove("hidden");
  voiceTimer = setTimeout(() => {
    button.classList.remove("recording");
    button.querySelector("b").textContent = "完成 · 可以再講一次";
    document.querySelector("#voice-wave").classList.add("hidden");
    document.querySelector("#structured-records").classList.remove("hidden");
    document.querySelector("#voice-save").classList.remove("hidden");
  }, 1500);
});

document.querySelector("#voice-save").addEventListener("click", () => {
  document.querySelector("#feed-count").textContent = Number(document.querySelector("#feed-count").textContent) + 1;
  document.querySelector("#diaper-count").textContent = Number(document.querySelector("#diaper-count").textContent) + 1;
  const item = document.createElement("div");
  item.innerHTML = `<time>10:00</time><span class="log-icon peach">聲</span><p><strong>語音新增 4 項記錄</strong><small>餵奶、換片、媽媽脹奶、午餐 · 自己確認</small></p>`;
  document.querySelector("#full-log").prepend(item);
  closeSheets();
  showToast("4 項語音記錄已確認及同步");
});

document.querySelectorAll("[data-record-tab]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-record-tab]").forEach((tab) => tab.classList.toggle("active", tab === button));
  document.querySelectorAll("[data-record-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.recordPanel === button.dataset.recordTab));
}));

let activeMealWeek = "1";
document.querySelectorAll("[data-meal-week]").forEach((button) => button.addEventListener("click", () => {
  const week = mealWeeks[button.dataset.mealWeek];
  activeMealWeek = button.dataset.mealWeek;
  document.querySelectorAll("[data-meal-week]").forEach((tab) => tab.classList.toggle("active", tab === button));
  document.querySelector("#week-number").textContent = week.number;
  document.querySelector("#week-kicker").textContent = week.kicker;
  document.querySelector("#week-title").textContent = week.title;
  document.querySelector("#week-copy").textContent = week.copy;
  document.querySelector("#week-foods").innerHTML = week.foods.map((food) => `<span>${food}</span>`).join("");
}));

document.querySelectorAll(".tcm-connect").forEach((button) => button.addEventListener("click", () => {
  const doctor = tcmDoctors[button.dataset.tcm];
  document.querySelector("#tcm-sheet-avatar").textContent = doctor.initial;
  document.querySelector("#tcm-sheet-name").textContent = doctor.name;
  document.querySelector("#tcm-sheet-meta").textContent = doctor.meta;
  openSheet("#tcm-sheet");
}));

document.querySelector("#tcm-book").addEventListener("click", () => {
  const doctor = document.querySelector("#tcm-sheet-name").textContent;
  closeSheets();
  showToast(`已建立向 ${doctor} 查詢診症方式及時段嘅草稿`);
});

document.querySelector("#tongue-btn").addEventListener("click", () => openSheet("#tongue-sheet"));
document.querySelector("#tongue-input").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const preview = document.querySelector("#tongue-preview");
  const image = document.createElement("img");
  image.alt = "已選擇的舌相預覽";
  image.src = URL.createObjectURL(file);
  preview.replaceChildren(image);
});
document.querySelector("#tongue-send").addEventListener("click", () => {
  closeSheets();
  showToast("舌相拍攝質素檢查完成；尚未傳送俾醫師（示範）");
});

document.querySelector("#shopping-list-btn").addEventListener("click", () => {
  document.querySelector("#shopping-sheet .eyebrow").textContent = `AI 買餸助手 · 第 ${activeMealWeek} 週`;
  document.querySelector("#shopping-title").textContent = `第 ${activeMealWeek} 週 · 7 日餐單合併清單`;
  openSheet("#shopping-sheet");
});
document.querySelector("#save-shopping-list").addEventListener("click", () => {
  closeSheets();
  showToast(`第 ${activeMealWeek} 週買餸清單已儲存及分享俾陪月（示範）`);
});
