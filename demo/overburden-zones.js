/* 采动覆岩三带的定性三维示意：不提供三带工程高度，也不是岩体力学解算。 */
(() => {
  'use strict';
  window.createOverburdenZones = function createOverburdenZones({ THREE: T, parent, deflect }) {
    if (!T || !parent || typeof deflect !== 'function') throw new Error('覆岩三带模块需要 THREE、parent 和 deflect 回调');
    const group = new T.Group(); group.name = '覆岩三带定性体积示意'; parent.add(group);
    const replacementLayerIndices = [2, 3, 4, 5];
    const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
    const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
    const scratch = new T.Object3D();
    const state = { progress: 0, face: -4.8, exaggeration: true, treated: true, interior: false };
    const unitBox = new T.BoxGeometry(1, 1, 1);
    const roofMat = new T.MeshStandardMaterial({ color: '#ac9d86', roughness: .98 });
    const blocksMat = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
    const fissureMat = new T.MeshStandardMaterial({ color: '#ffffff', roughness: .97 });
    const chipsMat = new T.MeshStandardMaterial({ color: '#958875', roughness: 1 });
    let seed = 851220;
    const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const range = (a, b) => a + (b - a) * rng();
    const lowerData = [], fractureData = [], chipData = [];
    const NX = 28, NZ = 6, DX = 12 / NX, DZ = 3.3 / NZ;
    const capBase = .80;
    const fractureLayers = [
      { index: 3, bottom: 1.34, top: 2.15, color: '#c0b299' },
      { index: 4, bottom: 2.15, top: 2.92, color: '#968c7e' },
      { index: 5, bottom: 2.92, top: 3.65, color: '#b9a992' }
    ];
    for (let ix = 0; ix < NX; ix++) {
      for (let iz = 0; iz < NZ; iz++) {
        const x = -6 + (ix + .5) * DX, z = -1.65 + (iz + .5) * DZ;
        lowerData.push({ x, z, ix, iz, tilt: range(-1, 1), yaw: range(-1, 1), drop: range(.035, .145), jitter: range(-1, 1), tone: range(.90, 1.07) });
        fractureLayers.forEach(layer => fractureData.push({ x, z, ix, iz, ...layer, seam: range(.75, 1.25), tone: range(.92, 1.04) }));
      }
    }
    const lower = new T.InstancedMesh(unitBox, blocksMat, lowerData.length);
    lower.name = '近顶板有限垮落块体';
    const fractured = new T.InstancedMesh(unitBox, fissureMat, fractureData.length);
    fractured.name = '贯穿厚度的裂隙带岩体';
    for (const mesh of [lower, fractured]) {
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.castShadow = true; mesh.receiveShadow = true;
      // 这些块体随进度变化；禁用视锥裁剪，省去每帧遍历全部实例更新包围体。
      mesh.frustumCulled = false; group.add(mesh);
    }
    // 未采动时颜色与几何连续，不预先显示棋盘纹或人为网格裂缝。
    lowerData.forEach((d, i) => lower.setColorAt(i, new T.Color('#a59680')));
    fractureData.forEach((d, i) => fractured.setColorAt(i, new T.Color(d.color)));
    lower.instanceColor.needsUpdate = true; fractured.instanceColor.needsUpdate = true;

    // idx2 上部连续薄层仍覆盖近顶板局部碎块，避免把整层或目标层误画成大范围垮塌。
    const capPositions = [];
    const tri = (a, b, c) => capPositions.push(...a, ...b, ...c);
    const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
    for (let ix = 0; ix < NX; ix++) {
      const x = -6 + ix * DX, X = x + DX;
      quad([x, capBase, 1.65], [X, capBase, 1.65], [X, 1.34, 1.65], [x, 1.34, 1.65]);
      quad([X, capBase, -1.65], [x, capBase, -1.65], [x, 1.34, -1.65], [X, 1.34, -1.65]);
      quad([x, 1.34, 1.65], [X, 1.34, 1.65], [X, 1.34, -1.65], [x, 1.34, -1.65]);
      quad([x, capBase, -1.65], [X, capBase, -1.65], [X, capBase, 1.65], [x, capBase, 1.65]);
    }
    quad([-6, capBase, -1.65], [-6, capBase, 1.65], [-6, 1.34, 1.65], [-6, 1.34, -1.65]);
    quad([6, capBase, 1.65], [6, capBase, -1.65], [6, 1.34, -1.65], [6, 1.34, 1.65]);
    const capGeometry = new T.BufferGeometry();
    capGeometry.setAttribute('position', new T.Float32BufferAttribute(capPositions, 3));
    capGeometry.attributes.position.setUsage(T.DynamicDrawUsage);
    const capOriginal = capGeometry.attributes.position.array.slice();
    capGeometry.computeVertexNormals();
    const roofCap = new T.Mesh(capGeometry, roofMat); roofCap.name = '局部垮落带上方的连续岩层';
    roofCap.castShadow = true; roofCap.receiveShadow = true; roofCap.frustumCulled = false; group.add(roofCap);

    // 少量破裂细块落在采空区底部，空间分层覆盖前侧、内部和背侧。
    const chipCount = 108;
    const chips = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), chipsMat, chipCount);
    chips.name = '局部垮落碎屑'; chips.castShadow = true; chips.receiveShadow = true;
    chips.instanceMatrix.setUsage(T.DynamicDrawUsage); chips.frustumCulled = false; group.add(chips);
    for (let i = 0; i < chipCount; i++) {
      chipData.push({ x: -4.78 + Math.floor(i / 6) * .39 + range(-.13, .13),
        z: -1.44 + (i % 6) * .575 + range(-.10, .10),
        sx: range(.035, .088), sy: range(.018, .046), sz: range(.035, .080),
        angle: range(0, Math.PI * 2), offset: range(0, .08) });
    }
    let stats = { localizedBlocks: 0, openedFractureCells: 0, visibleChips: 0, front: 0, back: 0, interior: 0, maxCrackWidth: 0 };
    const displacement = (x, index) => {
      const value = deflect(x, index, !state.treated);
      return Number.isFinite(value) ? value : 0;
    };
    function localMiningWeight(x) {
      // 始终在支护设备后方发生，避免碎块穿过工作面；左右边缘保留支承。
      return smooth(1.45, 2.20, state.face - x) * smooth(-5.25, -4.70, x) * (1 - smooth(2.10, 3.80, x));
    }
    function growth() {
      const beforeIntervention = .32 * smooth(.27, .51, state.progress);
      const afterIntervention = smooth(.54, .94, state.progress);
      return beforeIntervention + (state.treated ? .20 : .57) * afterIntervention;
    }
    function configureTransparency() {
      const active = state.interior;
      for (const material of [roofMat, fissureMat]) {
        const transparencyChanged = material.transparent !== active;
        material.transparent = active; material.opacity = active ? .32 : 1;
        material.depthWrite = !active; if (transparencyChanged) material.needsUpdate = true;
      }
      roofCap.castShadow = !active; fractured.castShadow = !active;
      roofCap.renderOrder = active ? 2 : 0; fractured.renderOrder = active ? 2 : 0;
    }
    function update(next = {}) {
      for (const key of ['progress', 'face']) if (Number.isFinite(next[key])) state[key] = next[key];
      state.progress = clamp(state.progress);
      for (const key of ['exaggeration', 'treated', 'interior']) if (typeof next[key] === 'boolean') state[key] = next[key];
      const visualGain = state.exaggeration ? 1 : .55;
      const development = growth();
      // 用与连续面相同的线性节点场约束整个块体，而不是只取中心位移。
      // 目标层主场景采用48段；这是绘图采样密度，不是地层物理参数。
      const fields = new Map();
      for (const index of [2, 3, 4, 5, 6]) {
        const count = index === 6 ? 48 : NX;
        const values = Array.from({ length: count + 1 }, (_, i) => displacement(-6 + 12 * i / count, index));
        fields.set(index, { count, values });
      }
      function fieldAt(x, index) {
        const field = fields.get(index), u = clamp((x + 6) / 12) * field.count;
        const i = Math.min(field.count - 1, Math.floor(u)), t = u - i;
        return field.values[i] * (1 - t) + field.values[i + 1] * t;
      }
      function fieldRange(left, right, index) {
        const field = fields.get(index);
        let min = Math.min(fieldAt(left, index), fieldAt(right, index));
        let max = Math.max(fieldAt(left, index), fieldAt(right, index));
        const first = Math.max(0, Math.ceil((left + 6) / 12 * field.count));
        const last = Math.min(field.count, Math.floor((right + 6) / 12 * field.count));
        for (let i = first; i <= last; i++) { min = Math.min(min, field.values[i]); max = Math.max(max, field.values[i]); }
        return { min, max };
      }
      stats = { localizedBlocks: 0, openedFractureCells: 0, visibleChips: 0, front: 0, back: 0, interior: 0, maxCrackWidth: 0 };
      const countDepth = z => { if (z > 1) stats.front++; else if (z < -1) stats.back++; else stats.interior++; };
      lowerData.forEach((d, i) => {
        const weight = localMiningWeight(d.x), broken = weight * development;
        const deflection = fieldAt(d.x, 2);
        const rx = d.tilt * broken * .15 * visualGain;
        const rz = d.yaw * broken * .20 * visualGain;
        let height = (capBase - .46) * (1 - broken * .045);
        const seam = .038 * broken * visualGain;
        const width = DX * (1 - seam), depth = DZ * (1 - seam * .65);
        const centerX = d.x + d.jitter * broken * .021;
        scratch.rotation.set(rx, d.yaw * broken * .13, rz);
        scratch.scale.set(1, 1, 1);
        scratch.updateMatrix();
        const projectedHalfX = () => (Math.abs(scratch.matrix.elements[0]) * width + Math.abs(scratch.matrix.elements[4]) * height + Math.abs(scratch.matrix.elements[8]) * depth) / 2;
        let halfX = projectedHalfX();
        let capBottom = capBase + fieldRange(centerX - halfX, centerX + halfX, 2).min;
        const boundaryMargin = Math.abs(deflection) > 1e-8 ? .000025 : 0;
        const ceilingMargin = .003 * broken + boundaryMargin;
        let availableHeight = capBottom - .018 - ceilingMargin;
        // 近底板净空较小时减少倾斜，确保碎块仍位于底板上方而非穿入底板。
        let halfY = (Math.abs(scratch.matrix.elements[1]) * width + Math.abs(scratch.matrix.elements[5]) * height + Math.abs(scratch.matrix.elements[9]) * depth) / 2;
        if (halfY * 2 > availableHeight) {
          const damping = clamp((availableHeight - height) / Math.max(.001, halfY * 2 - height));
          scratch.rotation.x *= damping; scratch.rotation.z *= damping; scratch.updateMatrix();
          halfY = (Math.abs(scratch.matrix.elements[1]) * width + Math.abs(scratch.matrix.elements[5]) * height + Math.abs(scratch.matrix.elements[9]) * depth) / 2;
          halfX = projectedHalfX();
          capBottom = capBase + fieldRange(centerX - halfX, centerX + halfX, 2).min;
        }
        availableHeight = capBottom - .018 - ceilingMargin;
        if (halfY * 2 > availableHeight) {
          height = Math.max(.04, (availableHeight - Math.abs(scratch.matrix.elements[1]) * width - Math.abs(scratch.matrix.elements[9]) * depth) / Math.abs(scratch.matrix.elements[5]));
          halfY = (Math.abs(scratch.matrix.elements[1]) * width + Math.abs(scratch.matrix.elements[5]) * height + Math.abs(scratch.matrix.elements[9]) * depth) / 2;
        }
        const centerBase = (.46 + capBase) / 2 + deflection;
        const minY = .018 + halfY, maxY = Math.max(minY, capBottom - halfY - ceilingMargin);
        const centerY = clamp(centerBase - d.drop * broken * visualGain, minY, maxY);
        scratch.position.set(centerX, centerY, d.z);
        scratch.scale.set(width, height, depth);
        scratch.updateMatrix(); lower.setMatrixAt(i, scratch.matrix);
        if (broken > .025) { stats.localizedBlocks++; countDepth(d.z); }
      });
      fractureData.forEach((d, i) => {
        const extent = localMiningWeight(d.x);
        // 向上逐渐减弱；目标岩层及更上方仍由主场景保持连续弯曲。
        const heightFactor = d.index === 3 ? 1 : d.index === 4 ? .82 : .60;
        const opened = extent * development * heightFactor;
        const width = .080 * opened * visualGain * d.seam;
        const dY = fieldAt(d.x, d.index);
        const slope = (fieldAt(d.x + .08, d.index) - fieldAt(d.x - .08, d.index)) / .16;
        const rotation = clamp(Math.atan(slope) * .7, -.18, .18);
        const cos = Math.cos(rotation), sin = Math.abs(Math.sin(rotation));
        const blockWidth = DX - Math.min(DX * .25, width);
        const originalHeight = d.top - d.bottom;
        // 先用原高度包络采样，之后只缩短高度；实际块体不会越过已检查的水平范围。
        const halfX = (Math.abs(cos) * blockWidth + sin * originalHeight) / 2;
        const left = d.x - halfX, right = d.x + halfX;
        const envelope = fieldRange(left, right, d.index);
        let allowedBottom = d.bottom + envelope.max;
        let allowedTop = d.top + envelope.min;
        if (d.index === 3) allowedBottom = Math.max(allowedBottom, 1.34 + fieldRange(left, right, 2).max);
        if (d.index === 5) allowedTop = Math.min(allowedTop, 3.65 + fieldRange(left, right, 6).min);
        const boundaryMargin = envelope.min < -1e-8 || envelope.max > 1e-8 ? .000025 : 0;
        const naturalHeight = originalHeight * (1 - .025 * opened);
        const fittedHeight = Math.min(naturalHeight, (allowedTop - allowedBottom - 2 * boundaryMargin - sin * blockWidth) / cos);
        const blockHeight = Math.max(.01, fittedHeight);
        const halfY = (sin * blockWidth + cos * blockHeight) / 2;
        const minimumCenter = allowedBottom + halfY + boundaryMargin, maximumCenter = allowedTop - halfY - boundaryMargin;
        const centerY = clamp((d.top + d.bottom) / 2 + dY, minimumCenter, Math.max(minimumCenter, maximumCenter));
        scratch.position.set(d.x, centerY, d.z);
        scratch.rotation.set(0, 0, rotation);
        scratch.scale.set(blockWidth, blockHeight, DZ - Math.min(DZ * .08, width * .52));
        scratch.updateMatrix(); fractured.setMatrixAt(i, scratch.matrix);
        if (opened > .025) stats.openedFractureCells++;
        stats.maxCrackWidth = Math.max(stats.maxCrackWidth, width);
      });
      const capArray = capGeometry.attributes.position.array;
      for (let i = 0; i < capArray.length; i += 3) capArray[i + 1] = capOriginal[i + 1] + fieldAt(capOriginal[i], 2);
      capGeometry.attributes.position.needsUpdate = true;
      capGeometry.computeVertexNormals();
      chipData.forEach((d, i) => {
        const amount = localMiningWeight(d.x) * development * smooth(.30, .57, state.progress);
        scratch.rotation.set(0, d.angle, 0);
        scratch.position.set(d.x, .020 + d.sy * amount, d.z);
        scratch.scale.set(d.sx * amount, d.sy * amount, d.sz * amount);
        scratch.updateMatrix(); chips.setMatrixAt(i, scratch.matrix);
        if (amount > .02) stats.visibleChips++;
      });
      chips.visible = stats.visibleChips > 0;
      for (const mesh of [lower, fractured, chips]) {
        mesh.instanceMatrix.needsUpdate = true;
      }
      configureTransparency();
      return { ...stats };
    }
    function getAnchors() {
      const x = clamp(state.face - 2.0, -4.4, -1.7);
      return {
        caving: [x, .68 + displacement(x, 2), 1.70],
        fractured: [x, 2.30 + displacement(x, 4), 1.70],
        bending: [x, 5.78 + displacement(x, 8), 1.70]
      };
    }
    function diagnostics() {
      return { ...state, replacementLayerIndices: [...replacementLayerIndices],
        instanceCounts: { lowerRoof: lowerData.length, fracturedRock: fractureData.length, chips: chipCount },
        drawCalls: 4, modelDepth: [-1.65, 1.65], ...stats, deterministic: true,
        zoneMeaning: { caving: '近顶板局部块体转动、下落和少量碎屑', fractured: '下部岩层真实三维块间开裂', bending: '目标层及上覆连续弯曲由主场景绘制' },
        caveat: '三带分区为定性展示，不代表三带实际高度；启动前仅近顶板有限局部垮落，目标层不作大范围垮落。' };
    }
    // 不在构造时调用 deflect：主场景可能尚未初始化 face 等词法状态。
    return { group, update, getAnchors, diagnostics, replacementLayerIndices };
  };
})();
