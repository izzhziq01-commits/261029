window.balloonModes = {
  casual: {
    name: 'Casual', zoneMin: 0.14, zoneRange: 0.03,
    rateMin: 0.21, rateRange: 0.07, surgeMin: 0.85, surgeRange: 0.35,
    streakSpeed: 0.025, reactionWindow: 0.24, birdCount: 0, birdTimes: [],
  },
  challenger: {
    name: 'Challenger', zoneMin: 0.068, zoneRange: 0.018,
    rateMin: 0.295, rateRange: 0.11, surgeMin: 0.6, surgeRange: 1.05,
    streakSpeed: 0.048, reactionWindow: 0.15, birdCount: 3, birdTimes: [4],
  },
  hardcore: {
    name: 'Hardcore', zoneMin: 0.045, zoneRange: 0.01,
    rateMin: 0.34, rateRange: 0.14, surgeMin: 0.45, surgeRange: 1.55,
    streakSpeed: 0.06, reactionWindow: 0.11, birdCount: 5, birdTimes: [8, 20],
  },
};
window.balloonModeId = new URLSearchParams(location.search).get('mode');
if (!Object.prototype.hasOwnProperty.call(window.balloonModes, window.balloonModeId)) {
  const requestedItem = new URLSearchParams(location.search).get('item');
  const item = requestedItem === 'piano' ? 'fridge' : requestedItem;
  window.balloonModeId = window.balloonMissions?.[item]?.difficulty || 'challenger';
}
const modeItemParam = new URLSearchParams(location.search).get('item');
const modeItem = modeItemParam === 'piano' ? 'fridge' : modeItemParam;
const modeMission = window.balloonMissions?.[modeItem];
window.balloonMode = {
  ...window.balloonModes[window.balloonModeId],
  ...(modeMission?.difficulty === window.balloonModeId ? modeMission.tuning : {}),
};
