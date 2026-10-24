/* 智能注浆原理演示 v0.3 — 覆岩三带、同步对照；所有变形为定性可视化。 */
(() => {
  'use strict';
  const T = window.THREE;
  const canvas = document.getElementById('scene-canvas');
  const labelRoot = document.getElementById('scene-labels');
  if (!T || !canvas || !labelRoot) throw new Error('三维场景所需组件未就绪');
  const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
  const smooth = (a,b,x) => { const v=clamp((x-a)/(b-a)); return v*v*(3-2*v); };
  const mix = (a,b,t) => a+(b-a)*t;
  const stages = [
    {at:0, title:'结构与监测布置', text:'井下巷道向上布置监测杆，到达煤层上方50米处的目标岩层。地面注浆管单独布置。', camera:'overview'},
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
    glass:new T.MeshPhysicalMaterial({color:'#c5e4ee',transparent:true,opacity:.085,roughness:.15,metalness:.1,depthWrite:false,side:T.DoubleSide})
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
  const layers=[
    {a:-.55,b:0,c:'#8b8379',name:'底板'},
    {a:0,b:.46,c:'#2c3339',name:'煤层'},
    {a:.46,b:1.34,c:'#a59680',name:'下部岩层'},
    {a:1.34,b:2.15,c:'#c0b299',name:'砂岩层'},
    {a:2.15,b:2.92,c:'#968c7e',name:'层状岩体'},
    {a:2.92,b:3.65,c:'#b9a992',name:'离层下部岩层'},
    {a:3.65,b:4.43,c:'#c8bba4',name:'目标岩层'},
    {a:4.43,b:5.50,c:'#afa38f',name:'上覆岩层'},
    {a:5.50,b:6.64,c:'#d0c2aa',name:'上部岩层'},
    {a:6.64,b:7.05,c:'#9c9471',name:'地表覆盖层'}
  ];
  const layerMeshes=[];
  function layerGeometry(a,b){
    const positions=[],uv=[];const n=48;
    function tri(v1,v2,v3){const flat=v1[1]===v2[1]&&v2[1]===v3[1];for(const v of[v1,v2,v3]){positions.push(...v);uv.push((v[0]+6)/4,flat?(v[2]+1.65)/2:(v[1]-a)/(b-a));}}
    function quad(a,b,c,d){tri(a,b,c);tri(a,c,d);}
    for(let j=0;j<n;j++){
      const x=-6+j*12/n,X=x+12/n;
      quad([x,a,1.65],[X,a,1.65],[X,b,1.65],[x,b,1.65]);
      quad([X,a,-1.65],[x,a,-1.65],[x,b,-1.65],[X,b,-1.65]);
      const nz=a>=5.5?18:1;
      for(let k=0;k<nz;k++){
        const z=-1.65+k*3.3/nz,Z=z+3.3/nz;
        quad([x,b,Z],[X,b,Z],[X,b,z],[x,b,z]);
        quad([x,a,z],[X,a,z],[X,a,Z],[x,a,Z]);
      }
    }
    quad([-6,a,-1.65],[-6,a,1.65],[-6,b,1.65],[-6,b,-1.65]);
    quad([6,a,1.65],[6,a,-1.65],[6,b,-1.65],[6,b,1.65]);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
  }
  layers.forEach((d,i)=>{
    if(i===1)return;
    const g=layerGeometry(d.a,d.b),mat=new T.MeshStandardMaterial({map:rockTex(d.c),roughness:.94,metalness:0,side:T.DoubleSide});
    if(i===9){g.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(1),3));mat.vertexColors=true;}
    const m=new T.Mesh(g,mat);m.receiveShadow=true;m.castShadow=true;world.add(m);
    layerMeshes.push({m,idx:i,base:g.attributes.position.array.slice()});
  });
  const coal=[];
  for(let j=0;j<80;j++){const x=-6+(j+.5)*12/80;coal.push(box(.149,.46,3.3,mats.coal,x,.23,0));}
  const miningVolume=window.createMiningVolume({THREE:T,parent:world,materials:mats,
    clearanceAt:(x,z)=>.46+deflect(x,2)});
  const workface=miningVolume.group;
  const zones=window.createOverburdenZones({THREE:T,parent:world,deflect});
  layerMeshes.forEach(o=>{if(zones.replacementLayerIndices.includes(o.idx))o.m.visible=false;});
  // 井下巷道剖口与监测站；杆件仅向上至目标层，不延伸至地表。
  box(2.1,.10,.8,mats.dark,-3.15,-.055,2.04);
  const roadway=new T.Group();world.add(roadway);
  for(let i=0;i<4;i++){
    const x=-4.0+i*.65;
    link([x,-.02,2.43],[x,.41,2.43],.025,mats.metal,roadway);
    link([x,.41,2.43],[x,.41,1.72],.025,mats.metal,roadway);
  }
  const rodMat=new T.MeshStandardMaterial({color:'#bdc9cc',metalness:.88,roughness:.23});
  const rod=new T.Group();world.add(rod);
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
  const head=box(.20,.12,.18,mats.metal,-2.45,3.83,1.78,rod);
  const rodReference=line([[-2.45,.12,1.84],[-2.45,3.83,1.84]],'#55737e',world,true);
  const rodDisplacement=line([[-2.45,2,1.85],[-2.45,2,1.85]],'#df9834');
  const sensorBox=box(.44,.23,.21,mats.teal,-3.10,.20,2.41);
  const sensorLED=new T.Mesh(new T.SphereGeometry(.035,12,8),new T.MeshBasicMaterial({color:'#38c5ae'}));sensorLED.position.set(-3.0,.23,2.53);world.add(sensorLED);
  const cable=line([[-3.1,.27,2.48],[-2.45,.27,2.15],[-2.45,3.85,1.83]],'#1c847c');
  const signalLine=line([[-3.1,.30,2.45],[-5.85,.3,2.3],[-6.18,.3,2.2],[-6.18,7.7,1.8],[-4.45,7.7,1.75]],'#3b8a8c',world,true);
  const pump=new T.Group();world.add(pump);
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
  link([-3.82,7.42,.72],[-3.82,7.88,1.95],.065,mats.pipe,pump);
  const surfacePipe=link([-3.82,7.88,1.95],[-.72,7.88,1.95],.065,mats.pipe);
  const downPipe=link([-.72,7.88,1.95],[-.72,3.65,1.95],.055,mats.pipe);
  // 外侧管路为剖示，末端沿厚度方向进入离层内部，与三维扩散源点相连。
  const inletGroup=new T.Group();world.add(inletGroup);
  link([-.72,0,1.95],[-.72,0,.16],.049,mats.pipe,inletGroup);
  link([-.72,0,.16],[-.92,0,0],.049,mats.pipe,inletGroup);
  const nozzle=link([-.92,0,0],[-.92,-.02,0],.058,mats.metal,inletGroup);
  const cap=box(.22,.10,.30,mats.dark,-.72,7.11,1.65);
  const groutVolume=window.createGroutVolume({THREE:T,parent:world,
    gapAt:(x,z)=>({bottom:3.65+deflect(x,5),top:3.65+deflect(x,6)}),
    source:{x:-.92,z:0},bounds:{minX:-4.7,maxX:1.2,minZ:-1.65,maxZ:1.65}});
  const surfaceLine=line([[0,7.05,1.68],[1,7.05,1.68]],'#087c74');
  const counterLine=line([[0,7.05,1.71],[1,7.05,1.71]],'#71818b',world,true);
  const surfaceCracks=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({color:'#625348'}));world.add(surfaceCracks);
  const targetLine=line([[0,3.66,1.68],[1,3.66,1.68]],'#e2b44c');
  // 原型高度参照，不对应已验证的几何相似比。
  const refGroup=new T.Group();world.add(refGroup);
  line([[5.2,.46,1.81],[5.72,.46,1.81],[5.72,3.83,1.81],[5.2,3.83,1.81]],'#506b71',refGroup);
  for(const y of[.46,3.83])line([[5.57,y+(y<1?.17:-.17),1.81],[5.72,y,1.81],[5.87,y+(y<1?.17:-.17),1.81]],'#506b71',refGroup);
  // 实验箱框架和浅透明侧板。
  const floorMat=new T.MeshStandardMaterial({color:'#d4dcdd',roughness:.85});
  box(13.4,.23,4.8,mats.dark,0,-.72,0,lab);
  for(const x of[-6.3,6.3])for(const z of[-2.12,2.12]){
    box(.10,8.0,.10,mats.metal,x,3.20,z,lab);
    box(.20,.85,.20,mats.dark,x,-1.22,z,lab);
  }
  for(const y of[-.57,7.17]){
    for(const z of[-2.12,2.12])box(12.7,.10,.10,mats.metal,0,y,z,lab);
    for(const x of[-6.3,6.3])box(.10,.10,4.3,mats.metal,x,y,0,lab);
  }
  box(.025,7.6,4.10,mats.glass,6.26,3.28,0,lab);
  box(.025,7.6,4.10,mats.glass,-6.26,3.28,0,lab);
  // 地表模式仅添加示意建筑与植被，地层仍使用同一控制区。
  const buildings=[];
  function building(x,z,w,h,d){
    const g=new T.Group();mine.add(g);g.position.set(x,7.05,z);
    box(w,h,d,new T.MeshStandardMaterial({color:'#d8d8cd',roughness:.9}),0,h/2,0,g);
    box(w+.12,.10,d+.12,mats.dark,0,h+.04,0,g);
    for(let j=0;j<3;j++)box(w*.16,h*.30,.015,new T.MeshStandardMaterial({color:'#7597a0',metalness:.15,roughness:.35}),-w*.32+j*w*.32,h*.6,d/2+.01,g);
    buildings.push(g);
  }
  building(.15,-.65,.85,.65,.70);building(3.8,-.65,.85,.83,.72);
  const trees=[];
  for(let i=0;i<5;i++){
    const x=.65+i*1.02,z=-1.18;
    const tree=new T.Group();tree.position.set(x,7.05,z);mine.add(tree);trees.push(tree);
    link([0,0,0],[0,.50,0],.035,new T.MeshStandardMaterial({color:'#6f6452'}),tree);
    const m=new T.Mesh(new T.ConeGeometry(.23,.65,8),new T.MeshStandardMaterial({color:'#667f63',roughness:1}));m.position.set(0,.63,0);tree.add(m);
  }
  const floor=box(200,.2,200,floorMat,0,-1.85,0,scene);floor.receiveShadow=true;
  const grid=new T.GridHelper(32,32,'#c6d1d4','#d7dfe1');grid.position.y=-1.74;scene.add(grid);
  const labels=[];
  function addLabel(id,text,pos,views=['overview'],tone='neutral'){
    const e=document.createElement('div');e.className=`scene-label scene-label--${tone}`;e.textContent=text;e.dataset.label=id;
    const right=e.cloneNode(true);right.dataset.case='untreated';labelRoot.append(e,right);labels.push({e,right,pos,views});return e;
  }
  addLabel('pump','地面注浆泵与控制器',()=>[-4.4,8.35,.6],['overview','grout']);
  addLabel('target','目标岩层',()=>[2.0,4.22+deflect(2,6),1.72],['overview','sensor','grout'],'target');
  addLabel('coal','煤层',()=>[4.5,.27,1.9],['overview','mining']);
  addLabel('goaf','工作面后方采空区',()=>[-3.8,.37,1.9],['mining']);
  addLabel('face','沿模型厚度布置的开采工作面',()=>[face,.65,0],['mining'],'active');
  addLabel('rod','井下向上布置的金属监测杆',()=>[-2.43,2.0,2.0],['overview'],'active');
  addLabel('gauge','应变片随杆弯曲 · 形变放大',()=>[rodPoint(.6).x,rodPoint(.6).y,1.98],['sensor'],'active');
  addLabel('rod-original','虚线：杆件初始位置',()=>[-2.45,3.83,1.84],['sensor']);
  addLabel('roadway','井下巷道／监测接入点',()=>[-3.45,-.10,2.5],['mining']);
  addLabel('pipe','独立注浆钻孔',()=>[-.65,5.8,2.1],['overview','grout']);
  addLabel('gap','离层内部 · 浆液逐步扩散填充',()=>[-2.7,3.65+deflect(-2.7,6),-.8],['grout'],'active');
  addLabel('outlet','管口 · 三维扩散起点',()=>[-.92,3.65+(deflect(-.92,5)+deflect(-.92,6))/2,0],['grout'],'target');
  addLabel('rear','背面观察 · 同一三维控制区',()=>[0,3.65+deflect(0,6),-1.7],['back'],'active');
  addLabel('height','煤层上方50米（原型参考）',()=>[5.72,2.2,1.9],['overview']);
  addLabel('surface','实线：当前地表 · 虚线：初始',()=>[1.8,7.1+deflect(1.8,9),1.8],['surface'],'active');
  const zonePins=[];
  for(const [id,title,description,y,idx] of [
    ['bending','弯曲下沉带','连续层理 · 整体弯沉',5.15,7],
    ['fractured','裂隙带','层状断裂 · 层间离层',2.55,4],
    ['caving','垮落带','破碎转动 · 架后堆积',.68,2]
  ]){
    for(let side=0;side<2;side++){
      const e=document.createElement('div'),line=document.createElement('div'),dot=document.createElement('div');
      e.className=`zone-pin zone-pin--${id}`;e.dataset.zone=id;e.dataset.case=side?'untreated':'treated';
      const name=document.createElement('strong'),note=document.createElement('small');name.textContent=title;note.textContent=description;e.append(name,note);
      line.className=`zone-leader zone-pin--${id}`;dot.className=`zone-anchor zone-pin--${id}`;
      labelRoot.append(line,dot,e);zonePins.push({e,line,dot,note,description,side,y,idx,id});
    }
  }
  const camDefs={
    overview:{pos:[14.5,11.4,20.7],target:[0,3.25,0]},
    mining:{pos:[2.0,2.3,8.4],target:[-2,.35,0]},
    zones:{pos:[-.65,4.85,12.2],target:[-.65,3.4,0]},
    sensor:{pos:[.2,4.9,9.0],target:[-2.4,2.2,1.25]},
    grout:{pos:[4.2,8.9,8.3],target:[-1.5,3.3,0]},
    back:{pos:[-12.0,8.4,-17.7],target:[-.7,3.4,0]},
    surface:{pos:[2.8,16.5,9.0],target:[-1.9,6.65,0]}
  };
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
    const skin=idx===9?1:idx===8?smooth(5.5,6.64,y):0;
    return deflect(x,idx)+skin*craterOffset(x,z);
  }
  function rodPoint(t){
    const disp=deflect(-2.45,6),bend=state.metrics[evaluatingCounter?'untreated':'settlement']*(state.options.exaggeration?.85:.36);
    const coupling=1-smooth(face-1.40,face-1.05,-2.45);
    return new T.Vector3(-2.45+Math.sin(t*Math.PI)*bend*coupling,.12+t*(3.83+disp-.12),1.81);
  }
  function updateCase(){
    const p=state.progress;
    face=mix(-4.8,4.7,smooth(.12,.80,p));
    miningVolume.update({face,progress:p,time:p*96});
    const oldRubble=workface.getObjectByName('全厚度稀疏有限碎裂');if(oldRubble)oldRubble.visible=false;
    zones.update({progress:p,face,exaggeration:state.options.exaggeration,treated:!evaluatingCounter,interior:state.options.interior&&state.camera==='mining'});
    coal.forEach(m=>{m.visible=m.position.x>face+.38||m.position.x< -5.90;});
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
    replaceLine(rodDisplacement,[[-2.45,middle.y,1.86],[middle.x,middle.y,1.86]]);
    rodReference.visible=state.camera==='sensor';rodDisplacement.visible=state.camera==='sensor'&&p>.25;
    replaceLine(cable,[[-3.1,.27,2.48],[-2.45,.27,2.15],...pts.filter((_,i)=>i%3===0).map(v=>[v.x-.075,v.y,v.z+.02])]);
    const gaugeColor=evaluatingCounter&&p>.65?'#da7862':!evaluatingCounter&&p>=.90?'#35b6a1':state.triggered?'#e4a33c':'#35b6a1';
    gaugeMats.forEach(m=>{m.color.set(gaugeColor);m.emissive.set(gaugeColor).multiplyScalar(.35);});
    sensorLED.material.color.set(state.triggered?'#f5b44a':'#38c5ae');
    pumpLED.material.color.set(state.pumpOn?'#3bd7ae':'#78928a');
    signalLine.material.color.set(state.triggered?'#df9633':'#3b8a8c');
    const upper=3.65+deflect(-.92,6),bottom=3.65+deflect(-.92,5);
    const end=(upper+bottom)/2;
    const pipeTop=7.88+deflect(-4.5,9);
    surfacePipe.position.y=7.88+deflect(-4.5,9);
    downPipe.position.y=(pipeTop+end)/2;downPipe.scale.y=(pipeTop-end)/(7.88-3.65);
    cap.position.y=7.11+deflect(-.72,9);
    inletGroup.position.y=end;
    for(const obj of [pump,surfacePipe,downPipe,cap,inletGroup,signalLine,groutVolume.group])obj.visible=!evaluatingCounter;
    if(!evaluatingCounter)groutVolume.update({progress:p,time:p*96,flow:state.metrics.flow,pumpOn:state.pumpOn});
    const actual=[],counter=[],target=[];
    for(let i=0;i<=80;i++){
      const x=-5.9+i*11.8/80;actual.push([x,7.06+surfaceDeflect(x,1.64),1.68]);counter.push([x,7.06,1.72]);target.push([x,3.65+deflect(x,6),1.68]);
    }
    replaceLine(surfaceLine,actual);replaceLine(counterLine,counter);replaceLine(targetLine,target);
    surfaceLine.material.color.set(evaluatingCounter?'#b45d66':'#087c74');
    counterLine.visible=state.camera==='surface';
    const crackPoints=[];
    for(let j=0;j<14;j++){
      const a=j*Math.PI*2/14;
      for(let k=0;k<4;k++){
        const radius=.85+k*.075,angle=a+Math.sin(j*3+k)*.025;
        const point=r=>{const x=-2.15+Math.cos(angle)*1.24*r,z=Math.sin(angle)*.96*r;return new T.Vector3(x,7.065+surfaceDeflect(x,z),z);};
        crackPoints.push(point(radius),point(radius+.062));
      }
    }
    surfaceCracks.geometry.setFromPoints(crackPoints);surfaceCracks.geometry.computeBoundingSphere();
    surfaceCracks.visible=evaluatingCounter&&p>.84;
    for(const g of [...buildings,...trees]){g.position.y=7.05+surfaceDeflect(g.position.x,g.position.z);g.rotation.z=(surfaceDeflect(g.position.x+.2,g.position.z)-surfaceDeflect(g.position.x-.2,g.position.z))/.4;}
    const d=deflect(-4.5,9);pump.position.y=d;
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
  function updateInspection(){
    const active=state.options.interior;
    for(const o of layerMeshes){
      const faded=active&&(o.idx>=6||(state.camera==='mining'&&o.idx>=2));
      o.m.material.transparent=faded;o.m.material.opacity=faded?.025:1;
      o.m.material.depthWrite=!faded;o.m.castShadow=!faded;
      o.m.renderOrder=faded?3:0;
    }
    groutVolume.setInspection?.(active);
    shadowDirty=true;renderDirty=true;
    const caption=document.querySelector('.scene-caption');
    if(caption)caption.textContent=active?'透视观察 · 岩层实体保留':'同步开采 · 变形及局部塌陷为定性示意';
  }
  function updateParticles(){
    wheel.rotation.z=(clamp(state.progress,.54,.90)-.54)*96*3;
  }
  function chooseCamera(name,instant=false){
    const previousCamera=state.camera,previousInterior=state.options.interior;
    if(name==='grout'&&state.camera!=='grout'&&!state.options.interior){
      state.options.interior=true;automaticInspection=true;
    }else if(name!=='grout'&&state.camera==='grout'&&automaticInspection){
      state.options.interior=false;automaticInspection=false;
    }
    const c=camDefs[name]||camDefs.overview;state.camera=name;
    updateProjection();
    targetPos.set(...c.pos);targetLook.set(...c.target);
    if(name==='mining'){
      const x=clamp(mix(-4.8,4.7,smooth(.12,.80,state.progress)),-4,3);targetLook.x=x-.6;targetPos.x=x+2.6;
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
  function resize(){
    const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
    renderer.setSize(r.width,r.height,false);updateProjection();renderDirty=true;
    for(const l of labels)l.size=null;
  }
  new ResizeObserver(resize).observe(canvas);resize();
  function updateProjection(){
    camera.aspect=canvas.clientWidth/(state.options.comparison?2:1)/canvas.clientHeight;
    camera.fov=state.options.comparison?clamp(2*Math.atan(Math.tan(55*Math.PI/360)*Math.max(1,.56/camera.aspect))*180/Math.PI,55,80):(state.camera==='zones'?55:37);
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
        if(zoneView&&['rod','target','height','rear','pipe'].includes(id))visible=false;
        if(side&&['pump','pipe','gap','outlet'].includes(id))visible=false;
        if(['caving','fractured','bending'].includes(id))visible=visible&&state.progress>.27;
        if(!visible){e.style.display='none';continue;}
        proj.set(...l.pos()).project(camera);
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
        const y=pin.id==='caving'?.64+deflect(x,2)*.45:pin.y+deflect(x,pin.idx);
        proj.set(x,y,z).project(camera);
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
