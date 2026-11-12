const element = id => document.getElementById(id);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const ratios = [3.10, 2.10, 1.51, 1.17, 0.94, 0.76];
const idle = 850;
let mode = 'park';
let running = false;
let starting = false;
let watch;
let audio;
let master;
let exhaust;
let crank;
let filter;
let speed = 0;
let rpm = idle;
let gear = 0;
let lastShift = 0;
let gpsSpeed = 0;
let gpsTime = -Infinity;
let gpsMessage = 'Waiting for GPS';
let motionMessage = 'Waiting for motion samples';
let motionTime = -Infinity;
let axes;
let baseline;
let acceleration = 0;

function onMotion(event) {
  const gravity = event.accelerationIncludingGravity;
  const linear = event.acceleration;
  if (!gravity || !linear || ![gravity.x, gravity.y, gravity.z, linear.x, linear.y, linear.z].every(Number.isFinite)) return;
  const { x, y, z } = gravity;
  const length = Math.hypot(x, y, z);
  if (length < 1) return;
  if (!axes) {
    // Project the phone's inward screen normal onto the horizontal plane.
    const projection = [z * x / length ** 2, z * y / length ** 2, -1 + z ** 2 / length ** 2];
    const norm = Math.hypot(...projection);
    if (norm < 0.35) return;
    axes = projection.map(value => value / norm);
  }
  const forward = axes[0] * linear.x + axes[1] * linear.y + axes[2] * linear.z;
  baseline ??= forward;
  acceleration += 0.28 * (forward - baseline - acceleration);
  motionTime = performance.now();
}

async function enableSensors() {
  const motion = window.DeviceMotionEvent;
  const permission = typeof motion?.requestPermission === 'function'
    ? motion.requestPermission()
    : Promise.resolve(motion ? 'granted' : 'unavailable');
  if (!navigator.geolocation) {
    gpsMessage = 'Location requires HTTPS and a compatible browser';
  } else {
    watch = navigator.geolocation.watchPosition(position => {
      const measured = position.coords.speed;
      if (!Number.isFinite(measured) || measured < 0) {
        gpsMessage = 'Waiting for a GPS speed reading';
        return;
      }
      gpsSpeed = measured;
      gpsMessage = 'Waiting for a fresh GPS fix';
      gpsTime = performance.now();
    }, error => {
      gpsTime = -Infinity;
      gpsMessage = error.code === 1
        ? 'Allow location access and restart the engine'
        : 'GPS temporarily unavailable';
    }, { enableHighAccuracy: true, maximumAge: 0 });
  }
  if (await permission.catch(() => 'denied') === 'granted') {
    window.addEventListener('devicemotion', onMotion);
  } else {
    motionMessage = 'Motion unavailable or permission denied';
  }
}

function createAudio() {
  audio = new AudioContext();
  master = audio.createGain();
  master.gain.value = 0;
  filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.7;
  exhaust = audio.createOscillator();
  exhaust.setPeriodicWave(audio.createPeriodicWave(
    new Float32Array(10),
    new Float32Array([0, 0.56, 0.31, 0.17, 0.88, 0.12, 0.24, 0.09, 0.4, 0.08])
  ));
  crank = audio.createOscillator();
  crank.type = 'triangle';
  const crankLevel = audio.createGain();
  crankLevel.gain.value = 0.18;
  exhaust.connect(filter);
  crank.connect(crankLevel).connect(filter);
  filter.connect(master).connect(audio.destination);
  exhaust.start();
  crank.start();
}

function stop() {
  running = false;
  if (watch !== undefined) navigator.geolocation.clearWatch(watch);
  watch = undefined;
  window.removeEventListener('devicemotion', onMotion);
  master?.gain.setTargetAtTime(0, audio.currentTime, 0.04);
  element('power').textContent = 'Start engine';
  element('status').textContent = 'Engine off';
}

function selectMode(next) {
  stop();
  mode = next;
  element('park').setAttribute('aria-pressed', next === 'park');
  element('drive').setAttribute('aria-pressed', next === 'drive');
  element('simulation').hidden = next !== 'park';
  element('sensors').hidden = next !== 'drive';
}

element('park').onclick = () => { if (!starting && mode !== 'park') selectMode('park'); };
element('drive').onclick = () => { if (!starting && mode !== 'drive') selectMode('drive'); };
element('zero').onclick = () => {
  axes = baseline = undefined;
  acceleration = 0;
  element('sensorStatus').textContent = 'Zeroing motion sensor…';
};

element('power').onclick = async () => {
  if (starting) return;
  if (running) {
    stop();
    return;
  }
  if (mode === 'drive' && !window.isSecureContext) {
    element('status').textContent = 'Open this page over HTTPS on your phone.';
    return;
  }
  starting = true;
  speed = gpsSpeed = acceleration = gear = 0;
  rpm = idle;
  lastShift = -Infinity;
  gpsMessage = 'Waiting for GPS';
  motionMessage = 'Waiting for motion samples';
  gpsTime = motionTime = -Infinity;
  axes = baseline = undefined;
  try {
    if (!audio) createAudio();
    const resume = audio.resume();
    await Promise.all([resume, mode === 'drive' ? enableSensors() : undefined]);
    running = true;
    element('power').textContent = 'Stop engine';
    element('status').textContent = 'Engine on';
  } catch {
    stop();
    element('status').textContent = 'Unable to start audio. Tap Start to retry.';
  } finally {
    starting = false;
  }
};

let lastFrame = performance.now();
let lastDisplay = 0;
function update(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  if (running) {
    let load;
    if (mode === 'park') {
      load = Number(element('pedal').value) / 100;
      speed = clamp(speed + (load * 5 - 0.5 - 0.008 * speed ** 2) * dt, 0, 45);
    } else {
      const motionReady = now - motionTime < 700;
      const gpsReady = now - gpsTime < 3500;
      const forward = motionReady ? acceleration * (element('flip').checked ? -1 : 1) : 0;
      const pull = Math.abs(forward) > 0.13 ? forward : 0;
      load = clamp((pull + 0.08) / 2.7, 0, 1);
      // Predict between fixes and pull the estimate back toward the latest GPS speed.
      speed = gpsReady
        ? clamp(speed + pull * dt + (gpsSpeed - speed) * dt * 1.25, 0, 90)
        : Math.max(0, speed * Math.exp(-2 * dt));
      if (now - lastDisplay > 100) {
        element('sensorStatus').textContent = [
          gpsReady ? 'GPS active' : gpsMessage,
          motionReady ? 'Motion active' : motionMessage
        ].join(' · ');
      }
    }
    const wheelRpm = speed * 60 / 2.08;
    const coupledRpm = wheelRpm * ratios[gear] * 3.27;
    if (now - lastShift > 650) {
      if (coupledRpm > 3000 + 2800 * load && gear < ratios.length - 1) {
        gear++;
        lastShift = now;
      } else if (gear > 0 && coupledRpm < 1350 + 1250 * load) {
        gear--;
        lastShift = now;
      }
    }
    const target = clamp(Math.max(idle + load * 750, wheelRpm * ratios[gear] * 3.27), idle, 6500);
    rpm += (target - rpm) * (1 - Math.exp(-dt * 12));
    const time = audio.currentTime;
    exhaust.frequency.setTargetAtTime(rpm / 60, time, 0.025);
    crank.frequency.setTargetAtTime(rpm / 60 * 2, time, 0.025);
    filter.frequency.setTargetAtTime(175 + rpm * 0.14 + load * 1300, time, 0.035);
    const shiftCut = now - lastShift < 120 ? 0.38 : 1;
    master.gain.setTargetAtTime(Number(element('volume').value) / 100 * (0.10 + load * 0.24) * shiftCut, time, 0.03);
  }
  if (now - lastDisplay > 100) {
    element('rpm').value = Math.round(running ? rpm : idle);
    element('gear').value = running ? gear + 1 : 1;
    element('speed').value = Math.round(running ? speed * 3.6 : 0);
    element('tach').value = running ? rpm : idle;
    lastDisplay = now;
  }
  requestAnimationFrame(update);
}
window.addEventListener('pagehide', stop);
document.addEventListener('visibilitychange', () => { if (document.hidden && running) stop(); });
requestAnimationFrame(update);
