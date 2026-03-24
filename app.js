const STORAGE_KEY = "ecotrack-finance-fortnight-tracker-v1";
const palette = ["#1e5c51", "#c96e3d", "#d5a235", "#5474a8", "#7a5ea3", "#b4473d"];

const summaryEl = document.querySelector("#summary");
const tableHeadEl = document.querySelector("#table-head");
const tableBodyEl = document.querySelector("#table-body");
const tableFootEl = document.querySelector("#table-foot");
const chartEl = document.querySelector("#chart");
const chartLegendEl = document.querySelector("#chart-legend");
const projectionToggleEl = document.querySelector("#projection-toggle");
const projectionSummaryEl = document.querySelector("#projection-summary");

const FORECAST_PERIOD_COUNT = 13;

let state = loadState();
const viewState = {
  showProjection: false,
};

renderApp();
bindEvents();

function bindEvents() {
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) {
      return;
    }

    const { action } = trigger.dataset;

    if (action === "add-source") {
      addSource();
      return;
    }

    if (action === "toggle-projection") {
      viewState.showProjection = !viewState.showProjection;
      renderChartControls();
      renderChart();
      return;
    }

    if (action === "add-period") {
      addPeriod();
      return;
    }

    if (action === "reset") {
      state = createDefaultState();
      saveState();
      renderApp();
      return;
    }

    if (action === "remove-source") {
      removeSource(trigger.dataset.sourceId);
      return;
    }

    if (action === "remove-period") {
      removePeriod(trigger.dataset.periodId);
    }
  });

  document.addEventListener("input", (event) => {
    const sourceInput = event.target.closest("[data-source-name]");
    if (sourceInput) {
      const source = findSource(sourceInput.dataset.sourceName);
      if (!source) {
        return;
      }
      source.name = sourceInput.value;
      saveState();
      renderLegend();
      return;
    }

    const amountInput = event.target.closest("[data-amount-source-id]");
    if (amountInput) {
      const source = findSource(amountInput.dataset.amountSourceId);
      if (!source) {
        return;
      }

      const periodId = amountInput.dataset.amountPeriodId;
      const nextValue = toNumber(amountInput.value);

      if (nextValue === 0) {
        delete source.amounts[periodId];
      } else {
        source.amounts[periodId] = nextValue;
      }

      saveState();
      updateComputedViews();
    }
  });

  document.addEventListener("change", (event) => {
    const dateInput = event.target.closest("[data-period-date]");
    if (!dateInput) {
      return;
    }

    const period = findPeriod(dateInput.dataset.periodDate);
    if (!period) {
      return;
    }

    if (!isISODate(dateInput.value)) {
      renderApp();
      return;
    }

    period.startDate = dateInput.value;
    sortPeriods();
    saveState();
    renderApp();
  });

  chartEl.addEventListener("mousemove", (event) => {
    const point = event.target.closest("[data-chart-point]");
    if (!point) {
      hideChartTooltip();
      return;
    }
    showChartTooltip(point, { clientX: event.clientX, clientY: event.clientY });
  });

  chartEl.addEventListener("mouseleave", () => {
    hideChartTooltip();
  });

  chartEl.addEventListener("focusin", (event) => {
    const point = event.target.closest("[data-chart-point]");
    if (!point) {
      return;
    }

    const bounds = point.getBoundingClientRect();
    showChartTooltip(point, {
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top,
    });
  });

  chartEl.addEventListener("focusout", (event) => {
    if (event.relatedTarget && chartEl.contains(event.relatedTarget)) {
      return;
    }
    hideChartTooltip();
  });
}

function renderApp() {
  renderSummary();
  renderTable();
  renderLegend();
  renderChartControls();
  renderChart();
}

function renderSummary() {
  const latestPeriod = state.periods[state.periods.length - 1];
  const latestTotal = latestPeriod ? computePeriodTotal(latestPeriod.id) : 0;
  const allPeriodsTotal = state.periods.reduce(
    (sum, period) => sum + computePeriodTotal(period.id),
    0,
  );
  const averagePerPeriod = state.periods.length ? allPeriodsTotal / state.periods.length : 0;

  summaryEl.innerHTML = `
    <article class="summary-card">
      <span>Sources</span>
      <strong>${state.sources.length}</strong>
      <p>${state.sources.length === 1 ? "1 active row" : "Editable rows for each source"}</p>
    </article>
    <article class="summary-card">
      <span>Biweekly Periods</span>
      <strong>${state.periods.length}</strong>
      <p>${state.periods.length === 1 ? "1 two-week column" : "Columns advance in 14-day steps"}</p>
    </article>
    <article class="summary-card">
      <span>Latest Period Total</span>
      <strong>${formatNumber(latestTotal)}</strong>
      <p>${latestPeriod ? formatRangeLabel(latestPeriod.startDate) : "No periods yet"}</p>
    </article>
    <article class="summary-card">
      <span>Average Per Period</span>
      <strong>${formatNumber(averagePerPeriod)}</strong>
      <p>Grand total ${formatNumber(allPeriodsTotal)}</p>
    </article>
  `;
}

function renderTable() {
  tableHeadEl.innerHTML = `
    <tr>
      <th>
        <div class="source-head">
          <strong>Source</strong>
          <span class="source-meta">Amounts by 2-week period.</span>
        </div>
      </th>
      ${state.periods
        .map(
          (period, index) => `
            <th>
              <div class="period-head">
                <strong>Period ${index + 1}</strong>
                <label class="period-date-wrap">
                  <input
                    class="period-date"
                    type="date"
                    data-period-date="${period.id}"
                    value="${period.startDate}"
                    aria-label="Start date for period ${index + 1}"
                  />
                  <span class="period-date-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path
                        d="M7 2h2v3h6V2h2v3h3v17H4V5h3V2Zm11 8H6v10h12V10ZM6 8h12V7H6v1Z"
                        fill="currentColor"
                      />
                    </svg>
                  </span>
                </label>
                <small>${formatRangeLabel(period.startDate)}</small>
                <button
                  type="button"
                  class="icon-button period-remove-button"
                  data-action="remove-period"
                  data-period-id="${period.id}"
                  aria-label="Remove period ${index + 1}"
                  title="Remove period"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path
                      d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h2v9H7V9Zm4 0h2v9h-2V9Zm4 0h2v9h-2V9ZM6 7h12l-1 13H7L6 7Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </div>
            </th>
          `,
        )
        .join("")}
    </tr>
  `;

  tableBodyEl.innerHTML = state.sources
    .map((source, sourceIndex) => {
      const safeName = escapeHtml(source.name);
      return `
        <tr>
          <td class="source-cell">
            <div class="source-head source-head-inline">
              <input
                class="source-name"
                type="text"
                data-source-name="${source.id}"
                value="${safeName}"
                aria-label="Source name for row ${sourceIndex + 1}"
              />
              <button
                type="button"
                class="icon-button remove-icon-button"
                data-action="remove-source"
                data-source-id="${source.id}"
                aria-label="Remove ${safeName || `source ${sourceIndex + 1}`}"
                title="Remove source"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path
                    d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h2v9H7V9Zm4 0h2v9h-2V9Zm4 0h2v9h-2V9ZM6 7h12l-1 13H7L6 7Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </td>
          ${state.periods
            .map((period) => {
              const value = source.amounts[period.id];
              return `
                <td>
                  <input
                    class="amount-input"
                    type="number"
                    step="0.01"
                    inputmode="decimal"
                    placeholder="0"
                    data-amount-source-id="${source.id}"
                    data-amount-period-id="${period.id}"
                    value="${value === 0 || value == null ? "" : value}"
                    aria-label="Amount for ${safeName || `source ${sourceIndex + 1}`} in ${formatRangeLabel(period.startDate)}"
                  />
                </td>
              `;
            })
            .join("")}
        </tr>
      `;
    })
    .join("");

  tableFootEl.innerHTML = `
    <tr>
      <td>
        <div class="source-head">
          <strong>Total</strong>
        </div>
      </td>
      ${state.periods
        .map(
          (period) => `
            <td class="period-total" data-period-total="${period.id}">
              ${formatNumber(computePeriodTotal(period.id))}
            </td>
          `,
        )
        .join("")}
    </tr>
  `;
}

function renderLegend() {
  const legendItems = [
    ...state.sources.map((source, index) => ({
      label: source.name.trim() || `Source ${index + 1}`,
      color: palette[index % palette.length],
    })),
    { label: "Total", color: "#79f2a3" },
  ];

  chartLegendEl.innerHTML = legendItems
    .map(
      (item) => `
        <span class="legend-item">
          <span class="legend-swatch" style="background:${item.color}"></span>
          ${escapeHtml(item.label)}
        </span>
      `,
    )
    .join("");
}

function renderChartControls() {
  projectionToggleEl.textContent = viewState.showProjection
    ? "Hide projection"
    : "Show projection +6 months";

  if (!viewState.showProjection) {
    projectionSummaryEl.textContent = "Projection uses the recent biweekly direction.";
    return;
  }

  const projection = buildProjectionContext();
  if (!projection) {
    projectionSummaryEl.textContent = "Add more filled periods to estimate the next 6 months.";
    return;
  }

  const finalPoint = projection.series.at(-1)?.forecast.at(-1);
  const finalPeriod = projection.projectedPeriods.at(-1);
  if (!finalPoint || !finalPeriod) {
    projectionSummaryEl.textContent = "Add more filled periods to estimate the next 6 months.";
    return;
  }

  projectionSummaryEl.textContent = `6m projection: total ≈ ${formatNumber(finalPoint)} by ${formatAxisDate(finalPeriod.startDate)}`;
}

function renderChart() {
  const chartPeriods = getChartPeriods();

  if (!chartPeriods.length) {
    chartEl.innerHTML = `
      <div class="chart-empty">
        <div>
          <strong>No periods to chart yet.</strong>
          <p>Add a 2-week period to start plotting your data.</p>
        </div>
      </div>
    `;
    return;
  }

  const hasAnyValue = state.sources.some((source) =>
    chartPeriods.some((period) => getAmount(source, period.id) !== 0),
  );

  if (!hasAnyValue) {
    chartEl.innerHTML = `
      <div class="chart-empty">
        <div>
          <strong>Enter amounts to see the trend.</strong>
          <p>The line chart will plot each source and the total row once you add values.</p>
        </div>
      </div>
    `;
    return;
  }

  const width = 1080;
  const height = 360;
  const margin = { top: 28, right: 22, bottom: 62, left: 70 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const projection = viewState.showProjection ? buildProjectionContext(chartPeriods) : null;
  const displayPeriods = projection
    ? [...projection.actualPeriods, ...projection.projectedPeriods]
    : chartPeriods;
  const series = projection ? projection.series : buildActualSeries(chartPeriods);
  const allValues = series.flatMap((item) => [...item.actual, ...(item.forecast || [])]);
  let minValue = Math.min(0, ...allValues);
  let maxValue = Math.max(0, ...allValues);

  if (minValue === maxValue) {
    minValue -= 1;
    maxValue += 1;
  }

  const xForIndex = (index) => {
    if (displayPeriods.length === 1) {
      return margin.left + plotWidth / 2;
    }
    return margin.left + (index * plotWidth) / (displayPeriods.length - 1);
  };

  const yForValue = (value) =>
    margin.top + ((maxValue - value) / (maxValue - minValue)) * plotHeight;

  const tickCount = 5;
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => {
    const value = minValue + ((maxValue - minValue) / tickCount) * index;
    return {
      value,
      y: yForValue(value),
    };
  });

  const zeroY = yForValue(0);

  const gridMarkup = ticks
    .map(
      (tick) => `
        <line class="grid-line" x1="${margin.left}" y1="${tick.y}" x2="${width - margin.right}" y2="${tick.y}" />
        <text class="tick-label" x="${margin.left - 14}" y="${tick.y + 4}" text-anchor="end">
          ${formatNumber(tick.value)}
        </text>
      `,
    )
    .join("");

  const xAxisMarkup = displayPeriods
    .map((period, index) => {
      if (!shouldRenderAxisLabel(index, displayPeriods.length)) {
        return "";
      }
      const x = xForIndex(index);
      return `
        <text class="axis-label" x="${x}" y="${height - 24}" text-anchor="middle">
          ${formatAxisDate(period.startDate)}
        </text>
      `;
    })
    .join("");

  const seriesMarkup = series
    .map((item) => {
      const actualPoints = item.actual.map((value, index) => ({
        x: xForIndex(index),
        y: yForValue(value),
        value,
        period: displayPeriods[index],
      }));
      const actualPath = actualPoints
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
        .join(" ");
      const actualPointMarkup = actualPoints
        .map(
          (point) => `
            <circle
              class="series-point interactive-point"
              cx="${point.x}"
              cy="${point.y}"
              r="${item.label === "Total" ? 5 : 4}"
              fill="${item.color}"
              opacity="${item.opacity}"
              tabindex="0"
              data-chart-point="true"
              data-label="${escapeHtml(item.label)}"
              data-value="${point.value}"
              data-date="${point.period.startDate}"
              data-kind="actual"
            />
          `,
        )
        .join("");

      let forecastMarkup = "";
      if (item.forecast?.length) {
        const forecastPoints = item.forecast.map((value, index) => ({
          x: xForIndex(item.actual.length + index),
          y: yForValue(value),
          value,
          period: projection.projectedPeriods[index],
        }));
        const bridgePoint = actualPoints.at(-1);
        const forecastPath = [bridgePoint, ...forecastPoints]
          .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
          .join(" ");
        const forecastPointMarkup = forecastPoints
          .map(
            (point) => `
              <circle
                class="series-point forecast-point interactive-point"
                cx="${point.x}"
                cy="${point.y}"
                r="${item.label === "Total" ? 4.5 : 3.5}"
                fill="${item.color}"
                opacity="${Math.max(item.opacity - 0.18, 0.45)}"
                tabindex="0"
                data-chart-point="true"
                data-label="${escapeHtml(item.label)}"
                data-value="${point.value}"
                data-date="${point.period.startDate}"
                data-kind="forecast"
              />
            `,
          )
          .join("");

        forecastMarkup = `
          <path
            class="series-line forecast-line"
            d="${forecastPath}"
            stroke="${item.color}"
            stroke-width="${Math.max(item.strokeWidth - 0.5, 2)}"
            opacity="${Math.max(item.opacity - 0.12, 0.55)}"
          />
          ${forecastPointMarkup}
        `;
      }

      return `
        <path
          class="series-line"
          d="${actualPath}"
          stroke="${item.color}"
          stroke-width="${item.strokeWidth}"
          opacity="${item.opacity}"
        />
        ${actualPointMarkup}
        ${forecastMarkup}
      `;
    })
    .join("");

  const projectionDividerMarkup = projection
    ? `
      <line
        class="projection-divider"
        x1="${xForIndex(projection.actualPeriods.length - 1)}"
        y1="${margin.top}"
        x2="${xForIndex(projection.actualPeriods.length - 1)}"
        y2="${height - margin.bottom + 8}"
      />
    `
    : "";

  chartEl.innerHTML = `
    <div class="chart-stage">
      <svg
        class="chart-svg"
        viewBox="0 0 ${width} ${height}"
        role="img"
        aria-label="Line chart of amounts per biweekly period"
      >
        ${gridMarkup}
        <line class="zero-line" x1="${margin.left}" y1="${zeroY}" x2="${width - margin.right}" y2="${zeroY}" />
        ${projectionDividerMarkup}
        ${seriesMarkup}
        ${xAxisMarkup}
      </svg>
      <div class="chart-tooltip" hidden></div>
    </div>
  `;
}

function updateComputedViews() {
  renderSummary();
  updateTableTotals();
  renderLegend();
  renderChartControls();
  renderChart();
}

function updateTableTotals() {
  state.periods.forEach((period) => {
    const cell = document.querySelector(`[data-period-total="${period.id}"]`);
    if (cell) {
      cell.textContent = formatNumber(computePeriodTotal(period.id));
    }
  });

}

function addSource() {
  state.sources.push(createSource(`Source ${state.sources.length + 1}`));
  saveState();
  renderApp();
}

function removeSource(sourceId) {
  if (state.sources.length === 1) {
    return;
  }

  state.sources = state.sources.filter((source) => source.id !== sourceId);
  saveState();
  renderApp();
}

function addPeriod() {
  const nextDate = getNextPeriodDate();
  const period = createPeriod(nextDate);
  state.periods.push(period);
  sortPeriods();
  saveState();
  renderApp();
}

function removePeriod(periodId) {
  if (state.periods.length === 1) {
    return;
  }

  state.periods = state.periods.filter((period) => period.id !== periodId);
  state.sources.forEach((source) => {
    delete source.amounts[periodId];
  });
  saveState();
  renderApp();
}

function computePeriodTotal(periodId) {
  return state.sources.reduce((sum, source) => sum + getAmount(source, periodId), 0);
}

function computeGrandTotal() {
  return state.periods.reduce((sum, period) => sum + computePeriodTotal(period.id), 0);
}

function buildActualSeries(periods) {
  return [
    ...state.sources.map((source, index) => ({
      label: source.name.trim() || `Source ${index + 1}`,
      actual: periods.map((period) => getAmount(source, period.id)),
      forecast: [],
      color: palette[index % palette.length],
      strokeWidth: 2.5,
      opacity: 0.78,
    })),
    {
      label: "Total",
      actual: periods.map((period) => computePeriodTotal(period.id)),
      forecast: [],
      color: "#79f2a3",
      strokeWidth: 4,
      opacity: 1,
    },
  ];
}

function buildProjectionContext(periods = getChartPeriods()) {
  if (!periods.length || periods.length < 2) {
    return null;
  }

  const projectedPeriods = Array.from({ length: FORECAST_PERIOD_COUNT }, (_, index) =>
    createPeriod(addDays(parseISODate(periods.at(-1).startDate), 14 * (index + 1))),
  );
  const actualSeries = buildActualSeries(periods);
  const series = actualSeries.map((item) => ({
    ...item,
    forecast: projectSeries(item.actual, FORECAST_PERIOD_COUNT),
  }));

  return {
    actualPeriods: periods,
    projectedPeriods,
    series,
  };
}

function projectSeries(values, count) {
  if (!values.length) {
    return [];
  }

  const deltas = [];
  for (let index = 1; index < values.length; index += 1) {
    deltas.push(values[index] - values[index - 1]);
  }

  const recentDeltas = deltas.slice(-Math.min(4, deltas.length));
  const averageDelta = recentDeltas.length
    ? recentDeltas.reduce((sum, delta) => sum + delta, 0) / recentDeltas.length
    : 0;

  let current = values.at(-1);
  return Array.from({ length: count }, () => {
    current = Math.max(0, current + averageDelta);
    return current;
  });
}

function getAmount(source, periodId) {
  return toNumber(source.amounts[periodId]);
}

function getChartPeriods() {
  const lastIndex = findLastFilledPeriodIndex();
  if (lastIndex === -1) {
    return state.periods.slice();
  }
  return state.periods.slice(0, lastIndex + 1);
}

function findLastFilledPeriodIndex() {
  for (let index = state.periods.length - 1; index >= 0; index -= 1) {
    if (computePeriodTotal(state.periods[index].id) !== 0) {
      return index;
    }
  }
  return -1;
}

function shouldRenderAxisLabel(index, total) {
  if (total <= 8) {
    return true;
  }

  if (index === 0 || index === total - 1) {
    return true;
  }

  return index % 2 === 0;
}

function showChartTooltip(point, position) {
  const tooltip = chartEl.querySelector(".chart-tooltip");
  if (!tooltip) {
    return;
  }

  const label = point.dataset.label || "";
  const value = formatNumber(point.dataset.value);
  const date = formatRangeLabel(point.dataset.date);
  const kind = point.dataset.kind === "forecast" ? "Projected" : "Actual";

  tooltip.innerHTML = `
    <strong>${escapeHtml(label)}</strong>
    <span>${kind}</span>
    <span>${escapeHtml(date)}</span>
    <span>${escapeHtml(value)}</span>
  `;

  tooltip.hidden = false;
  tooltip.classList.toggle("is-forecast", point.dataset.kind === "forecast");

  const chartBounds = chartEl.getBoundingClientRect();
  const tooltipBounds = tooltip.getBoundingClientRect();
  const left = Math.min(
    Math.max(position.clientX - chartBounds.left + 12, 8),
    chartBounds.width - tooltipBounds.width - 8,
  );
  const top = Math.max(position.clientY - chartBounds.top - tooltipBounds.height - 12, 8);

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideChartTooltip() {
  const tooltip = chartEl.querySelector(".chart-tooltip");
  if (!tooltip) {
    return;
  }

  tooltip.hidden = true;
}

function getNextPeriodDate() {
  const lastPeriod = state.periods[state.periods.length - 1];
  const fallback = stripTime(new Date());
  if (!lastPeriod) {
    return fallback;
  }
  return addDays(parseISODate(lastPeriod.startDate), 14);
}

function findSource(sourceId) {
  return state.sources.find((source) => source.id === sourceId);
}

function findPeriod(periodId) {
  return state.periods.find((period) => period.id === periodId);
}

function loadState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return createDefaultState();
    }

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.sources) || !Array.isArray(parsed.periods)) {
      return createDefaultState();
    }

    return normalizeState(parsed);
  } catch {
    return createDefaultState();
  }
}

function saveState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeState(input) {
  const normalized = {
    sources: input.sources.map((source, index) => ({
      id: source.id || createId("source"),
      name: typeof source.name === "string" ? source.name : `Source ${index + 1}`,
      amounts: source.amounts && typeof source.amounts === "object" ? source.amounts : {},
    })),
    periods: input.periods.map((period) => ({
      id: period.id || createId("period"),
      startDate: isISODate(period.startDate) ? period.startDate : formatISODate(stripTime(new Date())),
    })),
  };

  if (!normalized.sources.length || !normalized.periods.length) {
    return createDefaultState();
  }

  sortPeriods(normalized.periods);
  return normalized;
}

function sortPeriods(periods = state.periods) {
  periods.sort((left, right) => left.startDate.localeCompare(right.startDate));
}

function createDefaultState() {
  const periods = createDefaultPeriods(6);
  return {
    periods,
    sources: [
      createSource("Salary"),
      createSource("Freelance"),
      createSource("Savings"),
      createSource("Other"),
    ],
  };
}

function createDefaultPeriods(count) {
  const base = stripTime(new Date());
  const start = addDays(base, -14 * (count - 1));
  return Array.from({ length: count }, (_, index) => createPeriod(addDays(start, index * 14)));
}

function createSource(name, amounts = {}) {
  return {
    id: createId("source"),
    name,
    amounts,
  };
}

function createPeriod(date) {
  return {
    id: createId("period"),
    startDate: formatISODate(date),
  };
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatRangeLabel(startDate) {
  const start = parseISODate(startDate);
  const end = addDays(start, 13);
  return `${formatLongDate(start)} to ${formatLongDate(end)}`;
}

function formatAxisDate(startDate) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(parseISODate(startDate));
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatNumber(value) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function formatISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseISODate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isISODate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function stripTime(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toNumber(value) {
  if (value === "" || value == null) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
