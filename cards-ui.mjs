import { CARD_TYPES, DECK_SIZE, ACTIONS_PER_TURN, canUseCard, unavailableReason, cardContext } from './cards.mjs?v=5.1.0';

export function handPanel(state, selected, icon) {
  const active = state.phase === 'battle' && state.turn === state.me;
  const player = state.own, opponent = state.players[1 - state.me];
  return `<section class="hand-panel" aria-label="战术手牌"><div class="hand-heading"><div class="hand-title"><small>TACTICAL ORDERS</small><h3>战术手牌 <span data-hand-count>${player.hand.length}</span></h3><button class="text-button card-library-button" data-action="card-guide">20 张卡牌图鉴 ↗</button></div><div class="action-points" aria-label="行动力 ${player.actionPoints} / ${ACTIONS_PER_TURN}" data-ap="${player.actionPoints}"><span>行动力</span><b>${player.actionPoints}<small> / 初始 ${ACTIONS_PER_TURN}</small></b><span class="ap-pips" aria-hidden="true">${Array.from({length:Math.max(ACTIONS_PER_TURN,Math.min(player.actionPoints,10))},(_,i)=>`<i class="${i<player.actionPoints?'filled':''}"></i>`).join('')}</span></div><div class="deck-status"><b>牌库 <span data-deck-count>${player.deckCount}</span><small> / ${DECK_SIZE}</small></b><span>用后回底 · 回合开始抽 2 张</span></div></div><div class="hand-cards" role="group" aria-label="选择一张卡牌">${player.hand.map(card=>{
    const d = CARD_TYPES[card.type], affordable = canUseCard(player, card, cardContext(state));
    const reason = !active ? '等待自己的回合' : unavailableReason(player,card,cardContext(state))||d.description;
    return `<button class="tactical-card card-${card.type}${selected===card.id?' selected':''}" data-action="select-card" data-card="${card.id}" data-card-type="${card.type}" aria-pressed="${selected===card.id}" aria-label="${d.name}，消耗 ${d.cost} 点行动力，${reason}" title="${reason}" ${active&&affordable?'':'disabled'}><span class="card-top"><span class="card-cost">${d.cost}</span><span>战术卡 / ${d.tag}</span></span><span class="card-emblem">${icon(d.icon)}</span><strong>${d.name}</strong><span class="card-description">${d.description}</span><span class="card-bottom">${selected===card.id?'已选中 · 选择目标':!active?'等待回合':!affordable?reason:'选择此牌'}<span>↗</span></span></button>`;
  }).join('')||'<p class="empty-hand">暂无手牌。下个回合从牌库抓取最多 2 张。</p>'}</div><div class="hand-foot"><span>${active?'选牌 → 选取目标 → 确认；不限时，点击“结束回合”后换手。':'可查看手牌，等待自己的回合。'} 开局发 4 张，首回合也抽 2 张。</span><span>对手手牌 ${opponent?.handCount??0} · 牌库 ${opponent?.deckCount??DECK_SIZE}</span></div></section>`;
}

export function cardGuide() {
  return `<p class="modal-description">每人 20 张，每种各 1 张。卡牌只在自己的回合使用；零费卡可在 0 行动力时使用。范围为格心欧氏距离；移动沿上下左右的合法航道，目标格为舰体左上角。</p><div class="card-guide-grid">${Object.values(CARD_TYPES).map(d=>`<article><b><span class="card-cost">${d.cost}</span>${d.name}</b><p>${d.description}</p></article>`).join('')}</div><p class="sidebar-note">持续回合按使用者自己的回合计数，包含当前回合。航母每方 1 艘，占据 3×2 格，可旋转为 2×3。</p><button class="btn primary full" data-action="close-modal">了解卡组</button>`;
}
