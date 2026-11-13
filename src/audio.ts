let context: AudioContext | undefined;
let node: AudioWorkletNode | undefined;
let output: GainNode | undefined;
let intakeLevel: GainNode | undefined;
let exhaustLevel: GainNode | undefined;
let exhaustTone: BiquadFilterNode | undefined;
let exhaustBody: BiquadFilterNode | undefined;
let deepExhaust = false;
let previousLoad = 0;

export function setDeepExhaust(enabled: boolean) {
  deepExhaust = enabled;
}

let loading: Promise<void> | undefined;
let suspendTimer: ReturnType<typeof setTimeout> | undefined;

async function initialize(audio: AudioContext) {
  await audio.audioWorklet.addModule(`${import.meta.env.BASE_URL}vendor/engine-sound-generator/engine-worklet.js`);
  node = new AudioWorkletNode(audio, 'engine-sound-processor', {
    numberOfInputs: 0,
    numberOfOutputs: 3,
    outputChannelCount: [1, 1, 1],
    processorOptions: {
      cylinders: 4,
      intakeWaveguideLength: 100, exhaustWaveguideLength: 100, extractorWaveguideLength: 100,
      intakeOpenReflectionFactor: 0.01, intakeClosedReflectionFactor: 0.95,
      exhaustOpenReflectionFactor: 0.01, exhaustClosedReflectionFactor: 0.95,
      ignitionTime: 0.016, straightPipeWaveguideLength: 128,
      straightPipeReflectionFactor: 0.01, mufflerElementsLength: [10, 15, 20, 25],
      action: 0.1, outletWaveguideLength: 5, outletReflectionFactor: 0.01
    }
  });
  const highpass = audio.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 30;
  highpass.Q.value = 0.5;
  exhaustTone = audio.createBiquadFilter();
  exhaustTone.type = 'lowpass';
  exhaustTone.frequency.value = 6500;
  exhaustTone.Q.value = 0.5;
  exhaustBody = audio.createBiquadFilter();
  exhaustBody.type = 'lowshelf';
  exhaustBody.frequency.value = 180;
  exhaustBody.gain.value = 0;
  const lowpass = audio.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 6500;
  lowpass.Q.value = 0.5;
  const compressor = audio.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.knee.value = 12;
  compressor.ratio.value = 5;
  output = audio.createGain();
  output.gain.value = 0;
  // Upstream exposes intake, engine block and outlet as separate outputs.
  for (const [channel, amount] of [0.06, 0.12, 0.7].entries()) {
    const level = audio.createGain();
    level.gain.value = amount;
    node.connect(level, channel);
    if (channel === 0) intakeLevel = level;
    if (channel === 2) {
      exhaustLevel = level;
      level.connect(exhaustBody).connect(exhaustTone).connect(highpass);
    } else {
      level.connect(highpass);
    }
  }
  highpass.connect(lowpass).connect(compressor).connect(output).connect(audio.destination);
}

export async function startAudio() {
  clearTimeout(suspendTimer);
  context ??= new AudioContext();
  previousLoad = 0;
  const resumed = context.resume();
  loading ??= initialize(context).catch(error => { loading = undefined; throw error; });
  await Promise.all([resumed, loading]);
}

export function updateAudio(rpm: number, load: number, volume: number, timeSinceShift: number, _gear: number) {
  if (!node || !context || !output) return;
  const time = context.currentTime;
  node.parameters.get('rpm')?.setTargetAtTime(Math.max(650, Math.min(6500, rpm)), time, 0.06);
  const throttle = Math.max(0, Math.min(1, load));
  const releasing = throttle < previousLoad;
  // Intake opens promptly; lift-off settles more gently without changing crank pitch.
  const response = releasing ? 0.14 : 0.07;
  node.parameters.get('throttle')?.setTargetAtTime(throttle, time, response);
  intakeLevel?.gain.setTargetAtTime(0.06 + 0.045 * throttle * throttle, time, response);
  const overrun = Math.max(0, Math.min(1, (rpm - 1200) / 1200)) * (1 - throttle);
  exhaustLevel?.gain.setTargetAtTime(0.7 * (1 - overrun * 0.12) * (deepExhaust ? 0.9 : 1), time, 0.14);
  exhaustTone?.frequency.setTargetAtTime((deepExhaust ? 3800 : 6500) - overrun * (deepExhaust ? 1200 : 2200), time, 0.16);
  exhaustBody?.gain.setTargetAtTime(deepExhaust ? 2.5 : 0, time, 0.16);
  previousLoad = throttle;
  const shift = timeSinceShift < 100 ? 0.7 : 1;
  output.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)) * 0.2 * shift, time, 0.025);
}

export function silenceAudio() {
  if (!context || !output) return;
  output.gain.setTargetAtTime(0, context.currentTime, 0.02);
  clearTimeout(suspendTimer);
  suspendTimer = setTimeout(() => { void context?.suspend(); }, 200);
}
