/* ============================================================================
 * v0.6 S1 门禁：错层位双巷实测断言（浏览器侧）
 *
 * 与 verify_geometry.js 分工：
 *   verify_geometry.js 验「契约数值自洽」（GEO 里的定义）；
 *   本文件验「场景里真正建出来了」—— 读 __TWINS__ 的实测 BoxGeometry
 *   参数与 position，而不是读 GEO 的期望值。
 *
 * 三条用户指出的错误（m00851/m00882）各有一条断言守着：
 *   E1 巷道不得是实体黑盒     → G9 全部 BackSide + 无实体盒
 *   E2 两巷不得都居中 z=0     → G7 |cz| > 1 单位
 *   E3 4.0 m 是层位差不是位置差 → G3/G5/G6 贴顶贴底层位
 *
 * 铁律：任一 FAIL → 页面 console.error，探针 errs 非空，禁止提交。
 * ==========================================================================*/
(function () {
  'use strict';
  var W = window;
  W.__S1A__ = 1;

  function bail(reason) {
    W.__VERIFY_S1__ = { version: 'v0.6.0-S1', pass: 0, fail: 1, items: [], warns: [], error: reason };
    console.error('verify_s1: ' + reason);
  }
  if (!W.__GEO__) return bail('__GEO__ 未加载');
  if (!W.THREE) return bail('THREE 未加载');
  var G = W.__GEO__, T = W.THREE;
  if (!W.__TWINS__) return bail('__TWINS__ 未生成：scene.js 的 S1 双巷段未执行或抛错');

  var TW = W.__TWINS__, E = TW.expect;
  var items = [], warns = [], pass = 0, fail = 0;
  function near(a, b, e) { return Math.abs(a - b) < (e || 1e-6); }
  function t(name, ok, got, want, tol) {
    items.push({ name: name, ok: !!ok, got: got, want: want, tol: tol });
    if (ok) pass++; else { fail++; console.error('FAIL ' + name + '  got=' + got + ' want=' + want); }
  }

  /* ---------- 实测探针：读真实几何，不读期望值 ------------------------- */
  function probe(m) {
    if (!m || !m.geometry || !m.geometry.parameters) return null;
    var p = m.geometry.parameters, pos = m.position;
    return {
      cx: pos.x, cy: pos.y, cz: pos.z,
      w: p.width, h: p.height, d: p.depth,
      yBot: pos.y - p.height / 2, yTop: pos.y + p.height / 2,
      zBot: pos.z - p.depth / 2, zTop: pos.z + p.depth / 2,
      backside: !!(m.material && m.material.side === T.BackSide)
    };
  }
  var ci = E.cavIn || 0;                       // 内壁盒内缩量，还原真实断面
  var inP = probe(TW.laneIn), retP = probe(TW.laneRet), cutP = probe(TW.cutEye);

  /* ---------- G3 断面：真实 4.5 m × 2.2 m，不放大 ---------------------- */
  t('G3a 进风巷断面 = 2.2 × 4.5 m',
    inP && near(inP.h + 2 * ci, G.LANE_H, 1e-9) && near(inP.d + 2 * ci, G.LANE_W, 1e-9),
    inP ? ((inP.h + 2 * ci) * G.S).toFixed(3) + ' × ' + ((inP.d + 2 * ci) * G.S).toFixed(3) + ' m' : 'null',
    '2.2 × 4.5 m');
  t('G3b 回风巷断面 = 2.2 × 4.5 m',
    retP && near(retP.h + 2 * ci, G.LANE_H, 1e-9) && near(retP.d + 2 * ci, G.LANE_W, 1e-9),
    retP ? ((retP.h + 2 * ci) * G.S).toFixed(3) + ' × ' + ((retP.d + 2 * ci) * G.S).toFixed(3) + ' m' : 'null',
    '2.2 × 4.5 m');
  t('G3c 两巷等高同宽', inP && retP && near(inP.h, retP.h, 1e-9) && near(inP.d, retP.d, 1e-9),
    inP && retP ? inP.h.toFixed(6) + ' / ' + retP.h.toFixed(6) : 'null', '相等');

  /* ---------- G4 两巷分居倾向两端头（E2/E3 的核心）--------------------- */
  t('G4a 进风巷在 −z 端头', inP && inP.zTop <= 1e-9, inP ? inP.zTop.toFixed(5) : 'null', '≤ 0');
  t('G4b 回风巷在 +z 端头', retP && retP.zBot >= -1e-9, retP ? retP.zBot.toFixed(5) : 'null', '≥ 0');
  // 两巷中心的世界高差 = 端头高差 + 层位差 − 巷宽带来的倾角修正（LANE_W·SLOPE）。
  // GEO.laneCenterGapM 是「端头到端头」的跨度，不含该项，故在此显式扣除。
  var expGapM = E.laneCenterGapM - G.LANE_W * G.SLOPE * G.S;
  var gotGapM = inP && retP
    ? (G.yBase(retP.cz) + retP.cy - (G.yBase(inP.cz) + inP.cy)) * G.S : NaN;
  t('G4c 两巷中心世界高差 = 端头跨度 − 巷宽倾角修正',
    Math.abs(gotGapM - expGapM) < 1e-3,
    gotGapM.toFixed(3) + ' m', expGapM.toFixed(3) + ' m');

  /* ---------- G5/G6 层位：进风贴顶、回风贴底（E3：4.0 m 是层位差）----- */
  t('G5 进风巷上缘贴煤顶', inP && near(inP.yTop + ci, E.coalTop, 1e-9),
    inP ? ((inP.yTop + ci) * G.S).toFixed(4) : 'null', (E.coalTop * G.S).toFixed(4));
  t('G6 回风巷下缘贴煤底', retP && near(retP.yBot - ci, 0, 1e-9),
    retP ? ((retP.yBot - ci) * G.S).toFixed(4) : 'null', '0');
  t('G6b 同端头层位差 = 4.0 m', near((E.coalTop - G.LANE_H) * G.S, 4.0, 1e-9),
    ((E.coalTop - G.LANE_H) * G.S).toFixed(4), 4.0);

  /* ---------- G7 两巷都居中 z = 0 是旧错误，本版必须不居中 ------------ */
  t('G7 两巷均不在模型厚度中央', inP && retP && Math.abs(inP.cz) > 1 && Math.abs(retP.cz) > 1,
    inP && retP ? Math.abs(inP.cz).toFixed(3) + ' / ' + Math.abs(retP.cz).toFixed(3) + ' 单位' : 'null',
    '> 1 单位');

  /* ---------- G8 三角底煤（v0.9 倾向 22.5 m / 底煤 0→4.0 m / 12.53°）--- */
  t('G8a 三角煤倾向水平长 22.5 m', near(G.rampLenU * G.S, G.rampLenM, 1e-9), (G.rampLenU * G.S).toFixed(2) + ' m', G.rampLenM.toFixed(1) + ' m');
  t('G8b 三角煤贴进风端头，尖灭点 = 外帮 + 22.5 m', near(G.rampZ0, G.zLaneIn0, 1e-9) && near(G.rampZ1, G.zLaneIn0 + G.rampLenU, 1e-9), G.rampZ0.toFixed(5) + ' / ' + G.rampZ1.toFixed(5), G.zLaneIn0.toFixed(5) + ' / ' + (G.zLaneIn0 + G.rampLenU).toFixed(5));
  t('G8c 三角煤最大厚 4.0 m', Math.abs(G.rampRiseU * G.S - 4.0) < 1e-6, (G.rampRiseU * G.S).toFixed(4), '4.0000');
  t('G8d 三角煤斜边坡度 12.53°', Math.abs(G.rampDeg - 12.5288) < 2e-3, G.rampDeg.toFixed(4), 12.5288);
  t('G8e 三角煤块数 = 96 × (1 + 18)', E.coalRampBlocks === 96 * 19, E.coalRampBlocks, 96 * 19);

  /* ---------- G9 负空间：巷道不是实体黑盒（E1）------------------------ */
  var meshes = [];
  TW.group.traverse(function (o) { if (o.isMesh) meshes.push(o); });
  var solids = meshes.filter(function (m) { return !(m.material && m.material.side === T.BackSide); });
  t('G9 巷道空腔全部为背面材质（非实体盒）', solids.length === 0,
    meshes.length + ' 个空腔 / ' + solids.length + ' 个实体盒', '0 个实体盒');

  /* ---------- G10 切眼：宽 4.5 m、沿倾向贯通全幅 ---------------------- */
  t('G10a 切眼宽 = 4.5 m', cutP && near(cutP.w + 2 * ci, G.LANE_W, 1e-9),
    cutP ? ((cutP.w + 2 * ci) * G.S).toFixed(3) : 'null', 4.5);
  t('G10b 切眼沿倾向贯通全幅', cutP && near(cutP.d + 2 * ci, 2 * G.zHalf, 1e-9),
    cutP ? ((cutP.d + 2 * ci) * G.S).toFixed(2) + ' m' : 'null', (2 * G.zHalf * G.S).toFixed(2) + ' m');
  t('G10c 切眼位于 xFace', cutP && near(cutP.cx - (cutP.w + 2 * ci) / 2, G.xFace, 1e-9),
    cutP ? (cutP.cx - cutP.w / 2).toFixed(5) : 'null', G.xFace);

  /* ---------- X6 未采动区保留完整煤层 -------------------------------- */
  t('X6 未采动区有完整煤层块', (E.coalBlocks || 0) > 0, E.coalBlocks, '> 0');

  /* ---------- X7 剖面一致性（#lane-inset）---------------------------- */
  var LS = W.__LANE_SECTION__;
  if (!LS || !LS.drawn) {
    t('X7 倾向剖面已绘制', false, LS ? 'drawn=false' : 'null', 'drawn=true');
  } else {
    t('X7 剖面等比', Math.abs(LS.anisotropy - 1) < 1e-9, LS.anisotropy, 1);
    t('X7b 剖面断面真实', near(LS.laneWM, 4.5, 1e-9) && near(LS.laneHM, 2.2, 1e-9),
      LS.laneWM + ' × ' + LS.laneHM, '4.5 × 2.2');
    t('X7c 剖面为断裂视图（两巷分居两端）', LS.brokenView === true && LS.omittedM > 100,
      LS.omittedM.toFixed(1) + ' m 省略', '> 100 m');
    t('X7d 剖面无各向异性放大', LS.anisotropy === 1, LS.anisotropy, 1);
  }

  /* ---------- X8/X9 v0.6-S1c：底板贴合 + lanes 剖切机位 ------------- */
  var D = W.__S1DIAG__;
  if (!D) {
    t('X8 场景诊断对象存在', false, 'null', '__S1DIAG__');
  } else {
    t('X8 底板顶面贴煤底（无空层）', Math.abs(D.floorB) < 1e-9, D.floorB, 0);
    t('X8b 底板厚度 0.55 单位', Math.abs(D.floorB - D.floorA - 0.55) < 1e-6, (D.floorB - D.floorA).toFixed(4), 0.55);
    t('X9 lanes 剖切机位存在', D.hasLanes === true, D.hasLanes ? 'yes' : 'no', true);
    t('X9b 局部裁剪已启用', D.clipEnabled === true, D.clipEnabled, true);
    t('X9c 剖切面落在回风巷外侧（zLaneRet0 − 0.10，v0.8 口径）', Math.abs(D.clipZ - (G.zLaneRet0 - .10)) < 1e-9, D.clipZ, (G.zLaneRet0 - .10).toFixed(4));
  }

  /* ---------- 可见性登记 --------------------------------------------- */
  warns.push('巷道在 3D 中以负空间表达（煤体缺口 + 背面内壁），' +
    '全景视角下断面约 ' + (G.LANE_W * G.S).toFixed(1) + '×' + (G.LANE_H * G.S).toFixed(1) +
    ' m，可见性由 #lane-inset 倾向剖面承担，不依赖 3D 放大。');

  W.__VERIFY_S1__ = {
    version: 'v0.6.0-S1', pass: pass, fail: fail,
    items: items, warns: warns, error: null
  };
  if (fail) console.error('S1 门禁未通过：' + fail + ' 项 FAIL');
  else console.log('S1 门禁：' + pass + ' PASS / 0 FAIL');
})();
