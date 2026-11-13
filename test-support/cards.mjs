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

// Existing terrain/fog scenarios exercise an action on its last affordable AP.
// Full multi-card turns and unmodified dealing are covered in cards.test.mjs.
export function scenarioAct(game, id, action, now, rng) {
  if (!['fire','move'].includes(action.type)) return act(game,id,action,now,rng);
  const player = game.players.find(p=>p.id===id);
  const type = action.type === 'move' ? 'move' : action.weapon || 'shell';
  let card = player.hand.find(c=>c.type===type);
  if (game.phase==='battle' && game.players[game.turn]===player && now<game.deadline) {
    if (!card) {
      const index = player.deck.findIndex(c=>c.type===type);
      assert.notEqual(index,-1,`Missing fixture card: ${type}`);
      [card] = player.deck.splice(index,1);
      player.hand.push(card);
    }
    player.actionPoints = CARD_TYPES[type].cost;
  }
  return act(game,id,{...action,type:'play-card',cardId:card?.id||'unavailable'},now,rng);
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
  async function action(session, body) {
    if (!['fire','move','recon'].includes(body.type)) return send(session,body);
    const type = body.type==='fire' ? body.weapon||'shell' : body.type;
    const card = await findCard(session,type);
    let view = await send(session,{...body,type:'play-card',cardId:card.id});
    if (view.phase==='battle' && view.turn===view.me) view = await send(session,{type:'pass'});
    return view;
  }
  return { action, findCard };
}
