import "../../config";
import { ensureLocalDatabaseExists, initializeDatabase } from "../../db/initialize";
import { pool } from "../../db";

try {
  await ensureLocalDatabaseExists();
  await initializeDatabase();
  console.log("PostgreSQL i schemat aplikacji są gotowe.");
} catch (error) {
  const code = (error as { code?: string }).code;
  console.error(
    "Nie udało się przygotować bazy. Uruchom lokalny PostgreSQL i sprawdź DATABASE_URL w .env.",
  );
  console.error(
    code ? `Kod błędu: ${code}` : error instanceof Error ? error.message : "Nieznany błąd",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
