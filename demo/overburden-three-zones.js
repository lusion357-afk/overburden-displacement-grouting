/* 传统覆岩“上三带”的定性形态演示；带高、破断角和运动幅度不是工程计算值。 */
(() => {
  'use strict';
  window.createOverburdenZones = function ({ THREE:T, parent, deflect }) {
    const group = new T.Group(); group.name='覆岩三带定性体积示意'; parent.add(group);
    const replacementLayerIndices=[2,3,4,5];
    const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
    const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
    const state={progress:0,face:-4.8,exaggeration:true,treated:true,interior:false};
    let seed=851220;
    const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const range=(a,b)=>a+(b-a)*rng();
    const displacement=(x,index)=>deflect(x,index,!state.treated)||0;
    // 主场景同样采用48段折线采样，避免分界面因采样密度不同而穿插。
    const fieldValues=new Map();
    function field(x,index){const u=clamp((x+6)/12)*48,i=Math.min(47,Math.floor(u)),t=u-i,a=fieldValues.get(index);return a[i]*(1-t)+a[i+1]*t;}
    function fieldRange(left,right,index){
      const a=fieldValues.get(index);let min=Math.min(field(left,index),field(right,index)),max=Math.max(field(left,index),field(right,index));
      for(let i=Math.max(0,Math.ceil((left+6)*4));i<=Math.min(48,Math.floor((right+6)*4));i++){min=Math.min(min,a[i]);max=Math.max(max,a[i]);}
      return {min,max};
    }
    function weight(x){return smooth(1.45,2.20,state.face-x)*smooth(-5.25,-4.70,x)*(1-smooth(2.10,3.80,x));}
    const corners=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
    const faces=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5];
    function rockMesh(name,cells){
      const g=new T.BufferGeometry(),n=cells.length*36;
      g.setAttribute('position',new T.BufferAttribute(new Float32Array(n*3),3).setUsage(T.DynamicDrawUsage));
      g.setAttribute('color',new T.BufferAttribute(new Float32Array(n*3),3).setUsage(T.DynamicDrawUsage));
      const m=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true}));
      m.name=name;m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;group.add(m);return m;
    }
    function makeCells(nx,nz,levels,randomness){
      const nodes=Array.from({length:nx+1},(_,i)=>i===0?-6:i===nx?6:-6+i*12/nx+range(-randomness,randomness));
      const cells=[];
      for(const [row,level] of levels.entries())for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++){
        const x0=nodes[ix],x1=nodes[ix+1],z0=-1.65+iz*3.3/nz,z1=z0+3.3/nz;
        const base=corners.map(([a,b,c])=>{
          const x=a<0?x0:x1,y=b<0?level.bottom:level.top,edge=ix+(a>0?1:0);
          // 同层相邻块体共享斜切面，初始严密拼合，开裂后形成斜向贯穿裂缝。
          const skew=edge===0||edge===nx?0:Math.sin(edge*1.7+row)*.13*b;
          return new T.Vector3(x+skew,y,c<0?z0:z1);
        });
        cells.push({base,x:(x0+x1)/2,z:(z0+z1)/2,row,index:level.index,bottom:level.bottom,top:level.top,
          width:x1-x0,depth:z1-z0,tone:range(.78,1.10),tilt:range(-.7,.7),yaw:range(-.22,.22),color:new T.Color(level.color)});
      }
      return cells;
    }
    const cavingLevels=Array.from({length:3},(_,i)=>({bottom:.46+i*.88/3,top:.46+(i+1)*.88/3,index:2,color:'#aa9277'}));
    const cavingCells=makeCells(24,6,cavingLevels,.075);
    const fractureCells=makeCells(18,6,[
      {bottom:1.34,top:2.15,index:3,color:'#bdaa88'},
      {bottom:2.15,top:2.92,index:4,color:'#9e927d'},
      {bottom:2.92,top:3.65,index:5,color:'#c5b493'}
    ],.15);
    const lower=rockMesh('近顶板有限垮落块体',cavingCells);
    const fractured=rockMesh('贯穿厚度的裂隙带岩体',fractureCells);
    const guideGroup=new T.Group();guideGroup.name='三带边界与连续层理';group.add(guideGroup);
    const guideDefs=[];
    function guide(name,color,levels,dashed=false){
      const material=dashed?new T.LineDashedMaterial({color,dashSize:.13,gapSize:.08,transparent:true,opacity:.8}):new T.LineBasicMaterial({color,transparent:true,opacity:.65});
      const mesh=new T.LineSegments(new T.BufferGeometry(),material);mesh.name=name;mesh.frustumCulled=false;guideGroup.add(mesh);
      guideDefs.push({mesh,levels,dashed});
    }
    guide('垮落带上缘示意','#af573e',[[1.34,2]],true);
    guide('裂隙带上缘示意','#a67b27',[[3.65,6]],true);
    guide('弯曲带连续层理','#436f70',[[3.96,6],[4.65,7],[5.06,7],[5.73,8],[6.14,8]]);
    guide('弯曲带初始层理参照','#8b989a',[[4.65,7]],true);
    let stats={localizedBlocks:0,openedFractureCells:0,maxCrackWidth:0};
    const rotated=new T.Vector3(),rotation=new T.Euler(),matrix=new T.Matrix4(),color=new T.Color();
    function writeCell(mesh,cell,i,points,amount){
      const a=mesh.geometry.attributes.position.array,c=mesh.geometry.attributes.color.array;
      color.copy(cell.color).multiplyScalar(1+(cell.tone-1)*amount);
      faces.forEach((k,j)=>{const offset=(i*36+j)*3,p=points[k];a[offset]=p.x;a[offset+1]=p.y;a[offset+2]=p.z;c[offset]=color.r;c[offset+1]=color.g;c[offset+2]=color.b;});
    }
    function update(next={}){
      Object.assign(state,next);state.progress=clamp(state.progress);
      for(const index of [2,3,4,5,6,7,8])fieldValues.set(index,Array.from({length:49},(_,i)=>displacement(-6+i*.25,index)));
      const development=.50*smooth(.27,.51,state.progress)+(state.treated?.23:.48)*smooth(.54,.94,state.progress);
      const gain=state.exaggeration?1:.55;
      stats={localizedBlocks:0,openedFractureCells:0,maxCrackWidth:0,front:0,back:0,interior:0};
      cavingCells.forEach((cell,i)=>{
        const broken=weight(cell.x)*development,amount=broken*gain;
        const center=new T.Vector3(cell.x,(cell.bottom+cell.top)/2,cell.z);
        rotation.set(cell.tilt*amount*.55,cell.yaw*amount,cell.tilt*amount);matrix.makeRotationFromEuler(rotation);
        const scale=new T.Vector3(1-.25*amount,1-.15*amount,1-.23*amount);
        const points=cell.base.map(p=>rotated.copy(p).sub(center).multiply(scale).applyMatrix4(matrix).clone());
        // 架后下落、转动和堆积；每排完整包络受底板及上覆裂隙层约束。
        let minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
        const envelope=fieldRange(cell.x+Math.min(...points.map(p=>p.x)),cell.x+Math.max(...points.map(p=>p.x)),2).min;
        const floor=.46*(1-broken)+.025*broken,ceiling=1.34+envelope-.012*broken;
        const slot=(ceiling-floor)/3,allowed=slot*(1-.10*amount),fit=Math.min(1,allowed/(maxY-minY));
        points.forEach(p=>p.y*=fit);minY*=fit;maxY*=fit;
        const centerY=floor+slot*(cell.row+.5)-(minY+maxY)/2;
        points.forEach(p=>{p.x+=cell.x;p.y+=centerY;p.z+=cell.z;});
        writeCell(lower,cell,i,points,broken);
        if(broken>.025){stats.localizedBlocks++;cell.z>1?stats.front++:cell.z< -1?stats.back++:stats.interior++;}
      });
      fractureCells.forEach((cell,i)=>{
        const opened=weight(cell.x)*development*(cell.index===3?1:cell.index===4?.86:.66),amount=opened*gain;
        const gap=.15*amount,width=1-gap/cell.width,depth=1-.085*amount;
        const left=cell.x+Math.min(...cell.base.map(p=>p.x-cell.x))*width,right=cell.x+Math.max(...cell.base.map(p=>p.x-cell.x))*width;
        const envelope=fieldRange(left,right,cell.index),margin=envelope.min< -1e-8?.00003:0;
        const points=cell.base.map(p=>{
          const x=cell.x+(p.x-cell.x)*width,z=cell.z+(p.z-cell.z)*depth;
          const bottom=p.y===cell.bottom;
          const y=p.y+(bottom?envelope.max:envelope.min)+(bottom?1:-1)*(.035*amount+margin);
          return new T.Vector3(x,y,z);
        });
        writeCell(fractured,cell,i,points,opened);
        if(opened>.025)stats.openedFractureCells++;
        stats.maxCrackWidth=Math.max(stats.maxCrackWidth,gap);
      });
      for(const m of [lower,fractured]){m.geometry.attributes.position.needsUpdate=true;m.geometry.attributes.color.needsUpdate=true;m.geometry.computeVertexNormals();}
      for(const d of guideDefs){
        const pts=[],end=Math.min(1.8,state.face-1.55);
        for(const z of [-1.662,1.662])for(const [y,index] of d.levels){
          const initial=d.mesh.name==='弯曲带初始层理参照';
          for(let i=0;i<48;i++){
            const x=Math.min(-5+i*7/48,Math.max(-5,end)),X=Math.min(-5+(i+1)*7/48,Math.max(-5,end));
            pts.push(new T.Vector3(x,y+(initial?0:field(x,index)),z),new T.Vector3(X,y+(initial?0:field(X,index)),z));
          }
        }
        d.mesh.geometry.setFromPoints(pts);if(d.dashed)d.mesh.computeLineDistances();
        d.mesh.visible=state.progress>.28&&end> -4.8;
      }
      const changed=fractured.material.transparent!==state.interior;
      fractured.material.transparent=state.interior;fractured.material.opacity=state.interior?.32:1;
      fractured.material.depthWrite=!state.interior;if(changed)fractured.material.needsUpdate=true;
      fractured.castShadow=!state.interior;fractured.renderOrder=state.interior?2:0;
      return {...stats};
    }
    return {group,update,replacementLayerIndices,
      getAnchors:()=>({caving:[-2.5,.56,1.72],fractured:[-2.5,2.3+displacement(-2.5,4),1.72],bending:[-2.5,5.2+displacement(-2.5,7),1.72]}),
      diagnostics:()=>({...state,...stats,instanceCounts:{cavingBlocks:cavingCells.length,fractureBlocks:fractureCells.length},drawCalls:6,modelDepth:[-1.65,1.65],deterministic:true,
        caveat:'传统三带的形态及范围示意，不是实测带高；近顶板局部垮落不等于目标层大范围垮落。'})};
  };
})();
