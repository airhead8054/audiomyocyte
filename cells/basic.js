// cells/basic.js – a basic excitable cell
//
// A cell file describes how ONE phone (one cell) behaves. The main program
// (index.html) loads it when the page starts, so you can change how cells
// behave without touching the main program. To use a different file, add it
// to the page address:   index.html?cell=cells/yourfile.js
//
// The file must call registerCell({ ... }) with:
//   name:     shown on the screen
//   controls: sliders and buttons the main program puts on the screen
//               { id, type: 'slider', label, min, max, value }   (step is optional)
//               { id, type: 'button', label }
//   start(state, settings):        called once at the start
//   step(state, input, settings):  called once per tick
//
//   state     this cell's own notebook. Put anything you want to remember
//             between ticks in it, e.g. state.restingIn = 3
//   input     what happened on this tick:
//               input.neighbours         number of neighbour chirps heard
//               input.pressed.<id>       true if that button was pressed since the last tick
//   settings  the current slider values: settings.<id>
//
//   step() returns { fire: true or false, color: 'any CSS colour' }
//     fire:  true = chirp on the NEXT tick
//     color: the screen colour until the next tick
//
// RULE TO KEEP: after deciding to fire, a cell must not fire again on the
// next tick (it must be "refractory"). Otherwise the wave it started comes
// back from its neighbours, re-triggers it, and a wave runs backward. On the
// tick it fires, the main program doesn't listen and passes neighbours = 0.

registerCell({
  name: 'Basic excitable cell',

  controls: [
    { id: 'threshold',  type: 'slider', label: 'Neighbours needed to fire', min: 1, max: 6, value: 2 },
    { id: 'refractory', type: 'slider', label: 'Refractory ticks after firing', min: 2, max: 10, value: 4 },
    { id: 'stimulate',  type: 'button', label: 'Fire now (if ready)' }
  ],

  start: function (state, settings) {
    state.restingIn = 0;   // ticks left until the cell can fire again
  },

  step: function (state, input, settings) {
    // Still recovering from the last firing: ignore everything.
    if (state.restingIn > 0) {
      state.restingIn = state.restingIn - 1;
      return { fire: false, color: 'dimgray' };
    }
    // Ready ("excitable"): fire if enough neighbours fired, or if the button was pressed.
    if (input.neighbours >= settings.threshold || input.pressed.stimulate) {
      state.restingIn = settings.refractory;   // refractory from the moment we decide
      return { fire: true, color: 'white' };
    }
    return { fire: false, color: 'darkgreen' };
  }
});
