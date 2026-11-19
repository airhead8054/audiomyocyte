// chirp_worklet.js  (v2.5)
//
// This file runs on the AUDIO THREAD, not on the page. The page loads it with
//    audioContext.audioWorklet.addModule('chirp_worklet.js')
//
// It does only two simple jobs, each at an exact sample position ("frame"):
//   playAt:   copy a stored sound into the speaker output, starting at a frame
//   recordAt: copy the microphone input into a buffer, starting at a frame,
//             and send the buffer to the page once it is full
// Every decision (when to chirp, when to listen, what was heard) is made on
// the page, in index.html. Compared with v2 there are no tick numbers here:
// the page works out the frames itself.
//
// HOW TIME WORKS HERE
// The audio system counts "frames" (one sample per channel). At 48000 frames
// per second one frame is about 0.02 ms. The built-in variable currentFrame
// is the frame number of the first sample in the block process() is handling.
// Playing and recording both use this one counter, so they can never
// disagree about time. This counter is the master clock of the whole app.
//
// PITFALL: frames count AUDIO PRODUCED, not time passed. If the audio pauses
// (a phone call, Siri, locking the screen, iOS changing its audio set-up) the
// counter stops while real time goes on. The page only notices when the next
// instructor chirp turns up somewhere unexpected.
//
// MESSAGES FROM THE PAGE
//    { type: 'waveform', name: 'student', samples: Float32Array }   store a sound
//    { type: 'playAt', frame: 1234567, name: 'student', gain: 0.8 }   play it at a frame
//    { type: 'recordAt', id: 7, frame: 1234567, length: 4800 }        record from a frame
//
// MESSAGES TO THE PAGE
//    { type: 'recording', id: 7, startFrame: 1234567, samples: Float32Array }
//    { type: 'tooLate', what: 'play' or 'record', id: 7, frame: 1234567 }
//        the frame had already passed when the message arrived, so nothing was done

class ChirpWorklet extends AudioWorkletProcessor {
  constructor() {
    super(); // required first line in a class that "extends" another class

    this.waveforms = {};   // stored sounds: this.waveforms['student'] is a Float32Array
    this.plays = [];       // sounds waiting or playing: { frame, name, gain }
    this.recordings = [];  // recordings waiting or filling: { id, frame, samples }

    // Listen for messages from the page. "this" means something else inside
    // a plain function, so we keep a copy of it in "self".
    const self = this;
    this.port.onmessage = function (event) {
      self.handleMessage(event.data);
    };
  }

  handleMessage(msg) {
    if (msg.type === 'waveform') {
      this.waveforms[msg.name] = msg.samples;
    } else if (msg.type === 'playAt') {
      if (msg.frame < currentFrame) {
        // Never play a chirp with its start cut off: a half chirp at the
        // wrong time is worse than no chirp.
        this.port.postMessage({ type: 'tooLate', what: 'play', frame: msg.frame });
        return;
      }
      this.plays.push({ frame: msg.frame, name: msg.name, gain: msg.gain });
    } else if (msg.type === 'recordAt') {
      if (msg.frame < currentFrame) {
        this.port.postMessage({ type: 'tooLate', what: 'record', id: msg.id, frame: msg.frame });
        return;
      }
      this.recordings.push({ id: msg.id, frame: msg.frame, samples: new Float32Array(msg.length) });
    }
  }

  // Called by the audio system for every block of (normally) 128 frames.
  process(inputs, outputs) {
    const output = outputs[0];
    if (output.length > 0) {
      this.playSounds(output[0]);
      for (let c = 1; c < output.length; c++) {
        output[c].set(output[0]); // copy to any other speaker channels
      }
    }
    const input = inputs[0];
    // PITFALL: with no microphone connected there are no input channels, and
    // recordings never finish. The instructor page does not record, so this is fine there.
    if (input && input.length > 0) {
      this.recordSounds(input[0]);
    }
    return true; // true = "keep calling me"
  }

  // ---- PLAY ----
  playSounds(speaker) {
    const blockStart = currentFrame;           // frame number of speaker[0]
    const blockEnd = blockStart + speaker.length;
    const stillWaiting = [];

    for (let p = 0; p < this.plays.length; p++) {
      const item = this.plays[p];
      const wave = this.waveforms[item.name];
      if (!wave) {
        continue; // unknown sound name: drop it
      }
      if (item.frame >= blockEnd) {
        stillWaiting.push(item); // starts in a later block
        continue;
      }
      // The output starts as silence (zeros). We ADD the sound into it.
      for (let i = 0; i < speaker.length; i++) {
        const k = blockStart + i - item.frame; // position inside the sound
        if (k >= 0 && k < wave.length) {
          speaker[i] = speaker[i] + wave[k] * item.gain;
        }
      }
      if (item.frame + wave.length > blockEnd) {
        stillWaiting.push(item); // not finished: the rest plays in the next block
      }
    }
    this.plays = stillWaiting;
  }

  // ---- RECORD ----
  recordSounds(mic) {
    const blockStart = currentFrame;           // frame number of mic[0]
    const blockEnd = blockStart + mic.length;
    const stillWaiting = [];

    for (let r = 0; r < this.recordings.length; r++) {
      const rec = this.recordings[r];
      if (rec.frame >= blockEnd) {
        stillWaiting.push(rec); // starts in a later block
        continue;
      }
      for (let i = 0; i < mic.length; i++) {
        const k = blockStart + i - rec.frame; // position inside the recording
        if (k >= 0 && k < rec.samples.length) {
          rec.samples[k] = mic[i];
        }
      }
      if (rec.frame + rec.samples.length <= blockEnd) {
        // Full. postMessage sends a COPY of the samples to the page.
        this.port.postMessage({ type: 'recording', id: rec.id, startFrame: rec.frame, samples: rec.samples });
      } else {
        stillWaiting.push(rec);
      }
    }
    this.recordings = stillWaiting;
  }
}

registerProcessor('chirp-worklet', ChirpWorklet);
