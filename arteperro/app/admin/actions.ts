'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { esAdmin, tokenAdmin } from '@/lib/auth';
import { setBloqueo, liberar } from '@/lib/agenda';
import { obtener, guardar, type Estado } from '@/lib/pedidos';
import { guardarPieza, borrarPieza, pieza, piezas } from '@/lib/coleccion';
import { subirImagen, validarImagen } from '@/lib/archivos';

async function check() {
  if (!(await esAdmin())) throw new Error('No autorizado');
}

export async function entrar(fd: FormData) {
  const t = tokenAdmin(String(fd.get('pass') || ''));
  if (t) (await cookies()).set('ap_admin', t, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' });
  revalidatePath('/admin');
}

export async function salir() {
  (await cookies()).delete('ap_admin');
  revalidatePath('/admin');
}

export async function bloquear(fd: FormData) {
  await check();
  await setBloqueo(String(fd.get('fecha')), Number(fd.get('n')));
  revalidatePath('/admin');
}

export async function cambiarEstado(fd: FormData) {
  await check();
  const p = await obtener(String(fd.get('id')));
  if (!p) return;
  const nuevo = String(fd.get('estado')) as Estado;
  if (nuevo === 'cancelado' && p.fecha) await liberar(p.fecha, p.id);
  if (nuevo === 'cancelado' && p.piezaId) {
    const pz = await pieza(p.piezaId);
    if (pz) await guardarPieza({ ...pz, estado: 'disponible' });
  }
  await guardar({ ...p, estado: nuevo });
  revalidatePath('/admin');
}

export async function agregarPieza(fd: FormData) {
  await check();
  const foto = fd.get('foto');
  if (!validarImagen(foto)) throw new Error('Foto inválida (máx 4 MB)');
  const id = 'pz' + Date.now().toString(36);
  const orden = (await piezas()).length;
  await guardarPieza(
    {
      id,
      titulo: String(fd.get('titulo') || 'Sin título').slice(0, 80),
      medida: String(fd.get('medida') || '').slice(0, 40),
      descripcion: String(fd.get('descripcion') || '').slice(0, 400),
      precio: Math.max(1, Math.round(Number(fd.get('precio')) || 0)),
      foto: await subirImagen(foto, 'coleccion'),
      estado: 'disponible',
      orden,
    },
    true
  );
  revalidatePath('/admin');
  revalidatePath('/coleccion');
}

export async function estadoPieza(fd: FormData) {
  await check();
  const pz = await pieza(String(fd.get('id')));
  if (!pz) return;
  const e = String(fd.get('estado'));
  if (e === 'borrar') await borrarPieza(pz.id);
  else await guardarPieza({ ...pz, estado: e as 'disponible' | 'vendida' });
  revalidatePath('/admin');
  revalidatePath('/coleccion');
}
