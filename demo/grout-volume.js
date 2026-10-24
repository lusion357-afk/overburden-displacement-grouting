/* 局部离层浆液外观演示：流动、积聚、凝固时间均为压缩示意，非流体数值求解。 */
(() => {
  'use strict';
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const smooth=(a,b,x)=>{const q=clamp((x-a)/(b-a));return q*q*(3-2*q);};
  const mix=(a,b,t)=>a+(b-a)*t;

  window.createGroutVolume=function createGroutVolume({THREE:T,parent,gapAt,source,bounds}) {
    if(!T||typeof gapAt!=='function')throw new Error('浆液模块需要 THREE 和离层上下边界');
    const B={...bounds},S={x:source.x,z:source.z};
    const group=new T.Group();group.name='局部离层内三维浆体';
    group.userData.description='受离层上下表面约束的局部扩散外观；非经过标定的工程模拟';
    if(parent)parent.add(group);
    const ANGLES=128,RINGS=24,PER=1+ANGLES*RINGS,COUNT=PER*2;
    const positions=new Float32Array(COUNT*3),uv=new Float32Array(COUNT*2),indices=[];
    const id=(ring,angle,lower=false)=>(lower?PER:0)+(ring===0?0:1+(ring-1)*ANGLES+(angle+ANGLES)%ANGLES);
    const tri=(a,b,c)=>indices.push(a,b,c);
    for(let a=0;a<ANGLES;a++) {
      tri(id(0,0),id(1,a+1),id(1,a));
      tri(id(0,0,true),id(1,a,true),id(1,a+1,true));
      for(let r=1;r<RINGS;r++) {
        tri(id(r,a),id(r+1,a+1),id(r+1,a));
        tri(id(r,a),id(r,a+1),id(r+1,a+1));
        tri(id(r,a,true),id(r+1,a,true),id(r+1,a+1,true));
        tri(id(r,a,true),id(r+1,a+1,true),id(r,a+1,true));
      }
      tri(id(RINGS,a,true),id(RINGS,a),id(RINGS,a+1));
      tri(id(RINGS,a,true),id(RINGS,a+1),id(RINGS,a+1,true));
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
    geometry.setAttribute('uv',new T.BufferAttribute(uv,2).setUsage(T.DynamicDrawUsage));
    geometry.setIndex(indices);

    // Fine aggregate is attached to the surface, never represented by floating spheres.
    const N=256,grain=new Uint8Array(N*N*4);
    const hash=(x,z)=>{const q=Math.sin(x*127.1+z*311.7)*43758.5453;return q-Math.floor(q);};
    for(let z=0;z<N;z++)for(let x=0;x<N;x++){
      const h=hash(x,z),speck=h>.94?39:0,c=Math.round(83+h*94+speck),i=4*(z*N+x);
      grain[i]=grain[i+1]=grain[i+2]=c;grain[i+3]=255;
    }
    const grainMap=new T.DataTexture(grain,N,N,T.RGBAFormat);
    grainMap.wrapS=grainMap.wrapT=T.RepeatWrapping;grainMap.magFilter=T.LinearFilter;
    grainMap.minFilter=T.LinearMipmapLinearFilter;grainMap.generateMipmaps=true;grainMap.needsUpdate=true;
    grainMap.anisotropy=4;
    const uniforms={uGroutClock:{value:0},uGroutWet:{value:1},uGroutFlow:{value:0},uGroutCure:{value:0}};
    const material=new T.MeshPhysicalMaterial({color:'#66645e',roughness:.47,metalness:0,
      clearcoat:.13,clearcoatRoughness:.32,bumpMap:grainMap,bumpScale:.0065,side:T.DoubleSide});
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader='varying vec3 vGroutPosition;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvGroutPosition = position;');
      shader.fragmentShader=`
        varying vec3 vGroutPosition;
        uniform float uGroutClock;
        uniform float uGroutWet;
        uniform float uGroutFlow;
        uniform float uGroutCure;
        float groutHash(vec3 p) {return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
        float groutNoise(vec3 p) {
          vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
          return mix(mix(mix(groutHash(i),groutHash(i+vec3(1,0,0)),f.x),
                         mix(groutHash(i+vec3(0,1,0)),groutHash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(groutHash(i+vec3(0,0,1)),groutHash(i+vec3(1,0,1)),f.x),
                         mix(groutHash(i+vec3(0,1,1)),groutHash(i+vec3(1,1,1)),f.x),f.y),f.z);
        }
      `+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
        #include <color_fragment>
        vec3 gp=vGroutPosition;
        float aggregate=groutNoise(gp*73.0);
        float coarse=groutNoise(gp*11.0);
        float mottling=groutNoise(gp*3.8);
        float radial=length((gp.xz-vec2(${S.x.toFixed(6)},${S.z.toFixed(6)}))*vec2(.64,1.0));
        float stream=sin(radial*35.0-groutNoise(gp*5.3)*5.8-uGroutClock*1.7);
        float folds=pow(.5+.5*stream,3.0);
        float wetStreak=(folds-.38)*.105*uGroutWet*(.32+uGroutFlow);
        diffuseColor.rgb*=.71+aggregate*.29+coarse*.17+mottling*.12+wetStreak;
        float grains=smoothstep(.70,.92,aggregate);
        diffuseColor.rgb-=grains*(.026+.043*uGroutCure);
        // A few pale grains within the same gray cement palette, fixed in the surface.
        diffuseColor.rgb+=smoothstep(.84,.98,coarse)*.025;
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
        #include <normal_fragment_maps>
        #ifdef USE_BUMPMAP
          // Low-height cohesive folds modulate lighting; no displaced particles or water waves.
          float groutSurfaceHeight=aggregate*(.005+.004*uGroutCure)
            +coarse*.007+folds*(.003+.007*uGroutWet);
          normal=perturbNormalArb(-vViewPosition,normal,
            vec2(dFdx(groutSurfaceHeight),dFdy(groutSurfaceHeight)),faceDirection);
        #endif
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
        #include <roughnessmap_fragment>
        roughnessFactor=clamp(roughnessFactor+(aggregate-.5)*.18+(coarse-.5)*.12, .35, 1.0);
      `);
    };
    material.customProgramCacheKey=()=>`grout-volume-v3-${S.x}-${S.z}`;
    const body=new T.Mesh(geometry,material);body.name='闭合浆体：顶、底、前后与边界';
    body.castShadow=true;body.receiveShadow=true;body.visible=false;group.add(body);

    // Short continuous inlet stream: anchored at the borehole opening and joined to the puddle.
    const JS=18,JA=14,JP=2+(JS+1)*JA,jetPos=new Float32Array(JP*3),jetUv=new Float32Array(JP*2),jetIdx=[];
    const jid=(s,a)=>2+s*JA+(a+JA)%JA;
    for(let a=0;a<JA;a++){
      jetIdx.push(0,jid(0,a),jid(0,a+1));
      jetIdx.push(1,jid(JS,a+1),jid(JS,a));
      for(let j=0;j<JS;j++)jetIdx.push(jid(j,a),jid(j+1,a),jid(j+1,a+1),jid(j,a),jid(j+1,a+1),jid(j,a+1));
    }
    const jetGeometry=new T.BufferGeometry();jetGeometry.setAttribute('position',new T.BufferAttribute(jetPos,3).setUsage(T.DynamicDrawUsage));
    jetGeometry.setAttribute('uv',new T.BufferAttribute(jetUv,2));jetGeometry.setIndex(jetIdx);
    const jetMaterial=material.clone();jetMaterial.onBeforeCompile=material.onBeforeCompile;
    jetMaterial.customProgramCacheKey=material.customProgramCacheKey;jetMaterial.color.set('#77756e');
    const jet=new T.Mesh(jetGeometry,jetMaterial);jet.name='与入口连接的连续灰浆流';jet.visible=false;
    jet.castShadow=true;jet.receiveShadow=true;group.add(jet);

    let latest={progress:0,time:0,flow:0,pumpOn:false,stage:'待注浆',cure:0},initialized=false;
    let inspection=false,boundViolations=0,invalidGaps=0,minGap=0,maxGap=0;
    function gap(x,z){
      const g=gapAt(x,z),b=Number(g&&g.bottom),t=Number(g&&g.top);
      if(!Number.isFinite(b)||!Number.isFinite(t)||t<b){invalidGaps++;return {bottom:Number.isFinite(b)?b:0,top:Number.isFinite(b)?b:0};}
      return {bottom:b,top:t};
    }
    function writeVertex(index,x,z,r,angle,p,time,flow,cure){
      x=clamp(x,B.minX,B.maxX);z=clamp(z,B.minZ,B.maxZ);
      const g=gap(x,z),height=g.top-g.bottom,margin=Math.min(.0014,height*.025);
      minGap=Math.min(minGap,height);maxGap=Math.max(maxGap,height);
      const available=Math.max(0,height-2*margin),edge=smooth(.78,1,r);
      const fill=mix(.13,.94,smooth(.54,.90,p))*(1-.43*edge);
      const motion=(1-cure)*flow;
      const ripple=(Math.sin(r*41-angle*2-time*3.6)+.5*Math.sin(r*67+angle*5-time*2.1))*available*.032*motion;
      const granular=(hash(x*51,z*51)-.5)*available*.028*cure;
      const bottom=g.bottom+margin;
      const top=clamp(bottom+available*fill+ripple+granular,bottom,g.top-margin);
      const put=(i,y)=>{positions[3*i]=x;positions[3*i+1]=y;positions[3*i+2]=z;uv[2*i]=x*1.35;uv[2*i+1]=z*1.35;};
      put(index,top);put(index+PER,bottom);
      if(top>g.top+1e-6||bottom<g.bottom-1e-6)boundViolations++;
      return {top,bottom};
    }
    function updateJet(p,time,flow,cure,center){
      const g=gap(S.x,S.z),startY=(g.bottom+g.top)*.5-.012;
      jet.visible=latest.pumpOn&&flow>.006&&g.top-g.bottom>.012&&center.top<startY+.008;
      if(!jet.visible)return;
      const length=.13+.13*flow,rad=.013+.011*flow;
      const write=(idx,x,y,z)=>{
        x=clamp(x,B.minX,B.maxX);z=clamp(z,B.minZ,B.maxZ);const gg=gap(x,z),m=Math.min(.0007,(gg.top-gg.bottom)*.02);
        jetPos[3*idx]=x;jetPos[3*idx+1]=clamp(y,gg.bottom+m,gg.top-m);jetPos[3*idx+2]=z;
      };
      const middle=t=>({x:S.x-length*t*t,y:mix(startY,center.top-.006,t),z:S.z+.008*Math.sin(t*4-time*3)*t});
      let c=middle(0);write(0,c.x,c.y,c.z);c=middle(1);write(1,c.x,c.y,c.z);
      for(let j=0;j<=JS;j++){
        const t=j/JS,c=middle(t),radius=rad*(1+.22*Math.sin(t*11-time*5))*(1+.8*t);
        for(let a=0;a<JA;a++){
          const v=a/JA*Math.PI*2,i=jid(j,a);
          write(i,c.x+Math.cos(v)*radius,c.y+Math.cos(v)*radius*.27,c.z+Math.sin(v)*radius);
          jetUv[i*2]=t*3;jetUv[i*2+1]=a/JA;
        }
      }
      jetGeometry.attributes.position.needsUpdate=true;jetGeometry.attributes.uv.needsUpdate=true;
      jetGeometry.computeVertexNormals();jetGeometry.computeBoundingSphere();
    }
    function update({progress=0,time=0,flow=0,pumpOn=false}={}) {
      const p=clamp(Number(progress)||0),clock=Number.isFinite(time)?time:p*96;
      const f=clamp(Number(flow)||0),cure=smooth(.90,1,p),wet=1-cure;
      latest={progress:p,time:clock,flow:f,pumpOn:!!pumpOn,stage:p<.54?'待注浆':p<.90?'流动与局部填充':p<1?'停泵后逐渐凝固':'凝固外观示意',cure};
      // The host uses progress * 96 demo seconds; freeze the flowing pattern at pump stop,
      // then fade its contrast while the surface becomes dry (do not reverse the flow).
      uniforms.uGroutClock.value=p>.90?clock*.90/p:clock;
      uniforms.uGroutWet.value=wet;uniforms.uGroutFlow.value=f;uniforms.uGroutCure.value=cure;
      material.color.setRGB(mix(.235,.43,cure),mix(.225,.415,cure),mix(.205,.38,cure));
      material.roughness=mix(.47,.99,cure);material.clearcoat=mix(.14,0,cure);
      material.clearcoatRoughness=mix(.32,1,cure);material.bumpScale=mix(.0065,.012,cure);
      jetMaterial.roughness=.40;jetMaterial.clearcoat=.15;jetMaterial.clearcoatRoughness=.32;
      jetMaterial.color.setRGB(.20,.19,.17);
      body.visible=p>=.54;
      if(!body.visible){jet.visible=false;return;}
      initialized=true;boundViolations=0;invalidGaps=0;minGap=Infinity;maxGap=0;
      const growth=smooth(.54,.90,p),xGrowth=.035+.965*growth,zGrowth=.035+1.26*smooth(.54,.84,p);
      const center=writeVertex(0,S.x,S.z,0,0,p,clock,f,cure);
      for(let a=0;a<ANGLES;a++){
        const angle=a/ANGLES*Math.PI*2,dx=Math.cos(angle),dz=Math.sin(angle);
        const bx=dx>=0?B.maxX-S.x:S.x-B.minX,bz=dz>=0?B.maxZ-S.z:S.z-B.minZ;
        const rx=Math.max(.005,bx*xGrowth),rz=Math.max(.005,bz*zGrowth);
        const power=3.35;
        const ellipse=1/Math.pow(Math.pow(Math.abs(dx)/rx,power)+Math.pow(Math.abs(dz)/rz,power),1/power);
        // Persistent lobes describe a visually uneven front, not a predicted diffusion law.
        const lobe=.942+.036*Math.sin(angle*5+.8)+.022*Math.cos(angle*9-1.1);
        const limit=Math.min(Math.abs(dx)>1e-8?bx/Math.abs(dx):Infinity,Math.abs(dz)>1e-8?bz/Math.abs(dz):Infinity);
        const radius=Math.min(limit,ellipse*lobe);
        for(let r=1;r<=RINGS;r++){
          const q=r/RINGS;
          writeVertex(id(r,a),S.x+dx*radius*q,S.z+dz*radius*q,q,angle,p,clock,f,cure);
        }
      }
      geometry.attributes.position.needsUpdate=true;geometry.attributes.uv.needsUpdate=true;
      geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.computeBoundingBox();
      updateJet(p,clock,f,cure,center);
    }
    // Index topology is checked independently from mesh visibility and from the animation timeline.
    const edgeCounts=new Map();
    for(let i=0;i<indices.length;i+=3)for(let k=0;k<3;k++){
      const a=indices[i+k],b=indices[i+(k+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;
      edgeCounts.set(key,(edgeCounts.get(key)||0)+1);
    }
    const unmatchedEdges=[...edgeCounts.values()].filter(n=>n!==2).length;
    function diagnostics(){
      let finite=true,volume=0,minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,minY=Infinity,maxY=-Infinity;
      if(initialized)for(let i=0;i<positions.length;i+=3){
        const x=positions[i],y=positions[i+1],z=positions[i+2];
        if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))finite=false;
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      }
      if(initialized&&body.visible)for(let i=0;i<indices.length;i+=3){
        const a=3*indices[i],b=3*indices[i+1],c=3*indices[i+2];
        volume+=(positions[a]*(positions[b+1]*positions[c+2]-positions[b+2]*positions[c+1])+
          positions[a+1]*(positions[b+2]*positions[c]-positions[b]*positions[c+2])+
          positions[a+2]*(positions[b]*positions[c+1]-positions[b+1]*positions[c]))/6;
      }
      return {type:'受离层约束的三维视觉示意，非数值求解',initialized,visible:body.visible,stage:latest.stage,
        progress:latest.progress,cureFraction:latest.cure,wetSurface:1-latest.cure,inspection,
        vertices:COUNT,triangles:indices.length/3,finiteVertices:finite,closed:unmatchedEdges===0,
        nonManifoldEdges:unmatchedEdges,closedEdgeCount:edgeCounts.size,signedVolume:volume,
        positiveVolume:volume>0,gapConstraintViolations:boundViolations,invalidGapSamples:invalidGaps,
        gapRange:initialized?{min:minGap,max:maxGap}:null,
        bounds:initialized?{minX,maxX,minY,maxY,minZ,maxZ}:null,allowedBounds:{...B},
        inletContinuous:jet.visible,fullThicknessReached:initialized&&minZ<=B.minZ+.01&&maxZ>=B.maxZ-.01,
        localControlOnly:true,timeCompressedSolidification:true};
    }
    function setInspection(value){inspection=!!value;group.userData.inspection=inspection;}
    function dispose(){geometry.dispose();jetGeometry.dispose();material.dispose();jetMaterial.dispose();grainMap.dispose();group.removeFromParent();}
    return {group,update,diagnostics,setInspection,dispose};
  };
})();
