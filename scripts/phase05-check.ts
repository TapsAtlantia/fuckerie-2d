import { WorldGen } from "../src/world/WorldGen";
import { ChunkManager } from "../src/world/ChunkManager";
import { CHUNK_SIZE, VIEW_MARGIN_CHUNKS, PRELOAD_RADIUS_CHUNKS } from "../src/config";
let fails=0; const check=(n:string,c:boolean,e="")=>{console.log(`${c?"PASS":"FAIL"}  ${n}${e?"  ("+e+")":""}`);if(!c)fails++;};
const fd=(a:number,b:number)=>Math.floor(a/b);
const w=new ChunkManager(new WorldGen(1337));
const resident=()=>{const s=new Set<string>(); for(const c of w.loadedChunks())s.add(c.cx+","+c.cy); return s;};
// a view ~40x24 tiles centered at tile (px,0)
const viewAt=(px:number)=>[px-20,-12,px+20,12] as const;
const viewChunks=(px:number)=>{const r=viewAt(px); const a:string[]=[]; for(let cy=fd(r[1],CHUNK_SIZE)-VIEW_MARGIN_CHUNKS;cy<=fd(r[3],CHUNK_SIZE)+VIEW_MARGIN_CHUNKS;cy++)for(let cx=fd(r[0],CHUNK_SIZE)-VIEW_MARGIN_CHUNKS;cx<=fd(r[2],CHUNK_SIZE)+VIEW_MARGIN_CHUNKS;cx++)a.push(cx+","+cy); return a;};

// tick once; view+margin must all be resident immediately (no incomplete visible chunks)
w.update(...viewAt(0));
{const res=resident(); const vc=viewChunks(0); check("view+margin resident after one tick", vc.every(k=>res.has(k)), `${vc.filter(k=>res.has(k)).length}/${vc.length}`);}
// ring fills in the background over successive ticks (budget-limited, so it grows then saturates)
const after1=resident().size;
for(let i=0;i<60;i++) w.update(...viewAt(0));
const saturated=resident().size;
check("preload ring fills over background ticks", saturated>after1 && saturated>200, `after1=${after1} saturated=${saturated}`);

// walking: chunks the player moves into were ALREADY preloaded (no fresh gen at the view edge)
{let hitchFree=true; let worst="";
 for(let step=1;step<=PRELOAD_RADIUS_CHUNKS;step++){ const px=step*CHUNK_SIZE; const res=resident(); // BEFORE updating at the new spot
   const need=viewChunks(px); const missing=need.filter(k=>!res.has(k));
   if(missing.length>0){hitchFree=false; worst=`step ${step}: ${missing.length} not preloaded`;}
   w.update(...viewAt(px)); }
 check("chunks are preloaded before the player reaches them (no hitch)", hitchFree, worst||"all pre-resident");}

// memory bounded after walking far
{for(let step=0;step<40;step++) w.update(...viewAt(step*CHUNK_SIZE)); const n=w.loadedCount;
 check("memory bounded while walking far", n<700, `loadedCount=${n}`);}
// tile access still correct (matches direct generateChunk)
{w.update(...viewAt(0)); const g=new WorldGen(1337); const ch=g.generateChunk(0,0);
 let ok=true; for(let i=0;i<50;i++){ const lx=i%CHUNK_SIZE, ly=(i*7)%CHUNK_SIZE; if(w.getFg(lx,ly)!==ch.fg[ly*CHUNK_SIZE+lx])ok=false; }
 check("tile reads unchanged vs direct generation", ok);}
console.log(`\n${fails===0?"ALL PASSED":fails+" FAILED"}`);if(fails>0)process.exit(1);
