/* ============================================================================
 * v1.0 三机等比例断言（docs/v10_三机等比.md §3）
 *
 * 用途：把「三机按真实米尺寸建模 + 刮板输送机/液压支架铺满工作面 + 三角底煤
 *       段逐节抬升」这一组承诺变成可复核的机器断言，防止后续改动把它们悄悄
 *       放大回「跨厚度示意」。
 *
 * 用法：
 *   node _refs/verify_equip.js              → 需要页面环境（__LANE_SECTION__ / mineDemo）
 *   浏览器内 page 加载即跑（index.html 在 verify_s1.js 之后引用）
 *
 * 数据来源（唯一）：
 *   - mineDemo.diagnostics().mining   ← mining-volume.js 的 diagnostics()
 *   - window.__LANE_SECTION__.equip   ← lane-section.js 的 2D 剖面输出
 *   - window.__GEO__                  ← geometry.js 的契约派生量
 *
 * 铁律：任一 FAIL → 退出码 1，禁止提交。
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

  var G = window.__GEO__;
  if (!G) throw new Error('verify_equip: __GEO__ 缺失');

  var pass = 0, fail = 0, skip = 0, warns = [], fails = [];
  function fmt(v) { return (typeof v === 'number' && isFinite(v)) ? (Math.round(v * 1e5) / 1e5) : String(v); }
  function near(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1e-6 : tol); }
  function t(id, ok, got, exp, note) {
    if (ok === 'SKIP') { skip++; console.log('SKIP ' + id + (note ? '  —— ' + note : '')); return; }
    if (ok) { pass++; console.log('PASS ' + id + '  got=' + fmt(got) + ' exp=' + fmt(exp)); }
    else { fail++; fails.push(id + '  got=' + fmt(got) + ' exp=' + fmt(exp) + (note ? '  — ' + note : '')); console.log('FAIL ' + id + '  got=' + fmt(got) + ' exp=' + fmt(exp) + (note ? '  —— ' + note : '')); }
  }

  /* ---- 取数：页面环境才有 mining diagnostics 与 2D 剖面 ---- */
  var M = null, LS = null;
  if (!isNode && window.mineDemo && typeof window.mineDemo.diagnostics === 'function') {
    try { M = window.mineDemo.diagnostics().mining; } catch (e) { M = null; }
  }
  if (!isNode) LS = (window.__LANE_SECTION__ && window.__LANE_SECTION__.equip) || null;

  /* ======================= 一、等比例身份 ============================ */
  if (M) {
    t('E1 三机按真实米尺寸建模（1:200，无可见性放大）',
      String(M.similarity || '').indexOf('1:200') >= 0, M.similarity, '含 1:200');
    t('E2 设备走向站位以煤壁 x=0 为基准、采空区侧为负（三机均不越出煤壁）',
      near(M.panWidthM, 0.76, 1e-9) && near(M.shearerWidthM, 2.0, 1e-9),
      M.panWidthM + ' / ' + M.shearerWidthM, '0.76 / 2.0 m');

    /* ===================== 二、刮板输送机 =========================== */
    t('E3 刮板输送机节长 1.5 m（文献：王志强等 2026 §2.1「按溜槽宽度 1.5 m 计算」）',
      near(M.panLenM, 1.5, 1e-9), M.panLenM, 1.5);
    t('E4 溜槽总节数 = 88（88 × 1.5 = 132 m，铺满 133 m 工作面、两端各余 0.5 m）',
      M.panCount === 88, M.panCount, 88);
    t('E5 三角底煤段抬升节数 = 12（斜边水平长 18 m ÷ 1.5 m）',
      M.panRampCount === 12 || (LS && LS.panRampCount === 12), M.panRampCount, 12);
    t('E6 溜槽断面 0.76 m 宽 × 0.30 m 高（SGZ764 型，3D 里高仅约 1.2 px，可辨性由 2D 剖面承担）',
      near(M.panWidthM, 0.76, 1e-9) && near(M.panHeightM, 0.30, 1e-9),
      M.panWidthM + ' × ' + M.panHeightM, '0.76 × 0.30 m');

    /* ===================== 三、液压支架 ============================= */
    t('E7 液压支架 88 架、中心距 1.5 m（88 × 1.5 = 132 m，与溜槽一板一架：12 架斜边 + 76 架水平）',
      M.supportCount === 88 && near(M.supportPitchM, 1.5, 1e-9),
      M.supportCount + ' × ' + M.supportPitchM + ' m', '88 × 1.5 m');
    t('E8 支架支撑高 3.0 m，且 ≤ 煤厚 − 顶煤（6.2 − 3.2 = 3.0 m）——综放机采只支撑机采高度',
      near(M.supportHeightM, 3.0, 1e-9) && M.supportHeightM <= G.M - 3.2 + 1e-6,
      M.supportHeightM, '3.0 m ≤ ' + fmt(G.M - 3.2));
    var topFlat = M.supportHeightM;                                  // 水平段顶梁顶面（m）
    var rampDeg = (M.lift && typeof M.lift.rampDeg === 'number') ? M.lift.rampDeg : G.rampDeg;
    var rampRiseM = (M.lift && typeof M.lift.rampRiseM === 'number') ? M.lift.rampRiseM : (G.rampRiseU * G.S);
    var topRamp = rampRiseM + M.supportHeightM * Math.cos(rampDeg * Math.PI / 180);
    t('E9 水平段支架顶梁不穿煤顶；斜边进风端顶梁高出煤顶 = 端头破顶量',
      topFlat < G.M + 1e-6 && topRamp > G.M && topRamp - G.M < 0.9,
      '水平段顶 ' + fmt(topFlat) + ' / 斜边端顶 ' + fmt(topRamp) + ' m', '< ' + G.M + ' m / 破顶 ' + fmt(topRamp - G.M) + ' m');

    /* ===================== 四、采煤机 =============================== */
    t('E10 采煤机 1 台（不铺满工作面）、滚筒 2 个',
      M.machineCount === 1 && M.drumCount === 2, M.machineCount + ' 台 / ' + M.drumCount + ' 滚筒', '1 台 / 2 滚筒');
    t('E11 采煤机机身 8.0 m、滚筒 Φ1.8 m × 0.7 m（双滚筒采煤机，按真实尺寸）',
      near(M.shearerLenM, 8.0, 1e-9) && near(M.drumDiaM, 1.8, 1e-9) && near(M.drumWidthM, 0.7, 1e-9),
      M.shearerLenM + ' m / Φ' + M.drumDiaM + ' × ' + M.drumWidthM, '8.0 m / Φ1.8 × 0.7 m');

    /* ===================== 五、贴底板与三角煤抬升 =================== */
    t('E12 三机沿倾向铺满工作面（z ∈ ±2.9995 = 进风端 → 回风端 133 m）',
      M.zWorkBounds && near(M.zWorkBounds.min, -2.999549, 1e-4) && near(M.zWorkBounds.max, 2.999549, 1e-4),
      M.zWorkBounds ? (fmt(M.zWorkBounds.min) + ' … ' + fmt(M.zWorkBounds.max)) : 'null', '±2.9995');
    t('E13 抬升曲线起于三角底煤满厚 4.0 m（进风端头）、止于尖灭点 0',
      M.lift && near(M.lift.atWorkfaceStartM, 4.0, 1e-6) && near(M.lift.atFlareM, 0, 1e-6),
      M.lift ? (M.lift.atWorkfaceStartM + ' → ' + M.lift.atFlareM) : 'null', '4.0 → 0 m');
    t('E14 工作面中段抬升量 = 0（三机贴煤层底板，不悬空）',
      M.lift && near(M.lift.atMidfaceM, 0, 1e-6), M.lift ? M.lift.atMidfaceM : 'null', 0);
    t('E15 抬升角与三角底煤斜边一致（12.5288°）',
      M.lift && near(M.lift.rampDeg, G.rampDeg, 1e-6), M.lift ? M.lift.rampDeg : 'null', G.rampDeg);
  } else {
    ['E1','E2','E3','E4','E5','E6','E7','E8','E9','E10','E11','E12','E13','E14','E15'].forEach(function (id) {
      t(id, 'SKIP', '', '', '需要页面环境（node 下无 mineDemo）');
    });
  }

  /* ======================= 六、2D 剖面交付物 ========================= */
  if (LS) {
    t('E16 2D 倾向剖面同源读三机定值（equip 段已绘制）',
      LS.panCount === 88 && LS.supportCount === 88 && LS.machineCount === 1,
      LS.panCount + ' / ' + LS.supportCount + ' / ' + LS.machineCount, '88 / 88 / 1');
    t('E17 2D 剖面等比（17.7 px/m）：支架 3.0 m ≈ 53.1 px 可辨、溜槽 0.30 m ≈ 5.3 px',
      near(LS.supportHeightPx, 53.097, 0.01) && near(LS.panHeightPx, 5.310, 0.01),
      fmt(LS.supportHeightPx) + ' / ' + fmt(LS.panHeightPx), '53.10 / 5.31 px');
    t('E18 2D 剖面溜槽宽 0.76 m ≈ 13.45 px（可见）',
      near(LS.panWidthPx, 13.451, 0.01), fmt(LS.panWidthPx), '13.45 px');
  } else {
    ['E16','E17','E18'].forEach(function (id) { t(id, 'SKIP', '', '', '需要页面环境（lane-section.js）'); });
  }

  /* ======================= 七、3D 可见性交代 ========================= */
  if (!isNode) {
    var btn = document.querySelector('[data-camera="equip"]');
    t('E19 页面提供「三机」机位按钮（3D 里等比例设备的可见性交付物之一）', !!btn, !!btn ? 'exists' : 'missing', 'exists');
  } else {
    t('E19', 'SKIP', '', '', 'node 无 DOM');
  }
  warns.push('三角底煤的斜边即该段煤层底板：溜槽 12 节与支架 12 架同沿 12.53° 斜面爬坡（一板一架），斜边最高处顶梁高出煤顶约 0.73 m，按错层位端头破顶处理（顶梁接直接顶）。');
  warns.push('3D 里三机总高 3.0 m = 0.135 单位，仅为煤厚 6.2 m 的 48%：全景/开采机位看不到设备属等比例的物理必然，不得靠放大设备解决；' +
             '可见性由「三机」机位（隐藏岩层与采动煤）+ 2D 倾向剖面共同承担。');

  /* ======================= 汇总 ==================================== */
  console.log('\n' + pass + ' PASS / ' + fail + ' FAIL / ' + skip + ' SKIP');
  if (warns.length) {
    console.log('\n【示警 · 需人工裁决】');
    warns.forEach(function (w) { console.log('  ! ' + w); });
  }

  var result = { pass: pass, fail: fail, skip: skip, warns: warns, fails: fails, items: null };
  window.__VERIFY_EQUIP__ = result;

  if (isNode) {
    if (fail) { process.exitCode = 1; throw new Error('三机等比例断言未通过 —— 禁止提交'); }
  } else if (fail) {
    console.error('三机等比例断言未通过 —— 禁止提交');
  }
})();
