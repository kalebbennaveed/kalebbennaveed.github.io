import * as T from 'three';
const S=6;
function pineGeometry(){
  const positions=[],uv=[];
  const quad=(a,b,c,d)=>{
    positions.push(...a,...b,...c,...a,...c,...d);
    // The first needle sprig in the photographic atlas; avoid the cone/wood islands.
    uv.push(.008,.56,.205,.56,.205,.995,.008,.56,.205,.995,.008,.995);
  };
  for(let layer=0;layer<13;layer++){
    const y=.16+layer*.061,r=(1-y)*.43;
    for(let b=0;b<9;b++){
      const angle=b/9*Math.PI*2+layer*2.4,length=r*(.8+.2*(Math.sin(layer*13+b*7)*.5+.5));
      for(let twig=0;twig<3;twig++){
        const t=(twig+.3)/3,cx=Math.cos(angle)*length*t,cz=Math.sin(angle)*length*t;
        const yy=y-.055*t,w=.11*(1-y*.55),l=.18*(1-y*.4);
        const tx=-Math.sin(angle)*w,tz=Math.cos(angle)*w,dx=Math.cos(angle)*l,dz=Math.sin(angle)*l;
        quad([cx-tx,yy,cz-tz],[cx+tx,yy,cz+tz],[cx+dx+tx*.7,yy+.028,cz+dz+tz*.7],[cx+dx-tx*.7,yy+.028,cz+dz-tz*.7]);
        // Crossed needle clusters retain volume from a low chase-camera angle.
        quad([cx,yy-w,cz],[cx,yy+w,cz],[cx+dx,yy+w*.6,cz+dz],[cx+dx,yy-w*.6,cz+dz]);
      }
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}

export async function buildWorld(scene,renderer,env,{scenario=1}={}){
 const loader=new T.TextureLoader();
 async function tex(name,repeat,color=false){const t=await loader.loadAsync(`assets/${name}.jpg`);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(...repeat);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(color)t.colorSpace=T.SRGBColorSpace;return t}
 const [pd,pn,pr,bd,bn,br]=await Promise.all([tex('paving_diff',[20,16],true),tex('paving_nor_gl',[20,16]),tex('paving_rough',[20,16]),tex('brick_diff',[2.5,1],true),tex('brick_nor_gl',[2.5,1]),tex('brick_rough',[2.5,1])]);
 const mat=(color,roughness=.8,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const concrete=mat('#aaa99f'),wall=mat('#b7c0bd'),metal=mat('#52616a',.42,.65),trim=mat('#32444a',.45,.55),roof=mat('#75818a',.65,.5),glass=new T.MeshStandardMaterial({color:'#426374',metalness:.38,roughness:.18}),paint=mat('#c4bc92'),brick=new T.MeshStandardMaterial({map:bd,normalMap:bn,roughnessMap:br,normalScale:new T.Vector2(.65,.65)});
 function mesh(g,m,x,y,z){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o}
 function box(x,z,w,d,h,m,y=0){return mesh(new T.BoxGeometry(w,h,d),m,x,y+h/2,z)}
 function cyl(x,z,r,h,m,y=0){return mesh(new T.CylinderGeometry(r,r,h,48),m,x,y+h/2,z)}
 function tube(points,r,m){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(4,points.length*5),r,6,false),m,0,0,0)}
 function plane(x,z,w,d,m,y=.03){const o=mesh(new T.PlaneGeometry(w,d),m,x,y,z);o.rotation.x=-Math.PI/2;return o}
 function text(str,x,z,w,d,color='#eee8c9',y=.06,background=null){const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');if(background){ctx.fillStyle=background;ctx.fillRect(0,0,c.width,c.height)}ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 118px Arial';ctx.fillText(str,512,128);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return plane(x,z,w,d,new T.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}),y)}
 const [grass,grassNormal,grassRough,foliage,alpha]=await Promise.all([tex('aerial_grass_rock_diff_1k',[20,18],true),tex('aerial_grass_rock_nor_gl_1k',[20,18]),tex('aerial_grass_rock_rough_1k',[20,18]),tex('pine_tree_01_twig_diff_1k',[1,1],true),tex('pine_tree_01_twig_alpha_1k',[1,1])]);
 plane(24,-18,150,130,new T.MeshStandardMaterial({map:grass,normalMap:grassNormal,roughnessMap:grassRough,color:'#c0c2ad',normalScale:new T.Vector2(.5,.5)}),-.10);
 // Photographic paving, inset service yard and a perimeter road.
 plane(24,-18,51,39,new T.MeshStandardMaterial({map:pd,normalMap:pn,roughnessMap:pr,color:'#c2c7c4',normalScale:new T.Vector2(.6,.6)}),0);
 plane(24,6,150,8,mat('#424b4d'),-.04);
 for(let x=-40;x<100;x+=5)box(x,6,2.5,.12,.015,paint,-.01);
 for(const z of [1.05,-37.05])box(24,z,51,.28,.20,concrete);
 for(const x of [-1.05,49.05])box(x,-18,.28,36,.20,concrete);
 // Fine expansion joints on the yard, and drainage grilles.
 const joint=mat('#89938f');for(let x=0;x<=48;x+=6)box(x,-18,.018,36,.012,joint);
 for(let z=0;z>=-36;z-=6)box(24,z,48,.018,.012,joint);
 for(let i=0;i<14;i++)box(47.7,-2-i*2.35,.35,.48,.016,metal);
 // Monitoring/loading bays remain at the recorded A and B bounds.
 const monitoring=env.wind_region?[{label:'REGION',bounds:[[0,2.8],[8,6]]}]:env.regions;
 for(const r of monitoring){const [[x0,y0],[x1,y1]]=r.bounds,lo=x0*S,hi=x1*S,z0=-y0*S,z1=-y1*S,w=hi-lo,d=z0-z1;
  plane((lo+hi)/2,(z0+z1)/2,w,d,new T.MeshStandardMaterial({color:'#b9b29a',transparent:true,opacity:.19,depthWrite:false}),.025);
  for(const x of [lo+.12,hi-.12])box(x,(z0+z1)/2,.09,d-.2,.016,paint,.04);
  for(const z of [z0-.12,z1+.12])box((lo+hi)/2,z,w-.2,.09,.016,paint,.04);
  text(`MONITORING ${r.label}`,(lo+hi)/2,z1+1.2,Math.min(w-1,10),1.3,'#ece5c9');
  const labelCanvas=document.createElement('canvas');labelCanvas.width=768;labelCanvas.height=100;const labelCtx=labelCanvas.getContext('2d');labelCtx.fillStyle='#f9f7e9e8';labelCtx.fillRect(0,0,768,100);labelCtx.font='600 43px Arial';labelCtx.textAlign='center';labelCtx.fillStyle='#314d54';labelCtx.fillText(`MONITORING ${r.label}`,384,66);const labelTex=new T.CanvasTexture(labelCanvas);labelTex.colorSpace=T.SRGBColorSpace;const sprite=new T.Sprite(new T.SpriteMaterial({map:labelTex,depthTest:true}));sprite.scale.set(6.8,.89,1);sprite.position.set((lo+hi)/2,1.3,z1+.55);scene.add(sprite);for(let x=lo+1;x<hi-1;x+=1)box(x,z0-.65,.08,.65,.015,paint,.04);
 }
 // Four connected industrial wings, entirely inside the circular obstacle envelopes.
 function warehouse([px,py,r],i){
  const x=px*S,z=-py*S,w=r*S*1.36,d=r*S*1.36,h=[8.5,7.2,6.3,7.0][i];
  box(x,z,w+.22,d+.22,.3,concrete);box(x,z,w,d,1.55,brick,.3);box(x,z,w,d,h-1.55,wall,1.85);
  for(let a=-w/2+.22;a<w/2;a+=.48){box(x+a,z+d/2+.025,.025,.05,h-1.8,roof,1.8);box(x+a,z-d/2-.025,.025,.05,h-1.8,roof,1.8)}
  for(let a=-d/2+.2;a<d/2;a+=.5){box(x+w/2+.025,z+a,.05,.025,h-1.8,roof,1.8);box(x-w/2-.025,z+a,.05,.025,h-1.8,roof,1.8)}
  // Roof overhangs, seams, parapets, skylights and HVAC plant.
  box(x,z,w+.3,d+.3,.22,roof,h+.3);
  for(const xx of [x-w/2-.1,x+w/2+.1])box(xx,z,.12,d+.32,.48,trim,h+.4);
  for(const zz of [z-d/2-.1,z+d/2+.1])box(x,zz,w+.32,.12,.48,trim,h+.4);
  for(let a=-w/2+.4;a<w/2;a+=.65)box(x+a,z,.025,d,.035,trim,h+.54);
  for(let j=0;j<3;j++){box(x-w*.23+j*w*.23,z-d*.2,w*.16,1.8,.25,trim,h+.55);box(x-w*.23+j*w*.23,z-d*.2,w*.14,1.6,.11,glass,h+.8)}
  box(x+w*.18,z+d*.22,1.5,1.2,.85,concrete,h+.55);cyl(x+w*.18,z+d*.22,.43,.12,trim,h+1.4);
  for(let n=0;n<8;n++){const a=n*Math.PI/4;tube([[x+w*.18,h+1.55,z+d*.22],[x+w*.18+Math.cos(a)*.38,h+1.55,z+d*.22+Math.sin(a)*.38]],.02,metal)}
  cyl(x-w*.27,z+d*.23,.27,1.4,metal,h+.5);cyl(x-w*.27,z+d*.23,.39,.1,trim,h+1.85);
  // South façade glazing and service shutters.
  for(let j=0;j<3;j++){box(x-w*.3+j*w*.3,z+d/2+.04,w*.23,.06,1.1,trim,h-2.3);box(x-w*.3+j*w*.3,z+d/2+.08,w*.21,.025,.9,glass,h-2.2)}
  box(x,z+d/2+.07,2.45,.1,2.7,trim,.25);for(let a=.45;a<2.8;a+=.22)box(x,z+d/2+.13,2.3,.025,.13,roof,a);
  for(const xx of [x-w/2+.2,x+w/2-.2])tube([[xx,.2,z+d/2+.16],[xx,h+.5,z+d/2+.16]],.055,metal);
  // A small illuminated door beside the shutter.
  box(x-w*.34,z+d/2+.13,.83,.04,1.9,metal,.3);box(x-w*.34,z+d/2+.2,1,.22,.1,paint,2.4);
 }
 // The independent obstacle is a tank with a concrete bund, roof, access rail and ladder.
 function tank([tx,ty,tr]){const x=tx*S,z=-ty*S,r=tr*S;
 cyl(x,z,r,.28,concrete);cyl(x,z,r*.84,6.7,new T.MeshStandardMaterial({color:'#c7d0ce',roughness:.45,metalness:.5}),.28);
 for(const yy of [1.8,3.9,6.8]){const ring=mesh(new T.TorusGeometry(r*.845,.045,6,64),trim,x,yy,z);ring.rotation.x=Math.PI/2}
 const cap=mesh(new T.ConeGeometry(r*.845,.55,64),roof,x,7.25,z);cap.receiveShadow=true;
 cyl(x,z,.48,.4,metal,7.5);
 const rail=new T.TorusGeometry(r*.65,.035,6,64);const a=mesh(rail,metal,x,7.9,z);a.rotation.x=Math.PI/2;
 for(let k=0;k<16;k++){const t=k/16*Math.PI*2;cyl(x+Math.cos(t)*r*.65,z+Math.sin(t)*r*.65,.03,.65,metal,7.25)}
 for(const off of [-.28,.28])tube([[x+r*.87,0,z+off],[x+r*.87,7.8,z+off],[x+r*.65,8,z+off]],.045,metal);
 for(let yy=.35;yy<7.6;yy+=.32)tube([[x+r*.87,yy,z-.28],[x+r*.87,yy,z+.28]],.035,metal);
 tube([[x-r*.7,1,z],[x-r*.91,1,z],[x-r*.91,.3,z-.8]],.18,metal);
 }
 function pavilion([px,py,pr]){
  const x=px*S,z=-py*S,r=pr*S;
  const glazing=new T.MeshPhysicalMaterial({color:'#7399a5',metalness:.35,roughness:.17,transparent:true,opacity:.88,side:T.DoubleSide});
  cyl(x,z,r*.97,.25,concrete);cyl(x,z,r*.88,.65,brick,.25);
  const curtain=mesh(new T.CylinderGeometry(r*.86,r*.86,5.2,64,1,true),glazing,x,3.45,z);
  for(let i=0;i<28;i++){const angle=i/28*Math.PI*2,xx=x+Math.cos(angle)*r*.875,zz=z+Math.sin(angle)*r*.875;cyl(xx,zz,.045,5.6,trim,.7);}
  for(const yy of [1,3.3,6.1]){const band=mesh(new T.TorusGeometry(r*.875,.06,8,96),trim,x,yy,z);band.rotation.x=Math.PI/2;}
  cyl(x,z,r*.96,.24,roof,6.2);cyl(x,z,r*.67,.14,trim,6.44);
  const skylight=mesh(new T.SphereGeometry(r*.46,48,16,0,Math.PI*2,0,Math.PI/2),glass,x,6.55,z);skylight.scale.y=.35;
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;tube([[x+Math.cos(a)*r*.48,6.58,z+Math.sin(a)*r*.48],[x+Math.cos(a)*r*.92,6.58,z+Math.sin(a)*r*.92]],.035,trim);}
  // Entrance and terrace details stay inside the recorded obstacle footprint.
  box(x,z+r*.88,1.7,.08,2.4,trim,.8);box(x,z+r*.895,1.5,.04,2.2,glass,.9);
  for(const side of [-1,1]){const xx=x+side*r*.48;box(xx,z+r*.68,1.3,.3,.4,concrete);box(xx,z+r*.68,1.45,.36,.07,metal,.4);}
 }
 if(scenario===1||scenario===2){env.obstacles.slice(0,4).forEach((o,i)=>warehouse(o,i));tank(env.obstacles[4]);}
 else if(scenario===3){pavilion(env.obstacles[0]);text('SERVICE FORECOURT',36,-5.3,12,1.2,'#dedbc2');}
 else{env.obstacles.forEach((o,i)=>[0,4,7].includes(i)?tank(o):warehouse(o,i%4));text('EAST SERVICE YARD',39,-17.4,10,1.1,'#dedbc2');}
 // Perimeter fencing and landscaping outside the recorded free workspace.
 for(const zz of [-37.2,1.2]){for(let xx=-1;xx<=49;xx+=3)cyl(xx,zz,.045,1.6,metal);for(const yy of [.45,1.5])tube([[-1,yy,zz],[49,yy,zz]],.025,metal)}
 for(const xx of [-1.2,49.2]){for(let zz=-36;zz<1;zz+=3)cyl(xx,zz,.045,1.6,metal);for(const yy of [.45,1.5])tube([[xx,yy,-37],[xx,yy,1]],.025,metal)}
 let seed=17;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const bark=mat('#6d6251'),pine=pineGeometry(),needles=new T.MeshStandardMaterial({map:foliage,alphaMap:alpha,alphaTest:.24,color:'#aebc96',roughness:.96,side:T.DoubleSide});
 for(let i=0;i<17;i++){const xx=i<9?-5+random()*2:55+random()*3,zz=-39+random()*39,h=6+random()*3;cyl(xx,zz,.12,h*.9,bark);const tree=mesh(pine,needles,xx,0,zz);tree.scale.setScalar(h);tree.rotation.y=random()*Math.PI*2}
 for(let i=0;i<5;i++){const h=5+random()*3,xx=-17+i*18;box(xx,-58,13,9,h,brick);box(xx,-58,13.4,9.4,.25,roof,h);for(let j=-4;j<5;j+=2){box(xx+j,-53.46,1.35,.05,1.3,glass,h-2);box(xx+j,-53.40,.045,.03,1.4,trim,h-2.05)}}
 // A few site fixtures sit outside the mission area.
 for(let i=0;i<4;i++){box(4+i*11,-39,2.6,1,.6,concrete);for(let j=0;j<7;j++)box(3+i*11+j*.3,-39,.23,.9,.06,trim,.6)}
 for(const xx of [-2,50])for(const zz of [-33,-6]){cyl(xx,zz,.065,5,metal);box(xx+.35,zz,.9,.35,.12,paint,5)}
 return {S,box,plane,text};
}
