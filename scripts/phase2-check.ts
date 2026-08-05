import { WorldGen } from "../src/world/WorldGen";
import { ChunkManager } from "../src/world/ChunkManager";
import { TileId, isWall, naturalWall } from "../src/world/Tile";
import { isEnclosed } from "../src/world/Enclosure";
import { CHUNK_SIZE } from "../src/config";
let fails=0; const check=(n:string,c:boolean,e="")=>{console.log(`${c?"PASS":"FAIL"}  ${n}${e?"  ("+e+")":""}`);if(!c)fails++;};
const eq=(a:Uint16Array,b:Uint16Array)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const g=new WorldGen(909);
// determinism
{const b=new WorldGen(909);let s=true;for(const[cx,cy] of [[0,0],[2,8],[-1,20]] as const){const x=g.generateChunk(cx,cy),y=b.generateChunk(cx,cy);if(!eq(x.fg,y.fg)||!eq(x.bg,y.bg))s=false;}check("determinism preserved",s);}
// mapping
check("naturalWall maps materials", naturalWall(TileId.Dirt)===TileId.DirtWall && naturalWall(TileId.Stone)===TileId.StoneWall && naturalWall(TileId.CloudStone)===0);
// caves have walls behind; surface sky has none
{let caveAir=0, caveWalled=0, skyChecked=0, skyWallless=0;
 const cache=new Map<string,any>(); const chunk=(cx:number,cy:number)=>{const k=cx+","+cy;let c=cache.get(k);if(!c){c=g.generateChunk(cx,cy);cache.set(k,c);}return c;};
 const at=(x:number,y:number,layer:"fg"|"bg")=>{const cx=Math.floor(x/CHUNK_SIZE),cy=Math.floor(y/CHUNK_SIZE);const lx=((x%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE,ly=((y%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;return chunk(cx,cy)[layer][ly*CHUNK_SIZE+lx];};
 for(let x=0;x<400;x++){const sh=g.surfaceHeight(x);
   for(let d=4;d<=40;d++){const y=sh+d; if(at(x,y,"fg")===TileId.Air){caveAir++; if(isWall(at(x,y,"bg")))caveWalled++;}}
   for(let d=3;d<=10;d++){const y=sh-d; skyChecked++; if(at(x,y,"bg")===TileId.Air)skyWallless++;}
 }
 check("caves have walls behind them", caveAir>50 && caveWalled/caveAir>0.9, `${caveWalled}/${caveAir} cave-air tiles walled`);
 check("open sky has no wall", skyWallless===skyChecked, `${skyWallless}/${skyChecked} above-surface tiles wall-less`);
}
// enclosure helper
{const w=new ChunkManager(new WorldGen(909)); w.update(-12,-312,12,-288);
 for(let x=0;x<=4;x++)for(let y=-304;y<=-300;y++){ if(x===0||x===4||y===-304||y===-300) w.setFg(x,y,TileId.Stone); }
 for(let x=1;x<=3;x++)for(let y=-303;y<=-301;y++) w.setBg(x,y,TileId.WoodWall);
 check("walled room is enclosed", isEnclosed(w,2,-302)===true);
 w.setBg(2,-302,TileId.Air); // punch a wall-less hole in the interior
 check("open interior is not enclosed", isEnclosed(w,2,-302)===false);
}
console.log(`\n${fails===0?"ALL PASSED":fails+" FAILED"}`);if(fails>0)process.exit(1);
