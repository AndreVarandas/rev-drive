# Rev Drive

A standalone browser prototype with a synthesized cross-plane V8, automatic gear changes, and a dashboard.

## Try it on a computer

From this folder run `python3 -m http.server 8000` and open `http://localhost:8000`. Select **Parked test**, start the engine, and raise the test throttle. Lower it to coast and hear downshifts.

## Try it on a phone

1. Serve this folder from a trusted HTTPS static host. Open the HTTPS link in Safari on iPhone or Chrome on Android. A plain HTTP address on your local network generally cannot access the required sensors.
2. While parked, pair the phone to the car and select Bluetooth as the car's media source. Mount the phone upright, screen facing the cabin and rear camera facing the road.
3. Select **Phone sensors**, tap **Start engine**, and allow motion and location access. Tap **Zero motion** while stationary. Look for **GPS active · Motion active**. Some browsers supply GPS speed only once the vehicle starts moving.
4. Keep the page open in the foreground. If it responds to braking like acceleration, try **Reverse motion direction** the next time you're parked.

Phone acceleration controls engine load and helps predict speed between GPS readings. GPS keeps the virtual gearbox tied to road speed. Bluetooth playback can still introduce lag, depending on the car. Test the in-car response before deciding whether to move playback into the Tesla browser.
