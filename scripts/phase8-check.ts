import { WorldGen } from "../src/world/WorldGen";
import { DungeonSystem } from "../src/world/Dungeon";
import { TileId, tile, isSolid } from "../src/world/Tile";
import { CHUNK_SIZE } from "../src/config";
let fails=0; const check=(n:string,c:boolean,e="")=>{console.log(`${c?"PASS":"FAIL"}  ${n}${e?"  ("+e+")":""}`);if(!c)fails++;};
const SEED=1337; const g=new WorldGen(SEED); const dun=new DungeonSystem(SEED,(x)=>g.surfaceHeight(x));
const cx0=dun.centerX(), top=dun.top, left=dun.left;
const cache=new Map<string,any>(); const chunk=(cx:number,cy:number)=>{const k=cx+","+cy;let c=cache.get(k);if(!c){c=g.generateChunk(cx,cy);cache.set(k,c);}return c;};
const at=(x:number,y:number,layer:"fg"|"bg")=>{const cx=Math.floor(x/CHUNK_SIZE),cy=Math.floor(y/CHUNK_SIZE);const lx=((x%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE,ly=((y%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;return chunk(cx,cy)[layer][ly*CHUNK_SIZE+lx];};
const brick=new Set([TileId.DungeonBrickBlue,TileId.DungeonBrickGreen,TileId.DungeonBrickPink]);
const wallset=new Set([TileId.DungeonWallBlue,TileId.DungeonWallGreen,TileId.DungeonWallPink]);
let nb=0,nw=0,air=0,door=0,chest=0,spike=0,web=0,chunksSpanned=new Set<string>();
for(let y=top-4;y<top+430;y++)for(let x=left;x<left+150;x++){const fg=at(x,y,"fg"),bg=at(x,y,"bg");
  if(brick.has(fg))nb++; if(wallset.has(bg))nw++; if(fg===TileId.Air&&wallset.has(bg))air++;
  if(fg===TileId.DungeonDoor)door++; if(fg===TileId.GoldChest)chest++; if(fg===TileId.Spike)spike++; if(fg===TileId.Cobweb)web++;
  chunksSpanned.add(Math.floor(x/CHUNK_SIZE)+","+Math.floor(y/CHUNK_SIZE));}
console.log(`  dungeon @center x=${cx0} (top y=${top})  brick=${nb} wall=${nw} air-rooms=${air} door=${door} chest=${chest} spike=${spike} web=${web}  spans ${chunksSpanned.size} chunks`);
// determinism
{const b=new WorldGen(SEED); let ok=true; for(const[cx,cy] of [[Math.floor(cx0/CHUNK_SIZE),Math.floor(top/CHUNK_SIZE)+2],[Math.floor(left/CHUNK_SIZE),Math.floor(top/CHUNK_SIZE)+6]] as const){const p=g.generateChunk(cx,cy),q=b.generateChunk(cx,cy); if(!p.fg.every((v,i)=>v===q[`fg`][i])||!p.bg.every((v,i)=>v===q.bg[i]))ok=false;} check("determinism (identical across peers)",ok);}
check("dungeon is at a findable spot near spawn", Math.abs(cx0)<2100, `centerX=${cx0}`);
check("colored dungeon brick + background walls", nb>2000 && nw>4000, `brick=${nb} wall=${nw}`);
check("branching corridors & cells (hollow rooms)", air>3000, `air-in-walls=${air}`);
check("locked boss-gated entrance door", door>0, `${door} door tiles`);
check("locked chests present", chest>0, `${chest} chests`);
check("spikes present", spike>0, `${spike} spikes`);
check("cobwebs present", web>50, `${web} cobwebs`);
check("dungeon spans many chunks (large multi-chunk structure)", chunksSpanned.size>=20, `${chunksSpanned.size} chunks`);
console.log(`\n${fails===0?"ALL PASSED":fails+" FAILED"}`);if(fails>0)process.exit(1);
