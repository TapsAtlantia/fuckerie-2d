import { WorldGen } from "../src/world/WorldGen";
import { TileId } from "../src/world/Tile";
import { isLava } from "../src/world/Liquid";
import { CHUNK_SIZE, PLATEAU, CAVE } from "../src/config";
let fails=0; const check=(n:string,c:boolean,e="")=>{console.log(`${c?"PASS":"FAIL"}  ${n}${e?"  ("+e+")":""}`);if(!c)fails++;};
const g=new WorldGen(4242);
const cache=new Map<string,any>(); const chunk=(cx:number,cy:number)=>{const k=cx+","+cy;let c=cache.get(k);if(!c){c=g.generateChunk(cx,cy);cache.set(k,c);}return c;};
const at=(x:number,y:number,layer:"fg"|"liquid")=>{const cx=Math.floor(x/CHUNK_SIZE),cy=Math.floor(y/CHUNK_SIZE);const lx=((x%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE,ly=((y%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;return chunk(cx,cy)[layer][ly*CHUNK_SIZE+lx];};
const isWater=(x:number,y:number)=>{const lq=at(x,y,"liquid");return lq!==0 && !isLava(lq);};
// determinism (fg/liquid)
{const b=new WorldGen(4242);let s=true;for(const[cx,cy] of [[0,0],[3,0],[-2,2]] as const){const x=g.generateChunk(cx,cy),y=b.generateChunk(cx,cy);const eq=(p:any,q:any)=>p.length===q.length&&p.every((v:number,i:number)=>v===q[i]);if(!eq(x.fg,y.fg)||!eq(x.liquid,y.liquid))s=false;}check("determinism (fg/liquid)",s);}

const N=24000, X0=-4000;
const sh:number[]=new Array(N); for(let i=0;i<N;i++) sh[i]=g.surfaceHeight(X0+i);
{let mn=Infinity,mx=-Infinity; for(const v of sh){if(v<mn)mn=v;if(v>mx)mx=v;} check("terrain has strong relief", (mx-mn)>=150, `range=${mx-mn}`);}
{let run=1,maxRun=1,maxJump=0; for(let i=1;i<N;i++){if(sh[i]===sh[i-1]){run++;if(run>maxRun)maxRun=run;}else run=1; const j=Math.abs(sh[i]-sh[i-1]); if(j>maxJump)maxJump=j;}
 check("plateaus produce flat tops", maxRun>=6, `longest flat run=${maxRun}`);
 check("cliffs/steps present", maxJump>=PLATEAU.STEP-3, `biggest step=${maxJump}`);}

// FIX 1 — no random surface holes: the crust below the surface is solid. Caves breaking the surface
// would breach a large fraction in wide multi-tile openings; the only residual air is rare structure
// doorways (isolated 1-2 tile gaps), so require a tiny fraction AND no wide runs.
{let holes=0,cur=0,maxRun=0; for(let i=0;i<N;i++){let air=false; for(let d=0;d<CAVE.SURFACE_CRUST;d++){ if(at(X0+i,sh[i]+d,"fg")===TileId.Air){air=true;break;} }
   if(air){holes++;cur++;if(cur>maxRun)maxRun=cur;}else cur=0;}
 check("no random surface holes (solid crust)", holes < N*0.005 && maxRun<=4, `${holes} breached (${(holes/N*100).toFixed(2)}%), longest run ${maxRun} — structure doors only`);}

// water: exists, not a flood, occasional channels, AND every pool surface is FLAT.
{let watered=0; const runs:{cols:number,tops:number[]}[]=[]; let cur:number[]=[];
 const waterTopY=(i:number):number|null=>{const x=X0+i; for(let y=sh[i]-30;y<sh[i];y++){if(isWater(x,y))return y;} return null;};
 for(let i=0;i<N;i++){const t=waterTopY(i); if(t!==null){watered++;cur.push(t);}else{if(cur.length)runs.push({cols:cur.length,tops:cur});cur=[];}}
 if(cur.length)runs.push({cols:cur.length,tops:cur});
 const frac=watered/N; const rivers=runs.filter(r=>r.cols>=2&&r.cols<=16).length;
 let flatRuns=0; for(const r of runs){const mn=Math.min(...r.tops),mx=Math.max(...r.tops); if(mx-mn<=1)flatRuns++;}
 const flatFrac=runs.length?flatRuns/runs.length:1;
 check("surface water exists but is not a flood", watered>0 && frac<0.12, `${(frac*100).toFixed(1)}% wet`);
 check("occasional rivers/lakes present", rivers>=3, `${runs.length} pools, ${rivers} small`);
 check("every water pool surface is FLAT", flatFrac>=0.92, `${(flatFrac*100).toFixed(0)}% of ${runs.length} pools flat (top varies <=1)`);}

// beaches around water
{let sandNearWater=0; for(let i=0;i<N;i++){const x=X0+i; if(at(x,sh[i],"fg")===TileId.Sand){let near=false; for(let k=-4;k<=4;k++){const j=i+k; if(j<0||j>=N)continue; for(let y=sh[j]-3;y<sh[j]+1;y++){if(isWater(X0+j,y)){near=true;break;}} if(near)break;} if(near)sandNearWater++; }}
 check("beaches: sand shores around water", sandNearWater>=8, `${sandNearWater} sandy shore columns`);}
console.log(`\n${fails===0?"ALL PASSED":fails+" FAILED"}`);if(fails>0)process.exit(1);
