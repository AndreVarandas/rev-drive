let watch: number | undefined;
let gpsSpeed = 0;
let gpsTime = -Infinity;
let gpsMessage = 'Waiting for GPS';
let motionMessage = 'Waiting for motion samples';
let motionTime = -Infinity;
let axes: number[] | undefined;
let baseline: number | undefined;
let acceleration = 0;

function onMotion(event: DeviceMotionEvent) {
  const gravity = event.accelerationIncludingGravity;
  const linear = event.acceleration;
  if (!gravity || !linear) return;
  const { x, y, z } = gravity;
  const { x: ax, y: ay, z: az } = linear;
  if (x === null || y === null || z === null || ax === null || ay === null || az === null) return;
  if (![x, y, z, ax, ay, az].every(Number.isFinite)) return;
  const length = Math.hypot(x, y, z);
  if (length < 1) return;
  if (!axes) {
    // Project the phone's inward screen normal onto the horizontal plane.
    const projection = [z * x / length ** 2, z * y / length ** 2, -1 + z ** 2 / length ** 2];
    const norm = Math.hypot(...projection);
    if (norm < 0.35) return;
    axes = projection.map(value => value / norm);
  }
  const forward = axes[0] * ax + axes[1] * ay + axes[2] * az;
  baseline ??= forward;
  acceleration += 0.28 * (forward - baseline - acceleration);
  motionTime = performance.now();
}

export async function enableSensors() {
  const motion = window.DeviceMotionEvent as (typeof DeviceMotionEvent & {
    requestPermission?: () => Promise<PermissionState>;
  }) | undefined;
  const permission = typeof motion?.requestPermission === 'function'
    ? motion.requestPermission()
    : Promise.resolve(motion ? 'granted' : 'unavailable');
  if (!navigator.geolocation) {
    gpsMessage = 'Location requires HTTPS and a compatible browser';
  } else {
    watch = navigator.geolocation.watchPosition(position => {
      const measured = position.coords.speed;
      if (measured === null || !Number.isFinite(measured) || measured < 0) {
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

export function stopSensors() {
  if (watch !== undefined) navigator.geolocation.clearWatch(watch);
  watch = undefined;
  window.removeEventListener('devicemotion', onMotion);
}

export function zeroMotion() {
  axes = baseline = undefined;
  acceleration = 0;
}

export function resetSensors() {
  gpsSpeed = acceleration = 0;
  gpsMessage = 'Waiting for GPS';
  motionMessage = 'Waiting for motion samples';
  gpsTime = motionTime = -Infinity;
  zeroMotion();
}

export function readSensors(now: number, reverse: boolean) {
  const motionReady = now - motionTime < 700;
  const gpsReady = now - gpsTime < 3500;
  const forward = motionReady ? acceleration * (reverse ? -1 : 1) : 0;
  return {
    gpsReady,
    gpsSpeed,
    forward,
    status: [gpsReady ? 'GPS active' : gpsMessage, motionReady ? 'Motion active' : motionMessage].join(' · ')
  };
}
