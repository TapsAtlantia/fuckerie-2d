import { WorldGen } from "../src/world/WorldGen";
import { CaveSystem } from "../src/world/Caves";
import { BiomeSystem } from "../src/world/Biome";
import { TileId, isWall } from "../src/world/Tile";
import { CHUNK_SIZE, CAVE } from "../src/config";
let fails=0; const check=(n:string,c:boolean,e="")=>{console.log(`${c?"PASS":"FAIL"}  ${n}${e?"  ("+e+")":""}`);if(!c)fails++;};
const g=new WorldGen(5150);
const cache=new Map<string,any>(); const chunk=(cx:number,cy:number)=>{const k=cx+","+cy;let c=cache.get(k);if(!c){c=g.generateChunk(cx,cy);cache.set(k,c);}return c;};
const at=(x:number,y:number,layer:"fg"|"bg")=>{const cx=Math.floor(x/CHUNK_SIZE),cy=Math.floor(y/CHUNK_SIZE);const lx=((x%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE,ly=((y%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;return chunk(cx,cy)[layer][ly*CHUNK_SIZE+lx];};
const air=(x:number,y:number)=>at(x,y,"fg")===TileId.Air;

// determinism
{const b=new WorldGen(5150);let s=true;for(const[cx,cy] of [[0,2],[1,22],[-1,32]] as const){const x=g.generateChunk(cx,cy),y=b.generateChunk(cx,cy);if(!x.fg.every((v,i)=>v===y.fg[i]))s=false;}check("determinism",s);}

// depth progression: air fraction below surface grows tunnels->rooms->caverns
const X0=-2000,XW=3000;
const bandFrac=(d0:number,d1:number)=>{let a=0,t=0;for(let x=X0;x<X0+XW;x+=1){const sh=g.surfaceHeight(x);for(let d=d0;d<d1;d+=3){t++;if(air(x,sh+d))a++;}}return a/t;};
const shallow=bandFrac(10,120), mid=bandFrac(220,420), deep=bandFrac(620,1020);
console.log(`  air fraction: shallow=${(shallow*100).toFixed(1)}% mid=${(mid*100).toFixed(1)}% deep=${(deep*100).toFixed(1)}%`);
check("cave density grows with depth (tunnels->caverns)", shallow<mid && mid<deep && shallow<0.12 && deep>0.22, `${(shallow*100).toFixed(1)}% < ${(mid*100).toFixed(1)}% < ${(deep*100).toFixed(1)}%`);

// connectivity in a deep region: air is in substantial caves, not speckled tiny bubbles. (Measured
// by component-size distribution rather than a single "largest", which a bounded window clips as
// tunnels leave/re-enter the sample.)
{const rx0=0,rx1=320,ry0=650,ry1=1130; const airSet=new Set<string>(); const key=(x:number,y:number)=>x+","+y;
 for(let y=ry0;y<ry1;y++)for(let x=rx0;x<rx1;x++)if(air(x,y))airSet.add(key(x,y));
 const seen=new Set<string>(); let total=airSet.size,tiny=0,big=0,biggest=0;
 const NB=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] as const; // 8-conn: diagonals are passable
 for(const s of airSet){ if(seen.has(s))continue; let sz=0; const st=[s.split(",").map(Number)]; seen.add(s);
   while(st.length){const [x,y]=st.pop()!; sz++; for(const[dx,dy] of NB){const k=key(x+dx,y+dy); if(airSet.has(k)&&!seen.has(k)){seen.add(k);st.push([x+dx,y+dy]);}}}
   if(sz<5)tiny+=sz; if(sz>=25)big+=sz; if(sz>biggest)biggest=sz; }
 check("deep caves are substantial & not speckled", big/total>0.7 && tiny/total<0.15 && biggest>1000, `${(big/total*100).toFixed(0)}% in caves>=25t, ${(tiny/total*100).toFixed(0)}% in <5t bubbles, largest=${biggest}`);}

// walls behind caves preserved (Phase 2)
{let a=0,walled=0; for(let x=0;x<200;x++)for(let d=200;d<600;d+=5){const sh=g.surfaceHeight(x); const y=sh+d; if(air(x,y)){a++; if(isWall(at(x,y,"bg")))walled++;}}
 check("background walls remain behind caves", a>50 && walled/a>0.9, `${walled}/${a} cave-air tiles walled`);}

// surface openings must be legitimate: a steep cave mouth OR an evil chasm — not random flat-ground
// holes (only rare structure doorways remain). And every carved mouth must connect into the caves.
{const cs=new CaveSystem(5150), bs=new BiomeSystem(5150); let breach=0,illegit=0,carved=0,connected=0,cols=0; const N=8000;
 for(let i=0;i<N;i++){const x=X0+i;cols++;const sh=g.surfaceHeight(x); const slope=Math.abs(g.surfaceHeight(x+2)-g.surfaceHeight(x-2));
   let b=false; for(let d=0;d<CAVE.SURFACE_CRUST;d++)if(air(x,sh+d)){b=true;break;}
   const steep=slope>=CAVE.MOUTH_MIN_SLOPE, evil=bs.isEvil(x);
   if(b && !steep && !evil) illegit++;
   if(b) breach++;
   if(steep && air(x,sh)){ carved++; const style=bs.surfaceBiomeAt(x).caveStyle; let conn=false;
     for(let d=0;d<=CAVE.MOUTH_REACH+2;d++){ if(!air(x,sh+d))break; if(cs.caveAt(x,sh+d,style)){conn=true;break;} }
     if(conn)connected++; }}
 check("surface openings are mouths/chasms, not flat-ground holes", breach/cols<0.05 && illegit/cols<0.006, `${(breach/cols*100).toFixed(2)}% breached, ${illegit} illegit (structure doors)`);
 check("carved cave mouths connect to the network", carved>20 && connected/carved>0.9, `${connected}/${carved} carved mouths connect`);}
console.log(`\n${fails===0?"ALL PASSED":fails+" FAILED"}`);if(fails>0)process.exit(1);
