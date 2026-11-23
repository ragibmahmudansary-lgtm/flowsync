# Local browser smoke, 2026-11-06

`PORT=4175 npm start` initially received EPERM on loopback. The approved retry
served `http://127.0.0.1:4175/`. Used the in-app browser with real page controls.
The page automatically loaded the bundled demo and solved 17 cases with 160
panels (R1). The badge showed 0.40% lift-slope and 0.69% induced-drag deltas at
zero yaw and 0°/4°.

Changed the rows to 8, spanwise count to 64, and sweep to 0° through 49° at 1°.
Clicking Run showed the named synchronous work limit, Solver error, R1/R2 not
run, and an empty neutral point. Both canvases visibly showed Run VLM to update
and No data.

Restored rows 4, automatic spanwise count and -6° through 10°. Run again solved
17 cases with 160 panels (R1) and reproduced the same badge. Polar curves
returned and the fixed uncertainty claim stayed withheld. The demo still showed
Pitch response unavailable. This checks the budget refusal, clearing and
recovery on the demo. The automated wired Run test separately checks state and
canvas draw calls. Stopped the local server.
