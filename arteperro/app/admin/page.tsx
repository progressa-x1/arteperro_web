import { esAdmin } from '@/lib/auth';
import { todos } from '@/lib/pedidos';
import { disponibilidad, getBloqueos } from '@/lib/agenda';
import { piezas } from '@/lib/coleccion';
import { TEMPORADA } from '@/lib/config';
import { usandoBD } from '@/lib/kv';
import { pagoReal } from '@/lib/pago';
import { entrar, salir, bloquear, cambiarEstado, agregarPieza, estadoPieza } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Panel · Arte Perro', robots: { index: false } };
const fmt = (n: number) => '$' + n.toLocaleString('es-MX');
const corta = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const ESTADOS = [
  ['pendiente', 'Pendiente de pago'],
  ['anticipo_pagado', 'Anticipo pagado'],
  ['liquidado', 'Liquidado'],
  ['entregado', 'Entregado'],
  ['cancelado', 'Cancelado'],
];

export default async function Admin({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  if (!(await esAdmin()))
    return (
      <section className="section">
        <form action={entrar} className="wrap card" style={{ maxWidth: 380 }}>
          <h2>Panel</h2>
          <input type="password" name="pass" placeholder="Contraseña" autoFocus />
          <button className="btn" style={{ marginTop: 12, width: '100%' }}>Entrar</button>
        </form>
      </section>
    );

  const { ver = 'pedidos' } = await searchParams;
  const [pedidos, dias, bloq, colec] = await Promise.all([todos(), disponibilidad(), getBloqueos(), piezas()]);
  const activos = pedidos.filter((p) => p.estado !== 'pendiente' && p.estado !== 'cancelado');
  const porDia = new Map<string, number>();
  activos.forEach((p) => p.fecha && porDia.set(p.fecha, (porDia.get(p.fecha) || 0) + 1));
  const cobrado = activos.reduce((s, p) => s + (p.estado === 'liquidado' || p.estado === 'entregado' ? p.total : p.aPagar), 0);
  const porCobrar = activos.filter((p) => p.estado === 'anticipo_pagado').reduce((s, p) => s + p.total - p.aPagar, 0);
  const wa = (t: string) => 'https://wa.me/' + (t.replace(/\D/g, '').length === 10 ? '52' + t.replace(/\D/g, '') : t.replace(/\D/g, ''));

  const tab = (id: string, txt: string) => (
    <a href={`/admin?ver=${id}`} className={'paso' + (ver === id ? ' on' : '')} style={{ textDecoration: 'none' }}>{txt}</a>
  );

  return (
    <section className="section" style={{ paddingTop: 32 }}>
      <div className="wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Panel Arte Perro</h2>
          <form action={salir}><button className="btn alt sm">Salir</button></form>
        </div>
        {(!usandoBD || !pagoReal) && (
          <div className="err">
            Modo prueba: {!usandoBD && 'sin base de datos (Supabase). '}{!pagoReal && 'sin Mercado Pago (los pagos son simulados).'}
          </div>
        )}
        <div className="grid g3" style={{ margin: '24px 0' }}>
          <div className="card"><div className="muted">Pedidos confirmados</div><div className="precio">{activos.length}</div></div>
          <div className="card"><div className="muted">Cobrado en línea</div><div className="precio">{fmt(cobrado)}</div></div>
          <div className="card"><div className="muted">Por cobrar al entregar</div><div className="precio">{fmt(porCobrar)}</div></div>
        </div>
        <div className="pasos">{tab('pedidos', 'Pedidos')}{tab('agenda', 'Agenda')}{tab('coleccion', 'Colección')}</div>

        {ver === 'pedidos' && (
          <div style={{ overflowX: 'auto' }}>
            <table className="tabla">
              <thead><tr><th>Foto</th><th>Pedido</th><th>Día</th><th>Cliente</th><th>Pieza</th><th>Pago</th><th>Estado</th></tr></thead>
              <tbody>
                {pedidos.filter((p) => p.estado !== 'pendiente' || Date.now() - p.creado < 3600_000 * 24).map((p) => (
                  <tr key={p.id} style={{ opacity: p.estado === 'cancelado' || p.estado === 'pendiente' ? 0.5 : 1 }}>
                    <td>{p.mascota?.foto && <a href={p.mascota.foto} target="_blank"><img src={p.mascota.foto} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }} /></a>}</td>
                    <td><strong>{p.id}</strong><br /><span className="muted">{new Date(p.creado).toLocaleDateString('es-MX')}</span></td>
                    <td>{p.fecha ? corta(p.fecha) : '—'}</td>
                    <td>{p.cliente.nombre}<br /><a href={wa(p.cliente.telefono)} target="_blank">{p.cliente.telefono}</a>{p.cliente.email && <><br /><span className="muted">{p.cliente.email}</span></>}</td>
                    <td>
                      <strong>{p.mascota?.nombre}</strong> {p.producto} · {p.opcion}
                      {p.extras.length > 0 && <><br /><span className="muted">+ {p.extras.join(', ')}</span></>}
                      {p.mascota?.especificaciones && <><br /><em className="muted">“{p.mascota.especificaciones}”</em></>}
                      <br /><span className="muted">{p.entrega}</span>
                    </td>
                    <td>{fmt(p.aPagar)} / {fmt(p.total)}</td>
                    <td>
                      <form action={cambiarEstado} style={{ display: 'flex', gap: 6 }}>
                        <input type="hidden" name="id" value={p.id} />
                        <select name="estado" defaultValue={p.estado} style={{ padding: 6, fontSize: '.85rem' }}>
                          {ESTADOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                        </select>
                        <button className="btn sm">OK</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pedidos.length === 0 && <p className="muted">Aún no hay pedidos.</p>}
          </div>
        )}

        {ver === 'agenda' && (
          <>
            <p className="muted">Bloquea lugares que ya ocupaste por WhatsApp, en persona o porque necesitas ese día libre. Cupo: {TEMPORADA.cupoPorDia} por día.</p>
            <div style={{ overflowX: 'auto' }}>
              <table className="tabla">
                <thead><tr><th>Día</th><th>Pedidos web</th><th>Bloqueados por ti</th><th>Libres</th><th></th></tr></thead>
                <tbody>
                  {dias.map((d) => {
                    const b = bloq[d.fecha] || 0;
                    return (
                      <tr key={d.fecha}>
                        <td>{corta(d.fecha)}</td>
                        <td>{porDia.get(d.fecha) || 0}</td>
                        <td>{b}</td>
                        <td>{d.libres === 0 ? <span className="chip no">lleno</span> : <span className="chip ok">{d.libres}</span>}</td>
                        <td style={{ display: 'flex', gap: 6 }}>
                          <form action={bloquear}><input type="hidden" name="fecha" value={d.fecha} /><input type="hidden" name="n" value={b + 1} /><button className="btn sm alt" disabled={d.libres === 0}>+ bloquear</button></form>
                          <form action={bloquear}><input type="hidden" name="fecha" value={d.fecha} /><input type="hidden" name="n" value={b - 1} /><button className="btn sm alt" disabled={b === 0}>– liberar</button></form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {ver === 'coleccion' && (
          <div className="layout-pedido">
            <div className="grid g2">
              {colec.map((p) => (
                <div key={p.id} className="card" style={{ padding: 12 }}>
                  <img src={p.foto} alt="" style={{ aspectRatio: '1', objectFit: 'cover', borderRadius: 8, width: '100%' }} />
                  <div className="fila"><strong>{p.titulo}</strong><span>{fmt(p.precio)}</span></div>
                  <div className="muted" style={{ fontSize: '.85rem' }}>{p.medida} · {p.estado}</div>
                  <form action={estadoPieza} style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <input type="hidden" name="id" value={p.id} />
                    <select name="estado" defaultValue={p.estado === 'apartada' ? 'disponible' : p.estado} style={{ padding: 6 }}>
                      <option value="disponible">Disponible</option>
                      <option value="vendida">Vendida</option>
                      <option value="borrar">Borrar</option>
                    </select>
                    <button className="btn sm">OK</button>
                  </form>
                </div>
              ))}
              {colec.length === 0 && <p className="muted">Aún no subes piezas.</p>}
            </div>
            <form action={agregarPieza} className="card">
              <h3>Agregar pieza</h3>
              <label className="f">Foto *</label><input type="file" name="foto" accept="image/*" required />
              <label className="f">Título *</label><input name="titulo" required />
              <label className="f">Medida</label><input name="medida" placeholder="30 × 30 cm" />
              <label className="f">Precio (MXN) *</label><input name="precio" type="number" min="1" required />
              <label className="f">Descripción</label><textarea name="descripcion" />
              <button className="btn" style={{ marginTop: 14, width: '100%' }}>Publicar</button>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
