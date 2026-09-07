import { getDescriptionHighlightParts } from "../lib/listing-language";

export function ListingDescription({ value }: { value?: string }) {
  const paragraphs = (value ?? "Brak opisu.")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ])/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div className="listing-description">
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 24)}`}>
          {highlightListingDescription(paragraph, index)}
        </p>
      ))}
    </div>
  );
}

export function highlightListingDescription(value: string, paragraphIndex: number) {
  return getDescriptionHighlightParts(value).map((part, index) =>
    part.tone ? (
      <strong
        className={`listing-description-highlight ${part.tone}`}
        key={`${paragraphIndex}-${index}`}
      >
        {part.text}
      </strong>
    ) : (
      part.text
    ),
  );
}
