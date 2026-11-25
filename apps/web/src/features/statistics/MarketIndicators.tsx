export function SampleSizeIndicator({ count, unit }: { count?: number; unit: string }) {
  if (count == null) return <small className="sample-size">Nieznana liczebność</small>;
  if (count === 0) return <small className="sample-size">Brak obserwacji</small>;
  const label =
    count <= 3
      ? "bardzo mała"
      : count <= 9
        ? "mała"
        : count <= 29
          ? "ograniczona"
          : count <= 99
            ? "średnia"
            : "duża";
  return (
    <small className="sample-size">
      {count.toLocaleString("pl-PL")} {unit} · {label} próba
    </small>
  );
}

export function SegmentedLinearGauge({ score }: { score: number | null }) {
  return (
    <div className="pressure-gauge">
      <strong>
        {score == null ? (
          "Brak wyniku"
        ) : (
          <>
            {score.toLocaleString("pl-PL", { maximumFractionDigits: 1 })}
            <small> / 100</small>
          </>
        )}
      </strong>
      <div className="pressure-scale" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <i key={i} />
        ))}
        {score != null && <span style={{ left: score + "%" }} />}
      </div>
      <div className="pressure-ticks">
        <span>0 · niska</span>
        <span>50 · typowa</span>
        <span>100 · wysoka</span>
      </div>
    </div>
  );
}
