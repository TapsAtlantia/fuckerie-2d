import { WorldGen } from "../src/world/WorldGen";
import { TileId } from "../src/world/Tile";
import { isLava, liquidLevel } from "../src/world/Liquid";
import { CHUNK_SIZE, PLATEAU } from "../src/config";
let fails=0; const check=(n:string,c:boolean,e="")=>{console.log(`${c?"PASS":"FAIL"}  ${n}${e?"  ("+e+")":""}`);if(!c)fails++;};
const g=new WorldGen(4242);
const cache=new Map<string,any>(); const chunk=(cx:number,cy:number)=>{const k=cx+","+cy;let c=cache.get(k);if(!c){c=g.generateChunk(cx,cy);cache.set(k,c);}return c;};
const at=(x:number,y:number,layer:"fg"|"bg"|"liquid")=>{const cx=Math.floor(x/CHUNK_SIZE),cy=Math.floor(y/CHUNK_SIZE);const lx=((x%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE,ly=((y%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;return chunk(cx,cy)[layer][ly*CHUNK_SIZE+lx];};
// determinism (fg/bg/liquid)
{const b=new WorldGen(4242);let s=true;for(const[cx,cy] of [[0,0],[3,0],[-2,2]] as const){const x=g.generateChunk(cx,cy),y=b.generateChunk(cx,cy);const eq=(p:any,q:any)=>p.length===q.length&&p.every((v:number,i:number)=>v===q[i]);if(!eq(x.fg,y.fg)||!eq(x.bg,y.bg)||!eq(x.liquid,y.liquid))s=false;}check("determinism (fg/bg/liquid)",s);}

const N=24000, X0=-4000;
const sh:number[]=new Array(N); for(let i=0;i<N;i++) sh[i]=g.surfaceHeight(X0+i);
// relief: real range between highlands and lowlands
{let mn=Infinity,mx=-Infinity; for(const v of sh){if(v<mn)mn=v;if(v>mx)mx=v;} check("terrain has strong relief (mountains + valleys)", (mx-mn)>=150, `range=${mx-mn} tiles`);}
// plateaus: flat mesa tops (long equal runs) + cliffs (big adjacent jumps)
{let run=1,maxRun=1,maxJump=0; for(let i=1;i<N;i++){if(sh[i]===sh[i-1]){run++;if(run>maxRun)maxRun=run;}else run=1; const j=Math.abs(sh[i]-sh[i-1]); if(j>maxJump)maxJump=j;}
 check("plateaus produce flat tops", maxRun>=6, `longest flat run=${maxRun}`);
 check("cliffs/steps present", maxJump>=PLATEAU.STEP-3, `biggest step=${maxJump}`);}
// rivers/lakes: standing water at the surface exists, but the world is NOT flooded
{let watered=0; const runs:number[]=[]; let cur=0;
 for(let i=0;i<N;i++){const x=X0+i; const y=sh[i]-1; const lq=at(x,y,"liquid"); const wet=lq!==0 && !isLava(lq) && liquidLevel(lq)>0;
   if(wet){watered++;cur++;}else{if(cur>0)runs.push(cur);cur=0;}}
 if(cur>0)runs.push(cur);
 const frac=watered/N; const rivers=runs.filter(r=>r>=2&&r<=14).length;
 check("surface water exists but is not a global flood", watered>0 && frac<0.12, `${(frac*100).toFixed(1)}% of surface wet`);
 check("occasional rivers/streams present", rivers>=3, `${rivers} narrow water channels over ${N} cols`);}
// beaches: sand at the surface near water
{let sandNearWater=0; for(let i=0;i<N;i++){const x=X0+i; if(at(x,sh[i],"fg")===TileId.Sand){ // is water within 4 cols?
   let near=false; for(let k=-4;k<=4;k++){const j=i+k; if(j<0||j>=N)continue; const lq=at(X0+j,sh[j]-1,"liquid"); if(lq!==0&&!isLava(lq)){near=true;break;}} if(near)sandNearWater++; }}
 check("beaches: sand shores around water", sandNearWater>=8, `${sandNearWater} sandy shore columns`);}
console.log(`\n${fails===0?"ALL PASSED":fails+" FAILED"}`);if(fails>0)process.exit(1);
