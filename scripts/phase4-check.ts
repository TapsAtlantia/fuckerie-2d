import { WorldGen } from "../src/world/WorldGen";
import { TileId, tile } from "../src/world/Tile";
import { CHUNK_SIZE } from "../src/config";
let fails=0; const check=(n:string,c:boolean,e="")=>{console.log(`${c?"PASS":"FAIL"}  ${n}${e?"  ("+e+")":""}`);if(!c)fails++;};
const g=new WorldGen(31337);
// gather ores over a tall strip
const X0=0, XW=96, Y0=0, YH=1240;
const ores:{id:number,x:number,y:number}[]=[]; let stone=0;
const key=(x:number,y:number)=>x+","+y; const oreMap=new Map<string,number>();
for(let cy=Math.floor(Y0/CHUNK_SIZE); cy<Math.ceil((Y0+YH)/CHUNK_SIZE); cy++){
  for(let cx=Math.floor(X0/CHUNK_SIZE); cx<Math.ceil((X0+XW)/CHUNK_SIZE); cx++){
    const ch=g.generateChunk(cx,cy);
    for(let ly=0;ly<CHUNK_SIZE;ly++)for(let lx=0;lx<CHUNK_SIZE;lx++){
      const id=ch.fg[ly*CHUNK_SIZE+lx]; const cat=tile(id).category; const x=cx*CHUNK_SIZE+lx,y=cy*CHUNK_SIZE+ly;
      if(cat==="stone")stone++;
      if(cat==="ore"||cat==="gem"){ores.push({id,x,y}); oreMap.set(key(x,y),id);}
    }
  }
}
const depthsOf=(...ids:number[])=>ores.filter(o=>ids.includes(o.id)).map(o=>o.y);
const avg=(a:number[])=>a.length?a.reduce((s,v)=>s+v,0)/a.length:NaN;
const cnt=(...ids:number[])=>ores.filter(o=>ids.includes(o.id)).length;
const cuTin=depthsOf(TileId.CopperOre,TileId.TinOre), fedb=depthsOf(TileId.IronOre,TileId.LeadOre),
  agw=depthsOf(TileId.SilverOre,TileId.TungstenOre), aupt=depthsOf(TileId.GoldOre,TileId.PlatinumOre);
console.log(`  ore tiles=${ores.length} stone=${stone} frac=${(ores.length/(stone+ores.length)*100).toFixed(1)}%`);
console.log(`  avg depth: cu/tin=${avg(cuTin).toFixed(0)} fe/pb=${avg(fedb).toFixed(0)} ag/w=${avg(agw).toFixed(0)} au/pt=${avg(aupt).toFixed(0)}`);

// determinism
{const b=new WorldGen(31337);let s=true;for(const[cx,cy] of [[0,3],[1,20],[2,35]] as const){const x=g.generateChunk(cx,cy),y=b.generateChunk(cx,cy);if(!x.fg.every((v,i)=>v===y.fg[i]))s=false;}check("determinism",s);}
check("ore is a sensible fraction of stone", ores.length/(stone+ores.length) < 0.09 && ores.length>200, `${(ores.length/(stone+ores.length)*100).toFixed(1)}%`);
check("depth curve: gold/platinum deeper than copper/tin", avg(aupt) > avg(cuTin)+250 && avg(agw)>avg(fedb) && avg(fedb)>avg(cuTin), `cu=${avg(cuTin).toFixed(0)} < au=${avg(aupt).toFixed(0)}`);
check("copper/tin appears shallow", cuTin.length>0 && Math.min(...cuTin) < 120, `min=${cuTin.length?Math.min(...cuTin):-1}`);
check("gold only deep", aupt.length>0 && Math.min(...aupt) >= 400, `min=${aupt.length?Math.min(...aupt):-1}`);
// alt-metal pairing: region uses ONE of each pair (the other absent)
check("alt-metal pairing (copper XOR tin in a region)", (cnt(TileId.CopperOre)===0)!==(cnt(TileId.TinOre)===0), `copper=${cnt(TileId.CopperOre)} tin=${cnt(TileId.TinOre)}`);
// gems deep only
{const gems=ores.filter(o=>[TileId.Amethyst,TileId.Topaz,TileId.Sapphire,TileId.Emerald,TileId.Ruby,TileId.Diamond].includes(o.id));
 check("gems appear (deep pockets)", gems.length>5 && Math.min(...gems.map(o=>o.y))>=120, `${gems.length} gems, shallowest=${gems.length?Math.min(...gems.map(o=>o.y)):-1}`);}
// veins are clustered (connected same-id blobs avg size >= 3, few singletons)
{const seen=new Set<string>(); const sizes:number[]=[];
 for(const o of ores){ if(seen.has(key(o.x,o.y)))continue; const id=o.id; let sz=0; const st=[[o.x,o.y]]; seen.add(key(o.x,o.y));
   while(st.length){const [x,y]=st.pop()!; sz++; for(const[dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const){const nx=x+dx,ny=y+dy,k=key(nx,ny); if(!seen.has(k)&&oreMap.get(k)===id){seen.add(k);st.push([nx,ny]);}}}
   sizes.push(sz);}
 const avgSz=avg(sizes); const singles=sizes.filter(s=>s===1).length/sizes.length;
 check("veins are clustered blobs (not single specks)", avgSz>=3 && singles<0.5, `avg vein=${avgSz.toFixed(1)} tiles, ${(singles*100).toFixed(0)}% singletons`);}
console.log(`\n${fails===0?"ALL PASSED":fails+" FAILED"}`);if(fails>0)process.exit(1);
