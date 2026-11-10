const snapshot = JSON.parse(document.getElementById('companyData').textContent);
const companies = snapshot.companies;
const byId = id => document.getElementById(id);
const tabs = [...document.querySelectorAll('.tab')];
const sections = [...document.querySelectorAll('.section')];
const byCompanyId = new Map(companies.map(company => [String(company.id), company]));
const aliasIndex = new Map();
for (const company of companies) {
  for (const alias of [...company.a, company.n, ...company.t]) aliasIndex.set(normalizeSearch(alias), company);
}
let visibleCount = 12;

function setText(id, value) { byId(id).textContent = value; }
function fullAmount(value) {
  if (value === null || value === undefined) return 'Not supplied';
  return (value < 0 ? '−' : '') + '$' + Math.abs(value).toLocaleString('en-US', {maximumFractionDigits: 8});
}
function amount(value) {
  if (value === null || value === undefined) return 'Not supplied';
  const absolute = Math.abs(value);
  const [divisor, suffix] = absolute >= 1e9 ? [1e9, 'B'] : absolute >= 1e6 ? [1e6, 'M'] : absolute >= 1e3 ? [1e3, 'K'] : [1, ''];
  return (value < 0 ? '−' : '') + '$' + (absolute / divisor).toLocaleString('en-US', {maximumFractionDigits: 3}) + suffix;
}
function signed(value, suffix = '') {
  return (value > 0 ? '+' : value < 0 ? '−' : '') + Math.abs(value).toFixed(2) + suffix;
}
function change(fact) {
  if (fact[1] === null) return 'Prior comparison not supplied';
  return fact[5] === null ? `${signedAmount(fact[6])} change; prior ≤ 0` : `${signed(fact[5], '%')} vs. prior year`;
}
function signedAmount(value) { return (value > 0 ? '+' : '') + amount(value); }
function metricLabel(metric, company) {
  if (company.labels?.[metric]) return company.labels[metric];
  if (metric === 'revenue') {
    const tag = company.m.revenue[2];
    if (tag === 'RevenuesNetOfInterestExpense') return 'Net revenue';
    if (tag.startsWith('RevenueFromContract')) return 'Contract revenue';
    return 'Revenue';
  }
  if (metric === 'income' && company.m.income[2] === 'ProfitLoss') return 'Consolidated profit (loss)';
  return {income: 'Net income (loss)', operating: 'Operating income (loss)', cash: 'Operating cash flow', capex: 'PP&E cash spending', eps: 'Diluted EPS'}[metric];
}
function filingUrl(company, accession) {
  return `https://www.sec.gov/Archives/edgar/data/${company.id}/${accession.replaceAll('-', '')}/${accession}-index.html`;
}
function activateTab(id) {
  tabs.forEach(tab => {
    const active = tab.dataset.tab === id;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  sections.forEach(section => section.classList.toggle('active', section.id === id));
}
function showScreen(screen) {
  explorer.screen = screen;
  byId('welcome').style.display = screen === 'welcome' ? 'flex' : 'none';
  byId('workspace').style.display = screen === 'workspace' ? 'block' : 'none';
  byId('notFound').style.display = screen === 'notFound' ? 'block' : 'none';
  byId('compareScreen').hidden = screen !== 'compare';
  byId('savedScreen').hidden = screen !== 'saved';
  refreshSelectionControls();
}
function getMatches(query, sector) {
  const normalized = normalizeSearch(query);
  return companies.filter(company => (!sector || company.s === sector) &&
    (!normalized || [...company.a, company.n, ...company.t].some(alias => normalizeSearch(alias).includes(normalized))));
}
function renderResults() {
  const matches = directoryMatches();
  setText('resultCount', `${matches.length} matching companies · ${companies.length} available in this version`);
  byId('companyResults').innerHTML = matches.slice(0, visibleCount).map(directoryCard).join('') || `<p class="directoryEmpty">${explorer.view === 'saved' && !explorer.saved.size ? 'Your saved list starts here. Choose Save on a company card to keep it for later.' : 'No supported matches. Try another name, ticker or sector.'}</p>`;
  byId('moreCompanies').hidden = visibleCount >= matches.length;
}
function searchCompany() {
  const query = byId('searchInput').value;
  const exact = aliasIndex.get(normalizeSearch(query));
  if (exact) return renderCompany(exact);
  const matches = directoryMatches();
  if (matches.length === 1) return renderCompany(matches[0]);
  if (matches.length) {showScreen('welcome'); renderResults();}
  else showScreen('notFound');
}
function reset() {
  showScreen('welcome');
  byId('searchInput').value = '';
  byId('sectorFilter').value = '';
  explorer.view = 'all';
  featureNotice('');
  refreshSelectionControls();
  visibleCount = 12;
  renderResults();
  byId('searchInput').focus();
}

function analysisFor(company) {
  const revenue = company.m.revenue, income = company.m.income;
  const label = metricLabel('revenue', company).toLowerCase();
  const ratios = company.r;
  const marginChange = ratios[0] - ratios[1];
  const cash = company.m.cash;
  const insights = [
    [`${metricLabel('revenue', company)} movement`, `${metricLabel('revenue', company)} was ${amount(revenue[0])}, compared with ${amount(revenue[1])}: ${signed(revenue[5], '%')}. This measures reported annual activity, not the stock's return.`],
    ['Earnings direction', `${metricLabel('income', company)} was ${amount(income[0])}, compared with ${amount(income[1])}. ${income[0] >= 0 && income[1] < 0 ? 'The reported result moved from a loss to a profit.' : income[0] < 0 && income[1] >= 0 ? 'The reported result moved from a profit to a loss.' : `The absolute movement was ${signedAmount(income[6])}.`} A percentage change is omitted when the prior value is zero or negative.`],
    ['Income relative to reported revenue', `Income divided by the selected ${label} measure was ${ratios[0].toFixed(2)}%, versus ${ratios[1].toFixed(2)}%: ${signed(marginChange, ' percentage points')}. This is an analytical ratio; the selected revenue definition is shown in Sources.`],
    ['Operating cash flow', cash ? `Reported operating cash flow was ${amount(cash[0])}${cash[1] === null ? '; a matching prior value was not supplied.' : `, versus ${amount(cash[1])}.`} ${cash[0] < 0 ? 'Operating activities used cash during the period.' : 'Operating activities generated cash during the period.'} This is different from accounting income.` : 'A matching operating cash-flow fact was not available under the selected standard concept. No amount is estimated.'],
  ];
  const report = companyReportFor(company);
  const supportedEvidence = report && report.evidence.length >= 3;
  const deepAnalysis = supportedEvidence ? detailedCompanyAnalysis(company, report) : detailedAnnualAnalysis(company, marginChange);
  const operatingInsights = supportedEvidence ? report.evidence.map(item => [item.label, `${item.text} ${item.implication}`]) : null;
  return {insights, operatingInsights, deepAnalysis, marginChange, report};
}

function renderCompany(company) {
  explorer.company = company;
  updateCompanyTools();
  if (company.profile) return renderCuratedCompany(company, snapshot.curated[company.profile]);
  setReportingLabels(false);
  const revenue = company.m.revenue, income = company.m.income;
  const {insights, operatingInsights, deepAnalysis, marginChange, report} = analysisFor(company);
  setText('logoBox', company.n.slice(0, 1));
  setText('companyName', company.n);
  setText('ticker', company.t.join(' / '));
  setText('periodMain', `Year ended ${company.p[0][1]}`);
  setText('periodEnd', `Prior year ended ${company.p[1][1]}`);
  setText('overviewSub', `${company.s} · Matched annual SEC facts · ${company.p[0][0]} to ${company.p[0][1]}`);
  const fourth = company.m.cash ? 'cash' : company.m.eps ? 'eps' : company.m.operating ? 'operating' : null;
  const metrics = [
    [metricLabel('revenue', company), amount(revenue[0]), change(revenue), revenue[5] < 0 ? 'neg' : 'pos'],
    [metricLabel('income', company), amount(income[0]), change(income), income[6] < 0 ? 'neg' : 'pos'],
    ['Income / revenue', `${company.r[0].toFixed(2)}%`, `${signed(marginChange, ' pts')} vs. prior year`, marginChange < 0 ? 'neg' : 'pos'],
    fourth ? [metricLabel(fourth, company), fourth === 'eps' ? fullAmount(company.m[fourth][0]) : amount(company.m[fourth][0]), change(company.m[fourth]), 'neutral'] : ['Annual coverage', '2 periods', 'Matched revenue and income', 'neutral'],
  ];
  byId('metrics').innerHTML = metrics.map(([label, value, delta, tone]) => `<div class="metric"><div class="metricLabel">${escapeHtml(label)}</div><div class="metricValue">${escapeHtml(value)}</div><div class="metricDelta ${tone}">${escapeHtml(delta)}</div></div>`).join('');
  const signals = [['Reported revenue', revenue[5] < 0 ? 'Lower' : revenue[5] > 0 ? 'Higher' : 'Unchanged'], ['Reported income', income[0] < 0 ? 'Loss' : income[0] > 0 ? 'Profit' : 'Break-even'], ['Income / revenue', marginChange < 0 ? 'Lower ratio' : marginChange > 0 ? 'Higher ratio' : 'Unchanged'], ['Operating cash flow', company.m.cash ? company.m.cash[0] < 0 ? 'Cash used' : company.m.cash[0] > 0 ? 'Cash generated' : 'Zero' : 'Not supplied'], ['Reporting basis', 'Annual · USD']];
  byId('health').innerHTML = signals.map(([label, value]) => `<div class="healthRow"><div class="rowLabel">${escapeHtml(label)}</div><div class="rowValue">${escapeHtml(value)}</div></div>`).join('');
  setText('overviewExplainTitle', revenue[5] === 0 || income[6] === 0 ? 'Read the annual changes together.' : revenue[5] > 0 && income[6] < 0 ? 'Reported revenue increased, while income fell.' : revenue[5] < 0 && income[6] > 0 ? 'Reported revenue fell, while income improved.' : revenue[5] > 0 ? 'Reported revenue and income moved higher.' : 'Reported revenue and income moved lower.');
  setText('overviewExplainText', `${insights[0][1]} ${insights[1][1]} The figures describe what changed; the filing is needed to investigate why.`);
  const order = ['revenue', 'income', 'operating', 'cash', 'capex', 'eps'];
  byId('financialTable').innerHTML = order.filter(key => company.m[key]).map(key => {
    const fact = company.m[key];
    return `<tr><td>${escapeHtml(metricLabel(key, company))}</td><td>${escapeHtml(fullAmount(fact[0]))}</td><td>${escapeHtml(fullAmount(fact[1]))}</td><td>${escapeHtml(change(fact))}</td></tr>`;
  }).join('');
  setText('financialExplainTitle', 'Use the same dates and accounting definition.');
  setText('financialExplainText', 'Both columns use the same measure and annual fiscal periods. Paired GAAP amounts from the company publication are used where verified; other measures retain the saved SEC comparison. Release figures retain the publisher’s rounding. Percentage growth is shown only when the prior value is positive. Negative results keep their sign. Currency figures are USD; diluted EPS is USD per share. Revenue and income definitions are named explicitly and can vary by business.');
  setText('marketContext', 'Company classification');
  byId('marketRows').innerHTML = [['Sector', company.s], ['Industry', company.i], ['Share listings', company.t.join(' / ')], ['Reporting currency', 'USD'], ['Current annual period', company.p[0].join(' to ')], ['Prior annual period', company.p[1].join(' to ')]].map(([label, value]) => `<div class="marketRow"><div class="rowLabel">${escapeHtml(label)}</div><div class="rowValue">${escapeHtml(value)}</div></div>`).join('');
  setText('marketExplainTitle', 'Classification provides context, not a share-price forecast.');
  setText('marketExplainText', 'The company roster is cross-checked against official SPY holdings. This version does not contain share-price returns or company-specific regional, product, or customer segments. Those require separate source extraction, so no segment results are invented.');
  if (operatingInsights) {
    setText('sourceBasis', report.status === 'verified' ? 'Company results and SEC data' : 'Company results · limited review');
    setText('overviewSub', `${company.s} · Annual company results · ${company.p[0][0]} to ${company.p[0][1]}`);
    setText('overviewExplainTitle', report.focus_title);
    setText('overviewExplainText', report.evidence.slice(0, 2).map(item => item.text).join(' '));
    setText('insightsSubtitle', 'Business results from the company’s annual publications and what they mean.');
    const operatingMeasures = report.evidence.filter(item => item.metric_label && item.metric_value);
    if (operatingMeasures.length) {
      setText('marketsSubtitle', 'Reported business activity, operating drivers, and market context.');
      setText('marketPanelTitle', 'Business performance');
      setText('marketContext', `Year ended ${report.period_end}`);
      byId('marketRows').innerHTML = operatingMeasures.map(item => `<div class="marketRow"><div class="rowLabel">${escapeHtml(item.metric_label)}</div><div class="rowValue">${escapeHtml(item.metric_value)}</div></div>`).join('');
      setText('marketExplainTitle', report.focus_title);
      setText('marketExplainText', report.focus_text);
    }
  }
  byId('insightGrid').innerHTML = (operatingInsights ?? insights).map(([title, text], index) => `<div class="insightCard"><div class="insightNum">${String(index + 1).padStart(2, '0')}</div><h4>${escapeHtml(title)}</h4><p>${escapeHtml(text)}</p></div>`).join('');
  renderDeepAnalysis(deepAnalysis);
  renderSources(company);
  renderCharts(company);
  activateTab('overview');
  showScreen('workspace');
}

function renderSources(company) {
  const documents = new Map();
  const secFacts = company.sec_m ?? company.m;
  for (const [metric, fact] of Object.entries(secFacts)) {
    for (const [position, accession] of [[0, fact[3]], [1, fact[4]]]) {
      if (!accession) continue;
      if (!documents.has(accession)) documents.set(accession, {years: new Set(), measures: new Set()});
      documents.get(accession).years.add(company.p[position][1]);
      documents.get(accession).measures.add(metricLabel(metric, company));
    }
  }
  const report = companyReportFor(company);
  const primary = (report?.sources ?? []).map(source => ({title: source.title,
    meta: `${source.publisher} · Year ended ${source.period_end}${source.published ? ` · Published ${source.published}` : ''}${source.access === 'opened' ? '' : ' · Limited source excerpt'}`,
    type: source.kind, url: source.url}));
  const primaryUrls = new Set(primary.map(source => source.url));
  const publications = company.t.flatMap(ticker => snapshot.publications?.[ticker] ?? []).filter(source => !primaryUrls.has(source.url));
  const sources = [...primary, ...publications, ...[...documents].map(([accession, document]) => ({
    title: `${company.n} — reported financial results`,
    meta: `SEC company filing · Annual periods ended ${[...document.years].sort().reverse().join(' and ')} · ${[...document.measures].join(', ')}`,
    type: 'Regulatory source', url: filingUrl(company, accession),
  })), {title: `${company.n} filings on SEC EDGAR`, meta: `U.S. Securities and Exchange Commission · CIK ${company.id}`, type: 'Regulatory source', url: `https://www.sec.gov/edgar/browse/?CIK=${company.id}&owner=exclude`}];
  const publishedMapping = Object.entries(report?.financials ?? {}).map(([key, fact]) => {
    const source = report.sources.find(source => source.id === fact.source_id);
    return `<tr><td>${escapeHtml(fact.label)}</td><td>${fact.method === 'sum_components' ? 'Calculated from published GAAP components' : 'Company reported GAAP'} · ${escapeHtml(fact.unit)}</td><td><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">Company annual comparison ↗</a></td></tr>`;
  }).join('');
  const mapping = publishedMapping + Object.entries(secFacts).map(([key, fact]) => `<tr><td>${escapeHtml(key)} · SEC reference</td><td>${escapeHtml(fact[2])}</td><td><a href="https://data.sec.gov/api/xbrl/frames/us-gaap/${fact[2]}/${key === 'eps' ? 'USD-per-shares' : 'USD'}/CY2025.json" target="_blank" rel="noopener noreferrer">Current frame ↗</a>${fact[1] === null ? '' : `<br><a href="https://data.sec.gov/api/xbrl/frames/us-gaap/${fact[2]}/${key === 'eps' ? 'USD-per-shares' : 'USD'}/CY2024.json" target="_blank" rel="noopener noreferrer">Prior frame ↗</a>`}</td></tr>`).join('');
  const companyNote = report?.evidence.length
    ? `Business observations come from the linked company publications for the year ended ${report.period_end}. Business recommendations and focus steps are CDS analysis. Adjusted measures and management outlook are identified separately from reported GAAP results.${report.status === 'partial' ? ' Some source material was available only as a limited excerpt; review the full publication before relying on it.' : ''}`
    : 'Company-specific operating evidence has not yet been verified for this annual period. The analysis therefore uses the matched financial totals and identifies further checks.';
  byId('sourceList').innerHTML = sourceCards(sources) + `<details class="sourceDetails"><summary>Calculation and data notes</summary><div class="sourceNotes"><p>${escapeHtml(companyNote)}</p>${report?.notes ? `<p>${escapeHtml(report.notes)}</p>` : ''}<p>The financial table and charts use paired company-reported GAAP amounts where verified, with saved SEC facts for remaining measures. The source map identifies both. Company definitions and rounded release figures can differ from SEC concepts or later revisions; the named measures should be read before comparison.</p><p>Contract revenue can differ from total revenue. Income/revenue is calculated using the displayed income and revenue measures, with the same definitions in both years.</p><p>Roster metadata: <a href="https://en.wikipedia.org/wiki/List_of_S%26P_500_companies" target="_blank" rel="noopener noreferrer">S&P 500 company list</a>, cross-checked against <a href="https://www.ssga.com/us/en/individual/etfs/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx" target="_blank" rel="noopener noreferrer">official SPY holdings</a> dated October 13, 2026.</p></div><div class="tableWrap"><table class="dataTable sourceMapping"><thead><tr><th>Measure</th><th>Definition</th><th>Publication</th></tr></thead><tbody>${mapping}</tbody></table></div></details>`;
}

byId('analyzeBtn').addEventListener('click', searchCompany);
byId('searchInput').addEventListener('keydown', event => {if (event.key === 'Enter' && !event.isComposing) searchCompany();});
byId('searchInput').addEventListener('input', () => {visibleCount = 12; renderResults();});
byId('sectorFilter').innerHTML = '<option value="">All sectors</option>' + [...new Set(companies.map(c => c.s))].sort().map(sector => `<option value="${escapeHtml(sector)}">${escapeHtml(sector)}</option>`).join('');
byId('sectorFilter').addEventListener('change', () => {visibleCount = 12; renderResults();});
byId('companyResults').addEventListener('click', handleDirectoryClick);
byId('moreCompanies').addEventListener('click', () => {visibleCount += 12; renderResults();});
for (const id of ['brandHome', 'backBtn']) byId(id).addEventListener('click', reset);
document.querySelector('.tabs').setAttribute('role', 'tablist');
tabs.forEach((tab, position) => {
  tab.id = `tab_${tab.dataset.tab}`;
  tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', tab.dataset.tab);
  byId(tab.dataset.tab).setAttribute('role', 'tabpanel'); byId(tab.dataset.tab).setAttribute('aria-labelledby', tab.id);
  tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  tab.addEventListener('keydown', event => {
    const next = {ArrowRight: (position + 1) % tabs.length, ArrowLeft: (position + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1}[event.key];
    if (next !== undefined) {event.preventDefault(); activateTab(tabs[next].dataset.tab); tabs[next].focus();}
  });
});
setText('coverageText', `${companies.length} companies available · Source linked financial data · Browse by sector`);
setText('notFoundDetail', `Search the original ten company profiles or the expanded S&P 500 coverage. ${snapshot.coverage.excluded_companies} index companies remain excluded because matched annual figures were unavailable.`);
activateTab('overview');
initializeExplorer();
renderResults();
