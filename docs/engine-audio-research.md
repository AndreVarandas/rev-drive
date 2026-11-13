# Engine audio research — 2026-11-13

Historical investigation: the user subsequently preferred the acoustic engine. It is now the sole implementation in `src/audio.ts`; references below to earlier experimental files describe removed prototypes.

## Decision

For maximum realism, pursue engine-cycle-aware granular playback of a coherent recording set, with genuine steady-state loops for idle/cruise and separate on-load/off-load material. This is not arbitrary random grains or looping half-second acceleration excerpts. Source preparation and pitch/cycle analysis are core engineering work, not incidental preprocessing.

For the current free-assets constraint, do not force the existing disparate Freesound recordings into that model. First assess an existing open-source physically informed engine as a baseline. If it sounds acceptable, adapt its acoustic engine; if not, acquire a coherent free recording session for the granular route. Neither route has been listening-approved, and source inspection is not proof of realism.

## What the app currently does

- `src/audio-legacy.ts`: repeating hand-shaped cylinder-bank waveforms, a triangle oscillator, filters and noise bursts. This is not a physical exhaust model.
- `src/audio.ts`: short acceleration-derived loops with estimated RPM anchors, plus a separate idle recording. The preparation uses estimated pitch-search bounds. Recent changes reduce envelope variation and avoid sustained blending, but do not establish accurate cycle tracking or recording consistency.
- `src/audio-warm.ts`: a single periodic oscillator with fixed harmonic coefficients, low-pass/high-pass filtering and one peaking filter. Stable amplitude does not establish realistic timbre; the last audition removed variation without supplying missing engine acoustics.

## Evidence

1. Mike Caviezel's practitioner guide explains two distinct source pipelines: steady RPM loops versus approximately ten-second acceleration/deceleration ramps. For ramps, prefer an uninterrupted single-gear sweep, paired with closed-throttle deceleration. Engine, exhaust and intake perspectives have different roles. The guide suggests denser RPM coverage than our four loaded bands.
   https://www.boomlibrary.com/blog/the-car-engine-sound-primer-mike-caviezel/

2. Crankcase Audio's REV documentation describes spectral analysis and engine-cycle tracking, not merely randomly overlapping snippets. The full model includes acceleration, deceleration, idle and pops. Its published runtime is C++/C# with middleware integration; do not assume it is a ready-made browser package or free software.
   https://www.crankcaseaudio.com/faq

3. FMOD's forum addresses a close analogue to our failed attempt: dynamically repeating regions of a rising-RPM recording. A staff response explains why pitch jumps remain conspicuous and more involved crossfading/granular synthesis is needed. That discussion's FMOD feature limitations are from 2022, not a claim about today's API.
   https://qa.fmod.com/t/non-loop-car-sounds/19402

4. Reddit practitioners warn that granular engines can sound synthetic when held at fixed RPM. One describes blending toward real steady loops as RPM change slows. This is useful firsthand workflow evidence, not a controlled comparison or proof of universal superiority.
   https://www.reddit.com/r/GameAudio/comments/18oqcnl/crossfading_a_lot_of_sounds/

5. A separate Reddit discussion stresses source quality and vehicle behavior, distinguishing a purpose-built vehicle system from general granular software. Its claims are practitioner reports, not independently verified project credits.
   https://www.reddit.com/r/GameAudio/comments/1t77mxe/wwise_rev2_vs_soundseed_grain/

6. Antonio-R1's MIT-licensed engine-sound-generator provides a materially richer procedural starting point: cylinders with valve envelopes, intake/exhaust waveguides, pipe reflections and muffler paths. Its worklet outputs intake, block and outlet separately. Its README offers both JS AudioWorklet and C++/WASM versions.
   https://github.com/Antonio-R1/engine-sound-generator
   Source inspected: src/engine_sound_generator/engine_sound_generator_worklet.js
   Caveats from code inspection: the JS worklet reads `throttle` but does not apply it inside `_updateSample`; it also injects random crank phase offsets. It is a candidate to evaluate/adapt, not a drop-in finished solution. Review sample-rate scaling, real load response, phase stability and real-time cost before use.

7. Ange Yaghi's Engine Simulator is a more substantial combustion/sound simulator and useful reference, but integrating its full native simulator into this small browser app would be a separate porting/performance project.
   https://github.com/ange-yaghi/engine-sim
   https://github.com/ange-yaghi/engine-sim/blob/master/src/synthesizer.cpp

8. AudioWorklet supports custom DSP on the Web Audio rendering thread. WASM is an implementation option, not a sound-quality improvement by itself. Current built-in Web Audio nodes already render off the UI thread; moving our unchanged oscillator into a worklet would not fix its tone.
   https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet
   https://emscripten.org/docs/api_reference/wasm_audio_worklets.html

## Proposed implementation

- Offline: choose a single coherent session; mark gear changes, reject wind/speech/clipping; estimate RPM and cycle phase with confidence scoring, manually review octave errors. Keep only usable intervals. Prepare idle and sustained sections separately from ramps. Preserve source attribution.
- Runtime: an AudioWorklet reads an RPM/phase-indexed grain map, schedules cycle-aligned overlapping grains, and applies only modest residual pitch correction. Idle/cruise favors steady recordings; acceleration favors ramps. Load selects recorded on/off-throttle character, not only a low-pass filter.
- Simulation: supply smooth RPM, load and rate of RPM change. Decouple audio-rate processing from dashboard refresh. Treat gear shifts as load/clutch/RPM events; add one-shots only after the core sound passes listening evaluation.
- Physical-model alternative: adapt the existing waveguide core and independently control exhaust, intake and block levels. Scale acoustic delay lengths to sample rate, use damping/anti-aliasing, remove objectionable slow random phase motion, implement actual load response. Benchmark the upstream model before modifications.
- Do not use neural generation as the main next step: none of the reviewed material establishes a low-latency, controllable, Tesla-ready solution that removes our data or perceptual-validation requirements.

## Acceptance criteria

Use matched perceived loudness for comparisons, not identical slider percentages. A louder candidate must not win by default. Compare against a real source and prior versions using fixed idle, a ten-second steady RPM hold, gentle sweep, loaded acceleration, lift-off and one shift. Listen for beating, loop rhythm, pitch jumps, metallic buzz and pumping. Check continuous 44.1/48 kHz output, clipping, CPU glitches, stop/mute and restart. Actual Tesla speaker/foreground testing is required before asserting compatibility or quality.

## Research limits

Searched Reddit, FMOD forums, X/Twitter-indexed results, vendor documentation, practitioner articles and open-source implementations. X-targeted searches returned no sufficiently relevant inspectable primary post; no conclusion is attributed to X. Some Audiokinetic/PDF pages were blocked, so accessible primary references were used instead. No subjective audio audition was performed by the assistant during this research. No app sound was changed during this investigation.
