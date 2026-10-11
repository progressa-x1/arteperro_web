'use client';
import { useEffect, useMemo, useState } from 'react';
import { PRODUCTOS, EXTRAS, ENTREGA, TEMPORADA, precioDe } from '@/lib/config';

type Dia = { fecha: string; libres: number };
const fmt = (n: number) => '$' + n.toLocaleString('es-MX');
const PASOS = ['Pieza', 'Día', 'Tu mascota', 'Pagar'];
const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

async function comprimir(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const max = 1800;
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob((b) => r(b || file), 'image/jpeg', 0.86));
  } catch {
    return file;
  }
}

export default function Apartar() {
  const [paso, setPaso] = useState(0);
  const [producto, setProducto] = useState('funda');
  const [opcion, setOpcion] = useState('');
  const [extras, setExtras] = useState<string[]>([]);
  const [dias, setDias] = useState<Dia[] | null>(null);
  const [fecha, setFecha] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [datos, setDatos] = useState({ nombre: '', telefono: '', email: '', mascota: '', especificaciones: '', entrega: 'recoger' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const cargarDias = () => fetch('/api/disponibilidad', { cache: 'no-store' }).then((r) => r.json()).then(setDias).catch(() => setDias([]));
  useEffect(() => { cargarDias(); }, []);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [paso]);

  const prod = PRODUCTOS.find((p) => p.id === producto)!;
  const precio = useMemo(() => precioDe(producto, opcion, extras), [producto, opcion, extras]);

  const meses = useMemo(() => {
    if (!dias) return [];
    const map = new Map(dias.map((d) => [d.fecha, d.libres]));
    const out: { titulo: string; celdas: ({ fecha: string; dia: number; libres: number | null } | null)[] }[] = [];
    const ini = new Date(TEMPORADA.inicio + 'T12:00:00Z');
    const fin = new Date(TEMPORADA.fin + 'T12:00:00Z');
    let cur = new Date(Date.UTC(ini.getUTCFullYear(), ini.getUTCMonth(), 1, 12));
    while (cur <= fin) {
      const y = cur.getUTCFullYear(), m = cur.getUTCMonth();
      const t0 = cur.toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      const titulo = t0.charAt(0).toUpperCase() + t0.slice(1);
      const offset = (cur.getUTCDay() + 6) % 7;
      const celdas: any[] = Array(offset).fill(null);
      const nDias = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      for (let d = 1; d <= nDias; d++) {
        const iso0 = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (iso0 > TEMPORADA.fin) break;
        const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (iso < TEMPORADA.inicio || iso > TEMPORADA.fin) celdas.push({ fecha: iso, dia: d, libres: null });
        else celdas.push({ fecha: iso, dia: d, libres: map.has(iso) ? map.get(iso)! : null });
      }
      out.push({ titulo, celdas });
      cur = new Date(Date.UTC(y, m + 1, 1, 12));
    }
    return out;
  }, [dias]);

  const f0 = fecha ? new Date(fecha + 'T12:00:00Z').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : '';
  const fechaTxt = f0.charAt(0).toUpperCase() + f0.slice(1);

  const puede = [
    !!precio,
    !!fecha,
    !!foto && datos.nombre.trim() && datos.telefono.replace(/\D/g, '').length >= 10 && datos.mascota.trim(),
    true,
  ];

  async function pagar() {
    if (!precio || !foto) return;
    setEnviando(true);
    setError('');
    const fd = new FormData();
    fd.set('producto', producto);
    fd.set('opcion', opcion);
    extras.forEach((e) => fd.append('extras', e));
    fd.set('fecha', fecha);
    Object.entries(datos).forEach(([k, v]) => fd.set(k, v));
    fd.set('foto', new File([await comprimir(foto)], 'mascota.jpg', { type: 'image/jpeg' }));
    try {
      const r = await fetch('/api/pedido', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || 'Algo salió mal.');
        if (r.status === 409) { setFecha(''); setPaso(1); cargarDias(); }
        setEnviando(false);
        return;
      }
      window.location.href = j.url;
    } catch {
      setError('Sin conexión. Intenta de nuevo.');
      setEnviando(false);
    }
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr)', gap: 32 }}>
      <div className="pasos" style={{ marginTop: 16 }}>
        {PASOS.map((p, i) => (
          <button key={p} className={'paso' + (i === paso ? ' on' : '')} style={{ border: 0, cursor: i < paso ? 'pointer' : 'default' }} onClick={() => i < paso && setPaso(i)}>
            {i + 1}. {p}
          </button>
        ))}
      </div>

      <div className="layout-pedido">
        <div style={{ minWidth: 0 }}>
          {paso === 0 && (
            <div>
              <h3>¿Qué quieres que pintemos?</h3>
              <div className="grid" style={{ gap: 10 }}>
                {PRODUCTOS.filter((p) => p.disponible).map((p) => (
                  <label key={p.id} className={'opt' + (producto === p.id ? ' on' : '')}>
                    <span><strong>{p.nombre}</strong><br /><span className="muted" style={{ fontSize: '.9rem' }}>{p.descripcion}</span></span>
                    <input type="radio" name="p" checked={producto === p.id} onChange={() => { setProducto(p.id); setOpcion(''); }} />
                  </label>
                ))}
              </div>
              <label className="f">{prod.opcionLabel}</label>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
                {prod.opciones.map((o) => (
                  <label key={o.id} className={'opt' + (opcion === o.id ? ' on' : '')}>
                    <span>{o.nombre}<br /><strong>{fmt(o.precio)}</strong></span>
                    <input type="radio" name="o" checked={opcion === o.id} onChange={() => setOpcion(o.id)} />
                  </label>
                ))}
              </div>
              <label className="f">Extras (opcional)</label>
              <div className="grid" style={{ gap: 10 }}>
                {EXTRAS.map((e) => (
                  <label key={e.id} className={'opt' + (extras.includes(e.id) ? ' on' : '')}>
                    <span>{e.nombre} <strong>+{fmt(e.precio)}</strong><br /><span className="muted" style={{ fontSize: '.88rem' }}>{e.detalle}</span></span>
                    <input type="checkbox" checked={extras.includes(e.id)} onChange={(ev) => setExtras(ev.target.checked ? [...extras, e.id] : extras.filter((x) => x !== e.id))} />
                  </label>
                ))}
              </div>
            </div>
          )}

          {paso === 1 && (
            <div>
              <h3>Elige el día de tu retrato</h3>
              <p className="muted">Pintamos solo {TEMPORADA.cupoPorDia} retratos por día, de lunes a viernes. Te avisamos por WhatsApp cuando esté listo.</p>
              {!dias && <p>Cargando agenda…</p>}
              {dias && dias.every((d) => d.libres === 0) && <div className="err">La temporada está llena. Escríbenos por WhatsApp para lista de espera.</div>}
              {meses.map((m) => (
                <div className="cal-mes" key={m.titulo}>
                  <h4>{m.titulo}</h4>
                  <div className="cal">
                    {DOW.map((d, i) => <div className="dow" key={i}>{d}</div>)}
                    {m.celdas.map((c, i) =>
                      !c ? <div key={i} className="dia vacio" /> : (
                        <button
                          key={c.fecha}
                          className={'dia' + (fecha === c.fecha ? ' sel' : '') + (c.libres === 1 ? ' pocos' : '')}
                          disabled={!c.libres}
                          onClick={() => setFecha(c.fecha)}
                          title={c.libres ? `${c.libres} lugares` : 'No disponible'}
                        >
                          {c.dia}
                          <small>{c.libres == null ? '' : c.libres === 0 ? 'lleno' : c.libres === 1 ? 'último' : `${c.libres} lug.`}</small>
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {paso === 2 && (
            <div>
              <h3>Cuéntanos de tu mascota</h3>
              <label className="f">Foto de tu mascota *</label>
              <label className="opt" style={{ flexDirection: 'column', alignItems: 'stretch', textAlign: 'center', borderStyle: 'dashed', padding: 20 }}>
                {preview ? <img src={preview} alt="" style={{ maxHeight: 260, objectFit: 'contain', margin: '0 auto', borderRadius: 8 }} /> : <span>📷 Toca para subir una foto clara, con buena luz</span>}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFoto(f); setPreview(URL.createObjectURL(f)); } }} />
                {preview && <span className="muted" style={{ fontSize: '.85rem', marginTop: 8 }}>Toca para cambiarla</span>}
              </label>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '0 16px' }}>
                <div><label className="f">Nombre de tu mascota *</label><input value={datos.mascota} onChange={(e) => setDatos({ ...datos, mascota: e.target.value })} placeholder="Ej. Canela" /></div>
                <div><label className="f">Tu nombre *</label><input value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} autoComplete="name" /></div>
                <div><label className="f">WhatsApp / teléfono *</label><input value={datos.telefono} onChange={(e) => setDatos({ ...datos, telefono: e.target.value })} inputMode="tel" placeholder="10 dígitos" autoComplete="tel" /></div>
                <div><label className="f">Correo (opcional)</label><input value={datos.email} onChange={(e) => setDatos({ ...datos, email: e.target.value })} type="email" autoComplete="email" /></div>
              </div>
              <label className="f">Especificaciones</label>
              <textarea value={datos.especificaciones} onChange={(e) => setDatos({ ...datos, especificaciones: e.target.value })} placeholder={extras.includes('fondo') ? 'Ej. fondo azul cielo, que lleve su paliacate rojo…' : 'Ej. que lleve su collar, posición, detalles que no deben faltar…'} />
              <label className="f">Entrega</label>
              <div className="grid" style={{ gap: 10 }}>
                {ENTREGA.map((e) => (
                  <label key={e.id} className={'opt' + (datos.entrega === e.id ? ' on' : '')}>
                    <span>{e.nombre}</span>
                    <input type="radio" checked={datos.entrega === e.id} onChange={() => setDatos({ ...datos, entrega: e.id })} />
                  </label>
                ))}
              </div>
            </div>
          )}

          {paso === 3 && precio && (
            <div>
              <h3>Revisa y aparta</h3>
              <div className="card" style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                {preview && <img src={preview} alt="" style={{ width: 110, height: 110, objectFit: 'cover', borderRadius: 10 }} />}
                <div>
                  <strong style={{ fontSize: '1.15rem' }}>{datos.mascota}</strong>
                  <div className="muted">{precio.producto.nombre} · {precio.opcion.nombre}</div>
                  <div className="muted">{fechaTxt}</div>
                  <div className="muted">{ENTREGA.find((e) => e.id === datos.entrega)?.nombre}</div>
                </div>
              </div>
              <p className="muted" style={{ marginTop: 16, fontSize: '.92rem' }}>
                Al continuar te mandamos a Mercado Pago para pagar el <strong>anticipo del 50 %</strong>. Guardamos tu lugar {TEMPORADA.minutosApartado} minutos mientras pagas. El resto{datos.entrega === 'envio' ? ' y el envío' : ''} se liquida al entregar.
              </p>
            </div>
          )}

          {error && <div className="err">{error}</div>}

          <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
            {paso > 0 && <button className="btn alt" onClick={() => setPaso(paso - 1)} disabled={enviando}>← Atrás</button>}
            {paso < 3 ? (
              <button className="btn" disabled={!puede[paso]} onClick={() => setPaso(paso + 1)}>Continuar →</button>
            ) : (
              <button className="btn" disabled={enviando} onClick={pagar}>{enviando ? 'Preparando pago…' : `Pagar anticipo ${precio ? fmt(precio.anticipo) : ''}`}</button>
            )}
          </div>
        </div>

        <aside className="card resumen">
          <div className="eyebrow" style={{ marginBottom: 6 }}>Tu pedido</div>
          {precio ? (
            <>
              <div className="fila"><span>{precio.producto.nombre} {precio.opcion.nombre}</span><span>{fmt(precio.opcion.precio)}</span></div>
              {precio.extras.map((e) => <div className="fila" key={e.id}><span>{e.nombre}</span><span>+{fmt(e.precio)}</span></div>)}
              <div className="fila total"><span>Total</span><span>{fmt(precio.total)}</span></div>
              <div className="fila" style={{ color: 'var(--terracota)', fontWeight: 700 }}><span>Anticipo hoy (50 %)</span><span>{fmt(precio.anticipo)}</span></div>
              <div className="fila muted" style={{ fontSize: '.85rem' }}><span>Al entregar</span><span>{fmt(precio.total - precio.anticipo)}</span></div>
              {fecha && <div className="muted" style={{ fontSize: '.88rem', marginTop: 10 }}>📅 {fechaTxt}</div>}
              <div className="muted" style={{ fontSize: '.8rem', marginTop: 10 }}>Envío no incluido.</div>
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Elige tu pieza para ver el precio.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
