import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceWheel,contactOffset} from '../physics.js';
const g={width:1270,curbX:927.1,ground:430,radius:78.7,pxPerCm:15.24};
const makeWheel=x=>({x,y:g.ground-g.radius,angle:0,blocked:false,hitTime:-10,laps:0});

test('a rising barrier keeps a colliding wheel on the lower road',()=>{
  const wheel=makeWheel(g.curbX-contactOffset(g.radius,5*g.pxPerCm)-1);
  advanceWheel(wheel,1/60,g,5,0);
  for(const height of [5.1,5.2,6,8,10,6,5.1]){
    for(let i=0;i<60;i++){
      const pose=advanceWheel(wheel,1/60,g,height,1+i/60);
      assert.equal(pose.y,g.ground-g.radius);
      assert.equal(pose.blocked,true);
    }
  }
});

test('fractional contact coordinates cannot lift a wheel onto a tall barrier',()=>{
  for(const curbX of [927.1,927.3,731.01,800.333]){
    for(const radius of [78.7,61.2,43.333]){
      const geometry={...g,curbX,radius};
      const wheel=makeWheel(curbX-radius-.1);
      const pose=advanceWheel(wheel,1/60,geometry,10,0);
      assert.equal(pose.blocked,true);
      assert.equal(pose.y,geometry.ground-radius);
    }
  }
});

test('lowering to 5 cm releases a blocked wheel and preserves climbing',()=>{
  const wheel=makeWheel(g.curbX-g.radius);
  advanceWheel(wheel,1/60,g,10,0);
  let climbed=false;
  for(let i=0;i<120;i++){
    const pose=advanceWheel(wheel,1/60,g,5,1+i/60);
    assert.equal(pose.blocked,false);
    if(pose.y<g.ground-g.radius)climbed=true;
  }
  assert(climbed);
  assert(wheel.x>g.curbX);
});
