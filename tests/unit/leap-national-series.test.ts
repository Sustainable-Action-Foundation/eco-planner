import { expect, test } from "playwright/test";
import { getLeapNationalSource } from "../../src/lib/leapNationalSeries";

const K = "Key\\";

test.describe("LEAP national series", () => {
  test("transport energy by mode reads Energimyndigheten's balance in TJ, scaled to TWh", () => {
    const aviation = getLeapNationalSource(`${K}Luftfart\\Inrikes\\Bränsleanvändning inrikes flyg`);
    expect(aviation).toMatchObject({ dataset: "STEM", tableId: "EN0118_3", unit: "TJ" });
    expect(aviation?.selection).toContainEqual({ variableCode: "Sektor", valueCodes: ["6"] });
    expect(aviation?.selection).toContainEqual({ variableCode: "Enhet", valueCodes: ["1"] });
    expect(aviation?.scale).toBeCloseTo(1 / 3600);
    expect(getLeapNationalSource(`${K}Sjöfart\\Utrikes\\Utrikes sjöfart energibehov`)?.selection).toContainEqual({ variableCode: "Sektor", valueCodes: ["4"] });
  });

  test("electricity production per kind is TWh scaled to LEAP's average GW", () => {
    const hydro = getLeapNationalSource(`${K}Energiomvandlingsanläggningar\\Årlig elproduktion\\Vattenkraft`);
    expect(hydro).toMatchObject({ tableId: "EN0202_25", unit: "TWh" });
    expect(hydro?.selection).toContainEqual({ variableCode: "Kraftslag", valueCodes: ["0"] });
    expect(hydro?.scale).toBeCloseTo(1 / 8.76);
    // LEAP splits wind and solar in ways the statistic doesn't
    expect(getLeapNationalSource(`${K}Energiomvandlingsanläggningar\\Årlig elproduktion\\Vindkraft landbaserad`)).toBeNull();
    expect(getLeapNationalSource(`${K}Energiomvandlingsanläggningar\\Årlig elproduktion\\Solkraft tak`)).toBeNull();
  });

  test("fuel input totals and named fuels, never the biofuel row that counts waste", () => {
    expect(getLeapNationalSource(`${K}Energiomvandlingsanläggningar\\Insatta bränslen för elproduktion\\Summa exkl kärnbränsle`)?.selection).toContainEqual({ variableCode: "Energivara", valueCodes: ["5"] });
    expect(getLeapNationalSource(`${K}Energiomvandlingsanläggningar\\Insatta bränslen för fjärrvärmeproduktion\\Spillvärme och uppgraderad värme`)?.selection).toContainEqual({ variableCode: "Typ", valueCodes: ["7"] });
    expect(getLeapNationalSource(`${K}Energiomvandlingsanläggningar\\Insatta bränslen för elproduktion\\Biobränslen`)).toBeNull();
    expect(getLeapNationalSource(`${K}Energiomvandlingsanläggningar\\Insatta bränslen för fjärrvärmeproduktion\\Elektricitet`)).toBeNull();
  });

  test("sector balances per carrier for construction, agriculture and forestry", () => {
    const construction = getLeapNationalSource(`${K}Service\\Stationär energianvändning\\Byggverksamhet\\EO1`);
    expect(construction).toMatchObject({ tableId: "EN0114_A", unit: "GWh", scale: 1 });
    expect(construction?.selection).toContainEqual({ variableCode: "Energivara", valueCodes: ["28"] });
    expect(getLeapNationalSource(`${K}Service\\Stationär energianvändning\\Jordbruk\\Biogas`)).toMatchObject({ tableId: "EN0119_1" });
    const forestry = getLeapNationalSource(`${K}Service\\Stationär energianvändning\\Skogsbruk\\EO1`);
    expect(forestry).toMatchObject({ tableId: "EN0116_2", unit: "MWh", scale: 0.001 });
    // One electricity row in the balances, two in LEAP
    expect(getLeapNationalSource(`${K}Service\\Stationär energianvändning\\Byggverksamhet\\El ej uppvärmning`)).toBeNull();
    expect(getLeapNationalSource(`${K}Service\\Stationär energianvändning\\Hushåll\\Fjärrvärme`)).toBeNull();
  });

  test("vehicle intensities and mileage", () => {
    const electric = getLeapNationalSource(`${K}Landtransporter\\Personbilar\\Elbilar\\kWh per km`);
    expect(electric).toMatchObject({ tableId: "EN_IND5-4E", unit: "kWh/100 km", scale: 0.01 });
    expect(electric?.selection).toEqual([{ variableCode: "Drivmedelskategori", valueCodes: ["6"] }]);
    expect(getLeapNationalSource(`${K}Landtransporter\\Personbilar\\Laddhybridbilar\\kWh per km`)).toBeNull();
    expect(getLeapNationalSource(`${K}Landtransporter\\Personbilar\\Fordonskm`)).toMatchObject({ dataset: "Trafa", tableId: "t04010", scale: 1e6 });
    expect(getLeapNationalSource(`${K}Landtransporter\\Lätta lastbilar\\antal lastbilar`)?.selection).toContainEqual({ variableCode: "fslagh", valueCodes: ["22"] });
    expect(getLeapNationalSource(`${K}Landtransporter\\Lätta lastbilar\\ellastbilar`)?.selection).toContainEqual({ variableCode: "drivmedel", valueCodes: ["103"] });
    expect(getLeapNationalSource(`${K}Landtransporter\\Personbilar\\Laddhybridbilar\\Antal bilar`)).toMatchObject({ tableId: "t10026", unit: "antal", scale: 1 });
  });

  test("rows the statistics define differently have no source", () => {
    expect(getLeapNationalSource(`${K}Bostäder och lokaler\\Småhus\\Värmebehov per kvadratmeter uppvärmd yta`)).toBeNull();
    expect(getLeapNationalSource(`${K}Industri\\Cementindustri\\Naturgas`)).toBeNull();
    expect(getLeapNationalSource(`${K}Produktion av industrivaror\\Cement`)).toBeNull();
    expect(getLeapNationalSource("Demand\\Something")).toBeNull();
  });
});
