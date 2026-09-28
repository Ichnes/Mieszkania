import { getHeatingEvidence } from "../lib/heating";

export function HeatingEvidence({ description }: { description?: string }) {
  const heating = getHeatingEvidence(description);
  return (
    <section className="heating-evidence" aria-label="Źródło ogrzewania">
      <strong>{heating.label}</strong>
      <p>Do potwierdzenia u zarządcy budynku.</p>
      {heating.evidence.length ? (
        <details>
          <summary>Źródło: opis ogłoszenia</summary>
          {heating.evidence.map((text) => (
            <blockquote key={text}>{text}</blockquote>
          ))}
        </details>
      ) : (
        <p className="muted">
          Opis nie określa jednoznacznie źródła ciepła. Samo „centralne ogrzewanie” ani pobliska
          sieć nie wystarczają.
        </p>
      )}
    </section>
  );
}
