/* v11 数据/文档断言（独立于 v01 的 verify_all.js 56 项基线）
 * 用法：node _refs/verify_v11_data.js   （FAIL 即退出码 1）
 * 覆盖：批 1（P0-01/P1-01..08/P2-01..10）+ 批 2（P2-05/P2-11 及文档同步）全部落点。
 */
(function () {
  'use strict';
  var fs = require('fs');
  var path = require('path');
  global.window = global;
  require(path.join(__dirname, '..', 'data', 'geology.js'));
  require(path.join(__dirname, '..', 'geometry.js'));
  var D = window.MINE_DATA, G = window.__GEO__, L = D.literature;
  var pass = 0, fail = 0;
  function t(id, ok, detail) {
    if (ok) { pass++; console.log('PASS ' + id); }
    else { fail++; console.log('FAIL ' + id + '  [' + String(detail).slice(0, 160) + ']'); }
  }
  function near(a, b, e) { return Math.abs(a - b) < (e || 1e-6); }
  function readV(rel) { return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'); }

  /* ---- 版本与基准 ---- */
  t('V1  version=v0.11.0', (L.version || D.version) === 'v0.11.0', L.version || D.version);
  t('V2  字段改名 dipLengthM=142', L.workingFace.dipLengthM === 142 && L.workingFace.strikeLengthM === undefined, JSON.stringify(L.workingFace));
  t('V3  字段改名 strikeAdvanceM=2160', L.workingFace.strikeAdvanceM === 2160 && L.workingFace.advanceLengthM === undefined);
  t('V4  采高 6.2', L.seam.thickness === 6.2);
  t('V5  相似比 CS=CG*CL=300', L.scale.CS === 300 && near(L.scale.CS, L.scale.CG * L.scale.CL));
  t('V6  标尺 S=22.17', near(L.scale.S, 22.17));
  t('V7  几何层 S 同源', near(G.S, L.scale.S));

  /* ---- 批 1：核心数值 ---- */
  t('V8  垮落带 kp=1.448', L.zones.caving.formula.indexOf('1.448') >= 0, L.zones.caving.formula);
  t('V9  垮落带 13.83', near(L.zones.caving.height, 13.83, 0.001), L.zones.caving.height);
  t('V10 复算 6.2/(1.448-1)=13.83', near(6.2 / (1.448 - 1), 13.83, 0.01), 6.2 / (1.448 - 1));
  var bd = L.keyStrata.discrimination.breakingDist;
  t('V11 破断距组合梁 S1=249.45', near(bd.S1, 249.45, 0.01), bd.S1);
  t('V12 破断距组合梁 S4=221.22', near(bd.S4, 221.22, 0.01), bd.S4);
  t('V13 破断距组合梁 S5=180.64', near(bd.S5, 180.64, 0.01), bd.S5);
  t('V14 破断距组合梁 S6=168.22', near(bd.S6, 168.22, 0.01), bd.S6);
  t('V15 破断距 S6_adopted=117.27(受控)', near(bd.S6_adopted, 117.27, 0.01), bd.S6_adopted);
  t('V16 破断距 S7=117.27', near(bd.S7, 117.27, 0.01), bd.S7);
  t('V17 砾岩 508.9 标注设定', near(bd.GL, 508.9, 0.01) && /设定/.test(JSON.stringify(L.keyStrata)), bd.GL);
  t('V18 主关键层 88 m / 14.2 倍', L.keyStrata.main.distToSeam === 88 && near(L.keyStrata.main.distToSeam / 6.2, L.keyStrata.main.ratio, 1e-9));
  t('V19 临界高度 43.4~62 + adopted=10', near(L.criticalHeight.low, 43.4, 0.01) && near(L.criticalHeight.high, 62, 0.01) && L.criticalHeight.adopted === 10);
  t('V20 组合梁重算 q=1904.1 入 role', String(L.keyStrata.main.role).indexOf('1904.1') >= 0, L.keyStrata.main.role);
  t('V21 discrimination 用组合梁法', String(L.keyStrata.discrimination.method).indexOf('组合梁') >= 0, L.keyStrata.discrimination.method);

  /* ---- 批 1：注浆层位（P0） ---- */
  t('V22 注浆层位改"候选"', String(L.grout.target.verdict).indexOf('候选') >= 0, L.grout.target.verdict);
  var rs = L.grout.target.reason.join('|');
  t('V23 防渗缺口 119 m/31 m 入 reason', rs.indexOf('119 m') >= 0 && rs.indexOf('31 m') >= 0, rs.slice(0, 120));
  t('V24 措辞不含"恰好达标"', rs.indexOf('恰好达标') < 0, rs.slice(0, 200));

  /* ---- 批 1：裂采比/归属/钻孔/砾岩 ---- */
  t('V25 删 9.35~18.87 改库内实测', L.zones.fractured.crossCheck.indexOf('9.35') < 0 && /4\.65|6\.91/.test(L.zones.fractured.crossCheck), L.zones.fractured.crossCheck);
  t('V26 2270 归属 1407+1408', !!(L.settlement.measured['1407+1408'] && L.settlement.measured['1407+1408'].maxSubsidenceMM === 2270) && L.settlement.measured['1408'] === undefined, JSON.stringify(Object.keys(L.settlement.measured)));
  t('V27 钻孔移动角 55°', L.boreholes.moveAngleDeg === 55);
  t('V28 550 m 引许家林 1998', String(L.cover.mainKeyStrata.src).indexOf('许家林(1998)') >= 0, L.cover.mainKeyStrata.src);
  t('V29 监测目标层 50 m 入数据层', L.zones.bending.monitorTargetM === 50);
  t('V30 弯曲带引《再论三带》', String(L.zones.bending.src).indexOf('再论') >= 0, L.zones.bending.src);
  t('V31 xu1998 页码 277-279', (D.citations || []).some(function (c) { return c.id === 'xu1998' && c.text.indexOf('277-279') >= 0; }));
  t('V32 warn 含剪切保形声明', D.warn.join('|').indexOf('剪切变换') >= 0);
  t('V33 warn 含表土未建模声明', D.warn.join('|').indexOf('表土') >= 0);
  var fArr = Array.isArray(D.formulas) ? D.formulas : [];
  var fB = fArr.filter(function (x) { return x.id === 'breaking'; })[0] || (D.formulas && D.formulas.breaking) || {};
  var fR = fArr.filter(function (x) { return x.id === 'ramp'; })[0] || (D.formulas && D.formulas.ramp) || {};
  t('V34 formulas.breaking 组合梁值', String(fB.value).indexOf('168.22') >= 0 && String(fB.value).indexOf('组合梁') >= 0, fB.value);
  t('V35 formulas.ramp 走向全长声明', String(fR.value).indexOf('走向全长') >= 0);

  /* ---- 代码层落点 ---- */
  var geoJs = readV('geometry.js');
  t('V36 geometry.js 用 dipLengthM', geoJs.indexOf('dipLengthM') >= 0 && geoJs.indexOf('strikeLengthM') < 0);
  t('V37 geometry.js 赵景礼笔误已修', geoJs.indexOf('赵景礼') >= 0 && geoJs.indexOf('赵景立') < 0);
  var scJs = readV('scene.js');
  t('V38 scene.js 50 m 改读数据层', scJs.indexOf('monitorTargetM') >= 0);
  var vg = readV('_refs/verify_geometry.js');
  t('V39 G11 示警已裁决', vg.indexOf("warns.push('G11") < 0);

  /* ---- 文档层同步 ---- */
  var mat = readV('docs/材料对标表.md');
  t('V40 材料对标表 相似比设定', mat.indexOf('| 相似比 | 1:200 | **设定**') >= 0);
  t('V41 材料对标表 119 m 缺口', mat.indexOf('须 ≥119 m') >= 0);
  t('V42 材料对标表 1407+1408', mat.indexOf('1407+1408') >= 0);
  t('V43 材料对标表 组合梁口径', mat.indexOf('许家林 2000 式(1) 组合梁') >= 0);
  var ct = readV('docs/geometry_contract.md');
  t('V44 契约 字段名同步', ct.indexOf('workingFace.dipLengthM') >= 0 && ct.indexOf('workingFace.strikeAdvanceM') >= 0);

  console.log('\n' + pass + ' PASS / ' + fail + ' FAIL');
  if (fail > 0) process.exit(1);
})();
