// ==========================================
// 住宅房型檢核系統 - 核心邏輯腳本
// ==========================================

let radarChartInstance = null;

// 各房型必備空間固定權重配置表 (加總均嚴格鎖定為 100 分)
const SPACE_WEIGHTS = {
  1: { ke_ting: 20, can_ting: 12, chu_fang: 16, yang_tai: 12, zhu_wo: 22, ke_yu: 18 }, // 20+12+16+12+22+18 = 100
  2: { xuan_guan: 8, ke_ting: 15, can_ting: 11, chu_fang: 13, yang_tai: 9, zhu_wo: 16, ke_yu: 15, ci_wo_1: 13 },     // 8+15+11+13+9+16+15+13 = 100
  3: { xuan_guan: 6, ke_ting: 13, can_ting: 10, chu_fang: 10, yang_tai: 8, zhu_wo: 13, zhu_wo_bath: 10, ke_yu: 11, ci_wo_1: 9, ci_wo_2: 10 }, // 6+13+10+10+8+13+10+11+9+10 = 100
  4: { xuan_guan: 6, ke_ting: 12, can_ting: 10, chu_fang: 10, yang_tai: 7, zhu_wo: 12, zhu_wo_bath: 10, ke_yu: 10, ci_wo_1: 8, ci_wo_2: 8, ci_wo_3: 7 }  // 6+12+10+10+7+12+10+10+8+8+7 = 100
};

// 通用浴室選項範本 (8項指標)
const bathCriteriaTemplate = [
  { name: "開窗", opts: [{ l: "無開窗", v: 0 }, { l: "有開窗", v: 1.0 }], d: 0 },
  { name: "套件數", opts: [{ l: "兩件式", v: 0.6 }, { l: "三件式", v: 1.0 }, { l: "四件式", v: 1.2 }], d: 1 },
  { name: "洗臉檯面寬度", opts: [{ l: "<60cm", v: "not ok" }, { l: "≥60cm", v: 0.6 }, { l: ">70cm", v: 1.0 }, { l: ">80cm", v: 1.2 }], d: 1 },
  { name: "馬桶空間寬度", opts: [{ l: "<74cm", v: "not ok" }, { l: "≥74cm", v: 0.6 }, { l: ">80cm", v: 1.0 }], d: 1 },
  { name: "淋浴間尺寸", opts: [{ l: "未設置", v: 0 }, { l: "<80x80cm", v: "not ok" }, { l: "≥80x80cm", v: 0.6 }, { l: ">90x90cm", v: 1.0 }, { l: ">1x1m", v: 1.2 }], d: 2 },
  { name: "浴缸尺寸", opts: [{ l: "未設置", v: 0 }, { l: "<145cm", v: 0.6 }, { l: ">145cm", v: 1.0 }], d: 0 },
  { name: "乾溼分離", opts: [{ l: "無", v: 0 }, { l: "有", v: 1.0 }], d: 1 },
  { name: "三角配置", opts: [{ l: "是", v: 0 }, { l: "否", v: 1.0 }], d: 1 }
];

/**
 * 次臥房選項範本生成器 (已移除「是否為套房」以防選單衝突)
 */
function createSecondaryBedroomCriteria() {
  return [
    { name: "空間採光", opts: [{ l: "無", v: 0 }, { l: "間接採光", v: 0.6 }, { l: "直接採光", v: 1.0 }], d: 2 },
    { name: "連接陽台", opts: [{ l: "無連接", v: 0 }, { l: "有連接", v: 1.0 }], d: 0 },
    { name: "床邊走道數", opts: [{ l: "<一邊", v: "not ok" }, { l: "一邊", v: 0.6 }, { l: "兩邊", v: 0.8 }, { l: "三邊", v: 1.0 }], d: 2 },
    { name: "床邊走道淨寬", opts: [{ l: "<50cm", v: 0 }, { l: "≥50cm", v: 0.6 }, { l: ">60cm", v: 1.0 }, { l: ">70cm", v: 1.2 }, { l: ">80cm", v: 1.4 }, { l: ">90cm", v: 1.6 }], d: 2 },
    { name: "衣櫃長度", opts: [{ l: "<120cm", v: 0 }, { l: "≥120cm", v: 0.6 }, { l: ">140cm", v: 0.8 }, { l: ">160cm", v: 1.0 }, { l: ">180cm", v: 1.2 }, { l: ">200cm", v: 1.4 }], d: 1 },
    { name: "衣櫃深度", opts: [{ l: "<60cm", v: "not ok" }, { l: "≥60cm", v: 1.0 }, { l: ">65cm", v: 1.2 }], d: 1 },
    { name: "衣櫃前淨空間", opts: [{ l: "<60cm", v: 0 }, { l: "≥60cm", v: 1.0 }, { l: ">70cm", v: 1.2 }, { l: ">80cm", v: 1.4 }, { l: ">90cm", v: 1.6 }], d: 1 },
    { name: "是否留設梳妝台", opts: [{ l: "無", v: 0 }, { l: "有", v: 1.0 }], d: 1 },
    { name: "床具尺寸", opts: [{ l: "<5x6.2尺", v: 0 }, { l: "≥5x6.2尺", v: 1 }, { l: ">6x6.2尺", v: 1.2 }], d: 1 }
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
      { name: "空間採光", opts: [{ l: "無採光", v: "not ok" }, { l: "間接採光", v: 0.6 }, { l: "直接採光", v: 1.0 }], d: 2 },
      { name: "連接陽台", opts: [{ l: "無連接", v: 0 }, { l: "有連接", v: 1.0 }], d: 0 },
      { name: "客廳深度", opts: [{ l: "<2.8m", v: "not ok" }, { l: "<3m", v: 0.6 }, { l: ">3m", v: 1.0 }, { l: ">3.2m", v: 1.2 }, { l: ">3.6m", v: 1.4 }], d: 2 },
      { name: "沙發座數", opts: [{ l: "座位<居住人數", v: 0.6 }, { l: "符合居住人數", v: 1.0 }], d: 1 }
    ]
  },
  {
    id: "can_ting", name: "餐廳", enabled: true,
    criteria: [
      { name: "空間採光", opts: [{ l: "無採光", v: 0 }, { l: "間接採光", v: 1.0 }, { l: "直接採光", v: 1.2 }], d: 1 },
      { name: "餐桌座位數", opts: [{ l: "不符合人數", v: "not ok" }, { l: "符合居住人數", v: 1.0 }], d: 1 },
      { name: "座椅移動空間", opts: [{ l: "<70cm", v: "not ok" }, { l: ">70cm", v: 0.6 }, { l: ">75cm", v: 0.8 }, { l: ">80cm", v: 1.0 }, { l: ">90cm", v: 1.2 }], d: 3 }
    ]
  },
  {
    id: "chu_fang", name: "廚房", enabled: true,
    criteria: [
      { name: "檯面深度", opts: [{ l: "<60cm", v: 0 }, { l: ">60cm", v: 1.0 }], d: 1 },
      { name: "料理台寬度", opts: [{ l: "<60cm", v: 0 }, { l: ">60cm", v: 0.6 }, { l: ">70cm", v: 0.8 }, { l: ">80cm", v: 1.0 }], d: 3 },
      { name: "走道淨寬", opts: [{ l: "<70cm", v: "not ok" }, { l: ">70cm", v: 0.6 }, { l: ">80cm", v: 1.0 }, { l: ">90cm", v: 1.2 }], d: 2 },
      { name: "排油煙路徑", opts: [{ l: ">5m", v: 0.6 }, { l: "<5m", v: 0.8 }, { l: "<1m", v: 1.0 }], d: 2 },
      { name: "留設電器櫃位置", opts: [{ l: "無電器櫃", v: 0 }, { l: "有", v: 1.0 }], d: 1 },
      { name: "是否連接工作陽台", opts: [{ l: "無連接", v: 0 }, { l: "有連接", v: 1.0 }], d: 0 }
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
      { name: "設置室外機", opts: [{ l: "無設置", v: 0 }, { l: "有設置", v: 1.0 }], d: 1 },
      { name: "設置洗衣機", opts: [{ l: "無設置", v: "not ok" }, { l: "有設置", v: 1.0 }], d: 1 },
      { name: "設置洗衣槽", opts: [{ l: "無設置", v: 0.0 }, { l: "有設置", v: 1.0 }], d: 1 },
      { name: "設置曬衣架", opts: [{ l: "無設置", v: 0 }, { l: "有設置", v: 1.0 }], d: 1 }, // 修正為「設置曬衣架」
      { name: "開門窗是否影響曬衣架", opts: [{ l: "有影響", v: 0 }, { l: "無影響", v: 1.0 }], d: 1 },
      { 
        name: "坪數大小", 
        opts: [
          { l: "<0.7坪", v: "not ok" },
          { l: ">0.7坪", v: 0.4 },
          { l: ">0.8坪", v: 0.6 },
          { l: ">1坪", v: 0.8 },
          { l: ">1.2坪", v: 1.0 },
          { l: ">1.4坪", v: 1.2 }
        ], 
        d: 4 
      }
    ]
  },
  {
    id: "zhu_wo", name: "主臥房", enabled: true,
    criteria: [
      { name: "空間採光", opts: [{ l: "無採光", v: "not ok" }, { l: "間接採光", v: 0.6 }, { l: "直接採光", v: 1.0 }], d: 2 },
      { name: "連接陽台", opts: [{ l: "無連接", v: 0 }, { l: "有連接", v: 1.0 }], d: 0 },
      { name: "床邊留設走道數", opts: [{ l: "<三邊", v: "not ok" }, { l: "三邊", v: 1.0 }], d: 1 },
      { name: "床邊走道淨寬", opts: [{ l: "<50cm", v: 0 }, { l: ">50cm", v: 0.6 }, { l: ">60cm", v: 1.0 }, { l: ">70cm", v: 1.2 }, { l: ">80cm", v: 1.4 }, { l: ">90cm", v: 1.6 }], d: 2 },
      { name: "衣櫃長度", opts: [{ l: "<150cm", v: 0 }, { l: ">150cm", v: 0.6 }, { l: ">180cm", v: 0.8 }, { l: ">200cm", v: 1.0 }, { l: ">250cm", v: 1.2 }, { l: ">300cm", v: 1.6 }], d: 3 },
      { name: "衣櫃深度", opts: [{ l: "<60cm", v: "not ok" }, { l: ">60cm", v: 1.0 }, { l: ">65cm", v: 1.2 }], d: 1 },
      { name: "衣櫃前淨空間", opts: [{ l: "<60cm", v: 0 }, { l: ">60cm", v: 1.0 }, { l: ">70cm", v: 1.2 }, { l: ">80cm", v: 1.4 }, { l: ">90cm", v: 1.6 }], d: 1 },
      { name: "是否留設梳妝台", opts: [{ l: "無", v: 0 }, { l: "有", v: 1.0 }], d: 1 },
      { name: "床具尺寸", opts: [{ l: "<5x6.2尺", v: 0 }, { l: "≥5x6.2尺", v: 0.6 }, { l: ">6x6.2尺", v: 1 }, { l: ">6x7尺", v: 1.2 }], d: 1 }
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
      { name: "可否配置床具", opts: [{ l: "無配置", v: 0 }, { l: "單人床", v: 1.0 }, { l: "加大單人床", v: 1.2 }], d: 1 },
      { name: "是否設置衣櫃", opts: [{ l: "無配置", v: 0 }, { l: "有配置", v: 1.0 }], d: 1 }
    ]
  }
];

spaces.forEach(sp => { if (sp.userActive === undefined) sp.userActive = true; });
const defaultSpacesData = JSON.parse(JSON.stringify(spaces));

// ==========================================
// 共用輔助函式
// ==========================================

const getIptVal = (id, fallback = "") => {
  const el = document.getElementById(id);
  return el && el.value.trim() ? el.value.trim() : fallback;
};

function syncSelectUI(spaceId, critIdx, val) {
  const card = document.getElementById(`card_${spaceId}`);
  if (card) {
    const selects = card.querySelectorAll("select.crit-select");
    const sel = selects[critIdx];
    if (sel) {
      sel.value = val;
      const sp = spaces.find(s => s.id === spaceId);
      const optVal = sp?.criteria[critIdx]?.opts[val]?.v;
      sel.classList.toggle("not-ok", optVal === "not ok");
    }
  }
}

function getCurrentLayoutState() {
  const selEl = document.getElementById("selBedrooms");
  const chkPlusOne = document.getElementById("chkPlusOne");
  const suiteSel = document.getElementById("selSuiteCount");
  return {
    roomType: selEl ? parseInt(selEl.value) : 2,
    hasPlusOne: chkPlusOne ? chkPlusOne.checked : false,
    suiteCount: suiteSel ? parseInt(suiteSel.value) : 0
  };
}

function setEnable(id, isEnable) {
  const sp = spaces.find(s => s.id === id);
  if (sp) {
    sp.enabled = isEnable;
    const card = document.getElementById(`card_${id}`);
    if (card) card.classList.toggle("hidden", !isEnable);
  }
}

// ==========================================
// 空間渲染與連動控制
// ==========================================

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
      const isNotOk = crit.opts[crit.d]?.v === "not ok";
      criteriaHtml += `
        <div class="crit-group">
          <label class="crit-label">${crit.name}</label>
          <select class="crit-select ${isNotOk ? 'not-ok' : ''}" ${!sp.userActive ? 'disabled' : ''} onchange="onCritChange(${spIdx}, ${critIdx}, this)">
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

  setPreset('2');
}

function onCritChange(spIdx, critIdx, el) {
  const sp = spaces[spIdx];
  const crit = sp.criteria[critIdx];
  crit.d = parseInt(el.value);
  el.classList.toggle("not-ok", crit.opts[crit.d]?.v === "not ok");

  if (crit.name === "套件數") {
    const tubIdx = sp.criteria.findIndex(c => c.name === "浴缸尺寸");
    if (tubIdx !== -1) {
      const targetTubIdx = crit.opts[crit.d]?.l === "四件式"
        ? sp.criteria[tubIdx].opts.findIndex(o => o.l === "<145cm")
        : sp.criteria[tubIdx].opts.findIndex(o => o.l === "未設置");
      if (targetTubIdx !== -1) {
        sp.criteria[tubIdx].d = targetTubIdx;
        syncSelectUI(sp.id, tubIdx, targetTubIdx);
      }
    }
  }

  calculateAll();
}

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

/**
 * 表頭勾選特殊加分空間（中島、1房玄關）
 */
function toggleBonusSpace(spaceId, isChecked) {
  const sp = spaces.find(s => s.id === spaceId);
  if (sp) {
    sp.enabled = isChecked;
    sp.userActive = isChecked;
    const card = document.getElementById(`card_${spaceId}`);
    if (card) card.classList.toggle("hidden", !isChecked);
  }
  calculateAll();
}

/**
 * 依表頭格局與套房數，精確依序分配：主臥 -> 次臥1 -> 次臥2 -> 次臥3
 */
function updateLayoutConfig() {
  const { roomType, hasPlusOne, suiteCount } = getCurrentLayoutState();

  ["ke_ting", "can_ting", "chu_fang", "yang_tai", "zhu_wo", "ke_yu"].forEach(id => setEnable(id, true));

  // 玄關：2房以上或1+1房為必備；1房未+1時由表頭加分勾選控制
  const isXuanGuanRequired = roomType >= 2 || (roomType === 1 && hasPlusOne);
  const chkBonusXG = document.getElementById("chkBonusXuanGuan");
  const lblBonusXG = document.getElementById("lblBonusXuanGuan");
  if (lblBonusXG) lblBonusXG.style.display = (roomType === 1 && !hasPlusOne) ? "inline-flex" : "none";
  setEnable("xuan_guan", isXuanGuanRequired || (chkBonusXG ? chkBonusXG.checked : false));

  // 次臥房開合
  setEnable("ci_wo_1", roomType >= 2);
  setEnable("ci_wo_2", roomType >= 3);
  setEnable("ci_wo_3", roomType >= 4);

  // 套房衛浴依套房數量嚴格循序啟用：主臥 -> 次臥1 -> 次臥2 -> 次臥3
  // 3房以上主臥套房為必備基準；其餘依套房數量遞增
  const hasZhuWoBath = (roomType >= 3) || (suiteCount >= 1);
  setEnable("zhu_wo_bath", hasZhuWoBath);
  setEnable("ci_wo_1_bath", roomType >= 2 && suiteCount >= (roomType >= 3 ? 2 : 2));
  setEnable("ci_wo_2_bath", roomType >= 3 && suiteCount >= 3);
  setEnable("ci_wo_3_bath", roomType >= 4 && suiteCount >= 4);

  setEnable("plus_one", hasPlusOne);

  // 獨立中島空間：全由表頭勾選控制
  const chkBonusZD = document.getElementById("chkBonusZhongDao");
  setEnable("zhong_dao", chkBonusZD ? chkBonusZD.checked : false);

  calculateAll();
}

// ==========================================
// 評分計算與基準判定 (正規權重百分制)
// ==========================================

function isBaselineRequiredSpace(spaceId, roomType, hasPlusOne) {
  if (spaceId === "xuan_guan") return roomType >= 2 || (roomType === 1 && hasPlusOne);
  if (spaceId === "ci_wo_1") return roomType >= 2;
  if (spaceId === "ci_wo_2") return roomType >= 3;
  if (spaceId === "ci_wo_3") return roomType >= 4;
  if (spaceId === "zhu_wo_bath") return roomType >= 3;

  const coreSpaces = ["ke_ting", "can_ting", "chu_fang", "yang_tai", "zhu_wo", "ke_yu"];
  return coreSpaces.includes(spaceId);
}

function isBonusSpace(spaceId, roomType, hasPlusOne) {
  if (roomType === 1 && !hasPlusOne && spaceId === "xuan_guan") return true;
  if (roomType === 2 && spaceId === "zhu_wo_bath") return true;
  const secondarySuiteBaths = ["ci_wo_1_bath", "ci_wo_2_bath", "ci_wo_3_bath"];
  if (secondarySuiteBaths.includes(spaceId)) return true;
  if (spaceId === "zhong_dao") return true;
  return false;
}

function getBonusMaxScore(spaceId) {
  if (spaceId === "xuan_guan") return 6.0;    // 1房加選玄關：比照4房玄關分配6分
  if (spaceId === "zhu_wo_bath") return 10.0; // 2房加選主臥套房：比照4房浴室10分
  if (["ci_wo_1_bath", "ci_wo_2_bath", "ci_wo_3_bath"].includes(spaceId)) return 10.0;
  if (spaceId === "zhong_dao") return 6.0;    // 獨立中島空間：最高+6分
  return 0.0;
}

function calculateAll() {
  const { roomType, hasPlusOne } = getCurrentLayoutState();
  const currentWeights = SPACE_WEIGHTS[roomType] || SPACE_WEIGHTS[2];

  let totalBaseScore = 0.0;
  let totalBonusScore = 0.0;
  let rawSum = 0.0;
  let totalLowSum = 0.0;   
  let totalHighSum = 0.0;  

  spaces.forEach((sp) => {
    let spLow = 0, spHigh = 0, spRaw = 0;
    let hasNotOk = false;
    const isBonus = isBonusSpace(sp.id, roomType, hasPlusOne);

    sp.criteria.forEach((crit) => {
      const validScores = crit.opts.filter(o => typeof o.v === 'number').map(o => o.v);
      const minVal = validScores.length ? Math.min(...validScores) : 0;
      const maxVal = validScores.length ? Math.max(...validScores) : 0;

      spLow += minVal;
      spHigh += maxVal;

      if (sp.enabled && sp.userActive !== false) {
        const selOpt = crit.opts[crit.d];
        if (selOpt) {
          if (selOpt.v === "not ok") {
            hasNotOk = true;
          } else {
            spRaw += Number(selOpt.v);
          }
        }
      }
    });

    if (hasNotOk) {
      spRaw = 0;
    }

    if (sp.enabled && sp.userActive !== false) {
      totalLowSum += spLow;
      totalHighSum += spHigh;
      rawSum += spRaw;
    }

    // 內部得分率 (0.0 ~ 1.0)
    let ratio = 0.0;
    if (sp.enabled && sp.userActive !== false && spRaw > 0) {
      if (spHigh > spLow) {
        ratio = Math.max(0, Math.min(1, (spRaw - spLow) / (spHigh - spLow)));
      } else {
        ratio = 1.0;
      }
    }

    if (isBonus) {
      const maxBonus = getBonusMaxScore(sp.id);
      totalBonusScore += (ratio * maxBonus);
    } else {
      const weight = currentWeights[sp.id] || 0;
      let spaceFinalScore = 0;

      if (sp.enabled && sp.userActive !== false && !hasNotOk) {
        // 全選最低標得權重之 60%，全選最高標得 100%
        spaceFinalScore = weight * (0.6 + 0.4 * ratio);
      }
      totalBaseScore += spaceFinalScore;
    }

    const elLow = document.getElementById(`low_${sp.id}`);
    const elHigh = document.getElementById(`high_${sp.id}`);
    const elRaw = document.getElementById(`raw_${sp.id}`);
    if (elLow) elLow.innerText = spLow.toFixed(1);
    if (elHigh) elHigh.innerText = spHigh.toFixed(1);
    if (elRaw) elRaw.innerText = (sp.enabled && sp.userActive !== false ? spRaw : 0).toFixed(1);
  });

  const dispLowSum = document.getElementById("dispLowSum");
  const dispHighSum = document.getElementById("dispHighSum");
  const dispRaw = document.getElementById("dispRaw");
  
  if (dispLowSum) dispLowSum.innerText = totalLowSum.toFixed(1);
  if (dispHighSum) dispHighSum.innerText = totalHighSum.toFixed(1);
  if (dispRaw) dispRaw.innerText = rawSum.toFixed(1);

  const finalScore = totalBaseScore + totalBonusScore;
  const finalEl = document.getElementById("dispFinal");
  if (finalEl) {
    finalEl.innerText = finalScore.toFixed(1);
    finalEl.style.color = finalScore > 100 ? "#b45309" : finalScore >= 80 ? "var(--success)" : finalScore >= 60 ? "var(--primary)" : "var(--danger)";
  }

  updateRadarChart();
}

// ==========================================
// 房型設定、套房配置與極端值套用
// ==========================================

function setPreset(roomNum, shouldAllocate = true) {
  const selEl = document.getElementById("selBedrooms");
  if (selEl) selEl.value = roomNum;

  document.querySelectorAll(".type-btn").forEach(btn => {
    const attr = btn.getAttribute("onclick");
    btn.classList.toggle("active", attr?.includes(`setPreset('${roomNum}')`) || attr?.includes(`setPreset(${roomNum})`));
  });

  updateSuiteOptions(parseInt(roomNum), shouldAllocate);
  updateLayoutConfig();
}

function updateSuiteOptions(roomType, shouldAllocate = true) {
  const suiteSel = document.getElementById("selSuiteCount");
  if (!suiteSel) return;

  let html = "";
  for (let i = 0; i <= roomType; i++) {
    html += `<option value="${i}">${i === 0 ? "0 套 (全雅房)" : `${i} 套房`}</option>`;
  }
  suiteSel.innerHTML = html;

  if (shouldAllocate) {
    // 1房與2房預設0套；3房以上預設1套(主臥套房)
    const defaultCount = (roomType <= 2) ? 0 : 1;
    suiteSel.value = defaultCount;
  }

  updateSpecTitle();
}

function onSuiteCountChange(count) {
  updateLayoutConfig();
  updateSpecTitle();
}

function togglePlusOne(checked) {
  updateLayoutConfig();
  updateSpecTitle();
}

/**
 * 一鍵套用最高標分 / 最低標分：
 * 保持目前設定的套房數量與特殊空間開關，只針對畫面上可見之空間進行選項切換
 */
function applyExtremePreset(mode) {
  spaces.forEach((sp) => {
    if (!sp.enabled || sp.userActive === false) return;

    sp.criteria.forEach((crit, critIdx) => {
      const validOpts = crit.opts.map((opt, idx) => ({ ...opt, origIdx: idx })).filter(opt => typeof opt.v === 'number');
      if (!validOpts.length) return;

      let targetOpt;
      if (mode === 'max') {
        targetOpt = validOpts.reduce((prev, curr) => (curr.v > prev.v ? curr : prev));
      } else {
        targetOpt = validOpts.reduce((prev, curr) => (curr.v < prev.v ? curr : prev));
      }

      crit.d = targetOpt.origIdx;
      syncSelectUI(sp.id, critIdx, targetOpt.origIdx);
    });
  });

  calculateAll();
  updateSpecTitle();
}

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

  const chkBonusZD = document.getElementById("chkBonusZhongDao");
  if (chkBonusZD) chkBonusZD.checked = false;

  const chkBonusXG = document.getElementById("chkBonusXuanGuan");
  if (chkBonusXG) chkBonusXG.checked = false;

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

function getFormattedRoomSpec() {
  const { roomType, hasPlusOne, suiteCount } = getCurrentLayoutState();
  return `${roomType}${hasPlusOne ? "+1" : ""}房/${suiteCount}套房`;
}

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
  } catch (e) { }
}

function updateRadarChart() {
  const canvas = document.getElementById("radarChart");
  if (!canvas || typeof Chart === "undefined") return;

  const { roomType, hasPlusOne } = getCurrentLayoutState();

  const chartSpaces = spaces.filter(sp => {
    if (!sp.enabled) return false;
    const isRequired = isBaselineRequiredSpace(sp.id, roomType, hasPlusOne);
    return isRequired || sp.userActive !== false;
  });

  const labels = chartSpaces.map(sp => sp.name);

  const dataValues = chartSpaces.map(sp => {
    if (sp.userActive === false) return 0;

    const low = parseFloat(document.getElementById(`low_${sp.id}`)?.innerText || 0);
    const high = parseFloat(document.getElementById(`high_${sp.id}`)?.innerText || 1);
    const raw = parseFloat(document.getElementById(`raw_${sp.id}`)?.innerText || 0);

    if (raw === 0) return 0;
    const isBonus = isBonusSpace(sp.id, roomType, hasPlusOne);

    if (isBonus) {
      const bonusRate = (high > low) ? Math.max(0, Math.min(1, (raw - low) / (high - low))) : 1.0;
      return Math.round(100 + bonusRate * 40);
    } else {
      if (high <= low) return 100;
      const ratio = Math.max(0, Math.min(1, (raw - low) / (high - low)));
      return Math.round(ratio * 100);
    }
  });

  const maxVal = Math.max(...dataValues, 100);
  const dynamicMax = Math.ceil(maxVal / 20) * 20;

  const highThresholdData = labels.map(() => 100);
  const lowThresholdData = labels.map(() => 60);

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
      borderColor: "rgba(22, 163, 74, 0.6)",
      borderWidth: 1.5,
      borderDash: [4, 4],
      pointRadius: 0,
      order: 2
    },
    {
      label: "低標合格線 (60分)",
      data: lowThresholdData,
      backgroundColor: "transparent",
      borderColor: "rgba(220, 38, 38, 0.5)",
      borderWidth: 1.5,
      borderDash: [3, 3],
      pointRadius: 0,
      order: 3
    }
  ];

  if (radarChartInstance) {
    radarChartInstance.data.labels = labels;
    radarChartInstance.data.datasets = chartDatasets;
    radarChartInstance.options.scales.r.max = dynamicMax;
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
            min: 0,
            max: dynamicMax,
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

function exportReportPDF() {
  const low = document.getElementById("dispLowSum")?.innerText || "0.0";
  const high = document.getElementById("dispHighSum")?.innerText || "0.0";
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
        <span style="font-size: 0.78rem; color: #64748b; margin-bottom: 2px;">低標分數加總</span>
        <span style="font-size: 1.25rem; font-weight: 700; color: #1e293b;">${low}</span>
      </div>
      <div style="display: flex; flex-direction: column; text-align: left;">
        <span style="font-size: 0.78rem; color: #64748b; margin-bottom: 2px;">高標分數加總</span>
        <span style="font-size: 1.25rem; font-weight: 700; color: #1e293b;">${high}</span>
      </div>
      <div style="display: flex; flex-direction: column; text-align: left;">
        <span style="font-size: 0.78rem; color: #64748b; margin-bottom: 2px;">實得分數加總</span>
        <span style="font-size: 1.25rem; font-weight: 700; color: #1e293b;">${raw}</span>
      </div>
      <div style="display: flex; flex-direction: column; text-align: left;">
        <span style="font-size: 0.78rem; color: #64748b; margin-bottom: 2px;">轉換百分制分數</span>
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

function triggerReupload() {
  const ipt = document.getElementById("iptFloorPlan");
  if (ipt) { ipt.value = ""; ipt.click(); }
}

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
    if (data.roomType !== undefined) setPreset(String(data.roomType), false);

    if (data.hasPlusOne !== undefined) {
      const chk = document.getElementById("chkPlusOne");
      if (chk) chk.checked = !!data.hasPlusOne;
    }

    if (data.hasBonusZhongDao !== undefined) {
      const chk = document.getElementById("chkBonusZhongDao");
      if (chk) chk.checked = !!data.hasBonusZhongDao;
    }

    if (data.conclusion !== undefined) {
      const el = document.getElementById("iptConclusion");
      if (el) el.value = data.conclusion;
    }

    spaces.forEach(sp => {
      sp.userActive = true;
      const chk = document.getElementById(`toggle_${sp.id}`);
      if (chk) chk.checked = true;
      const card = document.getElementById(`card_${sp.id}`);
      if (card) {
        card.classList.remove("is-disabled");
        card.querySelectorAll("select.crit-select").forEach(sel => sel.disabled = false);
      }
    });

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

    if (data.suiteCount !== undefined) {
      const selSuite = document.getElementById("selSuiteCount");
      if (selSuite) selSuite.value = data.suiteCount;
    }

    updateLayoutConfig();
    updateSpecTitle();
    closeAiModal();
    alert("✅ 評估資料載入成功！房型規格、雷達圖與評分已同步。");

  } catch (err) {
    alert("格式解析失敗，請確認貼上完整的 JSON 內容。\n錯誤原因：" + err.message);
  }
}

function exportCurrentJSON() {
  try {
    const { roomType, hasPlusOne, suiteCount } = getCurrentLayoutState();
    const chkBonusZD = document.getElementById("chkBonusZhongDao");
    const selections = {};
    spaces.forEach(sp => { selections[sp.id] = sp.criteria.map(c => c.d); });

    const exportData = {
      projectName: getIptVal("iptProjectName"),
      unitNumber: getIptVal("iptUnitNumber"),
      roomType: String(roomType),
      hasPlusOne: hasPlusOne,
      suiteCount: suiteCount,
      hasBonusZhongDao: chkBonusZD ? chkBonusZD.checked : false,
      disabledSpaces: spaces.filter(sp => sp.userActive === false).map(sp => sp.id),
      conclusion: getIptVal("iptConclusion"),
      selections: selections
    };

    const jsonString = JSON.stringify(exportData, null, 2);

    const projectName = getIptVal("iptProjectName", "未指定建案");
    const unitNumber = getIptVal("iptUnitNumber", "未指定戶號");
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const fileName = `${dateStr}_${projectName}_${unitNumber}_評估代碼.txt`;

    const blob = new Blob([jsonString], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

  } catch (err) {
    alert("匯出檔案發生錯誤：" + err.message);
  }
}

// ==========================================
// 全域掛載
// ==========================================

window.triggerReupload = triggerReupload;
window.removeFloorPlan = removeFloorPlan;
window.onFloorPlanUpload = onFloorPlanUpload;
window.importFromAI = importFromAI;
window.closeAiModal = closeAiModal;
window.confirmImportFromAI = confirmImportFromAI;
window.exportCurrentJSON = exportCurrentJSON;
window.toggleSpaceActive = toggleSpaceActive;
window.toggleBonusSpace = toggleBonusSpace;
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
