import "../../config";
import { pool } from "../../db";
import { getListingsPage } from "../../services/listings/listing-repository";

// Run inside the actual API container so the connection and storage match the application.
// Output contains durations and counts only, never offers, preferences or database credentials.
try {
  for (const sort of ["newest", "dream_desc", "dream_desc", "dream_desc"] as const) {
    const phases: Record<string, number> = {};
    const start = performance.now();
    const result = await getListingsPage({ sort, page: 1, pageSize: 30 }, (phase, ms) => {
      phases[phase] = Math.round(ms);
    });
    console.log(
      JSON.stringify({
        sort,
        total: result.total,
        items: result.items.length,
        durationMs: Math.round(performance.now() - start),
        phases,
      }),
    );
  }
} catch {
  console.error(
    "Nie udało się zmierzyć listy. Sprawdź połączenie z bazą i stan API; dane dostępowe nie są wypisywane.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
