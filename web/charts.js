function comparisonMarkup(items, options = {}) {
  if (!items.length) return '<p class="chartNote">No comparable measures are available.</p>';
  const values = items.flatMap(item => [item.current, item.prior]).filter(value => value !== null);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const range = maximum - minimum || 1;
  const zero = -minimum / range * 100;
  const groups = items.map(item => {
    const rows = ['current', 'prior'].map(period => {
      const value = item[period];
      const missing = value === null;
      const width = missing ? 0 : Math.abs(value) / range * 100;
      const left = missing ? zero : (Math.min(0, value) - minimum) / range * 100;
      return `<div class="compareRow"><span class="comparePeriod">${period === 'current' ? 'Current' : 'Prior year'}</span>
        <span class="compareTrack" aria-hidden="true"><span class="compareZero" style="left:${zero}%"></span><span class="compareFill ${period}" style="left:${left}%;width:${width}%"></span></span>
        <span class="compareValue" title="${escapeHtml(missing ? 'Not supplied' : item[period + 'Label'] ?? fullAmount(value))}">${escapeHtml(missing ? 'Not supplied' : item[period + 'Label'] ?? amount(value))}</span></div>`;
    }).join('');
    return `<div class="compareGroup"><div class="compareName">${escapeHtml(item.name)}</div>${rows}</div>`;
  }).join('');
  const divisor = options.divisor ?? 1e9;
  return `<div class="compareScale"><span>${escapeHtml(options.unit ?? 'USD billions')}</span><span>${(minimum / divisor).toLocaleString('en-US', {maximumFractionDigits: 2})} to ${(maximum / divisor).toLocaleString('en-US', {maximumFractionDigits: 2})}</span></div>${groups}`;
}

function renderCharts(company) {
  const available = ['revenue', 'income', 'operating', 'cash', 'capex'].filter(metric => company.m[metric]);
  const items = available.map(metric => ({name: metricLabel(metric, company), current: company.m[metric][0], prior: company.m[metric][1]}));
  byId('barChart').innerHTML = comparisonMarkup(items.filter((item, i) => ['revenue', 'income', 'cash'].includes(available[i])));
  byId('financialBarChart').innerHTML = comparisonMarkup(items);
  const note = 'The periods share one scale; losses extend left of zero. Display values are rounded. Financials shows full reported amounts. Missing values are not plotted.';
  byId('overviewChartNote').textContent = note;
  byId('financialChartNote').textContent = note;
}
