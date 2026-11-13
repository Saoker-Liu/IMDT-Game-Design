/** Provisional cards. Replace this catalog/deck recipe when the final deck is designed. */
export const DECK_SIZE = 20;
export const INITIAL_HAND = 4;
export const DRAW_PER_TURN = 2;
export const ACTIONS_PER_TURN = 3;
export const CARD_TYPES = {
  shell: { name: '炮击指令', tag: 'GUNNERY', cost: 1, count: 8, effect: 'fire', weapon: 'shell', icon: 'target', description: '炮击敌方一个格子，命中造成一格伤害。' },
  move: { name: '机动指令', tag: 'MANEUVER', cost: 1, count: 6, effect: 'move', icon: 'ship', description: '选择一艘完好的己舰，向上下左右平移一格。' },
  recon: { name: '侦察指令', tag: 'RECON', cost: 1, count: 4, effect: 'recon', icon: 'radar', description: '侦察敌方一个格子是否有舰，不造成伤害，不揭示暗礁。' },
  torpedo: { name: '鱼雷指令', tag: 'TORPEDO', cost: 2, count: 2, effect: 'fire', weapon: 'torpedo', icon: 'target', description: '发射一枚鱼雷；命中深海中的舰船，整舰沉没。每局仍限三枚。' },
};
export function makeDeck() {
  return Object.entries(CARD_TYPES).flatMap(([type, card]) =>
    Array.from({ length: card.count }, (_, i) => ({ id: `${type}-${i + 1}`, type })));
}
export function drawCards(player, count = DRAW_PER_TURN) {
  player.hand.push(...player.deck.splice(0, count));
}
export function canUseCard(player, card) {
  const definition = CARD_TYPES[card?.type];
  return !!definition && player.actionPoints >= definition.cost
    && (definition.weapon !== 'torpedo' || player.torpedoes > 0);
}
export function dealCards(player, rng = Math.random) {
  player.deck = makeDeck();
  player.hand = [];
  for (let i = player.deck.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(rng() * (i + 1))));
    [player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]];
  }
  drawCards(player, INITIAL_HAND);
}
