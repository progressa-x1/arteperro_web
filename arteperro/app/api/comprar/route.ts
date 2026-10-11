import { ENTREGA, TEMPORADA } from '@/lib/config';
import { apartarPieza, guardarPieza } from '@/lib/coleccion';
import { nuevoId, guardar, type Pedido } from '@/lib/pedidos';
import { crearPago } from '@/lib/pago';

const txt = (f: FormData, k: string, max = 200) => String(f.get(k) || '').trim().slice(0, max);

export async function POST(req: Request) {
  const f = await req.formData();
  const nombre = txt(f, 'nombre', 80);
  const telefono = txt(f, 'telefono', 20).replace(/[^\d+]/g, '');
  const entrega = ENTREGA.find((e) => e.id === txt(f, 'entrega'))?.nombre;
  if (!nombre || telefono.length < 10 || !entrega)
    return Response.json({ error: 'Completa nombre, teléfono y entrega.' }, { status: 400 });

  const pz = await apartarPieza(txt(f, 'pieza'), TEMPORADA.minutosApartado);
  if (!pz) return Response.json({ error: 'Esta pieza ya no está disponible.' }, { status: 409 });

  const id = nuevoId();
  const p: Pedido = {
    id,
    tipo: 'coleccion',
    creado: Date.now(),
    estado: 'pendiente',
    producto: `Colección privada: ${pz.titulo}`,
    opcion: pz.medida,
    extras: [],
    total: pz.precio,
    aPagar: pz.precio,
    cliente: { nombre, telefono, email: txt(f, 'email', 120) || undefined },
    entrega,
    piezaId: pz.id,
  };
  try {
    await guardar(p, true);
    const url = await crearPago({ pedidoId: id, titulo: `Arte Perro · ${pz.titulo}`, monto: pz.precio, email: p.cliente.email, minutos: TEMPORADA.minutosApartado });
    return Response.json({ url, id });
  } catch (e) {
    console.error(e);
    await guardarPieza({ ...pz, estado: 'disponible' });
    return Response.json({ error: 'No pudimos generar tu pago.' }, { status: 500 });
  }
}
