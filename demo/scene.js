/* 智能注浆原理演示 v0.3 — 覆岩三带、同步对照；所有变形为定性可视化。 */
(() => {
  'use strict';
  const T = window.THREE;
  const canvas = document.getElementById('scene-canvas');
  const labelRoot = document.getElementById('scene-labels');
  // ==== v0.6 S0 基准层：唯一定值来源 data/geology.js + geometry.js ====
  // 本文件不再出现任何地层厚度、倾角、地表标高的字面量；一律经 G 取值。
  const G = window.__GEO__;
  if(!G||!G.SLOPE) throw new Error('v0.6: geometry.js 未加载，禁止启动场景');
  const D_ = window.MINE_DATA;
  const S_M = G.S, SLOPE_ = G.SLOPE, Z_HALF = G.zHalf;
  const M_U = G.coalTop;            // 采高(M/S)
  const SURF_Y0 = G.surfY0;         // 煤顶到地表(H0/S)
  const LIFT = G.yBase(0);          // 剪切基准：z=0 处抬升量
  const YB = G.yBase;               // yBase(z)：剪切基准面
  if (!T || !canvas || !labelRoot) throw new Error('三维场景所需组件未就绪');
  const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
  const smooth = (a,b,x) => { const v=clamp((x-a)/(b-a)); return v*v*(3-2*v); };
  const mix = (a,b,t) => a+(b-a)*t;
  const stages = [
    {at:0, title:'结构与监测布置', text:'井下巷道向上布置监测杆，到达煤层上方'+(D_.literature.zones.bending.monitorTargetM||50)+'米处的目标岩层。地面注浆管单独布置。', camera:'overview'},
    {at:.12, title:'自动开采推进', text:'工作面自动推进，后方形成采空区；监测装置持续观察目标岩层的响应。', camera:'mining'},
    {at:.30, title:'覆岩三带与离层发展', text:'近顶板出现局部垮落，其上裂隙与离层发展，再向上呈整体弯曲下沉。三带随开采推进，目标层尚未发生大范围垮落。', camera:'zones'},
    {at:.45, title:'杆件应变触发研判', text:'金属杆随岩层运动而变形，应变片输出发生变化。应变与位移的对应关系、触发阈值仍待标定。', camera:'sensor'},
    {at:.54, title:'浆液流入与空间扩散', text:'浆液由独立管路进入候选离层，从出口向周围扩散，沿缝隙逐渐积聚。切换背面可检查模型厚度方向的填充。', camera:'grout'},
    {at:.72, title:'反馈调节与减量', text:'持续观察位移响应，并调节注浆过程。压力、流量和位移曲线均为归一化演示数据。', camera:'grout'},
    {at:.90, title:'停泵、凝固与整体观察', text:'停泵后，浆体表面流动逐渐消退，并转为凝固后的粗糙外观。凝固时间经压缩；实际材料与凝结时间仍待确定。', camera:'grout'}
  ];
  function sample(p) {
    p=clamp(p);
    let stageIndex=0;
    stages.forEach((s,i)=>{if(p>=s.at)stageIndex=i;});
    // 两种示意情形在注浆开始前共用同一响应，干预后才分开。
    const common=.44*smooth(.18,.50,p);
    const untreated=common+.52*smooth(.54,.92,p);
    const settlement=common+.12*smooth(.54,.73,p)+.025*smooth(.73,.90,p);
    const strain=.04+settlement*.90;
    const untreatedStrain=.04+untreated*.90;
    const rise=smooth(.54,.61,p);
    const taper=1-smooth(.78,.90,p);
    const pumpOn=p>=.54&&p<.90;
    const flow=rise*taper*(.68+.055*Math.sin(p*68));
    const pressure=rise*(.70+.065*Math.sin(p*45))*(1-smooth(.80,.98,p));
    return {progress:p,stageIndex,stageTitle:stages[stageIndex].title,stageText:stages[stageIndex].text,
      triggered:p>=.45,pumpOn,metrics:{settlement,untreated,strain,untreatedStrain,flow:Math.max(0,flow),pressure:Math.max(0,pressure)}};
  }
  const state={...sample(0),playing:false,speed:1,mode:'lab',camera:'overview',
    options:{comparison:true,labels:true,exaggeration:true,autoCamera:true,interior:false}};
  const scene = new T.Scene();
  scene.background=new T.Color('#e9eef0');
  scene.fog=new T.Fog('#e9eef0',30,65);
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
renderer.localClippingEnabled=true;   // v0.6 S1：lanes 剖切机位需要局部裁剪
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.2;
  // 大面积柔光在湿浆表面形成连续反光，便于区别流动湿浆与凝固表面。
  const lightRoom=new T.Scene();lightRoom.background=new T.Color('#777f84');
  for(const item of [{p:[-4,9,3],s:[8,2,5],v:3.2},{p:[6,4,-4],s:[2,5,5],v:1.8}]){
    const panel=new T.Mesh(new T.BoxGeometry(...item.s),new T.MeshBasicMaterial({color:new T.Color(item.v,item.v,item.v)}));
    panel.position.set(...item.p);lightRoom.add(panel);
  }
  const pmrem=new T.PMREMGenerator(renderer),roomLight=pmrem.fromScene(lightRoom,.05);
  scene.environment=roomLight.texture;pmrem.dispose();
  lightRoom.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
  const camera=new T.PerspectiveCamera(37,1,.05,150);
  const hemi=new T.HemisphereLight('#e9f4ff','#8c7664',2.1);scene.add(hemi);
  const key=new T.DirectionalLight('#fff4df',3.0);key.position.set(-8,16,12);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-13;key.shadow.camera.right=13;
  key.shadow.camera.top=13;key.shadow.camera.bottom=-13;key.shadow.normalBias=.04;scene.add(key);
  const fill=new T.DirectionalLight('#d0efff',1.5);fill.position.set(10,7,-6);scene.add(fill);
  const world=new T.Group();scene.add(world);
  if(typeof window!=='undefined'){window.__SCENE__=scene;window.__WORLD__=world;window.__CAMERA__=camera;}
  /* ==== v0.6 S0 基准剪切 =====================================
   * 地层一律以「数据局部坐标」建模（yL = (yD+M)/S，z ∈ ±zHalf），
   * 再由 strata 组的线性矩阵统一叠加剪切：
   *     yW = yL + SLOPE·z + LIFT ,  LIFT = SLOPE·zHalf
   * 即 yW = yBase(z) + yL（与 geometry.js 的 yFromData 完全一致）。
   * 只有本矩阵允许出现倾角；任何几何不允许再裸写 SLOPE·z。
   * 剪切是线性变换，可写成仿射矩阵（m[6]=SLOPE，m[14]=LIFT），
   * 因此组内子物体（含 vendor 生成的三带/采空/浆液）自动继承，无需逐个改。
   */
  const strata=new T.Group();strata.name='剪切地层（'+G.DIP_DEG+'°）';world.add(strata);
  strata.matrixAutoUpdate=false;
  strata.matrix.set(
    1,0,0,0,
    0,1,SLOPE_,G.yBase(0),
    0,0,1,0,
    0,0,0,1
  );
  strata.matrixWorldNeedsUpdate=true;
  const lab=new T.Group(), mine=new T.Group();world.add(lab,mine);mine.visible=false;
  const mats={
    metal:new T.MeshStandardMaterial({color:'#a6b3b9',metalness:.8,roughness:.28}),
    dark:new T.MeshStandardMaterial({color:'#263c43',metalness:.4,roughness:.5}),
    yellow:new T.MeshStandardMaterial({color:'#e3aa36',metalness:.25,roughness:.5}),
    teal:new T.MeshStandardMaterial({color:'#178a7d',metalness:.2,roughness:.4}),
    pipe:new T.MeshStandardMaterial({color:'#d78737',metalness:.4,roughness:.4}),
    grout:new T.MeshStandardMaterial({color:'#53b5a5',emissive:'#237d70',emissiveIntensity:.38,roughness:.85,side:T.DoubleSide}),
    light:new T.MeshStandardMaterial({color:'#e5eceb',roughness:.6}),
    coal:new T.MeshStandardMaterial({color:'#30363b',roughness:1}),
    glass:new T.MeshPhysicalMaterial({color:'#c5e4ee',transparent:true,opacity:.085,roughness:.15,metalness:.1,depthWrite:false,side:T.DoubleSide}),
    // v0.7 顶盖玻璃：侧面玻璃保持 .085 的几乎"隐形"，顶盖需要能读出"一块玻璃面"
    // （泵站靠它承载），故单列一种材料，不透明度提到 .16；仍 depthWrite:false，不遮挡顶面设备。
    glassTop:new T.MeshPhysicalMaterial({color:'#cfe6ee',transparent:true,opacity:.16,roughness:.10,metalness:.12,depthWrite:false,side:T.DoubleSide})
  };
  function box(w,h,d,mat,x,y,z,parent=world) {
    const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const unitY=new T.Vector3(0,1,0);
  function link(a,b,r,mat,parent=world,segments=12){
    const A=new T.Vector3(...a),B=new T.Vector3(...b),v=B.clone().sub(A);
    const m=new T.Mesh(new T.CylinderGeometry(r,r,v.length(),segments),mat);
    m.position.copy(A).add(B).multiplyScalar(.5);m.quaternion.setFromUnitVectors(unitY,v.normalize());
    m.castShadow=true;parent.add(m);return m;
  }
  function line(points,color,parent=world,dashed=false){
    const geo=new T.BufferGeometry().setFromPoints(points.map(v=>new T.Vector3(...v)));
    const mat=dashed?new T.LineDashedMaterial({color,dashSize:.12,gapSize:.08}):new T.LineBasicMaterial({color});
    const o=new T.Line(geo,mat);if(dashed)o.computeLineDistances();parent.add(o);return o;
  }
  function replaceLine(obj,points){
    const attr=obj.geometry.attributes.position;
    if(attr&&attr.count===points.length){
      for(let i=0;i<points.length;i++)attr.setXYZ(i,...points[i]);
      attr.needsUpdate=true;
    }else obj.geometry.setFromPoints(points.map(v=>new T.Vector3(...v)));
    obj.geometry.computeBoundingSphere();
    if(obj.material.isLineDashedMaterial)obj.computeLineDistances();
  }
  let seed=13;
  const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  function rockTex(color){
    const c=document.createElement('canvas');c.width=384;c.height=128;const q=c.getContext('2d');
    q.fillStyle=color;q.fillRect(0,0,c.width,c.height);
    for(let i=0;i<3500;i++){
      q.fillStyle=rand()>.5?'rgba(255,255,255,.10)':'rgba(32,24,20,.09)';
      q.fillRect(rand()*384,rand()*128,rand()*3+1,rand()*2+1);
    }
    for(let i=0;i<20;i++){
      const y=rand()*128;q.strokeStyle='rgba(36,29,23,.10)';q.lineWidth=.5+rand();q.beginPath();q.moveTo(0,y);
      for(let x=0;x<=384;x+=24)q.lineTo(x,y+Math.sin(x*.04+i)*2);q.stroke();
    }
    const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=4;return tex;
  }
  // 岩层序列全部由 data/geology.js 的 literature.strata 生成（局部坐标 = (yD+M)/S，
  // 与 geometry.js 的 yFromData 同式；组矩阵再叠加 y += SLOPE*z + LIFT 完成剪切）。
  // idx 语义与 factors[]、三带模块、地表蒙皮绑定，改动前必须同步三处。
  const U = m => m / S_M + M_U;
  const BD = .55;                       // 底板示意层厚（单位）：仅为箱底留白，不参与任何地层断言
  const SL = D_.literature.strata, TOP = SL[SL.length - 1], LITH = D_.literature.lith;
  const layers = [
    { a: -BD, b: 0, c: LITH.conglomerate.color, name: '底板' },
    { a: -M_U, b: 0, c: LITH.coal.color, name: '4# 煤层' },
    ...SL.slice(0, -1).map(s => ({ a: U(s.from), b: U(s.to), c: s.lith.color, name: s.id + ' ' + s.lith.name })),
    { a: U(TOP.from), b: U(145), c: TOP.lith.color, name: TOP.id + ' ' + TOP.lith.name + '(88~145 m)' },
    { a: U(145), b: U(TOP.to), c: TOP.lith.color, name: '地表段(145~150 m)' }
  ];
  const SURF_U = U(TOP.to);             // 地表局部标高（单位）
  const ZON = D_.literature.zones;      // 三带标高（S3 与关键层对齐的唯一来源）
  const layerMeshes=[];
  const Z0 = -Z_HALF, Z1 = Z_HALF, ZD = 2 * Z_HALF;
  function layerGeometry(a,b){
    const positions=[],uv=[];const n=48;
    function tri(v1,v2,v3){const flat=v1[1]===v2[1]&&v2[1]===v3[1];for(const v of[v1,v2,v3]){positions.push(...v);uv.push((v[0]+6)/4,flat?(v[2]-Z0)/ZD:(v[1]-a)/(b-a));}}
    function quad(a,b,c,d){tri(a,b,c);tri(a,c,d);}
    for(let j=0;j<n;j++){
      const x=-6+j*12/n,X=x+12/n;
      quad([x,a,Z1],[X,a,Z1],[X,b,Z1],[x,b,Z1]);
      quad([X,a,Z0],[x,a,Z0],[x,b,Z0],[X,b,Z0]);
      const nz=a>=5.5?18:Math.max(1,Math.round(ZD/.55));
      for(let k=0;k<nz;k++){
        const z=Z0+k*ZD/nz,Z=z+ZD/nz;
        quad([x,b,Z],[X,b,Z],[X,b,z],[x,b,z]);
        quad([x,a,z],[X,a,z],[X,a,Z],[x,a,Z]);
      }
    }
    quad([-6,a,Z0],[-6,a,Z1],[-6,b,Z1],[-6,b,Z0]);
    quad([6,a,Z1],[6,a,Z0],[6,b,Z0],[6,b,Z1]);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
  }
  layers.forEach((d,i)=>{
    if(i===1)return;
    const g=layerGeometry(d.a,d.b),mat=new T.MeshStandardMaterial({map:rockTex(d.c),roughness:.94,metalness:0,side:T.DoubleSide});
    if(i===9){g.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(1),3));mat.vertexColors=true;}
    const m=new T.Mesh(g,mat);m.receiveShadow=true;m.castShadow=true;strata.add(m);
    layerMeshes.push({m,idx:i,base:g.attributes.position.array.slice()});
  });
  /* ==== v0.6 S1 错层位双巷定位（必须早于煤层生成——煤层要为巷道留缺口）====
   * 依据：wang2024 §3.1（1411 进风巷沿煤层顶板、回风巷沿煤层底板）
   *       + 王志强 2013 :847-849（端部起坡段，逐节抬溜累计 12°~15°）。
   *       v0.9：三角底煤沿倾向 22.5 m（4.5 平段 + 18 斜边 → 12.53°），沿走向全长；见 docs/v9_三角底煤修正.md。
   * 走向 x：切眼在 xFace（箱体 -x 侧），推进朝 +x；左侧 [boxX0, xFace] 保留完整
   *         煤层作对比（未采动区 22.15 m），不画煤柱。
   * 倾向 z：进风巷贴 -zHalf 端头、回风巷贴 +zHalf 端头，两巷相距一个面长 142 m。
   * 断面：4.5 m × 2.2 m 真实值，一律不放大（G3/G3w 断言对象）。
   * 巷道是煤层中的负空间：煤体留缺口 + 缺口内壁着色（BackSide 盒）+ 断面轮廓线，
   *         禁止再用 BoxGeometry 实体黑盒冒充巷道（m00851/m00882 指出的错误）。
   */
  const S1X0=G.xFace, S1X1=G.boxX1;              // 切眼 x / 箱体 +x 端
  const LW=G.LANE_W, LH=G.LANE_H;                 // 真实断面（不放大）
  const LANE_TOP_Y0=G.laneTopLocal;               // 贴顶巷底面 = coalTop − LH
  const Z_IN0=G.zLaneIn0, Z_IN1=G.zLaneIn1;       // 进风巷 z 带（-zHalf 端头）
  const Z_RT0=G.zLaneRet0, Z_RT1=G.zLaneRet1;     // 回风巷 z 带（+zHalf 端头）
  const X_CUT0=G.xFace, X_CUT1=G.xCutEnd;         // 切眼 x 带（宽 4.5 m）
  // v0.9：三角底煤沿倾向（z）布置，起点 = 进风巷外帮、尖灭点 = 内帮往工作面 18 m。
  const RAMP_Z0=G.rampZ0, RAMP_Z1=G.rampZ1, RAMP_Z_SLOPE0=G.rampZSlope0;
  const coal=[], coalRamp=[], coalPillar=[];
  /* 煤层分块生成：巷道所处位置不生成煤，形成真实缺口（"空"由煤的缺席给出）。
   * 分类决定"采空后是否消失"：
   *   'mining' 工作面内部，含两端头巷道煤带——综放一次采全高，采过后全厚消失
   *   'pillar' 非采动煤体（v0.8 起只保留给"确实没采"的煤；当前无实例，数组留作扩展）
   *   'ramp'   三角底煤（工艺丢煤）——不在采高范围内，工作面推过后留在采空区底板上，永久保留
   * v0.9 依据：王志强 2014 图3 / 2024 §3.1（进风巷沿顶板）、赵景礼 2004（曲边三角煤损）、
   *   王志强 2026 式(1)（溜槽逐节抬升）。三角煤沿倾向 22.5 m、最大厚 4.0 m、沿走向全长。
   */
  function coalBox(y0,y1,x0,x1,z0,z1,cls){
    if(y1-y0<1e-3||x1-x0<1e-3||z1-z0<1e-3) return null;
    const m=box(x1-x0,y1-y0,z1-z0,mats.coal,(x0+x1)/2,(y0+y1)/2,(z0+z1)/2,strata);
    (cls==='ramp'?coalRamp:cls==='pillar'?coalPillar:coal).push(m); return m;
  }
  // A 未采动区：切眼左侧完整煤层（全厚全幅，与采空区形成对照）
  coalBox(0,M_U,G.boxX0,X_CUT0,Z_IN0,Z_RT1);
  // B 切眼：整高贯通、不放煤（空腔由下方 cavity() 表达）
  // C 采空区（走向全长）：倾向分带——
  //   ①进风巷下平段（满厚 4.0，永久）②斜边带（18 m 内 4.0→0，永久）
  //   ③工作面其余（贴底采全高，采动消失）④回风巷上方煤带（采动消失）
  const NSEG=96, dxSeg=(S1X1-X_CUT1)/NSEG;
  const RAMP_NR=G.rampDrawSegments, dzRamp=(RAMP_Z1-RAMP_Z_SLOPE0)/RAMP_NR;
  for(let i=0;i<NSEG;i++){
    const x0=X_CUT1+i*dxSeg, x1=x0+dxSeg;
    coalBox(0,LANE_TOP_Y0,x0,x1,Z_IN0,Z_IN1,'ramp');   // ① 进风巷正下方满厚平段（永久）
    for(let j=0;j<RAMP_NR;j++){                        // ② 斜边带：倾向 18 m 内 4.0→0（永久）
      const z0=RAMP_Z_SLOPE0+j*dzRamp, z1=z0+dzRamp;
      const thick=G.rampRiseU*(1-(j+0.5)/RAMP_NR);
      coalBox(0,thick,x0,x1,z0,z1,'ramp');
    }
    coalBox(0,M_U,x0,x1,RAMP_Z1+1e-3,Z_RT0);           // ③ 工作面其余：贴底采全高（采动消失）
    coalBox(LH,M_U,x0,x1,Z_RT0,Z_RT1);                 // ④ 回风巷上方煤带：2.2~6.2 m（采动消失）
  }
  const miningVolume=window.createMiningVolume({THREE:T,parent:strata,materials:mats,
    clearanceAt:(x,z)=>M_U+deflect(x,2)});
  const workface=miningVolume.group;
  const zones=window.createOverburdenZones({THREE:T,parent:strata,deflect});
  layerMeshes.forEach(o=>{if(zones.replacementLayerIndices.includes(o.idx))o.m.visible=false;});
  // 井下巷道剖口与监测站；杆件仅向上至目标层，不延伸至地表。
  /* ==== v0.7 顶盖玻璃 + 前缘监测杆：本版唯一定值点（依据类别全部是【设定】）====
   * 用户要求：① 地面泵站及配套坐到模型外框顶部玻璃面上，且与注浆管路连接不断开；
   *           ② 监测锚杆移到模型边缘，全过程可见。
   * 尺寸沿用 v0.6 契约（12.00×11.66×7.35 单位）与 S=22.17 m、zHalf=3.2025、
   * SURF_U=7.0456（均由 data/geology.js + geometry.js 取值），未引入新文献数字；
   * 只改泵站/顶盖/管路/监测杆的定位，不改任何地层、三带、巷道、注浆层位定值。
   * 校核：node --check → 无头探针 errs:[] → 全景/注浆/监测杆三机位截图目视。
   */
  const BOX_Z=Z_HALF+.47, BOX_TOP=SURF_U+YB(Z_HALF)+.06, BOX_BOT=-.86;
  const BOX_H=BOX_TOP-BOX_BOT, BOX_CY=(BOX_TOP+BOX_BOT)/2, BOX_D=2*BOX_Z;
  // 顶框梁中心 y=BOX_TOP、梁厚 0.10 → 梁上表面 BOX_TOP+.05；玻璃板占 +.05~+.07。
  const GLASS_Y=BOX_TOP+.07;   // 顶部玻璃板顶面 = 泵橇坐落面
  const PUMP_Y=GLASS_Y-7.12;   // 泵组局部基准：橇底面（局部 y=7.12）正好落在玻璃面
  const PIPE_H_Y=GLASS_Y+.10;  // 顶盖上方水平注浆管段中心高（管底离玻璃面 0.035）
  // 监测杆移到 +z 前剖面外侧 0.06 单位（前剖面是演示的观察面），
  // 自 +z 观察的机位（全景/三带/注浆/监测杆/地表）全程不再被岩层遮挡。
  // 说明：这是【显示约定】——模型内杆仍属倾向中部的一根锚杆，仅沿观察方向前置，
  //       不加任何放大，杆长/埋深（煤顶 M_U → 地表 SURF_U）不变。
  // ROD_BASE 取 YB(zHalf)（前剖面的剪切基准），使杆的世界高度与前剖面「煤顶/地表」现象对齐。
  const ROD_X=-2.45, ROD_Z=Z_HALF+.06, ROD_BASE=YB(Z_HALF);
  /* ==== v0.6 S1 错层位双巷（负空间落地）=============================
   * 判据一：进风巷沿煤层顶板 —— 空腔上缘 = coalTop
   * 判据二：回风巷沿煤层底板 —— 空腔下缘 = 0
   * 判据三：完全无煤柱 —— 两巷分居倾向两端头，相距一个面长 142 m（S2 再做双对照）
   * 空腔表达：煤体缺口（coalBox 已挖出）内放 BackSide 盒 —— 只渲染内壁，
   *           外部看进去是暗腔而不是实体。
   *           v0.6.0-S1f：用户要求不显示绿色轮廓线 → SHOW_LANE_EDGES=false，
   *           轮廓线不再生成；巷道可辨性由 #lane-inset 倾向剖面承担（README L109）。
   *           断面尺寸与位置仍由 verify_s1.js 独立校核（断言不依赖轮廓线）。
   */
  const twins=new T.Group(); twins.name='错层位双巷'; strata.add(twins);
  const SHOW_LANE_EDGES=false;                          // 用户 m00756：不想看到绿色这些线
  const cavityMat=new T.MeshBasicMaterial({color:'#0b0e10',side:T.BackSide});
  const laneEdgeMat=new T.LineBasicMaterial({color:'#2f8f7d'});   // 仅 SHOW_LANE_EDGES=true 时使用
  const CAV_IN=0.004;                                  // 内壁盒内缩，避开与煤面共面
  function cavity(x0,x1,y0,y1,z0,z1,parent){
    const g=new T.Mesh(new T.BoxGeometry(x1-x0-CAV_IN*2,y1-y0-CAV_IN*2,z1-z0-CAV_IN*2),cavityMat);
    g.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
    g.castShadow=false; g.receiveShadow=false; g.name='巷道空腔'; parent.add(g);
    if(SHOW_LANE_EDGES){
      const e=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(x1-x0,y1-y0,z1-z0)),laneEdgeMat);
      e.position.copy(g.position); parent.add(e);
    }
    return g;
  }
  // 进风巷 / 回风巷：按与煤块相同的 96 段生成（v0.9 起两巷均沿走向全程 96 段，不再有抬头段 30 段），
  //   每段 x 方向各外扩 CAV_IN，抵消 cavity() 的统一内缩，使相邻段首尾相接、不留煤棱。
  //   v0.8 分段的第二个目的：空腔要跟着煤块逐段消失——煤采空的位置不能再残留黑色内壁盒
  //   （v0.7 用整块 239 m 长空腔，煤带一消失就露出一大片黑块）。
  //   v0.9：三角底煤改到倾向后，进风巷空腔沿走向全長贴煤顶 [LANE_TOP_Y0,M_U]，
  //   其下方是三角煤最厚平段（4.0 m），不再有「抬头段另起高度」的问题。
  const laneInSegs=[], laneRetSegs=[];
  for(let i=0;i<NSEG;i++){
    const x0=X_CUT1+i*dxSeg, x1=x0+dxSeg;
    laneInSegs.push(cavity(x0-2*CAV_IN,x1+2*CAV_IN,LANE_TOP_Y0,M_U,Z_IN0,Z_IN1,twins));
    laneRetSegs.push(cavity(x0-2*CAV_IN,x1+2*CAV_IN,0,LH,Z_RT0,Z_RT1,twins));
  }
  // 代表段（断面/层位/端头与整条一致），供 verify_s1 与探针读取
  const laneIn=laneInSegs[0], laneRet=laneRetSegs[0];
  // 切眼：连接两端头，沿倾向贯通全幅，宽 4.5 m × 全煤厚
  const cutEye=cavity(X_CUT0,X_CUT1,0,M_U,Z_IN0,Z_RT1,twins);
  // 供探针/断言读取的实测几何登记（S1 门禁 G3/G4/G5/G6/G8 用）
  if(typeof window!=='undefined'){
    window.__TWINS__={
      laneIn, laneRet, cutEye, ramp:coalRamp, rampBlocks:coalRamp, group:twins,
      // v0.9：巷道空腔按煤块粒度分段，下列数组供"逐段消失"的可见性与探针使用；
      //   laneIn / laneRet 只是代表段（第一段），尺寸与层位与整条一致。
      laneInSegs, laneRetSegs,
      expect:{
        laneH:G.LANE_H, laneH_M:G.LANE_H*G.S, laneW:G.LANE_W, laneWM:G.LANE_W*G.S,
        cavIn:CAV_IN,
        zLaneIn0:Z_IN0, zLaneIn1:Z_IN1, zLaneRet0:Z_RT0, zLaneRet1:Z_RT1,
        laneCenterGapU:G.laneCenterGapU, laneCenterGapM:G.laneCenterGapM,
        inTopLocal:M_U, retBotLocal:0, coalTop:M_U,
        cutEyeX0:X_CUT0, cutEyeX1:X_CUT1, cutEyeW:X_CUT1-X_CUT0,
        rampSegments:G.rampSegments, rampLenM:G.rampLenM, rampLenU:G.rampLenU, rampRiseU:G.rampRiseU,
        rampSlopeLenM:G.rampSlopeLenM, rampDeg:G.rampDeg,
        rampZ0:RAMP_Z0, rampZ1:RAMP_Z1, rampZSlope0:RAMP_Z_SLOPE0,
        cavityCount:NSEG*2+1, solidLaneBoxes:0,
        coalBlocks:coal.length, coalRampBlocks:coalRamp.length, coalPillarBlocks:coalPillar.length
      }
    };
  }
  const roadway=new T.Group();strata.add(roadway);
  for(let i=0;i<4;i++){
    const x=-4.0+i*.65;
    link([x,-.02,2.43],[x,.41,2.43],.025,mats.metal,roadway);
    link([x,.41,2.43],[x,.41,1.72],.025,mats.metal,roadway);
  }
  const rodMat=new T.MeshStandardMaterial({color:'#bdc9cc',metalness:.88,roughness:.23});
  const rod=new T.Group();world.add(rod);rod.position.y=ROD_BASE;
  const rodSegments=[];const rodN=28;
  for(let i=0;i<rodN;i++){
    const m=new T.Mesh(new T.CylinderGeometry(.045,.045,1,12),rodMat);m.castShadow=true;rod.add(m);rodSegments.push(m);
  }
  const gaugeMats=[],gauges=[];
  for(const t of [.25,.57,.86]){
    const mat=new T.MeshStandardMaterial({color:'#35b6a1',emissive:'#166957',emissiveIntensity:.25,metalness:.4,roughness:.35});
    const g=box(.125,.22,.025,mat,0,0,0,rod);
    const strips=[];
    for(let j=0;j<6;j++)strips.push(box(.008,.17,.009,mats.light,-.043+j*.017,0,.019,g));
    gauges.push({g,t});gaugeMats.push(mat);
  }
  const head=box(.20,.12,.18,mats.metal,ROD_X,SURF_U,ROD_Z-.03,rod);
  const rodReference=line([[ROD_X,ROD_BASE+M_U,ROD_Z-.03],[ROD_X,ROD_BASE+SURF_U,ROD_Z-.03]],'#55737e',world,true);
  const rodDisplacement=line([[ROD_X,ROD_BASE+M_U,ROD_Z+.02],[ROD_X,ROD_BASE+M_U,ROD_Z+.02]],'#df9834');
  // v0.7：监测接入点（原「井下巷道监测站」，埋在岩层里只能看见一点）随杆一起移到前剖面外侧。
  const sensorBox=box(.44,.23,.21,mats.teal,ROD_X-.92,ROD_BASE+.16,ROD_Z+.04);
  const sensorLED=new T.Mesh(new T.SphereGeometry(.035,12,8),new T.MeshBasicMaterial({color:'#38c5ae'}));sensorLED.position.set(ROD_X-.80,ROD_BASE+.19,ROD_Z+.14);world.add(sensorLED);
  const YQ=1.95, PL=YB(YQ);            // 注浆管路所在倾向断面的世界基准
  const cable=line([[ROD_X-.92,ROD_BASE+.20,ROD_Z+.12],[ROD_X,ROD_BASE+.27,ROD_Z+.02],[ROD_X,ROD_BASE+SURF_U,ROD_Z+.02]],'#1c847c');
  // signalLine 需要 GLASS_Y/BOX_TOP，改到下方外框段生成。
  // v0.7：泵站整体吊到顶盖玻璃面上（橇底 = GLASS_Y），组内局部坐标一律不变。
  const pump=new T.Group();world.add(pump);pump.position.y=PUMP_Y;
  box(2.25,.12,1.25,mats.dark,-4.55,7.18,.38,pump);
  box(.87,.48,.70,mats.teal,-4.98,7.47,.38,pump);
  link([-4.32,7.43,-.1],[-4.32,7.43,.8],.23,mats.metal,pump,24);
  box(.40,.40,.60,mats.dark,-3.78,7.44,.38,pump);
  const wheel=new T.Mesh(new T.TorusGeometry(.22,.04,8,24),mats.pipe);wheel.position.set(-3.86,7.67,.72);pump.add(wheel);
  const tank=link([-5.10,7.3,-.95],[-5.10,8.15,-.95],.43,mats.light,pump,32);
  const lid=link([-5.10,8.15,-.95],[-5.10,8.23,-.95],.46,mats.teal,pump,32);
  const controller=box(.57,.81,.35,mats.light,-3.30,7.55,-.78,pump);
  box(.39,.27,.015,mats.dark,-3.30,7.67,-.59,pump);
  const pumpLED=new T.Mesh(new T.SphereGeometry(.045,12,8),new T.MeshBasicMaterial({color:'#78928a'}));pumpLED.position.set(-3.30,7.40,-.58);pump.add(pumpLED);
  link([-3.82,7.42,.72],[-3.82,7.88,1.95],.065,mats.pipe,pump);   // 泵体出口短管（泵组局部坐标）
  const GRT=G.groutU;                 // 注浆层位：主关键层底界 88 m（G11 断言对象）
  /* v0.7 管路改接（泵站坐刚性顶盖后，管段高度全部改为定值，不再随地表沉降浮动）：
     ①泵出口(世界 y=PUMP_Y+7.88) →②下折立管 →③顶盖上方水平段(PIPE_H_Y)
     →④孔口立管下钻 →⑤孔口法兰(cap) →⑥穿层斜管+喷嘴(离层内扩散源)
     恒连续的三处接头：①=PUMP_Y+7.88；②③=④上端=PIPE_H_Y；④下端=PL+GRT。
     inletGroup 改挂 strata（随煤层剪切），使 ④下端 与离层内扩散源 (-0.92, GRT, 0) 重合。*/
  const pumpElbow=link([-3.82,PUMP_Y+7.88,1.95],[-3.82,PIPE_H_Y,1.95],.065,mats.pipe);
  const surfacePipe=link([-3.82,PIPE_H_Y,1.95],[-.72,PIPE_H_Y,1.95],.065,mats.pipe);
  const downPipe=link([-.72,PIPE_H_Y,1.95],[-.72,PL+GRT,1.95],.055,mats.pipe);
  // 孔口法兰：压在顶盖玻璃上的注浆孔口，同时收住立管穿板的交线。
  const cap=box(.26,.05,.26,mats.dark,-.72,GLASS_Y+.02,1.95);
  // 外侧管路为剖示，末端沿厚度方向进入离层内部，与三维扩散源点相连。
  const inletGroup=new T.Group();strata.add(inletGroup);
  link([-.72,0,1.95],[-.72,0,.16],.049,mats.pipe,inletGroup);
  link([-.72,0,.16],[-.92,0,0],.049,mats.pipe,inletGroup);
  const nozzle=link([-.92,0,0],[-.92,-.02,0],.058,mats.metal,inletGroup);
  const groutVolume=window.createGroutVolume({THREE:T,parent:strata,
    gapAt:(x,z)=>({bottom:GRT+deflect(x,5),top:GRT+deflect(x,6)}),
    source:{x:-.92,z:0},bounds:{minX:-4.7,maxX:1.2,minZ:Z0,maxZ:Z1}});
  const SL_Z=1.68, SLL=YB(SL_Z);
  const surfaceLine=line([[0,SLL+SURF_U,SL_Z],[1,SLL+SURF_U,SL_Z]],'#087c74');
  const counterLine=line([[0,SLL+SURF_U,SL_Z],[1,SLL+SURF_U,SL_Z]],'#71818b',world,true);
  const surfaceCracks=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({color:'#625348'}));world.add(surfaceCracks);
  const targetLine=line([[0,SLL+GRT,SL_Z],[1,SLL+GRT,SL_Z]],'#e2b44c');
  // 原型高度参照：煤顶至关键层底界，不对应已验证的几何相似比。
  const refGroup=new T.Group();world.add(refGroup);
  const RZ=1.81, RL=YB(RZ);
  line([[5.2,RL+M_U,RZ],[5.72,RL+M_U,RZ],[5.72,RL+SURF_U,RZ],[5.2,RL+SURF_U,RZ]],'#506b71',refGroup);
  for(const y of[RL+M_U,RL+SURF_U])line([[5.57,y+(y<RL+1?.17:-.17),RZ],[5.72,y,RZ],[5.87,y+(y<RL+1?.17:-.17),RZ]],'#506b71',refGroup);
  // 实验箱框架和浅透明侧板。v0.6 S1：箱体按契约 12.00×11.66×7.35 单位（倾向改单面 142 m），
  // 箱高必须容得下剪切包围盒：SURF_U + yBase(+zHalf)（X2 断言，余量 0.96 m）。
  const floorMat=new T.MeshStandardMaterial({color:'#d4dcdd',roughness:.85});
  // BOX_Z / BOX_TOP / BOX_BOT / BOX_H / BOX_CY / BOX_D 已在监测杆段统一定义（v0.7 上移），此处不重复声明。
  box(12.9,.23,BOX_D,mats.dark,0,-.98,0,lab);
  /* 倾角台架垫块（楔形）：30° 剪切后岩层底面是斜平面（世界 y 从 −0.95 抬到 2.98），
     而实验箱底是水平的，二者之间必然形成一个三角空腔。真实相似模拟里这里就是
     可调倾角台架的楔形垫块。本构件只补视觉空腔，不参与任何断言（登记为视觉辅助）。*/
  {
    const px=6.05, pz0=-Z_HALF-.2, pz1=Z_HALF+.2, yPad=BOX_BOT+.03;
    const yr=z=>(-BD)+SLOPE_*z+LIFT;
    const v=[-px,yPad,pz0, px,yPad,pz0, px,yPad,pz1, -px,yPad,pz1,
             -px,yr(pz0),pz0, px,yr(pz0),pz0, px,yr(pz1),pz1, -px,yr(pz1),pz1];
    const idx=[0,1,2, 0,2,3, 4,6,5, 4,7,6, 0,4,5, 0,5,1, 3,2,6, 3,6,7, 0,3,7, 0,7,4, 1,5,6, 1,6,2];
    const pg=new T.BufferGeometry();
    pg.setAttribute('position',new T.Float32BufferAttribute(v,3));
    pg.setIndex(idx); pg.computeVertexNormals();
    const pad=new T.Mesh(pg,new T.MeshStandardMaterial({color:'#4d5357',roughness:.62,metalness:.32,flatShading:true}));
    pad.name='倾角台架垫块（视觉辅助）'; pad.castShadow=true; pad.receiveShadow=true; lab.add(pad);
  }
  for(const x of[-6.3,6.3])for(const z of[-BOX_Z,BOX_Z]){
    box(.10,BOX_H,.10,mats.metal,x,BOX_CY,z,lab);
    box(.20,.85,.20,mats.dark,x,BOX_BOT-.12,z,lab);
  }
  for(const y of[BOX_BOT+.14,BOX_TOP]){
    for(const z of[-BOX_Z,BOX_Z])box(12.7,.10,.10,mats.metal,0,y,z,lab);
    for(const x of[-6.3,6.3])box(.10,.10,BOX_D-.3,mats.metal,x,y,0,lab);
  }
  box(.025,BOX_H-.3,BOX_D-.7,mats.glass,6.26,BOX_CY,0,lab);
  box(.025,BOX_H-.3,BOX_D-.7,mats.glass,-6.26,BOX_CY,0,lab);
  /* v0.7 顶部玻璃盖板（用户要求①的「玻璃面」）：架在顶框梁上表面（BOX_TOP+.05）之上，
     厚 0.02，顶面 = GLASS_Y。泵站橇底(局部 7.12)正落在 GLASS_Y 上；φ0.055 孔口立管穿过
     盖板，用 cap 法兰收口。材料沿用侧面同一 mats.glass（不透明度 .085、depthWrite:false），
     因此不会遮挡顶面上的泵站与管路。*/
  const glassTop=box(12.7,.02,BOX_D-.3,mats.glassTop,0,GLASS_Y-.01,0,lab);
  glassTop.name='顶盖玻璃';
  // 玻璃上表面加两道边线：浅色背景下让「玻璃面」的边界可读（纯视觉辅助，不参与断言）。
  for(const z of[-BOX_Z+.16,BOX_Z-.16])line([[-6.33,GLASS_Y+.002,z],[6.33,GLASS_Y+.002,z]],'#9fb4ba',lab);
  /* v0.7 监测站信号线：由前剖面监测站 → 贴箱体左外侧上行 → 翻过顶框 → 接到顶盖上的控制器。
     旧版这条线是从岩层里的传感器往上走的，随杆前移必须一并改线，否则会横穿岩层。*/
  const signalLine=line([
    [ROD_X-.92,ROD_BASE+.28,ROD_Z+.16],
    [-6.02,YB(Z_HALF)+.40,Z_HALF+.10],
    [-6.02,BOX_TOP+.22,Z_HALF+.10],
    [-6.02,GLASS_Y+.16,BOX_Z-.16],
    [-3.30,GLASS_Y+.44,-.56]
  ],'#3b8a8c',world,true);
  // 地表模式仅添加示意建筑与植被，地层仍使用同一控制区。
  const buildings=[];
  function building(x,z,w,h,d){
    const g=new T.Group();mine.add(g);g.position.set(x,YB(z)+SURF_U,z);
    box(w,h,d,new T.MeshStandardMaterial({color:'#d8d8cd',roughness:.9}),0,h/2,0,g);
    box(w+.12,.10,d+.12,mats.dark,0,h+.04,0,g);
    for(let j=0;j<3;j++)box(w*.16,h*.30,.015,new T.MeshStandardMaterial({color:'#7597a0',metalness:.15,roughness:.35}),-w*.32+j*w*.32,h*.6,d/2+.01,g);
    buildings.push(g);
  }
  building(.15,-.65,.85,.65,.70);building(3.8,-.65,.85,.83,.72);
  const trees=[];
  for(let i=0;i<5;i++){
    const x=.65+i*1.02,z=-1.18;
    const tree=new T.Group();tree.position.set(x,YB(z)+SURF_U,z);mine.add(tree);trees.push(tree);
    link([0,0,0],[0,.50,0],.035,new T.MeshStandardMaterial({color:'#6f6452'}),tree);
    const m=new T.Mesh(new T.ConeGeometry(.23,.65,8),new T.MeshStandardMaterial({color:'#667f63',roughness:1}));m.position.set(0,.63,0);tree.add(m);
  }
  const floor=box(200,.2,200,floorMat,0,-1.85,0,scene);floor.receiveShadow=true;
  const grid=new T.GridHelper(32,32,'#c6d1d4','#d7dfe1');grid.position.y=-1.74;scene.add(grid);
  // 标签 pos() 一律返回「局部 y」，投影时统一加 yBase(z)（见 updateLabels），
  // 因此任何标签都不得再自行叠加剪切抬升，避免双加。
  const labels=[];
  function addLabel(id,text,pos,views=['overview'],tone='neutral'){
    const e=document.createElement('div');e.className=`scene-label scene-label--${tone}`;e.textContent=text;e.dataset.label=id;
    const right=e.cloneNode(true);right.dataset.case='untreated';labelRoot.append(e,right);labels.push({e,right,pos,views});return e;
  }
  addLabel('pump','地面注浆泵与控制器',()=>[-4.4,GLASS_Y+1.58-YB(.6),.6],['overview','grout']);
  addLabel('target','目标岩层',()=>[2.0,GRT+deflect(2,6),1.72],['overview','sensor','grout'],'target');
  addLabel('coal','煤层',()=>[4.5,M_U/2,1.9],['overview','mining']);
  addLabel('goaf','工作面后方采空区',()=>[-3.8,M_U*.8,1.9],['mining']);
  addLabel('face','沿模型厚度布置的开采工作面',()=>[face,M_U*1.4,0],['mining'],'active');
  // v0.7：杆移到前剖面外侧，标签跟到杆上；views 覆盖全部主要机位，不再被岩层挡住。
  addLabel('rod','监测锚杆 · 煤顶→地表',()=>[ROD_X,M_U+(SURF_U-M_U)*.62,ROD_Z+.14],['overview','mining','zones','sensor','grout','surface'],'active');
  addLabel('gauge','应变片随杆弯曲 · 形变放大',()=>[rodPoint(.6).x,rodPoint(.6).y,ROD_Z+.16],['sensor'],'active');
  addLabel('rod-original','虚线：杆件初始位置',()=>[ROD_X,SURF_U,ROD_Z-.03],['sensor']);
  addLabel('roadway','井下巷道／监测接入点',()=>[-3.45,0.0,2.5],['mining']);
  // v0.6 S1：错层位双巷（进风贴顶于 -z 端头、回风贴底于 +z 端头、切眼贯通、低处端头抬头楔）
  addLabel('lane-in','进风巷（贴煤层顶板）· −z 端头',()=>[-2.2,M_U+LH*1.5,Z_IN1+.30],['overview','mining'],'target');
  addLabel('lane-ret','回风巷（贴煤层底板）· +z 端头',()=>[-2.2,LH*1.4,Z_RT0-.30],['overview','mining'],'target');
  addLabel('lane-ramp','三角底煤 · 倾向 22.5 m · 0→4.0 m',()=>[-4.1,M_U*.30,RAMP_Z0+0.22],['mining'],'active');
  addLabel('cut-eye','切眼 · 宽 4.5 m · 沿倾向贯通',()=>[G.xFace-.30,M_U*1.9,0],['overview','mining'],'active');
  // v1.0：三机等比例展示机位（equip）的标签——三个设备各一条，指明等比尺寸与铺设方式。
  addLabel('eq-pan','刮板输送机 88 节 × 1.5 m · 贴煤层底板',()=>[face-.55,U(.55),1.2],['equip'],'active');
  addLabel('eq-sup','液压支架 88 架 × 1.5 m · 沿斜边爬坡（端头 2 架破顶）',()=>[face-3.5,U(3.0),-1.0],['equip'],'active');
  addLabel('eq-shear','采煤机 1 台 · 8.0 m 双滚筒 （落于倾向中部 z=0）',()=>[face-.9,U(1.9),0],['equip'],'target');
  addLabel('pipe','注浆钻孔 · 孔口在顶盖',()=>[-.62,GLASS_Y+.62-PL,1.95],['overview','grout']);
  addLabel('gap','离层内部 · 浆液逐步扩散填充',()=>[-2.7,GRT+deflect(-2.7,6),-.8],['grout'],'active');
  addLabel('outlet','管口 · 三维扩散起点',()=>[-.92,GRT+(deflect(-.92,5)+deflect(-.92,6))/2,0],['grout'],'target');
  addLabel('rear','背面观察 · 同一三维控制区',()=>[0,GRT+deflect(0,6),-1.7],['back'],'active');
  addLabel('height','主关键层底界 88 m（原型参考）',()=>[5.72,GRT*.55,1.9],['overview']);
  addLabel('surface','实线：当前地表 · 虚线：初始',()=>[1.8,SURF_U+deflect(1.8,9),1.8],['surface'],'active');
  const zonePins=[];
  for(const [id,title,description,y,idx] of [
    ['bending','弯曲下沉带','连续层理 · 整体弯沉',(U(ZON.bending.from)+U(ZON.bending.to))/2,7],
    ['fractured','裂隙带','层状断裂 · 层间离层',(U(ZON.fractured.from)+U(ZON.fractured.to))/2,4],
    ['caving','垮落带','破碎转动 · 架后堆积',U(ZON.caving.to)/2,2]
  ]){
    for(let side=0;side<2;side++){
      const e=document.createElement('div'),line=document.createElement('div'),dot=document.createElement('div');
      e.className=`zone-pin zone-pin--${id}`;e.dataset.zone=id;e.dataset.case=side?'untreated':'treated';
      const name=document.createElement('strong'),note=document.createElement('small');name.textContent=title;note.textContent=description;e.append(name,note);
      line.className=`zone-leader zone-pin--${id}`;dot.className=`zone-anchor zone-pin--${id}`;
      labelRoot.append(line,dot,e);zonePins.push({e,line,dot,note,description,side,y,idx,id});
    }
  }
  // v0.6 S1：相机随箱体 12.00×11.66×7.35 单位重标定（倾向由 250 m 改 142 m 单面，
  // 箱体 z 向变宽、y 向变矮；机位只调距离，不改视轴）。
  const camDefs={
    overview:{pos:[23.0,17.5,34.0],target:[0,6.4,0]},
    mining:{pos:[3.0,7.6,5.4],target:[-2,2.2,-0.2]},
    lanes:{pos:[4.6,3.73,6.0],target:[4.4,3.69,2.9]},
    zones:{pos:[-1.0,7.5,20.0],target:[-1,6.2,0]},
    sensor:{pos:[.5,8.0,14.0],target:[-2.4,4.2,1.8]},
    grout:{pos:[6.5,13.5,13.0],target:[-1.5,6.5,0]},
    back:{pos:[-19.0,13.0,-30.0],target:[-.7,6.5,0]},
    surface:{pos:[4.5,25.0,15.0],target:[-1.9,11.0,0]},
    equip:{pos:[0,5.0,2.6],target:[2.0,2.15,-0.4]}
  };
  // v0.9：lanes 机位回到 +z 侧剖开回风端（v0.8 口径）。进风端三角底煤在 3D 全景里
  //    仅约 6 px 厚、且被箱体 −z 岩层端墙遮挡，从外部剖不到——可见性由页面 #lane-inset
  //    倾向剖面承担（等比，4.0 m ≈ 52 px）；3D 只保证几何正确（1824 个 ramp 块 + G8 断言）。
  const CLIP_Z=G.zLaneRet0-.10,clipLane=new T.Plane(new T.Vector3(0,0,1),-CLIP_Z);
  let laneClipOn=false;
  function setLaneClip(on){
    if(on===laneClipOn)return; laneClipOn=on;
    mats.coal.side=on?T.DoubleSide:T.FrontSide; mats.coal.needsUpdate=true;
    for(const root of [world,counterScene]){
      root.traverse(o=>{
        const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):null; if(!ms)return;
        for(const m of ms){ const want=on?[clipLane]:null; if(m.clippingPlanes!==want){m.clippingPlanes=want;m.needsUpdate=true;} }
      });
    }
    renderDirty=true;
  }
  window.__S1DIAG__={floorA:layers[0].a,floorB:layers[0].b,boxBot:BOX_BOT,clipZ:CLIP_Z,clipEnabled:renderer.localClippingEnabled,hasLanes:!!camDefs.lanes};
  let targetPos=new T.Vector3(...camDefs.overview.pos),targetLook=new T.Vector3(...camDefs.overview.target);
  let look=targetLook.clone();camera.position.copy(targetPos);camera.lookAt(look);
  let face=-4.8,oldProgress=-1,lastStage=-1,lastUI=0,lastRAF=0,elapsed=0,needsUpdate=true;
  let renderDirty=true,lastGeometry=0,lastLabels=0,geometryUpdates=0,renderCount=0;
  let evaluatingCounter=false,shadowDirty=true;
  let automaticInspection=false;
  const factors=[0,0,.34,.32,.29,.26,.17,.16,.15,.14];
  function deflect(x,idx,counter=evaluatingCounter){
    const m=state.metrics[counter?'untreated':'settlement'];
    const bowl=Math.exp(-Math.pow((x+2.1)/2.6,4));
    // 支护设备保持工作面后方约一个设备长度内的净空，弯沉从支护后方发展。
    const mined=1-smooth(face-1.40,face-1.05,x);
    // 全层共用有界振幅，保留层间次序及底板净空；数值仅为动画尺度。
    const amp=.62*clamp(m/.96)*(state.options.exaggeration?1:1/2.15);
    return -amp*(factors[idx]/factors[2])*bowl*mined;
  }
  function craterOffset(x,z,counter=evaluatingCounter){
    if(!counter)return 0;
    const growth=smooth(.84,1,state.progress),dx=(x+2.15)/1.24,dz=z/.96;
    const angle=Math.atan2(dz,dx),radius=Math.hypot(dx,dz);
    const uneven=1+.055*Math.sin(angle*7)+.035*Math.cos(angle*11);
    return -.65*growth*(1-smooth(.42,.99,radius/uneven))*(state.options.exaggeration?1:.46);
  }
  function surfaceDeflect(x,z,counter=evaluatingCounter){return deflect(x,9,counter)+craterOffset(x,z,counter);}
  function layerDeflect(x,y,z,idx){
    const skin=idx===9?1:idx===8?smooth(U(120),U(145),y):0;
    return deflect(x,idx)+skin*craterOffset(x,z);
  }
  // rodPoint 返回 rod 组的局部坐标（rod.position.y = ROD_BASE），杆自煤顶 M_U 起至地表 SURF_U。
  // v0.7：杆移到前剖面外侧（x=ROD_X, z=ROD_Z），弯沉仍按杆位 x 读取，弯折幅度与旧版同源。
  function rodPoint(t){
    const disp=deflect(ROD_X,6),bend=state.metrics[evaluatingCounter?'untreated':'settlement']*(state.options.exaggeration?.85:.36);
    const coupling=1-smooth(face-1.40,face-1.05,ROD_X);
    return new T.Vector3(ROD_X+Math.sin(t*Math.PI)*bend*coupling,M_U+t*(SURF_U+disp-M_U),ROD_Z);
  }
  function updateCase(){
    const p=state.progress;
    face=mix(G.xFace,G.boxX1-0.40,smooth(.12,.80,p));
    miningVolume.update({face,progress:p,time:p*96});
    const oldRubble=workface.getObjectByName('全厚度稀疏有限碎裂');if(oldRubble)oldRubble.visible=false;
    zones.update({progress:p,face,exaggeration:state.options.exaggeration,treated:!evaluatingCounter,interior:state.options.interior&&state.camera==='mining'});
    // 采空区煤随工作面推进消失；切眼左侧未采动区（x ≤ xFace）与起坡底煤楔始终保留。
    // v0.8：两端头巷道煤带已并入 coal（综放一次采全高，采过后全厚消失），
    //   coalPillar 现为空数组，调用保留以便将来登记"确实没采"的煤体。
    coal.forEach(m=>{m.visible=state.camera!=='equip'&&(m.position.x>face+.38||m.position.x<=G.xFace);});
    coalPillar.forEach(m=>{m.visible=true;});
    // v0.8：巷道空腔与煤块同判据逐段消失——煤没采到的地方空腔还在（煤中缺口），
    //   采过去的地方煤和空腔一起没了，不会留下悬空的黑盒。
    const cavVis=o=>{o.visible=state.camera!=='equip'&&(o.position.x>face+.38||o.position.x<=G.xFace);};
    laneInSegs.forEach(cavVis); laneRetSegs.forEach(cavVis);
    cavVis(cutEye);
    coalRamp.forEach(m=>{m.visible=true;});
    for(const o of layerMeshes){
      if(zones.replacementLayerIndices.includes(o.idx))continue;
      const pos=o.m.geometry.attributes.position;
      for(let i=0;i<pos.array.length;i+=3)pos.array[i+1]=o.base[i+1]+layerDeflect(o.base[i],o.base[i+1],o.base[i+2],o.idx);
      if(o.idx===9){
        const color=o.m.geometry.attributes.color;
        for(let i=0;i<color.count;i++){
          const shade=1+craterOffset(o.base[i*3],o.base[i*3+2])*.44;
          color.setXYZ(i,shade,shade*.998,shade*.985);
        }
        color.needsUpdate=true;
      }
      pos.needsUpdate=true;o.m.geometry.computeVertexNormals();o.m.geometry.computeBoundingSphere();
    }
    const pts=[];
    for(let i=0;i<=rodN;i++)pts.push(rodPoint(i/rodN));
    rodSegments.forEach((m,i)=>{
      const a=pts[i],b=pts[i+1],d=b.clone().sub(a);m.position.copy(a).add(b).multiplyScalar(.5);m.scale.y=d.length();m.quaternion.setFromUnitVectors(unitY,d.normalize());
    });
    for(const o of gauges){
      const v=rodPoint(o.t),tangent=rodPoint(o.t+.005).sub(rodPoint(o.t-.005)).normalize();
      o.g.position.copy(v);o.g.position.z+=.055;o.g.quaternion.setFromUnitVectors(unitY,tangent);
    }
    head.position.copy(rodPoint(1));
    const middle=rodPoint(.5);
    replaceLine(rodDisplacement,[[ROD_X,ROD_BASE+middle.y,ROD_Z+.02],[middle.x,ROD_BASE+middle.y,ROD_Z+.02]]);
    rodReference.visible=state.camera==='sensor';rodDisplacement.visible=state.camera==='sensor'&&p>.25;
    replaceLine(cable,[[ROD_X-.92,ROD_BASE+.20,ROD_Z+.12],[ROD_X,ROD_BASE+.27,ROD_Z+.02],...pts.filter((_,i)=>i%3===0).map(v=>[v.x-.075,ROD_BASE+v.y,v.z+.02])]);
    const gaugeColor=evaluatingCounter&&p>.65?'#da7862':!evaluatingCounter&&p>=.90?'#35b6a1':state.triggered?'#e4a33c':'#35b6a1';
    gaugeMats.forEach(m=>{m.color.set(gaugeColor);m.emissive.set(gaugeColor).multiplyScalar(.35);});
    sensorLED.material.color.set(state.triggered?'#f5b44a':'#38c5ae');
    pumpLED.material.color.set(state.pumpOn?'#3bd7ae':'#78928a');
    signalLine.material.color.set(state.triggered?'#df9633':'#3b8a8c');
    const upper=GRT+deflect(-.92,6),bottom=GRT+deflect(-.92,5);
    const end=(upper+bottom)/2;
    /* v0.7：泵站坐刚性顶盖，管路高度改为定值 → 三处接头恒连续：
       ①泵出口 PUMP_Y+7.88 与②下折立管两端均为常量；③④上端固定 PIPE_H_Y；
       ④下端固定 PL+GRT（inletGroup 随 strata 剪切，末端即离层内扩散源）。*/
    const pipeTop=PIPE_H_Y;
    surfacePipe.position.y=PIPE_H_Y;
    downPipe.position.y=(pipeTop+PL+end)/2;downPipe.scale.y=(pipeTop-(PL+end))/(PIPE_H_Y-(PL+GRT));
    cap.position.y=GLASS_Y+.02;
    inletGroup.position.y=end;
    for(const obj of [pump,pumpElbow,surfacePipe,downPipe,cap,inletGroup,signalLine,groutVolume.group])obj.visible=!evaluatingCounter;
    if(!evaluatingCounter)groutVolume.update({progress:p,time:p*96,flow:state.metrics.flow,pumpOn:state.pumpOn});
    const actual=[],counter=[],target=[];
    for(let i=0;i<=80;i++){
      const x=-5.9+i*11.8/80;actual.push([x,SLL+SURF_U+surfaceDeflect(x,1.64),SL_Z]);counter.push([x,SLL+SURF_U,SL_Z]);target.push([x,SLL+GRT+deflect(x,6),SL_Z]);
    }
    replaceLine(surfaceLine,actual);replaceLine(counterLine,counter);replaceLine(targetLine,target);
    surfaceLine.material.color.set(evaluatingCounter?'#b45d66':'#087c74');
    counterLine.visible=state.camera==='surface';
    const crackPoints=[];
    for(let j=0;j<14;j++){
      const a=j*Math.PI*2/14;
      for(let k=0;k<4;k++){
        const radius=.85+k*.075,angle=a+Math.sin(j*3+k)*.025;
        const point=r=>{const x=-2.15+Math.cos(angle)*1.24*r,z=Math.sin(angle)*.96*r;return new T.Vector3(x,YB(z)+SURF_U+surfaceDeflect(x,z),z);};
        crackPoints.push(point(radius),point(radius+.062));
      }
    }
    surfaceCracks.geometry.setFromPoints(crackPoints);surfaceCracks.geometry.computeBoundingSphere();
    surfaceCracks.visible=evaluatingCounter&&p>.84;
    for(const g of [...buildings,...trees]){g.position.y=YB(g.position.z)+SURF_U+surfaceDeflect(g.position.x,g.position.z);g.rotation.z=(surfaceDeflect(g.position.x+.2,g.position.z)-surfaceDeflect(g.position.x-.2,g.position.z))/.4;}
    // v0.7：泵站坐在刚性顶框（不做地表沉降跟随），pump.position.y 恒为 PUMP_Y，此处不再改高度。
  }
  const counterScene=new T.Scene();counterScene.background=scene.background;counterScene.fog=scene.fog;counterScene.environment=scene.environment;
  for(const o of [hemi,key,fill,floor,grid])counterScene.add(o.clone());
  const counterWorld=world.clone(true);counterScene.add(counterWorld);
  const mainObjects=[],counterObjects=[],materialCopies=new Map();world.traverse(o=>mainObjects.push(o));counterWorld.traverse(o=>counterObjects.push(o));
  const pairs=mainObjects.map((src,i)=>{
    const dst=counterObjects[i];
    if(src.geometry)dst.geometry=src.geometry.clone();
    if(src.material){if(!materialCopies.has(src.material))materialCopies.set(src.material,src.material.clone());dst.material=materialCopies.get(src.material);}
    return {src,dst};
  });
  function syncCounter(){
    for(const {src,dst} of pairs){
      dst.position.copy(src.position);dst.quaternion.copy(src.quaternion);dst.scale.copy(src.scale);
      dst.visible=src.visible;dst.castShadow=src.castShadow;dst.renderOrder=src.renderOrder;dst.frustumCulled=src.frustumCulled;
      if(src.geometry){
        for(const [name,attr] of Object.entries(src.geometry.attributes)){
          const target=dst.geometry.getAttribute(name);
          if(target&&target.array.length===attr.array.length){target.array.set(attr.array);target.needsUpdate=true;}
          else dst.geometry.setAttribute(name,attr.clone());
        }
        dst.geometry.boundingSphere=src.geometry.boundingSphere?.clone()||null;
        dst.geometry.setDrawRange(src.geometry.drawRange.start,src.geometry.drawRange.count);
      }
      if(src.isInstancedMesh){dst.instanceMatrix.array.set(src.instanceMatrix.array);dst.instanceMatrix.needsUpdate=true;dst.count=src.count;}
      if(src.material){
        const a=src.material,b=dst.material;
        if(a.color)b.color.copy(a.color);if(a.emissive)b.emissive.copy(a.emissive);
        if(b.transparent!==a.transparent)b.needsUpdate=true;
        b.transparent=a.transparent;b.opacity=a.opacity;b.depthWrite=a.depthWrite;
      }
    }
  }
  function updateGeometry(){
    if(state.options.comparison){evaluatingCounter=true;updateCase();syncCounter();}
    evaluatingCounter=false;updateCase();
    needsUpdate=false;oldProgress=state.progress;geometryUpdates++;renderDirty=true;shadowDirty=true;
  }
  // 需要透视的机位：注浆（注浆体在覆岩内）、开采（采空区在煤层内）、巷道（巷道是煤层负空间）。
  // 必须声明在 updateInspection() 之前：该函数按机位决定淡出哪些岩层。
  const INTERIOR_VIEWS=['grout','mining','equip'];
  function updateInspection(){
    const active=state.options.interior;
    for(const o of layerMeshes){
      const faded=active&&(o.idx>=6||(INTERIOR_VIEWS.includes(state.camera)&&o.idx>=2));
      o.m.material.transparent=faded;o.m.material.opacity=faded?.012:1;
      o.m.material.depthWrite=!faded;o.m.castShadow=!faded;
      o.m.material.needsUpdate=true;   // transparent 改变必须重编译，否则淡出不生效
      o.m.renderOrder=faded?3:0;
    }
    zones.group.visible=state.camera!=='equip';
    if(state.camera==='equip'){coal.forEach(m=>{m.visible=false;});laneInSegs.forEach(o=>{o.visible=false;});laneRetSegs.forEach(o=>{o.visible=false;});cutEye.visible=false;}
    groutVolume.setInspection?.(active);
    shadowDirty=true;renderDirty=true;
    const caption=document.querySelector('.scene-caption');
    if(caption)caption.textContent=state.camera==='equip'?'三机布置 · 等比例 1:200 · 岩层与采动煤已隐藏':(active?'透视观察 · 岩层实体保留':'同步开采 · 变形及局部塌陷为定性示意');
  }
  function updateParticles(){
    wheel.rotation.z=(clamp(state.progress,.54,.90)-.54)*96*3;
  }
  function chooseCamera(name,instant=false){
    const previousCamera=state.camera,previousInterior=state.options.interior;
    const wantInterior=INTERIOR_VIEWS.includes(name);
    if(wantInterior&&!state.options.interior){
      state.options.interior=true;automaticInspection=true;
    }else if(!wantInterior&&automaticInspection){
      state.options.interior=false;automaticInspection=false;
    }
    const c=camDefs[name]||camDefs.overview;state.camera=name;setLaneClip(name==='lanes');
    updateProjection();
    targetPos.set(...c.pos);targetLook.set(...c.target);
    if(name==='mining'){
      const x=clamp(mix(G.xFace,G.boxX1-1.0,smooth(.12,.80,state.progress)),-4.2,3.6);
      targetLook.set(x+0.6,2.2,-0.2);
      targetPos.set(x-1.6,7.6,5.4);
    }
    if(name==='equip'){
      const xe=clamp(mix(G.xFace,G.boxX1-1.0,smooth(.12,.80,state.progress)),-4.2,3.6);
      targetLook.set(xe-1.5,1.95,-0.2);
      targetPos.set(xe+2.0,5.0,2.4);
    }
    if(name==='grout'){
      const growth=smooth(.54,.86,state.progress),distance=mix(.30,.98,growth);
      targetLook.set(-.92-.65*growth,3.34,0);
      targetPos.copy(targetLook).add(new T.Vector3(3.0,3.3,5.6).multiplyScalar(distance));
    }
    if(previousCamera!==name||previousInterior!==state.options.interior){updateInspection();needsUpdate=true;}
    rodReference.visible=name==='sensor';rodDisplacement.visible=name==='sensor'&&state.progress>.25;
    renderDirty=true;
    if(instant){camera.position.copy(targetPos);look.copy(targetLook);camera.lookAt(look);}
  }
  // 诊断钩子：外部直接设置相机目标（不改默认行为）
  window.__AIM__=function(pos,look){targetPos.set(pos[0],pos[1],pos[2]);targetLook.set(look[0],look[1],look[2]);renderDirty=true;state.options.autoCamera=false;};
  function resize(){
    const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
    renderer.setSize(r.width,r.height,false);updateProjection();renderDirty=true;
    for(const l of labels)l.size=null;
  }
  new ResizeObserver(resize).observe(canvas);resize();
  function updateProjection(){
    camera.aspect=canvas.clientWidth/(state.options.comparison?2:1)/canvas.clientHeight;
    camera.fov=state.options.comparison?clamp(2*Math.atan(Math.tan(55*Math.PI/360)*Math.max(1,.56/camera.aspect))*180/Math.PI,55,80):(state.camera==='zones'?55:(state.camera==='lanes'?30:(state.camera==='equip'?26:37)));
    camera.updateProjectionMatrix();
  }
  function renderScene(){
    const w=canvas.clientWidth,h=canvas.clientHeight,split=state.options.comparison,half=Math.floor(w/2);
    renderer.setScissorTest(true);
    renderer.setViewport(0,0,split?half:w,h);renderer.setScissor(0,0,split?half:w,h);
    renderer.shadowMap.needsUpdate=shadowDirty;renderer.render(scene,camera);
    if(split){
      renderer.setViewport(half,0,w-half,h);renderer.setScissor(half,0,w-half,h);
      renderer.shadowMap.needsUpdate=shadowDirty;renderer.render(counterScene,camera);
    }
    renderer.setScissorTest(false);shadowDirty=false;
  }
  const proj=new T.Vector3();
  function updateLabels(){
    const split=state.options.comparison,w=canvas.clientWidth/(split?2:1),h=canvas.clientHeight;
    for(let side=0;side<2;side++){
      evaluatingCounter=side===1;const occupied=[];
      for(const l of labels){
        const e=side?l.right:l.e,id=l.e.dataset.label;
        const zoneView=['overview','zones','back'].includes(state.camera);
        let visible=state.options.labels&&l.views.includes(state.camera)&&(!side||split);
        if(zoneView&&['target','height','rear'].includes(id))visible=false;
        if(side&&['pump','pipe','gap','outlet'].includes(id))visible=false;
        if(['caving','fractured','bending'].includes(id))visible=visible&&state.progress>.27;
        if(!visible){e.style.display='none';continue;}
        const lp=l.pos();proj.set(lp[0],YB(lp[2])+lp[1],lp[2]).project(camera);
        if(proj.z>1||proj.z< -1){e.style.display='none';continue;}
        const px=(proj.x*.5+.5)*w,py=(-proj.y*.5+.5)*h;
        if(px<0||px>w||py<0||py>h){e.style.display='none';continue;}
        e.style.display='block';
        if(!l.size)l.size={w:e.offsetWidth,h:e.offsetHeight};
        const ew=l.size.w,eh=l.size.h;
        let x=clamp(px-ew/2,6,w-ew-6),y=clamp(py-eh-13,125,h-eh-38);
        if(id==='gauge')y=h-75;
        if(id==='surface')y=h-75;
        for(let tries=0;tries<5;tries++){
          if(!occupied.some(a=>x<a.x+a.w+5&&x+ew>a.x-5&&y<a.y+a.h+5&&y+eh>a.y-5))break;
          y=clamp(y+eh+7,125,h-eh-38);
        }
        occupied.push({x,y,w:ew,h:eh});e.style.transform=`translate(${x+side*w}px,${y}px)`;
      }
    }
    // 三带名称固定在各视窗右侧，通过投影引线指向正在观察的前/后剖面。
    // 初始阶段也显示“范围示意”，不把尚未产生的破坏说成已经发生。
    for(let side=0;side<2;side++){
      evaluatingCounter=side===1;let previousY=118;
      for(const pin of zonePins.filter(p=>p.side===side)){
        const visible=state.options.labels&&(!side||split)&&['overview','zones','back'].includes(state.camera);
        for(const el of [pin.e,pin.line,pin.dot])el.style.display=visible?'block':'none';
        if(!visible)continue;
        const x=clamp(face-2.4,-4.1,-2.4),z=camera.position.z>=0?1.72:-1.72;
        const y=pin.id==='caving'?U(ZON.caving.to)*.5+deflect(x,2)*.45:pin.y+deflect(x,pin.idx);
        proj.set(x,YB(z)+y,z).project(camera);
        const px=(proj.x*.5+.5)*w,py=(-proj.y*.5+.5)*h;
        const ew=Math.min(126,w*.44),eh=40,ex=w-ew-9;
        const ey=clamp(Math.max(previousY,py-eh/2),118,h-eh-42);previousY=ey+eh+8;
        pin.e.style.width=ew+'px';pin.e.style.transform=`translate(${side*w+ex}px,${ey}px)`;
        const phase=state.progress<.28?'初始范围示意':'采动形态示意';
        if(pin.e.dataset.phase!==phase){pin.e.dataset.phase=phase;pin.note.textContent=state.progress<.28?'参考范围 · 尚未发育':pin.description;}
        const onScreen=proj.z>=-1&&proj.z<=1&&px>=4&&px<w-4&&py>118&&py<h-35;
        pin.line.style.display=pin.dot.style.display=onScreen?'block':'none';
        if(onScreen){
          const dx=px-ex,dy=py-(ey+eh/2);
          pin.line.style.width=Math.hypot(dx,dy)+'px';pin.line.style.transform=`translate(${side*w+ex}px,${ey+eh/2}px) rotate(${Math.atan2(dy,dx)}rad)`;
          pin.dot.style.transform=`translate(${side*w+px-3}px,${py-3}px)`;
        }
      }
    }
    evaluatingCounter=false;
  }
  function publicState(){return{...state,metrics:{...state.metrics},options:{...state.options}};}
  function emit(){document.dispatchEvent(new CustomEvent('mine:update',{detail:publicState()}));}
  function changeProgress(p){
    Object.assign(state,sample(p));needsUpdate=true;
    if(state.options.autoCamera){const name=p>.98?'overview':stages[state.stageIndex].camera;chooseCamera(name);}
    lastStage=state.stageIndex;emit();
  }
  const api={
    play(){state.playing=true;emit();},pause(){state.playing=false;emit();},togglePlay(){state.playing=!state.playing;if(state.progress>=1&&state.playing)changeProgress(0);emit();},
    reset(){state.playing=false;state.options.autoCamera=true;changeProgress(0);chooseCamera('overview');},
    setProgress(p){changeProgress(Number(p));},
    setSpeed(n){state.speed=clamp(Number(n),.1,4);emit();},
    setCamera(name){state.options.autoCamera=false;chooseCamera(name,true);emit();},
    setMode(mode){state.mode=mode==='mine'?'mine':'lab';lab.visible=state.mode==='lab';mine.visible=state.mode==='mine';needsUpdate=true;renderDirty=true;shadowDirty=true;emit();},
    setOption(name,value){state.options[name]=!!value;if(name==='interior')automaticInspection=false;needsUpdate=true;updateInspection();if(name==='comparison'){updateProjection();for(const l of labels)l.size=null;}if(name==='autoCamera'&&value)chooseCamera(state.progress>.98?'overview':stages[state.stageIndex].camera);emit();},
    step(dir){state.playing=false;state.options.autoCamera=true;const i=clamp(state.stageIndex+(dir>0?1:-1),0,stages.length-1);changeProgress(stages[i].at);},
    getState:publicState,sample,stages,
    diagnostics(){return{mining:miningVolume.diagnostics(),grout:groutVolume.diagnostics(),zones:zones.diagnostics(),outlet:[-.92,inletGroup.position.y-.02,0],performance:{renderCount,geometryUpdates}};},
    capture(){renderScene();return canvas.toDataURL('image/png');},
    renderAt(p,cam){state.playing=false;changeProgress(p);if(cam){state.options.autoCamera=false;chooseCamera(cam,true);}updateGeometry();updateParticles();renderScene();updateLabels();return publicState();}
  };
  window.mineDemo=api;
  // 拖动绕当前观察点旋转，滚轮缩放；均为本地视角操作。
  let dragging=false,lastPointer={x:0,y:0};
  canvas.addEventListener('pointerdown',e=>{dragging=true;lastPointer={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);state.options.autoCamera=false;emit();});
  canvas.addEventListener('pointerup',()=>{dragging=false;});canvas.addEventListener('pointercancel',()=>{dragging=false;});
  canvas.addEventListener('pointermove',e=>{
    if(!dragging)return;
    const dx=e.clientX-lastPointer.x,dy=e.clientY-lastPointer.y;lastPointer={x:e.clientX,y:e.clientY};
    const sph=new T.Spherical().setFromVector3(targetPos.clone().sub(targetLook));
    sph.theta-=dx*.007;sph.phi=clamp(sph.phi-dy*.006,.14,Math.PI*.87);
    targetPos.copy(targetLook).add(new T.Vector3().setFromSpherical(sph));
  });
  canvas.addEventListener('wheel',e=>{e.preventDefault();state.options.autoCamera=false;const v=targetPos.clone().sub(targetLook);v.multiplyScalar(Math.exp(clamp(e.deltaY,-150,150)*.0014));v.setLength(clamp(v.length(),2.6,48));targetPos.copy(targetLook).add(v);emit();},{passive:false});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  function animate(ms){
    const dt=Math.min(.10,(ms-(lastRAF||ms))/1000);lastRAF=ms;if(state.playing)elapsed+=dt*state.speed;
    if(state.playing){
      const p=Math.min(1,state.progress+dt*state.speed/96);Object.assign(state,sample(p));needsUpdate=true;
      if(state.options.autoCamera){
        const name=p>.98?'overview':stages[state.stageIndex].camera;
        if(name!==state.camera||name==='mining'||name==='grout')chooseCamera(name);
      }
      if(p>=1){state.playing=false;emit();}
    }
    if((needsUpdate||oldProgress!==state.progress)&&(!state.playing||ms-lastGeometry>=32)){
      updateGeometry();updateParticles();lastGeometry=ms;
    }
    const moving=camera.position.distanceToSquared(targetPos)>1e-7||look.distanceToSquared(targetLook)>1e-7;
    if(moving){
      const alpha=dragging?1:1-Math.exp(-13*dt);
      camera.position.lerp(targetPos,alpha);look.lerp(targetLook,alpha);camera.lookAt(look);
    }
    if(renderDirty||moving){
      renderScene();renderCount++;
      if(ms-lastLabels>32||!moving){updateLabels();lastLabels=ms;}
      renderDirty=false;
      canvas.dataset.renderCount=String(renderCount);canvas.dataset.geometryUpdates=String(geometryUpdates);
    }
    if(state.playing&&ms-lastUI>100){emit();lastUI=ms;}
    requestAnimationFrame(animate);
  }
  updateGeometry();requestAnimationFrame(animate);
  const loading=document.getElementById('scene-loading');if(loading)loading.hidden=true;
  document.dispatchEvent(new CustomEvent('mine:ready',{detail:publicState()}));
})();
