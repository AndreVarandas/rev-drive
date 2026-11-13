import { clamp } from './math.js';

const ratios = [3.10, 2.10, 1.51, 1.17, 0.94, 0.76];
export const idle = 850;
let rpm = idle;
let gear = 0;
let lastShift = 0;
let speed = 0;
let demand = 0;

export function resetSimulation() {
  speed = gear = demand = 0;
  rpm = idle;
  lastShift = -Infinity;
}

interface SensorInput {
  forward: number;
  gpsReady: boolean;
  gpsSpeed: number;
}

export function stepSimulation(now: number, dt: number, throttle: number, sensors?: SensorInput) {
  let load;
  if (sensors) {
    const { forward, gpsReady, gpsSpeed } = sensors;
    const pull = Math.abs(forward) > 0.13 ? forward : 0;
    load = clamp((pull + 0.08) / 2.7, 0, 1);
    // Predict between fixes and pull the estimate back toward the latest GPS speed.
    speed = gpsReady
      ? clamp(speed + pull * dt + (gpsSpeed - speed) * dt * 1.25, 0, 90)
      : Math.max(0, speed * Math.exp(-2 * dt));
  } else {
    load = throttle;
    speed = clamp(speed + (load * 5 - 0.5 - 0.008 * speed ** 2) * dt, 0, 45);
  }
  const wheelRpm = speed * 60 / 2.08;
  const coupledRpm = wheelRpm * ratios[gear] * 3.27;
  // Respond immediately to pedal changes and damp noise from phone motion.
  const previousDemand = demand;
  demand += (load - demand) * (1 - Math.exp(-dt * (sensors ? 9 : 20)));
  const shiftDemand = clamp(demand + (demand - previousDemand) * 2, 0, 1);
  const upshiftRpm = 1700 + 4000 * shiftDemand ** 1.5;
  const downshiftRpm = 1050 + 1950 * shiftDemand;
  if (now - lastShift >= 260) {
    if (coupledRpm >= upshiftRpm && gear < ratios.length - 1) {
      gear++;
      lastShift = now;
    } else if (gear > 0 && coupledRpm <= downshiftRpm) {
      const lowerGearRpm = wheelRpm * ratios[gear - 1] * 3.27;
      // Leave enough room for acceleration before the next upshift.
      if (lowerGearRpm < upshiftRpm - 250) {
        gear--;
        lastShift = now;
      }
    }
  }
  const target = clamp(Math.max(idle + load * 750, wheelRpm * ratios[gear] * 3.27), idle, 6500);
  rpm += (target - rpm) * (1 - Math.exp(-dt * 12));
  return { rpm, speed, gear, load, timeSinceShift: now - lastShift };
}
