import { startAudio, silenceAudio, updateAudio, setDeepExhaust } from './audio.js';
import { enableSensors, readSensors, resetSensors, stopSensors, zeroMotion } from './sensors.js';
import { idle, resetSimulation, stepSimulation } from './simulation.js';

function requireElement<T extends HTMLElement>(id: string, type: { new(): T }): T {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error(`Missing or invalid dashboard element: ${id}`);
  return node;
}

const controls = {
  park: requireElement('park', HTMLButtonElement),
  drive: requireElement('drive', HTMLButtonElement),
  zero: requireElement('zero', HTMLButtonElement),
  power: requireElement('power', HTMLButtonElement),
  powerLabel: requireElement('power-label', HTMLElement),
  pedal: requireElement('pedal', HTMLInputElement),
  volume: requireElement('volume', HTMLInputElement),
  flip: requireElement('flip', HTMLInputElement),
  rpm: requireElement('rpm', HTMLOutputElement),
  speed: requireElement('speed', HTMLOutputElement),
  speedSource: requireElement('speed-source', HTMLElement),
  gear: requireElement('gear', HTMLOutputElement),
  tachFill: requireElement('tach-fill', HTMLElement),
  tachTrack: requireElement('tach-track', HTMLElement),
  status: requireElement('status', HTMLElement),
  sensorStatus: requireElement('sensorStatus', HTMLElement),
  simulation: requireElement('simulation', HTMLElement),
  sensors: requireElement('sensors', HTMLElement)
};

type Mode = 'park' | 'drive';
let mode: Mode = 'park';
let running = false;
let starting = false;
const motionPreference = window.matchMedia('(prefers-reduced-motion: no-preference)');
function stop() {
  running = false;
  stopSensors();
  silenceAudio();
  controls.powerLabel.textContent = 'Start engine';
  controls.power.removeAttribute('data-running');
  controls.status.textContent = 'Engine off';
  controls.status.removeAttribute('data-running');
  cancelAnimationFrame(frame);
  render(idle, 0, 0);
  positionNeedle(idle);
}

function selectMode(next: Mode) {
  stop();
  mode = next;
  document.querySelector('.dashboard')?.setAttribute('data-mode', next);
  controls.speedSource.textContent = next === 'park' ? 'Simulated' : 'Sensor estimate';
  controls.park.setAttribute('aria-pressed', String(next === 'park'));
  controls.drive.setAttribute('aria-pressed', String(next === 'drive'));
  controls.simulation.hidden = next !== 'park';
  controls.sensors.hidden = next !== 'drive';
  if (motionPreference.matches) {
    const panel = next === 'park' ? controls.simulation : controls.sensors;
    panel.getAnimations().forEach(animation => animation.cancel());
    panel.animate(
      [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 220, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' }
    );
  }
}

requireElement('exhaust-tone', HTMLSelectElement).onchange = event => {
  setDeepExhaust((event.currentTarget as HTMLSelectElement).value === 'deep');
};

controls.park.onclick = () => { if (!starting && mode !== 'park') selectMode('park'); };
controls.drive.onclick = () => { if (!starting && mode !== 'drive') selectMode('drive'); };
controls.zero.onclick = () => {
  zeroMotion();
  controls.sensorStatus.textContent = 'Zeroing motion sensor…';
};

controls.power.onclick = async () => {
  if (starting) return;
  if (running) {
    stop();
    return;
  }
  if (mode === 'drive' && !window.isSecureContext) {
    controls.status.textContent = 'Open this page over HTTPS on your phone.';
    return;
  }
  starting = true;
  controls.power.setAttribute('aria-busy', 'true');
  resetSimulation();
  resetSensors();
  try {
    const resume = startAudio();
    await Promise.all([resume, mode === 'drive' ? enableSensors() : undefined]);
    if (document.hidden) {
      stop();
      return;
    }
    running = true;
    lastFrame = performance.now();
    lastDisplay = -Infinity;
    frame = requestAnimationFrame(update);
    controls.powerLabel.textContent = 'Stop engine';
    controls.power.setAttribute('data-running', '');
    controls.status.textContent = 'Engine on';
    controls.status.setAttribute('data-running', '');
  } catch {
    stop();
    controls.status.textContent = 'Unable to load or start engine audio. Check your connection and tap Start to retry.';
  } finally {
    starting = false;
    controls.power.removeAttribute('aria-busy');
  }
};

let frame = 0;
let lastFrame = 0;
let lastDisplay = 0;

function render(rpm: number, speed: number, gear: number) {
  controls.rpm.value = Math.round(rpm).toLocaleString('en-US');
  const gearText = String(gear + 1);
  if (controls.gear.value !== gearText) {
    controls.gear.value = gearText;
    if (running && motionPreference.matches) {
      controls.gear.animate(
        [{ opacity: 0.45, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 180, easing: 'ease-out' }
      );
    }
  }
  controls.speed.value = String(Math.round(speed * 3.6));
  controls.tachTrack.setAttribute('aria-valuenow', String(Math.round(rpm)));
}

function positionNeedle(rpm: number) {
  controls.tachFill.style.transform = `rotate(${-135 + rpm / 6500 * 270}deg)`;
}

function update(now: number) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  const sensors = mode === 'drive' ? readSensors(now, controls.flip.checked) : undefined;
  const { rpm, speed, gear, load, timeSinceShift } =
    stepSimulation(now, dt, Number(controls.pedal.value) / 100, sensors);
  updateAudio(rpm, load, Number(controls.volume.value) / 100, timeSinceShift, gear);
  positionNeedle(rpm);

  if (now - lastDisplay > 100) {
    render(rpm, speed, gear);
    if (sensors && controls.sensorStatus.textContent !== sensors.status) {
      controls.sensorStatus.textContent = sensors.status;
    }
    lastDisplay = now;
  }
  frame = requestAnimationFrame(update);
}

window.addEventListener('pagehide', stop);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && running) stop();
});

for (const input of [controls.pedal, controls.volume]) {
  const output = requireElement(`${input.id}-value`, HTMLOutputElement);
  const updateValue = () => {
    output.value = `${input.value}%`;
    input.style.setProperty('--level', output.value);
  };
  input.addEventListener('input', updateValue);
  updateValue();
}

const tachScale = controls.tachTrack.querySelector('.tach-scale');
for (let mark = 0; mark <= 6; mark++) {
  const angle = (-135 + mark / 6.5 * 270) * Math.PI / 180;
  const label = document.createElement('span');
  label.textContent = String(mark);
  label.style.left = `${50 + Math.sin(angle) * 39}%`;
  label.style.top = `${50 - Math.cos(angle) * 39}%`;
  tachScale?.append(label);
}
