import assert from 'node:assert/strict';
import { act } from '../public/engine.mjs';
import { CARD_TYPES } from '../public/cards.mjs';

export function giveHand(player, types) {
  const pile = [...player.hand, ...player.deck];
  player.hand = types.map(type => {
    const index = pile.findIndex(card => card.type === type);
    assert.notEqual(index, -1, `Missing fixture card: ${type}`);
    return pile.splice(index, 1)[0];
  });
  player.deck = pile;
}

/** Reach a real shuffled card using only public actions; no server state injection. */
export function cardSessionActions(send, state, peers) {
  async function findCard(session, type) {
    for (let i=0;i<24;i++) {
      const view = await state(session);
      assert.equal(view.phase,'battle');
      if (view.turn !== view.me) { await send(peers.find(s=>s!==session),{type:'pass'}); continue; }
      const card = view.own.hand.find(c=>c.type===type);
      if (card && view.own.actionPoints>=CARD_TYPES[type].cost) return card;
      await send(session,{type:'pass'});
    }
    throw new Error(`Could not draw ${type} card`);
  }
  return { action:send, findCard };
}

export const FIXED_PLACEMENTS=[['BB-1',0,0],['CG-1',0,2],['CG-2',5,2],['DD-1',0,4],['DD-2',3,4],['DD-3',6,4],['FF-1',0,6],['FF-2',2,6],['FF-3',4,6],['FF-4',6,6],['CV-1',7,8]];
