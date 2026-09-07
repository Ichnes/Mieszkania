export function ListingBadgeRow({ badges }: { badges: string[] }) {
  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="listing-badges">
      {badges.map((badge) => (
        <span key={badge} className="listing-badge">
          {badge}
        </span>
      ))}
    </div>
  );
}
