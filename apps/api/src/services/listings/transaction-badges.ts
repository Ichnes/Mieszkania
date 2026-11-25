export function transactionBadges(title: string, description?: string | null) {
  const clauses = (title + ". " + (description ?? ""))
    .toLocaleLowerCase("pl")
    .split(/[.!?;|\n]+/)
    .map((clause) => clause.replace(/\s+/g, " ").trim());
  const badges: string[] = [];
  if (
    clauses.some(
      (clause) =>
        /(?:grunt(?:y|u)?(?: pod budynkiem)? (?:jest |są )?nieuregulowan|nieuregulowan\p{L}* (?:stan (?:prawny )?)?grunt)/u.test(
          clause,
        ) && !/(?:nie dotyczy|brak problemu z) nieuregulowan/u.test(clause),
    )
  )
    badges.push("Nieuregulowany grunt");
  if (
    clauses.some(
      (clause) =>
        !/(?:bez cesji|nie (?:jest to |dotyczy |obejmuje )?cesj|nie ma (?:możliwości )?cesji|brak (?:możliwości )?cesji)/u.test(
          clause,
        ) &&
        /(?:^cesja$|cesj[aię] (?:praw z umowy|umowy) deweloperskiej|(?:sprzedaż(?: mieszkania)?|zakup|transakcja|przekazanie własności) (?:w (?:drodze|formie)|na zasadzie|poprzez) cesj[ię])/u.test(
          clause,
        ),
    )
  )
    badges.push("Cesja mieszkania");
  return badges;
}
