/* ============================================================================
 * v0.6 几何基准层 · 唯一换算入口
 *
 * 【本文件是全模型唯一允许出现 SLOPE 的地方】
 *   §4.3 要求：任何几何取位必须经 frame()，不允许裸写 SLOPE*z。
 *   v0.5 的 SLOPE*z 分散在 scene.js 的 10 处（223/289/315/338/348/359/440/457/784 行等）
 *   外加 Math.min(…, SURF_Y) 截平地表，无法审计 —— 本层把它们收敛为一个函数。
 *
 * 【单向正推，禁止反推】
 *   输入：M = 6.2 m、H0 = 150 m、S = 22.17 m/单位、dip = 30°、倾向 142 m
 *   输出：coalTop、surfY0、zHalf、rise、起坡段、箱体
 *   禁止由 SURF_Y 反推 coalTop。v0.5 的 `SEAM_TOP = 7.05 − 150/S = 0.2842` 即反推，
 *   隐含采高 6.30 m 而非 6.2 m —— 与 SURF_Y=7.05 一起构成错误原点。
 *
 * 【v0.6.0-S1 的两处语义变更（旧 → 新，不兼容）】
 *   1. zHalf：旧「两个工作面搭接共 250 m 的倾向半宽 = 5.638」→
 *             新「单个工作面 142 m 的倾向半幅 = 3.2025」。S2 两面搭接时再扩至 6.405。
 *   2. 双巷布局：旧「同一断面、z=0 处上下错开 4.0 m」→ 作废。
 *     新：分居倾向两端头，进风巷贴煤层顶板（z = −zHalf 一侧）、
 *         回风巷贴煤层底板（z = +zHalf 一侧），两巷沿倾向相距一个面长 142 m。
 *         6.2 − 2.2 = 4.0 m 只是**同一端头**「贴顶巷底」与「贴底巷顶」的层位差，
 *         不是两巷的位置差 —— 这是 S0 遗留的错误语义，S1 起彻底分离。
 *
 * 【坐标约定】
 *   数据系 D：原点煤顶，向下为负，单位 m
 *   渲染系 R：原点煤底最低点（z = −zHalf 处），向上为正，单位 = 1 三维单位
 *   yBase(z) = (z + zHalf)·SLOPE   —— 煤底随倾向抬升的绝对高度
 *   frame(yLocal, z) = { y: yBase(z) + yLocal }  —— yLocal 为该处距煤底的高度
 *   走向 x：切眼在负端（xFace = −5.0），采空与推进朝 +x
 * ==========================================================================*/
(function () {
  'use strict';

  var D = (typeof window !== 'undefined' ? window : global).MINE_DATA;
  if (!D) throw new Error('geometry.js 必须在 data/geology.js 之后加载');
  var L = D.literature;

  /* ---- 唯一输入 -------------------------------------------------------- */
  var S = L.scale.S;                        // 22.17 m / 三维单位
  var M = L.seam.thickness;                 // 6.2 m 采高
  var H0 = L.cover.depthM;                  // 150 m 建模覆岩
  var DIP_DEG = L.mine.dip;                 // 30°
  var SLOPE = Math.tan(DIP_DEG * Math.PI / 180);   // 0.5773502691896257

  /* ---- 正推（唯一生成方向）-------------------------------------------- */
  var coalTop = M / S;                      // 0.27965719  煤顶距煤底
  var H0u = H0 / S;                         // 6.76589986
  var surfY0 = coalTop + H0u;               // 7.04555706  煤底最低点之上的地表高度

  var faceLenM = L.workingFace.dipLengthM;   // 142 m（单工作面倾向长度；v11 字段改名）
  var zHalf = (faceLenM / 2) / S;               // 3.20252594  倾向半幅（单面 142 m）
  var rise = 2 * zHalf * SLOPE;                 // 3.69795771  倾向 142 m 的剪切落差（单位）
  var riseM = rise * S;                         // 81.98373822 m
  var verticalProj = M / Math.cos(DIP_DEG * Math.PI / 180);   // 7.15914334 m 采高垂直投影
  var prototypeH = riseM + H0 + verticalProj;   // 239.14288156 m 台架原型高（三向同 5 mm/m）

  var boxUnits = {
    x: L.scale.boxPrototypeM.x / S,         // 11.99820
    y: L.scale.boxPrototypeM.y / S,         // 10.78678
    z: L.scale.boxPrototypeM.z / S          //  6.40505
  };
  var boxX0 = -boxUnits.x / 2;              // −5.99910 箱体左边界（x 负端）
  var boxX1 = boxUnits.x / 2;               // +5.99910 箱体右边界（x 正端）

  /* ---- 巷道（S1 使用；真实断面，不做任何视觉放大）-------------------- */
  var LANE_H = 2.2 / S;                     // 0.099233  真实巷高 2.2 m
  var LANE_W = 4.5 / S;                     // 0.202977  真实巷宽 4.5 m
  var laneWidthM = 4.5, laneHeightM = 2.2;  // 真实断面（参与断言）

  /* ---- 走向分区：切眼 / 未采动 / 采空 / 起坡 -------------------------- */
  var xFace = -5.0;                         // 切眼起始 x（用户 m00957 定案）
  var notMinedLenU = xFace - boxX0;         // 0.99910  未采动煤层（≈ 22.15 m）
  var cutW = LANE_W;                        // 切眼沿走向宽 4.5 m
  var xCutEnd = xFace + cutW;               // −4.79703 切眼后缘（采空区起点）

  /* ---- 倾向分区：两端头的巷道带宽 ------------------------------------- */
  var zLaneIn0 = -zHalf, zLaneIn1 = -zHalf + LANE_W;   // 进风巷：贴 −z 端头
  var zLaneRet0 = zHalf - LANE_W, zLaneRet1 = zHalf;   // 回风巷：贴 +z 端头

  /* ---- 三角底煤（S1h 修正：倾向 22.5 m 曲边三角 · 进风侧 · 沿走向全长）-- *
   * v0.9 修正：v0.8 把底煤楔做成「走向末端 15 m 线性抬升」，方向与工艺都不对。
   * 文献（赵景礼 2004；王志强 2014 图3 / 2024 §3.1 / 2026 式(1)）：
   *   工作面沿倾向布置、贴煤层底板推进，靠近**进风巷（沿顶板）**的一侧
   *   输送机溜槽逐节抬高 3°→6°→9°→12°→15°…再逐节回落，形成横跨倾向
   *   22.5 m（15 节 × 1.5 m，含 4.5 m 水平端头段）的曲边三角形底煤；
   *   最大厚度 = 煤厚 − 巷高 = 6.2 − 2.2 = 4.0 m，沿**走向全长**保持。
   *   三角煤是「工艺丢煤」，工作面推过后留在采空区底板上，永久保留。
   * v0.8 注释「沿倾向变薄会让进风巷悬空」不成立：进风巷下方正是三角煤最厚段
   *   （4.5 m 巷宽、厚 4.0 m），变薄发生在巷道内侧 z > zLaneIn1 之后。 */
  var rampLenM = 22.5;                                   // 三角煤倾向水平长（15 节 × 1.5 m）
  var rampLenU = rampLenM / S;                           // 1.014865 单位
  var rampRiseU = coalTop - LANE_H;                      // 0.18042399 单位 = 4.0 m 最大厚
  var rampSlopeLenM = rampLenM - laneWidthM;             // 18.0 m 斜边水平投影（去掉巷下平段）
  var rampSlopeLenU = rampSlopeLenM / S;                 // 0.811893 单位
  var rampDeg = Math.atan(rampRiseU * S / rampSlopeLenM) * 180 / Math.PI;  // 12.5288°（落 12~15° 区间）
  var rampSegments = 15;                                 // 名义节数（15 节 × 1.5 m）
  var rampDrawSegments = 18;                             // 斜边绘制细分（每段 1 m 倾向）
  var rampZ0 = zLaneIn0;                                 // 三角煤起点 = 进风巷外帮（−zHalf）
  var rampZ1 = zLaneIn0 + rampLenU;                      // 尖灭点（工作面内侧 22.5 m）
  var rampZSlope0 = zLaneIn0 + LANE_W;                   // 斜边起点 = 进风巷内帮（巷下 4.5 m 为满厚平段）

  /* ---- 巷道层位（世界 y，按各自端头取值）----------------------------- *
   * 进风巷在 z = −zHalf 端头：yBase = 0，顶板与 coalTop 齐平；
   * 回风巷在 z = +zHalf 端头：yBase = rise，底板与煤底（局部 0）齐平。 */
  var laneInTopY = yBase(-zHalf) + coalTop;              // 0.27965719 进风巷顶板
  var laneInBotY = laneInTopY - LANE_H;                  // 0.18042399 进风巷底板
  var laneRetBotY = yBase(zHalf) + 0;                    // 3.69795771 回风巷底板
  var laneRetTopY = laneRetBotY + LANE_H;                // 3.79719094 回风巷顶板
  var laneInCenterY = laneInTopY - LANE_H / 2;           // 进风巷中心
  var laneRetCenterY = laneRetBotY + LANE_H / 2;         // 回风巷中心
  var laneCenterGapU = laneRetCenterY - laneInCenterY;   // 3.51753342 两巷中心高差
  var laneCenterGapM = laneCenterGapU * S;               // 77.9837 m
  var endDropU = rise - coalTop;                         // 3.41830051 两端头绝对高差
  var endDropM = endDropU * S;                           // 75.7837 m（= riseM − 6.2）
  var laneOffset = coalTop - LANE_H;                     // 0.18042399 同一端头层位差 = 4.0 m

  /* ---- 局部坐标（strata 组内，煤底 = 0）------------------------------ */
  var laneBotLocal = 0;                                  // 回风巷底贴煤底
  var laneTopLocal = coalTop - LANE_H;                   // 进风巷底（局部）
  var laneTopCenterLocal = coalTop - LANE_H / 2;
  var laneBotCenterLocal = LANE_H / 2;

  /* ---- 煤柱对照（S2 使用）-------------------------------------------- */
  var pillarM = L.pillar.designWidthM;      // 5 m 护巷煤柱（对照方案）
  var pillarU = pillarM / S;                // 0.225530

  /* ---- 注浆层位 -------------------------------------------------------- */
  var groutDistM = L.grout.target.distToSeam;    // 88 m（S7 底界）
  var groutU = (groutDistM + M) / S;             // 4.248985  距煤底

  /* ---- 换算函数 -------------------------------------------------------- */
  /** 煤底在倾向 z 处的绝对高度（渲染系） */
  function yBase(z) { return (z + zHalf) * SLOPE; }

  /** 局部高度（距本处煤底）→ 世界坐标；x 由调用方给出 */
  function frame(yLocal, z, x) {
    return { x: (x === undefined ? 0 : x), y: yBase(z) + yLocal, z: z };
  }

  /** 数据系（煤顶 0，向下为负，m）→ 渲染系绝对 y */
  function yFromData(yD, z) { return yBase(z) + (yD + M) / S; }

  /** 渲染系绝对 y → 数据系（m，距煤顶，向下为负） */
  function yToData(yR, z) { return (yR - yBase(z)) * S - M; }

  /** 数据系高度 yD(相对煤顶) 处的层面标高（渲染系，z=0 基准） */
  function levelU(yD) { return (yD + M) / S; }

  /* ---- z = 0 界面取值（三带、注浆层位沿用）--------------------------- */
  var keyBottomY = yBase(0) + groutU;                 // 注浆层位线（S7 底界 88 m）
  var surfY0At = surfY0;                              // z=0 处地表
  var surfYHigh = surfY0 + rise;                      // z=+zHalf 处地表（箱顶校核用）
  var seamTopY = yBase(0) + coalTop;

  /* ---- 箱体 / 标尺校核 ------------------------------------------------ */
  var mmPerM = {
    x: L.scale.boxMM.x / L.scale.boxPrototypeM.x * 1000,   // 5000.000
    y: L.scale.boxMM.y / L.scale.boxPrototypeM.y * 1000,   // 4999.982（1195.71 取整所致）
    z: L.scale.boxMM.z / L.scale.boxPrototypeM.z * 1000    // 5000.000
  };

  var GEO = {
    version: 'v0.11.0',
    /* 输入 */
    S: S, M: M, H0: H0, DIP_DEG: DIP_DEG, SLOPE: SLOPE,
    /* 派生的竖向基准 */
    coalTop: coalTop, H0u: H0u, surfY0: surfY0,
    seamTopY: seamTopY, surfY0At: surfY0At, surfYHigh: surfYHigh,
    /* 倾向 */
    faceLenM: faceLenM, zHalf: zHalf, rise: rise, riseM: riseM,
    verticalProj: verticalProj, prototypeH: prototypeH,
    /* 箱体 */
    boxUnits: boxUnits, boxMM: L.scale.boxMM, mmPerM: mmPerM,
    boxX0: boxX0, boxX1: boxX1,
    /* 走向分区（S1） */
    xFace: xFace, notMinedLenU: notMinedLenU, cutW: cutW, xCutEnd: xCutEnd,
    /* 巷道（真实断面，不放大）*/
    LANE_H: LANE_H, LANE_W: LANE_W,
    laneWidthM: laneWidthM, laneHeightM: laneHeightM,
    zLaneIn0: zLaneIn0, zLaneIn1: zLaneIn1,
    zLaneRet0: zLaneRet0, zLaneRet1: zLaneRet1,
    laneInTopY: laneInTopY, laneInBotY: laneInBotY, laneInCenterY: laneInCenterY,
    laneRetTopY: laneRetTopY, laneRetBotY: laneRetBotY, laneRetCenterY: laneRetCenterY,
    laneCenterGapU: laneCenterGapU, laneCenterGapM: laneCenterGapM,
    endDropU: endDropU, endDropM: endDropM,
    laneOffset: laneOffset,
    /* 煤柱对照（S2）*/
    pillarM: pillarM, pillarU: pillarU,
    /* 注浆 */
    groutDistM: groutDistM, groutU: groutU, keyBottomY: keyBottomY,
    /* 三角底煤（S1h 修正 · 倾向 22.5 m 曲边三角 · 进风侧 · 沿走向全长） */
    rampLenM: rampLenM, rampLenU: rampLenU, rampRiseU: rampRiseU,
    rampSlopeLenM: rampSlopeLenM, rampSlopeLenU: rampSlopeLenU,
    rampDeg: rampDeg, rampSegments: rampSegments, rampDrawSegments: rampDrawSegments,
    rampZ0: rampZ0, rampZ1: rampZ1, rampZSlope0: rampZSlope0,
    /* 双巷局部位置（strata 内） */
    laneBotLocal: laneBotLocal, laneTopLocal: laneTopLocal,
    laneTopCenterLocal: laneTopCenterLocal, laneBotCenterLocal: laneBotCenterLocal,
    /* 函数（唯一入口）*/
    yBase: yBase, frame: frame,
    yFromData: yFromData, yToData: yToData, levelU: levelU
  };

  (typeof window !== 'undefined' ? window : global).__GEO__ = GEO;
  if (typeof module !== 'undefined' && module.exports) module.exports = GEO;
})();
