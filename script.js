// ==========================================
// 住宅房型檢核系統 - 核心邏輯腳本
// ==========================================

let radarChartInstance = null;

// 各房型必備空間固定權重配置表 (加總嚴格鎖定為 100 分)
const SPACE_WEIGHTS = {
  1: { ke_ting: 20, can_ting: 12, chu_fang: 16, yang_tai: 12, zhu_wo: 22, ke_yu: 18 },
  2: { xuan_guan: 8, ke_ting: 15, can_ting: 11, chu_fang: 13, yang_tai: 9, zhu_wo: 16, ke_yu: 15, ci_wo_1: 13 },
  3: { xuan_guan: 6, ke_ting: 13, can_ting: 10, chu_fang: 10, yang_tai: 8, zhu_wo: 13, zhu_wo_bath: 10, ke_yu: 11, ci_wo_1: 9, ci_wo_2: 10 },
  4: { xuan_guan: 6, ke_ting: 12, can_ting: 10, chu_fang: 10, yang_tai: 7, zhu_wo: 12, zhu_wo_bath: 10, ke_yu: 10, ci_wo_1: 8, ci_wo_2: 8, ci_wo_3: 7 }
};

// 各空間專屬標準 60 分及格選項索引對應表 (基準截圖參照)
const SPACE_PASS_INDICES = {
  xuan_guan: [1, 1, 0],              // 實得 1.2
  ke_ting: [1, 0, 2, 0],             // 預設 1 房基準：實得 1.8 (客廳深度動態由 getSpacePassIndices 依房型指派)
  can_ting: [0, 1, 1],               // 實得 1.6
  chu_fang: [1, 0, 1, 0, 0, 0],      // 實得 2.2
  yang_tai: [0, 1, 0, 0, 1],         // 實得 1.4
  zhu_wo: [2, 0, 2, 2, 5, 1, 1, 1, 2], // 實得 8.0
  ci_wo_1: [1, 0, 2, 2, 3, 1, 1, 1, 1], // 實得 7.4
  ci_wo_2: [1, 0, 2, 2, 3, 1, 1, 1, 1],
  ci_wo_3: [1, 0, 2, 2, 3, 1, 1, 1, 1],
  zhu_wo_bath: [0, 1, 1, 1, 2, 0, 0, 0], // 實得 2.8
  ci_wo_1_bath: [0, 1, 1, 1, 2, 0, 0, 0],
  ci_wo_2_bath: [0, 1, 1, 1, 2, 0, 0, 0],
  ci_wo_3_bath: [0, 1, 1, 1, 2, 0, 0, 0],
  ke_yu: [0, 1, 1, 1, 2, 0, 1, 1],   // 實得 4.8
  zhong_dao: [3, 3, 2, 1, 1, 0],     // 實得 5.0
  plus_one: [0, 1, 1, 1]             // 實得 3.0
};

/**
 * 依據當前房型尺度，動態取得空間及格選項索引
 * 1房及格 >2.8m (idx: 2)
 * 2房及格 >3.0m (idx: 4)
 * 3房及格 >3.2m (idx: 5)
 * 4房及格 >3.4m (idx: 6)
 */
function getSpacePassIndices(spaceId, roomType) {
  if (spaceId === "ke_ting") {
    const depthPassIdxMap = { 1: 2, 2: 4, 3: 5, 4: 6 };
    const depthIdx = depthPassIdxMap[roomType] ?? 4;
    return [1, 0, depthIdx, 0];
  }
  return SPACE_PASS_INDICES[spaceId] || [];
}

// 通用浴室選項範本 (8項指標)
const bathCriteriaTemplate = [
  { name: "開窗", opts: [{ l: "無開窗", v: 0 }, { l: "有開窗", v: 1.0 }], d: 0 },
  { name: "套件數", opts: [{ l: "兩件式", v: 0.6 }, { l: "三件式", v: 1.0 }, { l: "四件式", v: 1.2 }], d: 1 },
  { name: "洗臉檯面寬度", opts: [{ l: "<60cm", v: "not ok" }, { l: "≥60cm", v: 0.6 }, { l: ">70cm", v: 1.0 }, { l: ">80cm", v: 1.2 }], d: 1 },
  { name: "馬桶空間寬度", opts: [{ l: "<74cm", v: "not ok" }, { l: "≥74cm", v: 0.6 }, { l: ">80cm", v: 1.0 }], d: 1 },
  { name: "淋浴間尺寸", opts: [{ l: "未設置", v: 0 }, { l: "<80x80cm", v: "not ok" }, { l: "≥80x80cm", v: 0.6 }, { l: ">90x90cm", v: 1.0 }, { l: ">1x1m", v: 1.2 }], d: 2 },
  { name: "浴缸尺寸", opts: [{ l: "未設置", v: 0 }, { l: "<145cm", v: 0.6 }, { l: "≥145cm", v: 1.0 }], d: 0 },
  { name: "乾溼分離", opts: [{ l: "無", v: 0 }, { l: "有", v: 1.0 }], d: 1 },
  { name: "三角配置", opts: [{ l: "是", v: 0 }, { l: "否", v: 1.0 }], d: 1 }
];

/**
 * 次臥房選項範本生成器
 */
function createSecondaryBedroomCriteria() {
  return [
    { name: "空間採光", opts: [{ l: "無", v: 0 }, { l: "間接採光", v: 0.6 }, { l: "直接採光", v: 1.0 }], d: 2 },
    { name: "連接陽台", opts: [{ l: "無連接", v: 0 }, { l: "有連接", v: 1.0 }], d: 0 },
    { name: "床邊走道數", opts: [{ l: "<一邊", v: "not ok" }, { l: "一邊", v: 0.6 }, { l: "兩邊", v: 0.8 }, { l: "三邊", v: 1.0 }], d: 2 },
    { name: "床邊走道淨寬", opts: [{ l: "<50cm", v: 0 }, { l: "≥50cm", v: 0.6 }, { l: ">60cm", v: 1.0 }, { l: ">70cm", v: 1.2 }, { l: ">80cm", v: 1.4 }, { l: ">90cm", v: 1.6 }], d: 2 },
    { 
      name: "衣櫃長度", 
      opts: [
        { l: "<105cm", v: "not ok" },
        { l: "≥105cm", v: 0.6 },
        { l: ">120cm", v: 0.8 },
        { l: ">150cm", v: 1.0 },
        { l: ">180cm", v: 1.2 },
        { l: ">210cm", v: 1.4 }
      ], 
      d: 3 
    },
    { name: "衣櫃深度", opts: [{ l: "<60cm", v: "not ok" }, { l: "≥60cm", v: 1.0 }, { l: ">65cm", v: 1.2 }], d: 1 },
    { name: "衣櫃前淨寬", opts: [{ l: "<60cm", v: 0 }, { l: "≥60cm", v: 1.0 }, { l: ">70cm", v: 1.2 }, { l: ">80cm", v: 1.4 }, { l: ">90cm", v: 1.6 }], d: 1 },
    { name: "是否留設梳妝台", opts: [{ l: "無", v: 0 }, { l: "有", v: 1.0 }], d: 1 },
    { name: "床具尺寸", opts: [{ l: "<5x6.2尺", v: 0 }, { l: "≥5x6.2尺", v: 1.0 }, { l: ">6x6.2尺", v: 1.2 }], d: 1 }
  ];
}

// 系統核心空間資料庫模型
let spaces = [
  {
    id: "xuan_guan", name: "玄關", enabled: true,
    criteria: [
      { name: "走道淨寬", opts: [{ l: "<90cm", v: "not ok" }, { l: "≥90cm", v: 0.6 }, { l: ">100cm", v: 1.0 }, { l: ">120cm", v: 1.2 }], d: 1 },
      { name: "鞋櫃長度", opts: [{ l: "未設置", v: "not ok" }, { l: "<60cm", v: 0.6 }, { l: "≥60cm", v: 1.0 }, { l: ">90cm", v: 1.2 }, { l: ">120cm", v: 1.4 }], d: 2 },
      { name: "衣帽間", opts: [{ l: "未設置", v: 0 }, { l: "一般衣帽間", v: 1.0 }, { l: "電子衣櫃專用", v: 1.2 }], d: 0 }
    ]
  },
  {
    id: "ke_ting", name: "客廳", enabled: true,
    criteria: [
      { name: "空間採光", opts: [{ l: "無採光", v: "not ok" }, { l: "間接採光", v: 0.6 }, { l: "直接採光", v: 1.0 }], d: 2 },
      { name: "連接陽台", opts: [{ l: "無連接", v: 0 }, { l: "有連接", v: 1.0 }], d: 0 },
      { 
        name: "客廳深度", 
        opts: [
          { l: "<2.7m", v: "not ok" },
          { l: "≥2.7m", v: 0.4 },
          { l: ">2.8m", v: 0.6 },
          { l: ">2.9m", v: 0.8 },
          { l: ">3m", v: 1.0 },
          { l: ">3.2m", v: 1.2 },
          { l: ">3.4m", v: 1.4 },
          { l: ">3.6m", v: 1.6 }
        ], 
        d: 4 
      },
      { name: "沙發座數", opts: [{ l: "<居住人數", v: 0.6 }, { l: "符合居住人數", v: 1.0 }], d: 1 }
    ]
  },
  {
    id: "can_ting", name: "餐廳", enabled: true,
    criteria: [
      { name: "空間採光", opts: [{ l: "無採光", v: 0 }, { l: "間接採光", v: 1.0 }, { l: "直接採光", v: 1.2 }], d: 1 },
      { name: "餐桌座位數", opts: [{ l: "不符合人數", v: "not ok" }, { l: "符合居住人數", v: 1.0 }], d: 1 },
      { name: "座椅移動空間", opts: [{ l: "<70cm", v: "not ok" }, { l: "≥70cm", v: 0.6 }, { l: ">75cm", v: 0.8 }, { l: ">80cm", v: 1.0 }, { l: ">90cm", v: 1.2 }], d: 3 }
    ]
  },
  {
    id: "chu_fang", name: "廚房", enabled: true,
    criteria: [
      { name: "檯面深度", opts: [{ l: "<60cm", v: "not ok" }, { l: "≥60cm", v: 1.0 }], d: 1 },
      { name: "料理台寬度", opts: [{ l: "<60cm", v: 0 }, { l: "≥60cm", v: 0.6 }, { l: ">70cm", v: 0.8 }, { l: ">80cm", v: 1.0 }], d: 3 },
      { name: "走道淨寬", opts: [{ l: "<70cm", v: "not ok" }, { l: "≥70cm", v: 0.6 }, { l: ">80cm", v: 1.0 }, { l: ">90cm", v: 1.2 }], d: 2 },
      { name: "排油煙路徑", opts: [{ l: ">5m", v: 0.6 }, { l: "≤5m", v: 0.8 }, { l: "<1m", v: 1.0 }], d: 2 },
      { name: "電器櫃", opts: [{ l: "無設置", v: 0 }, { l: "有設置", v: 1.0 }], d: 1 },
      { name: "是否連接工作陽台", opts: [{ l: "無連接", v: 0 }, { l: "有連接", v: 1.0 }], d: 0 }
    ]
  },
  {
    id: "zhong_dao", name: "中島空間", enabled: false,
    criteria: [
      { 
        name: "檯面長度", 
        opts: [
          { l: "<90cm", v: "not ok" },
          { l: "≥90cm", v: 0.6 },
          { l: ">100cm", v: 0.8 },
          { l: ">120cm", v: 1.0 },
          { l: ">150cm", v: 1.2 },
          { l: ">180cm", v: 1.4 }
        ], 
        d: 3 
      },
      { 
        name: "檯面深度", 
        opts: [
          { l: "<60cm", v: "not ok" },
          { l: "≥60cm", v: 0.6 },
          { l: ">70cm", v: 0.8 },
          { l: ">80cm", v: 1.0 },
          { l: ">90cm", v: 1.2 },
          { l: ">120cm", v: 1.4 }
        ], 
        d: 3 
      },
      { 
        name: "環狀走道淨寬", 
        opts: [
          { l: "<70cm", v: "not ok" },
          { l: "≥70cm", v: 0.6 },
          { l: ">80cm", v: 1.0 },
          { l: ">90cm", v: 1.2 }
        ], 
        d: 2 
      },
      { name: "設置水槽", opts: [{ l: "無設置", v: 0 }, { l: "有設置", v: 1.0 }], d: 0 },
      { name: "設置IH爐", opts: [{ l: "無設置", v: 0 }, { l: "有設置", v: 1.0 }], d: 0 },
      { name: "結合餐桌", opts: [{ l: "無結合", v: 0 }, { l: "有結合", v: 1.0 }], d: 0 }
    ]
  },
  {
    id: "yang_tai", name: "工作陽台", enabled: true,
    criteria: [
      { name: "設置室外機", opts: [{ l: "無法設置", v: 0 }, { l: "可設置", v: 1.0 }], d: 1 },
      { name: "設置洗衣機", opts: [{ l: "無法設置", v: "not ok" }, { l: "可設置", v: 1.0 }], d: 1 },
      { name: "設置洗衣槽", opts: [{ l: "無法設置", v: 0.0 }, { l: "可設置", v: 1.0 }], d: 1 },
      { name: "設置曬衣架", opts: [{ l: "無法設置", v: 0 }, { l: "可設置", v: 1.0 }], d: 1 },
      { 
        name: "坪數大小", 
        opts: [
          { l: "<0.7坪", v: "not ok" },
          { l: "≥0.7坪", v: 0.4 },
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
      { name: "床邊留設走道數", opts: [{ l: "<兩邊", v: "not ok" }, { l: "≥兩邊", v: 0.4 }, { l: ">三邊", v: 1.0 }], d: 2 },
      { name: "床邊走道平均淨寬", opts: [{ l: "<50cm", v: 0 }, { l: "≥50cm", v: 0.6 }, { l: ">60cm", v: 1.0 }, { l: ">70cm", v: 1.2 }, { l: ">80cm", v: 1.4 }, { l: ">90cm", v: 1.6 }], d: 2 },
      { 
        name: "衣櫃長度", 
        opts: [
          { l: "<105cm", v: "not ok" },
          { l: "≥105cm", v: 0.2 },
          { l: ">120cm", v: 0.4 },
          { l: ">150cm", v: 0.6 },
          { l: ">180cm", v: 0.8 },
          { l: ">210cm", v: 1.0 },
          { l: ">245cm", v: 1.2 },
          { l: ">300cm", v: 1.4 }
        ], 
        d: 5 
      },
      { name: "衣櫃深度", opts: [{ l: "<60cm", v: "not ok" }, { l: "≥60cm", v: 1.0 }, { l: ">65cm", v: 1.2 }], d: 1 },
      { name: "衣櫃前淨寬", opts: [{ l: "<60cm", v: 0 }, { l: "≥60cm", v: 1.0 }, { l: ">70cm", v: 1.2 }, { l: ">80cm", v: 1.4 }, { l: ">90cm", v: 1.6 }], d: 1 },
      { name: "是否留設梳妝台", opts: [{ l: "無", v: 0 }, { l: "有", v: 1.0 }], d: 1 },
      { name: "床具尺寸", opts: [{ l: "<5x6.2尺", v: "not ok" }, { l: "≥5x6.2尺", v: 0.6 }, { l: ">6x6.2尺", v: 1.0 }, { l: ">6x7尺", v: 1.2 }], d: 2 }
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
      { name: "淨寬", opts: [{ l: "<2m", v: "not ok" }, { l: "≥2m", v: 1.0 }], d: 1 },
      { name: "可否配置床具", opts: [{ l: "無配置", v: 0 }, { l: "單人床", v: 1.0 }, { l: "加大單人床", v: 1.2 }], d: 1 },
      { name: "可否設置衣櫃", opts: [{ l: "無配置", v: 0 }, { l: "有配置", v: 1.0 }], d: 1 }
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

/**
 * 浴室選項防呆連動：兩件式時禁用「三角配置」並強制設為「否(1.0)」
 */
function syncTriangleState(sp) {
  const suiteCrit = sp.criteria.find(c => c.name === "套件數");
  const triIdx = sp.criteria.findIndex(c => c.name === "三角配置");
  if (!suiteCrit || triIdx === -1) return;

  const isTwoPiece = suiteCrit.opts[suiteCrit.d]?.l === "兩件式";
  const card = document.getElementById(`card_${sp.id}`);
  if (card) {
    const selects = card.querySelectorAll("select.crit-select");
    const selTri = selects[triIdx];
    if (selTri) {
      selTri.disabled = isTwoPiece;
      if (isTwoPiece) {
        const noTriIdx = sp.criteria[triIdx].opts.findIndex(o => o.l === "否");
        if (noTriIdx !== -1) {
          sp.criteria[triIdx].d = noTriIdx;
          selTri.value = noTriIdx;
          selTri.classList.remove("not-ok");
        }
      }
    }
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
          <span>滿分: <b id="std_${sp.id}" style="color:#0369a1">0.0</b></span>
          <span>高標: <b id="high_${sp.id}">0.0</b></span>
          <span>實得: <b id="raw_${sp.id}" style="color:var(--primary)">0.0</b></span>
        </div>
      </div>
      <div class="criteria-grid">${criteriaHtml}</div>
    `;
    container.appendChild(card);
    syncTriangleState(sp);
  });

  setPreset('2');
}

function onCritChange(spIdx, critIdx, el) {
  const sp = spaces[spIdx];
  const crit = sp.criteria[critIdx];
  crit.d = parseInt(el.value);
  el.classList.toggle("not-ok", crit.opts[crit.d]?.v === "not ok");

  if (crit.name === "套件數") {
    const isFourPiece = crit.opts[crit.d]?.l === "四件式";
    const tubIdx = sp.criteria.findIndex(c => c.name === "浴缸尺寸");
    if (tubIdx !== -1) {
      const targetTubIdx = isFourPiece
        ? sp.criteria[tubIdx].opts.findIndex(o => o.l === "≥145cm")
        : sp.criteria[tubIdx].opts.findIndex(o => o.l === "未設置");
      if (targetTubIdx !== -1) {
        sp.criteria[tubIdx].d = targetTubIdx;
        syncSelectUI(sp.id, tubIdx, targetTubIdx);
      }
    }
    syncTriangleState(sp);
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
    if (isActive) syncTriangleState(sp);
  }
  calculateAll();
}

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

function updateLayoutConfig() {
  const { roomType, hasPlusOne, suiteCount } = getCurrentLayoutState();

  ["ke_ting", "can_ting", "chu_fang", "yang_tai", "zhu_wo", "ke_yu"].forEach(id => setEnable(id, true));

  const isXuanGuanRequired = roomType >= 2 || (roomType === 1 && hasPlusOne);
  const chkBonusXG = document.getElementById("chkBonusXuanGuan");
  const lblBonusXG = document.getElementById("lblBonusXuanGuan");
  if (lblBonusXG) lblBonusXG.style.display = (roomType === 1 && !hasPlusOne) ? "inline-flex" : "none";
  setEnable("xuan_guan", isXuanGuanRequired || (chkBonusXG ? chkBonusXG.checked : false));

  setEnable("ci_wo_1", roomType >= 2);
  setEnable("ci_wo_2", roomType >= 3);
  setEnable("ci_wo_3", roomType >= 4);

  const hasZhuWoBath = (roomType >= 3) || (suiteCount >= 1);
  setEnable("zhu_wo_bath", hasZhuWoBath);
  setEnable("ci_wo_1_bath", roomType >= 2 && suiteCount >= 2);
  setEnable("ci_wo_2_bath", roomType >= 3 && suiteCount >= 3);
  setEnable("ci_wo_3_bath", roomType >= 4 && suiteCount >= 4);

  setEnable("plus_one", hasPlusOne);

  const chkBonusZD = document.getElementById("chkBonusZhongDao");
  setEnable("zhong_dao", chkBonusZD ? chkBonusZD.checked : false);

  calculateAll();
}

// ==========================================
// 評分計算與基準判定
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
  if (spaceId === "plus_one" && hasPlusOne) return true;
  return false;
}

function getBonusMaxScore(spaceId) {
  if (spaceId === "xuan_guan") return 6.0;
  if (spaceId === "zhu_wo_bath") return 10.0;
  if (["ci_wo_1_bath", "ci_wo_2_bath", "ci_wo_3_bath"].includes(spaceId)) return 10.0;
  if (spaceId === "zhong_dao") return 6.0;
  if (spaceId === "plus_one") return 6.0;
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

  spaces.forEach((sp, spIdx) => {
    let spLow = 0, spPass = 0, spStd = 0, spHigh = 0, spRaw = 0;
    let hasNotOk = false;
    const isBonus = isBonusSpace(sp.id, roomType, hasPlusOne);
    const passIndices = getSpacePassIndices(sp.id, roomType);

    sp.criteria.forEach((crit, critIdx) => {
      const validScores = crit.opts.filter(o => typeof o.v === 'number').map(o => o.v);
      const minVal = validScores.length ? Math.min(...validScores) : 0;
      const maxVal = validScores.length ? Math.max(...validScores) : 0;

      // 1. 滿分標準點數 (std)：客廳深度隨房型尺度階梯式提升
      let stdVal;
      if (sp.id === "ke_ting" && crit.name === "客廳深度") {
        const depthStdValMap = { 1: 1.0, 2: 1.2, 3: 1.4, 4: 1.6 };
        stdVal = depthStdValMap[roomType] ?? 1.2;
      } else {
        const hasOne = crit.opts.some(o => o.v === 1.0);
        const defaultIdx = defaultSpacesData[spIdx]?.criteria[critIdx]?.d ?? 0;
        const defaultVal = typeof crit.opts[defaultIdx]?.v === 'number' ? crit.opts[defaultIdx].v : 0;
        stdVal = hasOne ? 1.0 : defaultVal;
      }

      // 2. 60分及格點數 (pass)：依據空間基準與當前房型動態指派
      const pIdx = passIndices[critIdx] ?? 0;
      const pVal = crit.opts[pIdx]?.v;
      const passVal = typeof pVal === 'number' ? pVal : 0;

      spLow += minVal;
      spPass += passVal;
      spStd += stdVal;
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

    sp.spLow = spLow;
    sp.spPass = spPass;
    sp.spStd = spStd;
    sp.spHigh = spHigh;
    sp.spRaw = spRaw;
    sp.hasNotOk = hasNotOk;

    if (sp.enabled && sp.userActive !== false) {
      totalLowSum += spLow;
      totalHighSum += spHigh;
      rawSum += spRaw;
    }

    // 三段式空間百分制得分計算
    let spacePercentScore = 0;
    if (sp.enabled && sp.userActive !== false && !hasNotOk && spRaw > 0) {
      if (spRaw < spPass) {
        spacePercentScore = spPass > 0 ? (60 * (spRaw / spPass)) : 0;
      } else if (spRaw <= spStd) {
        const ratio = (spStd > spPass) ? (spRaw - spPass) / (spStd - spPass) : 1.0;
        spacePercentScore = 60 + 40 * ratio;
      } else {
        const extraRatio = (spHigh > spStd) ? (spRaw - spStd) / (spHigh - spStd) : 0;
        spacePercentScore = 100 + 20 * extraRatio;
      }
    }

    if (isBonus) {
      const maxBonus = getBonusMaxScore(sp.id);
      totalBonusScore += (Math.min(1.2, spacePercentScore / 100) * maxBonus);
    } else {
      const weight = currentWeights[sp.id] || 0;
      totalBaseScore += weight * (spacePercentScore / 100);
    }

    const elLow = document.getElementById(`low_${sp.id}`);
    const elStd = document.getElementById(`std_${sp.id}`);
    const elHigh = document.getElementById(`high_${sp.id}`);
    const elRaw = document.getElementById(`raw_${sp.id}`);
    if (elLow) elLow.innerText = spLow.toFixed(1);
    if (elStd) elStd.innerText = spStd.toFixed(1);
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
    
    finalEl.style.color = finalScore > 100 
      ? "#b45309" 
      : finalScore >= 80 
      ? "var(--success)" 
      : finalScore >= 59.5 
      ? "var(--primary)" 
      : "var(--danger)";
  }

  updateRadarChart();
}

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
 * 一鍵套用分數預設功能：
 * max: 選取最高分選項 (包含 >1.0 的豪宅頂規加分)
 * standard: 選取標準滿分配置 (客廳深度隨 1~4 房動態適配 3.0m / 3.2m / 3.4m / 3.6m)
 * pass: 精確套用及格配置 (客廳深度隨 1~4 房動態適配 2.8m / 3.0m / 3.2m / 3.4m)
 * min: 選取除了 not ok 之外的最低數值選項
 * @param {'max'|'standard'|'pass'|'min'} mode
 */
function applyExtremePreset(mode) {
  const { roomType } = getCurrentLayoutState();

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

  spaces.forEach((sp, spIdx) => {
    if (!sp.enabled || sp.userActive === false) return;

    sp.criteria.forEach((crit, critIdx) => {
      const validOpts = crit.opts.map((opt, idx) => ({ ...opt, origIdx: idx }))
                                 .filter(opt => typeof opt.v === 'number');
      if (!validOpts.length) return;

      let targetOpt;
      if (mode === 'max') {
        targetOpt = validOpts.reduce((prev, curr) => (curr.v > prev.v ? curr : prev));
      } else if (mode === 'standard') {
        // 客廳深度滿分標準隨房型尺度動態切換
        if (sp.id === "ke_ting" && crit.name === "客廳深度") {
          const depthStdIdxMap = { 1: 4, 2: 5, 3: 6, 4: 7 };
          const targetIdx = depthStdIdxMap[roomType] ?? 5;
          targetOpt = validOpts.find(o => o.origIdx === targetIdx) || validOpts[0];
        } else {
          targetOpt = validOpts.find(o => o.v === 1.0);
          if (!targetOpt) {
            const defaultOrigIdx = defaultSpacesData[spIdx]?.criteria[critIdx]?.d ?? 0;
            targetOpt = validOpts.find(o => o.origIdx === defaultOrigIdx) || validOpts[0];
          }
        }
      } else if (mode === 'pass') {
        const passIndices = getSpacePassIndices(sp.id, roomType);
        const pIdx = passIndices[critIdx] ?? 0;
        targetOpt = validOpts.find(o => o.origIdx === pIdx) || validOpts[0];
      } else {
        targetOpt = validOpts.reduce((prev, curr) => (curr.v < prev.v ? curr : prev));
      }

      crit.d = targetOpt.origIdx;
      syncSelectUI(sp.id, critIdx, targetOpt.origIdx);
    });

    syncTriangleState(sp);
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

    syncTriangleState(sp);
  });

  const chkPlusOne = document.getElementById("chkPlusOne");
  if (chkPlusOne) chkPlusOne.checked = false;

  const chkBonusZD = document.getElementById("chkBonusZhongDao");
  if (chkBonusZD) chkBonusZD.checked = false;

  const chkBonusXG = document.getElementById("chkBonusXuanGuan");
  if (chkBonusXG) chkBonusXG.checked = false;

  const selSuite = document.getElementById("selSuiteCount");
  if (selSuite) selSuite.value = "0";

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
    if (sp.userActive === false || sp.hasNotOk) return 0;

    const pass = sp.spPass || 1;
    const std = sp.spStd || 1;
    const high = sp.spHigh || 1;
    const raw = sp.spRaw || 0;

    if (raw === 0) return 0;
    const isBonus = isBonusSpace(sp.id, roomType, hasPlusOne);

    if (isBonus) {
      if (std <= 0) return 100;
      const bonusRate = Math.max(0, Math.min(1.2, raw / std));
      return Math.round(bonusRate * 100);
    } else {
      if (raw < pass) {
        return Math.round(pass > 0 ? (60 * (raw / pass)) : 0);
      } else if (raw <= std) {
        const ratio = (std > pass) ? (raw - pass) / (std - pass) : 1.0;
        return Math.round(60 + 40 * ratio);
      } else {
        const extraRatio = (high > std) ? (raw - std) / (high - std) : 0;
        return Math.round(100 + 20 * extraRatio);
      }
    }
  });

  const maxVal = Math.max(...dataValues, 100);
  const dynamicMax = Math.ceil(maxVal / 10) * 10;

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
      label: "標準滿分線 (100分)",
      data: highThresholdData,
      backgroundColor: "transparent",
      borderColor: "rgba(22, 163, 74, 0.7)",
      borderWidth: 1.8,
      borderDash: [4, 4],
      pointRadius: 0,
      order: 2
    },
    {
      label: "低標合格線 (60分)",
      data: lowThresholdData,
      backgroundColor: "transparent",
      borderColor: "rgba(220, 38, 38, 0.6)",
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
    radarChartInstance.options.scales.r.ticks.stepSize = 10;
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
              stepSize: 10,
              font: { size: 9 }
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
        <span style="font-size: 0.78rem; color: #64748b; margin-bottom: 2px;">低標及格線</span>
        <span style="font-size: 1.25rem; font-weight: 700; color: #1e293b;">${low}</span>
      </div>
      <div style="display: flex; flex-direction: column; text-align: left;">
        <span style="font-size: 0.78rem; color: #64748b; margin-bottom: 2px;">頂規高標線</span>
        <span style="font-size: 1.25rem; font-weight: 700; color: #1e293b;">${high}</span>
      </div>
      <div style="display: flex; flex-direction: column; text-align: left;">
        <span style="font-size: 0.78rem; color: #64748b; margin-bottom: 2px;">累計實得點數</span>
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

    if (data.hasBonusXuanGuan !== undefined) {
      const chk = document.getElementById("chkBonusXuanGuan");
      if (chk) chk.checked = !!data.hasBonusXuanGuan;
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

    if (data.roomType !== undefined) {
      setPreset(String(data.roomType), false);
    }

    if (data.suiteCount !== undefined) {
      const currentRT = data.roomType !== undefined ? parseInt(data.roomType) : getCurrentLayoutState().roomType;
      updateSuiteOptions(currentRT, false);
      const selSuite = document.getElementById("selSuiteCount");
      if (selSuite) selSuite.value = data.suiteCount;
    }

    spaces.forEach(sp => syncTriangleState(sp));

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
    const chkBonusXG = document.getElementById("chkBonusXuanGuan");
    const selections = {};
    spaces.forEach(sp => { selections[sp.id] = sp.criteria.map(c => c.d); });

    const exportData = {
      projectName: getIptVal("iptProjectName"),
      unitNumber: getIptVal("iptUnitNumber"),
      roomType: String(roomType),
      hasPlusOne: hasPlusOne,
      suiteCount: suiteCount,
      hasBonusZhongDao: chkBonusZD ? chkBonusZD.checked : false,
      hasBonusXuanGuan: chkBonusXG ? chkBonusXG.checked : false,
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
