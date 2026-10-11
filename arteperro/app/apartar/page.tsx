import Apartar from './Apartar';
export const metadata = { title: 'Aparta tu lugar · Arte Perro' };
export default function Page() {
  return (
    <section className="section" style={{ paddingTop: 48 }}>
      <div className="wrap">
        <div className="eyebrow">Temporada navideña</div>
        <h1 style={{ fontSize: 'clamp(2.2rem,5vw,3.4rem)' }}>Aparta tu <span className="italic">retrato</span></h1>
        <Apartar />
      </div>
    </section>
  );
}
