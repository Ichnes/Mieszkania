import "../config";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface, emitKeypressEvents } from "node:readline";
import { storageRoot } from "../config";
import { createAccount, type LocalAccount } from "../services/auth/passwords";

async function readPassword() {
  if (!process.stdin.isTTY)
    throw new Error("Użyj interaktywnego terminala (docker compose exec bez -T).");
  process.stdout.write("Hasło (min. 12 znaków, niewidoczne podczas wpisywania): ");
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise<string>((resolvePassword, reject) => {
    let password = "";
    const done = () => {
      process.stdin.removeListener("keypress", onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };
    const onKey = (value: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "c") {
        done();
        reject(new Error("Anulowano."));
      } else if (key.name === "return") {
        done();
        resolvePassword(password);
      } else if (key.name === "backspace") password = password.slice(0, -1);
      else if (value && !key.ctrl && password.length < 129) password += value;
    };
    process.stdin.on("keypress", onKey);
  });
}
async function main() {
  let email = process.argv[2];
  if (!email) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    email = await new Promise<string>((resolve) => rl.question("Email: ", resolve));
    rl.close();
  }
  const account = await createAccount(email, await readPassword());
  process.stdout.write("Powtórz hasło.\n");
  const { verifyPassword } = await import("../services/auth/passwords");
  if (!(await verifyPassword(await readPassword(), account))) throw new Error("Hasła różnią się.");
  const directory = resolve(storageRoot, "auth");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = resolve(directory, "accounts.json");
  let accounts: LocalAccount[] = [];
  try {
    const previous = JSON.parse(await readFile(file, "utf8"));
    if (previous.version !== 1 || !Array.isArray(previous.accounts))
      throw new Error("Nieprawidłowy plik kont.");
    accounts = previous.accounts;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  accounts = accounts.filter((item) => item.email !== account.email);
  accounts.push(account);
  await writeFile(file + ".tmp", JSON.stringify({ version: 1, accounts }, null, 2), {
    mode: 0o600,
  });
  await rename(file + ".tmp", file);
  console.log(
    "Konto zapisane. Włącz AUTH_ENABLED=true i uruchom ponownie API. Zmiana hasła również wymaga restartu API.",
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
