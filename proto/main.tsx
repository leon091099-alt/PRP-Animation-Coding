// Testseite: Ivory-Hintergrund, Debug-Slider für p (Modus „Editor-Frame“).
// Query: ?p=0.5 (fester Frame, statisch) · ?mode=autoplay · ?locale=de · ?w=390 (Breite)
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import RiverBridge from '../src/RiverBridge';
import RiverScene from '../src/RiverScene';
// @ts-ignore – JS-Komponente
import RiverFlowBackground from '../src/RiverFlowBackground.jsx';

// ?c=bridge → alte 3D-Variante, sonst River Scene (RPM-Referenz)
const cSel = new URLSearchParams(window.location.search).get('c');
const Comp: any = cSel === 'bridge' ? RiverBridge : RiverScene;


const q = new URLSearchParams(window.location.search);
const fixed = q.has('p');

function BgDemo({ extra }: { extra: Record<string, unknown> }) {
  const deep = extra.theme === 'deep';
  return (
    <section style={{ position: 'relative', height: '100vh', background: deep ? '#102A43' : '#F7F4EE', overflow: 'hidden' }}>
      <RiverFlowBackground style={{ position: 'absolute', inset: 0 }} {...extra} />
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, color: deep ? '#F7F4EE' : '#102A43', fontFamily: 'Georgia, serif' }}>
        <h1 style={{ margin: 0, fontSize: 64, fontWeight: 600, letterSpacing: -1.3 }}>Your local team for Germany.</h1>
        <p style={{ margin: 0, fontFamily: 'system-ui', fontSize: 18, opacity: 0.75 }}>From the Pearl River Delta to the Rhine.</p>
      </div>
    </section>
  );
}

function App() {
  const [p, setP] = useState(Number(q.get('p') ?? 1));
  if (cSel === 'bg') { const ex: Record<string, unknown> = {}; for (const [k, v] of q) if (!['c', 'static', 'shot'].includes(k)) ex[k] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v; return <BgDemo extra={ex} />; }
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
