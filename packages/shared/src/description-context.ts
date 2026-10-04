export type DescriptionMentionStatus = "present" | "absent" | "possible";

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁ]/g, "l")
    .toLowerCase();
}

/** Local context: a negation stops at a contrasting or explicitly affirmative clause. */
export function getDescriptionMentionStatus(
  text: string,
  index: number,
  length: number,
): DescriptionMentionStatus {
  const prefix = normalize(text.slice(Math.max(0, index - 150), index));
  const before = (
    prefix
      .split(/[.!?;\n|•]|\s[-–—]\s|\b(?:ale|jednak|natomiast|lecz|za to)\b|,\s*(?=(?:z|jest|sa)\b)/)
      .at(-1) ?? ""
  ).replace(/\b(?:bez|brak)\s+(?:prowizji|posrednikow|problemow|dodatkowych\s+oplat)\b/g, "");
  const after = normalize(text.slice(index + length, index + length + 90));
  if (
    /\b(?:zakup\s+obligatoryjn\w*|obowiazkow\w*\s+zakup|nie\s+ma\s+mozliwosci\s+zakupu[^.]{0,90}\s+bez)\s*$/.test(
      prefix,
    )
  )
    return "present";
  if (
    /\b(?:bez|brak|nie\s+(?:ma|posiada|obejmuje|przysluguje|przynalezy|jest|sa|zostal\w*|wykonano)|nieposiada)\b[^.!?;]{0,65}$/.test(
      before,
    ) ||
    /^\s*[:—–-]?\s*(?:brak\b|nie\s*(?=[.!?,;]|$)|nie\s+(?:ma|wystepuje|przynalezy)\b)/.test(after)
  )
    return "absent";
  const optionContext = before.split(/[,()]/).at(-1) ?? "";
  if (/\bmozliwosc\s+(?:przywolania|korzystania\s+z|wjazdu|zjazdu)\s*$/.test(optionContext))
    return "present";
  if (
    /\b(?:mozliwosc|mozliwy|mozliwa|planowan\w*|przygotowan\w*|instalacj\w*\s+pod|imituj\w*|imitacj\w*)\b[^.!?;]{0,75}$/.test(
      optionContext,
    ) ||
    /^\s*(?:(?:jest|sa|wylacznie|tylko)\s+)*(?:planowan\w*|do\s+(?:montazu|wykonania|wynajecia)|na\s+wynajem)\b/.test(
      after,
    )
  )
    return "possible";
  return "present";
}
