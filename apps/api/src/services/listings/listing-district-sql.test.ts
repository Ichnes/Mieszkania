import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import {
  effectiveDistrictSql,
  inferWarsawDistrictFromLocationTitle,
  inferWarsawDistrictFromAddressDescription,
} from "./listing-title-location";

test(
  "SQL district selection agrees with displayed title location before pagination",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    try {
      for (const [title, stored, description = ""] of [
        [
          "Mieszkanie",
          "Śródmieście",
          "Mieszkanie znajduje się w Warszawie-Wesołej przy ul. Długiej 80B.",
        ],
        ["Mieszkanie", "Wola", "Stacja PKP Wesoła, szybki dojazd do centrum."],
        ["Mieszkanie na sprzedaż, 67 m² Wesoła, Gościniec", "Mokotów"],
        ["Nowoczesne mieszkanie: Warszawa Wesoła: Głowackiego 26", "Ochota"],
        ["Mieszkanie na sprzedaż, 71 m² Wesoła, Tadeusza Rejtana", "Mokotów"],
        ["15 minut od Mokotowa: Warszawa Wola: Towarowa", "Mokotów"],
        ["Mieszkanie bez prowizji", "Targówek"],
      ]) {
        const result = await db.query(
          `select ${effectiveDistrictSql()} as district from (values ($1::text, $2::text, $3::text)) l(title,district,description)`,
          [title, stored, description],
        );
        assert.equal(
          result.rows[0].district,
          inferWarsawDistrictFromAddressDescription(description) ??
            inferWarsawDistrictFromLocationTitle(title) ??
            stored,
        );
      }
    } finally {
      await db.end();
    }
  },
);
