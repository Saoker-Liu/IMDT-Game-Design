export const SIZE = 10;
export const validCell = c => Number.isInteger(c) && c >= 0 && c < SIZE * SIZE;
export const shape = ship => ({ width:ship.vertical?(ship.width||1):ship.length, height:ship.vertical?ship.length:(ship.width||1) });
export function cells(ship) {
  if(ship.x===null||ship.y===null)return [];
  const {width,height}=shape(ship);
  return Array.from({length:width*height},(_,n)=>(ship.y+Math.floor(n/width))*SIZE+ship.x+n%width);
}
export const isSunk = (player,ship) => cells(ship).length>0&&cells(ship).every(c=>ship.hits.includes(c));
export function canPlace(ships,id,x,y,vertical,terrain=null) {
  const ship=ships.find(s=>s.id===id);
  if(!ship||!Number.isInteger(x)||!Number.isInteger(y)||typeof vertical!=='boolean')return false;
  const footprint=shape({...ship,vertical});
  if(x<0||y<0||x+footprint.width>SIZE||y+footprint.height>SIZE)return false;
  const next=cells({...ship,x,y,vertical});
  return !next.some(c=>terrain?.[c]==='rock')&&!ships.some(s=>s.id!==id&&cells(s).some(c=>next.includes(c)));
}
export function canMove(player,id,dx,dy) {
  const ship=player.ships.find(s=>s.id===id);
  return !!ship&&ship.x!==null&&!ship.grounded&&!ship.hits.length&&Number.isInteger(dx)&&Number.isInteger(dy)
    &&Math.abs(dx)+Math.abs(dy)===1&&canPlace(player.ships,id,ship.x+dx,ship.y+dy,ship.vertical,player.terrain);
}
export const squaredDistance = (a,b) => (a%10-b%10)**2+(Math.floor(a/10)-Math.floor(b/10))**2;
export const radiusCells = (center,radius) => Array.from({length:100},(_,c)=>c).filter(c=>squaredDistance(center,c)<=radius*radius);
export const hullRadius = (ship,radius) => [...new Set(cells(ship).flatMap(c=>radiusCells(c,radius)))];

/** Shortest orthogonal paths; entering a new shoal ends a route. No hidden reef knowledge is used. */
export function reachableMoves(player,id,limit=100) {
  const ship=player.ships.find(s=>s.id===id),paths=new Map();
  if(!ship||ship.x===null||ship.grounded||ship.hits.length)return paths;
  const origin=ship.y*10+ship.x;
  paths.set(origin,[]);
  const queue=[{cell:origin,path:[],stopped:false}];
  for(let n=0;n<queue.length;n++) {
    const node=queue[n];if(node.stopped||node.path.length>=limit)continue;
    const before=cells({...ship,x:node.cell%10,y:Math.floor(node.cell/10)});
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const x=node.cell%10+dx,y=Math.floor(node.cell/10)+dy,c=y*10+x;
      if(paths.has(c)||!canPlace(player.ships,id,x,y,ship.vertical,player.terrain))continue;
      const path=[...node.path,c],entered=cells({...ship,x,y}).filter(c=>!before.includes(c));
      paths.set(c,path);queue.push({cell:c,path,stopped:entered.some(c=>player.terrain?.[c]==='shoal')});
    }
  }
  return paths;
}

/** Integer-grid straight line, inclusive of both endpoints. */
export function lineCells(from,to) {
  if(!validCell(from)||!validCell(to))return [];
  let x=from%10,y=Math.floor(from/10);const endX=to%10,endY=Math.floor(to/10);
  const dx=Math.abs(endX-x),dy=-Math.abs(endY-y),sx=x<endX?1:-1,sy=y<endY?1:-1;
  let error=dx+dy;const result=[];
  while(true){result.push(y*10+x);if(x===endX&&y===endY)break;const twice=2*error;if(twice>=dy){error+=dy;x+=sx;}if(twice<=dx){error+=dx;y+=sy;}}
  return result;
}
