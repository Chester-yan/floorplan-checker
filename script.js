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

// 通用浴室選項範本 (8項指標 - 全衛浴無乾濕分離改為 0 分)
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
 * 次臥房選項範本生成器
 * @returns {Array} 包含採光、陽台、套房、走道與衣櫃等 10 項評估指標陣列
 */
function createSecondaryBedroomCriteria() {
  return [
    { name: "空間採光", opts: [{ l: "無", v: 0 }, { l: "間接採光", v: 0.6 }, { l: "直接採光", v: 1.0 }], d: 2 },
    { name: "連接陽台", opts: [{ l: "無連接", v: 0 }, { l: "有連接", v: 1.0 }], d: 0 },
    { name: "是否為套房", opts: [{ l: "否", v: 0 }, { l: "是", v: 1.0 }], d: 0, isSuiteTrigger: true },
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
      { name: "設置升降曬衣架", opts: [{ l: "無設置", v: 0 }, { l: "有設置", v: 1.0 }], d: 1 },
      { name: "開門窗是否影響曬衣架", opts: [{ l: "有影響", v: 0 }, { l: "無影響", v: 1.0 }], d: 1 },
      { name: "坪數大小", opts: [{ l: "<1坪", v: 0.0 }, { l: ">1坪", v: 0.6 }, { l: ">1.2坪", v: 1.0 }], d: 1 }
    ]
  },
  {
    id: "zhu_wo", name: "主臥房", enabled: true,
    criteria: [
      { name: "空間採光", opts: [{ l: "無採光", v: "not ok" }, { l: "間接採光", v: 0.6 }, { l: "直接採光", v: 1.0 }], d: 2 },
      { name: "連接陽台", opts: [{ l: "無連接", v: 0 }, { l: "有連接", v: 1.0 }], d: 0 },
      { name: "是否為套房", opts: [{ l: "否", v: 0 }, { l: "是", v: 1.0 }], d: 0, isSuiteTrigger: true },
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

/**
 * 讀取文字輸入框內容並去除前後空白，若為空則回傳預設值
 * @param {string} id - DOM 元素 ID
 * @param {string} fallback - 預設回傳值
 * @returns {string} 輸入值或替代預設字串
 */
const getIptVal = (id, fallback = "") => {
  const el = document.getElementById(id);
  return el && el.value.trim() ? el.value.trim() : fallback;
};

/**
 * 同步卡片內指定下拉選單的選項，並自動切換 not-ok 警示紅框樣式
 * @param {string} spaceId - 空間唯一識別碼 (如 ke_ting)
 * @param {number} critIdx - 該空間下的指標索引
 * @param {number} val - 目標選項索引
 */
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

/**
 * 取得當前頂部房型配置狀態 (房型數與 +1 房勾選狀態)
 * @returns {{ roomType: number, hasPlusOne: boolean }} 當前格局配置狀態
 */
function getCurrentLayoutState() {
  const selEl = document.getElementById("selBedrooms");
  const chkPlusOne = document.getElementById("chkPlusOne");
  return {
    roomType: selEl ? parseInt(selEl.value) : 2,
    hasPlusOne: chkPlusOne ? chkPlusOne.checked : false
  };
}

/**
 * 切換特定空間的啟用與顯示狀態 (同步更新資料模型與卡片 DOM)
 * @param {string} id - 空間識別碼
 * @param {boolean} isEnable - 是否啟用並顯示
 */
function setEnable(id, isEnable) {
  const sp = spaces.find(s => s.id === id);
  if (sp) {
    sp.enabled = isEnable;
    const card = document.getElementById(`card_${id}`);
    if (card) card.classList.toggle("hidden", !isEnable);
  }
}

/**
 * 檢查特定臥房空間目前是否設定為「套房」
 * @param {string} spaceId - 臥房空間識別碼 (如 zhu_wo, ci_wo_1)
 * @returns {boolean} true: 是套房, false: 非套房
 */
function checkIsSuite(spaceId) {
  const sp = spaces.find(s => s.id === spaceId);
  if (!sp) return false;
  const crit = sp.criteria.find(c => c.name === "是否為套房");
  return (crit?.opts[crit.d]?.l === "是") ? true : false;
}

// ==========================================
// 空間渲染與連動控制
// ==========================================

/**
 * 初始化動態渲染所有空間卡片與指標下拉選單，並預設套用 2 房規格
 */
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

/**
 * 使用者變更指標下拉選項時觸發：更新資料模型、樣式連動與防呆聯動 (四件式衛浴自動配置浴缸)
 * @param {number} spIdx - 空間在 spaces 陣列中的索引
 * @param {number} critIdx - 指標在 criteria 陣列中的索引
 * @param {HTMLSelectElement} el - 當前被更動的下拉選單元素
 */
function onCritChange(spIdx, critIdx, el) {
  const sp = spaces[spIdx];
  const crit = sp.criteria[critIdx];
  crit.d = parseInt(el.value);
  el.classList.toggle("not-ok", crit.opts[crit.d]?.v === "not ok");

  // 防呆：衛浴套件數切換時，自動同步配置或重設浴缸尺寸
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

  if (crit.name === "是否為套房" || (sp.id === "chu_fang" && crit.name === "設置中島")) {
    updateLayoutConfig();
  } else {
    calculateAll();
  }
}

/**
 * 空間標題勾選框切換事件：標記空間建案是否實際留設 (未留設時變灰並鎖定選單)
 * @param {string} spaceId - 空間識別碼
 * @param {boolean} isActive - 是否實際留設啟用
 */
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
 * 依當前房型、+1房、套房數量及中島配置，動態更新各空間卡片的顯示與隱藏狀態
 */
function updateLayoutConfig() {
  const { roomType, hasPlusOne } = getCurrentLayoutState();

  ["ke_ting", "can_ting", "chu_fang", "yang_tai", "zhu_wo", "ke_yu"].forEach(id => setEnable(id, true));
  setEnable("xuan_guan", true);

  // 3 房以上主臥套浴為必備基準，常態顯示卡片；1 房與 2 房有勾選套房才顯示
  setEnable("zhu_wo_bath", roomType >= 3 ? true : checkIsSuite("zhu_wo"));

  setEnable("ci_wo_1", roomType >= 2);
  setEnable("ci_wo_2", roomType >= 3);
  setEnable("ci_wo_3", roomType >= 4);

  setEnable("ci_wo_1_bath", roomType >= 2 && checkIsSuite("ci_wo_1"));
  setEnable("ci_wo_2_bath", roomType >= 3 && checkIsSuite("ci_wo_2"));
  setEnable("ci_wo_3_bath", roomType >= 4 && checkIsSuite("ci_wo_3"));

  setEnable("plus_one", hasPlusOne);
  
// 中島空間改為獨立常態顯示的加分卡片，由使用者自行決定是否勾選啟用
  setEnable("zhong_dao", false);

  calculateAll();
}

// ==========================================
// 評分計算與基準判定
// ==========================================

/**
 * 判定指定空間是否為當前格局的「必備基準空間」
 */
function isBaselineRequiredSpace(spaceId, roomType, hasPlusOne) {
  if (spaceId === "xuan_guan") return roomType >= 2 || (roomType === 1 && hasPlusOne);
  if (spaceId === "ci_wo_1") return roomType >= 2;
  if (spaceId === "ci_wo_2") return roomType >= 3;
  if (spaceId === "ci_wo_3") return roomType >= 4;
  // 僅 3 房以上主臥套浴強制為必備
  if (spaceId === "zhu_wo_bath") return roomType >= 3;

  const coreSpaces = ["ke_ting", "can_ting", "chu_fang", "yang_tai", "zhu_wo", "ke_yu"];
  return coreSpaces.includes(spaceId);
}

/**
 * 判定指定空間是否屬於「純加分空間」(不佔必備分母，外加突破 100 分)
 */
function isBonusSpace(spaceId, roomType, hasPlusOne) {
  // 1 房未 +1 時，玄關為加分項
  if (roomType === 1 && !hasPlusOne && spaceId === "xuan_guan") {
    return true;
  }
  // 2 房主臥若有套房衛浴，視為加分項目
  if (roomType === 2 && spaceId === "zhu_wo_bath") return true;
  // 2 房以上之次臥專屬套浴 (次衛 1/2/3) 為加分項
  const secondarySuiteBaths = ["ci_wo_1_bath", "ci_wo_2_bath", "ci_wo_3_bath"];
  if (roomType >= 2 && secondarySuiteBaths.includes(spaceId)) {
    return true;
  }
  // 獨立中島空間為加分項
  if (spaceId === "zhong_dao") {
    return true;
  }
  return false;
}

/**
 * 全案評分引擎核心 (空間權重分配制)
 */
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
    const isRequired = isBaselineRequiredSpace(sp.id, roomType, hasPlusOne);
    const isBonus = isBonusSpace(sp.id, roomType, hasPlusOne);

    // 計算每個指標的高低標
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

    // 只要有致命傷 not ok，該空間原始實得分歸 0
    if (hasNotOk) {
      spRaw = 0;
    }

    // 統計啟用空間的總高標與總低標
    if (sp.enabled && sp.userActive !== false) {
      totalLowSum += spLow;
      totalHighSum += spHigh;
    }

    // 計算內部比例 (0.0 ~ 1.0)
    let ratio = 0.0;
    if (sp.enabled && sp.userActive !== false && spRaw > 0) {
      if (spHigh > spLow) {
        ratio = Math.max(0, Math.min(1, (spRaw - spLow) / (spHigh - spLow)));
      } else {
        ratio = 1.0;
      }
    }

    // 分流計算：加分空間 vs 必備空間
    if (isBonus) {
      // 加分空間：不佔 100 分基準，外加獎勵分 (依表現給予 0 ~ maxBonus)
      const maxBonus = getBonusMaxScore(sp.id, roomType);
      totalBonusScore += (ratio * maxBonus);
      if (sp.enabled && sp.userActive !== false) {
        rawSum += spRaw;
      }
    } else {
      // 必備空間：權重百分制 (基準及格 60% ~ 滿分 100%)
      const weight = currentWeights[sp.id] || 0;
      let spaceFinalScore = 0;

      if (sp.enabled && sp.userActive !== false && !hasNotOk) {
        // 合格時基本起跳拿權重的 60%，優良指標往上拿到 100%
        spaceFinalScore = weight * (0.6 + 0.4 * ratio);
      } else {
        // 未留設或出現致命硬傷 (not ok)，直接歸 0，損失該空間完整權重！
        spaceFinalScore = 0;
      }

      totalBaseScore += spaceFinalScore;

      if (sp.enabled && sp.userActive !== false) {
        rawSum += spRaw;
      }
    }

    // 即時更新個別卡片數據
    const elLow = document.getElementById(`low_${sp.id}`);
    const elHigh = document.getElementById(`high_${sp.id}`);
    const elRaw = document.getElementById(`raw_${sp.id}`);
    if (elLow) elLow.innerText = spLow.toFixed(1);
    if (elHigh) elHigh.innerText = spHigh.toFixed(1);
    if (elRaw) elRaw.innerText = (sp.enabled && sp.userActive !== false ? spRaw : 0).toFixed(1);
  });

  // 四個核心統計數據更新
  const dispLowSum = document.getElementById("dispLowSum");
  const dispHighSum = document.getElementById("dispHighSum");
  const dispRaw = document.getElementById("dispRaw");
  
  if (dispLowSum) dispLowSum.innerText = totalLowSum.toFixed(1);   // 1. 低標分數加總
  if (dispHighSum) dispHighSum.innerText = totalHighSum.toFixed(1); // 2. 高標分數加總
  if (dispRaw) dispRaw.innerText = rawSum.toFixed(1);             // 3. 實得分數加總

  // 4. 轉換百分制分數 (必備加權基礎分 + 加分空間外加分)
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

/**
 * 房型按鈕點選切換：切換選中狀態樣式，連動更新套房數量與空間可用性
 * @param {string|number} roomNum - 房數 ('1', '2', '3', '4')
 * @param {boolean} shouldAllocate - 是否自動重配套房數量預設值
 */
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

/**
 * 依房型數量取得當前格局包含的有效臥房識別碼陣列
 * @param {number} roomType - 房型數量 (1~4)
 * @returns {Array<string>} 臥房 ID 陣列 (如 ['zhu_wo', 'ci_wo_1'])
 */
function getActiveBedroomIds(roomType) {
  const rooms = ["zhu_wo"];
  if (roomType >= 2) rooms.push("ci_wo_1");
  if (roomType >= 3) rooms.push("ci_wo_2");
  if (roomType >= 4) rooms.push("ci_wo_3");
  return rooms;
}

/**
 * 動態產生「套房數量」下拉選單選項，並在切換房型時自動設定預設值 (1 房強制預設 0 套全雅房，2 房以上預設 1 套)
 * @param {number} roomType - 房型數量
 * @param {boolean} shouldAllocate - 是否執行預設套房分配
 */
function updateSuiteOptions(roomType, shouldAllocate = true) {
  const suiteSel = document.getElementById("selSuiteCount");
  if (!suiteSel) return;

  let html = "";
  for (let i = 0; i <= roomType; i++) {
    html += `<option value="${i}">${i === 0 ? "0 套 (全雅房)" : `${i} 套房`}</option>`;
  }
  suiteSel.innerHTML = html;

  if (shouldAllocate) {
    // 1 房與 2 房預設 0 套 (單衛標準配置)；3 房以上預設 1 套 (主臥套房)
    const defaultCount = (roomType <= 2) ? 0 : 1;
    suiteSel.value = defaultCount;
    applySuiteAllocation(defaultCount, roomType);
  }

  updateSpecTitle();
}

/**
 * 依指定套房數量，由主臥開始循序將各臥室設為套房並更新選單
 * @param {number} count - 套房總數
 * @param {number} roomType - 房數
 */
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

/**
 * 使用者手動更改「套房數量」下拉選單時觸發：重新分配套房與更新版面
 * @param {string|number} count - 選擇的套房數量
 */
function onSuiteCountChange(count) {
  const { roomType } = getCurrentLayoutState();
  applySuiteAllocation(parseInt(count), roomType);
  updateLayoutConfig();
  updateSpecTitle();
}

/**
 * 勾選或取消「+1 房」時觸發：重新檢驗格局連動與更新報表標題
 * @param {boolean} checked - 是否勾選 +1 房
 */
function togglePlusOne(checked) {
  updateLayoutConfig();
  updateSpecTitle();
}

/**
 * 一鍵套用極端值功能 (絕對不破壞加分空間開關狀態)
 * max: 將當前啟用的必備空間全數選在最高分 (總分精準等於 100.0)
 * min: 將當前啟用的必備空間全數選在最低合格分 (總分精準等於 60.0)
 */
function applyExtremePreset(mode) {
  const { roomType, hasPlusOne } = getCurrentLayoutState();

  spaces.forEach((sp) => {
    // 嚴格隔離：只調整當前已經啟用、且畫面上看得見的空間
    if (!sp.enabled || sp.userActive === false) return;
    
    // 如果是加分空間（例如次臥衛浴、中島），且使用者未手動開啟，絕不自動套用！
    const isRequired = isBaselineRequiredSpace(sp.id, roomType, hasPlusOne);
    if (!isRequired && !sp.enabled) return;

    sp.criteria.forEach((crit, critIdx) => {
      const validOpts = crit.opts.map((opt, idx) => ({ ...opt, origIdx: idx })).filter(opt => typeof opt.v === 'number');
      if (!validOpts.length) return;

      let targetOpt;
      if (mode === 'max') {
        // 最高分：挑選數值最大的選項
        targetOpt = validOpts.reduce((prev, curr) => (curr.v > prev.v ? curr : prev));
      } else {
        // 最低及格分：挑選數值最小的選項 (剛好等於 spLow，使 ratio 精確等於 0，總分精確等於 60.0)
        targetOpt = validOpts.reduce((prev, curr) => (curr.v < prev.v ? curr : prev));
      }

      crit.d = targetOpt.origIdx;
      syncSelectUI(sp.id, critIdx, targetOpt.origIdx);
    });
  });

  calculateAll();
  updateSpecTitle();
}

/**
 * 一鍵恢復預設值：重設所有空間指標選項、清除圖片、重設為 2 房初始格局
 */
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

/**
 * 組合當前規格標準字串 (如 "1房/0套房", "3+1房/2套房")
 * @returns {string} 規格描述文字
 */
function getFormattedRoomSpec() {
  const { roomType, hasPlusOne } = getCurrentLayoutState();
  const suiteSel = document.getElementById("selSuiteCount");
  const suiteCount = suiteSel ? suiteSel.value : "0";
  return `${roomType}${hasPlusOne ? "+1" : ""}房/${suiteCount}套房`;
}

/**
 * 更新畫面上規格文字與網頁頁籤標題 (日期_建案_戶號_房型檢核報表)
 */
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

/**
 * 繪製或更新 Chart.js 雷達圖：
 * 1. 標準必備空間依內部得分率滿分對齊 100 分綠線
 * 2. 加分空間高分時自 100 分起跳突破加分 (最高 140)
 * 3. 坐標軸刻度因應破百項目動態向外擴展
 */
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
      // 加分空間：具備此機能即突破 100 分，依得分表現向外延展至 140 分
      const bonusRate = (high > low) ? Math.max(0, Math.min(1, (raw - low) / (high - low))) : 1.0;
      return Math.round(100 + bonusRate * 40);
    } else {
      // 標準基準空間：依內部得分率對齊 0～100 分量尺
      if (high <= low) return 100;
      const ratio = Math.max(0, Math.min(1, (raw - low) / (high - low)));
      return Math.round(ratio * 100);
    }
  });

  // 動態擴展雷達圖上限：有加分空間突破時，軸度擴展至 120 或 140
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

/**
 * 產生列印版面摘要資訊盒並調用瀏覽器列印對話框 (PDF 報表匯出)
 */
function exportReportPDF() {
  const low = document.getElementById("dispLow")?.innerText || "60.0";
  const high = document.getElementById("dispHigh")?.innerText || "100.0";
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
        <span style="font-size: 0.78rem; color: #64748b; margin-bottom: 2px;">合格門檻線</span>
        <span style="font-size: 1.25rem; font-weight: 700; color: #1e293b;">${low}</span>
      </div>
      <div style="display: flex; flex-direction: column; text-align: left;">
        <span style="font-size: 0.78rem; color: #64748b; margin-bottom: 2px;">基準滿分線</span>
        <span style="font-size: 1.25rem; font-weight: 700; color: #1e293b;">${high}</span>
      </div>
      <div style="display: flex; flex-direction: column; text-align: left;">
        <span style="font-size: 0.78rem; color: #64748b; margin-bottom: 2px;">累計實得點數</span>
        <span style="font-size: 1.25rem; font-weight: 700; color: #1e293b;">${raw}</span>
      </div>
      <div style="display: flex; flex-direction: column; text-align: left;">
        <span style="font-size: 0.78rem; color: #64748b; margin-bottom: 2px;">全案綜合得分</span>
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

/**
 * 處理家配圖檔案上傳並轉為 DataURL 於畫面預覽
 * @param {HTMLInputElement} input - File Input 元素
 */
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

/**
 * 觸發隱藏的家配圖檔案上傳輸入框以更換平面圖
 */
function triggerReupload() {
  const ipt = document.getElementById("iptFloorPlan");
  if (ipt) { ipt.value = ""; ipt.click(); }
}

/**
 * 清除已載入的家配圖圖片並恢復佔位提示塊
 */
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

/**
 * 開啟 AI 檢核數據代碼貼入視窗
 */
function importFromAI() {
  const modal = document.getElementById("aiModal");
  const textarea = document.getElementById("iptAiJson");
  if (textarea) textarea.value = "";
  if (modal) modal.style.display = "flex";
}

/**
 * 關閉 AI 檢核代碼視窗
 */
function closeAiModal() {
  const modal = document.getElementById("aiModal");
  if (modal) modal.style.display = "none";
}

/**
 * 解析使用者貼上的 JSON 代碼並還原載入系統：
 * 包含建案名稱、戶號、房型、套房分配、停用空間與指標選項等完整狀態
 */
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
      if (selSuite) {
        selSuite.value = data.suiteCount;
        applySuiteAllocation(parseInt(data.suiteCount), parseInt(data.roomType ?? 2));
      }
    }

    updateLayoutConfig();
    updateSpecTitle();
    closeAiModal();
    alert("✅ 評估資料載入成功！房型規格、雷達圖與評分已同步。");

  } catch (err) {
    alert("格式解析失敗，請確認貼上完整的 JSON 內容。\n錯誤原因：" + err.message);
  }
}

/**
 * 將當前評估狀態打包為 JSON 並自動下載為純文字檔 (.txt)
 */
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
