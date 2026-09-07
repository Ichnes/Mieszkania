import "../config";
import { AdresowoCollector } from "./adresowo";
import { DomiportaCollector } from "./domiporta";
import { GratkaCollector } from "./gratka";
import { MaxonCollector } from "./maxon";
import { MorizonCollector } from "./morizon";
import { NieruchomosciOnlineCollector } from "./nieruchomosci-online";
import { OlxCollector } from "./olx";
import { OtodomCollector } from "./otodom";
import { RcnCollector } from "./rcn";

export function createCollectors() {
  const otodomCollector = new OtodomCollector();
  const gratkaCollector = new GratkaCollector();
  const olxCollector = new OlxCollector();
  const nieruchomosciOnlineCollector = new NieruchomosciOnlineCollector();
  const domiportaCollector = new DomiportaCollector();
  const maxonCollector = new MaxonCollector();
  const adresowoCollector = new AdresowoCollector();
  const morizonCollector = new MorizonCollector();
  const rcnCollector = new RcnCollector();
  return {
    otodomCollector,
    gratkaCollector,
    olxCollector,
    nieruchomosciOnlineCollector,
    domiportaCollector,
    maxonCollector,
    adresowoCollector,
    morizonCollector,
    rcnCollector,
  };
}
export type Collectors = ReturnType<typeof createCollectors>;
