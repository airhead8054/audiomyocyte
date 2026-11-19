// cells/pacemaker.js – a pacemaker cell
//
// Fires on its own every N ticks, whatever its neighbours do, so it can start
// a new wave regularly (like the heart's natural pacemaker). Give one phone
// this file and the rest cells/basic.js:
//    index.html?cell=cells/pacemaker.js
//
// See cells/basic.js for how cell files work.

registerCell({
  name: 'Pacemaker cell',

  controls: [
    { id: 'beatEvery', type: 'slider', label: 'Fire every N ticks', min: 4, max: 20, value: 8 },
    { id: 'stimulate', type: 'button', label: 'Fire now' }
  ],

  start: function (state, settings) {
    state.ticksLeft = settings.beatEvery;
  },

  step: function (state, input, settings) {
    state.ticksLeft = state.ticksLeft - 1;
    if (state.ticksLeft <= 0 || input.pressed.stimulate) {
      // Waiting at least 4 ticks before the next beat also keeps it refractory.
      state.ticksLeft = settings.beatEvery;
      return { fire: true, color: 'white' };
    }
    return { fire: false, color: 'darkred' };
  }
});
