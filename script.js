// ==========================================
// 住宅房型檢核系統 - 核心邏輯腳本
// ==========================================

let radarChartInstance = null;

// 通用浴室選項範本 (8項指標)
const bathCriteriaTemplate = [
  { name: "開窗", opts: [{ l: "無開窗", v: 0 }, { l: "有開窗", v: 1.0 }], d: 0 },
  { name: "套件數", opts: [{ l: "兩件式", v: 0.6 }, { l: "三件式", v: 1.0 }, { l: "四件式", v: 1.2 }], d: 1 },
  { name: "洗臉檯面寬度", opts: [{ l: "<60cm", v: "not ok" }, { l: ">60cm", v: 0.6 }, { l: ">70cm", v: 1.0 }, { l: ">80cm", v: 1.2 }], d: 1 },
  { name: "馬桶空間寬度", opts: [{ l: "<74cm", v: "not ok" }, { l: ">74cm", v: 0.6 }, { l: ">80cm", v: 1.0 }], d: 1 },
  { name: "淋浴間尺寸", opts: [{ l: "<80x80cm", v: "not ok" }, { l: ">80x80cm", v: 0.6 }, { l: ">90x90cm", v: 1.0 }, { l: ">1x1m", v: 1.2 }], d: 1 },
  { name: "浴缸尺寸", opts: [{ l: "未設置", v: 0 }, { l: "<145cm", v: 0.6 }, { l: ">145cm", v: 1.0 }], d: 0 },
  { name: "乾溼分離", opts: [{ l: "無", v: "not ok" }, { l: "有", v: 1.0 }], d: 1 },
  { name: "三角配置", opts: [{ l: "是", v: 0 }, { l: "否", v: 1.0 }], d: 1 }
];

// 次臥房選項範本生成器 (10項指標)
function createSecondaryBedroomCriteria() {
  return [
    { name: "採光", opts: [{ l: "無採光", v: "not ok" }, { l: "間接採光", v: 0.6 }, { l: "直接採光", v: 1.0 }], d: 2 },
    { name: "陽台", opts: [{ l: "無連接", v: 0 }, { l: "有連接", v: 1.0 }], d: 0 },
    { name: "是否為套房", opts: [{ l: "否", v: 0 }, { l: "是", v: 1.0 }], d: 0, isSuiteTrigger: true },
    { name: "床邊走道數", opts: [{ l: "<一邊", v: "not ok" }, { l: "一邊", v: 0.6 }, { l: "兩邊", v: 0.8 }, { l: "三邊", v: 1.0 }], d: 2 },
    { name: "床邊走道淨寬", opts: [{ l: "<50cm", v: 0 }, { l: ">50cm", v: 0.6 }, { l: ">60cm", v: 1.0 }, { l: ">70cm", v: 1.2 }], d: 2 },
    { name: "衣櫃長度", opts: [{ l: "<120cm", v: 0 }, { l: ">120cm", v: 0.6 }, { l: ">140cm", v: 0.8 }, { l: ">160cm", v: 1.0 }, { l: ">180cm", v: 1.2 }], d: 1 },
    { name: "衣櫃深度", opts: [{ l: "<60cm", v: "not ok" }, { l: ">60cm", v: 1.0 }, { l: ">65cm", v: 1.2 }], d: 1 },
    { name: "衣櫃前淨空間", opts: [{ l: "<60cm", v: 0 }, { l: ">60cm", v: 1.0 }, { l: ">70cm", v: 1.2 }], d: 1 },
    { name: "是否留設梳妝台", opts: [{ l: "無", v: 0 }, { l: "有", v: 1.0 }], d: 1 },
    { name: "床具尺寸", opts: [{ l: "單人床", v: 0.4 }, { l: "加大單人床", v: 0.8 }, { l: "雙人床", v: 0.6 }, { l: ">5x6.5尺", v: 1.0 }], d: 2 }
  ];
}

// 系統核心空間資料庫模型
let spaces = [
  {
    id: "xuan_guan", name: "玄關", enabled: true,
    criteria: [
      { name: "走道淨寬", opts: [{ l: "<90cm", v: "not ok" }, { l: ">90cm", v: 0.6 }, { l: ">100cm", v: 1.0 }, { l: ">120cm", v: 1.2 }], d: 1 },
      { name: "鞋櫃長度", opts: [{ l: "未設置", v: "not ok" }, { l: "<60cm", v: 0.6 }, { l: ">60cm", v: 1.0 }, { l: ">90cm", v: 1.2 }, { l: ">120cm", v: 1.4 }], d: 2 },
      { name: "衣帽間", opts: [{ l: "未設置", v: 0 }, { l: "一般衣帽間", v: 1.0 }, { l: "電子衣櫃專用", v: 1.2 }], d: 0 }
    ]
  },
  {
    id: "ke_ting", name: "客廳", enabled: true,
    criteria: [
      { name: "採光", opts: [{ l: "無採光", v: 0 }, { l: "間接採光", v: 0.6 }, { l: "直接採光", v: 1.0 }], d: 2 },
      { name: "連接陽台", opts: [{ l: "無連接", v: 0 }, { l: "有連接", v: 1.0 }], d: 0 },
      { name: "客廳深度", opts: [{ l: "<2.8m", v: "not ok" }, { l: "<3m", v: 0.6 }, { l: ">3m", v: 1.0 }, { l: ">3.2m", v: 1.2 }, { l: ">3.6m", v: 1.4 }], d: 2 },
      { name: "沙發座數", opts: [{ l: "座位<居住人數", v: 0.6 }, { l: "符合居住人數", v: 1.0 }], d: 1 }
    ]
  },
  {
    id: "can_ting", name: "餐廳", enabled: true,
    criteria: [
      { name: "採光", opts: [{ l: "無採光", v: 0 }, { l: "間接採光", v: 1.0 }, { l: "直接採光", v: 1.2 }], d: 1 },
      { name: "餐桌座位數", opts: [{ l: "不符合人數", v: "not ok" }, { l: "符合居住人數", v: 1.0 }], d: 1 },
      { name: "座椅移動空間", opts: [{ l: "<70cm", v: "not ok" }, { l: ">70cm", v: 0.6 }, { l: ">75cm", v: 0.8 }, { l: ">80cm", v: 1.0 }, { l: ">90cm", v: 1.2 }], d: 3 }
    ]
  },
  {
    id: "chu_fang", name: "廚房", enabled: true,
    criteria: [
      { name: "檯面深度", opts: [{ l: "<60cm", v: "not ok" }, { l: ">60cm", v: 1.0 }], d: 1 },
      { name: "料理台寬度", opts: [{ l: "<60cm", v: 0.0 }, { l: ">60cm", v: 0.6 }, { l: ">70cm", v: 0.8 }, { l: ">80cm", v: 1.0 }, { l: ">90cm", v: 1.2 }], d: 1 },
      { name: "走道淨寬", opts: [{ l: "<70cm", v: "not ok" }, { l: ">70cm", v: 0.6 }, { l: ">80cm", v: 1.0 }, { l: ">90cm", v: 1.2 }, { l: ">100cm", v: 1.4 }], d: 2 },
      { name: "排油煙路徑", opts: [{ l: ">5m", v: 0.6 }, { l: "<5m", v: 0.8 }, { l: "<1m", v: 1.0 }], d: 1 },
      { name: "留設電器櫃位置", opts: [{ l: "無電器櫃", v: 0 }, { l: "有", v: 1.0 }], d: 1 },
      { name: "設置中島", opts: [{ l: "未設置", v: 0 }, { l: "有設置", v: 1.0 }], d: 0 },
      { name: "連接工作陽台", opts: [{ l: "無連接", v: 0 }, { l: "有連接", v: 1.0 }], d: 0 }
    ]
  },
  {
    id: "zhong_dao", name: "中島空間", enabled: false,
    criteria: [
      { name: "中島檯面長度", opts: [{ l: "<120cm", v: 0.6 }, { l: "120~180cm", v: 1.0 }, { l: ">180cm", v: 1.2 }], d: 1 },
      { name: "中島檯面深度", opts: [{ l: "<60cm", v: "not ok" }, { l: "60~80cm", v: 1.0 }, { l: ">80cm", v: 1.2 }], d: 1 },
      { name: "環狀走道淨寬", opts: [{ l: "<80cm", v: "not ok" }, { l: "80~90cm", v: 0.8 }, { l: ">90cm", v: 1.0 }], d: 2 },
      { name: "留設水槽", opts: [{ l: "無留設", v: 0 }, { l: "有留設", v: 1.0 }], d: 0 },
      { name: "留設輕食IH爐", opts: [{ l: "無留設", v: 0 }, { l: "有留設", v: 1.0 }], d: 0 },
      { name: "結合餐桌機能", opts: [{ l: "無結合", v: 0 }, { l: "有結合", v: 1.0 }], d: 0 }
    ]
  },
  {
    id: "yang_tai", name: "工作陽台", enabled: true,
    criteria: [
      { name: "設置室外機", opts: [{ l: "無設置", v: "not ok" }, { l: "有設置", v: 1.0 }], d: 1 },
      { name: "設置洗衣機", opts: [{ l: "無設置", v: "not ok" }, { l: "有設置", v: 1.0 }], d: 1 },
      { name: "設置洗衣槽", opts: [{ l: "無設置", v: 0.0 }, { l: "有設置", v: 1.0 }], d: 1 },
      { name: "設置升降曬衣架", opts: [{ l: "無設置", v: "not ok" }, { l: "有設置", v: 1.0 }], d: 1 },
      { name: "開門窗干涉", opts: [{ l: "有影響", v: 0 }, { l: "無影響", v: 1.0 }], d: 1 },
      { name: "坪數大小", opts: [{ l: "<1坪", v: 0.0 }, { l: ">1坪", v: 0.6 }, { l: ">1.2坪", v: 1.0 }], d: 1 }
    ]
  },
  {
    id: "zhu_wo", name: "主臥房", enabled: true,
    criteria: [
      { name: "採光", opts: [{ l: "無採光", v: "not ok" }, { l: "間接採光", v: 0.6 }, { l: "直接採光", v: 1.0 }], d: 2 },
      { name: "陽台", opts: [{ l: "無連接", v: 0 }, { l: "有連接", v: 1.0 }], d: 0 },
      { name: "是否為套房", opts: [{ l: "否", v: 0 }, { l: "是", v: 1.0 }], d: 1, isSuiteTrigger: true },
      { name: "床邊留設走道數", opts: [{ l: "<三邊", v: "not ok" }, { l: "三邊", v: 1.0 }], d: 1 },
      { name: "床邊走道淨寬", opts: [{ l: "<50cm", v: 0 }, { l: ">50cm", v: 0.6 }, { l: ">60cm", v: 1.0 }, { l: ">70cm", v: 1.2 }, { l: ">80cm", v: 1.4 }, { l: ">90cm", v: 1.6 }], d: 2 },
      { name: "衣櫃長度", opts: [{ l: "<150cm", v: "not ok" }, { l: ">150cm", v: 0.6 }, { l: ">180cm", v: 0.8 }, { l: ">200cm", v: 1.0 }, { l: ">250cm", v: 1.2 }, { l: ">300cm", v: 1.6 }], d: 3 },
      { name: "衣櫃深度", opts: [{ l: "<60cm", v: "not ok" }, { l: ">60cm", v: 1.0 }, { l: ">65cm", v: 1.2 }], d: 1 },
      { name: "衣櫃前淨空間", opts: [{ l: "<60cm", v: 0 }, { l: ">60cm", v: 1.0 }, { l: ">70cm", v: 1.2 }, { l: ">80cm", v: 1.4 }, { l: ">90cm", v: 1.6 }], d: 1 },
      { name: "是否留設梳妝台", opts: [{ l: "無", v: "not ok" }, { l: "有", v: 1.0 }], d: 1 },
      { name: "床具尺寸", opts: [{ l: "<5x6.5尺", v: 0.6 }, { l: "=5x6.5尺", v: 1.0 }, { l: ">6x6.2尺", v: 1.2 }, { l: ">6x6.5尺", v: 1.4 }, { l: ">6x7尺", v: 1.6 }], d: 1 }
    ]
  },
  { id: "zhu_wo_bath", name: "主臥浴室", enabled: false, isSuiteBath: true, criteria: JSON.parse(JSON.stringify(bathCriteriaTemplate)) },
  { id: "ci_wo_1", name: "次臥房 1", enabled: true, criteria: createSecondaryBedroomCriteria() },
  { id: "ci_wo_1_bath", name: "次臥浴室 1", enabled: false, isSuiteBath: true, criteria: JSON.parse(JSON.stringify(bathCriteriaTemplate)) },
  { id: "ci_wo_2", name: "次臥房 2", enabled: false, criteria: createSecondaryBedroomCriteria() },
  { id: "ci_wo_2_bath", name: "次臥浴室 2", enabled: false, isSuiteBath: true, criteria: JSON.parse(JSON.stringify(bathCriteriaTemplate)) },
  { id: "ci_wo_3", name: "次臥房 3", enabled: false, criteria: createSecondaryBedroomCriteria() },
  { id: "ci_wo_3_bath", name: "次臥浴室 3", enabled: false, isSuiteBath: true, criteria: JSON.parse(JSON.stringify(bathCriteriaTemplate)) },
  { id: "ke_yu", name: "浴室 (公用客浴)", enabled: true, criteria: JSON.parse(JSON.stringify(bathCriteriaTemplate)) },
  {
    id: "plus_one", name: "+1 房", enabled: false,
    criteria: [
      { name: "開窗", opts: [{ l: "無開窗", v: 0 }, { l: "有開窗", v: 1.0 }], d: 1 },
      { name: "淨寬", opts: [{ l: "小於2m", v: 0.5 }, { l: "大於2m", v: 1.0 }], d: 0 },
      { name: "可否配置床具", opts: [{ l: "無配置", v: 0 }, { l: "單人床", v: 1.0 }, { l: "雙人床", v: 1.2 }], d: 1 },
      { name: "是否設置衣櫃", opts: [{ l: "無配置", v: 0 }, { l: "有配置", v: 1.0 }], d: 1 }
    ]
  }
];

// 初始化使用者留設標記 (userActive 預設全開)
spaces.forEach(sp => { if (sp.userActive === undefined) sp.userActive = true; });
const defaultSpacesData = JSON.parse(JSON.stringify(spaces));

// ==========================================
// 共用輔助函式 (Helper Functions)
// ==========================================

// 快速取得輸入框純文字
const getIptVal = (id, fallback = "") => {
  const el = document.getElementById(id);
  return el && el.value.trim() ? el.value.trim() : fallback;
};

// 同步下拉選單選取值至畫面 DOM
function syncSelectUI(spaceId, critIdx, val) {
  const card = document.getElementById(`card_${spaceId}`);
  if (card) {
    const selects = card.querySelectorAll("select.crit-select");
    if (selects[critIdx]) selects[critIdx].value = val;
  }
}

// 取得當前房型與勾選狀態
function getCurrentLayoutState() {
  const selEl = document.getElementById("selBedrooms");
  const chkPlusOne = document.getElementById("chkPlusOne");
  return {
    roomType: selEl ? parseInt(selEl.value) : 2,
    hasPlusOne: chkPlusOne ? chkPlusOne.checked : false
  };
}

// 空間卡片顯隱控制
function setEnable(id, isEnable) {
  const sp = spaces.find(s => s.id === id);
  if (sp) {
    sp.enabled = isEnable;
    const card = document.getElementById(`card_${id}`);
    if (card) card.classList.toggle("hidden", !isEnable);
  }
}

// 檢查特定空間是否設定為套房
function checkIsSuite(spaceId) {
  const sp = spaces.find(s => s.id === spaceId);
  if (!sp) return false;
  const crit = sp.criteria.find(c => c.name === "是否為套房");
  return crit ? crit.opts[crit.d].l === "是" : false;
}

// ==========================================
// 空間渲染與連動控制
// ==========================================

// 動態建構空間卡片 DOM
function renderSpaces() {
  const container = document.getElementById("spacesContainer");
  if (!container) return;
  container.innerHTML = "";

  spaces.forEach((sp, spIdx) => {
    const card = document.createElement("div");
    card.className = `space-card ${sp.enabled ? '' : 'hidden'} ${!sp.userActive ? 'is-disabled' : ''} ${sp.isSuiteBath ? 'is-suite-bath' : ''}`;
    card.id = `card_${sp.id}`;

    let criteriaHtml = "";
    sp.criteria.forEach((crit, critIdx) => {
      let optHtml = "";
      crit.opts.forEach((opt, optIdx) => {
        optHtml += `<option value="${optIdx}" ${optIdx === crit.d ? "selected" : ""}>${opt.l} (${opt.v})</option>`;
      });
      criteriaHtml += `
        <div class="crit-group">
          <label class="crit-label">${crit.name}</label>
          <select class="crit-select" ${!sp.userActive ? 'disabled' : ''} onchange="onCritChange(${spIdx}, ${critIdx}, this)">
            ${optHtml}
          </select>
        </div>
      `;
    });

    const badgeHtml = sp.isSuiteBath ? `<span class="badge" style="font-size:0.75rem; background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:999px;">專屬套浴</span>` : "";

    card.innerHTML = `
      <div class="space-header">
        <div class="space-title">
          <label class="space-active-toggle" title="勾選代表本案有留設此空間機能">
            <input type="checkbox" id="toggle_${sp.id}" ${sp.userActive ? 'checked' : ''} onchange="toggleSpaceActive('${sp.id}', this.checked)" style="width:15px; height:15px; cursor:pointer;">
            <span>${sp.name}</span>
          </label>
          ${badgeHtml}
        </div>
        <div class="space-scores">
          <span>低標: <b id="low_${sp.id}">0.0</b></span>
          <span>高標: <b id="high_${sp.id}">0.0</b></span>
          <span>實得: <b id="raw_${sp.id}" style="color:var(--primary)">0.0</b></span>
        </div>
      </div>
      <div class="criteria-grid">${criteriaHtml}</div>
    `;
    container.appendChild(card);
  });

  updateSuiteOptions(2);
  updateLayoutConfig();
  updateSpecTitle();
}

// 評估指標變更監聽
function onCritChange(spIdx, critIdx, el) {
  const sp = spaces[spIdx];
  const crit = sp.criteria[critIdx];
  crit.d = parseInt(el.value);

  // 防呆：衛浴若選四件式，自動配置浴缸預設值
  if (crit.name === "套件數" && crit.opts[crit.d]?.l === "四件式") {
    const tubIdx = sp.criteria.findIndex(c => c.name === "浴缸尺寸");
    if (tubIdx !== -1) {
      const targetTubIdx = sp.criteria[tubIdx].opts.findIndex(o => o.l === "<145cm");
      if (targetTubIdx !== -1) {
        sp.criteria[tubIdx].d = targetTubIdx;
        syncSelectUI(sp.id, tubIdx, targetTubIdx);
      }
    }
  }

  // 是否引發空間卡片顯隱連動
  if (crit.name === "是否為套房" || (sp.id === "chu_fang" && crit.name === "設置中島")) {
    updateLayoutConfig();
  } else {
    calculateAll();
  }
}

// 切換特定空間留設狀態（取消勾選視為建商未規劃該機能）
function toggleSpaceActive(spaceId, isActive) {
  const sp = spaces.find(s => s.id === spaceId);
  if (!sp) return;

  sp.userActive = isActive;
  const card = document.getElementById(`card_${spaceId}`);
  if (card) {
    card.classList.toggle("is-disabled", !isActive);
    card.querySelectorAll("select.crit-select").forEach(sel => sel.disabled = !isActive);
  }
  calculateAll();
}

// 核心排版狀態更新（房型按鈕 / +1房 / 套房連動）
function updateLayoutConfig() {
  const { roomType, hasPlusOne } = getCurrentLayoutState();

  // 1. 常態機能空間（2房以上 或 1房含+1房 啟用玄關）
  setEnable("xuan_guan", roomType >= 2 || (roomType === 1 && hasPlusOne));
  ["ke_ting", "can_ting", "chu_fang", "yang_tai", "zhu_wo", "ke_yu"].forEach(id => setEnable(id, true));

  // 2. 次臥房動態開展
  setEnable("ci_wo_1", roomType >= 2);
  setEnable("ci_wo_2", roomType >= 3);
  setEnable("ci_wo_3", roomType >= 4);

  // 3. 獨立套浴依房間是否設定為套房連動
  setEnable("zhu_wo_bath", checkIsSuite("zhu_wo"));
  setEnable("ci_wo_1_bath", roomType >= 2 && checkIsSuite("ci_wo_1"));
  setEnable("ci_wo_2_bath", roomType >= 3 && checkIsSuite("ci_wo_2"));
  setEnable("ci_wo_3_bath", roomType >= 4 && checkIsSuite("ci_wo_3"));

  // 4. +1房與中島空間連動
  setEnable("plus_one", hasPlusOne);
  const kitchen = spaces.find(s => s.id === "chu_fang");
  const islandOpt = kitchen ? kitchen.criteria.find(c => c.name === "設置中島") : null;
  setEnable("zhong_dao", islandOpt ? islandOpt.opts[islandOpt.d].l === "有設置" : false);

  calculateAll();
}

// ==========================================
// 評分計算與基準判定
// ==========================================

// 判定特定空間在當前房型下是否為「法定/基準必備空間」
function isBaselineRequiredSpace(spaceId, roomType, hasPlusOne) {
  if (spaceId === "xuan_guan") return roomType >= 2 || (roomType === 1 && hasPlusOne);
  if (spaceId === "ci_wo_1") return roomType >= 2;
  if (spaceId === "ci_wo_2") return roomType >= 3;
  if (spaceId === "ci_wo_3") return roomType >= 4;

  const coreSpaces = ["ke_ting", "can_ting", "chu_fang", "yang_tai", "zhu_wo", "ke_yu"];
  if (coreSpaces.includes(spaceId)) {
    // 獨立1房無+1房時，餐廳允許省略不計入門檻
    return !(spaceId === "can_ting" && roomType === 1 && !hasPlusOne);
  }
  return false;
}

// 全空間計分計算引擎
function calculateAll() {
  const { roomType, hasPlusOne } = getCurrentLayoutState();
  let totalLow = 0, totalHigh = 0, totalRaw = 0;

  spaces.forEach((sp) => {
    let spLow = 0, spHigh = 0, spRaw = 0;
    const isRequired = isBaselineRequiredSpace(sp.id, roomType, hasPlusOne);

    // 門檻母體：必備基準空間（即使未留設仍計算母體門檻）或非必備但實質啟用的空間
    const countIntoThreshold = sp.enabled && (isRequired || sp.userActive !== false);
    // 實得分數：案子必須實質留設（userActive 為 true）才計分
    const countIntoRaw = sp.enabled && (sp.userActive !== false);

    sp.criteria.forEach((crit) => {
      const validScores = crit.opts.filter(o => typeof o.v === 'number').map(o => o.v);
      const minVal = validScores.length ? Math.min(...validScores) : 0;
      const maxVal = validScores.length ? Math.max(...validScores) : 0;

      if (countIntoThreshold) {
        spLow += minVal;
        spHigh += maxVal;
      }
      if (countIntoRaw) {
        const selOpt = crit.opts[crit.d];
        if (selOpt && selOpt.v !== "not ok") {
          spRaw += Number(selOpt.v);
        }
      }
    });

    const elLow = document.getElementById(`low_${sp.id}`);
    const elHigh = document.getElementById(`high_${sp.id}`);
    const elRaw = document.getElementById(`raw_${sp.id}`);
    if (elLow) elLow.innerText = spLow.toFixed(1);
    if (elHigh) elHigh.innerText = spHigh.toFixed(1);
    if (elRaw) elRaw.innerText = spRaw.toFixed(1);

    totalLow += spLow;
    totalHigh += spHigh;
    totalRaw += spRaw;
  });

  const dispLow = document.getElementById("dispLow");
  const dispHigh = document.getElementById("dispHigh");
  const dispRaw = document.getElementById("dispRaw");
  if (dispLow) dispLow.innerText = totalLow.toFixed(1);
  if (dispHigh) dispHigh.innerText = totalHigh.toFixed(1);
  if (dispRaw) dispRaw.innerText = totalRaw.toFixed(1);

  // 換算 60~100 分標準分
  let finalScore = 60.0;
  if (totalHigh > totalLow) {
    finalScore = 60.0 + ((totalRaw - totalLow) / (totalHigh - totalLow)) * 40.0;
  }
  finalScore = Math.max(0, Math.min(100, finalScore));

  const finalEl = document.getElementById("dispFinal");
  if (finalEl) {
    finalEl.innerText = finalScore.toFixed(1);
    finalEl.style.color = finalScore >= 80 ? "var(--success)" : finalScore >= 60 ? "var(--primary)" : "var(--danger)";
  }

  updateRadarChart();
}

// ==========================================
// 房型設定、套房配置與極端值套用
// ==========================================

// 房型預設切換 (1/2/3/4 房)
function setPreset(roomNum) {
  const selEl = document.getElementById("selBedrooms");
  if (selEl) selEl.value = roomNum;

  document.querySelectorAll(".type-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("onclick") === `setPreset('${roomNum}')`);
  });

  updateSuiteOptions(parseInt(roomNum));
  updateLayoutConfig();
}

// 取得當前房型啟用的臥房 ID 清單
function getActiveBedroomIds(roomType) {
  const rooms = ["zhu_wo"];
  if (roomType >= 2) rooms.push("ci_wo_1");
  if (roomType >= 3) rooms.push("ci_wo_2");
  if (roomType >= 4) rooms.push("ci_wo_3");
  return rooms;
}

// 依房型動態重組「套房數量」選單
function updateSuiteOptions(roomType) {
  const suiteSel = document.getElementById("selSuiteCount");
  if (!suiteSel) return;

  const currentVal = parseInt(suiteSel.value);
  let html = "";
  for (let i = 0; i <= roomType; i++) {
    html += `<option value="${i}">${i === 0 ? "0 套 (全雅房)" : `${i} 套房`}</option>`;
  }
  suiteSel.innerHTML = html;

  const defaultCount = Math.min(roomType, isNaN(currentVal) ? 1 : currentVal);
  suiteSel.value = defaultCount;
  applySuiteAllocation(defaultCount, roomType);
  updateSpecTitle();
}

// 依指定數量依序指派套房 (主臥 -> 次臥1 -> 次臥2 -> 次臥3)
function applySuiteAllocation(count, roomType) {
  getActiveBedroomIds(roomType).forEach((roomId, idx) => {
    const isSuite = idx < count ? 1 : 0;
    const sp = spaces.find(s => s.id === roomId);
    if (sp) {
      const suiteCritIdx = sp.criteria.findIndex(c => c.name === "是否為套房");
      if (suiteCritIdx !== -1) {
        sp.criteria[suiteCritIdx].d = isSuite;
        syncSelectUI(roomId, suiteCritIdx, isSuite);
      }
    }
  });
}

// 手動切換套房數量下拉選單
function onSuiteCountChange(count) {
  const { roomType } = getCurrentLayoutState();
  applySuiteAllocation(count, roomType);
  updateLayoutConfig();
  updateSpecTitle();
}

// 切換 +1 房開關
function togglePlusOne(checked) {
  updateLayoutConfig();
  updateSpecTitle();
}

// 一鍵套用最高分 (max) 或最低門檻分 (min)
function applyExtremePreset(mode) {
  spaces.forEach((sp) => {
    sp.criteria.forEach((crit, critIdx) => {
      const validOpts = crit.opts.map((opt, idx) => ({ ...opt, origIdx: idx })).filter(opt => typeof opt.v === 'number');
      if (!validOpts.length) return;

      const targetOpt = mode === 'max'
        ? validOpts.reduce((prev, curr) => (curr.v > prev.v ? curr : prev))
        : validOpts.reduce((prev, curr) => (curr.v < prev.v ? curr : prev));

      crit.d = targetOpt.origIdx;
      syncSelectUI(sp.id, critIdx, targetOpt.origIdx);
    });
  });

  updateLayoutConfig();
  updateSpecTitle();
}

// 全面還原系統初始預設值
function resetToDefault() {
  defaultSpacesData.forEach((origSp, spIdx) => {
    const sp = spaces[spIdx];
    sp.userActive = origSp.userActive ?? true;

    const chkToggle = document.getElementById(`toggle_${sp.id}`);
    if (chkToggle) chkToggle.checked = sp.userActive;

    const card = document.getElementById(`card_${sp.id}`);
    if (card) {
      card.classList.toggle("is-disabled", !sp.userActive);
      card.querySelectorAll("select.crit-select").forEach(sel => sel.disabled = !sp.userActive);
    }

    origSp.criteria.forEach((origCrit, critIdx) => {
      sp.criteria[critIdx].d = origCrit.d;
      syncSelectUI(sp.id, critIdx, origCrit.d);
    });
  });

  const chkPlusOne = document.getElementById("chkPlusOne");
  if (chkPlusOne) chkPlusOne.checked = false;

  const suiteSel = document.getElementById("selSuiteCount");
  if (suiteSel) suiteSel.value = 1;

  removeFloorPlan();

  const iptConclusion = document.getElementById("iptConclusion");
  if (iptConclusion) iptConclusion.value = "";
  const dispConclusion = document.getElementById("dispConclusion");
  if (dispConclusion) dispConclusion.innerText = "";

  setPreset('2');
}

// ==========================================
// 圖表、標題與報表匯出
// ==========================================

// 計算目前房型規格標籤字串
function getFormattedRoomSpec() {
  const { roomType, hasPlusOne } = getCurrentLayoutState();
  const suiteSel = document.getElementById("selSuiteCount");
  const suiteCount = suiteSel ? suiteSel.value : "1";
  return `${roomType}${hasPlusOne ? "+1" : ""}房/${suiteCount}套房`;
}

// 即時同步網頁標題與規格標籤
function updateSpecTitle() {
  const specEl = document.getElementById("dispRoomSpec");
  if (specEl) specEl.innerText = getFormattedRoomSpec();

  const projectName = getIptVal("iptProjectName", "未指定建案");
  const unitNumber = getIptVal("iptUnitNumber", "未指定戶號");

  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const fullTitle = `${dateStr}_${projectName}_${unitNumber}_房型檢核報表`;

  document.title = fullTitle;
  try {
    if (window.top && window.top !== window) window.top.document.title = fullTitle;
  } catch (e) { /* 跨域環境忽略 */ }
}

// 動態更新空間機能指標雷達圖（依房型基準空間常駐顯示，未留設者以 0 分計）
function updateRadarChart() {
  const canvas = document.getElementById("radarChart");
  if (!canvas || typeof Chart === "undefined") return;

  const { roomType, hasPlusOne } = getCurrentLayoutState();

  // 1. 軸向空間過濾：
  // 凡是「房型啟用的必備基準空間 (isRequired)」OR「使用者有留設且啟用的空間 (sp.userActive !== false)」皆納入雷達圖
  const chartSpaces = spaces.filter(sp => {
    if (!sp.enabled) return false;
    const isRequired = isBaselineRequiredSpace(sp.id, roomType, hasPlusOne);
    return isRequired || sp.userActive !== false;
  });

  const labels = chartSpaces.map(sp => sp.name);

  // 2. 計算各空間在雷達圖上的標準分
  const dataValues = chartSpaces.map(sp => {
    // 關鍵：建商若未留設該空間 (userActive 為 false)，直接以 0 分計
    if (sp.userActive === false) {
      return 0;
    }

    const low = parseFloat(document.getElementById(`low_${sp.id}`)?.innerText || 0);
    const high = parseFloat(document.getElementById(`high_${sp.id}`)?.innerText || 1);
    const raw = parseFloat(document.getElementById(`raw_${sp.id}`)?.innerText || 0);

    if (high <= low) return 100;

    // 常態換算標準分 (低標60，高標100；低於低標時等比扣減)
    const score = 60.0 + ((raw - low) / (high - low)) * 40.0;
    return Math.max(0, Math.min(100, Math.round(score)));
  });

  // 3. 高標 (100分) 與低標 (60分) 基準線資料
  const highThresholdData = labels.map(() => 100);
  const lowThresholdData = labels.map(() => 60);

  // 4. 定義三組 Dataset
  const chartDatasets = [
    {
      label: "本案評估得分",
      data: dataValues,
      backgroundColor: "rgba(30, 58, 138, 0.2)",
      borderColor: "#1e3a8a",
      pointBackgroundColor: "#1e3a8a",
      pointBorderColor: "#fff",
      borderWidth: 2.5,
      order: 1
    },
    {
      label: "高標滿分線 (100分)",
      data: highThresholdData,
      backgroundColor: "transparent",
      borderColor: "rgba(22, 163, 74, 0.6)", // 綠色虛線
      borderWidth: 1.5,
      borderDash: [4, 4],
      pointRadius: 0,
      order: 2
    },
    {
      label: "低標合格線 (60分)",
      data: lowThresholdData,
      backgroundColor: "transparent",
      borderColor: "rgba(220, 38, 38, 0.5)", // 紅色虛線
      borderWidth: 1.5,
      borderDash: [3, 3],
      pointRadius: 0,
      order: 3
    }
  ];

  if (radarChartInstance) {
    radarChartInstance.data.labels = labels;
    radarChartInstance.data.datasets = chartDatasets;
    radarChartInstance.update();
  } else {
    radarChartInstance = new Chart(canvas.getContext("2d"), {
      type: "radar",
      data: {
        labels: labels,
        datasets: chartDatasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 10, bottom: 15, left: 15, right: 15 }
        },
        scales: {
          r: {
            min: 0,   // 設為 0，讓缺項或 0 分空間明確凹陷至中心圓點
            max: 100,
            ticks: {
              stepSize: 20,
              font: { size: 10 }
            },
            pointLabels: {
              font: { size: 11, weight: "bold" },
              color: "#334155"
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: {
              boxWidth: 16,
              font: { size: 11, weight: "600" },
              color: "#475569"
            }
          }
        }
      }
    });
  }
}

// 輸出 A4 列印報表 PDF
function exportReportPDF() {
  const low = document.getElementById("dispLow")?.innerText || "0.0";
  const high = document.getElementById("dispHigh")?.innerText || "0.0";
  const raw = document.getElementById("dispRaw")?.innerText || "0.0";
  const finalEl = document.getElementById("dispFinal");
  const final = finalEl ? finalEl.innerText : "60.0";
  const finalColor = finalEl ? window.getComputedStyle(finalEl).color : "#1e3a8a";

  const projectName = getIptVal("iptProjectName", "未指定建案");
  const unitNumber = getIptVal("iptUnitNumber", "未指定戶號");
  const roomSpec = getFormattedRoomSpec();

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  updateSpecTitle();

  const conclusionVal = getIptVal("iptConclusion", "");
  const dispConclusion = document.getElementById("dispConclusion");
  if (dispConclusion) dispConclusion.innerText = conclusionVal || "本案整體空間規劃良好，動線流暢且機能配置完善。";

  let summaryBox = document.getElementById("printSummaryBox");
  if (!summaryBox) {
    summaryBox = document.createElement("div");
    summaryBox.id = "printSummaryBox";
    summaryBox.className = "print-summary-box";
    const targetAnchor = document.getElementById("planCard") || document.getElementById("radarChartCard");
    if (targetAnchor?.parentNode) targetAnchor.parentNode.insertBefore(summaryBox, targetAnchor);
  }

  summaryBox.innerHTML = `
    <div>
      <div style="font-size: 1.25rem; font-weight: 800; color: #1e3a8a; margin-bottom: 4px;">${projectName} ‧ ${unitNumber}</div>
      <div style="font-size: 0.95rem; font-weight: 600; color: #334155;">房型：${roomSpec}</div>
      <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">產出時間：${dateStr}</div>
    </div>
    <div style="display: flex; gap: 24px; align-items: center;">
      <div style="display: flex; flex-direction: column; text-align: left;">
        <span style="font-size: 0.78rem; color: #64748b; margin-bottom: 2px;">動態低標門檻</span>
        <span style="font-size: 1.25rem; font-weight: 700; color: #1e293b;">${low}</span>
      </div>
      <div style="display: flex; flex-direction: column; text-align: left;">
        <span style="font-size: 0.78rem; color: #64748b; margin-bottom: 2px;">動態高標滿分</span>
        <span style="font-size: 1.25rem; font-weight: 700; color: #1e293b;">${high}</span>
      </div>
      <div style="display: flex; flex-direction: column; text-align: left;">
        <span style="font-size: 0.78rem; color: #64748b; margin-bottom: 2px;">原始實得分數</span>
        <span style="font-size: 1.25rem; font-weight: 700; color: #1e293b;">${raw}</span>
      </div>
      <div style="display: flex; flex-direction: column; text-align: left;">
        <span style="font-size: 0.78rem; color: #64748b; margin-bottom: 2px;">標準分 (60～100分)</span>
        <div style="display: flex; align-items: baseline; gap: 4px;">
          <span style="font-size: 2rem; font-weight: 800; color: ${finalColor}; line-height: 1;">${final}</span>
          <span style="font-size: 0.9rem; color: #64748b; font-weight: 600;">分</span>
        </div>
      </div>
    </div>
  `;

  window.print();
}

// ==========================================
// 檔案處理與 JSON 匯入/匯出
// ==========================================

// 家配圖上傳讀取
function onFloorPlanUpload(input) {
  if (input.files?.[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = document.getElementById("imgFloorPlan");
      const placeholder = document.getElementById("planPlaceholder");
      const actions = document.getElementById("planImgActions");
      if (img) { img.src = e.target.result; img.style.display = "block"; }
      if (placeholder) placeholder.style.display = "none";
      if (actions) actions.style.display = "flex";
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// 重新選擇圖片（清空快取）
function triggerReupload() {
  const ipt = document.getElementById("iptFloorPlan");
  if (ipt) { ipt.value = ""; ipt.click(); }
}

// 移除當前家配圖
function removeFloorPlan() {
  const img = document.getElementById("imgFloorPlan");
  const placeholder = document.getElementById("planPlaceholder");
  const ipt = document.getElementById("iptFloorPlan");
  const actions = document.getElementById("planImgActions");

  if (img) { img.src = ""; img.style.display = "none"; }
  if (placeholder) placeholder.style.display = "block";
  if (ipt) ipt.value = "";
  if (actions) actions.style.display = "none";
}

// AI 匯入彈窗開關
function importFromAI() {
  const modal = document.getElementById("aiModal");
  const textarea = document.getElementById("iptAiJson");
  if (textarea) textarea.value = "";
  if (modal) modal.style.display = "flex";
}

function closeAiModal() {
  const modal = document.getElementById("aiModal");
  if (modal) modal.style.display = "none";
}

// 解析 JSON 數據並同步載入全系統
function confirmImportFromAI() {
  const textarea = document.getElementById("iptAiJson");
  if (!textarea || !textarea.value.trim()) {
    alert("請先貼上代碼！");
    return;
  }

  try {
    const cleanText = textarea.value.trim().replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ');
    const data = JSON.parse(cleanText);

    if (data.projectName !== undefined) document.getElementById("iptProjectName").value = data.projectName;
    if (data.unitNumber !== undefined) document.getElementById("iptUnitNumber").value = data.unitNumber;
    if (data.roomType !== undefined) setPreset(String(data.roomType));

    if (data.hasPlusOne !== undefined) {
      const chk = document.getElementById("chkPlusOne");
      if (chk) chk.checked = !!data.hasPlusOne;
    }

    if (data.suiteCount !== undefined) {
      const selSuite = document.getElementById("selSuiteCount");
      if (selSuite) {
        selSuite.value = data.suiteCount;
        onSuiteCountChange(parseInt(data.suiteCount));
      }
    }

    if (data.conclusion !== undefined) {
      const el = document.getElementById("iptConclusion");
      if (el) el.value = data.conclusion;
    }

    if (Array.isArray(data.disabledSpaces)) {
      data.disabledSpaces.forEach(spaceId => {
        const chk = document.getElementById(`toggle_${spaceId}`);
        if (chk) chk.checked = false;
        toggleSpaceActive(spaceId, false);
      });
    }

    if (data.selections) {
      Object.keys(data.selections).forEach(spaceId => {
        const sp = spaces.find(s => s.id === spaceId);
        if (sp) {
          data.selections[spaceId].forEach((optIdx, critIdx) => {
            if (sp.criteria[critIdx] !== undefined) {
              sp.criteria[critIdx].d = optIdx;
              syncSelectUI(spaceId, critIdx, optIdx);
            }
          });
        }
      });
    }

    updateLayoutConfig();
    updateSpecTitle();
    closeAiModal();
    alert("✅ 評估資料載入成功！房型規格、雷達圖與評分已同步。");

  } catch (err) {
    alert("格式解析失敗，請確認貼上完整的 JSON 內容。\n錯誤原因：" + err.message);
  }
}

// 匯出當前系統狀態為 JSON
function exportCurrentJSON() {
  try {
    const { roomType, hasPlusOne } = getCurrentLayoutState();
    const suiteSel = document.getElementById("selSuiteCount");
    const selections = {};
    spaces.forEach(sp => { selections[sp.id] = sp.criteria.map(c => c.d); });

    const exportData = {
      projectName: getIptVal("iptProjectName"),
      unitNumber: getIptVal("iptUnitNumber"),
      roomType: String(roomType),
      hasPlusOne: hasPlusOne,
      suiteCount: suiteSel ? parseInt(suiteSel.value) : 1,
      disabledSpaces: spaces.filter(sp => sp.userActive === false).map(sp => sp.id),
      conclusion: getIptVal("iptConclusion"),
      selections: selections
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const modal = document.getElementById("aiModal");
    const textarea = document.getElementById("iptAiJson");

    if (modal && textarea) {
      textarea.value = jsonString;
      modal.style.display = "flex";
      textarea.focus();
      textarea.select();
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(jsonString).then(() => {
        alert("✅ 當前評估 JSON 代碼已自動複製至剪貼簿！");
      }).catch(() => {
        alert("已產生評估代碼，請直接在彈跳視窗中按 Ctrl+C 複製。");
      });
    } else {
      alert("已產生評估代碼，請直接在彈跳視窗中按 Ctrl+C 複製。");
    }

  } catch (err) {
    alert("匯出發生錯誤：" + err.message);
  }
}

// ==========================================
// 全域掛載 (供 HTML 行內事件調用)
// ==========================================

window.triggerReupload = triggerReupload;
window.removeFloorPlan = removeFloorPlan;
window.onFloorPlanUpload = onFloorPlanUpload;
window.importFromAI = importFromAI;
window.closeAiModal = closeAiModal;
window.confirmImportFromAI = confirmImportFromAI;
window.exportCurrentJSON = exportCurrentJSON;
window.toggleSpaceActive = toggleSpaceActive;
window.applyExtremePreset = applyExtremePreset;
window.updateRadarChart = updateRadarChart;
window.setPreset = setPreset;
window.togglePlusOne = togglePlusOne;
window.onSuiteCountChange = onSuiteCountChange;
window.updateSpecTitle = updateSpecTitle;
window.exportReportPDF = exportReportPDF;
window.resetToDefault = resetToDefault;
window.renderSpaces = renderSpaces;

window.onload = renderSpaces;
