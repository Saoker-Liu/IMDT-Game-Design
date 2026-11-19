import {
  CARD_TYPES, DECK_SIZE, ACTIONS_PER_TURN, unavailableReason, cardContext,
} from './cards.mjs?v=5.2.18';

const FAMILY_BY_EFFECT = {
  secondary: 'firepower', main: 'firepower', torpedo: 'firepower',
  recon: 'intel', vision: 'intel',
  move: 'maneuver', smoke: 'maneuver',
  draw: 'support', supply: 'support', repair: 'support',
};

const FAMILY_NAMES = {
  firepower: '火力', intel: '侦察', maneuver: '机动', support: '支援', aviation: '航空',
};

const CARD_SUMMARIES = {
  secondary: '炮击敌方一格，战列舰免疫。',
  main: '炮击落点一格范围。',
  big: '炮击落点两格范围。',
  barrage: '随机炮击敌方十个不同格。',
  torpedo: '向选定的一行发射一枚鱼雷。',
  triple: '向选定行及上下两行发射鱼雷。',
  tactics: '从牌库抽取两张牌。',
  supply: '本回合补充两点行动力。',
  recon: '探明己方三格范围内的暗礁。',
  flare: '照亮两格范围，持续三回合。',
  lamp: '照亮三格范围，持续四回合。',
  maneuver: '沿合法航道移舰，最多两格。',
  rapid: '沿合法航道移舰，最多四格。',
  speed: '沿合法航道机动，距离不限。',
  seaplane: '查看敌方全图一回合。',
  fighter: '争夺制空权，持续三回合。',
  bomber: '航弹覆盖落点一格范围。',
  torpedoPlane: '沿选定起点和终点投放鱼雷。',
  repair: '修复己舰一处中弹部位。',
  smoke: '掩护护航舰，可机动两格。',
};

function cardFace(type) {
  const card = CARD_TYPES[type];
  const family = card.aircraft ? 'aviation' : FAMILY_BY_EFFECT[card.effect];
  return `
    <span class="card-face card-family-${family}">
      <img class="card-illustration" src="./assets/cards/${type}.webp" alt="" decoding="async" draggable="false">
      <span class="card-cost" aria-label="${card.cost} 点行动力">${card.cost}</span>
      <strong class="card-name">${card.name}</strong>
      <span class="card-copy">
        <span class="card-family">${FAMILY_NAMES[family]}</span>
        <span class="card-summary">${CARD_SUMMARIES[type]}</span>
      </span>
    </span>`;
}

export function handPanel(state, selected) {
  const active = state.phase === 'battle' && state.turn === state.me;
  const player = state.own;
  const opponent = state.players[1 - state.me];
  const context = cardContext(state);
  const hand = player.hand.map(({id, type}) => {
    const card = CARD_TYPES[type];
    const reason = active ? unavailableReason(player, {type}, context) : '等待自己的回合';
    const picked = selected === id;
    const hint = reason || card.description;
    const status = picked ? '已选中' : reason;
    return `
      <button class="tactical-card card-illustrated${picked ? ' selected' : ''}" data-action="select-card"
        data-card="${id}" data-card-type="${type}" aria-pressed="${picked}"
        aria-label="${card.name}，消耗 ${card.cost} 点行动力，${hint}" title="${hint}" ${reason ? 'disabled' : ''}>
        ${cardFace(type)}
        ${status ? `<span class="card-status">${status}</span>` : ''}
      </button>`;
  }).join('');

  const pips = Array.from(
    {length: Math.max(ACTIONS_PER_TURN, Math.min(player.actionPoints, 10))},
    (_, index) => `<i class="${index < player.actionPoints ? 'filled' : ''}"></i>`,
  ).join('');

  return `
    <section class="hand-panel" aria-label="战术手牌">
      <div class="hand-heading">
        <div class="hand-title">
          <h3>战术手牌 <span data-hand-count>${player.hand.length}</span></h3>
          <button class="text-button card-library-button" data-action="card-guide">卡牌图鉴 ↗</button>
        </div>
        <div class="action-points" aria-label="行动力 ${player.actionPoints} / ${ACTIONS_PER_TURN}" data-ap="${player.actionPoints}">
          <span>行动力</span><b>${player.actionPoints}<small> / 初始 ${ACTIONS_PER_TURN}</small></b>
          <span class="ap-pips" aria-hidden="true">${pips}</span>
        </div>
        <div class="deck-status">
          <b>牌库 <span data-deck-count>${player.deckCount}</span><small> / ${DECK_SIZE}</small></b>
          <span>用后回底 · 回合开始抽 2 张</span>
        </div>
      </div>
      <div class="hand-cards" role="group" aria-label="选择一张卡牌">
        ${hand || '<p class="empty-hand">暂无手牌。下个回合从牌库抓取最多 2 张。</p>'}
      </div>
      <div class="hand-foot">
        <span>${active ? '选牌 → 选取目标 → 确认。准备好后确认结束回合。' : '可查看手牌，等待自己的回合。'}</span>
        <span>对手手牌 ${opponent?.handCount ?? 0} · 牌库 ${opponent?.deckCount ?? DECK_SIZE}</span>
      </div>
    </section>`;
}

export function cardGuide() {
  const faces = Object.entries(CARD_TYPES).map(([type, card]) => `
    <article class="card-guide-entry" aria-label="${card.name}">
      ${cardFace(type)}
      <p class="card-description">${card.description}</p>
    </article>`).join('');
  return `
    <p class="modal-description">每人 20 张，每种各 1 张。卡牌在自己的回合使用，零费卡可在 0 行动力时使用。</p>
    <div class="card-guide-grid" aria-label="二十张战术卡牌">${faces}</div>
    <p class="sidebar-note">范围为格心欧氏距离。舰船沿上下左右的合法航道移动，目标格为舰体左上角。持续时间按使用者自己的回合计数，包含当前回合。航母每方 1 艘，占据 3×2 格，可旋转为 2×3。</p>
    <button class="btn primary full" data-action="close-modal">关闭图鉴</button>`;
}
