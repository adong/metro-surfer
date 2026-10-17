/* Metro Surfer — game content. The runners (Teddy, Tommy and friends) live in the shared kit: kit/roster.js. */

// The inspector who chases you (not pickable).
window.MetroInspector = {
  head: 'human', skin: '#eeb98f', hair: 'short', hairColor: '#6a6a6a', hat: 'cap', hatColor: '#1c2f66',
  badge: true, mustache: true, belly: true, shirt: 'jacket', top: '#27428c', bottom: '#1c2f66', shoes: '#151418',
};

// Word Hunt: the letters of the current word show up on the track one at a time, in order. Spell the word to win
// 100 coins plus its reward, then the next word starts. Progress is saved between runs. Add your own words here.
// Rewards: board (+1 hoverboard), tommy (your buddy runs with you), mult, sneakers, magnet, jet, coins (100 more coins).
window.MetroWords = [
  { word: 'TEDDY', reward: 'board' },
  { word: 'TOMMY', reward: 'tommy' },
  { word: 'METRO', reward: 'mult' },
  { word: 'SURF', reward: 'sneakers' },
  { word: 'ZOMBIE', reward: 'magnet' },
  { word: 'CLAUDE', reward: 'jet' },
];
