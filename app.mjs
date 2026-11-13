import { TYPES, TOTAL_SHIPS, TOTAL_CELLS, shape, PREP_MS, TURN_MS, makePlayer, makeGame, cells, isSunk, canPlace, canMove, act, tick, viewFor } from './engine.mjs?v=5.0.0';
import { vesselArt, shipOverlay, impactArt, boardFurniture } from './art.mjs?v=5.0.0';

import { MAPS, TERRAIN, mapInfo, terrainAt } from './terrain.mjs?v=5.0.0';
import { terrainChart, mapPicker, mapBrief, terrainLegend, terrainGuide, mobilityControls } from './tactics-ui.mjs?v=5.0.0';
import { CARD_TYPES, canUseCard, cardContext, sourceMatches, shipAlive } from './cards.mjs?v=5.0.0';
import { handPanel, cardGuide } from './cards-ui.mjs?v=5.0.0';
import { radiusCells, reachableMoves, lineCells } from './geometry.mjs?v=5.0.0';
import { torpedoRows } from './combat.mjs?v=5.0.0';
import { chooseBotAction } from './bot.mjs?v=5.0.0';

const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const toastEl = document.querySelector('#toast');
const REPO = 'https://github.com/Saoker-Liu/IMDT-Game-Design';
const paths = {
  anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 10h8M3 14c0 4 4 7 9 7s9-3 9-7M1 16l2-3 3 2m12 0 3-2 2 3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
  cross: '<path d="m6 6 12 12M6 18 18 6"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 6-6M12 3v2M3 12h2m7 7v2m7-9h2"/><circle cx="9" cy="15" r="1"/>',
  wifi: '<path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0m-9 4a5 5 0 0 1 6 0"/><circle cx="12" cy="20" r=".7"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  ship: '<path d="m3 15 9-3 9 3-3 6H6l-3-6Zm4-2V7h10v6M10 7V3h4v4M2 22q3-2 5 0t5 0 5 0 5 0"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v5m0 12v5M1 12h5m12 0h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  book: '<path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15"/>',
  rotate: '<path d="M20 8a8 8 0 1 1-6-4M14 1v6h6"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  shuffle: '<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6s4-6 6-6h3m-4-4 4 4-4 4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  trophy: '<path d="M7 3h10v7a5 5 0 0 1-10 0V3Zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 3v5m-5 1h10"/>',
  flag: '<path d="M5 22V3q4-3 8 0t7 0v11q-4 3-7 0t-8 0"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
  sound: '<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 6 6m-6 0 6-6"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v7"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.anchor}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const coord = c => `${String.fromCharCode(65 + c % 10)}${Math.floor(c / 10) + 1}`;
const typeName = type => TYPES.find(t => t.type === type)?.name || '舰船';
const $ = s => document.querySelector(s);
const readStorage = (key, fallback = null, local = false) => { try { return (local ? localStorage : sessionStorage).getItem(key) ?? fallback; } catch { return fallback; } };
const store = (key, value, local = false) => { try { const storage = local ? localStorage : sessionStorage; value === null ? storage.removeItem(key) : storage.setItem(key, value); } catch {} };

let lan = false, mode = 'lobby', state = null, session = null, practice = null;
let rooms = [], selectedShip = null, selectedVertical = false, aimed = null;
let busy = false, polling = false, serverOffset = 0, connectionLost = false;
let toastTimer, botDue = 0, lastBotTurn = '', lastHistory = 0, showAftermath = false;
let sound = readStorage('deepblue-sound', 'off', true) === 'on';
let audioCtx = null;
let selectedMap = mapInfo(readStorage('fogbound-map', 'open-sea', true)).id;
let selectedCard = null, pickedTargets = [], lineEnd = null;
const selectedDefinition = () => CARD_TYPES[state?.own.hand.find(c => c.id === selectedCard)?.type];

function resetTargets() { aimed=null;pickedTargets=[];lineEnd=null; }
function selection() {
  const d=selectedDefinition(),previewOwn=new Set(),previewEnemy=new Set(),destinations=new Set(),rows=new Set();
  let ready=false;const payload={type:'play-card',cardId:selectedCard};
  if(!d)return {d,ready,payload,previewOwn,previewEnemy,destinations,rows};
  if(d.target==='none')ready=true;
  else if(d.target==='enemy-many') {for(const c of pickedTargets)previewEnemy.add(c);payload.cells=[...pickedTargets];ready=pickedTargets.length===10;}
  else if(d.target==='enemy-row') {
    torpedoRows(state.own).forEach(row=>rows.add(row));
    if(aimed!==null){const row=Math.floor(aimed/10);payload.row=row;ready=rows.has(row);for(let r=row-(d.spread||0);r<=row+(d.spread||0);r++)if(r>=0&&r<10)for(let x=0;x<10;x++)previewEnemy.add(r*10+x);}
  } else if(d.target==='enemy-line') {
    payload.cell=aimed;payload.end=lineEnd;ready=aimed!==null&&lineEnd!==null&&aimed!==lineEnd;
    if(aimed!==null)for(const c of lineCells(aimed,lineEnd??aimed))previewEnemy.add(c);
  } else if(d.target==='own-move') {
    const ship=state.own.ships.find(ship=>ship.id===selectedShip);
    if(ship) {
      for(const c of reachableMoves(state.own,ship.id,d.range).keys())destinations.add(c);
      if(d.effect==='smoke'&&shipAlive(ship)&&sourceMatches(ship,'escort'))destinations.add(ship.y*10+ship.x);
      if(aimed!==null){payload.id=ship.id;payload.cell=aimed;ready=destinations.has(aimed)&&(d.effect==='smoke'||aimed!==ship.y*10+ship.x);for(const c of cells({...ship,x:aimed%10,y:Math.floor(aimed/10)}))previewOwn.add(c);}
    }
  } else if(aimed!==null) {
    payload.cell=aimed;ready=true;
    for(const c of radiusCells(aimed,d.radius||0))(d.target.startsWith('own')?previewOwn:previewEnemy).add(c);
  }
  return {d,ready,payload,previewOwn,previewEnemy,destinations,rows};
}
const targetHint=d=>!d?'先从手牌选择指令':({none:'无需选择目标，确认后立即执行','enemy-cell':'选择敌方落点，发光范围为作用区域','enemy-many':`选择 10 个不同敌方格子（已选 ${pickedTargets.length}/10）`,'enemy-row':'选择有己方驱逐舰/护卫舰的对应行','enemy-line':aimed===null?'选择鱼雷起点':lineEnd===null?'再选择鱼雷终点':'起终点已选，确认发射','own-cell':'选择己方侦察中心','own-hit':'选择己方存活舰艇的中弹部位','own-move':selectedShip?'选择目的地：目标格为舰体左上角':'先点选己舰，再点选目的地'})[d.target];
function battleEffects() {
  return `<div class="battle-effects" aria-label="持续战术效果"><span>${state.airControl?`${state.airControl.owner===state.me?'己方':'敌方'}制空权 · 剩 ${state.airControl.remaining} 个己方回合`:'制空权：无人控制'}</span>${state.visionEffects.map(e=>`<span>${CARD_TYPES[e.cardType].name} · 剩 ${e.remaining} 回合</span>`).join('')}${state.own.smoke.length?'<span>己方烟幕生效中</span>':''}</div>`;
}

function toast(message, error = false) {
  clearTimeout(toastTimer); toastEl.textContent = message;
  toastEl.className = `visible${error ? ' error' : ''}`;
  toastTimer = setTimeout(() => { toastEl.className = ''; }, 3500);
}
function beep(kind = 'click') {
  if (!sound) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator(), gain = audioCtx.createGain();
    oscillator.connect(gain); gain.connect(audioCtx.destination);
    oscillator.type = kind === 'hit' || kind === 'sunk' ? 'triangle' : 'sine';
    const frequency = { hit: 160, sunk: 90, miss: 330, click: 550, start: 740 }[kind] || 550;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency / 2, audioCtx.currentTime + .18);
    gain.gain.setValueAtTime(.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + .24);
    oscillator.start(); oscillator.stop(audioCtx.currentTime + .25);
  } catch {}
}
function header(inGame = false) {
  return `<header class="${inGame ? 'game-wrap' : 'wrap'}"><div class="topbar">
    <a class="brand" href="#" data-action="home" aria-label="雾海对弈 首页"><span class="brand-mark">${icon('anchor')}</span><span><span class="brand-name">雾海对弈</span><span class="brand-sub" style="display:block">FOGBOUND</span></span></a>
    <nav class="nav" aria-label="主导航"><button data-action="home" class="${inGame ? '' : 'active'} desktop-nav">作战大厅</button><button data-action="rules">游戏规则</button></nav>
    <div class="header-status"><span class="status-pill"><i class="dot"></i>${mode === 'practice' ? 'TRAINING MODE' : lan ? 'LAN CONNECTED' : 'DEMO ONLINE'}</span><button class="icon-button" data-action="sound" title="${sound ? '关闭' : '开启'}音效" aria-label="${sound ? '关闭' : '开启'}音效">${icon(sound ? 'sound' : 'mute')}</button></div>
  </div></header>`;
}
function footer() {
  return `<footer class="footer"><span class="english">FOGBOUND / NAVAL TACTICS</span><span class="footer-links"><button data-action="rules">作战手册</button><a href="${REPO}" target="_blank" rel="noopener">GitHub ↗</a><span class="desktop-nav">IMDT · DEMO 5.0</span></span></footer>`;
}
function heroVisual() {
  return `<div class="hero-visual" aria-hidden="true"><span class="visual-coordinate">N 31° 14′ 12″<br>E 121° 28′ 08″</span><div class="radar-map"><div class="radar-circle"><div class="radar-sweep"></div></div><div class="map-ship s1">${vessel({type:'battleship'})}</div><div class="map-ship s2">${vessel({type:'cruiser'})}</div><div class="map-ship s3">${vessel({type:'destroyer'})}</div><div class="map-hit">+</div><div class="map-dot"></div></div><div class="visual-tag t1"><div class="tag-caption">FLEET STATUS</div><div class="tag-value"><i class="dot"></i>舰队集结完毕</div></div><div class="visual-tag t2"><div class="tag-caption">TARGET ACQUIRED</div><div class="tag-value">${icon('target')}发现目标 · D4</div></div><span class="visual-watermark">TACTICAL OCEAN SECTOR / 001</span></div>`;
}
function renderLobby() {
  app.classList.remove('war-room');
  app.innerHTML = `${header()}<main class="wrap">
    <section class="hero"><div><div class="eyebrow">NAVAL TACTICS / 双人策略海战</div><h1>海雾之下，<br>每一步都是<span>博弈。</span></h1><p class="hero-description">部署你的舰队，在未知海域中寻找对手。<br>一枚炮弹，一次抉择。让最后一艘战舰为你而战。</p><div class="hero-actions"><button class="btn primary" data-action="create">${icon('plus')}创建作战房间${icon('arrow')}</button><button class="btn subtle" data-action="practice">${icon('target')}人机演习</button></div><p class="micro">${icon('shield')}无需注册 · ${lan ? '同一局域网，即刻开战' : '浏览器即开即玩，支持局域网部署'}</p></div>${heroVisual()}</section>
    ${mapPicker(selectedMap)}
    <section class="metrics" aria-label="游戏概览"><div class="metric"><div class="metric-number">10<small>×</small>10</div><div class="metric-label"><b>战术海域</b>双面独立棋盘</div></div><div class="metric"><div class="metric-number">11<small>艘</small></div><div class="metric-label"><b>专属舰队</b>五种舰型，包含航母</div></div><div class="metric"><div class="metric-number">90<small>s</small></div><div class="metric-label"><b>部署时间</b>掌握开战前的主动权</div></div><div class="metric"><div class="metric-number">10<small>s</small></div><div class="metric-label"><b>回合决策</b>3 点行动力，自由出牌</div></div></section>
    <section aria-label="局域网房间"><div class="section-heading"><h2 class="section-title">${icon('radar')}作战大厅 <span class="count-badge">${rooms.length}</span></h2><button class="text-button" data-action="refresh">${icon('refresh')}刷新房间</button></div><div class="lobby-panel"><div class="lobby-panel-head"><span class="head-label"><i class="dot ${lan ? '' : 'amber'}"></i>${lan ? '局域网公开房间' : '局域网对战'}</span><span>${lan ? '自动发现 · 实时同步' : '在本地启动服务即可开启'}</span></div><div id="room-list">${roomList()}</div></div><div class="lobby-bottom"><span>${icon('info')}${lan ? '连接同一个房间服务器，所有公开房间都将显示在这里。' : '当前为在线试玩版。人机演习可直接体验；局域网对战需运行本地服务。'}</span><button class="text-button" data-action="join-code">通过房间号加入${icon('chevron')}</button></div></section>
    ${footer()}</main>`;
}
function roomList() {
  if (!rooms.length) return `<div class="room-empty"><div class="empty-icon">${icon(lan ? 'radar' : 'wifi')}</div><p>${lan ? '海面风平浪静，等待第一位指挥官' : '召集伙伴，开启一场海上对决'}</p><small>${lan ? '创建一个房间，邀请同一网络的伙伴加入' : '先试试人机演习，或查看局域网启动方式'}</small><button class="text-button" style="color:var(--accent);margin-top:6px" data-action="${lan ? 'create' : 'lan-help'}">${lan ? '+ 创建首个房间' : '查看启动方式'}${icon('arrow')}</button></div>`;
  return rooms.map(r => `<div class="room-row"><div><div class="room-name">${esc(r.name)}</div><div class="room-id">ROOM / ${esc(r.id)}</div></div><div class="room-host">${esc(r.host)} · ${mapInfo(r.mapId).name}</div><span class="room-slots">${r.count} / 2 ${r.phase === 'lobby' ? '' : '· 交战中'}</span><button class="btn small ${r.count < 2 && r.phase === 'lobby' ? 'primary' : 'subtle'}" data-action="join" data-room="${esc(r.id)}" ${r.count >= 2 || r.phase !== 'lobby' ? 'disabled' : ''}>${r.count >= 2 ? '已满员' : r.phase !== 'lobby' ? '交战中' : '加入房间'}${r.count < 2 && r.phase === 'lobby' ? icon('arrow') : ''}</button></div>`).join('');
}
function steps() {
  const i = ['lobby','placement','battle','result'].indexOf(state.phase);
  return `<div class="stepper" aria-label="游戏阶段">${['集结','布阵','交战','结算'].map((s,n) => `${n ? '<span class="step-line"></span>' : ''}<span class="step ${i === n ? 'current' : n < i ? 'done' : ''}"><span class="step-index">${n < i ? '✓' : `0${n+1}`}</span>${s}</span>`).join('')}</div>`;
}
function gameHeading() {
  return `<div class="game-header"><div class="game-title"><button class="back-btn" data-action="exit" title="退出房间" aria-label="退出房间">${icon('back')}</button><div><h1>${esc(state.roomName || '人机演习海域')}</h1><div class="game-id">${mode === 'practice' ? 'TRAINING / AI OPPONENT' : `ROOM / ${esc(state.roomId)}`} · ${mapInfo(state.mapId).name}</div></div></div>${steps()}</div>`;
}
function playerCard(p, index) {
  return `<div class="player-card ${p ? '' : 'empty'}"><div class="player-avatar">${icon(p ? 'anchor' : 'radar')}</div><h3>${p ? `${esc(p.name)}${index === state.me ? '（你）' : ''}` : '等待指挥官'}</h3><span class="badge ${p?.ready ? '' : 'neutral'}">${p ? (p.ready ? '✓ 已准备' : '尚未准备') : '空余席位'}</span></div>`;
}
function renderWaiting() {
  const me = state.players[state.me];
  return `<div class="waiting-room"><div class="waiting-heading"><div class="eyebrow">AWAITING COMMANDERS</div><h2>舰队集结中</h2><p>双方点击准备后，进入 90 秒布阵阶段。</p>${mapBrief(state.mapId,state.me)}</div><div class="players-row">${playerCard(state.players[0],0)}<div class="versus">VS</div>${playerCard(state.players[1],1)}</div><div class="waiting-actions"><div class="share-room"><span>房间编号</span><b>${esc(state.roomId)}</b><button class="text-button" data-action="copy-room" aria-label="复制房间邀请链接">${icon('copy')}</button></div><button class="btn ${me.ready ? 'subtle' : 'primary'} full" data-action="ready">${icon('check')}${me.ready ? '取消准备' : '准备出航'}</button><p class="sidebar-note">将本页地址发给同一局域网的伙伴。<br>对方进入大厅即可看到你的房间。</p></div></div>`;
}
function phaseToolbar() {
  const prep = state.phase === 'placement', mine = state.turn === state.me;
  const title = prep ? (state.own.confirmed ? '舰队已就绪，等待对手' : '部署舰队，掌控你的海域') : state.phase === 'result' ? '本场作战已结束' : mine ? '轮到你了，指挥官' : '对手正在瞄准';
  const message = prep ? (state.own.confirmed ? '布阵已锁定；对手确认后立即开战。' : '拖拽舰船至左侧海域，点击选中后可旋转。') : state.phase === 'result' ? '命中与沉没记录已保留，可查看本局战况。' : mine ? `剩余 ${state.own.actionPoints} 点行动力，选择手牌后执行指令，可连续出牌。` : '观察战况与手牌，等待下一次行动机会。';
  return `<div class="game-toolbar"><div class="phase-message"><span class="phase-icon">${icon(prep ? 'ship' : state.phase === 'result' ? 'flag' : mine ? 'target' : 'radar')}</span><div><h2>${title}</h2><p>${message}</p></div></div><div class="timer"><span class="timer-label">${prep ? '布阵剩余时间' : '回合剩余时间'}<br>${prep ? 'DEPLOYMENT' : `TURN ${String(state.round).padStart(2,'0')}`}</span><span class="timer-ring" id="timer-ring"></span><span class="timer-number" id="timer-number">--<small>s</small></span></div></div>`;
}
function vessel(ship, extra = '') {
  return vesselArt(ship, extra);
}
function board(own = false) {
  const prep=state.phase==='placement',active=state.phase==='battle'&&state.turn===state.me,editable=prep&&!state.own.confirmed;
  const selected=selection(),order=selected.d,ownShips=state.own.ships,terrain=own?state.own.terrain:state.enemyTerrain;
  const sunk=ownShips.filter(ship=>isSunk(state.own,ship)).length,deployed=ownShips.filter(ship=>ship.x!==null).length;
  const statusAt=c=>{
    if(!own)return state.enemyCells[c];
    const ship=ownShips.find(ship=>cells(ship).includes(c));
    return ship?(ship.hits.includes(c)?isSunk(state.own,ship)?'sunk':'hit':''):state.own.shots.includes(c)?'miss':'';
  };
  const visibleShips=own?ownShips.filter(s=>s.x!==null):state.enemyWrecks;
  const grid=Array.from({length:100},(_,c)=>{
    const ship=own?ownShips.find(ship=>cells(ship).includes(c)):null,type=terrainAt(terrain,c),status=own?'water':state.enemyCells[c];
    const targetOwn=order?.target.startsWith('own'),targetEnemy=order?.target.startsWith('enemy');
    const eligible=ship&&shipAlive(ship)&&(order?.effect!=='smoke'||sourceMatches(ship,'escort'));
    const canClick=own?editable||(active&&(targetOwn?(order.target==='own-hit'?!!ship&&shipAlive(ship)&&ship.hits.includes(c):order.target==='own-move'?eligible||selected.destinations.has(c):true):!!ship))
      :active&&targetEnemy&&(order.target!=='enemy-row'||selected.rows.has(Math.floor(c/10)));
    const sight=!own&&state.enemySight[c];
    const label=own?(ship?`${typeName(ship.type)}${ship.grounded?'，已搁浅':ship.hits.length?'，受损':''}`:'空海域'):(sight?sight.empty?'照明：空海域':`照明：${typeName(sight.type)}`:({unknown:'舰位未知',miss:'历史落空',hit:'已命中',sunk:'沉没残骸',immune:'装甲抵御副炮',blocked:'鱼雷或炮击受阻'}[status]||status));
    const preview=(own?selected.previewOwn:selected.previewEnemy).has(c),destination=own&&order?.target==='own-move'&&selected.destinations.has(c);
    const smoke=own?state.own.smoke.some(effect=>effect.cells.includes(c)):state.enemySmoke.includes(c);
    const track=!own&&state.own.lastAction?.traces.some(trace=>trace.includes(c));
    return `<button class="cell ${status} terrain-${type}${preview?' target-preview':''}${destination?' reachable':''}${smoke?' smoke-cell':''}${track?' torpedo-track':''}${(!own&&pickedTargets.includes(c))||aimed===c&&(targetOwn===own)?' aim':''}" data-cell="${c}" data-board="${own?'own':'enemy'}" ${ship?`data-ship="${ship.id}"`:''} ${sight&&!sight.empty?`data-contact="${TYPES.find(t=>t.type===sight.type)?.code||'◇'}"`:''} style="--col:${c%10};--row:${Math.floor(c/10)}" title="${TERRAIN[type].name} · ${TERRAIN[type].effect} · ${label}" draggable="false" aria-label="${coord(c)} ${TERRAIN[type].name} ${label}" ${canClick?'':'disabled'}></button>`;
  }).join('');
  const effects=Array.from({length:100},(_,c)=>`<span class="effect ${statusAt(c)}" style="--fx-delay:${(c*17%13)/10}s">${impactArt(statusAt(c))}</span>`).join('');
  const ships=visibleShips.map(ship=>shipOverlay(ship,{selected:own&&selectedShip===ship.id&&(editable||active),wreck:!own||isSunk(state.own,ship),firing:own&&state.own.lastAction?.sources.includes(ship.id)})).join('');
  return `<section class="board-panel ${own?'friendly-chart':'hostile-chart'}" aria-label="${own?'己方海域':'敌方海域'}"><div class="board-caption"><h3 class="${own?'':'enemy-title'}">${icon(own?'shield':'target')}${own?'己方海域':'敌方海域'}<span class="board-subtitle">${own?'FRIENDLY WATERS':'HOSTILE WATERS'}</span></h3><span class="badge ${own||active?'':'neutral'}">${own?esc(state.own.name):prep?'舰位隐蔽':active?'按卡牌选择目标':'等待指令'}</span></div><div class="board-frame ${!own&&active?'target-active':''}"><i class="frame-rivet tl"></i><i class="frame-rivet tr"></i><i class="frame-rivet bl"></i><i class="frame-rivet br"></i><div class="board-matrix"><div class="axis-x">${'ABCDEFGHIJ'.split('').map(x=>`<span>${x}</span>`).join('')}</div><div class="axis-y">${Array.from({length:10},(_,n)=>`<span>${n+1}</span>`).join('')}</div>${boardFurniture(own)}${terrainChart(terrain,false,{mapId:state.mapId,side:own?state.me:1-state.me})}<div class="board-grid" id="${own?'own':'enemy'}-grid" role="group" aria-label="${own?'己方':'敌方'} 10 乘 10 海域">${grid}</div><div class="ship-layer">${ships}</div><div class="own-effects board-effects">${effects}</div></div><div class="chart-frame-foot" aria-hidden="true"><span>${mapInfo(state.mapId).tag}</span><span>10 × 10 / SECTOR ${own?'01':'02'}</span></div></div><div class="board-bottom"><span>${own?prep?'部署进度':'存活舰艇':'已知海域'} <b>${own?prep?`${deployed}/${TOTAL_SHIPS}`:`${TOTAL_SHIPS-sunk}/${TOTAL_SHIPS}`:`${state.enemyCells.filter(c=>c!=='unknown').length}/100`}</b></span><span>${own?prep?'航母占据 3×2 格，可旋转':'机动须选舰艇与目的地':'照明到期回到迷雾，暗礁画面始终同深海'}</span></div>${own&&state.phase==='battle'?mobilityControls(state.own,selectedShip,active,['move','smoke'].includes(order?.effect)):''}</section>`;
}
function dock() {
  const editable = !state.own.confirmed;
  const selected = state.own.ships.find(s => s.id === selectedShip);
  return `<section class="dock" aria-label="待部署舰队"><div class="dock-heading"><strong>舰队船坞 <span style="font:9px var(--mono);color:#526d84;margin-left:5px">FLEET DOCK</span></strong><div class="dock-tools"><button class="text-button" data-action="auto" ${editable?'':'disabled'}>${icon('shuffle')}${state.own.ships.some(s=>s.x===null)?'随机补齐':'重新随机'}</button><button class="text-button" data-action="clear" ${editable?'':'disabled'}>${icon('trash')}清空</button></div></div><div class="dock-ships">${TYPES.map(t=>`<div class="ship-group"><div class="ship-group-label">${t.name}<b>${t.width?`${t.length}×${t.width}`:t.length} 格 × ${t.count}</b></div><div class="ship-pieces">${state.own.ships.filter(s=>s.type===t.type).map(s=>`<button class="dock-piece${s.x!==null?' placed':''}${selectedShip===s.id?' selected':''}" style="--length:${s.length}" data-action="select-ship" data-ship="${s.id}" draggable="false" aria-label="${t.name} ${s.id}${s.x!==null?' 已部署':''}" ${editable?'':'disabled'}>${vessel({...s,vertical:false})}</button>`).join('')}</div></div>`).join('')}</div><p class="dock-hint">${icon('mouse')}拖拽舰船到海域，或先选舰船、再点击坐标。已部署舰船可拖动调整位置。</p></section><div class="selection-toolbar">${selected && editable ? `<span>${typeName(selected.type)} ${selected.id} · ${selectedVertical?'纵向':'横向'}</span><button class="text-button" data-action="rotate">${icon('rotate')}旋转 90°<span class="keycap">R</span></button>${selected.x!==null?`<button class="text-button" data-action="remove">${icon('trash')}收回</button>`:''}` : `<span>${state.own.confirmed?'布阵已锁定，等待对方完成。':'选择一艘舰船，开始你的战术部署。'}</span>`}</div>`;
}
function fleetCard(enemy = false) {
  return `<section class="sidebar-card fleet-card"><h3 class="sidebar-heading">${enemy ? '敌方舰队' : '己方舰队'}<small>${enemy ? 'ENEMY' : 'FRIENDLY'}</small></h3>${TYPES.map(t=>{
    const ships = state.own.ships.filter(s=>s.type===t.type);
    const destroyed = enemy ? state.enemySunk.filter(s=>s===t.type).length : ships.filter(s=>isSunk(state.own,s)).length;
    return `<div class="fleet-status-row"><span class="fleet-status-name"><span class="fleet-glyph">${vessel({type:t.type,vertical:false})}</span>${t.name}</span><span class="fleet-markers" aria-label="${t.name} ${destroyed} 艘沉没">${Array.from({length:t.count},(_,n)=>`<i class="fleet-marker ${n<destroyed?'lost':!enemy&&ships[n].x===null?'pending':''}"></i>`).join('')}</span></div>`;
  }).join('')}</section>`;
}
function commandCard() {
  const prep=state.phase==='placement',mine=state.turn===state.me,deployed=state.own.ships.filter(s=>s.x!==null).length;
  if(prep)return `<section class="sidebar-card command-card"><h3 class="sidebar-heading">部署指令<small>COMMAND</small></h3><div class="deploy-count"><b>${String(deployed).padStart(2,'0')}</b><span>/ ${TOTAL_SHIPS}</span></div><div class="progress"><span style="width:${deployed/TOTAL_SHIPS*100}%"></span></div><p class="deploy-label">舰艇已部署 · 共 ${TOTAL_CELLS} 个占据单元</p><button class="btn primary full" data-action="confirm" ${deployed!==TOTAL_SHIPS||state.own.confirmed?'disabled':''}>${icon('check')}${state.own.confirmed?'已准备完毕':'确认布阵，准备出航'}</button><p class="sidebar-note">90 秒结束后自动补齐尚未部署的舰艇。</p></section>`;
  const {d,ready}=selection(),receipt=state.own.lastAction,sources=receipt?.sources.map(id=>state.own.ships.find(s=>s.id===id)).filter(Boolean)||[];
  return `<section class="sidebar-card command-card"><h3 class="sidebar-heading">作战指令<small>COMMAND</small></h3><div class="turn-status ${mine?'':'wait'}"><i class="dot ${mine?'':'amber'}"></i>${mine?`你的回合 · 剩余 ${state.own.actionPoints} 行动力`:`对手回合 · 剩余 ${state.players[state.turn].actionPoints} 行动力`}</div><div class="selected-order">${d?`${d.name} · ${d.cost} 点行动力`:'先从手牌选择一张指令'}<small>${targetHint(d)}</small></div><div class="attack-coordinate">${d?.target==='enemy-many'?`已选 ${pickedTargets.length}/10 格`:d?.target==='enemy-line'?'鱼雷起点 → 终点':d?.target==='none'?'无需指定目标':'目标坐标'}<b>${d?.target==='enemy-line'?`${aimed===null?'—':coord(aimed)} → ${lineEnd===null?'—':coord(lineEnd)}`:d?.target==='enemy-row'&&aimed!==null?`第 ${Math.floor(aimed/10)+1} 行`:aimed===null?'— —':coord(aimed)}</b></div>${d?.target==='enemy-many'?'<button class="text-button" data-action="random-targets">随机选取 10 格</button>':''}<button class="btn primary full" data-action="fire" ${!mine||!ready||busy?'disabled':''}>${icon(d?.icon||'target')}${d?`执行${d.name}`:'选择手牌后执行'}</button><button class="text-button" data-action="pass" ${mine?'':'disabled'}>结束回合${icon('arrow')}</button><p class="sidebar-note">可用零费牌时，0 行动力仍可继续出牌。<br>10 秒到时或主动结束后换手。${sources.length?`<br>上次火力源：${sources.map(ship=>`${typeName(ship.type)} ${ship.id}`).join('、')}`:''}</p></section>`;
}
function historyLine(event) {
  const mine = event.playerId === state.own.id;
  const player = mine ? '你' : '对手';
  const at = new Date(event.at).toLocaleTimeString('zh-CN',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
  let text = '';
  switch(event.type) {
    case 'strike': text=`${player}使用${CARD_TYPES[event.cardType]?.name||'攻击'} · ${event.results.length} 格 · 命中 ${event.results.filter(r=>['hit','sunk'].includes(r.result)).length}${event.results.some(r=>r.result==='immune')?' · 战列舰装甲抵御副炮':''}${event.results.some(r=>r.result==='blocked')?' · 遇阻':''}`;break;
    case 'card': text=`${player}使用${CARD_TYPES[event.cardType]?.name||'战术卡'}`;break;
    case 'placement': text = '双方已就绪，开始部署舰队'; break;
    case 'autoplaced': text = '布阵时间结束，已自动补齐舰队'; break;
    case 'start': text = '战斗开始，房主先手'; break;
    case 'move': text = `${player}的舰队完成一次机动`; break;
    case 'recon': text = `${player}使用侦察指令${mine?'，情报已标注在敌方海域':''}`; break;
    case 'grounded': text = `${mine?'己方':'敌方'}舰船驶入浅滩，永久搁浅`; break;
    case 'reef-sunk': text = `${mine?'己方':'敌方'}${typeName(event.shipType)}触礁沉没`; break;
    case 'hit': text = `<b>${player}</b> ${event.weapon==='torpedo'?'鱼雷攻击':'炮击'} ${coord(event.cell)} · <span class="hit-label">命中</span>`; break;
    case 'sunk': text = `<b>${player}</b> ${event.weapon==='torpedo'?'鱼雷攻击':'炮击'} ${coord(event.cell)} · <span class="sunk-label">击沉${typeName(event.shipType)}</span>`; break;
    case 'miss': text = `<b>${player}</b> ${event.weapon==='torpedo'?'鱼雷攻击':'炮击'} ${coord(event.cell)} · 未命中`; break;
    case 'timeout': text = `${player}回合超时，自动换手`; break;
    case 'pass': text = `${player}结束本回合`; break;
    case 'end': text = event.reason === 'left'?'对手离开，作战结束':'舰队已全部击沉，作战结束'; break;
    default: return '';
  }
  return `<div class="log-line"><span class="log-time">${at}</span>${text}</div>`;
}
function logCard() {
  return `<section class="sidebar-card log-card"><h3 class="sidebar-heading">作战记录<small>COMBAT LOG</small></h3><div class="combat-log">${state.history.length?[...state.history].reverse().slice(0,30).map(historyLine).join(''):'<div class="log-empty">等待第一声炮响</div>'}</div></section>`;
}
function resultCard() {
  const win = state.winner === state.me;
  const shots = state.own.stats?.attacks||0;
  const hits = state.own.stats?.hits||0;
  const elapsed = state.startedAt ? Math.max(0,Math.round((state.endedAt-state.startedAt)/1000)) : 0;
  const time = `${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,'0')}`;
  const left = state.history.at(-1)?.reason === 'left';
  return `<section class="result-card${win?'':' defeat'}"><div class="result-icon">${icon(win?'trophy':'flag')}</div><div class="eyebrow" style="justify-content:center;margin-bottom:9px">${win?'MISSION ACCOMPLISHED':'MISSION COMPLETE'}</div><h2>${win?'海域，已在掌控。':'胜负已定，再战雾海。'}</h2><p>${left ? '一位指挥官已离开，仍在场的舰队获胜。' : win ? '敌方舰队全数沉没。指挥官，干得漂亮。' : '你的舰队已全数沉没。下一次，用战术改写结局。'}</p><div class="result-stats"><div><b>${shots}</b><span>发射炮弹</span></div><div><b>${shots?Math.round(hits/shots*100):0}%</b><span>命中率</span></div><div><b>${time}</b><span>交战时长</span></div></div><div class="result-actions"><button class="btn subtle" data-action="exit">返回大厅</button><button class="btn primary" data-action="rematch" ${state.own.rematch||state.opponentConnected===false?'disabled':''}>${icon('refresh')}${state.own.rematch?'等待对手再战':'再来一局'}</button></div></section><div class="reveal-toggle"><button class="text-button" data-action="aftermath">${icon('eye')}${showAftermath?'收起':'查看'}本局战况${icon('chevron')}</button></div>`;
}
function renderGame() {
  if (!state) return;
  app.classList.add('war-room');
  const prep = state.phase==='placement';
  app.innerHTML = `${header(true)}<main class="game-wrap">${gameHeading()}${connectionLost?'<div class="connection-warning">连接暂时中断，正在重连。倒计时仍以服务器为准。</div>':''}${state.phase==='lobby'?renderWaiting():`${state.phase==='result'?resultCard():phaseToolbar()}${mapBrief(state.mapId,state.me)}${state.phase==='battle'?handPanel(state,selectedCard,icon)+battleEffects():''}${state.phase!=='result'||showAftermath?`<div class="game-layout"><div><div class="boards${prep?'':' battling'}">${board(true)}${board(false)}</div><div class="legend"><span class="legend-item"><i class="legend-square"></i>己方舰船</span><span class="legend-item"><i class="legend-square fog"></i>未知海域</span><span class="legend-item"><i class="legend-square water"></i>落空</span><span class="legend-item"><i class="legend-square fire"></i>命中</span><span class="legend-item"><i class="legend-square wreck"></i>沉没</span></div>${terrainLegend()}${prep?dock():''}</div><aside class="game-sidebar">${state.phase==='result'?'':commandCard()}${fleetCard(false)}${prep?'':fleetCard(true)}${logCard()}</aside></div><div class="keyboard-hint">${prep?'<span><span class="keycap">R</span> 旋转舰船</span><span><span class="keycap">Esc</span> 取消选择</span>':'<span><span class="keycap">Enter</span> 执行卡牌</span><span><span class="keycap">Esc</span> 取消卡牌与瞄准</span>'}</div>`:''}<p class="bottom-note">${mode==='practice'?'人机演习 · 对手按相同牌库与行动力规则出牌':'局域网对战 · 双方棋盘独立，侦察情报仅自己可见'}</p>`}${footer()}</main>`;
  updateTimer();
}
function updateTimer() {
  if (!state?.deadline) return;
  const remaining = Math.max(0,state.deadline-(Date.now()+serverOffset));
  const number = $('#timer-number'), ring = $('#timer-ring');
  if (number) { number.innerHTML=`${String(Math.ceil(remaining/1000)).padStart(2,'0')}<small>s</small>`; number.classList.toggle('urgent',remaining<=5000); }
  if (ring) { ring.style.setProperty('--progress',Math.min(1,remaining/(state.phase==='placement'?PREP_MS:TURN_MS))); ring.style.background=remaining<=5000?'conic-gradient(var(--red) calc(var(--progress)*360deg),#253647 0)':''; }
}
function acceptState(next, force = false) {
  if (state && next.version < state.version) return;
  if (next.serverNow) serverOffset = next.serverNow-Date.now();
  const changed = force || !state || state.version!==next.version || connectionLost;
  const oldPhase = state?.phase, oldTurn = state?.turn;
  if (oldPhase==='result' && next.phase==='lobby') lastHistory=0;
  if(pointerDrag && next.phase!=='placement') {
    pointerDrag.ghost?.remove();
    if(pointerDrag.source.hasPointerCapture(pointerDrag.id))pointerDrag.source.releasePointerCapture(pointerDrag.id);
    pointerDrag=null;suppressClickUntil=performance.now()+350;
  }
  state = next; connectionLost = false;
  const currentCard=state.own.hand.find(c=>c.id===selectedCard);
  if (!currentCard||!canUseCard(state.own,currentCard,cardContext(state))) { selectedCard=null; resetTargets(); }
  if (oldTurn!==next.turn || oldPhase!==next.phase) { resetTargets(); selectedShip=null; selectedCard=null; }
  if (next.phase==='result' && oldPhase!=='result') { showAftermath=false; beep('start'); }
  const event = next.history.at(-1);
  if (event && event.id>lastHistory) {
    if (['hit','miss','sunk'].includes(event.type)) beep(event.type);
    if(event.type==='strike')beep(event.results.some(r=>['hit','sunk'].includes(r.result))?'hit':'miss');
    lastHistory=event.id;
  }
  if (changed && !pointerDrag) renderGame();
}
async function request(route, options={}) {
  const response = await fetch(`./api/${route}`, { cache:'no-store', ...options,
    headers: { ...(options.body ? {'Content-Type':'application/json'} : {}), ...(session ? {'Authorization':`Bearer ${session.token}`} : {}), ...options.headers },
    signal: AbortSignal.timeout(5000),
  });
  const data = await response.json();
  if (!response.ok) { const error=new Error(data.error||'连接失败'); error.status=response.status; throw error; }
  return data;
}
async function refreshRooms(notify = false) {
  if (!lan) { if(notify) showLanHelp(); return; }
  try {
    const data = await request('rooms');
    const changed=JSON.stringify(rooms)!==JSON.stringify(data.rooms); rooms=data.rooms;
    if(mode==='lobby'&&(changed||notify)) renderLobby();
    if(notify) toast('房间列表已更新');
  } catch { if(notify) toast('无法连接局域网服务，请检查服务器是否运行',true); }
}
async function pollState() {
  if (mode!=='lan'||!session||polling||busy) return;
  polling=true;
  const currentSession = session.token;
  try { const next=await request('state'); if(mode==='lan'&&session?.token===currentSession) acceptState(next); }
  catch(error) {
    if(mode!=='lan'||session?.token!==currentSession)return;
    if (error.status===401) { session=null; store('deepblue-session',null); state=null; mode='lobby'; renderLobby(); toast(error.message,true); }
    else if(!connectionLost) {connectionLost=true;renderGame();}
  } finally {polling=false;}
}
async function send(action) {
  if(busy||!state) return false;
  busy=true;
  try {
    if(mode==='practice') {
      act(practice,'human',action);
      if(action.type==='rematch') act(practice,'bot',{type:'rematch'});
      if(practice.phase==='lobby') { act(practice,'bot',{type:'ready'}); act(practice,'human',{type:'ready'}); botDue=Date.now()+900; lastBotTurn=''; }
      acceptState({...viewFor(practice,'human'),roomName:'北纬 31° · 演习海域',opponentConnected:true},true);
    } else acceptState(await request('action',{method:'POST',body:JSON.stringify(action)}),true);
    return true;
  } catch(error) { toast(error.message,true); if(state)renderGame(); return false; }
  finally {busy=false;}
}
function startPractice() {
  session=null; mode='practice'; serverOffset=0; aimed=null; selectedShip=null; selectedCard=null; lastHistory=0;
  practice=makeGame([makePlayer('human',readStorage('deepblue-name','指挥官',true)),makePlayer('bot','迷雾 AI')],selectedMap);
  act(practice,'bot',{type:'ready'});act(practice,'human',{type:'ready'});
  state=null; botDue=Date.now()+1000; lastBotTurn='';
  acceptState({...viewFor(practice,'human'),roomName:'北纬 31° · 演习海域',opponentConnected:true},true);
  window.scrollTo({top:0,behavior:'instant'}); beep('click');
}
function botAction() {
  return chooseBotAction(viewFor(practice,'bot'));
}
function practiceTick() {
  if(mode!=='practice'||!practice||busy) return;
  const now=Date.now();
  let changed=tick(practice,now);
  if(practice.phase==='placement'&&!practice.players[1].confirmed&&now>=botDue) {
    act(practice,'bot',{type:'auto'},now);act(practice,'bot',{type:'confirm'},now);changed=true;
  }
  if(practice.phase==='battle'&&practice.turn===1) {
    const turnKey=String(practice.round);
    if(lastBotTurn!==turnKey) {lastBotTurn=turnKey;botDue=now+1000+Math.random()*1100;}
    else if(now>=botDue) {act(practice,'bot',botAction(),now);botDue=now+700+Math.random()*600;changed=true;}
  }
  if(changed) acceptState({...viewFor(practice,'human'),roomName:'北纬 31° · 演习海域',opponentConnected:true},true);
}
function openModal(title,content) {
  if(modal.open) modal.close();
  modal.innerHTML=`<div class="modal-top"><h2 id="modal-title">${title}</h2><button class="modal-close" data-action="close-modal" aria-label="关闭弹窗">${icon('cross')}</button></div>${content}`;
  modal.showModal();
}
function showRules() {
  const rules = [
    ['舰队与布阵','每方 11 艘、26 格，包含一艘 3×2 格航空母舰，可旋转为 2×3。双方准备后有 90 秒布阵，礁石不能部署，超时自动补齐。'],
    ['20 种战术卡','每种 1 张，共 20 张；开战发 4 张，每次自己的回合开始再抓 2 张，包含首回合。使用完的卡牌回到牌库底部；手牌保留，无上限。'],
    ['行动力与换手','每回合恢复 3 点行动力，10 秒内可连续出牌。后勤补给可突破 3 点。0 点时若有零费卡仍能使用，主动结束或超时则换手；没有零费牌且行动力归零时自动换手。卡牌只在自己的回合使用。'],
    ['范围、移动与鱼雷','攻击和照明范围按格心直线距离计算。移动按上下左右的合法路径计格，不能穿过礁石、其他舰体和残骸，浅滩会中止移动并搁浅，暗礁可令中途触礁沉没。鱼雷从己方对应行面向敌方的一侧入场，遇舰艇、残骸或礁石停止，每个暗礁格独立判定 25% 受阻。'],
    ['视野、制空与维修','侦察探查己方暗礁，照明和飞机提供临时实时视野；到期回到迷雾。持续回合按使用者自己的回合计数并包含当前回合。烟幕遮断视野且清除旧情报，修复只针对仍存活舰艇，不能打捞残骸。敌方制空期间飞机卡禁用。'],
  ];
  openModal('作战手册',`<p class="modal-description">用手牌下达指令，在海雾中寻找对手。</p><div class="rule-fleet">${TYPES.map(t=>`<div><b>${t.width?`${t.length}×${t.width}`:t.length} 格 × ${t.count}</b>${t.name}</div>`).join('')}</div><div class="rules-list">${rules.map(([title,text],i)=>`<div class="rule-row"><span class="rule-number">0${i+1}</span><div><h3>${title}</h3><p>${text}</p></div></div>`).join('')}</div>${terrainLegend()}<button class="text-button" data-action="card-guide">查看 20 张卡牌图鉴 ↗</button><button class="btn primary full" data-action="close-modal">收到，指挥官${icon('check')}</button>`);
}
function showLanHelp() {
  openModal('与伙伴在局域网开战',`<p class="modal-description">GitHub Pages 提供人机试玩。双人房间由随项目附带的本地服务运行，只需一位玩家启动。</p><ol class="setup-steps"><li>安装 Node.js 22 或更新版本，然后下载项目。</li><li>在项目目录打开终端，运行：</li></ol><div class="code-block">git clone ${REPO}.git\ncd IMDT-Game-Design\nnpm start</div><ol class="setup-steps" start="3"><li>终端会显示 <code>http://你的局域网IP:3000</code>。两位玩家连接同一 Wi-Fi，并打开这个<strong>相同地址</strong>。</li><li>创建 / 加入公开房间，双方准备，即可开战。</li></ol><p class="checkbox-note">服务运行期间房间保持可用；重启后清空。如无法连接，请检查两台设备可互访，且主机允许 TCP 3000 端口的入站连接。</p><div class="form-actions"><a class="btn subtle" href="${REPO}#局域网双人对战" target="_blank" rel="noopener">查看完整说明 ↗</a><button class="btn primary" data-action="practice-modal">先试人机演习</button></div>`);
}
function showRoomForm(joinId=null) {
  if(!lan) return showLanHelp();
  const joining=joinId!==null;
  openModal(joining?'加入作战房间':'创建作战房间',`<p class="modal-description">${joining?'输入你的呼号，即刻加入舰队。':'房间会出现在本局域网的大厅中，最多两位指挥官。'}</p><form id="room-form" data-joining="${joining}"><label class="form-label" for="player-name">指挥官呼号</label><input id="player-name" name="name" maxlength="16" required placeholder="例如：北海指挥官" value="${esc(readStorage('deepblue-name','',true))}" autocomplete="nickname">${joining?`<label class="form-label" for="room-code">房间编号</label><input id="room-code" name="roomId" maxlength="6" minlength="6" required pattern="[A-Fa-f0-9]{6}" placeholder="6 位房间号" value="${esc(joinId)}" style="text-transform:uppercase;letter-spacing:3px">`:`<label class="form-label" for="room-name">房间名称</label><input id="room-name" name="roomName" maxlength="20" placeholder="例如：北海第一舰队"><label class="form-label" for="room-map">作战海域</label><select id="room-map" name="mapId">${MAPS.map(m=>`<option value="${m.id}" ${m.id===selectedMap?'selected':''}>${m.name} — ${m.summary}</option>`).join('')}</select>`}<p class="error-text" id="form-error" role="alert"></p><div class="form-actions"><button type="button" class="btn subtle" data-action="close-modal">取消</button><button type="submit" class="btn primary">${joining?'加入房间':'创建房间'}${icon('arrow')}</button></div></form>`);
}
async function submitRoom(form) {
  const button=form.querySelector('[type="submit"]'); if(button.disabled)return;
  const data=Object.fromEntries(new FormData(form));button.disabled=true;
  try {
    const joining=form.dataset.joining==='true';
    const result=await request(joining?'join':'create',{method:'POST',body:JSON.stringify(data)});
    store('deepblue-name',data.name,true);session=result;store('deepblue-session',JSON.stringify(result));
    mode='lan';state=null;lastHistory=0;selectedShip=null;aimed=null;modal.close();
    acceptState(await request('state'),true); window.scrollTo({top:0,behavior:'instant'});
  } catch(error) {const output=$('#form-error');if(output)output.textContent=error.message;}
  finally {button.disabled=false;}
}
function askExit() {
  if(mode==='lobby')return;
  if(state?.phase==='result')return exitRoom();
  openModal('返回作战大厅？',`<p class="modal-description">${state?.phase==='lobby'?'离开当前房间，返回大厅。':mode==='practice'?'本次演习进度将结束。':'离开将结束本局，并判定仍在房间的对手获胜。'}</p><div class="form-actions"><button class="btn subtle" data-action="close-modal">继续作战</button><button class="btn danger" data-action="exit-confirm">确认离开</button></div>`);
}
async function exitRoom() {
  if(modal.open)modal.close();
  if(mode==='lan'&&session)try{await request('leave',{method:'POST',body:'{}'});}catch{}
  session=null;practice=null;state=null;mode='lobby';selectedShip=null;aimed=null;serverOffset=0;connectionLost=false;store('deepblue-session',null);
  renderLobby();refreshRooms();window.scrollTo({top:0,behavior:'instant'});
}
function selectShip(id) {
  if(!state || (state.phase!=='placement' && state.phase!=='battle') || (state.phase==='placement' && state.own.confirmed) || (state.phase==='battle' && state.turn!==state.me))return;
  const ship=state.own.ships.find(s=>s.id===id);if(!ship)return;
  selectedShip=id;selectedVertical=ship.vertical;renderGame();beep();
}
async function rotateSelected() {
  if(!selectedShip||state?.phase!=='placement'||state.own.confirmed)return;
  const s=state.own.ships.find(s=>s.id===selectedShip);
  if(s.x!==null) {
    if(!canPlace(state.own.ships,s.id,s.x,s.y,!s.vertical,state.own.terrain))return toast('旋转后会重叠或越界，请先调整位置',true);
    selectedVertical=!s.vertical;await send({type:'place',id:s.id,x:s.x,y:s.y,vertical:selectedVertical});
  } else {selectedVertical=!selectedVertical;renderGame();}
}
function clearPreview(){document.querySelectorAll('.place-valid,.place-invalid').forEach(c=>c.classList.remove('place-valid','place-invalid'));}
function previewCell(c){
  clearPreview();
  if(!selectedShip||!state||state.phase!=='placement'||state.own.confirmed)return;
  const ship=state.own.ships.find(s=>s.id===selectedShip),x=c%10,y=Math.floor(c/10);
  const valid=canPlace(state.own.ships,ship.id,x,y,selectedVertical,state.own.terrain);
  const footprint=shape({...ship,vertical:selectedVertical});
  for(let row=0;row<footprint.height;row++)for(let col=0;col<footprint.width;col++)if(x+col<10&&y+row<10)$(`#own-grid [data-cell="${(y+row)*10+x+col}"]`)?.classList.add(valid?'place-valid':'place-invalid');
}
async function placeAt(c){
  clearPreview();if(!selectedShip)return;
  await send({type:'place',id:selectedShip,x:c%10,y:Math.floor(c/10),vertical:selectedVertical});
}
async function fire(){
  if(!selectedCard||state?.phase!=='battle'||state.turn!==state.me)return;
  const target=selection();if(!target.ready)return;
  await send(target.payload);
}
async function moveSelected(dx,dy) {
  const ship=state?.own.ships.find(s=>s.id===selectedShip);
  if(ship&&['move','smoke'].includes(selectedDefinition()?.effect)) {
    const x=ship.x+dx,y=ship.y+dy;if(x<0||x>9||y<0||y>9)return;
    aimed=y*10+x;await fire();
  }
}
async function handleAction(action,el){
  switch(action){
    case 'home': if(mode==='lobby')return;return askExit();
    case 'select-map':selectedMap=mapInfo(el.dataset.map).id;store('fogbound-map',selectedMap,true);renderLobby();return;
    case 'card-guide':return openModal('战术卡牌图鉴',cardGuide());
    case 'random-targets':pickedTargets=Array.from({length:100},(_,c)=>c).sort(()=>Math.random()-.5).slice(0,10);renderGame();return;
    case 'terrain-guide':return openModal('海域地形图鉴',terrainGuide());
    case 'select-card': {
      const card=state?.own.hand.find(c=>c.id===el.dataset.card);
      if(busy||state?.phase!=='battle'||state.turn!==state.me||!canUseCard(state.own,card,cardContext(state)))return;
      selectedCard=selectedCard===card.id?null:card.id;resetTargets();
      if(selectedDefinition()?.effect==='smoke'&&!sourceMatches(state.own.ships.find(s=>s.id===selectedShip)||{},'escort'))selectedShip=null;
      renderGame();beep();return;
    }
    case 'move':return moveSelected(Number(el.dataset.dx),Number(el.dataset.dy));
    case 'practice': return startPractice();
    case 'practice-modal': modal.close();return startPractice();
    case 'rules':return showRules();
    case 'create':return showRoomForm();
    case 'join':return showRoomForm(el.dataset.room);
    case 'join-code':return showRoomForm('');
    case 'refresh':return refreshRooms(true);
    case 'lan-help':return showLanHelp();
    case 'close-modal':return modal.close();
    case 'exit':return askExit();
    case 'exit-confirm':return exitRoom();
    case 'sound':sound=!sound;store('deepblue-sound',sound?'on':'off',true);beep();mode==='lobby'?renderLobby():renderGame();return;
    case 'select-ship':return selectShip(el.dataset.ship);
    case 'ready':return send({type:'ready'});
    case 'auto':case 'clear':selectedShip=null;return send({type:action});
    case 'confirm':selectedShip=null;return send({type:'confirm'});
    case 'rotate':return rotateSelected();
    case 'remove':{const id=selectedShip;selectedShip=null;return send({type:'remove',id});}
    case 'fire':return fire();
    case 'pass':resetTargets();return send({type:'pass'});
    case 'rematch':lastHistory=0;return send({type:'rematch'});
    case 'aftermath':showAftermath=!showAftermath;return renderGame();
    case 'copy-room':{
      const link=new URL(location.href);link.searchParams.set('room',state.roomId);
      try{await navigator.clipboard.writeText(link.href);toast('邀请链接已复制');}catch{toast(`房间编号：${state.roomId}`);}return;
    }
  }
}
document.addEventListener('click',event=>{
  if(performance.now()<suppressClickUntil){event.preventDefault();return;}
  const control=event.target.closest('[data-action]');
  if(control&&!control.disabled){event.preventDefault();handleAction(control.dataset.action,control);return;}
  const cell=event.target.closest('.cell');if(busy||!cell||cell.disabled)return;
  const c=Number(cell.dataset.cell);
  if(state.phase==='placement') {
    if(cell.dataset.board==='own'){if(cell.dataset.ship)selectShip(cell.dataset.ship);else if(selectedShip)placeAt(c);}return;
  }
  const d=selectedDefinition();if(!d)return;
  if(cell.dataset.board==='own') {
    if(d.target==='own-move') {
      if(cell.dataset.ship&&cell.dataset.ship!==selectedShip){selectedShip=cell.dataset.ship;aimed=null;}
      else aimed=c;
    } else if(d.target==='own-hit'||d.target==='own-cell')aimed=c;
    else if(cell.dataset.ship)selectedShip=cell.dataset.ship;
  } else if(d.target==='enemy-many') {
    if(pickedTargets.includes(c))pickedTargets=pickedTargets.filter(n=>n!==c);
    else if(pickedTargets.length<10)pickedTargets.push(c);else return toast('已选满 10 格，点击已选格可取消');
  } else if(d.target==='enemy-line') {
    if(aimed===null||lineEnd!==null){aimed=c;lineEnd=null;}
    else if(c!==aimed)lineEnd=c;
  } else aimed=c;
  renderGame();beep();
});
document.addEventListener('submit',event=>{if(event.target.id==='room-form'){event.preventDefault();submitRoom(event.target);}});
modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)modal.close();}});
document.addEventListener('keydown',event=>{
  if(modal.open||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
  const directions={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]};
  if(state?.phase==='battle'&&state.turn===state.me&&selectedShip&&directions[event.key]&&['move','smoke'].includes(selectedDefinition()?.effect)){event.preventDefault();const [dx,dy]=directions[event.key];moveSelected(dx,dy);return;}
  if(event.key.toLowerCase()==='r'){event.preventDefault();rotateSelected();}
  if(event.key==='Escape'){selectedShip=null;resetTargets();selectedCard=null;if(state)renderGame();}
  if(event.key==='Enter'&&document.activeElement?.tagName!=='BUTTON'){event.preventDefault();fire();}
});
document.addEventListener('mouseover',event=>{const c=event.target.closest('#own-grid .cell');if(c)previewCell(Number(c.dataset.cell));});
document.addEventListener('mouseout',event=>{if(event.target.closest('#own-grid')&&!event.relatedTarget?.closest?.('#own-grid'))clearPreview();});
document.addEventListener('dragstart',event=>{if(event.target.closest('[data-ship]'))event.preventDefault();});
let pointerDrag=null, suppressClickUntil=0;
document.addEventListener('pointerdown',event=>{
  if(event.button!==0||state?.phase!=='placement'||state.own.confirmed)return;
  const source=event.target.closest('.dock-piece, #own-grid .cell[data-ship]');if(!source||source.disabled)return;
  const ship=state.own.ships.find(s=>s.id===source.dataset.ship);selectedShip=ship.id;selectedVertical=ship.vertical;
  pointerDrag={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false,ghost:null,source};
  source.setPointerCapture(event.pointerId);
});
document.addEventListener('pointermove',event=>{
  if(!pointerDrag||event.pointerId!==pointerDrag.id)return;
  if(Math.hypot(event.clientX-pointerDrag.x,event.clientY-pointerDrag.y)<8&&!pointerDrag.moved)return;
  pointerDrag.moved=true;
  if(!pointerDrag.ghost){
    pointerDrag.ghost=document.createElement('div');pointerDrag.ghost.className='drag-ghost';
    const s=state.own.ships.find(s=>s.id===selectedShip),size=$('#own-grid').getBoundingClientRect().width/10;
    const footprint=shape({...s,vertical:selectedVertical});
    pointerDrag.ghost.style.cssText=`width:${footprint.width*size}px;height:${footprint.height*size}px`;
    pointerDrag.ghost.innerHTML=vessel({...s,vertical:selectedVertical});document.body.append(pointerDrag.ghost);
  }
  pointerDrag.ghost.style.left=`${event.clientX-15}px`;pointerDrag.ghost.style.top=`${event.clientY-15}px`;
  const c=document.elementFromPoint(event.clientX,event.clientY)?.closest('#own-grid .cell');if(c)previewCell(Number(c.dataset.cell));else clearPreview();
});
function endPointer(event){
  if(!pointerDrag||event.pointerId!==pointerDrag.id)return;
  const drag=pointerDrag;pointerDrag=null;drag.ghost?.remove();clearPreview();
  if(drag.source.hasPointerCapture(event.pointerId))drag.source.releasePointerCapture(event.pointerId);
  if(drag.moved){
    suppressClickUntil=performance.now()+350;
    const c=event.type==='pointercancel'?null:document.elementFromPoint(event.clientX,event.clientY)?.closest('#own-grid .cell');
    if(c)placeAt(Number(c.dataset.cell));else if(state)renderGame();
  }
}
document.addEventListener('pointerup',endPointer);document.addEventListener('pointercancel',endPointer);

async function init(){
  app.innerHTML='<div class="loading">FOGBOUND / 正在连接海域</div>';
  try{const health=await request('health');lan=health.ok&&health.mode==='lan';}catch{lan=false;}
  const saved=readStorage('deepblue-session');
  if(lan&&saved){try{session=JSON.parse(saved);mode='lan';await pollState();if(state)return;}catch{session=null;mode='lobby';store('deepblue-session',null);}}
  renderLobby();await refreshRooms();
  const code=new URLSearchParams(location.search).get('room');if(code&&lan)showRoomForm(code.toUpperCase());
}
setInterval(updateTimer,100);
setInterval(practiceTick,180);
setInterval(()=>{if(mode==='lan')pollState();},700);
setInterval(()=>{if(mode==='lobby'&&lan&&!modal.open)refreshRooms();},2500);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(mode==='lan')pollState();else practiceTick();}});
init();
