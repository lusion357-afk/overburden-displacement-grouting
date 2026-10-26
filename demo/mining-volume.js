/* ============================================================================
 * v1.0 三机等比例（1 三维单位 = 22.17 m；几何相似比 1:200；不做视觉放大）
 * ----------------------------------------------------------------------------
 * 用户要求（2026-10-25）：采煤机只布一台、不追求铺满；液压支架与刮板输送机
 *   复制铺满整个工作面；三机沿煤层底板布置；在三角底煤处抬升，贴着三角底煤
 *   的曲线安置。
 *
 * 依据分类
 *   【文献】王志强, 席诗语, 李廷照, 林陆. 厚煤层错层位巷道布置采全厚采煤法 1：
 *          理论创新与工程应用 §2.1 与式(1)：「整个抬升的高度按照溜槽宽度
 *          1.5 m 计算」；相邻溜槽抬升 3°，3°/6°/9°/12°/15° 保持 n 节后逐节
 *          回落；起坡段由溜槽逐节抬升形成，其正下方即三角底煤（工艺丢煤）。
 *   【设定】华丰原文未给设备型号参数。按行业典型值取值——
 *          SGZ764 系列工作面溜槽 764 mm 宽、约 0.30 m 高；
 *          ZF 系列放顶煤支架 1.5 m 中心距 / 5.0 m 架长 / 3.0 m 支撑高
 *          （综放机采高度，上方 3.2 m 顶煤由放煤口放出，不在支架支撑范围）；
 *          MG 系列双滚筒采煤机 8.0 m 机身 / 2.0 m 机宽 / Φ1.8 m 滚筒。
 *          全部尺寸 ÷S 换算，不放大。
 *
 * 【支架随溜槽一起爬上斜边】三角底煤的斜边就是该段的「煤层底板」：溜槽 12 节
 *   沿斜边逐节抬升，支架也沿同一条斜边爬坡（底座贴斜面、整架随坡倾斜 12.53°），
 *   一板一架对应：12 节斜边 + 76 节水平 = 88 架。斜边最高处（进风端）支架顶
 *   = 4.0 + 3.0·cos(12.53°) ≈ 6.93 m，高出煤顶 6.2 m 约 0.73 m——这不是建模
 *   错误，而是错层位端头的【破顶】工艺：顶梁顶在直接顶上，顶板随采随落。
 *   【文献】王志强 2013 :846-849 / 2014 图3 / 2024 §3.1 端头破顶；本图未画破顶
 *   过程与垮落矸石，属【设定】简化。
 *
 * 可见性（1440×1000 视口、全景约 91.7 px/单位）：
 *   溜槽 0.30 m ≈ 1.2 px —— 单节不可辨，但 88 节连成横跨 133 m 的银线可辨；
 *   支架 3.0 m ≈ 12.4 px 高、1.5 m ≈ 6.2 px 宽 —— 88 架成梳齿带可辨；
 *   采煤机 8 m ≈ 33 px、Φ1.8 m 滚筒 ≈ 7.4 px —— 可辨。
 *   溜槽截面与「逐节抬溜」的细节交由 lane-section.js 的 2D 倾向剖面承担
 *   （等比 17.7 px/m，见该文件头部）。
 * ========================================================================== */
(() => {
  'use strict';

  window.createMiningVolume = function createMiningVolume({ THREE: T, parent, materials = {}, clearanceAt }) {
    if (!T || !parent) throw new Error('createMiningVolume 需要 THREE 和 parent');
    const G = (typeof window !== 'undefined') ? window.__GEO__ : null;
    if (!G) throw new Error('mining-volume.js 必须在 geometry.js 之后加载');

    const group = new T.Group();
    group.name = '三机（等比例 1:200）';
    parent.add(group);
    const machine = new T.Group();
    machine.name = '采煤机（单台）';
    group.add(machine);

    const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
    const U = (m) => m / G.S;                    // 真实米 → 三维单位

    /* ---- 本版唯一定值块：设备真实尺寸（m）与走向站位 --------------------
     * 依据类别见文件头。走向站位以煤壁（工作面推进前沿）为 x = 0，采空区侧为负。
     * 站位【设定】：溜槽紧随煤壁（铲板贴壁），支架在溜槽后方一个架长，采煤机
     *   骑在溜槽上、机身中心略偏采空区侧。 */
    const EQUIP = {
      panLenM: 1.5,            // 【文献】王志强 2026 §2.1：溜槽（中部槽）长 1.5 m
      panWidthM: 0.76,         // 【设定】SGZ764 系列槽宽 764 mm
      panHeightM: 0.30,        // 【设定】槽高约 0.29 m（含挡煤板取 0.30）
      supportPitchM: 1.5,      // 【设定】支架中心距，与溜槽节长配套
      supportLenM: 5.0,        // 【设定】ZF 系列架长（顶梁 + 掩护梁）
      supportHeightM: 3.0,     // 【设定】支撑高 = 综放机采高度（煤厚 6.2 中采 3.0）
      shearerLenM: 8.0,        // 【设定】MG 系列机身长（沿工作面方向）
      shearerWidthM: 2.0,      // 【设定】机身宽（沿走向）
      shearerHeightM: 1.5,     // 【设定】机身本体高（不含摇臂与滚筒）
      drumDiaM: 1.8,           // 【设定】Φ1.8 m 滚筒
      drumWidthM: 0.7,         // 【设定】滚筒宽
      panCxM: -0.55,           // 【设定】溜槽中心距煤壁 0.55 m
      supportCxM: -3.5,        // 【设定】支架中心距煤壁 3.5 m（架前端 −1.0 m）
      shearerCxM: -0.9,        // 【设定】采煤机机身中心距煤壁 0.9 m
      drumCyM: 1.6             // 【设定】滚筒中心高 1.6 m（割 3.0 m 机采段）
    };

    /* ---- 三角底煤顶面 = 设备底板（几何取自 geometry.js，不另设数字）-----
     * 进风巷内帮 zLaneIn1 处厚 4.0 m（rampRiseU），沿 18 m 斜边线性降到 0
     * （尖灭点 rampZ1），之外贴煤底。溜槽与支架底面的 y 全部由 lift(z) 给出，
     * 因此「贴着三角底煤曲线」是几何恒等式，不是手调的偏移。 */
    const Z_WORK0 = G.zLaneIn1;                  // −2.99955 工作面起点（进风巷内帮）
    const Z_WORK1 = G.zLaneRet0;                 // +2.99955 工作面终点（回风巷内帮）
    const Z_SLOPE0 = G.rampZSlope0;              // 与 Z_WORK0 同值（平段/斜边交界）
    const Z_FLARE = G.rampZ1;                    // −2.18766 三角煤尖灭点
    const RAMP_RISE = G.rampRiseU;               // 0.180424 = 4.0 m
    const RAMP_LEN = G.rampSlopeLenU;            // 0.811893 = 18 m
    const RAMP_RAD = Math.atan2(RAMP_RISE, RAMP_LEN);   // 12.5288°（与 G.rampDeg 一致）

    function lift(z) {
      if (z <= Z_SLOPE0) return RAMP_RISE;       // 平段（巷道下方，工作面前缘之外）
      if (z >= Z_FLARE) return 0;                // 贴煤底
      return RAMP_RISE * (1 - (z - Z_SLOPE0) / RAMP_LEN);
    }

    const mat = {
      dark: materials.dark || new T.MeshStandardMaterial({ color: '#263c43', metalness: .4, roughness: .5 }),
      yellow: materials.yellow || new T.MeshStandardMaterial({ color: '#e3aa36', metalness: .25, roughness: .5 }),
      steel: materials.metal || new T.MeshStandardMaterial({ color: '#a6b3b9', metalness: .8, roughness: .28 }),
      light: materials.light || new T.MeshStandardMaterial({ color: '#e5eceb', roughness: .6 })
    };
    const cube = new T.BoxGeometry(1, 1, 1);
    const cylinder = new T.CylinderGeometry(1, 1, 1, 14);
    const unitY = new T.Vector3(0, 1, 0);
    const scratch = new T.Object3D();
    const staticBatches = new Map();
    let staticInstanceCount = 0;

    function record(geometry, material, transform) {
      const key = geometry.uuid + ':' + material.uuid;
      if (!staticBatches.has(key)) staticBatches.set(key, { geometry, material, matrices: [] });
      staticBatches.get(key).matrices.push(transform.clone());
    }
    /* 通用部件：rx 让三角煤段的溜槽沿 12.53° 斜面倾斜（绕走向 x 轴），
     * 旋转后箱体在 y 向的投影为 h·cos(rx)，故贴面高度按 cos 折算。 */
    function part(w, h, d, material, x, y, z, rx = 0, rz = 0) {
      scratch.position.set(x, y, z);
      scratch.rotation.set(rx, 0, rz);
      scratch.scale.set(w, h, d);
      scratch.updateMatrix();
      record(cube, material, scratch.matrix);
    }
    function strut(a, b, r, material) {
      const A = new T.Vector3(a[0], a[1], a[2]);
      const B = new T.Vector3(b[0], b[1], b[2]);
      const axis = B.clone().sub(A);
      scratch.position.copy(A).add(B).multiplyScalar(.5);
      scratch.quaternion.setFromUnitVectors(unitY, axis.clone().normalize());
      scratch.scale.set(r, axis.length(), r);
      scratch.updateMatrix();
      record(cylinder, material, scratch.matrix);
    }

    /* ---- ① 刮板输送机：全工作面 88 节 × 1.5 m 铺满 --------------------- *
     * 三角煤段（Z_WORK0 → Z_FLARE）每节沿斜面倾斜 12.53°，节长取 1.5/cos 使
     * 相邻节沿 z 投影恰好 1.5 m、端面 y 连续（三角煤面是直线，无缝）。 */
    const panPitch = U(EQUIP.panLenM);
    const panX = U(EQUIP.panCxM);
    const panW = U(EQUIP.panWidthM), panH = U(EQUIP.panHeightM);
    /* 段 A：三角煤斜边（Z_SLOPE0 → Z_FLARE，18 m）——节数由斜边长决定，
     * 每节 z 投影 1.5 m、端面在斜面上连续，最后一节恰好落在尖灭点。 */
    const panNRamp = Math.round(RAMP_LEN / panPitch);                  // 12 节 = 18 m
    /* 段 B：尖灭点 → 回风端头（保持水平，与支架同起点）。 */
    const panNFlat = Math.floor((Z_WORK1 - Z_FLARE) / panPitch);       // 76 节
    const panN = panNRamp + panNFlat;                                  // 88 节
    const panX0 = panX;
    function panTilt(zc, rx, d) {
      const cl = Math.cos(rx);
      const base = lift(zc);                   // 三角煤顶面（槽底面）
      // 槽底（0.06 m 厚，底面贴三角煤面）
      part(panW, U(.06), d, mat.dark, panX0, base + U(.03) * cl, zc, rx);
      // 两侧挡板（0.05 m 厚 × 0.30 m 高）
      part(U(.05), panH, d, mat.steel, panX0 - panW / 2 + U(.025), base + U(.15) * cl, zc, rx);
      part(U(.05), panH, d, mat.steel, panX0 + panW / 2 - U(.025), base + U(.15) * cl, zc, rx);
      // 链道（中板上的浅色细条，示意煤流）
      part(U(.10), U(.02), d, mat.light, panX0, base + U(.08) * cl, zc, rx);
    }
    for (let j = 0; j < panNRamp; j++) {
      const zc = Z_SLOPE0 + (j + .5) * panPitch;
      panTilt(zc, RAMP_RAD, panPitch / Math.cos(RAMP_RAD));
    }
    for (let j = 0; j < panNFlat; j++) {
      const zc = Z_FLARE + (j + .5) * panPitch;
      panTilt(zc, 0, panPitch);
    }

    /* ---- ② 液压支架：自进风端头起 88 架 × 1.5 m，斜边段沿三角煤斜面爬坡 --
     * 「三角底煤的斜边就是煤层底板」：支架底座贴斜面（随坡倾斜 12.53°），
     * 与溜槽一板一架对应（12 节斜边 + 76 节水平 = 88 架）。
     * 斜边最高处（进风端）支架顶 = 4.0 + 3.0·cos(12.53°) ≈ 6.93 m，高出煤顶 6.2 m
     * 0.73 m —— 对应错层位端头「破顶」工艺（顶梁接直接顶），详见 docs/v10_三机等比.md §3.2。 */
    const supPitch = U(EQUIP.supportPitchM);
    const supN = Math.floor((Z_WORK1 - Z_SLOPE0) / supPitch);          // 88 架
    const supX = U(EQUIP.supportCxM);
    const supLen = U(EQUIP.supportLenM);
    const supH = U(EQUIP.supportHeightM);
    const supW = supPitch * .94;               // 架体略窄于中心距，留架间缝
    for (let j = 0; j < supN; j++) {
      const zc = Z_SLOPE0 + (j + .5) * supPitch;
      if (zc + supW / 2 > Z_WORK1) break;
      const rx = zc < Z_FLARE ? RAMP_RAD : 0;  // 斜边段随坡倾斜，尖灭点之后水平
      const cl = Math.cos(rx);
      const base = lift(zc);
      // 底座（5.0 × 0.40 m）
      part(supLen, U(.40), supW, mat.dark, supX, base + U(.20) * cl, zc, rx);
      // 顶梁（5.0 × 0.30 m，顶面 = 支撑高 3.0 m）
      part(supLen, U(.30), supW, mat.yellow, supX, base + (supH - U(.15)) * cl, zc, rx);
      // 前后两根立柱（Φ0.40 m）
      const colFront = supX + supLen / 2 - U(1.1);
      const colBack = supX - supLen / 2 + U(1.1);
      strut([colFront, base + U(.40) * cl, zc], [colFront, base + (supH - U(.30)) * cl, zc], U(.20), mat.steel);
      strut([colBack, base + U(.40) * cl, zc], [colBack, base + (supH - U(.30)) * cl, zc], U(.20), mat.steel);
      // 掩护梁：由顶梁后端斜下插入采空区侧
      strut([supX - supLen / 2, base + (supH - U(.35)) * cl, zc],
        [supX - supLen / 2 - U(.9), base + U(.10), zc], U(.12), mat.dark);
    }

    /* ---- 供 2D 倾向剖面（lane-section.js）复用同一套定值，避免两处各写一遍 ---- */
    if (typeof window !== 'undefined') {
      window.MINING_EQUIP = Object.assign({}, EQUIP, {
        panNRamp: panNRamp, panNFlat: panNFlat, panN: panN, supN: supN,
        unitM: G.S, rampRiseM: RAMP_RISE * G.S, rampLenM: RAMP_LEN * G.S, rampDeg: G.rampDeg
      });
    }

    /* ---- ③ 采煤机：单台，骑在前部溜槽上，位于工作面中部 ----------------- */
    const shLen = U(EQUIP.shearerLenM);
    const shWid = U(EQUIP.shearerWidthM);
    const shH = U(EQUIP.shearerHeightM);
    const shX = U(EQUIP.shearerCxM);
    const shZ = 0;                              // 工作面中部（z = 0，lift = 0）
    const panTop = lift(shZ) + U(EQUIP.panHeightM);       // 溜槽顶面
    const bodyY = panTop + shH / 2;
    // 机身（8.0 m 沿倾向 × 2.0 m 沿走向 × 1.5 m 高）
    part(shWid, shH, shLen, mat.yellow, shX, bodyY, shZ);
    part(shWid * 1.06, U(.12), shLen, mat.dark, shX, panTop + U(.06), shZ);   // 机身底托
    // 两端摇臂（机身端 → 滚筒轴心）
    const drumCy = lift(shZ) + U(EQUIP.drumCyM);
    for (const s of [-1, 1]) {
      strut([shX, panTop + shH * .55, s * (shLen / 2 - U(.5))],
        [shX, drumCy, s * (shLen / 2 + U(.15))], U(.16), mat.dark);
    }
    const drums = [];
    const drumGeo = new T.CylinderGeometry(U(EQUIP.drumDiaM / 2), U(EQUIP.drumDiaM / 2), U(EQUIP.drumWidthM), 16);
    drumGeo.rotateZ(Math.PI / 2);               // 圆柱轴由 +y 转到 +x（沿走向）
    const drumRingGeo = new T.CylinderGeometry(U(EQUIP.drumDiaM / 2) * 1.12, U(EQUIP.drumDiaM / 2) * 1.12, U(.10), 16);
    drumRingGeo.rotateZ(Math.PI / 2);
    for (const s of [-1, 1]) {
      const drum = new T.Mesh(drumGeo, mat.dark);
      drum.name = '截割滚筒_' + (s < 0 ? '1' : '2');
      drum.position.set(shX, drumCy, s * (shLen / 2 + U(.15)));
      drum.castShadow = true; drum.receiveShadow = true;
      group.add(drum); drums.push(drum);
      // 螺旋叶片（两条端环示意）
      for (const k of [-1, 1]) {
        const ring = new T.Mesh(drumRingGeo, mat.steel);
        ring.position.set(shX + k * U(.18), drumCy, s * (shLen / 2 + U(.15)));
        ring.castShadow = true; group.add(ring);
      }
    }

    /* ---- 合批：静态设备共用 InstancedMesh，减少 draw call ------------- */
    for (const batch of staticBatches.values()) {
      const mesh = new T.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
      mesh.name = '等比例设备静态组件';
      batch.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      machine.add(mesh);
      staticInstanceCount += batch.matrices.length;
    }

    const current = { face: -4.8, progress: 0, time: 0 };
    function update({ face = current.face, progress = current.progress, time = current.time } = {}) {
      current.face = Number.isFinite(face) ? face : current.face;
      current.progress = clamp(Number.isFinite(progress) ? progress : current.progress);
      current.time = Number.isFinite(time) ? time : current.time;
      group.position.x = current.face;
      // 滚筒自转：由进度唯一确定，拖回同一进度必然回到同一帧（无墙钟动画）。
      const cutting = clamp((current.progress - .12) / .68);
      drums.forEach((drum, i) => { drum.rotation.x = cutting * 24 + i * .6; });
      group.updateMatrixWorld(true);
    }

    function diagnostics() {
      const span = (Z_WORK1 - Z_WORK0) * G.S;            // 133.0 m 工作面净宽
      const supSpan = (Z_WORK1 - Z_FLARE) * G.S;         // 115.0 m 支架段
      return {
        name: '三机（等比例）',
        similarity: '1:200（CL=200）', unitM: G.S,
        coordinateSystem: { advance: 'x', vertical: 'y', tendency: 'z' },
        face: current.face, progress: current.progress, time: current.time,
        machineCount: 1, drumCount: drums.length,
        panCount: panN, panLenM: EQUIP.panLenM,
        panWidthM: EQUIP.panWidthM, panHeightM: EQUIP.panHeightM,
        panSpanM: span,
        supportCount: supN, supportPitchM: EQUIP.supportPitchM,
        supportLenM: EQUIP.supportLenM, supportHeightM: EQUIP.supportHeightM,
        supportSpanM: supSpan,
        shearerLenM: EQUIP.shearerLenM, shearerWidthM: EQUIP.shearerWidthM,
        drumDiaM: EQUIP.drumDiaM, drumWidthM: EQUIP.drumWidthM,
        lift: {
          rampRiseM: RAMP_RISE * G.S,           // 4.0
          rampLenM: RAMP_LEN * G.S,             // 18.0
          rampDeg: G.rampDeg,                   // 12.5288
          atWorkfaceStartM: lift(Z_WORK0) * G.S,  // 4.0
          atFlareM: lift(Z_FLARE) * G.S,        // 0
          atMidfaceM: lift(0) * G.S             // 0
        },
        zWorkBounds: { min: Z_WORK0, max: Z_WORK1 },
        staticInstanceCount, staticDrawBatches: staticBatches.size,
        note: '三角底煤斜边即该段煤层底板：溜槽 12 节 + 支架 12 架同沿 12.53° 斜面爬坡（一板一架），尖灭点之后水平铺满；进风端支架顶高出煤顶 0.73 m 对应端头破顶工艺，详见文件头与 docs/v10_三机等比.md §3.2'
      };
    }

    update({ face: -4.8, progress: 0, time: 0 });
    return { group, update, diagnostics };
  };
})();
