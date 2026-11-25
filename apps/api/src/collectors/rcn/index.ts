import type { RcnImportRunResult, RcnPowiatConfig } from "./types";
import { warsawAreaRcnPowiatConfigs } from "./warsaw-region-config";
import { importRcnTransactions } from "./wfs-importer";
import { importCityFlats } from "./warsaw-city-import";

export class RcnCollector {
  private cityImport?: ReturnType<typeof importCityFlats>;
  async planWarsawAreaImport(): Promise<RcnImportRunResult> {
    return {
      scope: "warsaw-metropolitan",
      checkedPowiatCount: warsawAreaRcnPowiatConfigs.length,
      powiats: warsawAreaRcnPowiatConfigs.map((powiat) => ({
        key: powiat.key,
        label: powiat.label,
        wfsCapabilitiesUrl: powiat.wfsCapabilitiesUrl,
        status: "planned",
      })),
    };
  }

  async inspectCapabilities(scope?: string): Promise<RcnImportRunResult> {
    const configs = selectConfigs(scope);

    return {
      scope: scope ?? "warsaw-metropolitan",
      checkedPowiatCount: configs.length,
      powiats: await Promise.all(
        configs.map(async (powiat) => ({
          key: powiat.key,
          label: powiat.label,
          wfsCapabilitiesUrl: powiat.wfsCapabilitiesUrl,
          status: await checkCapabilities(powiat),
        })),
      ),
    };
  }

  async importScope(scope?: string) {
    if (!scope || scope === "warsaw-metropolitan" || scope === "m-st-warszawa") {
      this.cityImport ??= importCityFlats().finally(() => {
        this.cityImport = undefined;
      });
      return this.cityImport;
    }
    return importRcnTransactions(scope);
  }
}

function selectConfigs(scope?: string) {
  if (!scope || scope === "warsaw-metropolitan") {
    return warsawAreaRcnPowiatConfigs;
  }

  return warsawAreaRcnPowiatConfigs.filter((powiat) => powiat.key === scope);
}

async function checkCapabilities(powiat: RcnPowiatConfig): Promise<"planned" | "checked"> {
  try {
    const response = await fetch(powiat.wfsCapabilitiesUrl, {
      headers: {
        accept: "application/xml,text/xml",
      },
    });

    if (!response.ok) {
      return "planned";
    }

    const text = await response.text();
    return text.includes("WFS_Capabilities") || text.includes("FeatureTypeList")
      ? "checked"
      : "planned";
  } catch {
    return "planned";
  }
}
