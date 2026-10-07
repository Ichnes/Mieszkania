import assert from "node:assert/strict";
import test from "node:test";
import { descriptionText } from "./description-text";

test("preserves paragraphs, list items, explicit breaks and inline words", () => {
  assert.equal(
    descriptionText(
      "<p>Opis <b>mieszkania</b>.</p><p>Układ:<br>Salon</p><ul><li>Kuchnia</li><li>Balkon</li></ul>",
    ),
    "Opis mieszkania.\n\nUkład:\nSalon\n\n• Kuchnia\n\n• Balkon",
  );
  assert.equal(descriptionText("Pierwszy\n\nDrugi\nTrzeci"), "Pierwszy\n\nDrugi\nTrzeci");
});
