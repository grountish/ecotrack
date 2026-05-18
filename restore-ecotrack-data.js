/*
 * Run this in the browser console while EcoTrack is open on the same URL
 * where you normally use it. It restores the values from your screenshot.
 */
(() => {
  const STORAGE_KEY = "ecotrack-finance-fortnight-tracker-v1";
  const periods = [
    { id: "period-2026-01-13", startDate: "2026-01-13" },
    { id: "period-2026-01-27", startDate: "2026-01-27" },
    { id: "period-2026-02-10", startDate: "2026-02-10" },
    { id: "period-2026-02-24", startDate: "2026-02-24" },
    { id: "period-2026-03-05", startDate: "2026-03-05" },
    { id: "period-2026-03-24", startDate: "2026-03-24" },
    { id: "period-2026-04-07", startDate: "2026-04-07" },
    { id: "period-2026-04-21", startDate: "2026-04-21" },
    { id: "period-2026-05-15", startDate: "2026-05-15" },
  ];
  const valuesBySource = {
    Sabal: [433, 3800, 402, 4295, 1930, 5600, 9000, 6000, 7500],
    Revolut: [2000, 2000, 2300, 2200, 2100, 2056, 2056, 2056, 2220],
    Crypt: [4000, 4000, 4400, 4000, 4000, 4324, 4524.05, 4524, 4733],
    Ledg: [1700, 1700, 1700, 1700, 1700, 1700, 1700, 1700, 1700],
  };

  const toSourceId = (name) => `source-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const sources = Object.entries(valuesBySource).map(([name, values]) => ({
    id: toSourceId(name),
    name,
    amounts: Object.fromEntries(periods.map((period, index) => [period.id, values[index]])),
  }));

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ periods, sources }));
  console.info(`EcoTrack data restored: ${sources.length} sources, ${periods.length} periods.`);
  window.location.reload();
})();
