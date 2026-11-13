/** The twenty-card starter deck: one copy of each card. */
export const DECK_SIZE = 20;
export const INITIAL_HAND = 4;
export const DRAW_PER_TURN = 2;
export const ACTIONS_PER_TURN = 3;
export const CARD_TYPES = {
  secondary: { name:'副炮齐射', cost:1, effect:'secondary', target:'enemy-cell', requires:'surface', radius:0, icon:'target', tag:'SECONDARY', description:'由最近的非航母舰艇炮击一格。副炮无法损伤战列舰。' },
  main: { name:'主炮轰击', cost:2, effect:'main', target:'enemy-cell', requires:'heavy', radius:1, icon:'target', tag:'MAIN BATTERY', description:'最近的巡洋舰或战列舰开火，对落点距离 1 以内造成伤害。' },
  big: { name:'来个大家伙！', cost:3, effect:'main', target:'enemy-cell', requires:'battleship', radius:2, icon:'target', tag:'HEAVY SALVO', description:'最近的战列舰开火，对落点距离 2 以内的所有舰型造成伤害。' },
  barrage: { name:'弹幕覆盖！', cost:3, effect:'secondary', target:'enemy-many', requires:'surface', count:10, icon:'target', tag:'BARRAGE', description:'选择敌方 10 个不同单元格，分别由最近的非航母舰艇进行副炮炮击。' },
  torpedo: { name:'当心鱼雷', cost:2, effect:'torpedo', target:'enemy-row', requires:'escort', icon:'target', tag:'TORPEDO', description:'选择己方驱逐舰/护卫舰所在行，由最前方舰艇发射一枚鱼雷，遇目标或阻挡停止。' },
  triple: { name:'当心三连发！', cost:3, effect:'torpedo', target:'enemy-row', requires:'escort', spread:1, icon:'target', tag:'TRIPLE TORPEDO', description:'由选中行最靠前的驱逐舰/护卫舰向上、本、下三行各发射一枚鱼雷。越界行略过。' },
  tactics: { name:'灵活的战术', cost:0, effect:'draw', target:'none', icon:'book', tag:'TACTICS', description:'从牌库顶部抽取 2 张战术卡。本卡结算后才回到牌库底部。' },
  supply: { name:'后勤补给', cost:0, effect:'supply', target:'none', icon:'plus', tag:'SUPPLY', description:'本回合补充 2 点行动力，可以超过默认的 3 点。' },
  recon: { name:'侦察', cost:1, effect:'recon', target:'own-cell', radius:3, icon:'radar', tag:'SURVEY', description:'探查己方落点距离 3 以内的地形，永久识别范围内的暗礁。' },
  flare: { name:'信号弹', cost:2, effect:'vision', target:'enemy-cell', requires:'surface', radius:2, duration:3, icon:'eye', tag:'FLARE', description:'获得敌方落点距离 2 以内的实时视野，持续 3 个自己的回合。' },
  lamp: { name:'大灯泡！', cost:3, effect:'vision', target:'enemy-cell', requires:'surface', radius:3, duration:4, icon:'eye', tag:'ILLUMINATION', description:'获得敌方落点距离 3 以内的实时视野，持续 4 个自己的回合。' },
  maneuver: { name:'战术机动', cost:1, effect:'move', target:'own-move', range:2, icon:'ship', tag:'MANEUVER', description:'选择己舰与目的地，沿合法航道移动不超过 2 格。受损或搁浅舰艇不能移动。' },
  rapid: { name:'快速机动', cost:2, effect:'move', target:'own-move', range:4, icon:'ship', tag:'RAPID MANEUVER', description:'选择己舰与目的地，沿合法航道移动不超过 4 格。逐步触发地形效果。' },
  speed: { name:'40节航速！', cost:3, effect:'move', target:'own-move', range:100, icon:'ship', tag:'FLANK SPEED', description:'选择己舰与目的地，沿合法航道移动任意距离，不能穿越障碍。' },
  seaplane: { name:'水上侦察机', cost:3, effect:'vision', target:'none', requires:'airbase', aircraft:true, duration:1, icon:'eye', tag:'SEAPLANE', description:'巡洋舰、战列舰或航母起飞侦察机，获得敌方全图视野 1 个自己的回合。敌方制空时禁用。' },
  fighter: { name:'舰载战斗机', cost:2, effect:'air', target:'none', requires:'carrier', aircraft:true, contestAir:true, duration:3, icon:'shield', tag:'FIGHTERS', description:'可在敌方制空时起飞并夺取制空权，重新持续 3 个自己的回合；期间阻止对方非战斗机飞机起飞。' },
  bomber: { name:'舰载轰炸机', cost:2, effect:'bomb', target:'enemy-cell', requires:'carrier', aircraft:true, radius:1, icon:'target', tag:'BOMBERS', description:'航母轰炸落点距离 1 以内的单元格，对所有舰型有效。敌方制空时禁用。' },
  torpedoPlane: { name:'舰载鱼雷机', cost:2, effect:'torpedo', target:'enemy-line', requires:'carrier', aircraft:true, icon:'target', tag:'TORPEDO BOMBER', description:'选择敌方起点和终点，沿两点直线投放一枚鱼雷，遵循鱼雷阻挡规则。' },
  repair: { name:'损害管制', cost:2, effect:'repair', target:'own-hit', requires:'damaged', icon:'refresh', tag:'DAMAGE CONTROL', description:'修复一艘尚未沉没的己舰一个中弹部位，恢复为未被攻击状态。' },
  smoke: { name:'烟雾发生器', cost:3, effect:'smoke', target:'own-move', requires:'escort', range:2, icon:'shield', tag:'SMOKE SCREEN', description:'选择己方驱逐舰/护卫舰，遮断周围距离 2 的敌方视野，并可移动至 2 格内。烟幕持续至下个自己的回合。' },
};
export const shipAlive = ship => ship.x !== null && ship.hits.length < ship.length * (ship.width || 1);
export function sourceMatches(ship, requirement) {
  return !requirement || ({surface:ship.type!=='carrier',heavy:['cruiser','battleship'].includes(ship.type),battleship:ship.type==='battleship',escort:['destroyer','frigate'].includes(ship.type),airbase:['cruiser','battleship','carrier'].includes(ship.type),carrier:ship.type==='carrier'})[requirement];
}
export function unavailableReason(player, card, context={}) {
  const d=CARD_TYPES[card?.type];
  if(!d)return '无效卡牌';
  if(player.actionPoints<d.cost)return '行动力不足';
  if(d.aircraft&&!d.contestAir&&context.enemyAirControl)return '敌方占据制空权，无法起飞';
  const alive=player.ships.filter(shipAlive);
  if(d.requires==='damaged'&&!alive.some(s=>s.hits.length))return '没有可修复的受损舰艇';
  if(d.requires&&d.requires!=='damaged'&&!alive.some(s=>sourceMatches(s,d.requires)))return '没有符合条件的存活舰艇';
  return '';
}
export const canUseCard=(player,card,context)=>!unavailableReason(player,card,context);
export const cardContext=view=>({enemyAirControl:!!view.airControl&&view.airControl.owner!==view.me});
export const makeDeck=()=>Object.keys(CARD_TYPES).map(type=>({id:`${type}-1`,type}));
export function drawCards(player,count=DRAW_PER_TURN) {player.hand.push(...player.deck.splice(0,count));}
export function dealCards(player,rng=Math.random) {
  player.deck=makeDeck();player.hand=[];
  for(let i=player.deck.length-1;i>0;i--){const j=Math.min(i,Math.max(0,Math.floor(rng()*(i+1))));[player.deck[i],player.deck[j]]=[player.deck[j],player.deck[i]];}
  drawCards(player,INITIAL_HAND);
}
