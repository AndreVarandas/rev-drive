# Rev Drive

A standalone browser prototype with a physically informed four-cylinder engine sound, automatic gear changes, and a dashboard.

## Try it on a computer

Use a Node.js version supported by Vite (20.19+, 22.12+, or a newer supported release). From this folder, run `npm ci` and `npm run dev`, then open the URL Vite prints. Select **Parked test**, start the engine, and raise the test throttle. Lower it to coast and hear downshifts.

## Try it on a phone

1. Run `npm run build` and serve the contents of `dist/` from a trusted HTTPS static host. Open the HTTPS link in Safari on iPhone or Chrome on Android. A plain HTTP address on your local network generally cannot access the required sensors.
2. While parked, pair the phone to the car and select Bluetooth as the car's media source. Mount the phone upright, screen facing the cabin and rear camera facing the road.
3. Select **Phone sensors**, tap **Start engine**, and allow motion and location access. Tap **Zero motion** while stationary. Look for **GPS active · Motion active**. Some browsers supply GPS speed only once the vehicle starts moving.
4. Keep the page open in the foreground. If it responds to braking like acceleration, try **Reverse motion direction** the next time you're parked.

Phone acceleration controls engine load and helps predict speed between GPS readings. GPS keeps the virtual gearbox tied to road speed. Bluetooth playback can still introduce lag, depending on the car. Test the in-car response before deciding whether to move playback into the Tesla browser.

## Engine sound

The app uses one acoustic engine, adapted from Antonio-R1/engine-sound-generator under MIT. The source revision and local modifications are recorded in `public/vendor/engine-sound-generator/UPSTREAM.txt`; its license ships with the app and is linked from the dashboard.

The model generates cylinder excitation and propagates it through intake, exhaust and muffler waveguides in an AudioWorklet. It retains the upstream four-cylinder example configuration, with sample-rate-scaled acoustic delays, fixed crank phase and throttle-dependent combustion/intake excitation. The sound approved in listening feedback is the baseline; cleanup did not change its DSP or mix. Subsequent refinements add load-dependent intake presence and gentler, quieter lift-off above idle. The default Standard exhaust retains the original idle mix. The Deeper setting applies modest low-frequency emphasis and high-frequency damping to the same exhaust output, with gain compensation; it does not alter cylinder timing or pipe geometry. Switch it live using Exhaust tone on the dashboard.

Previous synths, recording experiments, the audition page, sample-preparation scripts and voice selector have been removed. Audio starts only from Start engine; stopping fades output and suspends its context.

## Display and validation

The landscape cockpit adapts to phone widths. Parked-test speed is simulated; phone mode estimates speed from sensors. The app does not read Tesla telemetry or relay phone sensor data to another browser. Actual Tesla playback and physical-phone sensor validation remain outstanding.

Run `npm run build` for strict TypeScript and a production bundle. Manually check idle, acceleration/upshift, release/downshift, volume/mute, stop and restart in Parked test. See AGENTS.md for sensor verification. Historical architecture research is retained in `docs/engine-audio-research.md`.
