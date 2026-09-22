// ==========================================
// 住宅房型檢核系統 - 核心邏輯腳本
// ==========================================

let radarChartInstance = null;

// 各房型必備空間固定權重配置表
const SPACE_WEIGHTS = {
  1: { ke_ting: 22, can_ting: 6, chu_fang: 12, yang_tai: 16, zhu_wo: 24, ke_yu: 20 },
  2: { xuan_guan: 7, ke_ting: 14, can_ting: 11, chu_fang: 11, yang_tai: 11, zhu_wo: 16, ke_yu: 15, ci_wo_1: 15 },
  3: { xuan_guan: 6, ke_ting: 15, can_ting: 10, chu_fang: 10, yang_tai: 10, zhu_wo: 11, zhu_wo_bath: 11, ke_yu: 11, ci_wo_1: 8, ci_wo_2: 8 },
  4: { xuan_guan: 5, ke_ting: 16, can_ting: 10, chu_fang: 10, yang_tai: 10, zhu_wo: 11, zhu_wo_bath: 11, ke_yu: 9, ci_wo_1: 6, ci_wo_2: 6, ci_wo_3: 6 }
};

// 各空間專屬標準及格選項索引對應表 (動態路由版)
const SPACE_PASS_INDICES = {
  xuan_guan: [1, 1, 0],
  ke_ting: [1, 0, 2, 0], 
  can_ting: [0, 1, 1],
  chu_fang: [1, 1, 1, 0, 0, 0],
  yang_tai: [0, 1, 0, 1, 2],
  zhu_wo: [1, 0, 1, 1, 3, 1, 0, 1, 1],
  zhu_wo_bath: [0, 1, 1, 1, 2, 0, 1, 1],
  
  ci_wo_template: [1, 0, 1, 1, 1, 1, 0, 0, 1],
  common_bath_template: [0, 1, 1, 1, 2, 0, 1, 0],
  
  zhong_dao: [1, 1, 1, 0, 0, 0],
  geng_yi_jian: [2, 2, 0, 0], 
  plus_one: [0, 1, 1, 0]
};

function getSpacePassIndices(spaceId, roomType) {
  if (spaceId === "ke_ting") {
    const depthPassIdxMap = { 1: 2, 2: 4, 3: 5, 4: 6 };
    const depthIdx = depthPassIdxMap[roomType] ?? 4;
    return [1, 0, depthIdx, 0];
  }
  if (spaceId.startsWith("ci_wo_") && !spaceId.includes("bath")) {
    return SPACE_PASS_INDICES["ci_wo_template"];
  }
  if (spaceId === "ke_yu" || (spaceId.startsWith("ci_wo_") && spaceId.endsWith("_bath"))) {
    return SPACE_PASS_INDICES["common_bath_template"];
  }
  return SPACE_PASS_INDICES[spaceId] || [];
}

// 顏色邏輯判定函數 (紅/綠/藍/橘)
function getScoreColor(raw, pass, std) {
  if (raw < pass) return "#ef4444"; // 小於及格分 = 紅色
  if (raw >= pass && raw < std - 0.01) return "#10b981"; // 大於等於及格分 且 小於滿分 = 綠色
  if (Math.abs(raw - std) <= 0.01) return "#2563eb"; // 等於滿分 = 藍色
  return "#f97316"; // 大於滿分 = 橘色
}

// 通用浴室選項範本
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

function createSecondaryBedroomCriteria() {
  return [
    { name: "空間採光", opts: [{ l: "無", v: 0 }, { l: "間接採光", v: 0.6 }, { l: "直接採光", v: 1.0 }], d: 2 },
    { name: "連接陽台", opts: [{ l: "無連接", v: 0 }, { l: "有連接", v: 1.0 }], d: 0 },
    { name: "床邊走道數", opts: [{ l: "<一邊", v: "not ok" }, { l: "一邊", v: 0.6 }, { l: "兩邊", v: 0.8 }, { l: "三邊", v: 1.0 }], d: 2 },
    { name: "床邊走道淨寬", opts: [{ l: "<50cm", v: 0 }, { l: "≥50cm", v: 0.6 }, { l: ">60cm", v: 1.0 }, { l: ">70cm", v: 1.2 }, { l: ">80cm", v: 1.4 }, { l: ">90cm", v: 1.6 }], d: 2 },
    { name: "衣櫃長度", opts: [{ l: "<105cm", v: "not ok" }, { l: "≥105cm", v: 0.6 }, { l: ">120cm", v: 0.8 }, { l: ">150cm", v: 1.0 }, { l: ">180cm", v: 1.2 }, { l: ">210cm", v: 1.4 }], d: 3 },
    { name: "衣櫃深度", opts: [{ l: "<60cm", v: "not ok" }, { l: "≥60cm", v: 1.0 }, { l: ">65cm", v: 1.2 }], d: 1 },
    { name: "衣櫃前淨寬", opts: [{ l: "<60cm", v: 0 }, { l: "≥60cm", v: 1.0 }, { l: ">70cm", v: 1.2 }, { l: ">80cm", v: 1.4 }, { l: ">90cm", v: 1.6 }], d: 1 },
    { name: "是否留設梳妝台", opts: [{ l: "無", v: 0 }, { l: "有", v: 1.0 }], d: 1 },
    { name: "床具尺寸", opts: [{ l: "<5x6.2尺", v: 0 }, { l: "≥5x6.2尺", v: 1.0 }, { l: ">6x6.2尺", v: 1.2 }], d: 1 }
  ];
}

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
      { name: "客廳深度", opts: [{ l: "<2.7m", v: "not ok" }, { l: "≥2.7m", v: 0.4 }, { l: ">2.8m", v: 0.6 }, { l: ">2.9m", v: 0.8 }, { l: ">3m", v: 1.0 }, { l: ">3.2m", v: 1.2 }, { l: ">3.4m", v: 1.4 }, { l: ">3.6m", v: 1.6 }, { l: ">4m", v: 1.8 }], d: 4 },
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
      { name: "檯面長度", opts: [{ l: "<90cm", v: "not ok" }, { l: "≥90cm", v: 0.6 }, { l: ">100cm", v: 0.8 }, { l: ">120cm", v: 1.0 }, { l: ">150cm", v: 1.2 }, { l: ">180cm", v: 1.4 }], d: 3 },
      { name: "檯面深度", opts: [{ l: "<60cm", v: "not ok" }, { l: "≥60cm", v: 0.6 }, { l: ">70cm", v: 0.8 }, { l: ">80cm", v: 1.0 }, { l: ">90cm", v: 1.2 }, { l: ">120cm", v: 1.4 }], d: 3 },
      { name: "環狀走道淨寬", opts: [{ l: "<70cm", v: "not ok" }, { l: "≥70cm", v: 0.6 }, { l: ">80cm", v: 1.0 }, { l: ">90cm", v: 1.2 }], d: 2 },
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
      { name: "坪數大小", opts: [{ l: "<0.7坪", v: "not ok" }, { l: "≥0.7坪", v: 0.4 }, { l: ">0.8坪", v: 0.6 }, { l: ">1坪", v: 0.8 }, { l: ">1.2坪", v: 1.0 }, { l: ">1.4坪", v: 1.2 }], d: 4 }
    ]
  },
{
    id: "zhu_wo", name: "主臥房", enabled: true,
    criteria: [
      { name: "空間採光", opts: [{ l: "無採光", v: "not ok" }, { l: "間接採光", v: 0.6 }, { l: "直接採光", v: 1.0 }], d: 2 },
      { name: "連接陽台", opts: [{ l: "無連接", v: 0 }, { l: "有連接", v: 1.0 }], d: 0 },
      { name: "床邊留設走道數", opts: [{ l: "<兩邊", v: "not ok" }, { l: "≥兩邊", v: 0.4 }, { l: ">三邊", v: 1.0 }], d: 2 },
      { name: "床邊走道平均淨寬", opts: [{ l: "<50cm", v: 0 }, { l: "≥50cm", v: 0.6 }, { l: ">60cm", v: 1.0 }, { l: ">70cm", v: 1.2 }, { l: ">80cm", v: 1.4 }, { l: ">90cm", v: 1.6 }], d: 2 },
      
      // ★ 替換這一行：在最後面加入「另設更衣間」選項
      { name: "衣櫃長度", opts: [{ l: "<105cm", v: "not ok" }, { l: "≥105cm", v: 0.2 }, { l: ">120cm", v: 0.4 }, { l: ">150cm", v: 0.6 }, { l: ">180cm", v: 0.8 }, { l: ">210cm", v: 1.0 }, { l: ">245cm", v: 1.2 }, { l: ">300cm", v: 1.4 }, { l: "另設更衣間", v: 1.0 }], d: 5 },
      
      { name: "衣櫃深度", opts: [{ l: "<60cm", v: "not ok" }, { l: "≥60cm", v: 1.0 }, { l: ">65cm", v: 1.2 }], d: 1 },
      { name: "衣櫃前淨寬", opts: [{ l: "<60cm", v: 0 }, { l: "≥60cm", v: 1.0 }, { l: ">70cm", v: 1.2 }, { l: ">80cm", v: 1.4 }, { l: ">90cm", v: 1.6 }], d: 1 },
      { name: "是否留設梳妝台", opts: [{ l: "無", v: 0 }, { l: "有", v: 1.0 }], d: 1 },
      { name: "床具尺寸", opts: [{ l: "<5x6.2尺", v: "not ok" }, { l: "≥5x6.2尺", v: 0.6 }, { l: ">6x6.2尺", v: 1.0 }, { l: ">6x7尺", v: 1.2 }], d: 2 }
    ]
  },
  {
    id: "geng_yi_jian", name: "更衣間", enabled: false,
    criteria: [
      { name: "衣櫃長度", opts: [{ l: "<150cm", v: "not ok" }, { l: "≥150cm", v: 0.6 }, { l: ">180cm", v: 0.8 }, { l: ">210cm", v: 1.0 }, { l: ">240cm", v: 1.2 }, { l: ">300cm", v: 1.4 }], d: 3 },
      { name: "走道淨寬", opts: [{ l: "<70cm", v: "not ok" }, { l: "≥70cm", v: 0.6 }, { l: ">80cm", v: 0.8 }, { l: ">90cm", v: 1.0 }, { l: ">100cm", v: 1.2 }], d: 3 },
      { name: "精品中島櫃", opts: [{ l: "無設置", v: 0 }, { l: "有設置", v: 1.0 }], d: 0 },
      { name: "梳妝台", opts: [{ l: "無設置", v: 0 }, { l: "有設置", v: 1.0 }], d: 0 }
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

    // ★ 更新空間卡標題：加入五項分數顯示
    card.innerHTML = `
      <div class="space-header">
        <div class="space-title">
          <label class="space-active-toggle" title="勾選代表本案有留設此空間機能">
            <input type="checkbox" id="toggle_${sp.id}" ${sp.userActive ? 'checked' : ''} onchange="toggleSpaceActive('${sp.id}', this.checked)" style="width:15px; height:15px; cursor:pointer;">
            <span>${sp.name}</span>
          </label>
          ${badgeHtml}
        </div>
        <div class="space-scores" style="gap: 12px; font-size: 0.85rem;">
          <span>低標: <b id="low_${sp.id}">0.00</b></span>
          <span>及格: <b id="pass_${sp.id}">0.00</b></span>
          <span>滿分: <b id="std_${sp.id}">0.00</b></span>
          <span>高標: <b id="high_${sp.id}">0.00</b></span>
          <span style="font-weight: 700; color: #1e293b;">實得: <b id="raw_${sp.id}">0.00</b></span>
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

  // 現有邏輯：衛浴套件數連動浴缸
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

  // ★ 新增：主臥衣櫃雙向連動更衣間
  if (sp.id === "zhu_wo" && crit.name === "衣櫃長度") {
    const isGengYiJianSelected = (crit.opts[crit.d]?.l === "另設更衣間");
    const chkGengYiJian = document.getElementById("chkBonusGengYiJian");
    if (chkGengYiJian && chkGengYiJian.checked !== isGengYiJianSelected) {
      chkGengYiJian.checked = isGengYiJianSelected; // 改變上方 checkbox 狀態
      toggleBonusSpace("geng_yi_jian", isGengYiJianSelected); // 觸發更衣間卡片的顯示/隱藏
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

  // ★ 新增：如果勾選「更衣間」，自動將主臥房衣櫃長度切換為「另設更衣間」
  if (spaceId === "geng_yi_jian" && isChecked) {
    const zhuWo = spaces.find(s => s.id === "zhu_wo");
    if (zhuWo) {
      const wardrobeIdx = zhuWo.criteria.findIndex(c => c.name === "衣櫃長度");
      if (wardrobeIdx !== -1) {
        const targetOptIdx = zhuWo.criteria[wardrobeIdx].opts.findIndex(o => o.l === "另設更衣間");
        if (targetOptIdx !== -1) {
          zhuWo.criteria[wardrobeIdx].d = targetOptIdx; // 更新底層資料
          syncSelectUI("zhu_wo", wardrobeIdx, targetOptIdx); // 同步更新 UI 下拉選單
        }
      }
    }
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

  const chkBonusGYJ = document.getElementById("chkBonusGengYiJian");
  setEnable("geng_yi_jian", chkBonusGYJ ? chkBonusGYJ.checked : false);

  calculateAll();
}

// ----------------------------------------------------
// 核心計算區 (全面落實 矩陣相乘)
// ----------------------------------------------------

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
  // 修正 BUG：1房的玄關永遠當作外掛加分空間(拿 3.0 權重)，不受是否有 +1房 干擾
  if (roomType === 1 && spaceId === "xuan_guan") return true; 
  
  if (roomType === 2 && spaceId === "zhu_wo_bath") return true;
  const secondarySuiteBaths = ["ci_wo_1_bath", "ci_wo_2_bath", "ci_wo_3_bath"];
  if (secondarySuiteBaths.includes(spaceId)) return true;
  if (spaceId === "zhong_dao") return true;
  if (spaceId === "geng_yi_jian") return true;
  if (spaceId === "plus_one" && hasPlusOne) return true;
  return false;
}

function getBonusMaxScore(spaceId) {
  if (spaceId === "xuan_guan") return 3.0; 
  if (spaceId === "zhu_wo_bath") return 8.0; 
  if (["ci_wo_1_bath", "ci_wo_2_bath", "ci_wo_3_bath"].includes(spaceId)) return 8.0;
  if (spaceId === "zhong_dao") return 6.0; 
  if (spaceId === "geng_yi_jian") return 4.0; 
  if (spaceId === "plus_one") return 4.0; 
  return 0.0;
}

function calculateAll() {
  const { roomType, hasPlusOne } = getCurrentLayoutState();
  const currentWeights = SPACE_WEIGHTS[roomType] || SPACE_WEIGHTS[2];

  let rawSum = 0.0;
  let totalPassSum = 0.0;   
  let totalStdSum = 0.0;  

  spaces.forEach((sp, spIdx) => {
    const isBonus = isBonusSpace(sp.id, roomType, hasPlusOne);
    const passIndices = getSpacePassIndices(sp.id, roomType);

    // 1. 取得空間滿分權重 (A)
    let spaceWeight = isBonus ? getBonusMaxScore(sp.id) : (currentWeights[sp.id] || 0);

    // 2. 取得項目基底分 (B = A / 項目數)
    const itemCount = sp.criteria.length;
    const itemBaseValue = itemCount > 0 ? (spaceWeight / itemCount) : 0;

    let sumMinV = 0, sumPassV = 0, sumStdV = 0, sumHighV = 0, sumRawV = 0;
    let hasNotOk = false;

    sp.criteria.forEach((crit, critIdx) => {
      const validScores = crit.opts.filter(o => typeof o.v === 'number').map(o => o.v);
      const minV = validScores.length ? Math.min(...validScores) : 0;
      const maxV = validScores.length ? Math.max(...validScores) : 0;

      const pIdx = passIndices[critIdx] ?? 0;
      const passV = typeof crit.opts[pIdx]?.v === 'number' ? crit.opts[pIdx].v : 0;

      // 嚴格遵守 F = (OC=1) * B 定律，拔除所有假標準特例
      const defaultIdx = defaultSpacesData[spIdx]?.criteria[critIdx]?.d ?? 0;
      const targetOpt = crit.opts.find(o => o.v === 1.0) || crit.opts[defaultIdx];
      const stdV = typeof targetOpt?.v === 'number' ? targetOpt.v : 0;

      sumMinV += minV;
      sumPassV += passV;
      sumStdV += stdV;
      sumHighV += maxV;

      if (sp.enabled && sp.userActive !== false) {
        const selOpt = crit.opts[crit.d];
        if (selOpt) {
          if (selOpt.v === "not ok") {
            hasNotOk = true;
          } else {
            sumRawV += Number(selOpt.v);
          }
        }
      }
    });

    if (hasNotOk) sumRawV = 0;

    // 3. 矩陣相乘 (係數 × 基底分)
    const spLow = sumMinV * itemBaseValue;
    const spPass = sumPassV * itemBaseValue; 
    const spStd = sumStdV * itemBaseValue;
    const spHigh = sumHighV * itemBaseValue;
    const spRaw = sumRawV * itemBaseValue;

    sp.spLow = spLow;
    sp.spPass = spPass;
    sp.spStd = spStd;
    sp.spHigh = spHigh;
    sp.spRaw = spRaw;
    sp.hasNotOk = hasNotOk;

    // 4. 雷達圖資料點映射 (無上限百分比)
    let radarPercent = 0;
    let passPercent = 0;
    if (sumStdV > 0) {
      if (hasNotOk || sumRawV === 0) {
        radarPercent = 0;
      } else {
        radarPercent = (sumRawV / sumStdV) * 100;
      }
      passPercent = (sumPassV / sumStdV) * 100;
    }

    sp.radarPercent = radarPercent;
    sp.passPercent = passPercent;

    if (sp.enabled && sp.userActive !== false) {
      totalPassSum += spPass;
      totalStdSum += spStd;
      rawSum += spRaw;
    }

    // 填入 5 項分數
    const elLow = document.getElementById(`low_${sp.id}`);
    const elPass = document.getElementById(`pass_${sp.id}`);
    const elStd = document.getElementById(`std_${sp.id}`);
    const elHigh = document.getElementById(`high_${sp.id}`);
    const elRaw = document.getElementById(`raw_${sp.id}`);
    
    if (elLow) elLow.innerText = spLow.toFixed(2);
    if (elPass) elPass.innerText = spPass.toFixed(2);
    if (elStd) elStd.innerText = spStd.toFixed(2);
    if (elHigh) elHigh.innerText = spHigh.toFixed(2);
    
    // ★ 更新空間卡實得顏色
    if (elRaw) {
      const displayRaw = sp.enabled && sp.userActive !== false ? spRaw : 0;
      elRaw.innerText = displayRaw.toFixed(2);
      if (sp.enabled && sp.userActive !== false && !hasNotOk) {
        elRaw.style.color = getScoreColor(displayRaw, spPass, spStd);
      } else {
        elRaw.style.color = "#ef4444"; // 含有不合格項目直接紅字
      }
    }
  });

  // 底部總分顯示更新
  const dispPassSum = document.getElementById("dispPassSum");
  const dispStdSum = document.getElementById("dispStdSum");
  const dispFinal = document.getElementById("dispFinal");
  
  if (dispPassSum) dispPassSum.innerText = totalPassSum.toFixed(1);
  if (dispStdSum) dispStdSum.innerText = totalStdSum.toFixed(1);

  if (dispFinal) {
    dispFinal.innerText = rawSum.toFixed(1);
    // ★ 更新全案實得顏色
    dispFinal.style.color = getScoreColor(rawSum, totalPassSum, totalStdSum);
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
        // 嚴格遵守 F = (OC=1) 定律，拔除客廳深度的特例判定
        const defaultOrigIdx = defaultSpacesData[spIdx]?.criteria[critIdx]?.d ?? 0;
        targetOpt = validOpts.find(o => o.v === 1.0) || validOpts.find(o => o.origIdx === defaultOrigIdx) || validOpts[0];
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

// ----------------------------------------------------
// 圖表繪製與報表輸出
// ----------------------------------------------------

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
    return Math.round(sp.radarPercent || 0);
  });

  const highThresholdData = new Array(labels.length).fill(100);
  const lowThresholdData = chartSpaces.map(sp => Math.round(sp.passPercent || 0));

  const maxVal = Math.max(...dataValues, 100);
  const dynamicMax = Math.ceil(maxVal / 10) * 10;

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
      label: "標準滿分線 (100%)",
      data: highThresholdData,
      backgroundColor: "transparent",
      borderColor: "rgba(37, 99, 235, 0.6)", // 藍色標準線
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      pointHitRadius: 0,
      order: 2
    },
    {
      label: "及格底線 (各空間動態標準)", 
      data: lowThresholdData,
      backgroundColor: "transparent",
      borderColor: "rgba(220, 38, 38, 0.7)",
      borderWidth: 1.8,
      borderDash: [3, 3],
      pointRadius: 0,
      pointHitRadius: 0,
      order: 3
    }
  ];

  if (radarChartInstance) {
    radarChartInstance.destroy();
  }

  radarChartInstance = new Chart(canvas.getContext("2d"), {
    type: "radar",
    data: {
      labels: labels,
      datasets: chartDatasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
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

function exportReportPDF() {
  const pass = document.getElementById("dispPassSum")?.innerText || "0.0";
  const std = document.getElementById("dispStdSum")?.innerText || "0.0";
  const finalEl = document.getElementById("dispFinal");
  const final = finalEl ? finalEl.innerText : "0.0";
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
    <div style="display: flex; gap: 32px; align-items: center;">
      <div style="display: flex; flex-direction: column; text-align: left;">
        <span style="font-size: 0.78rem; color: #64748b; margin-bottom: 2px;">及格分</span>
        <span style="font-size: 1.25rem; font-weight: 700; color: #10b981;">${pass}</span>
      </div>
      <div style="display: flex; flex-direction: column; text-align: left;">
        <span style="font-size: 0.78rem; color: #64748b; margin-bottom: 2px;">滿分</span>
        <span style="font-size: 1.25rem; font-weight: 700; color: #2563eb;">${std}</span>
      </div>
      <div style="display: flex; flex-direction: column; text-align: left;">
        <span style="font-size: 0.78rem; color: #64748b; margin-bottom: 2px;">實得總分</span>
        <div style="display: flex; align-items: baseline; gap: 4px;">
          <span style="font-size: 2rem; font-weight: 800; color: ${finalColor}; line-height: 1;">${final}</span>
          <span style="font-size: 0.9rem; color: #64748b; font-weight: 600;">分</span>
        </div>
      </div>
    </div>
  `;

  window.print();
}

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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderSpaces);
} else {
  renderSpaces();
}
