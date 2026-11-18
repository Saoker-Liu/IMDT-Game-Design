import {mapInfo} from './terrain.mjs?v=5.1.0';
import {boardFurniture} from './art.mjs?v=5.2.13';
const paths={
  trophy:'<path d="M7 3h10v7a5 5 0 0 1-10 0V3Zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 3v5m-5 1h10"/>',
  flag:'<path d="M5 22V3q4-3 8 0t7 0v11q-4 3-7 0t-8 0"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||''}</svg>`;
export function resultCard(state, showAftermath = false) {
  const win = state.winner === state.me;
  const shots = state.own.stats?.attacks||0;
  const hits = state.own.stats?.hits||0;
  const elapsed = state.startedAt ? Math.max(0,Math.round((state.endedAt-state.startedAt)/1000)) : 0;
  const time = `${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,'0')}`;
  const left = state.history.at(-1)?.reason === 'left';
  return `<section class="result-card${win?'':' defeat'}">${boardFurniture(true)}<div class="result-chart-name">${mapInfo(state.mapId).name} · 战斗结报</div><div class="result-icon">${icon(win?'trophy':'flag')}</div><div class="eyebrow" style="justify-content:center;margin-bottom:9px">${win?'MISSION ACCOMPLISHED':'MISSION COMPLETE'}</div><h2>${win?'海域，已在掌控。':'胜负已定，再战雾海。'}</h2><p>${left ? '一位指挥官已离开，仍在场的舰队获胜。' : win ? '敌方舰队全数沉没。指挥官，干得漂亮。' : '你的舰队已全数沉没。下一次，用战术改写结局。'}</p><div class="result-stats"><div><b>${shots}</b><span>发射炮弹</span></div><div><b>${shots?Math.round(hits/shots*100):0}%</b><span>命中率</span></div><div><b>${time}</b><span>交战时长</span></div></div><div class="result-actions"><button class="btn subtle" data-action="exit">返回大厅</button><button class="btn primary" data-action="rematch" ${state.own.rematch||state.opponentConnected===false?'disabled':''}>${icon('refresh')}${state.own.rematch?'等待对手再战':'再来一局'}</button></div></section><div class="reveal-toggle"><button class="text-button" data-action="aftermath">${icon('eye')}${showAftermath?'收起':'查看'}本局战况${icon('chevron')}</button></div>`;
}