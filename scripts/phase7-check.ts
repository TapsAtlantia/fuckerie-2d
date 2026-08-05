import { WorldGen } from "../src/world/WorldGen";
import { BiomeSystem } from "../src/world/Biome";
import { TileId, tile } from "../src/world/Tile";
import { CHUNK_SIZE } from "../src/config";
let fails=0; const check=(n:string,c:boolean,e="")=>{console.log(`${c?"PASS":"FAIL"}  ${n}${e?"  ("+e+")":""}`);if(!c)fails++;};
function run(SEED:number){
  const g=new WorldGen(SEED), bs=new BiomeSystem(SEED); const kind=bs.evilKind();
  const cache=new Map<string,any>(); const chunk=(cx:number,cy:number)=>{const k=cx+","+cy;let c=cache.get(k);if(!c){c=g.generateChunk(cx,cy);cache.set(k,c);}return c;};
  // find an evil band
  let evilX=null; for(let x=-60000;x<60000;x+=3){if(bs.isEvil(x)){evilX=x;break;}}
  // generate a block covering the band from surface to depth ~220
  const counts=new Map<number,number>(); let chasmAir=0, maxColAir=0;
  if(evilX!==null){const cx0=Math.floor((evilX-40)/CHUNK_SIZE), cx1=Math.floor((evilX+120)/CHUNK_SIZE);
    for(let cx=cx0;cx<=cx1;cx++)for(let cy=-4;cy<=7;cy++){const ch=chunk(cx,cy);for(const t of ch.fg)counts.set(t,(counts.get(t)||0)+1);}
    // chasm: count deep air columns from surface in evil band
    for(let x=evilX-40;x<evilX+120;x++){ if(!bs.isEvil(x))continue; const sh=g.surfaceHeight(x); let a=0; for(let d=0;d<70;d++){const cx=Math.floor(x/CHUNK_SIZE),cy=Math.floor((sh+d)/CHUNK_SIZE),lx=((x%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE,ly=(((sh+d)%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE; if(chunk(cx,cy).fg[ly*CHUNK_SIZE+lx]===TileId.Air)a++;} if(a>maxColAir)maxColAir=a; }}
  const c=(t:number)=>counts.get(t)||0;
  const evilStone = kind==="corruption"?TileId.Ebonstone:TileId.Crimstone;
  const evilGrass = kind==="corruption"?TileId.CorruptGrass:TileId.CrimsonGrass;
  const evilAltar = kind==="corruption"?TileId.DemonAltar:TileId.CrimsonAltar;
  const evilOrb = kind==="corruption"?TileId.ShadowOrb:TileId.CrimsonHeart;
  const otherStone = kind==="corruption"?TileId.Crimstone:TileId.Ebonstone;
  const otherGrass = kind==="corruption"?TileId.CrimsonGrass:TileId.CorruptGrass;
  const otherAltar = kind==="corruption"?TileId.CrimsonAltar:TileId.DemonAltar;
  const otherOrb = kind==="corruption"?TileId.CrimsonHeart:TileId.ShadowOrb;
  console.log(`  seed ${SEED}: evil=${kind}  band@${evilX}  stone=${c(evilStone)} grass=${c(evilGrass)} altar=${c(evilAltar)} orb=${c(evilOrb)} maxChasmAir=${maxColAir}  OTHER(stone=${c(otherStone)} grass=${c(otherGrass)} altar=${c(otherAltar)} orb=${c(otherOrb)})`);
  check(`[${SEED}] evil band found`, evilX!==null);
  check(`[${SEED}] evil grass + stone generate`, c(evilGrass)>20 && c(evilStone)>500, `grass=${c(evilGrass)} stone=${c(evilStone)}`);
  check(`[${SEED}] evil chasms descend from surface`, maxColAir>=40, `max chasm air col=${maxColAir}`);
  check(`[${SEED}] altars present`, c(evilAltar)>0, `${c(evilAltar)} altars`);
  check(`[${SEED}] shadow orbs / crimson hearts present`, c(evilOrb)>0, `${c(evilOrb)} orbs`);
  check(`[${SEED}] the OTHER evil never generates`, c(otherStone)===0 && c(otherGrass)===0 && c(otherAltar)===0 && c(otherOrb)===0);
  return kind;
}
// determinism
{const a=new WorldGen(2024).generateChunk(0,3), b=new WorldGen(2024).generateChunk(0,3); check("determinism", a.fg.every((v,i)=>v===b.fg[i]));}
// run several seeds to hit both kinds
const kinds=new Set<string>(); for(const s of [7,2024,55,91,4242]) kinds.add(run(s));
check("both corruption AND crimson occur across seeds", kinds.has("corruption") && kinds.has("crimson"), [...kinds].join("+"));
// reserved hallow ids exist but are unused by gen (checked implicitly: props exist)
check("hallow ids reserved (props exist)", tile(TileId.PearlStone).name==="pearlstone" && tile(TileId.HallowedGrass).name==="hallowed grass");
console.log(`\n${fails===0?"ALL PASSED":fails+" FAILED"}`);if(fails>0)process.exit(1);
