/** All distances here are screen pixels; the input is a virtual centimeter scale. */
export const CONFIG = Object.freeze({threshold:5,maxHeight:10,smoothingSeconds:.14,minPinchRatio:.06,maxPinchRatio:1.25});
export const clamp = (v,lo,hi) => Math.min(hi,Math.max(lo,v));
export function measurePinch(points, aspect=1) {
  const distance=(a,b)=>Math.hypot((a.x-b.x)*aspect,a.y-b.y);
  const palm=Math.max(.025,distance(points[0],points[9]));
  const ratio=distance(points[4],points[8])/palm;
  return clamp((ratio-CONFIG.minPinchRatio)/(CONFIG.maxPinchRatio-CONFIG.minPinchRatio)*10,0,10);
}
export function contactOffset(radius,height) {
  return height>=radius?radius:Math.sqrt(Math.max(0,2*radius*height-height*height));
}
export function supportY(x,curbX,ground,radius,height) {
  if(x>=curbX)return ground-height-radius;
  const dx=curbX-x;
  if(dx>=radius)return ground-radius;
  return Math.min(ground-radius,ground-height-Math.sqrt(radius*radius-dx*dx));
}
export function advanceWheel(wheel,dt,g,heightCm,time,reducedMotion=false) {
  const height=heightCm*g.pxPerCm;
  const stop=g.curbX-contactOffset(g.radius,height);
  const barrier=heightCm>CONFIG.threshold;
  const previous=wheel.x;
  const speed=g.width*.115;
  if(barrier&&wheel.x<g.curbX) {
    if(wheel.x+speed*dt>=stop) {
      if(!wheel.blocked)wheel.hitTime=time;
      wheel.x=stop;
      wheel.blocked=true;
    }else{wheel.x+=speed*dt;wheel.blocked=false;}
  }else{wheel.blocked=false;wheel.x+=speed*dt;}
  wheel.angle+=(wheel.x-previous)/g.radius;
  if(wheel.x>g.width+g.radius*2){wheel.x=-g.radius*1.4;wheel.laps++;wheel.blocked=false;}
  const age=time-wheel.hitTime;
  const recoil=wheel.blocked&&!reducedMotion&&age<.65?-Math.sin(age*22)*Math.exp(-age*7)*4:0;
  wheel.y=supportY(wheel.x,g.curbX,g.ground,g.radius,height);
  return {x:wheel.x+recoil,y:wheel.y,angle:wheel.angle+recoil/g.radius,blocked:wheel.blocked};
}
