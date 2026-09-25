// Testseite: Ivory-Hintergrund, Debug-Slider für p (Modus „Editor-Frame“).
// Query: ?p=0.5 (fester Frame, statisch) · ?mode=autoplay · ?locale=de · ?w=390 (Breite)
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import RiverBridge from '../src/RiverBridge';
import RiverScene from '../src/RiverScene';

// ?c=bridge → alte 3D-Variante, sonst River Scene (RPM-Referenz)
const Comp: any = new URLSearchParams(window.location.search).get('c') === 'bridge' ? RiverBridge : RiverScene;


const q = new URLSearchParams(window.location.search);
const fixed = q.has('p');

function App() {
  const [p, setP] = useState(Number(q.get('p') ?? 1));
  const extra: Record<string, unknown> = {};
  for (const [k, v] of q) if (!['p', 'static', 'w', 'c'].includes(k)) extra[k] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v;
  if (fixed) {
    return (
      <>
        <Comp previewProgress={p} previewTime={p * 7} style={{ width: '100%', height: '100vh' }} {...extra} />
        {!q.has('shot') && (
          <div id="debug">
            p <input type="range" min={0} max={1} step={0.001} value={p} onChange={(e) => setP(+e.target.value)} /> {p.toFixed(3)}
          </div>
        )}
      </>
    );
  }
  return (
    <>
      <div className="spacer">↓ scrollen</div>
      <Comp style={{ width: '100%' }} {...extra} />
      <div className="spacer">Ende</div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
