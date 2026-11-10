const comparisonSearchFields = ['comparisonFirst', 'comparisonSecond', 'comparisonThird'];

function selectedComparisonCompanies() {
  return explorer.selected.map(id => byCompanyId.get(id)).filter(hasAnnualComparison);
}

function clearComparisonSearchError() {
  setText('comparisonSearchError', '');
  byId('comparisonSearchError').hidden = true;
  for (const id of comparisonSearchFields) byId(id).setAttribute('aria-invalid', 'false');
}

function syncComparisonSearch() {
  const rows = selectedComparisonCompanies();
  comparisonSearchFields.forEach((id, index) => {byId(id).value = rows[index]?.t[0] ?? '';});
  clearComparisonSearchError();
}

function findComparisonCompany(query) {
  if (!normalizeSearch(query)) return null;
  const exact = aliasIndex.get(normalizeSearch(query));
  if (exact) return exact;
  const matches = getMatches(query, '');
  return matches.length === 1 ? matches[0] : null;
}

function compareFromSearch() {
  clearComparisonSearchError();
  const fields = comparisonSearchFields.filter((id, index) => index < 2 || normalizeSearch(byId(id).value));
  const rows = fields.map(id => findComparisonCompany(byId(id).value));
  let index = rows.findIndex(company => !hasAnnualComparison(company));
  let message = '';
  if (index !== -1) {
    message = rows[index] ? `Annual comparison data is not available for ${rows[index].n}. Choose another company.`
      : `Enter a supported company name or ticker for Company ${index + 1}. Choose a suggestion if the name is incomplete.`;
  } else {
    const seen = new Set();
    index = rows.findIndex(company => {
      const duplicate = seen.has(company.id);
      seen.add(company.id);
      return duplicate;
    });
    if (index !== -1) message = 'Choose different companies for each search box.';
  }
  if (message) {
    setText('comparisonSearchError', message); byId('comparisonSearchError').hidden = false;
    byId(fields[index]).setAttribute('aria-invalid', 'true'); byId(fields[index]).focus();
    return false;
  }
  openComparison(rows.map(company => company.id));
  return true;
}

function comparisonMeasure(company, metric) {
  if (metric === 'growth') return company.m.revenue[5];
  if (metric === 'ratio') return company.r[0];
  return company.m.cash?.[0] ?? null;
}

function comparisonBars(rows, metric) {
  const unit = metric === 'cash' ? 'USD' : '%';
  const values = rows.map(c => comparisonMeasure(c, metric)).filter(Number.isFinite);
  if (!values.length) return '<p class="chartNote">This measure was not supplied for the selected companies.</p>';
  const min = Math.min(0, ...values), max = Math.max(0, ...values), range = max - min || 1;
  const zero = -min / range * 100;
  const label = value => value === null ? 'Not supplied' : unit === 'USD' ? amount(value) : signed(value, '%');
  return `<div class="peerScale"><span>${metric === 'growth' ? 'Annual revenue change' : metric === 'ratio' ? 'Income / revenue' : 'Operating cash flow'}</span><span>${escapeHtml(unit)}</span></div>` + rows.map(company => {
    const value = comparisonMeasure(company, metric);
    const width = value === null ? 0 : Math.abs(value) / range * 100;
    const left = value === null ? zero : (Math.min(0, value) - min) / range * 100;
    return `<div class="peerRow"><div><strong>${escapeHtml(company.t[0])}</strong><span>${escapeHtml(company.n)}</span></div><div class="peerTrack" aria-hidden="true"><i class="peerZero" style="left:${zero}%"></i><i class="peerFill" style="left:${left}%;width:${width}%"></i></div><strong class="peerValue">${escapeHtml(label(value))}</strong></div>`;
  }).join('');
}

function comparisonCell(company, metric) {
  const fact = company.m[metric];
  if (!fact) return '<td class="missingCell">Not supplied</td>';
  return `<td><strong class="comparisonValue">${escapeHtml(metric === 'eps' ? fullAmount(fact[0]) : amount(fact[0]))}</strong><span class="comparisonDefinition">${escapeHtml(metricLabel(metric, company))}</span><span class="comparisonChange">${escapeHtml(change(fact))}</span></td>`;
}

function renderCompanyComparison() {
  const rows = selectedComparisonCompanies();
  const ready = rows.length >= 2;
  byId('comparisonSelection').innerHTML = selectionChips();
  byId('comparisonEmpty').hidden = ready;
  byId('comparisonContent').hidden = !ready;
  byId('comparisonContent').setAttribute('data-company-count', String(rows.length));
  if (!ready) return;
  byId('peerChart').innerHTML = comparisonBars(rows, byId('comparisonMetric').value || 'growth');
  const crossSector = new Set(rows.map(c => c.s)).size > 1;
  setText('comparisonContext', crossSector
    ? 'Different sectors are selected. Business models and revenue definitions differ, so read the measure labels before drawing comparisons.'
    : `${rows[0].s} · Annual results. Fiscal dates and accounting definitions can differ between companies; read the labels below.`);
  byId('comparisonTableHead').innerHTML = '<tr><th scope="col">Annual measure</th>' + rows.map(company => `<th scope="col"><span class="comparisonTicker">${escapeHtml(company.t[0])}</span><strong>${escapeHtml(company.n)}</strong><span class="comparisonPeriod">${escapeHtml(company.p[0].join(' to '))}</span><span class="comparisonPrior">Prior: ${escapeHtml(company.p[1].join(' to '))}</span><button class="textButton" type="button" data-open-report="${company.id}">Open report ↗</button></th>`).join('') + '</tr>';
  const financialRows = [['revenue','Revenue'],['income','Income'],['operating','Operating result'],['cash','Operating cash'],['capex','PP&E cash spending'],['eps','Diluted EPS']];
  byId('comparisonTableBody').innerHTML = financialRows.map(([metric, label]) => `<tr><th scope="row">${label}<span class="rowUnit">${metric === 'eps' ? 'USD per share' : 'USD'}</span></th>${rows.map(company => comparisonCell(company, metric)).join('')}</tr>`).join('') + `<tr><th scope="row">Income / revenue<span class="rowUnit">Calculated ratio</span></th>${rows.map(company => `<td><strong class="comparisonValue">${company.r[0].toFixed(2)}%</strong><span class="comparisonDefinition">Using the displayed income and revenue</span><span class="comparisonChange">Prior year ${company.r[1].toFixed(2)}%</span></td>`).join('')}</tr>`;
}
