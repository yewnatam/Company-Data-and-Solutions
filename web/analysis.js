const sectorQuestions = {
  'Information Technology': ['Compare disclosed product, cloud, software and service growth.', 'Review customer concentration and capacity or infrastructure commitments.', 'Track whether new investment converts into operating cash flow.'],
  'Consumer Discretionary': ['Separate price, sales volume and changes in product mix.', 'Review traffic, deliveries, conversion or comparable sales where disclosed.', 'Watch discounting, inventory and customer acquisition costs.'],
  'Consumer Staples': ['Compare unit volumes with pricing and product mix.', 'Check input-cost changes and the response of gross margins.', 'Review brand, distribution and geographic performance in the filing.'],
  'Financials': ['Compare net interest, fee and other revenue where disclosed.', 'Review credit provisions, loan quality and capital ratios.', 'Use the bank or insurer’s sector-specific cash and liquidity measures.'],
  'Health Care': ['Check product, procedure, enrollment or prescription volumes as applicable.', 'Review reimbursement, product concentration and patent or regulatory exposure.', 'Compare research investment with disclosed pipeline and commercial progress.'],
  'Industrials': ['Review orders, backlog conversion and organic sales where disclosed.', 'Check production efficiency, input costs and contract pricing.', 'Compare capacity investment with demand and cash generation.'],
  'Energy': ['Separate commodity-price changes from production or sales volumes.', 'Review realized prices, operating costs and disclosed hedging.', 'Compare capital spending with operating cash and production plans.'],
  'Materials': ['Separate changes in price, volume and product mix.', 'Review raw-material and energy costs alongside margins.', 'Check capacity utilization and end-market demand in the filing.'],
  'Utilities': ['Review rate decisions, customer demand and weather effects where disclosed.', 'Compare infrastructure spending with financing and cash requirements.', 'Check regulatory recovery, leverage and dividend coverage.'],
  'Real Estate': ['Review occupancy, leasing spreads and same-property performance.', 'Use disclosed FFO or other sector measures alongside GAAP income.', 'Check debt maturities, funding costs and property investment.'],
  'Communication Services': ['Compare disclosed advertising, subscription and customer trends.', 'Review engagement, pricing and content or infrastructure costs.', 'Check whether investment supports cash generation and customer retention.'],
};

function companyReportFor(company) {
  const report = snapshot.reports?.[String(company.id)];
  return report && report.period_end === company.p[0]?.[1] ? report : null;
}

function detailedCompanyAnalysis(company, report) {
  if (report.analysis) {
    return report.analysis;
  }
  const cards = report.evidence.map(item => ({
    label: item.tone === 'positive' ? 'What is working' : item.tone === 'high' ? 'What could improve' : 'What to watch',
    priority: item.tone === 'positive' ? 'Positive' : item.tone === 'high' ? 'High priority' : 'Medium priority',
    tone: item.tone, title: item.label, text: item.text,
    items: [item.action],
  }));
  return {cards,
    headline: report.headline.startsWith(company.n) ? report.headline : `${company.n}: ${report.headline}`,
    summary: `For the year ended ${report.period_end}, ${metricLabel('revenue', company).toLowerCase()} was ${amount(company.m.revenue[0])} and ${metricLabel('income', company).toLowerCase()} was ${amount(company.m.income[0])}. The company’s published operating results below explain the business priorities. Suggested next steps are CDS analysis, not company guidance.`,
    focusTitle: report.focus_title,
    focusText: report.focus_text,
  };
}

function detailedAnnualAnalysis(company, marginChange) {
  const revenue = company.m.revenue, income = company.m.income;
  const cash = company.m.cash, capex = company.m.capex;
  const revenueLabel = metricLabel('revenue', company);
  const questions = sectorQuestions[company.s] ?? ['Review the business segments disclosed in the filing.', 'Separate operating results from unusual items.', 'Compare earnings, investment and cash generation.'];
  const revenueWeak = revenue[5] < 0;
  const marginWeak = marginChange < 0;
  const incomeWeak = income[0] < 0 || income[6] < 0;
  const bank = company.s === 'Financials';
  const salesTitle = revenueWeak ? 'Find what is driving the lower reported revenue' : 'Check the durability of the reported growth';
  const marginTitle = marginWeak ? 'Income is converting from revenue at a lower rate' : marginChange > 0 ? 'Income conversion improved' : 'Income conversion was unchanged';
  const cards = [
    {label: 'What stands out', priority: revenueWeak ? 'High priority' : 'Positive', tone: revenueWeak ? 'high' : 'positive', title: salesTitle,
      text: `${company.n} reported ${revenueLabel.toLowerCase()} of ${amount(revenue[0])}, versus ${amount(revenue[1])} in the prior annual period (${signed(revenue[5], '%')}). ${incomeWeak ? 'Income also needs attention, so sales movement alone is not enough to judge the result.' : 'Income increased as well; the next question is which disclosed drivers can sustain that performance.'}`,
      items: [questions[0], 'Separate organic movement from acquisitions, disposals and currency effects where disclosed.', `Use the period ending ${company.p[0][1]} when checking the management discussion.`]},
    {label: marginWeak ? 'What could improve' : 'What is working', priority: marginWeak || income[0] < 0 ? 'High priority' : 'Positive', tone: marginWeak || income[0] < 0 ? 'high' : 'positive', title: marginTitle,
      text: `${metricLabel('income', company)} was ${amount(income[0])}, versus ${amount(income[1])}. Income divided by the selected revenue measure was ${company.r[0].toFixed(2)}%, compared with ${company.r[1].toFixed(2)}% (${signed(marginChange, ' percentage points')}). This ratio uses the exact revenue concept listed in Sources.`,
      items: [questions[1], 'Separate recurring operating changes from tax, investment and other unusual items.', 'Compare the ratio with the company’s own history before making a cross-company comparison.']},
    {label: 'Cash and earnings', priority: cash && cash[0] < 0 && !bank ? 'High priority' : 'Medium priority', tone: cash && cash[0] < 0 && !bank ? 'high' : 'medium', title: bank ? 'Interpret cash flow using the financial business model' : cash && cash[0] < income[0] ? 'Check why operating cash trails reported income' : 'Watch whether earnings continue to turn into cash',
      text: cash ? `Operating cash flow was ${amount(cash[0])}${cash[1] === null ? '; no matched prior amount is supplied' : `, versus ${amount(cash[1])} previously`}. Reported income was ${amount(income[0])}. ${bank ? 'A financial institution’s operating cash flow is affected by its lending, trading and funding activities; a negative amount alone is not a conclusion about operating weakness.' : 'The gap can involve working capital and noncash adjustments; the aggregate amounts do not identify which item caused it.'}` : 'The selected standard cash-flow concept was not available for this fiscal period. Cash conversion needs a filing-level review before it can be assessed.',
      items: [bank ? 'Review the disclosed credit, capital and liquidity measures.' : 'Check receivables, inventory and payable movements where relevant.', 'Reconcile noncash adjustments in the cash-flow statement.', questions[2]]},
    {label: capex ? 'Investment focus' : 'Risk to watch', priority: 'Medium priority', tone: 'medium', title: capex ? 'Check the return and funding of investment spending' : 'Fill the business-specific evidence gaps',
      text: capex ? `Cash payments for property, plant and equipment were ${amount(capex[0])}${capex[1] === null ? '' : `, compared with ${amount(capex[1])} in the prior year`}. ${cash ? `Operating cash flow was ${amount(cash[0])}. ` : ''}This is the named PP&E cash-flow measure, which may differ from a company’s broader capital-expenditure definition.` : `${company.n} has a matched revenue and income comparison, but these totals do not include a full operating or segment scorecard. The next evidence should reflect its ${company.s.toLowerCase()} business model.`,
      items: [questions[2], capex ? 'Compare disclosed project returns and completion milestones with spending.' : questions[0], 'Add several fiscal periods before describing a sustained improvement or deterioration.']},
  ];
  const focusTitle = revenueWeak ? 'Focus first on the revenue drivers and their effect on earnings.'
    : income[0] < 0 ? 'Focus first on the path from reported activity to sustained profit.'
    : marginWeak ? 'Focus first on preserving income while reported revenue grows.'
    : cash && cash[0] < income[0] && !bank ? 'Focus first on cash conversion and the funding of growth.'
    : 'Focus on sustaining the gains while keeping investment disciplined.';
  return {cards,
    headline: `${company.n}: ${revenueWeak ? 'lower reported revenue puts the operating drivers in focus' : marginWeak ? 'revenue growth needs stronger income conversion' : 'the next test is the durability of the reported gains'}.`,
    summary: `${revenueLabel} changed ${signed(revenue[5], '%')}, income moved by ${signedAmount(income[6])}, and income relative to reported revenue changed ${signed(marginChange, ' points')}. The priorities below connect those results to questions relevant to the ${company.s.toLowerCase()} sector. They identify what to investigate; they do not establish an undisclosed cause.`,
    focusTitle,
    focusText: `${revenueLabel} was ${amount(revenue[0])} and ${metricLabel('income', company).toLowerCase()} was ${amount(income[0])} for the year ended ${company.p[0][1]}. ${questions[0]} ${questions[2]} Use the linked company publications and filings to test those priorities.`};
}
