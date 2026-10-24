/* 跨模型厚度的开采设备与有限碎裂示意。仅作可视化，不定义设备工程参数。 */
(() => {
  'use strict';

  window.createMiningVolume = function createMiningVolume({ THREE: T, parent, materials = {}, clearanceAt }) {
    if (!T || !parent) throw new Error('createMiningVolume 需要 THREE 和 parent');
    const group = new T.Group();
    group.name = '完整厚度开采系统';
    parent.add(group);
    const machine = new T.Group();
    machine.name = '跨厚度输送机与采煤支护组件';
    group.add(machine);
    const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
    const smooth = (a, b, v) => { const s = clamp((v - a) / (b - a)); return s * s * (3 - 2 * s); };
    const fallback = (key, color, metalness, roughness) => materials[key] || new T.MeshStandardMaterial({ color, metalness, roughness });
    const mat = {
      dark: fallback('dark', '#263c43', .4, .5),
      yellow: fallback('yellow', '#d6a336', .3, .48),
      steel: fallback('metal', '#a6b3b9', .8, .28),
      light: fallback('light', '#e5eceb', .1, .6),
      rubber: new T.MeshStandardMaterial({ color: '#17272c', roughness: .88 }),
      rock: new T.MeshStandardMaterial({ color: '#a69a86', roughness: 1 }),
      coal: fallback('coal', '#30363b', 0, 1)
    };
    const cube = new T.BoxGeometry(1, 1, 1);
    const cylinder = new T.CylinderGeometry(1, 1, 1, 12);
    const unitY = new T.Vector3(0, 1, 0);
    const scratch = new T.Object3D();
    const staticBatches = new Map();
    let staticInstanceCount = 0;
    function record(geometry, material, transform) {
      const key = geometry.uuid + ':' + material.uuid;
      if (!staticBatches.has(key)) staticBatches.set(key, { geometry, material, matrices: [] });
      staticBatches.get(key).matrices.push(transform.clone());
    }
    function block(w, h, d, material, x, y, z, rz = 0) {
      scratch.position.set(x, y, z);
      scratch.rotation.set(0, 0, rz);
      scratch.scale.set(w, h, d);
      scratch.updateMatrix();
      record(cube, material, scratch.matrix);
    }
    function strut(a, b, radius, material) {
      const A = new T.Vector3(...a), B = new T.Vector3(...b), axis = B.clone().sub(A);
      scratch.position.copy(A).add(B).multiplyScalar(.5);
      scratch.quaternion.setFromUnitVectors(unitY, axis.clone().normalize());
      scratch.scale.set(radius, axis.length(), radius);
      scratch.updateMatrix();
      record(cylinder, material, scratch.matrix);
    }

    // 跨厚度刮板输送槽：槽底、两条侧梁、链道连续贯通，端部略露出剖切面。
    const conveyorDepth = 3.60;
    block(.44, .027, conveyorDepth, mat.dark, -.11, .035, 0);
    block(.027, .077, conveyorDepth, mat.steel, -.318, .075, 0);
    block(.027, .077, conveyorDepth, mat.steel, .098, .075, 0);
    for (const x of [-.23, .012]) block(.018, .014, 3.52, mat.rubber, x, .062, 0);
    for (let j = 0; j < 10; j++) {
      const z = -1.62 + j * .36;
      block(.39, .014, .055, mat.dark, -.11, .018, z);
      block(.026, .012, .022, mat.steel, -.318, .118, z);
      block(.026, .012, .022, mat.steel, .098, .118, z);
    }

    // 八个支架沿工作面厚度排列，每架具有底座、双液压立柱、顶梁与后掩护梁。
    const supportCount = 8;
    for (let j = 0; j < supportCount; j++) {
      const z = -1.54 + j * .44;
      block(.62, .035, .392, mat.dark, -.65, .034, z);
      block(.67, .030, .420, mat.yellow, -.645, .411, z);
      block(.56, .020, .344, mat.dark, -.65, .388, z);
      block(.045, .295, .352, mat.dark, -.955, .233, z, -.19);
      block(.044, .025, .28, mat.steel, -.915, .374, z);
      for (const x of [-.79, -.48]) {
        strut([x, .065, z], [x, .267, z], .037, mat.dark);
        strut([x, .224, z], [x, .383, z], .022, mat.steel);
        strut([x, .073, z - .036], [x, .073, z + .036], .044, mat.steel);
        strut([x, .374, z - .045], [x, .374, z + .045], .033, mat.dark);
      }
      strut([-.91, .080, z], [-.72, .371, z], .018, mat.steel);
      block(.10, .049, .088, mat.yellow, -.80, .116, z + .13);
      block(.13, .016, .018, mat.light, -.64, .429, z);
    }

    // 主机机身和内部传动跨全厚度布置，前后端均有真实的驱动组件。
    block(.29, .144, 3.20, mat.yellow, -.12, .224, 0);
    block(.31, .024, 3.23, mat.dark, -.12, .140, 0);
    block(.23, .027, 3.10, mat.dark, -.12, .308, 0);
    strut([.125, .248, -1.78], [.125, .248, 1.78], .051, mat.steel);
    for (const z of [-1.10, 0, 1.10]) {
      block(.16, .137, .135, mat.dark, -.005, .246, z);
      block(.087, .067, .19, mat.steel, -.21, .226, z);
      block(.025, .038, .092, mat.light, -.272, .243, z);
    }
    for (const side of [-1, 1]) {
      const z = side * 1.755;
      block(.37, .170, .225, mat.yellow, -.13, .226, z);
      block(.34, .030, .247, mat.dark, -.13, .125, z);
      block(.21, .022, .15, mat.dark, -.14, .323, z);
      strut([.125, .248, side * 1.68], [.125, .248, side * 1.862], .105, mat.dark);
      strut([.125, .248, side * 1.83], [.125, .248, side * 1.873], .056, mat.steel);
      block(.16, .039, .012, mat.light, -.13, .244, side * 1.873);
      // 两端齿轮箱检修面和螺栓，正反剖面皆可辨认。
      for (const x of [-.26, -.015]) {
        for (const y of [.171, .284]) {
          strut([x, y, side * 1.858], [x, y, side * 1.880], .012, mat.steel);
        }
      }
    }
    for (const batch of staticBatches.values()) {
      const mesh = new T.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
      mesh.name = '共享几何静态设备组件';
      batch.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      machine.add(mesh);
      staticInstanceCount += batch.matrices.length;
    }

    // 三段滚筒相连覆盖内部和两端，不是在正背面放两套薄壳。
    const drums = [];
    const drumCoreGeometry = new T.CylinderGeometry(.106, .106, 1.042, 18);
    drumCoreGeometry.rotateX(Math.PI / 2);
    const drumRingGeometry = new T.CylinderGeometry(.124, .124, .027, 18);
    drumRingGeometry.rotateX(Math.PI / 2);
    for (let j = 0; j < 3; j++) {
      const drum = new T.Group();
      drum.name = '全厚度滚筒段_' + (j + 1);
      drum.position.set(.125, .248, -1.10 + j * 1.10);
      const core = new T.Mesh(drumCoreGeometry, mat.dark);
      core.castShadow = true; core.receiveShadow = true; drum.add(core);
      for (const z of [-.47, .47]) {
        const ring = new T.Mesh(drumRingGeometry, mat.yellow);
        ring.position.z = z; ring.castShadow = true; drum.add(ring);
      }
      const teeth = new T.InstancedMesh(cube, mat.steel, 36);
      teeth.name = '螺旋排列截齿';
      let index = 0;
      for (let row = 0; row < 3; row++) {
        for (let k = 0; k < 12; k++) {
          const angle = k * Math.PI / 6 + row * .28;
          scratch.position.set(Math.cos(angle) * .143, Math.sin(angle) * .143, -.355 + row * .355);
          scratch.rotation.set(0, 0, angle);
          scratch.scale.set(.043, .034, .073);
          scratch.updateMatrix(); teeth.setMatrixAt(index++, scratch.matrix);
        }
      }
      teeth.instanceMatrix.needsUpdate = true;
      teeth.castShadow = true; teeth.receiveShadow = true;
      teeth.computeBoundingBox(); teeth.computeBoundingSphere(); drum.add(teeth);
      machine.add(drum); drums.push(drum);
    }

    const slatCount = 22;
    const slats = new T.InstancedMesh(cube, mat.steel, slatCount);
    slats.name = '输送槽跨厚度运动刮板';
    slats.instanceMatrix.setUsage(T.DynamicDrawUsage);
    slats.castShadow = true; slats.receiveShadow = true; machine.add(slats);

    // 稀疏碎块使用固定世界坐标，并在完整 z 厚度分层采样；不会将采空区填满。
    let randomSeed = 20261021;
    function rng() { randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0; return randomSeed / 4294967296; }
    const rubbleData = [];
    const rubbleCount = 144;
    const rubbleGeometry = new T.IcosahedronGeometry(1, 0);
    const rubble = new T.InstancedMesh(rubbleGeometry, mat.rock, rubbleCount);
    rubble.name = '全厚度稀疏有限碎裂';
    rubble.instanceMatrix.setUsage(T.DynamicDrawUsage);
    rubble.castShadow = true; rubble.receiveShadow = true;
    group.add(rubble);
    for (let i = 0; i < rubbleCount; i++) {
      const row = i % 8, column = Math.floor(i / 8);
      const x = -4.88 + column * .48 + (rng() - .5) * .31;
      const z = -1.48 + row * .423 + (rng() - .5) * .19;
      const sx = .050 + rng() * .071, sy = .028 + rng() * .036, sz = .042 + rng() * .051;
      rubbleData.push({ x, z, sx, sy, sz, rx: rng() * .8, ry: rng() * Math.PI, rz: rng() * .6, phase: rng() });
      rubble.setColorAt(i, new T.Color(i % 5 === 0 ? '#434545' : i % 3 === 0 ? '#918776' : '#b4a58c'));
    }
    rubble.instanceColor.needsUpdate = true;
    const current = { face: -4.8, progress: 0, time: 0, visibleRubble: 0, frontRubble: 0, backRubble: 0, internalRubble: 0 };
    function update({ face = current.face, progress = current.progress, time = current.time } = {}) {
      current.face = Number.isFinite(face) ? face : current.face;
      current.progress = clamp(Number.isFinite(progress) ? progress : current.progress);
      current.time = Number.isFinite(time) ? time : current.time;
      group.position.x = current.face;
      // 姿态直接从进度计算：拖回同一进度必定回到同一帧，暂停时没有独立墙钟动画。
      const cuttingProgress = clamp((current.progress - .12) / .68);
      const angle = cuttingProgress * 168;
      drums.forEach((drum, index) => { drum.rotation.z = angle + index * .22; });
      const travel = cuttingProgress * 19.8;
      const pitch = 3.48 / slatCount;
      for (let i = 0; i < slatCount; i++) {
        const z = -1.74 + ((i * pitch + travel) % 3.48);
        scratch.position.set(-.11, .077, z);
        scratch.rotation.set(0, 0, 0);
        scratch.scale.set(.35, .021, .024);
        scratch.updateMatrix(); slats.setMatrixAt(i, scratch.matrix);
      }
      slats.instanceMatrix.needsUpdate = true;
      slats.computeBoundingBox(); slats.computeBoundingSphere();
      current.visibleRubble = 0; current.frontRubble = 0; current.backRubble = 0; current.internalRubble = 0;
      const fractureGrowth = smooth(.25, .40, current.progress);
      rubbleData.forEach((piece, index) => {
        const cleared = smooth(1.23, 1.66, current.face - piece.x);
        const amount = fractureGrowth * cleared;
        if (amount > .02) {
          current.visibleRubble++;
          if (piece.z > 1) current.frontRubble++;
          else if (piece.z < -1) current.backRubble++;
          else current.internalRubble++;
        }
        const extent=Math.max(piece.sx,piece.sy,piece.sz)*amount;
        const fit=amount>.001&&clearanceAt?Math.min(1,Math.max(0,clearanceAt(piece.x,piece.z)-.008)/(2*extent)):1;
        scratch.position.set(piece.x - current.face, .004 + extent*fit, piece.z);
        scratch.rotation.set(piece.rx, piece.ry, piece.rz);
        scratch.scale.set(piece.sx * amount*fit, piece.sy * amount*fit, piece.sz * amount*fit);
        scratch.updateMatrix(); rubble.setMatrixAt(index, scratch.matrix);
      });
      rubble.instanceMatrix.needsUpdate = true;
      rubble.visible = current.visibleRubble > 0;
      rubble.computeBoundingBox(); rubble.computeBoundingSphere();
      group.updateMatrixWorld(true);
    }

    function diagnostics() {
      // 逐顶点核对真实几何边界，避免旋转后的包围盒被再次放大而误报穿层。
      const bounds = new T.Box3();
      const point = new T.Vector3(), transform = new T.Matrix4(), instance = new T.Matrix4();
      machine.updateWorldMatrix(true, true);
      machine.traverse(object => {
        if (!object.isMesh || !object.geometry.attributes.position) return;
        const positions = object.geometry.attributes.position;
        const count = object.isInstancedMesh ? object.count : 1;
        for (let i = 0; i < count; i++) {
          if (object.isInstancedMesh) { object.getMatrixAt(i, instance); transform.multiplyMatrices(object.matrixWorld, instance); }
          else transform.copy(object.matrixWorld);
          for (let vertex = 0; vertex < positions.count; vertex++) {
            point.fromBufferAttribute(positions, vertex).applyMatrix4(transform); bounds.expandByPoint(point);
          }
        }
      });
      const localMinX = bounds.min.x - current.face, localMaxX = bounds.max.x - current.face;
      return {
        name: '全厚度开采与有限碎裂',
        coordinateSystem: { advance: 'x', vertical: 'y', thickness: 'z' },
        face: current.face, progress: current.progress, time: current.time,
        machineCount: 1, drumCount: drums.length, driveEndCount: 2, supportCount,
        conveyorDepth, depthBounds: { min: bounds.min.z, max: bounds.max.z },
        machineLocalBounds: { min: [localMinX, bounds.min.y, bounds.min.z], max: [localMaxX, bounds.max.y, bounds.max.z] },
        minimumInitialOpening: { minX: -4.8 + localMinX, maxX: -4.8 + localMaxX },
        staticInstanceCount, staticDrawBatches: staticBatches.size,
        rubble: {
          total: rubbleCount, visible: current.visibleRubble,
          front: current.frontRubble, back: current.backRubble, interior: current.internalRubble,
          depthBounds: { min: Math.min(...rubbleData.map(p => p.z - p.sz)), max: Math.max(...rubbleData.map(p => p.z + p.sz)) },
          keepsOpenVoid: true, deterministic: true,
          description: '固定世界位置的稀疏碎块；设备通过后渐显；非大范围垮落或采空区充填'
        },
        animation: '位置、截齿与刮板姿态均由进度确定；时间仅记录输入，暂停与回退无累计漂移'
      };
    }
    update({ face: -4.8, progress: 0, time: 0 });
    return { group, update, diagnostics };
  };
})();
