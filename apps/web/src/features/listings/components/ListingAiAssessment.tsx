import {
  AI_ASSESSMENT_CRITERIA,
  type AiAssessment,
  type AiAssessmentConfidence,
} from "@mieszkania/shared";
import { Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { formatPln } from "../../../shared/lib/format";

const confidenceLabel: Record<AiAssessmentConfidence, string> = {
  low: "niska",
  medium: "umiarkowana",
  high: "wysoka",
};

export function ListingAiAssessment({
  assessment,
  currentPrice,
}: {
  assessment?: AiAssessment;
  currentPrice?: number;
}) {
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const element = section.current;
      if (!element) return;
      const tabs = element.closest(".detail-panel")?.querySelector(".detail-section-tabs");
      element.style.scrollMarginTop = `${(tabs?.getBoundingClientRect().height ?? 60) + 32}px`;
      element.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  if (!assessment)
    return (
      <section ref={section} className="detail-tab-section ai-assessment" aria-label="Ocena AI">
        <div className="ai-assessment-empty">
          <Sparkles size={28} aria-hidden="true" />
          <h3>Ta oferta nie ma jeszcze oceny AI</h3>
          <p>Oceny są przygotowywane dla wybranych mieszkań na podstawie zdjęć i danych oferty.</p>
          <p className="muted">Otwarcie oferty nie uruchamia analizy ani nie zużywa kredytów.</p>
        </div>
      </section>
    );
  const priceChanged =
    assessment.sourcePrice != null &&
    currentPrice != null &&
    Math.abs(assessment.sourcePrice - currentPrice) > 1;
  return (
    <section ref={section} className="detail-tab-section ai-assessment" aria-label="Ocena AI">
      <header className="ai-assessment-heading">
        <div
          className="ai-assessment-total"
          aria-label={`Ocena AI: ${assessment.score ?? "brak"} na 100`}
        >
          <Sparkles size={18} aria-hidden="true" />
          <strong>
            {assessment.score ?? "—"}
            <small>/100</small>
          </strong>
          <span>Ocena AI</span>
        </div>
        <div>
          <h3>Niezależne spojrzenie na mieszkanie</h3>
          <p>{assessment.summary}</p>
          <p className="muted ai-assessment-meta">
            Pewność: {confidenceLabel[assessment.confidence]} · Pokrycie kryteriów:{" "}
            {assessment.coverage}%
            <br />
            {new Date(assessment.evaluatedAt).toLocaleDateString("pl-PL")} · {assessment.model} ·{" "}
            {assessment.photos.length} zdjęć / rzutów
          </p>
        </div>
      </header>
      <p className="ai-assessment-note">
        Zapisana ocena danych z dnia analizy. Nie aktualizuje się automatycznie po zmianie zdjęć,
        opisu lub preferencji.
        {assessment.sourcePrice != null && (
          <> Cena z dodatkowymi kosztami przy analizie: {formatPln(assessment.sourcePrice)}.</>
        )}
      </p>
      {priceChanged && (
        <p className="ai-assessment-note" role="status">
          Cena zmieniła się od analizy. Ocena ceny wymaga ponownej weryfikacji.
        </p>
      )}
      <div className="ai-assessment-criteria">
        {AI_ASSESSMENT_CRITERIA.map((definition) => {
          const criterion = assessment.criteria.find((item) => item.key === definition.key);
          return (
            <div className="ai-assessment-criterion" key={definition.key}>
              <div className="ai-assessment-criterion-top">
                <h4>
                  {definition.label} <small>waga {definition.weight}%</small>
                </h4>
                <strong>
                  {criterion?.score == null ? "Brak danych" : `${criterion.score}/100`}
                </strong>
              </div>
              {criterion?.score != null && (
                <meter min={0} max={100} value={criterion.score} aria-label={definition.label} />
              )}
              <p>{criterion?.evidence ?? "Brak podstaw do oceny."}</p>
              {criterion && (
                <small className="muted">Pewność: {confidenceLabel[criterion.confidence]}</small>
              )}
            </div>
          );
        })}
      </div>
      <div className="ai-assessment-lists">
        {(
          [
            ["Mocne strony", assessment.strengths],
            ["Słabsze strony i ryzyka", assessment.concerns],
            ["Zapytaj na oględzinach", assessment.questions],
            ["Granice oceny", assessment.limitations],
          ] as const
        ).map(
          ([title, items]) =>
            items.length > 0 && (
              <section key={title}>
                <h4>{title}</h4>
                <ul>
                  {items.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </section>
            ),
        )}
      </div>
      <p className="muted ai-assessment-method">
        Wynik to średnia ważona ocen cząstkowych. Kryteria bez danych są pomijane, a ich udział
        obniża pokrycie. Wynik AI nie zmienia punktacji „Wymarzone mieszkanie”. Zdjęcia pokazują
        widoczny stan, nie potwierdzają ukrytej jakości wykonania.
      </p>
    </section>
  );
}
