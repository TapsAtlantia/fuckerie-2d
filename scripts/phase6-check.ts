import { WorldGen } from "../src/world/WorldGen";
import { BiomeSystem } from "../src/world/Biome";
import { TileId, tile } from "../src/world/Tile";
import { CHUNK_SIZE } from "../src/config";
let fails=0; const check=(n:string,c:boolean,e="")=>{console.log(`${c?"PASS":"FAIL"}  ${n}${e?"  ("+e+")":""}`);if(!c)fails++;};
const SEED=71717; const g=new WorldGen(SEED); const bs=new BiomeSystem(SEED);
const cache=new Map<string,any>(); const chunk=(cx:number,cy:number)=>{const k=cx+","+cy;let c=cache.get(k);if(!c){c=g.generateChunk(cx,cy);cache.set(k,c);}return c;};
const at=(x:number,y:number)=>{const cx=Math.floor(x/CHUNK_SIZE),cy=Math.floor(y/CHUNK_SIZE);const lx=((x%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE,ly=((y%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;return chunk(cx,cy).fg[ly*CHUNK_SIZE+lx];};

// determinism
{const b=new WorldGen(SEED);let s=true;for(const[cx,cy] of [[0,10],[5,10],[-3,15]] as const){const x=g.generateChunk(cx,cy),y=b.generateChunk(cx,cy);if(!x.fg.every((v,i)=>v===y.fg[i]))s=false;}check("determinism",s);}

// The underground below each surface biome should PREDOMINANTLY inherit (rare mushroom/marble/granite
// pockets legitimately override a minority). Sample many columns × depths and require a majority.
const findCol=(name:(s:string)=>boolean)=>{for(let x=-40000;x<40000;x+=6){if(name(bs.surfaceBiomeAt(x).name))return x;}return null;};
const xJ=findCol(s=>s==="jungle"), xS=findCol(s=>s==="snowy"||s==="tundra"), xD=findCol(s=>s==="desert");
const inheritFrac=(match:(s:string)=>boolean, expect:string)=>{let hit=0,tot=0;
  for(let x=-40000;x<40000;x+=6){ if(!match(bs.surfaceBiomeAt(x).name))continue;
    for(const d of [150,250,350,450]){tot++; if(bs.undergroundBiomeAt(x,d,bs.surfaceBiomeAt(x)).name===expect)hit++;} if(tot>=1200)break; }
  return tot?hit/tot:0; };
const fJ=inheritFrac(s=>s==="jungle","underground jungle"), fS=inheritFrac(s=>s==="snowy"||s==="tundra","ice caves"), fD=inheritFrac(s=>s==="desert","underground desert");
console.log(`  inherit fraction: jungle->UG-jungle=${(fJ*100).toFixed(0)}%  snow->ice=${(fS*100).toFixed(0)}%  desert->UG-desert=${(fD*100).toFixed(0)}%`);
check("underground jungle under jungle surface", xJ!==null && fJ>0.7);
check("ice caves under snow surface", xS!==null && fS>0.7);
check("underground desert under desert surface", xD!==null && fD>0.7);

// marble / granite pockets + glowing mushroom region appear across a 2D sample
{const seen=new Set<string>(); for(let x=-6000;x<6000;x+=5)for(let d=100;d<900;d+=7){seen.add(bs.undergroundBiomeAt(x,d,bs.surfaceBiomeAt(x)).name);}
 check("marble & granite pockets exist", seen.has("marble caves") && seen.has("granite caves"), [...seen].join(", "));
 check("glowing mushroom biome exists", seen.has("glowing mushroom"));}

// tiles + glow: mushroom biome grass/plant emit light
check("mushroom biome tiles emit light", tile(TileId.MushroomGrass).lightEmit>0 && tile(TileId.GlowMushroom).lightEmit>0, `grass=${tile(TileId.MushroomGrass).lightEmit} shroom=${tile(TileId.GlowMushroom).lightEmit}`);

// generated world: underground jungle actually places Mud + grows JungleGrass on cave faces
if(xJ!==null){const cxj=Math.floor(xJ/CHUNK_SIZE); let mud=0,jgrass=0,vines=0;
 for(let cy=8;cy<=13;cy++)for(let dcx=-1;dcx<=1;dcx++){const ch=chunk(cxj+dcx,cy); for(let i=0;i<ch.fg.length;i++){const t=ch.fg[i]; if(t===TileId.Mud)mud++; else if(t===TileId.JungleGrass)jgrass++; else if(t===TileId.Vines)vines++;}}
 check("underground jungle places mud + grows jungle grass", mud>200 && jgrass>20, `mud=${mud} grass=${jgrass} vines=${vines}`);}
else check("underground jungle places mud + grows jungle grass", false, "no jungle column found");

// generated world: a mushroom region places glowing mushroom grass
{let found=false; outer: for(let x=-6000;x<6000;x+=40)for(let d=140;d<700;d+=40){ if(bs.undergroundBiomeAt(x,d,bs.surfaceBiomeAt(x)).name==="glowing mushroom"){
   const cx=Math.floor(x/CHUNK_SIZE),cy=Math.floor(d/CHUNK_SIZE); const ch=chunk(cx,cy); if(ch.fg.some((t:number)=>t===TileId.MushroomGrass||t===TileId.GlowMushroom)){found=true;break outer;} }}
 check("mushroom region places glowing tiles in-world", found);}
console.log(`\n${fails===0?"ALL PASSED":fails+" FAILED"}`);if(fails>0)process.exit(1);
