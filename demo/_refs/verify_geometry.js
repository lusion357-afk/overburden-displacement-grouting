/* ============================================================================
 * v0.6 几何契约断言（PROMPT_v0.6 §5）
 *
 * 用法：
 *   node _refs/verify_geometry.js          → 可验项全部跑；未实现项标 SKIP
 *   浏览器内也会自动执行（页面加载即验）
 *
 * v0.6.0-S1 变更（基准 32°/125 m → 30°/142 m 单面）：
 *   G4  由「两巷上下错开 4.0 m」改为「两巷分居倾向两端头」；
 *   G5/G6 改为各端头的贴顶/贴底；
 *   G8  由「中心线端点」改为「10 节 / 15 m / 14.93° 残留煤楔」（v0.6-S1d 修正穿顶矛盾）；
 *   X4 zHalf 期望 142/2/S；X5 投影 30°；新增 X6 未采动区、X7 台架高。
 *
 * 铁律：任一 FAIL → 退出码 1，禁止提交。
 *       SKIP 不算通过，只说明该项所属阶段尚未实现（见 §6 门禁）。
 * ==========================================================================*/
(function () {
  'use strict';

  var isNode = (typeof module !== 'undefined' && module.exports);

  if (isNode) {
    var path = require('path');
    global.window = global;
    require(path.join(__dirname, '..', 'data', 'geology.js'));
    require(path.join(__dirname, '..', 'geometry.js'));
  }

  var D = window.MINE_DATA, G = window.__GEO__;
  if (!D || !G) throw new Error('verify_geometry: MINE_DATA 或 __GEO__ 缺失');

  var pass = 0, fail = 0, skip = 0, warns = [];
  function t(id, ok, got, exp, note) {
    if (ok === 'SKIP') { skip++; console.log('SKIP ' + id + (note ? '  —— ' + note : '')); return; }
    if (ok) { pass++; console.log('PASS ' + id + '  got=' + fmt(got) + ' exp=' + fmt(exp)); }
    else { fail++; console.log('FAIL ' + id + '  got=' + fmt(got) + ' exp=' + fmt(exp) + (note ? '  [' + note + ']' : '')); }
  }
  function fmt(v) { return (typeof v === 'number') ? (Math.abs(v) < 1e-4 ? v.toExponential(6) : v.toFixed(8)) : String(v); }
  function near(a, b, e) { return Math.abs(a - b) < (e || 1e-6); }

  var L = D.literature;

  /* ======================= S0 门禁：G1 G2 G11 ======================= */

  // G1 换算唯一 —— 用「往返一致」而非重算一次（重算会自证循环）
  t('G1a 采高正推', near(G.coalTop * G.S, L.seam.thickness, 1e-9), G.coalTop * G.S, L.seam.thickness);
  var rt = true;
  [-G.zHalf, 0, G.zHalf].forEach(function (z) {
    var back = G.yToData(G.yFromData(0, z), z);
    if (!near(back, 0, 1e-9)) rt = false;
  });
  t('G1b 数据↔渲染往返', rt, rt ? 0 : NaN, 0);
  t('G1c 覆岩正推', near(G.surfY0 - G.coalTop, L.cover.depthM / G.S, 1e-9), G.surfY0 - G.coalTop, L.cover.depthM / G.S);

  // G2 采高：0.27966 × 22.17 == 6.2 ± 0.124
  var g2err = Math.abs(G.coalTop * G.S - L.seam.thickness);
  t('G2 采高容差', g2err <= 0.02 * L.seam.thickness, G.coalTop * G.S, L.seam.thickness);
  t('G2b 采高绝对值', near(G.coalTop, 0.27965719, 1e-6), G.coalTop, 0.27965719);

  // G2c 倾角取 wang2024 的 30°
  t('G2c 倾角 = 30°', near(G.DIP_DEG, 30, 1e-9), G.DIP_DEG, 30);

  // G11 注浆层位线
  var g11got = G.keyBottomY - G.yBase(0);
  var g11exp = (L.grout.target.distToSeam + L.seam.thickness) / G.S;
  t('G11 注浆层位', near(g11got, g11exp, 1e-6), g11got, g11exp);

  /* v11 裁决：4.2454 确为旧算（S≈22.19/M≈6.12 年代）；G11 一律按 (88+6.2)/22.17=4.24898512 取值， */
  /* 契约指令中的 4.2454 作废，不再示警（audit_v10_20261026 P2-11）。 */

  /* ======================= S1 门禁：巷道几何 ======================= */

  t('G3 巷高真实', Math.abs(G.LANE_H * G.S - 2.2) <= 0.05, G.LANE_H * G.S, 2.2);
  t('G3w 巷宽真实（不放大）', Math.abs(G.LANE_W * G.S - 4.5) <= 0.05, G.LANE_W * G.S, 4.5);

  // G4 两巷分居倾向两端头：中心高差 = 倾角落差 − 采高 + 巷高（几何必然，无独立参数）
  var g4got = G.laneCenterGapU;
  var g4exp = G.rise - G.coalTop + G.LANE_H;
  t('G4a 两巷中心高差', near(g4got, g4exp, 1e-6), g4got * G.S, g4exp * G.S);
  t('G4b 两巷分居两端头',
    G.zLaneIn1 < 0 && G.zLaneRet0 > 0 &&
    near(G.zLaneRet0 - G.zLaneIn1, 2 * G.zHalf - 2 * G.LANE_W, 1e-9),
    (G.zLaneIn1.toFixed(6) + ' / ' + G.zLaneRet0.toFixed(6)), '两端之间留 ' + ((G.zLaneRet0 - G.zLaneIn1) * G.S).toFixed(2) + ' m');

  t('G5 进风巷贴煤顶', near(G.laneInTopY, G.yBase(-G.zHalf) + G.coalTop, 1e-9), G.laneInTopY, G.yBase(-G.zHalf) + G.coalTop);
  t('G6 回风巷贴煤底', near(G.laneRetBotY, G.yBase(G.zHalf), 1e-9), G.laneRetBotY, G.yBase(G.zHalf));

  var dip = Math.atan2(G.yBase(1) - G.yBase(-1), 2) * 180 / Math.PI;
  t('G7 倾角反算', Math.abs(dip - 30) <= 0.5, dip, 30);

  // G8 三角底煤（v0.9 倾向 22.5 m）：贴 -z 进风端头、沿倾向自外帮向内 22.5 m 尖灭，
  //    最大厚 4.0 m（= 煤厚 − 巷高），坡度 atan(4.0/18) = 12.53°
  t('G8a 三角煤倾向水平长', near(G.rampLenU * G.S, G.rampLenM, 1e-9), (G.rampLenU * G.S).toFixed(2) + ' m', G.rampLenM.toFixed(1) + ' m');
  t('G8b 三角煤最大厚 = 煤厚 − 巷高', near(G.rampRiseU, G.coalTop - G.LANE_H, 1e-9), (G.rampRiseU * G.S).toFixed(4), '4.0000');
  t('G8c 三角煤斜边坡度 12.53°', Math.abs(G.rampDeg - 12.5288) < 2e-3, G.rampDeg.toFixed(4), 12.5288);
  t('G8d 三角煤贴进风端头且尖灭点 = 外帮 + 22.5 m', near(G.rampZ0, G.zLaneIn0, 1e-9) && near(G.rampZ1, G.zLaneIn0 + G.rampLenU, 1e-9), G.rampZ0.toFixed(5) + ' → ' + G.rampZ1.toFixed(5), G.zLaneIn0.toFixed(5) + ' → ' + (G.zLaneIn0 + G.rampLenU).toFixed(5));

  // G12 两端头绝对高差（rise − coalTop，m00957 定案 75.78 m）
  t('G12 两端头绝对高差', Math.abs(G.endDropM - 75.7837) < 0.01, G.endDropM, 75.7837);

  /* ======================= 待实现（所属阶段门禁）===================== */

  t('G3b 视觉放大标注', 'SKIP', null, null, 'S1 起巷道按真实断面建模，不再放大，本条转为"无放大"监督，S4 随 DOM 验');
  t('G9 采出体守恒', 'SKIP', null, null, '需几何体，S2 验');
  t('G10 标签-数据一致', 'SKIP', null, null, '需 DOM，S4 验');

  /* ======================= 契约自检 X 系列 ========================= */
  /* 防回归：这些项专抓 v0.5 的基准级错误回来 */

  var mm = G.mmPerM, spread = Math.max(mm.x, mm.y, mm.z) / Math.min(mm.x, mm.y, mm.z) - 1;
  t('X1 箱体三向标尺一致', spread < 0.001, (spread * 100).toFixed(4) + '%', '<0.1%');

  var need = G.surfY0 + G.rise;
  t('X2 箱高容得下剪切包围盒', G.boxUnits.y >= need - 1e-9, G.boxUnits.y, need);
  var slack = (G.boxUnits.y - need) * G.S;
  if (slack < 0.5 || slack > 3) warns.push('箱高余量 ' + slack.toFixed(2) + ' m 偏离预期区间 [0.5, 3] m，请复核箱体');
  else console.log('  · 箱高余量 ' + slack.toFixed(2) + ' m（实测）');

  t('X3 地表未被削平', G.surfYHigh - G.surfY0At > 1, G.surfYHigh - G.surfY0At, '≈' + G.rise.toFixed(4));
  t('X4 zHalf 为单面 142 m', near(G.zHalf, 142 / (2 * G.S), 1e-9) && Math.abs(G.zHalf - 6.405) > 1, G.zHalf, 142 / (2 * G.S));

  var mv = G.M / Math.cos(G.DIP_DEG * Math.PI / 180);
  t('X5 采高垂直投影（30°）', Math.abs(mv - 7.1591) < 0.01, mv, 7.1591);

  t('X6 未采动区长度', Math.abs(G.notMinedLenU * G.S - 22.15) < 0.05, G.notMinedLenU * G.S, 22.15);
  t('X7 台架原型高', Math.abs(G.prototypeH - L.scale.boxPrototypeM.y) < 0.01, G.prototypeH, L.scale.boxPrototypeM.y);

  /* ======================= 汇总 ==================================== */
  console.log('\n' + pass + ' PASS / ' + fail + ' FAIL / ' + skip + ' SKIP');
  if (warns.length) {
    console.log('\n【示警 · 需人工裁决】');
    warns.forEach(function (w) { console.log('  ! ' + w); });
  }

  var result = { pass: pass, fail: fail, skip: skip, warns: warns };
  window.__VERIFY__ = result;

  if (isNode) {
    if (fail) { process.exitCode = 1; throw new Error('几何契约未通过 —— 禁止提交'); }
  } else if (fail) {
    console.error('几何契约未通过 —— 禁止提交');
  }
})();
