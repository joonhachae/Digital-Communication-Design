import {CONFIG,clamp,measurePinch,advanceWheel} from './physics.js';

// DOM, design tokens, and camera lifecycle are kept separate from measurement/physics.
const $=id=>document.getElementById(id);
const video=$('video'),scene=$('scene'),overlay=$('hand-overlay');
const ctx=scene.getContext('2d'),hand=overlay.getContext('2d');
const palette=getComputedStyle(document.documentElement);
let ink=palette.getPropertyValue('--ink').trim(),paper=palette.getPropertyValue('--paper').trim(),rule=ink;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const state={height:0,target:0,points:null,lastSeen:0,lastSample:0,tracking:false,started:false};
const wheel={x:0,y:0,angle:0,blocked:false,hitTime:-10,laps:0};
let geometry,worker,stream,busy=false,ready=false,lastFrame=0,lastVideoTime=-1,lastTime=0,currentStatus='',cameraGeneration=0;

function sizeCanvas(canvas){
  const bounds=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(bounds.width*dpr);canvas.height=Math.round(bounds.height*dpr);
  canvas.getContext('2d').setTransform(dpr,0,0,dpr,0,0);
  return bounds;
}
function resize(){
  const old=geometry,{width,height}=sizeCanvas(scene);sizeCanvas(overlay);
  const radius=Math.min(clamp(width*.062,28,88),Math.max(22,(height-60)*.23));
  geometry={width,height,curbX:width*.73,ground:height-44,radius,
    pxPerCm:Math.min(clamp(width*.012,5,16),Math.max(2,(height-2*radius-45)/10))};
  wheel.x=old?wheel.x/old.width*width:geometry.radius*1.6;
}
new ResizeObserver(resize).observe(scene);new ResizeObserver(()=>sizeCanvas(overlay)).observe(overlay);
resize();
function line(context,x1,y1,x2,y2,color=ink,width=1){context.beginPath();context.strokeStyle=color;context.lineWidth=width;context.moveTo(x1,y1);context.lineTo(x2,y2);context.stroke();}
function text(context,value,x,y,size=11,align='left',weight=500,color=ink){context.fillStyle=color;context.font=`${weight} ${size}px Arial, Helvetica, sans-serif`;context.textAlign=align;context.fillText(value,x,y);}
function circle(context,x,y,r,fill){context.beginPath();context.arc(x,y,r,0,Math.PI*2);context.fillStyle=fill;context.fill();}
let barrierTheme = false;
function updateTheme() {
  const next = state.height > CONFIG.threshold;
  if (next === barrierTheme) return;
  barrierTheme = next;
  document.documentElement.dataset.barrier = String(next);
  const colors = getComputedStyle(document.documentElement);
  ink = colors.getPropertyValue('--ink').trim();
  paper = colors.getPropertyValue('--paper').trim();
  rule = ink;
  document.querySelector('meta[name="theme-color"]').content = paper;
}
function drawScene(dt,now){
  updateTheme();
  const g=geometry,h=state.height*g.pxPerCm;
  const pose=advanceWheel(wheel,dt,g,state.height,now,reducedMotion);
  ctx.clearRect(0,0,g.width,g.height);
  // Ground and raised plane, with a restrained section hatch below the surface.
  ctx.fillStyle=ink;ctx.fillRect(g.curbX,g.ground-h,g.width-g.curbX,h);
  line(ctx,0,g.ground,g.width,g.ground,ink,1.5);
  for(let x=0;x<g.width;x+=14)line(ctx,x,g.ground+1,x-6,g.ground+7,rule,.7);
  const thresholdY=g.ground-CONFIG.threshold*g.pxPerCm;
  ctx.setLineDash([3,5]);line(ctx,g.curbX-24,thresholdY,g.width,thresholdY,rule);ctx.setLineDash([]);
  text(ctx,'5 CM',g.width-2,thresholdY-7,9,'right',500,ink);
  // The dimension is deliberately adjacent to the moving edge.
  const dimX=g.curbX+clamp(g.width*.12,45,145),top=g.ground-h;
  line(ctx,dimX,top,dimX,g.ground,paper);
  line(ctx,g.curbX,top-10,g.curbX,Math.max(12,top-49),ink);
  text(ctx,`${state.height.toFixed(1)} CM`,g.width<500?g.width-2:g.curbX-1,Math.max(26,top-59),clamp(g.width*.042,25,59),g.width<500?'right':'left',700);
  line(ctx,g.curbX-11,top,g.curbX-11,g.ground,ink);
  line(ctx,g.curbX-15,top,g.curbX-7,top,ink);line(ctx,g.curbX-15,g.ground,g.curbX-7,g.ground,ink);
  // Wheel: outlined tire, hub, and three spokes reveal rotation.
  ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.angle);
  circle(ctx,0,0,g.radius,ink);circle(ctx,0,0,g.radius-5,paper);
  ctx.beginPath();ctx.arc(0,0,g.radius-10,0,Math.PI*2);ctx.strokeStyle=ink;ctx.lineWidth=1;ctx.stroke();
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;line(ctx,0,0,Math.cos(a)*(g.radius-10),Math.sin(a)*(g.radius-10),ink,1.4);}
  circle(ctx,0,0,5,ink);circle(ctx,0,0,1.5,paper);ctx.restore();
  const status=state.height<=5?'PASSABLE':'BARRIER';
  if(status!==currentStatus){currentStatus=status;$('state').firstChild.textContent=status;$('state-symbol').textContent=status==='PASSABLE'?'↗':'⊣';$('announcement').textContent=`${status}. Virtual curb ${state.height.toFixed(1)} centimeters.`;}
}
function drawHand(now){
  const overlayFg=barrierTheme?ink:paper,overlayBg=barrierTheme?paper:ink;
  const w=overlay.clientWidth,h=overlay.clientHeight;hand.clearRect(0,0,w,h);
  if(!state.points||!state.tracking)return;
  const vw=video.videoWidth||640,vh=video.videoHeight||480,scale=Math.min(w/vw,h/vh),ox=(w-vw*scale)/2,oy=(h-vh*scale)/2;
  const project=p=>({x:ox+(1-p.x)*vw*scale,y:oy+p.y*vh*scale});
  const a=project(state.points[0]),b=project(state.points[1]);
  line(hand,a.x,a.y,b.x,b.y,overlayFg,1.5);
  for(const p of [a,b]){circle(hand,p.x,p.y,5,overlayFg);circle(hand,p.x,p.y,1.5,overlayBg);line(hand,p.x-10,p.y,p.x+10,p.y,overlayFg,.6);line(hand,p.x,p.y-10,p.x,p.y+10,overlayFg,.6);}
  const label=`${state.height.toFixed(1)} CM`,x=clamp((a.x+b.x)/2,40,w-40),y=clamp((a.y+b.y)/2-14,23,h-12);
  hand.font='700 16px Arial';const tw=hand.measureText(label).width;
  hand.fillStyle=overlayBg;hand.fillRect(x-tw/2-6,y-17,tw+12,23);text(hand,label,x,y,16,'center',700,overlayFg);
}
function updateTracking(points,timestamp){
  if(!points){state.tracking=false;$('tracking-status').textContent=state.lastSeen?'HAND LOST / HELD':'SHOW ONE HAND';return;}
  const dt=state.lastSample?Math.min((timestamp-state.lastSample)/1000,.1):.04;
  const alpha=1-Math.exp(-dt/CONFIG.smoothingSeconds);
  const value=measurePinch(points,video.videoWidth/video.videoHeight);
  state.target+=alpha*(value-state.target);
  state.height=Math.round(state.target*10)/10;
  const tips=[points[4],points[8]];
  state.points=state.tracking&&state.points?tips.map((p,i)=>({x:state.points[i].x+(p.x-state.points[i].x)*alpha,y:state.points[i].y+(p.y-state.points[i].y)*alpha})):tips.map(p=>({x:p.x,y:p.y}));
  state.lastSeen=performance.now();state.lastSample=timestamp;state.tracking=true;
  $('tracking-status').textContent='HAND TRACKED';
}
function stopCamera(){
  cameraGeneration++;ready=false;busy=false;state.tracking=false;
  if(worker){worker.terminate();worker=null;}if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}video.srcObject=null;
}
function cameraError(message){stopCamera();$('camera-prompt').hidden=false;$('camera-message').textContent=message;$('start-camera').disabled=false;$('start-camera').innerHTML='TRY CAMERA AGAIN <span>↗</span>';$('tracking-status').textContent='CAMERA UNAVAILABLE';}
function initializeTracker(){
  return new Promise((resolve,reject)=>{
    worker=new Worker('./hand-worker.js');
    const timeout=setTimeout(()=>reject(new Error('Tracking could not load. Check your connection and retry.')),45000);
    worker.onerror=()=>{clearTimeout(timeout);reject(new Error('Tracking could not load. Check your connection and retry.'));if(ready)cameraError('Tracking interrupted. Please retry.');};
    worker.onmessage=({data})=>{
      if(data.type==='ready'){clearTimeout(timeout);resolve();}
      if(data.type==='result'){busy=false;updateTracking(data.points,data.timestamp);}
      if(data.type==='error'){clearTimeout(timeout);busy=false;reject(new Error('Tracking could not load. Check your connection and retry.'));if(ready)cameraError('Tracking interrupted. Please retry.');}
    };
    worker.postMessage({type:'init'});
  });
}
$('start-camera').addEventListener('click',async()=>{
  $('start-camera').disabled=true;$('camera-message').textContent='ALLOW CAMERA ACCESS TO BEGIN.';$('tracking-status').textContent='CONNECTING';
  const generation=++cameraGeneration;
  try{
    if(!isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('Open this page on HTTPS or localhost to use the camera.');
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});
    if(generation!==cameraGeneration){stream.getTracks().forEach(t=>t.stop());return;}
    video.srcObject=stream;await video.play();
    $('camera-message').textContent='LOADING HAND TRACKING…';
    await initializeTracker();
    stream.getVideoTracks()[0].addEventListener('ended',()=>cameraError('Camera disconnected. Reconnect it and retry.'));
    ready=true;state.started=true;$('camera-prompt').hidden=true;$('tracking-status').textContent='SHOW ONE HAND';
  }catch(error){const messages={NotAllowedError:'Camera access was denied. Allow access in your browser, then retry.',NotFoundError:'No camera found. Connect a camera and retry.',NotReadableError:'Camera is busy. Close other camera apps and retry.'};cameraError(messages[error.name]||error.message);}
});
async function submitFrame(now){
  if(!ready||busy||video.readyState<2||now-lastFrame<42||video.currentTime===lastVideoTime||document.hidden)return;
  busy=true;lastFrame=now;lastVideoTime=video.currentTime;const activeWorker=worker;
  try{const frame=await createImageBitmap(video);if(activeWorker!==worker||!ready){frame.close();return;}worker.postMessage({type:'frame',frame,timestamp:now},[frame]);}
  catch{busy=false;if(ready)cameraError('Camera processing interrupted. Please retry.');}
}
function animate(now){
  const dt=lastTime?Math.min((now-lastTime)/1000,.045):0;lastTime=now;
  if(state.tracking&&now-state.lastSeen>600){state.tracking=false;$('tracking-status').textContent='HAND LOST / HELD';}
  drawScene(dt,now/1000);drawHand(now);submitFrame(now);requestAnimationFrame(animate);
}
window.addEventListener('pagehide',stopCamera);
window.addEventListener('pageshow',event=>{if(event.persisted)cameraError('Camera paused. Enable it to continue.');});
requestAnimationFrame(animate);
