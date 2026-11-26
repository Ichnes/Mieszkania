import { cashPurchaseEvidence } from "../lib/purchase-evidence";
import { getDescriptionHighlightParts } from "../lib/listing-language";

export function ListingDescription({ value }: { value?: string }) {
  const paragraphs = (value ?? "Brak opisu.")
    .replace(/\r\n/g, "\n")
    .replace(/\b(ul|al|os|im|św)\.\s*\n+\s*/giu, "$1. ")
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const cashParagraph = paragraphs.findIndex((text) => cashPurchaseEvidence(text));
  return (
    <div className="listing-description">
      {paragraphs.map((paragraph, index) => {
        const evidence = index === cashParagraph ? cashPurchaseEvidence(paragraph) : undefined;
        const start = evidence ? paragraph.indexOf(evidence) : -1;
        return (
          <p key={index}>
            {evidence ? (
              <>
                {highlightListingDescription(paragraph.slice(0, start), index)}
                <mark id="zakup-za-gotowke">{evidence}</mark>
                {highlightListingDescription(paragraph.slice(start + evidence.length), index)}
              </>
            ) : (
              highlightListingDescription(paragraph, index)
            )}
          </p>
        );
      })}
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
