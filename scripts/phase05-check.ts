import { WorldGen } from "../src/world/WorldGen";
import { ChunkManager } from "../src/world/ChunkManager";
import { chunkSizeForY, VIEW_MARGIN_TILES, PRELOAD_RADIUS_TILES } from "../src/config";
let fails=0; const check=(n:string,c:boolean,e="")=>{console.log(`${c?"PASS":"FAIL"}  ${n}${e?"  ("+e+")":""}`);if(!c)fails++;};
const fd=(a:number,b:number)=>Math.floor(a/b);
const w=new ChunkManager(new WorldGen(1337));
const residentKeys=()=>{const s=new Set<string>(); for(const c of w.loadedChunks())s.add(c.x0+","+c.y0); return s;};
// a tile is covered if the chunk that would contain it is resident
const covered=(res:Set<string>,tx:number,ty:number)=>{const s=chunkSizeForY(ty); return res.has((fd(tx,s)*s)+","+(fd(ty,s)*s));};
const viewAt=(px:number)=>[px-20,-12,px+20,12] as const;
// every tile in view+margin covered?
const viewCovered=(res:Set<string>,px:number)=>{const v=viewAt(px); for(let ty=v[1]-VIEW_MARGIN_TILES;ty<=v[3]+VIEW_MARGIN_TILES;ty++)for(let tx=v[0]-VIEW_MARGIN_TILES;tx<=v[2]+VIEW_MARGIN_TILES;tx++)if(!covered(res,tx,ty))return false; return true;};

w.update(...viewAt(0));
check("view+margin fully covered after one tick", viewCovered(residentKeys(),0));
const after1=w.loadedCount;
for(let i=0;i<80;i++) w.update(...viewAt(0));
check("preload ring fills over background ticks", w.loadedCount>after1 && w.loadedCount>30, `after1=${after1} saturated=${w.loadedCount}`);

// walking: the view at each new spot is already covered BEFORE we update there (no gen at view edge)
{let ok=true,worst=""; const stepTiles=32;
 for(let s=1; s<=Math.floor(PRELOAD_RADIUS_TILES/stepTiles); s++){ const px=s*stepTiles;
   if(!viewCovered(residentKeys(),px)){ok=false;worst=`step ${s} (x=${px}) not pre-covered`;}
   w.update(...viewAt(px)); }
 check("view is preloaded before the player reaches it (no hitch)", ok, worst||"all pre-covered");}

// memory bounded after walking far
{for(let s=0;s<50;s++) w.update(...viewAt(s*32)); check("memory bounded while walking far", w.loadedCount<400, `loadedCount=${w.loadedCount}`);}

// tile reads correct vs direct generation, and correct across a band boundary (size changes at y=256)
{w.update(-40,200,40,320); const g=new WorldGen(1337); let ok=true;
 for(const [tx,ty] of [[5,210],[5,255],[5,256],[-3,255],[-3,256],[20,300]] as const){ const s=chunkSizeForY(ty); const ch=g.generateChunkAt(fd(tx,s)*s, fd(ty,s)*s, s); const idx=(ty-fd(ty,s)*s)*s+(tx-fd(tx,s)*s); if(w.getFg(tx,ty)!==ch.fg[idx])ok=false; }
 check("tile reads correct across variable-size band boundary", ok);}

// edits survive chunk unload/reload at absolute coords, regardless of size
{w.update(...viewAt(0)); w.setFg(3,7,300); w.setBg(3,7,58);
 for(let s=0;s<60;s++) w.update(...viewAt(9000)); // walk far away (unload)
 w.update(...viewAt(0)); // come back
 check("edits survive unload/reload (variable chunks)", w.getFg(3,7)===300 && w.getBg(3,7)===58, `fg=${w.getFg(3,7)} bg=${w.getBg(3,7)}`);}
console.log(`\n${fails===0?"ALL PASSED":fails+" FAILED"}`);if(fails>0)process.exit(1);
