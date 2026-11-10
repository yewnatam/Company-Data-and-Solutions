function curatedUnit(items) {
  const labels = items.map(item => item.currentLabel + ' ' + item.priorLabel).join(' ');
  if (labels.includes('NT$')) return 'TWD billions';
  if (labels.includes('$')) return 'USD billions';
  if (items.some(item => item.prior === 100) && /index|base/i.test(labels)) return 'Index · prior year = 100';
  return 'Percent';
}

function renderCuratedCharts(profile) {
  for (const [field, target, note] of [['chart','barChart','overviewChartNote'], ['financialChart','financialBarChart','financialChartNote']]) {
    const unit = curatedUnit(profile[field]);
    const items = profile[field].map(item => {
      const missing = item.prior === 0 && /prior.year base|not shown|not available/i.test(item.priorLabel);
      const indexed = unit.startsWith('Index');
      return {...item, prior: missing ? null : item.prior,
        currentLabel: indexed && !/index/i.test(item.currentLabel) ? `${item.current} · ${item.currentLabel}` : item.currentLabel,
        priorLabel: indexed && !/index/i.test(item.priorLabel) ? '100 · base' : item.priorLabel};
    });
    byId(target).innerHTML = comparisonMarkup(items, {unit, divisor: 1});
    byId(note).textContent = items.some(item => item.prior === null)
      ? 'Not supplied means unavailable in the snapshot. It is not plotted as a measured zero.'
      : unit.startsWith('Index') ? 'An index of 104 means 4% above the prior-year base of 100. These bars show indexed movement, not revenue amounts.'
      : 'Both periods share one scale. Values and currency units are shown beside the bars.';
  }
}

function sourceCards(sources) {
  return sources.map(source => `<div class="sourceCard"><div><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)} ↗</a><div class="sourceMeta">${escapeHtml(source.meta)}</div></div><div class="sourceType">${escapeHtml(source.type)}</div></div>`).join('');
}

function renderDeepAnalysis(analysis) {
  setText('deepHeadline', analysis.headline);
  setText('deepSummary', analysis.summary);
  setText('deepFocusTitle', analysis.focusTitle);
  setText('deepFocusText', analysis.focusText);
  byId('deepGrid').innerHTML = analysis.cards.map(card => `<div class="deepCard"><div class="deepCardTop"><div class="deepLabel">${escapeHtml(card.label)}</div><div class="deepPriority ${escapeHtml(card.tone)}">${escapeHtml(card.priority)}</div></div><h4>${escapeHtml(card.title)}</h4><p>${escapeHtml(card.text)}</p><ul class="focusList">${card.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`).join('');
}

function setReportingLabels(curated) {
  setText('periodLabel', curated ? 'Latest reporting period' : 'Annual reporting period');
  setText('sourceBasis', curated ? 'Company reporting snapshot' : 'SEC annual snapshot');
  setText('comparisonHeading', curated ? 'Quarter comparison' : 'Annual comparison');
  setText('comparisonPeriod', curated ? 'Current vs. prior-year period' : 'Current vs. prior annual period');
  setText('financialPeriod', curated ? 'Current vs. prior-year period' : 'Current vs. prior annual period');
  setText('financialSubtitle', curated ? 'Key reported metrics and year-over-year movement.' : 'Full reported USD amounts and matched annual comparisons. EPS is USD per share.');
  setText('marketsSubtitle', curated ? 'Performance by channel, geography, or major business area.' : 'Company classification and reporting context for interpreting the figures.');
  setText('marketPanelTitle', curated ? 'Market signals' : 'Market context');
  setText('insightsSubtitle', curated ? 'Important takeaways from the reported data.' : 'Calculated changes and explanations from matched annual SEC facts.');
  setText('deepSubtitle', 'What stands out, what could improve, and where to focus next.');
  setText('sourcesSubtitle', 'Company publications and filings supporting the figures in this report.');
}

function renderCuratedCompany(company, profile) {
  setReportingLabels(true);
  setText('logoBox', profile.logo);
  setText('companyName', profile.name);
  setText('ticker', profile.ticker);
  const [period, ending = ''] = profile.period.split(' · ');
  setText('periodMain', period); setText('periodEnd', ending);
  for (const [id, text] of Object.entries({overviewSub: profile.overviewSub,
    overviewExplainTitle: profile.overviewExplainTitle, overviewExplainText: profile.overviewExplainText,
    financialExplainTitle: profile.financialExplainTitle, financialExplainText: profile.financialExplainText,
    marketContext: profile.marketContext, marketExplainTitle: profile.marketExplainTitle,
    marketExplainText: profile.marketExplainText})) setText(id, text);
  byId('metrics').innerHTML = profile.metrics.map(metric => `<div class="metric"><div class="metricLabel">${escapeHtml(metric.label)}</div><div class="metricValue">${escapeHtml(metric.value)}</div><div class="metricDelta ${escapeHtml(metric.tone)}">${escapeHtml(metric.delta)}</div></div>`).join('');
  byId('health').innerHTML = profile.health.map(signal => `<div class="healthRow"><div class="rowLabel">${escapeHtml(signal.label)}</div><div class="rowValue ${escapeHtml(signal.tone)}">${escapeHtml(signal.value)}</div></div>`).join('');
  byId('financialTable').innerHTML = profile.financial.map(row => `<tr>${row.map(value => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('');
  byId('marketRows').innerHTML = profile.markets.map(row => `<div class="marketRow"><div class="rowLabel">${escapeHtml(row.label)}</div><div class="rowValue">${escapeHtml(row.value)}</div></div>`).join('');
  byId('insightGrid').innerHTML = profile.insights.map(([title,text], index) => `<div class="insightCard"><div class="insightNum">${String(index+1).padStart(2,'0')}</div><h4>${escapeHtml(title)}</h4><p>${escapeHtml(text)}</p></div>`).join('');
  renderDeepAnalysis(profile.deepAnalysis);
  byId('sourceList').innerHTML = sourceCards(profile.sources);
  renderCuratedCharts(profile);
  activateTab('overview'); showScreen('workspace');
}
