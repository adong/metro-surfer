/* Metro Surfer — the runners you can pick. Each one keeps its own best score.
   To add a player, copy an entry and give it a new id. Colours are hex; styles are listed in art.js (buildPerson). */
window.MetroAvatars = [
  {
    id: 'teddy',
    name: 'TEDDY',
    look: {
      head: 'human', skin: '#efc29c', hair: 'spiky', hairColor: '#16130f', brows: true, smile: true,
      shirt: 'tee', top: '#4a86cf', print: 'bricks', bottom: '#2b3140', shoes: '#e53935',
    },
  },
  {
    id: 'zoom',
    name: 'ZOOM',
    look: {
      head: 'human', skin: '#f2c49c', hair: 'short', hairColor: '#4a2f1d', hat: 'capBack', hatColor: '#18b4ff',
      shirt: 'hoodie', top: '#ff3d7f', print: 'bolt', bottom: '#2d5fb8', shoes: '#ffd400',
      pack: '#ffb02e', packPocket: '#18b4ff', headphones: '#22212a',
    },
  },
  {
    id: 'luna',
    name: 'LUNA',
    look: {
      head: 'human', skin: '#b27a52', hair: 'ponytail', hairColor: '#2a1a12', brows: true, smile: true,
      shirt: 'hoodie', top: '#8d5bd8', print: 'star', bottom: '#20232e', shoes: '#f4f4f4', pack: '#18d4ff',
    },
  },
  {
    id: 'bolt',
    name: 'BOLT',
    look: {
      head: 'robot', skin: '#e6eaef', eyes: '#5ef2ff',
      shirt: 'jacket', top: '#ff8a1f', print: 'panel', bottom: '#5a5f6b', shoes: '#2a2a30',
    },
  },
  {
    id: 'bruno',
    name: 'BRUNO',
    look: {
      head: 'bear', skin: '#8b5a2b', muzzle: '#d9b48a',
      shirt: 'hoodie', top: '#2fb36a', print: 'paw', bottom: '#2b3a63', shorts: true, shoes: '#ff3d7f',
    },
  },
  {
    // Tommy's idea: picking this card makes a zombie shamble right up to the screen. Only a visual effect.
    id: 'zombie',
    name: 'ZOMBIE',
    scare: true,
    look: {
      head: 'human', zombie: true, skin: '#8fbf6a', hair: 'short', hairColor: '#2b2f22',
      shirt: 'tee', top: '#6d5a8c', print: 'torn', bottom: '#4a4038', shorts: true, shoes: '#5b4636',
    },
  },
];

// The inspector who chases you (not pickable).
window.MetroInspector = {
  head: 'human', skin: '#eeb98f', hair: 'short', hairColor: '#6a6a6a', hat: 'cap', hatColor: '#1c2f66',
  badge: true, mustache: true, belly: true, shirt: 'jacket', top: '#27428c', bottom: '#1c2f66', shoes: '#151418',
};

// Tommy isn't a runner: tap his card and he runs along with you for a bit, hands you a treat and does his Y pose.
window.MetroBuddy = {
  id: 'tommy',
  name: 'TOMMY',
  scale: 0.72,
  pose: 'peace', // his favourite: both arms up in a Y, peace fingers (比耶)
  look: {
    head: 'human', skin: '#efc6a2', hair: 'short', hairColor: '#15120e', brows: true, peace: true,
    shirt: 'tee', top: '#c3d6cf', print: 'ufo', bottom: '#e6dfd0', shoes: '#2f4a7a',
  },
};

// Word Hunt: the letters of the current word show up on the track one at a time, in order. Spell the word to win
// 100 coins plus its reward, then the next word starts. Progress is saved between runs. Add your own words here.
// Rewards: board (+1 hoverboard), tommy (Tommy runs with you), mult, sneakers, magnet, jet, coins (100 more coins).
window.MetroWords = [
  { word: 'TEDDY', reward: 'board' },
  { word: 'TOMMY', reward: 'tommy' },
  { word: 'METRO', reward: 'mult' },
  { word: 'SURF', reward: 'sneakers' },
  { word: 'ZOMBIE', reward: 'magnet' },
  { word: 'CLAUDE', reward: 'jet' },
];
