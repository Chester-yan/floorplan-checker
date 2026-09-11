let radarChartInstance = null;

// 通用浴室選項範本
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

// 次臥房選項範本
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

// 全空間資料模型
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
  {
    id: "zhu_wo_bath", name: "主臥浴室", enabled: false, isSuiteBath: true,
    criteria: JSON.parse(JSON.stringify(bathCriteriaTemplate))
  },
  {
    id: "ci_wo_1", name: "次臥房 1", enabled: true,
    criteria: createSecondaryBedroomCriteria()
  },
  {
    id: "ci_wo_1_bath", name: "次臥浴室 1", enabled: false, isSuiteBath: true,
    criteria: JSON.parse(JSON.stringify(bathCriteriaTemplate))
  },
  {
    id: "ci_wo_2", name: "次臥房 2", enabled: false,
    criteria: createSecondaryBedroomCriteria()
  },
  {
    id: "ci_wo_2_bath", name: "次臥浴室 2", enabled: false, isSuiteBath: true,
    criteria: JSON.parse(JSON.stringify(bathCriteriaTemplate))
  },
  {
    id: "ci_wo_3", name: "次臥房 3", enabled: false,
    criteria: createSecondaryBedroomCriteria()
  },
  {
    id: "ci_wo_3_bath", name: "次臥浴室 3", enabled: false, isSuiteBath: true,
    criteria: JSON.parse(JSON.stringify(bathCriteriaTemplate))
  },
  {
    id: "ke_yu", name: "浴室 (公用客浴)", enabled: true,
    criteria: JSON.parse(JSON.stringify(bathCriteriaTemplate))
  },
  {
    id: "plus_one", name: "+1 房", enabled: false,
    criteria: [
      { name: "開窗", opts: [{ l: "無開窗", v: 0 }, { l: "有開窗", v: 1.0 }], d: 1 },
      { name: "淨寬", opts: [{ l: "小於2m", v: 0.5 }, { l: "大於2m", v: 1.0 }], d: 0 },
      { name: "可否配置床具", opts: [{ l: "無配置", v: 0 }, { l: "單人床", v: 1.0 }, { l: "雙人床", v: 1.2 }], d: 1 },
      { name: "是否設置衣櫃", opts: [{ l: "無配置", v: 0 }, { l: "有配置", v: 1.0 }], d: 1 }
    ]
  },
];

// 確保所有空間具備使用者手動啟用旗標 (預設為 true)
spaces.forEach(sp => {
  if (sp.userActive === undefined) {
    sp.userActive = true;
  }
});

// 深拷貝一份初始資料作為還原基準
const defaultSpacesData = JSON.parse(JSON.stringify(spaces));

// 頁面渲染初始化
function renderSpaces() {
  const container = document.getElementById("spacesContainer");
  if (!container) return;
  container.innerHTML = "";
  
  spaces.forEach((sp, spIdx) => {
    const card = document.createElement("div");
    // 若未設置則套用 is-disabled
    card.className = `space-card ${sp.enabled ? '' : 'hidden'} ${!sp.userActive ? 'is-disabled' : ''} ${sp.isSuiteBath ? 'is-suite-bath' : ''}`;
    card.id = `card_${sp.id}`;

    let criteriaHtml = "";
    sp.criteria.forEach((crit, critIdx) => {
      let optHtml = "";
      crit.opts.forEach((opt, optIdx) => {
        const isSel = optIdx === crit.d ? "selected" : "";
        optHtml += `<option value="${optIdx}" ${isSel}>${opt.l} (${opt.v})</option>`;
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
      <div class="criteria-grid">
        ${criteriaHtml}
      </div>
    `;
    container.appendChild(card);
  });
  
  updateSuiteOptions(2);
  updateLayoutConfig();
  updateSpecTitle();
}

// 監聽選項變更
function onCritChange(spIdx, critIdx, el) {
  const sp = spaces[spIdx];
  const crit = sp.criteria[critIdx];
  crit.d = parseInt(el.value);

  // 若改動浴室的「套件數」且選為「四件式」，浴缸尺寸自動預設為「<145cm」
  if (crit.name === "套件數") {
    const selectedOpt = crit.opts[crit.d];
    if (selectedOpt && selectedOpt.l === "四件式") {
      const tubCritIdx = sp.criteria.findIndex(c => c.name === "浴缸尺寸");
      if (tubCritIdx !== -1) {
        const tubCrit = sp.criteria[tubCritIdx];
        const targetTubIdx = tubCrit.opts.findIndex(o => o.l === "<145cm");

        if (targetTubIdx !== -1) {
          // 1. 更新資料模型
          tubCrit.d = targetTubIdx;

          // 2. 同步更新畫面下拉選單
          const card = document.getElementById(`card_${sp.id}`);
          if (card) {
            const selects = card.querySelectorAll("select.crit-select");
            if (selects[tubCritIdx]) {
              selects[tubCritIdx].value = targetTubIdx;
            }
          }
        }
      }
    }
  }

  // 若改動「是否為套房」或廚房的「設置中島」，統一觸發卡片連動與重算
  if (crit.name === "是否為套房" || (sp.id === "chu_fang" && crit.name === "設置中島")) {
    updateLayoutConfig();
  } else {
    calculateAll();
  }
}

// 啟用或停用單一空間
function setEnable(id, isEnable) {
  const sp = spaces.find(s => s.id === id);
  if (sp) {
    sp.enabled = isEnable;
    const card = document.getElementById(`card_${id}`);
    if (card) {
      if (isEnable) card.classList.remove("hidden");
      else card.classList.add("hidden");
    }
  }
}

// 檢查某房間是否選為套房
function checkIsSuite(spaceId) {
  const sp = spaces.find(s => s.id === spaceId);
  if (!sp) return false;
  const crit = sp.criteria.find(c => c.name === "是否為套房");
  if (!crit) return false;
  return crit.opts[crit.d].l === "是";
}

// 核心函式一：動態房型與套浴切換
function updateLayoutConfig() {
  const selEl = document.getElementById("selBedrooms");
  const roomType = selEl ? parseInt(selEl.value) : 2;

  // 1. 常態基礎空間
  setEnable("xuan_guan", roomType >= 2);
  setEnable("ke_ting", true);
  setEnable("can_ting", true);
  setEnable("chu_fang", true);
  setEnable("yang_tai", true);
  setEnable("zhu_wo", true);

  // 2. 次臥房依房型動態展開
  setEnable("ci_wo_1", roomType >= 2);
  setEnable("ci_wo_2", roomType >= 3);
  setEnable("ci_wo_3", roomType >= 4);

  // 3. 套浴連動判斷：完全取決於各房間當前的「是否為套房」
  setEnable("zhu_wo_bath", checkIsSuite("zhu_wo"));
  setEnable("ci_wo_1_bath", roomType >= 2 && checkIsSuite("ci_wo_1"));
  setEnable("ci_wo_2_bath", roomType >= 3 && checkIsSuite("ci_wo_2"));
  setEnable("ci_wo_3_bath", roomType >= 4 && checkIsSuite("ci_wo_3"));

  // 4. 客浴常時開啟
  setEnable("ke_yu", true);

  // 5. +1 房開關狀態判斷
  const hasPlusOne = document.getElementById("chkPlusOne") ? document.getElementById("chkPlusOne").checked : false;
  setEnable("plus_one", hasPlusOne);

  // 6. 中島狀態同步
  const kitchenSp = spaces.find(s => s.id === "chu_fang");
  const islandCrit = kitchenSp ? kitchenSp.criteria.find(c => c.name === "設置中島") : null;
  const isIslandActive = islandCrit ? islandCrit.opts[islandCrit.d].l === "有設置" : false;
  setEnable("zhong_dao", isIslandActive);
  
  // 7. 重新加總計分
  calculateAll();
}

// 核心函式二：排除 not ok 的正確計分邏輯
function calculateAll() {
  let totalLow = 0, totalHigh = 0, totalRaw = 0;

  spaces.forEach((sp) => {
    let spLow = 0, spHigh = 0, spRaw = 0;
    
    // 只有在空間被房型啟用 (sp.enabled) 且使用者確認「有設置 (sp.userActive)」時才計算分數
    const isCalculating = sp.enabled && (sp.userActive !== false);

    sp.criteria.forEach((crit) => {
      const validScores = crit.opts
        .filter(o => typeof o.v === 'number')
        .map(o => o.v);

      const minVal = validScores.length > 0 ? Math.min(...validScores) : 0;
      const maxVal = validScores.length > 0 ? Math.max(...validScores) : 0;

      if (isCalculating) {
        spLow += minVal;
        spHigh += maxVal;

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

    if (isCalculating) {
      totalLow += spLow;
      totalHigh += spHigh;
      totalRaw += spRaw;
    }
  });

  const dispLow = document.getElementById("dispLow");
  const dispHigh = document.getElementById("dispHigh");
  const dispRaw = document.getElementById("dispRaw");
  if (dispLow) dispLow.innerText = totalLow.toFixed(1);
  if (dispHigh) dispHigh.innerText = totalHigh.toFixed(1);
  if (dispRaw) dispRaw.innerText = totalRaw.toFixed(1);

  let finalScore = 60.0;
  if (totalHigh > totalLow) {
    finalScore = 60.0 + ((totalRaw - totalLow) / (totalHigh - totalLow)) * 40.0;
  }
  finalScore = Math.max(0, Math.min(100, finalScore));
  
  const finalEl = document.getElementById("dispFinal");
  if (finalEl) {
    finalEl.innerText = finalScore.toFixed(1);
    if (finalScore >= 80) finalEl.style.color = "var(--success)";
    else if (finalScore >= 60) finalEl.style.color = "var(--primary)";
    else finalEl.style.color = "var(--danger)";
  }

  updateRadarChart();
}

// 點擊頂部 1/2/3/4 房按鈕切換（防呆優化版）
function setPreset(roomNum) {
  const selEl = document.getElementById("selBedrooms");
  if (selEl) selEl.value = roomNum;

  const btns = document.querySelectorAll(".type-btn");
  btns.forEach(b => {
    b.classList.remove("active");
    if (b.getAttribute("onclick") === `setPreset('${roomNum}')`) {
      b.classList.add("active");
    }
  });

  // 由此函式統一更新「套房數量」選單並依序分配房間狀態
  updateSuiteOptions(parseInt(roomNum));

  updateLayoutConfig();
}

// 輸出評估結果 PDF 報表
function exportReportPDF() {
  const low = document.getElementById("dispLow") ? document.getElementById("dispLow").innerText : "0.0";
  const high = document.getElementById("dispHigh") ? document.getElementById("dispHigh").innerText : "0.0";
  const raw = document.getElementById("dispRaw") ? document.getElementById("dispRaw").innerText : "0.0";
  
  const finalEl = document.getElementById("dispFinal");
  const final = finalEl ? finalEl.innerText : "60.0";
  const finalColor = finalEl ? window.getComputedStyle(finalEl).color : "#1e3a8a";

  const projectName = document.getElementById("iptProjectName") && document.getElementById("iptProjectName").value.trim() 
    ? document.getElementById("iptProjectName").value.trim() 
    : "未指定建案";
  const unitNumber = document.getElementById("iptUnitNumber") && document.getElementById("iptUnitNumber").value.trim() 
    ? document.getElementById("iptUnitNumber").value.trim() 
    : "未指定戶號";
  const roomSpec = typeof getFormattedRoomSpec === "function" ? getFormattedRoomSpec() : "規格未定義";

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  // 列印前更新網頁標題以供預設存檔檔名
  updateSpecTitle();

  // 同步結論輸入框內容到列印文字標籤中
  const conclusionVal = document.getElementById("iptConclusion") ? document.getElementById("iptConclusion").value.trim() : "";
  const dispConclusion = document.getElementById("dispConclusion");
  if (dispConclusion) {
    dispConclusion.innerText = conclusionVal || "本案整體空間規劃良好，動線流暢且機能配置完善。";
  }

  // 建立或更新列印專用摘要資訊 (置於家配圖上方)
  let summaryBox = document.getElementById("printSummaryBox");
  if (!summaryBox) {
    summaryBox = document.createElement("div");
    summaryBox.id = "printSummaryBox";
    summaryBox.className = "print-summary-box";
    
    // 錨點優先選擇家配圖卡片，若無則選雷達圖
    const planCard = document.getElementById("planCard");
    const radarCard = document.getElementById("radarChartCard");
    const targetAnchor = planCard || radarCard;

    if (targetAnchor && targetAnchor.parentNode) {
      targetAnchor.parentNode.insertBefore(summaryBox, targetAnchor);
    }
  }

  summaryBox.innerHTML = `
    <div>
      <div style="font-size: 1.25rem; font-weight: 800; color: #1e3a8a; margin-bottom: 4px;">
        ${projectName} ‧ ${unitNumber}
      </div>
      <div style="font-size: 0.95rem; font-weight: 600; color: #334155;">房型：${roomSpec}</div>
      <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">產出時間：${yyyy}-${mm}-${dd}</div>
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

function togglePlusOne(checked) {
  setEnable("plus_one", checked);
  calculateAll();
  updateSpecTitle(); // 更新房型標籤
}

// 一鍵切換所有空間選單為最高分或最低分
function applyExtremePreset(mode) {
  spaces.forEach((sp) => {
    sp.criteria.forEach((crit, critIdx) => {
      const validOpts = crit.opts
        .map((opt, idx) => ({ ...opt, origIdx: idx }))
        .filter(opt => typeof opt.v === 'number');

      if (validOpts.length === 0) return;

      const targetOpt = (mode === 'max')
        ? validOpts.reduce((prev, curr) => (curr.v > prev.v ? curr : prev))
        : validOpts.reduce((prev, curr) => (curr.v < prev.v ? curr : prev));
      // 2. 更新資料模型中的選中索引
      crit.d = targetOpt.origIdx;
      
      // 3. 同步更新 DOM 畫面上的下拉選單選取狀態
      const card = document.getElementById(`card_${sp.id}`);
      if (card) {
        const selectEls = card.querySelectorAll("select.crit-select");
        if (selectEls[critIdx]) {
          selectEls[critIdx].value = targetOpt.origIdx;
        }
      }
    });
  });
  
  // 4. 重新加總計分
  updateLayoutConfig();
  updateSpecTitle(); // 補上這行，確保極端值切換時規格標籤同步
}

// 取得當前房型內所有啟用的房間 ID 清單（依套房配置優先順序）
function getActiveBedroomIds(roomType) {
  const rooms = ["zhu_wo"];
  if (roomType >= 2) rooms.push("ci_wo_1");
  if (roomType >= 3) rooms.push("ci_wo_2");
  if (roomType >= 4) rooms.push("ci_wo_3");
  return rooms;
}

// 依據目前房型動態重組「套房數量」下拉選單
function updateSuiteOptions(roomType) {
  const suiteSel = document.getElementById("selSuiteCount");
  if (!suiteSel) return;

  const maxSuites = roomType; // N 房最多可設 N 間套房
  const currentVal = parseInt(suiteSel.value);
  
  let html = "";
  for (let i = 0; i <= maxSuites; i++) {
    const label = i === 0 ? "0 套 (全雅房)" : `${i} 套房`;
    html += `<option value="${i}">${label}</option>`;
  }
  suiteSel.innerHTML = html;

// 預設為 1 套房；若先前有手動選擇過則保留其值
  const defaultSuiteCount = Math.min(maxSuites, isNaN(currentVal) ? 1 : currentVal);
  suiteSel.value = defaultSuiteCount;
  
  applySuiteAllocation(defaultSuiteCount, roomType);
  updateSpecTitle();
}

// 依套房數量自動依序配置：主臥 -> 次臥1 -> 次臥2 -> 次臥3
function applySuiteAllocation(count, roomType) {
  const activeBedrooms = getActiveBedroomIds(roomType);

  activeBedrooms.forEach((roomId, idx) => {
    const isSuite = idx < count ? 1 : 0; // 前 count 間設為套房(1)，其餘為雅房(0)

    // 1. 更新資料模型
    const sp = spaces.find(s => s.id === roomId);
    if (sp) {
      const suiteCrit = sp.criteria.find(c => c.name === "是否為套房");
      if (suiteCrit) suiteCrit.d = isSuite;
    }

    // 2. 同步更新卡片內的下拉選單顯示
    const card = document.getElementById(`card_${roomId}`);
    if (card) {
      const selects = card.querySelectorAll("select.crit-select");
      const suiteIdx = sp.criteria.findIndex(c => c.name === "是否為套房");
      if (suiteIdx !== -1 && selects[suiteIdx]) {
        selects[suiteIdx].value = isSuite;
      }
    }
  });
}

// 當使用者手動切換頂部「套房數量」時觸發
function onSuiteCountChange(count) {
  const selEl = document.getElementById("selBedrooms");
  const roomType = selEl ? parseInt(selEl.value) : 2;
  applySuiteAllocation(count, roomType);
  updateLayoutConfig();
  updateSpecTitle();
}

function resetToDefault() {
  // 1. 深度還原 spaces 資料模型的選取值與設置狀態
  defaultSpacesData.forEach((origSp, spIdx) => {
    const sp = spaces[spIdx];
    sp.userActive = origSp.userActive !== undefined ? origSp.userActive : true;

    // 同步勾選狀態與卡片樣式
    const chkToggle = document.getElementById(`toggle_${sp.id}`);
    if (chkToggle) chkToggle.checked = sp.userActive;

    const card = document.getElementById(`card_${sp.id}`);
    if (card) {
      if (sp.userActive) card.classList.remove("is-disabled");
      else card.classList.add("is-disabled");

      const selectEls = card.querySelectorAll("select.crit-select");
      origSp.criteria.forEach((origCrit, critIdx) => {
        sp.criteria[critIdx].d = origCrit.d;
        if (selectEls[critIdx]) {
          selectEls[critIdx].value = origCrit.d;
          selectEls[critIdx].disabled = !sp.userActive;
        }
      });
    }
  });

  // 2. 還原 +1 房核取方塊
  const chkPlusOne = document.getElementById("chkPlusOne");
  if (chkPlusOne) chkPlusOne.checked = false;

  // 3. 強制將套房數量選單重設為 1 套房
  const suiteSel = document.getElementById("selSuiteCount");
  if (suiteSel) suiteSel.value = 1;

  // 4. 清空上傳圖片並還原提示框
  const imgFloorPlan = document.getElementById("imgFloorPlan");
  const planPlaceholder = document.getElementById("planPlaceholder");
  const iptFloorPlan = document.getElementById("iptFloorPlan");

  if (imgFloorPlan) {
    imgFloorPlan.src = "";
    imgFloorPlan.style.display = "none";
  }
  if (planPlaceholder) {
    planPlaceholder.style.display = "block";
  }
  if (iptFloorPlan) {
    iptFloorPlan.value = "";
  }

  // 5. 清空結論輸入框與預覽文字
  const iptConclusion = document.getElementById("iptConclusion");
  if (iptConclusion) iptConclusion.value = "";
  const dispConclusion = document.getElementById("dispConclusion");
  if (dispConclusion) dispConclusion.innerText = "";
  
  // 6. 還原回預設 2 房
  setPreset('2');
}

// 計算目前房型規格字串（例：2+1房/1套房）
function getFormattedRoomSpec() {
  const selEl = document.getElementById("selBedrooms");
  const roomType = selEl ? selEl.value : "2";
  const hasPlusOne = document.getElementById("chkPlusOne") && document.getElementById("chkPlusOne").checked;
  const suiteSel = document.getElementById("selSuiteCount");
  const suiteCount = suiteSel ? suiteSel.value : "1";

  const roomName = hasPlusOne ? `${roomType}+1房` : `${roomType}房`;
  return `${roomName}/${suiteCount}套房`;
}

// 即時更新頂部標籤與網頁標題 (確保另存 PDF 時檔名正確)
function updateSpecTitle() {
  const specEl = document.getElementById("dispRoomSpec");
  const roomSpec = getFormattedRoomSpec();
  if (specEl) {
    specEl.innerText = roomSpec;
  }

  // 取得建案與戶號
  const projectName = document.getElementById("iptProjectName") && document.getElementById("iptProjectName").value.trim() 
    ? document.getElementById("iptProjectName").value.trim() 
    : "未指定建案";
  const unitNumber = document.getElementById("iptUnitNumber") && document.getElementById("iptUnitNumber").value.trim() 
    ? document.getElementById("iptUnitNumber").value.trim() 
    : "未指定戶號";

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;

  const fullTitle = `${dateStr}_${projectName}_${unitNumber}_房型檢核報表`;

  // 1. 更新當前頁面標題
  document.title = fullTitle;

  // 2. 嘗試穿透外層框架 (相容 CodePen / iframe 預覽環境)
  try {
    if (window.top && window.top !== window) {
      window.top.document.title = fullTitle;
    }
  } catch (e) {
    // 跨域安全性限制時忽略
  }
}

// 動態更新空間機能雷達圖
function updateRadarChart() {
  const canvas = document.getElementById("radarChart");
  if (!canvas || typeof Chart === "undefined") return;

  // 只過濾出「房型啟用 且 使用者勾選有設置」的空間
  const activeSpaces = spaces.filter(sp => sp.enabled && (sp.userActive !== false));
  const labels = activeSpaces.map(sp => sp.name);
  const dataValues = activeSpaces.map(sp => {
    const lowEl = document.getElementById(`low_${sp.id}`);
    const highEl = document.getElementById(`high_${sp.id}`);
    const rawEl = document.getElementById(`raw_${sp.id}`);

    const low = lowEl ? parseFloat(lowEl.innerText) : 0;
    const high = highEl ? parseFloat(highEl.innerText) : 1;
    const raw = rawEl ? parseFloat(rawEl.innerText) : 0;

    if (high <= low) return 100;
    const rate = Math.round(((raw - low) / (high - low)) * 40 + 60);
    return Math.max(0, Math.min(100, rate));
  });

  if (radarChartInstance) {
    radarChartInstance.data.labels = labels;
    radarChartInstance.data.datasets[0].data = dataValues;
    radarChartInstance.update();
  } else {
    const ctx = canvas.getContext("2d");
    radarChartInstance = new Chart(ctx, {
      type: "radar",
      data: {
        labels: labels,
        datasets: [{
          label: "空間機能標準分",
          data: dataValues,
          backgroundColor: "rgba(30, 58, 138, 0.15)",
          borderColor: "#1e3a8a",
          pointBackgroundColor: "#1e3a8a",
          pointBorderColor: "#fff",
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: "#1e3a8a",
          borderWidth: 2,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 10,
            bottom: 15,
            left: 15,
            right: 15
          }
        },
        scales: {
          r: {
            min: 50,
            max: 100,
            ticks: {
              stepSize: 10,
              font: { size: 10 }
            },
            pointLabels: {
              font: { size: 11, weight: "bold" },
              color: "#334155"
            }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }
}

// 開啟 AI 匯入彈窗
function importFromAI() {
  const modal = document.getElementById("aiModal");
  const textarea = document.getElementById("iptAiJson");
  if (textarea) textarea.value = "";
  if (modal) modal.style.display = "flex";
}

// 關閉 AI 匯入彈窗
function closeAiModal() {
  const modal = document.getElementById("aiModal");
  if (modal) modal.style.display = "none";
}

// 確認載入並執行資料同步
// 確認載入並執行資料同步
function confirmImportFromAI() {
  const textarea = document.getElementById("iptAiJson");
  if (!textarea || !textarea.value.trim()) {
    alert("請先貼上代碼！");
    return;
  }

  try {
    // 清洗不可見字符與全形空白
    let cleanText = textarea.value.trim().replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ');
    const data = JSON.parse(cleanText);

    // 1. 基本資訊填入
    if (data.projectName !== undefined) {
      const el = document.getElementById("iptProjectName");
      if (el) el.value = data.projectName;
    }
    if (data.unitNumber !== undefined) {
      const el = document.getElementById("iptUnitNumber");
      if (el) el.value = data.unitNumber;
    }

    // 2. 動態房型套用按鈕切換（切換 1/2/3/4 房按鈕樣式與受控項）
    if (data.roomType !== undefined) {
      setPreset(String(data.roomType));
    }

    // 3. +1 房開關切換
    if (data.hasPlusOne !== undefined) {
      const chk = document.getElementById("chkPlusOne");
      if (chk) {
        chk.checked = !!data.hasPlusOne;
        togglePlusOne(chk.checked);
      }
    }

    // 4. 套房數量還原
    if (data.suiteCount !== undefined) {
      const selSuite = document.getElementById("selSuiteCount");
      if (selSuite) {
        selSuite.value = data.suiteCount;
        onSuiteCountChange(parseInt(data.suiteCount));
      }
    }

    // 5. 綜合結語填入
    if (data.conclusion !== undefined) {
      const el = document.getElementById("iptConclusion");
      if (el) el.value = data.conclusion;
    }

    // 6. 自動關閉未設置空間
    if (Array.isArray(data.disabledSpaces)) {
      data.disabledSpaces.forEach(spaceId => {
        const chk = document.getElementById(`toggle_${spaceId}`);
        if (chk) chk.checked = false;
        toggleSpaceActive(spaceId, false);
      });
    }

    // 7. 選項同步至資料模型與畫面選單
    if (data.selections) {
      Object.keys(data.selections).forEach(spaceId => {
        const sp = spaces.find(s => s.id === spaceId);
        if (sp) {
          data.selections[spaceId].forEach((optIdx, critIdx) => {
            if (sp.criteria[critIdx] !== undefined) {
              sp.criteria[critIdx].d = optIdx;
              const card = document.getElementById(`card_${sp.id}`);
              if (card) {
                const selects = card.querySelectorAll("select.crit-select");
                if (selects[critIdx]) selects[critIdx].value = optIdx;
              }
            }
          });
        }
      });
    }

    updateLayoutConfig();
    updateSpecTitle();
    closeAiModal();
    alert("✅ 評估資料載入成功！房型按鈕、+1房、套房數量與所有評估已同步。");

  } catch (err) {
    alert("格式解析失敗，請確認貼上完整的 JSON 內容。\n錯誤原因：" + err.message);
  }
}

// 切換特定空間的設置開關
function toggleSpaceActive(spaceId, isActive) {
  const sp = spaces.find(s => s.id === spaceId);
  if (!sp) return;

  sp.userActive = isActive;
  const card = document.getElementById(`card_${spaceId}`);
  
  if (card) {
    if (isActive) {
      card.classList.remove("is-disabled");
    } else {
      card.classList.add("is-disabled");
    }
    // 連動關閉/開啟卡片內所有下拉選單
    const selects = card.querySelectorAll("select.crit-select");
    selects.forEach(sel => {
      sel.disabled = !isActive;
    });
  }

  // 重新計算總分與更新雷達圖
  calculateAll();
}

// 家配圖上傳與預覽
function onFloorPlanUpload(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = document.getElementById("imgFloorPlan");
      const placeholder = document.getElementById("planPlaceholder");
      const actions = document.getElementById("planImgActions");

      if (img) {
        img.src = e.target.result;
        img.style.display = "block";
      }
      if (placeholder) {
        placeholder.style.display = "none";
      }
      if (actions) {
        actions.style.display = "flex";
      }
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// 匯出當前系統所有設定與評估資料為 JSON 字串
function exportCurrentJSON() {
  try {
    const projectName = document.getElementById("iptProjectName") ? document.getElementById("iptProjectName").value.trim() : "";
    const unitNumber = document.getElementById("iptUnitNumber") ? document.getElementById("iptUnitNumber").value.trim() : "";
    
    // 取得當前動態房型套用值 (1, 2, 3, 4)
    const selBedrooms = document.getElementById("selBedrooms") ? document.getElementById("selBedrooms").value : "2";
    
    // 取得 +1 房勾選狀態
    const chkPlusOne = document.getElementById("chkPlusOne");
    const hasPlusOne = chkPlusOne ? chkPlusOne.checked : false;

    // 取得套房數量設定
    const selSuite = document.getElementById("selSuiteCount");
    const suiteCount = selSuite ? parseInt(selSuite.value) : 1;

    const conclusion = document.getElementById("iptConclusion") ? document.getElementById("iptConclusion").value.trim() : "";

    // 1. 抓取被手動關閉（未設置）的空間 ID
    const disabledSpaces = spaces
      .filter(sp => sp.userActive === false)
      .map(sp => sp.id);

    // 2. 抓取所有空間當前的選取值
    const selections = {};
    spaces.forEach(sp => {
      selections[sp.id] = sp.criteria.map(crit => crit.d);
    });

    // 3. 組成完整標準資料包
    const exportData = {
      projectName: projectName,
      unitNumber: unitNumber,
      roomType: selBedrooms,       // 動態房型按鈕 (1/2/3/4)
      hasPlusOne: hasPlusOne,     // ＋1房勾選狀態 (true/false)
      suiteCount: suiteCount,     // 套房數量
      disabledSpaces: disabledSpaces,
      conclusion: conclusion,
      selections: selections
    };

    const jsonString = JSON.stringify(exportData, null, 2);

    // 4. 開啟彈窗並把內容填入
    const modal = document.getElementById("aiModal");
    const textarea = document.getElementById("iptAiJson");
    if (modal && textarea) {
      textarea.value = jsonString;
      modal.style.display = "flex";
      textarea.focus();
      textarea.select();
    }

    // 5. 自動寫入剪貼簿
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(jsonString).then(() => {
        alert("✅ 當前評估 JSON 代碼已自動複製至剪貼簿！\n已完整記錄房型、+1房、套房數及各空間評估。");
      }).catch(() => {
        alert("已為您產生評估代碼！請直接在框中按 Ctrl+C 複製。");
      });
    } else {
      alert("已為您產生評估代碼！請直接在框中按 Ctrl+C 複製。");
    }

  } catch (err) {
    console.error("匯出失敗：", err);
    alert("匯出發生錯誤：" + err.message);
  }
}

// 降級備用彈窗（若剪貼簿權限受限時提供手動選取複製）
function promptFallback(text) {
  const modal = document.getElementById("aiModal");
  const textarea = document.getElementById("iptAiJson");
  if (modal && textarea) {
    textarea.value = text;
    modal.style.display = "flex";
    textarea.focus();
    textarea.select();
    alert("已產生當前狀態代碼！請在彈出的框中按下 Ctrl+C 複製儲存。");
  }
}

// 觸發重新選擇檔案
function triggerReupload() {
  const ipt = document.getElementById("iptFloorPlan");
  if (ipt) {
    ipt.value = ""; // 清空 value，避免選同一張圖片時不觸發 onchange
    ipt.click();
  }
}

// 移除當前圖片並還原上傳提示框
function removeFloorPlan() {
  const img = document.getElementById("imgFloorPlan");
  const placeholder = document.getElementById("planPlaceholder");
  const ipt = document.getElementById("iptFloorPlan");
  const actions = document.getElementById("planImgActions");

  if (img) {
    img.src = "";
    img.style.display = "none";
  }
  if (placeholder) placeholder.style.display = "block";
  if (ipt) ipt.value = "";
  if (actions) actions.style.display = "none";
}


// 全域相容與功能掛載（供 HTML 行內事件 onclick / onchange 調用）

// 家配圖控制
window.triggerReupload = triggerReupload;         // 觸發重新選擇圖片（清空檔案快取並喚起選檔視窗）
window.removeFloorPlan = removeFloorPlan;         // 移除當前家配圖並還原上傳提示框
window.onFloorPlanUpload = onFloorPlanUpload;     // 讀取上傳的圖片檔並即時預覽顯示

// AI 數據匯入與狀態 JSON 匯出
window.importFromAI = importFromAI;               // 開啟「匯入 AI 檢核數據」彈窗
window.closeAiModal = closeAiModal;               // 關閉 AI 匯入彈窗
window.confirmImportFromAI = confirmImportFromAI; // 解析貼上的 JSON 數據並自動套用至全系統
window.exportCurrentJSON = exportCurrentJSON;     // 匯出當前所有微調後的評估數據為 JSON 並複製到剪貼簿

// 空間與評分連動
window.toggleSpaceActive = toggleSpaceActive;     // 切換單一空間的啟用/未留設狀態（影響計分母體與選單開關）
window.applyExtremePreset = applyExtremePreset;   // 一鍵將所有空間選單設為滿分（max）或低標（min）
window.updateRadarChart = updateRadarChart;       // 即時重繪空間機能指標雷達圖

// 房型與套浴規格設定
window.setPreset = setPreset;                     // 點擊頂部 1/2/3/4 房按鈕切換房型預設
window.togglePlusOne = togglePlusOne;             // 切換「+1 房」開關並連動更新規格與卡片
window.onSuiteCountChange = onSuiteCountChange;   // 切換「套房數量」下拉選單並依序指派套浴
window.updateSpecTitle = updateSpecTitle;         // 即時組合格局規格字串並更新網頁標題（供 PDF 預設存檔檔名）

// 報表匯出與重設
window.copyReport = exportReportPDF;              // 匯出報表別名（向下相容用）
window.exportReportPDF = exportReportPDF;         // 整合評估數據、家配圖與結論，調用瀏覽器輸出 A4 PDF
window.resetToDefault = resetToDefault;           // 一鍵清空輸入與圖面，重設回預設 2 房狀態

// 頁面初始化
window.renderSpaces = renderSpaces;               // 動態生成各空間評估卡片與下拉選單的 DOM 結構
window.onload = renderSpaces;                     // 網頁加載完成時自動執行首次渲染
