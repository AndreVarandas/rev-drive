# Repository Guidelines

## Project Structure

Rev Drive is a standalone browser prototype for a synthesized cross-plane V8 and an automatic gearbox.

- `index.html` contains the dashboard markup. `src/dashboard.css` handles layout, typography, and motion.
- `src/main.ts` connects dashboard controls to `src/audio.ts` for synthesis, `src/sensors.ts` for motion and GPS, and `src/simulation.ts` for speed, RPM, and gear calculations. Keep browser APIs out of the simulation.
- `README.md` documents desktop and phone setup. The repository has no separate asset or test directories.

## Local Development

- Run `npm ci` to install the locked dependencies and `npm run dev` to start Vite with live updates. Open the URL it prints.
- Run `npm run typecheck` to check strict TypeScript. Run `npm run build` to type-check and produce `dist/`, then `npm run preview` to serve that build locally.
- Serve `dist/` over HTTPS for phone sensor testing. Follow the mounting, permissions, and calibration steps in the README.

## Coding Style

Use two-space indentation, camelCase names, single-quoted TypeScript strings, and statement-ending semicolons in TypeScript modules. Keep HTML control IDs in sync with JavaScript lookups. Use native browser APIs and keep permission requests and audio startup tied to the **Start engine** interaction. No formatter or linter is configured.

## Motion and Feedback

Use short transitions to clarify state changes and respect `prefers-reduced-motion`. Prefer transform and opacity for animated elements. Keep per-frame simulation and audio updates separate from dashboard refreshes, and stop the frame loop when the engine stops. Check responsiveness with keyboard input and on a phone when changing the interface.

## Testing

Verification is manual. There is no automated test framework or coverage threshold.

- In **Parked test**, start the engine, raise the throttle until it upshifts, then release it and check that it coasts and downshifts. Check the RPM, gear, speed, and volume controls, then stop the engine and confirm the audio stops.
- For sensor changes, check phone behavior over HTTPS. While parked, verify permission handling and zero motion. Record the device and browser used, and check for **GPS active · Motion active** once valid readings arrive.

## Commits and Pull Requests

Use a short, imperative commit subject, following the initial commit, `Build initial Rev Drive prototype`. In pull requests, describe the behavior changed, link any relevant issue, and list the checks you ran. Include a screenshot for dashboard changes and device and browser details for sensor or audio changes.
