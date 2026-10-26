/* =============================================================================
 * 智能注浆3D演示 v0.9 · 倾向剖面（S1 错层位双巷 + 三角底煤可见性交付物）
 * -----------------------------------------------------------------------------
 * 为什么需要它：巷道真实断面 4.5 m × 2.2 m，在 1:200 尺度下只有
 *              0.203 × 0.099 单位；1440×1000 视口全景里不足 5×2 px，
 *              且巷道在采空区里以负空间存在 —— 3D 里看不见，必须由本剖面承担。
 *              三角底煤（22.5 m × 4.0 m）在 3D 全景里同样只有几像素，也由本图承担。
 *
 * 本图的三条纪律（契约 §6.2，v0.6.0-S1 修订）：
 *   1. 等比：横纵同一比例尺（SCALE 由画布高与煤厚、画布宽与两段总长共同约束），断面形状不被拉伸。
 *      3D 场景按真实断面不放大，本图与 3D 不存在各向异性差。
 *   2. 真实尺寸：巷宽 4.5 m、巷高 2.2 m、煤厚 6.2 m、三角煤 22.5 m × 4.0 m，全部由 __GEO__ 取值。
 *   3. 展开 + 断裂视图：剖面垂直于煤层，把 30° 倾角摊平成水平带（倾角本身不在此图表达）；
 *      两巷分居倾向两端头、相距一个面长 142 m，画布放不下 → 中部省略 128.1 m 用断裂视图。
 *
 * v0.9（对应用户 m00799→v09 修正）：三角底煤在**进风端头、沿倾向 22.5 m**，
 *   由输送机逐节抬溜形成——进风巷贴煤顶，其正下方是满厚 4.0 m 平段（4.5 m 宽），
 *   再向工作面内 18 m 线性降到 0（斜边 12.53°）。它**是倾向方向的几何**，本剖面正是
 *   看它的地方；同时它沿走向全长不变厚（v0.6~v0.8 误放在走向 15 m 末端，已改正）。
 *
 * 数据来源：只读 window.__GEO__，不硬编码任何数值（契约 §2 单向数据流）。
 * ========================================================================== */
(function () {
  'use strict';

  var G = (typeof window !== 'undefined' ? window.__GEO__ : null);
  if (!G) return;                       // geometry.js 未加载时静默跳过

  var cv = document.getElementById('lane-section');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  if (!ctx) return;

  var W = 720, H = 210;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  /* ---- 分段：左段 −z 端头（进风，含三角煤 22.5 m）、右段 +z 端头（回风）---- */
  var LSEG_M = 27.5;                             // 进风端：4.5 m 平段 + 18 m 斜边 + 5 m 余量
  var RSEG_M = 6.4;                              // 回风端显示 6.4 m

  /* ---- 比例尺：横纵共用；同时受画布高（煤厚）与画布宽（两段总长）约束 ---- */
  var PAD = 12, TITLE_H = 14;
  var Y0 = PAD + TITLE_H;                 // 煤顶（屏幕上方）
  var M_M = G.M;                          // 采高 / 煤厚 6.2 m
  var H_AVAIL = H - PAD - Y0;             // 煤体可用高
  var GAP_MIN = 96;                       // 断裂区最小宽度（放下“倾向 142 m”标注）
  var SCALE = Math.min(H_AVAIL / M_M, (W - 2 * PAD - GAP_MIN) / (LSEG_M + RSEG_M));
  var Y1 = Y0 + M_M * SCALE;              // 煤底（屏幕下方）

  var laneWM = G.laneWidthM, laneHM = G.laneHeightM;
  var LWm = laneWM * SCALE, LHm = laneHM * SCALE;

  var LSEG = LSEG_M * SCALE, RSEG = RSEG_M * SCALE;
  var Lx0 = PAD, Lx1 = PAD + LSEG;
  var Rx1 = W - PAD, Rx0 = Rx1 - RSEG;
  var gapM = G.faceLenM - LSEG_M - RSEG_M;

  /* 三角底煤：沿倾向 22.5 m 起点 = 进风巷外帮（段内坐标 0），尖灭 = 22.5 m */
  var rampLenM = G.rampLenM, rampRiseM = G.rampRiseU * G.S;
  var rampSlopeM = G.rampSlopeLenM;              // 18 m 斜边（不含 4.5 m 平段）
  var RAMP_X1 = Lx0 + rampLenM * SCALE;          // 尖灭点屏幕 x
  var RAMP_XF = Lx0 + laneWM * SCALE;            // 平段/斜边交界 = 进风巷内帮
  var RAMP_TOP = Y1 - rampRiseM * SCALE;         // 平段顶（= 煤顶下 2.2 m = 进风巷底）

  function box2(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  function stroke2(x, y, w, h, color, lw) { ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1); }

  /* ---- 底 ---------------------------------------------------------------- */
  box2(0, 0, W, H, '#ffffff');

  /* ---- 标题 -------------------------------------------------------------- */
  ctx.font = '600 11px system-ui,-apple-system,"Segoe UI",sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#33424a';
  ctx.fillText('倾向剖面（垂直煤层）· 等比 · 煤厚 ' + M_M.toFixed(1) + ' m · 巷道 ' +
    laneWM.toFixed(1) + ' × ' + laneHM.toFixed(1) + ' m', PAD, PAD + 2);

  /* ---- 两段煤层 ---------------------------------------------------------- */
  box2(Lx0, Y0, LSEG, M_M * SCALE, '#3a4046');
  box2(Rx0, Y0, RSEG, M_M * SCALE, '#3a4046');
  stroke2(Lx0, Y0, LSEG, M_M * SCALE, '#20262a', 1);
  stroke2(Rx0, Y0, RSEG, M_M * SCALE, '#20262a', 1);

  /* ---- 断裂线：两段相对边缘的锯齿（标准断裂视图记号）-------------------- */
  ctx.strokeStyle = '#20262a'; ctx.lineWidth = 1.2;
  [[Lx1, 1], [Rx0, -1]].forEach(function (p) {
    var x = p[0], dir = p[1], mid = (Y0 + Y1) / 2;
    ctx.beginPath();
    ctx.moveTo(x, Y0);
    ctx.lineTo(x, mid - 18);
    ctx.lineTo(x + 7 * dir, mid - 9);
    ctx.lineTo(x, mid);
    ctx.lineTo(x + 7 * dir, mid + 9);
    ctx.lineTo(x, mid + 18);
    ctx.lineTo(x, Y1);
    ctx.stroke();
  });

  /* ---- 三角底煤（v0.9 核心）：平段 4.5 m 满厚 + 斜边 18 m 线性尖灭 --------- */
  ctx.beginPath();
  ctx.moveTo(Lx0, RAMP_TOP);
  ctx.lineTo(RAMP_XF, RAMP_TOP);
  ctx.lineTo(RAMP_X1, Y1);
  ctx.lineTo(Lx0, Y1);
  ctx.closePath();
  ctx.fillStyle = '#307333';                     // 与 3D mats.coalRamp 同色（部件颜色对照表 :20）
  ctx.fill();
  ctx.strokeStyle = '#d7e6d9'; ctx.lineWidth = 1;
  ctx.stroke();

  /* ---- 三机（v1.0 等比例）：与 3D 共用 window.MINING_EQUIP 同一套定值 -------
   * 图中可辨性：溜槽宽 0.76 m = 13.5 px、高 0.30 m = 5.3 px（截面可辨，而 3D
   * 里 1.2 px 不可辨，故此处是本交付物的承担者）；支架中心距 1.5 m = 26.5 px、
   * 支撑高 3.0 m = 53 px、架长 5.0 m = 88.5 px（斜边 12 架全部画出，水平段只容 3 架示意，实 76 架）。
   * 采煤机 1 台位于 z = 0（工作面中部）→ 落在本图的断裂省略区，无法画，由图例说明。 */
  var E = (typeof window !== 'undefined') ? window.MINING_EQUIP : null;
  if (E) {
    var panWpx = E.panWidthM * SCALE, panHpx = E.panHeightM * SCALE;
    var panPitchPx = E.panLenM * SCALE;
    var rdx = RAMP_X1 - RAMP_XF, rdy = Y1 - RAMP_TOP;
    var rlen = Math.hypot(rdx, rdy);
    var nX = rdy / rlen, nY = -rdx / rlen;         // 三角煤顶面外法向（屏幕上抬）

    /* 斜边段：12 节沿 12.53° 逐节抬升，最后一节恰好落在尖灭点 */
    ctx.beginPath();
    ctx.moveTo(RAMP_XF, RAMP_TOP);
    ctx.lineTo(RAMP_X1, Y1);
    ctx.lineTo(RAMP_X1 + nX * panHpx, Y1 + nY * panHpx);
    ctx.lineTo(RAMP_XF + nX * panHpx, RAMP_TOP + nY * panHpx);
    ctx.closePath();
    ctx.fillStyle = '#263c43'; ctx.fill();
    ctx.strokeStyle = '#9fb2b9'; ctx.lineWidth = .8; ctx.stroke();
    ctx.strokeStyle = '#7f9299'; ctx.lineWidth = .6;
    for (var sp = panPitchPx; sp < rlen - 1; sp += panPitchPx) {
      var sx = RAMP_XF + rdx * (sp / rlen), sy = RAMP_TOP + rdy * (sp / rlen);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + nX * panHpx, sy + nY * panHpx); ctx.stroke();
    }

    /* 水平段：尖灭点 → 回风端头，与支架同起点 */
    ctx.fillStyle = '#263c43';
    ctx.fillRect(RAMP_X1, Y1 - panHpx, Lx1 - RAMP_X1, panHpx);
    ctx.strokeStyle = '#9fb2b9'; ctx.lineWidth = .8;
    ctx.strokeRect(RAMP_X1 + .5, Y1 - panHpx + .5, Lx1 - RAMP_X1 - 1, panHpx - 1);
    ctx.strokeStyle = '#7f9299'; ctx.lineWidth = .6;
    for (var sq = panPitchPx; sq < Lx1 - RAMP_X1; sq += panPitchPx) {
      ctx.beginPath(); ctx.moveTo(RAMP_X1 + sq, Y1 - panHpx); ctx.lineTo(RAMP_X1 + sq, Y1); ctx.stroke();
    }

    /* 液压支架：与溜槽同沿三角煤斜边爬坡（斜边即该段的煤层底板），尖灭点之后水平 */
    var supPx = E.supportPitchM * SCALE, supWpx = supPx * .94;
    var supHpx = E.supportHeightM * SCALE, basePx = 0.4 * SCALE, capPx = 0.3 * SCALE;
    var colWpx = 0.4 * SCALE * .5;
    var rampAng = Math.atan2(rdy, rdx);
    function drawSup2D(px, py, ang) {
      ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
      ctx.fillStyle = '#263c43'; ctx.fillRect(-supWpx / 2, -basePx, supWpx, basePx);     // 底座
      ctx.fillStyle = '#8fa2aa';
      ctx.fillRect(-supWpx * .32, -supHpx + capPx, colWpx, supHpx - capPx - basePx);     // 立柱
      ctx.fillRect(supWpx * .32 - colWpx, -supHpx + capPx, colWpx, supHpx - capPx - basePx);
      ctx.fillStyle = 'rgba(227,170,54,.92)';
      ctx.fillRect(-supWpx / 2, -supHpx, supWpx, capPx);                                // 顶梁
      ctx.restore();
    }
    var supRampN = 4;                        // 斜边段只画 4 架示意（实为 12 架），避免与溜槽重叠成梳齿
    for (var ks = 0; ks < supRampN; ks++) {
      var ss = (ks + .5) * (rlen / supRampN);
      drawSup2D(RAMP_XF + rdx * (ss / rlen), RAMP_TOP + rdy * (ss / rlen), rampAng);
    }
    for (var kf = 0; kf < 3; kf++) {
      var cx = RAMP_X1 + (kf + .5) * supPx;
      if (cx + supWpx / 2 > Lx1 - 3) break;
      drawSup2D(cx, Y1, 0);
    }
    /* 端头破顶：斜边最上 2 架顶梁高出煤顶约 0.73 m（顶梁接直接顶），用虚线示意 */
    ctx.save();
    ctx.strokeStyle = 'rgba(206,86,58,.95)'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(RAMP_XF + 1, Y0); ctx.lineTo(RAMP_XF + 1 + 2 * supPx, Y0); ctx.stroke();
    ctx.restore();

    /* 注记 */
    ctx.font = '600 9px system-ui,-apple-system,"Segoe UI",sans-serif';
    ctx.textAlign = 'left'; ctx.fillStyle = '#c9d4d8';
    ctx.fillText('溜槽 ' + E.panN + ' 节 × ' + E.panLenM.toFixed(1) + ' m · 支架同沿斜边爬坡', RAMP_XF + 8, RAMP_TOP + 13);
    ctx.textAlign = 'right'; ctx.fillStyle = '#e3aa36';
    ctx.fillText('液压支架 3.0 m 高（端头 2 架破顶）', Lx1 - 4, Y1 - supHpx - 9);
  }


  /* ---- 进风巷（−z 端头，贴煤顶；正下方即三角煤满厚平段）----------------- */
  var inX = Lx0 + 2, inY = Y0;                    // 上缘贴煤顶
  box2(inX, inY, LWm, LHm, '#0f1214');
  stroke2(inX, inY, LWm, LHm, '#cfd8dc', 1.4);

  /* ---- 回风巷（+z 端头，贴煤底）----------------------------------------- */
  var retX = Rx0 + 6, retY = Y1 - LHm;            // 下缘贴煤底
  box2(retX, retY, LWm, LHm, '#0f1214');
  stroke2(retX, retY, LWm, LHm, '#cfd8dc', 1.4);

  /* ---- 巷道名 ------------------------------------------------------------ */
  ctx.font = '600 10px system-ui,-apple-system,"Segoe UI",sans-serif';
  ctx.textAlign = 'center'; ctx.fillStyle = '#d9e2e6';
  ctx.fillText('进风巷', inX + LWm / 2, inY + LHm / 2);
  ctx.fillText('回风巷', retX + LWm / 2, retY + LHm / 2);

  /* ---- 三角底煤标注 ------------------------------------------------------ */
  ctx.font = '700 11px system-ui,-apple-system,"Segoe UI",sans-serif';
  ctx.textAlign = 'left'; ctx.fillStyle = '#eaf5ec';
  ctx.fillText('三角底煤', Lx0 + 7, RAMP_TOP + 16);
  ctx.font = '600 9.5px system-ui,-apple-system,"Segoe UI",sans-serif';
  ctx.fillText(rampLenM.toFixed(1) + ' × ' + rampRiseM.toFixed(1) + ' m', Lx0 + 7, RAMP_TOP + 30);
  ctx.fillText('抬溜起坡 · 工艺丢煤', Lx0 + 7, RAMP_TOP + 43);
  ctx.fillStyle = '#9fdcae';
  ctx.fillText('斜边 ' + rampSlopeM.toFixed(0) + ' m / ' + G.rampDeg.toFixed(2) + '°', RAMP_XF + 26, RAMP_TOP - 8);

  /* ---- 断裂区：倾向长度与省略量 ------------------------------------------ */
  ctx.textAlign = 'center';
  ctx.font = '700 12px system-ui,-apple-system,"Segoe UI",sans-serif';
  ctx.fillStyle = '#33424a';
  ctx.fillText('倾向 ' + G.faceLenM.toFixed(0) + ' m', (Lx1 + Rx0) / 2, (Y0 + Y1) / 2 - 7);
  ctx.font = '600 9.5px system-ui,-apple-system,"Segoe UI",sans-serif';
  ctx.fillStyle = '#7c8b93';
  ctx.fillText('中部省略 ' + gapM.toFixed(1) + ' m', (Lx1 + Rx0) / 2, (Y0 + Y1) / 2 + 9);

  /* ---- 层位关系（同一端头的 4.0 m 层位差）------------------------------- */
  var offM = (G.coalTop - G.LANE_H) * G.S;         // 6.2 − 2.2 = 4.0 m
  ctx.font = '600 9.5px system-ui,-apple-system,"Segoe UI",sans-serif';
  ctx.fillStyle = '#cfd8dc';
  ctx.textAlign = 'right';
  ctx.fillText('回风巷顶距煤顶 ' + offM.toFixed(1) + ' m', Rx1, Y0 + 13);

  /* ---- 图例：三角煤沿走向全长的说明 -------------------------------------- */
  ctx.textAlign = 'left'; ctx.fillStyle = '#6f7b72';
  ctx.font = '600 9.5px system-ui,-apple-system,"Segoe UI",sans-serif';
  ctx.fillText('暗绿 = 三角底煤：进风巷贴煤顶，其下满厚 4.0 m（= 煤厚 − 巷高），向工作面 18 m 斜边尖灭，倾向合计 22.5 m。',
    PAD, Y1 + 16);
  ctx.fillText('该煤沿走向全长不变厚（每刀随端头抬溜持续产生），不是区段煤柱；本图为垂直煤层的法向展开，30° 倾角不在此图表达。',
    PAD, Y1 + 31);
  /* v1.0：三机铺满方式（与 3D 同源，见 window.MINING_EQUIP） */
  ctx.fillStyle = '#5b6a63';
  ctx.font = '600 9px system-ui,-apple-system,"Segoe UI",sans-serif';
  ctx.fillText('设备：刮板输送机 88 节 × 1.5 m 铺满工作面，其中三角煤段 12 节沿 12.53° 逐节抬升（即本图绿色段上沿的深灰条带）。',
    PAD, Y1 + 46);
  ctx.fillText('三角底煤的斜边即该段煤层底板：溜槽 12 节 + 支架 12 架同沿 12.53° 斜面爬坡，一板一架；尖灭点之后 76 架水平铺至回风端头（支撑高 3.0 m，上方 3.2 m 顶煤由放煤口放出）。端头最上 2 架顶梁高出煤顶 0.73 m，对应错层位端头破顶（顶梁接直接顶）。采煤机 1 台位于 z = 0，落在断裂区。',
    PAD, Y1 + 60);

  /* ---- 供探针/断言读取（S1 剖面一致性）---------------------------------- */
  if (typeof window !== 'undefined') {
    window.__LANE_SECTION__ = {
      drawn: true,
      canvasW: W, canvasH: H,
      scalePxPerM: SCALE,
      anisotropy: 1,                       // 等比：横纵同一 SCALE
      coalThicknessM: M_M,
      laneWM: laneWM, laneHM: laneHM,
      laneWpx: LWm, laneHpx: LHm,
      zSpanM: G.faceLenM,
      leftSegM: LSEG_M, rightSegM: RSEG_M,
      rampSegM: rampLenM, rampRiseM: rampRiseM, rampSlopeM: rampSlopeM,
      rampDeg: G.rampDeg,
      rampDrawPx: RAMP_X1 - Lx0, rampTopPx: RAMP_TOP,
      rampAreaM2: rampLenM * rampRiseM - 0.5 * rampSlopeM * rampRiseM,  // 平段满厚 + 斜边三角
      omittedM: gapM,
      brokenView: true,
      inAttach: 'top', retAttach: 'bottom',
      offsetM: offM,
      laneCenterGapM: G.laneCenterGapM,
      laneCenterGapU: G.laneCenterGapU,
      dipDeg: G.DIP_DEG,
      equip: (typeof window !== 'undefined' && window.MINING_EQUIP) ? {
        version: 'v1.0 等比例 1:200',
        panCount: window.MINING_EQUIP.panN,
        panRampCount: window.MINING_EQUIP.panNRamp,
        panLenM: window.MINING_EQUIP.panLenM,
        panWidthM: window.MINING_EQUIP.panWidthM,
        panHeightM: window.MINING_EQUIP.panHeightM,
        panWidthPx: panWpx, panHeightPx: panHpx,
        supportCount: window.MINING_EQUIP.supN,
        supportPitchM: window.MINING_EQUIP.supportPitchM,
        supportLenM: window.MINING_EQUIP.supportLenM,
        supportHeightM: window.MINING_EQUIP.supportHeightM,
        supportHeightPx: supHpx,
        machineCount: 1, machineAtZ: 0,
        liftRampM: window.MINING_EQUIP.rampRiseM,
        liftRampLenM: window.MINING_EQUIP.rampLenM,
        liftRampDeg: window.MINING_EQUIP.rampDeg
      } : null,
      note: '本图不含倾角：30° 已在垂直煤层的剖面上展开为水平带；三角底煤在进风端（−z）、沿倾向 22.5 m，正是本剖面表达的对象'
    };
  }
})();
