const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
execFileSync(process.env.PYTHON || 'python3', ['-m', 'cds', 'build'], {cwd: root});
const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'dist/catalog.json'), 'utf8'));
const template = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
const scripts = ['search.js','charts.js','analysis.js','profiles.js','compare.js','explore.js','app.js'].map(name => fs.readFileSync(path.join(root,'web',name),'utf8')).join('\n');
const htmlText = value => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// Event and markup checks, not a browser or CSS layout emulator.
class Element {
  constructor(id='', classes='') {
    this.id=id; this.dataset={}; this.style={}; this.value=''; this.textContent=''; this.innerHTML='';
    this.attributes={}; this.hidden=false; this.listeners=new Map();
    const names=new Set(classes.split(/\s+/));
    this.classList={contains:n=>names.has(n),toggle:(n,on)=>on?names.add(n):names.delete(n)};
  }
  addEventListener(n,fn){if(!this.listeners.has(n))this.listeners.set(n,[]);this.listeners.get(n).push(fn);}
  dispatch(n,event={}){for(const fn of this.listeners.get(n)||[])fn(event);}
  setAttribute(n,v){this.attributes[n]=v;}
  focus(){this.dispatch('focus');}
}

function createApp(data=snapshot,storage=new Map()) {
  const elements=new Map([...template.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
  elements.get('companyData').textContent=JSON.stringify(data);
  const tabs=[...template.matchAll(/class="tab(?: active)?" data-tab="([^"]+)"/g)].map(m=>{
    const e=new Element('',m[0].includes(' active')?'tab active':'tab');e.dataset.tab=m[1];return e;
  });
  const tablist=new Element();
  const document={
    getElementById(id){const e=elements.get(id)||tabs.find(t=>t.id===id);assert.ok(e,`Missing element ${id}`);return e;},
    querySelectorAll:s=>s==='.tab'?tabs:s==='.section'?tabs.map(t=>elements.get(t.dataset.tab)):[],
    querySelector:s=>s==='.tabs'?tablist:null,
  };
  const localStorage=storage===null?{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
  const context=vm.createContext({document,window:{scrollTo(){},localStorage}});
  vm.runInContext(scripts+'\nglobalThis.api={renderCompany,comparisonMarkup,getMatches,analysisFor,metricLabel,fullAmount,amount,change,filingUrl,companies,explorer,directoryMatches,toggleSavedCompany,toggleComparison,hasAnnualComparison,openComparison,comparisonBars};',context);
  return {elements,tabs,api:context.api};
}

test('all 484 entries and their aliases open complete reports on the correct basis',()=>{
  const {elements}=createApp();
  for(const company of snapshot.companies){
    for(const alias of company.a){
      elements.get('searchInput').value=alias.toUpperCase();
      elements.get('analyzeBtn').dispatch('click');
      assert.equal(elements.get('companyName').textContent,company.profile ? snapshot.curated[company.profile].name : company.n);
      assert.equal(elements.get('workspace').style.display,'block');
      assert.ok(company.profile ? elements.get('periodMain').textContent === snapshot.curated[company.profile].period.split(' · ')[0] : elements.get('periodMain').textContent.includes(company.p[0][1]));
    }
    for(const id of ['metrics','health','barChart','financialTable','financialBarChart','marketRows','insightGrid','deepGrid','sourceList']){
      const html=elements.get(id).innerHTML;
      assert.ok(html.length>0,id);
      assert.ok(!/undefined|NaN|Infinity/.test(html),company.n+' '+id);
    }
  }
});

test('partial search and sector filtering operate over supported companies only',()=>{
  const {elements,api}=createApp();
  assert.equal(api.getMatches('','').length,484);
  for(const sector of new Set(snapshot.companies.map(c=>c.s))){
    const matches=api.getMatches('',sector);assert.ok(matches.length>0);assert.ok(matches.every(c=>c.s===sector));
  }
  elements.get('searchInput').value='micro';elements.get('searchInput').dispatch('input');
  assert.ok(elements.get('companyResults').innerHTML.includes('Microsoft'));
  assert.ok(!elements.get('companyResults').innerHTML.includes('Apple Inc.'));
});

test('directory pagination and delegated company selection work',()=>{
  const {elements}=createApp();
  const count=()=>[...elements.get('companyResults').innerHTML.matchAll(/data-company=/g)].length;
  assert.equal(count(),12);elements.get('moreCompanies').dispatch('click');assert.equal(count(),24);
  const company=snapshot.companies[5];
  elements.get('companyResults').dispatch('click',{target:{closest:()=>({dataset:{company:String(company.id)}})}});
  assert.equal(elements.get('companyName').textContent,company.n);
});

test('Google share classes open the same issuer and dots or hyphens find Berkshire',()=>{
  const {elements}=createApp();
  for(const alias of ['GOOG','GOOGL','Google']){
    elements.get('searchInput').value=alias;elements.get('searchInput').dispatch('keydown',{key:'Enter'});
    assert.ok(elements.get('ticker').textContent.includes('GOOG'));
  }
  for(const alias of ['BRK.B','BRK-B']){
    elements.get('searchInput').value=alias;elements.get('analyzeBtn').dispatch('click');
    assert.equal(elements.get('companyName').textContent,'Berkshire Hathaway');
  }
});

test('all six tabs, keyboard navigation, and home controls are retained',()=>{
  const {elements,tabs,api}=createApp();api.renderCompany(api.companies[0]);
  assert.equal(tabs.length,6);
  for(const tab of tabs){tab.dispatch('click');assert.equal(elements.get(tab.dataset.tab).classList.contains('active'),true);}
  tabs[0].dispatch('keydown',{key:'ArrowLeft',preventDefault(){}});
  assert.equal(tabs.at(-1).attributes['aria-selected'],'true');
  elements.get('brandHome').dispatch('click');
  assert.equal(elements.get('welcome').style.display,'flex');
});

test('excluded or unknown names show a supported-coverage explanation',()=>{
  const {elements}=createApp();
  elements.get('searchInput').value='XOM';elements.get('analyzeBtn').dispatch('click');
  assert.equal(elements.get('notFound').style.display,'block');
  assert.ok(elements.get('notFoundDetail').textContent.includes('18'));
  elements.get('backBtn').dispatch('click');assert.equal(elements.get('welcome').style.display,'flex');
});

test('company measures and supplemental SEC measures retain their actual source links',()=>{
  const {elements,api}=createApp();
  for(const company of api.companies){
    api.renderCompany(company);const html=elements.get('sourceList').innerHTML;
    if (company.profile) {
      for (const source of snapshot.curated[company.profile].sources) assert.ok(html.includes(source.url.replaceAll('&','&amp;')));
      continue;
    }
    for(const [metric,fact] of Object.entries(company.sec_m ?? company.m)){
      assert.ok(html.includes(fact[2]));assert.ok(html.includes(fact[3]));
      assert.ok(html.includes(api.filingUrl(company,fact[3])));
      if(fact[4])assert.ok(html.includes(fact[4]));
    }
    const report=snapshot.reports[String(company.id)];
    if(report){
      for(const source of report.sources)assert.ok(html.includes(htmlText(source.url)));
      for(const fact of Object.values(report.financials))assert.ok(html.includes(htmlText(fact.label)),company.n+' '+fact.label);
      if(report.sources.length)assert.ok(html.indexOf(report.sources[0].url.replaceAll('&','&amp;'))<html.indexOf('SEC company filing'));
    }
    assert.ok(!/href="(?:javascript:|http:)/.test(html));
  }
});

test('negative amounts extend left of zero with proportional widths',()=>{
  const {api}=createApp();
  const html=api.comparisonMarkup([{name:'Income',current:100,prior:-50}]);
  const widths=[...html.matchAll(/width:([0-9.]+)%/g)].map(m=>Number(m[1]));
  const lefts=[...html.matchAll(/compareFill (?:current|prior)" style="left:([0-9.]+)%/g)].map(m=>Number(m[1]));
  assert.ok(Math.abs(widths[0]/widths[1]-2)<1e-9);
  assert.ok(Math.abs(lefts[0]-100/3)<1e-9);assert.equal(lefts[1],0);
  assert.ok(html.includes('−$50'));
});

test('missing values have no quantitative mark and real zeros remain zero',()=>{
  const {api}=createApp();
  const missing=api.comparisonMarkup([{name:'Cash',current:100,prior:null}]);
  assert.ok(missing.includes('Not supplied'));assert.ok(missing.includes('width:0%'));
  const zero=api.comparisonMarkup([{name:'Cash',current:0,prior:0}]);
  assert.ok(!zero.includes('Not supplied'));assert.ok(!/NaN|Infinity/.test(zero));
});

test('nonpositive prior income never produces a misleading percentage-growth claim',()=>{
  const {api}=createApp();
  assert.ok(api.change([10,-10,'tag','a','b',null,20]).includes('prior ≤ 0'));
  assert.ok(!api.change([10,-10,'tag','a','b',null,20]).includes('%'));
  const company=api.companies.find(c=>c.m.income && c.m.income[1]<0);assert.ok(company);
  assert.ok(api.analysisFor(company).insights[1][1].includes('percentage change is omitted'));
});

test('revenue and income concepts remain accurately named',()=>{
  const {api}=createApp();
  const chase=api.companies.find(c=>c.t.includes('JPM'));
  assert.equal((chase.sec_m ?? chase.m).revenue[2],'RevenuesNetOfInterestExpense');
  assert.match(api.metricLabel('revenue',chase),/net.*revenue|revenue.*net/i);
  const apple=api.companies.find(c=>c.t.includes('AAPL'));assert.equal(api.metricLabel('revenue',apple),'Contract revenue');
  const berkshire=api.companies.find(c=>c.t.includes('BRK.B'));
  assert.equal((berkshire.sec_m ?? berkshire.m).revenue[2],'Revenues');
  assert.match(api.metricLabel('revenue',berkshire),/revenue/i);
});

test('HTML injection stays inert in data-driven chart labels',()=>{
  const {api}=createApp();
  assert.ok(api.comparisonMarkup([{name:'<img src=x>',current:1,prior:0}]).includes('&lt;img src=x&gt;'));
});

test('the original ten profiles retain their detailed analysis, source cards and reporting period',()=>{
  const {elements,api}=createApp();
  const originals=api.companies.filter(c=>c.profile);
  assert.equal(originals.length,10);
  for(const company of originals){
    const profile=snapshot.curated[company.profile];api.renderCompany(company);
    assert.equal(elements.get('deepHeadline').textContent,profile.deepAnalysis.headline);
    assert.equal(elements.get('deepSummary').textContent,profile.deepAnalysis.summary);
    assert.equal(elements.get('deepFocusTitle').textContent,profile.deepAnalysis.focusTitle);
    assert.equal(elements.get('deepFocusText').textContent,profile.deepAnalysis.focusText);
    assert.equal(elements.get('periodMain').textContent,profile.period.split(' · ')[0]);
    for(const card of profile.deepAnalysis.cards){assert.ok(elements.get('deepGrid').innerHTML.includes(card.title.replaceAll('&','&amp;')));}
    const sources=elements.get('sourceList').innerHTML;
    assert.equal((sources.match(/class="sourceCard"/g)||[]).length,profile.sources.length);
    assert.ok(!sources.includes('sourceMapping'));
    for(const source of profile.sources){assert.ok(sources.includes(source.title.replaceAll('&','&amp;')));}
    assert.ok(elements.get('financialTable').innerHTML.includes(profile.financial[0][1]));
  }
});

test('Nike keeps its original Direct, China, margin and marketing focus areas',()=>{
  const {elements,api}=createApp();api.renderCompany(api.companies.find(c=>c.profile==='nike'));
  assert.ok(elements.get('deepHeadline').textContent.includes('Direct and Greater China'));
  const cards=elements.get('deepGrid').innerHTML;
  for(const phrase of ['Direct-to-consumer is underperforming','Greater China needs a focused recovery','Margins and overhead are helping','Marketing spend must turn into demand'])assert.ok(cards.includes(phrase));
  assert.ok(cards.includes('Nike Direct fell 8%'));
  assert.ok(elements.get('metrics').innerHTML.includes('$11.21B'));
});

test('all added profiles show the original four-card structure and twelve business actions',()=>{
  const {elements,api}=createApp();
  for(const company of api.companies.filter(c=>!c.profile)){
    api.renderCompany(company);
    const cards=elements.get('deepGrid').innerHTML;
    assert.equal((cards.match(/class="deepCard"/g)||[]).length,4);
    const report=snapshot.reports[String(company.id)];
    assert.ok(report.analysis,company.n);
    assert.equal(elements.get('deepHeadline').textContent,report.analysis.headline);
    assert.equal((cards.match(/<li>/g)||[]).length,12);
    for(const card of report.analysis.cards){
      assert.ok(cards.includes(htmlText(card.title)));
      assert.ok(cards.includes(htmlText(card.text)));
      for(const item of card.items)assert.ok(cards.includes(htmlText(item)));
    }
    assert.equal(elements.get('deepSummary').textContent,report.analysis.summary);
    assert.equal(elements.get('deepFocusText').textContent,report.analysis.focusText);
    assert.ok(!cards.includes('<a '));
    assert.ok(!cards.includes('Why it matters.'));
    assert.ok(!cards.includes('Two annual periods show a change, not a trend'));
  }
});

test('published operating measures populate Markets without changing the six tabs',()=>{
  const {elements,api,tabs}=createApp();
  for(const company of api.companies.filter(c=>!c.profile)){
    const report=snapshot.reports[String(company.id)];
    if(!report || report.evidence.length<3)continue;
    api.renderCompany(company);
    for(const item of report.evidence.filter(item=>item.metric_label && item.metric_value)){
      assert.ok(elements.get('marketRows').innerHTML.includes(htmlText(item.metric_value)),company.n+' '+item.metric_value);
    }
    assert.equal(tabs.length,6);
    assert.ok(elements.get('overviewExplainText').textContent.includes(report.evidence[0].text));
  }
});

test('business analysis stays escaped while publication links remain in Sources',()=>{
  const data=JSON.parse(JSON.stringify(snapshot));
  const company=data.companies.find(c=>data.reports[String(c.id)]?.evidence.length>=3);
  assert.ok(company);
  const report=data.reports[String(company.id)];
  report.analysis.cards[0].title='<img src=x onerror=alert(1)>';
  report.analysis.cards[0].text='<script>alert(1)</script>';
  const {elements,api}=createApp(data);api.renderCompany(company);
  const cards=elements.get('deepGrid').innerHTML;
  assert.ok(cards.includes('&lt;img'));
  assert.ok(!cards.includes('<script>'));
  assert.ok(!cards.includes('<a '));
  for(const source of report.sources)assert.ok(elements.get('sourceList').innerHTML.includes(htmlText(source.url)));
});

test('the homepage retains its introduction and inclusive company count',()=>{
  const {elements}=createApp();
  assert.equal(elements.get('coverageText').textContent,'484 companies available · Source linked financial data · Browse by sector');
  assert.ok(template.includes('Search a supported public company to explore verified financial data, performance trends, market signals, and straightforward explanations of what the numbers actually mean.'));
});

test('switching between original and annual reports resets dates, units, sources and titles',()=>{
  const {elements,api}=createApp();
  for(const key of ['nike','tsmc','apple']){
    api.renderCompany(api.companies.find(c=>c.profile===key));
    assert.equal(elements.get('comparisonHeading').textContent,'Quarter comparison');
    api.renderCompany(api.companies.find(c=>c.t.includes('TSLA')));
    assert.equal(elements.get('comparisonHeading').textContent,'Annual comparison');
    assert.ok(elements.get('periodMain').textContent.startsWith('Year ended'));
  }
  api.renderCompany(api.companies.find(c=>c.profile==='tsmc'));
  assert.ok(elements.get('barChart').innerHTML.includes('TWD billions'));
  api.renderCompany(api.companies.find(c=>c.profile==='apple'));
  assert.ok(elements.get('financialBarChart').innerHTML.includes('Not supplied'));
});

test('welcome cards use the original wording while sector browsing remains available',()=>{
  for(const text of ['Verified company data','Business analysis','Simple explanations','Every major section explains what changed, why it matters'])assert.ok(template.includes(text));
  assert.ok(!template.includes('Use Python and SQL to calculate annual changes'));
  const {elements}=createApp();
  assert.ok(elements.get('sectorFilter').innerHTML.includes('Information Technology'));
  assert.ok(elements.get('companyResults').innerHTML.includes('data-company'));
});

test('saved companies persist, can be removed and never treat stale IDs as companies',()=>{
  const storage=new Map([['cds_saved_companies_v1','["unknown",123]']]);
  const first=createApp(snapshot,storage), company=first.api.companies.find(c=>c.t.includes('KO'));
  assert.equal(first.api.explorer.saved.size,0);
  first.api.toggleSavedCompany(company.id);
  assert.equal(first.elements.get('navSaved').textContent,'Saved (1)');
  assert.equal(first.elements.get('savedCompaniesTab').textContent,'Saved (1)');
  const second=createApp(snapshot,storage);
  second.elements.get('sectorFilter').value='Information Technology';
  second.elements.get('searchInput').value='unrelated';
  second.elements.get('navSaved').dispatch('click');
  assert.equal(second.elements.get('savedScreen').hidden,false);
  assert.equal(second.elements.get('welcome').style.display,'none');
  assert.ok(second.elements.get('savedResults').innerHTML.includes(htmlText(company.n)));
  second.api.renderCompany(company);
  assert.equal(second.elements.get('saveCurrentBtn').attributes['aria-pressed'],'true');
  second.elements.get('saveCurrentBtn').dispatch('click');
  assert.equal(second.api.explorer.saved.size,0);
  assert.equal(second.elements.get('savedResults').innerHTML,'');
  assert.equal(second.elements.get('savedEmpty').hidden,false);
});

test('blocked or malformed browser storage leaves saving usable for the visit',()=>{
  for(const storage of [null,new Map([['cds_saved_companies_v1','{broken']])]){
    const {api,elements}=createApp(snapshot,storage);
    api.toggleSavedCompany(api.companies[0].id);
    assert.equal(api.explorer.saved.size,1);
    assert.equal(elements.get('navSaved').textContent,'Saved (1)');
    assert.equal(elements.get('savedCompaniesTab').textContent,'Saved (1)');
    if(storage===null)assert.ok(elements.get('featureNotice').textContent.includes('for this visit'));
  }
});

test('comparison selection caps at three and excludes original profiles without annual data',()=>{
  const {api,elements}=createApp();
  const annual=api.companies.filter(api.hasAnnualComparison);
  assert.equal(annual.length,482);
  for(const c of annual.slice(0,3))assert.equal(api.toggleComparison(c.id),true);
  assert.equal(api.toggleComparison(annual[3].id),false);
  assert.equal(api.explorer.selected.length,3);
  for(const c of api.companies.filter(c=>!api.hasAnnualComparison(c)))assert.equal(api.toggleComparison(c.id),false);
  assert.equal(elements.get('compareDock').hidden,false);
  api.toggleComparison(annual[0].id);assert.equal(api.explorer.selected.length,2);
  api.openComparison();assert.equal(elements.get('compareScreen').hidden,false);assert.equal(elements.get('compareDock').hidden,true);
  elements.get('brandHome').dispatch('click');assert.equal(elements.get('compareDock').hidden,false);
});

test('two company searches show exact annual periods and preserve report navigation',()=>{
  const {api,elements}=createApp();
  elements.get('navCompare').dispatch('click');
  elements.get('comparisonFirst').value='ko';
  elements.get('comparisonSecond').value=api.companies.find(c=>c.t.includes('PEP')).n;
  let prevented=false;
  elements.get('comparisonSearchForm').dispatch('submit',{preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(api.explorer.selected.length,2);assert.equal(elements.get('comparisonContent').hidden,false);
  for(const ticker of ['KO','PEP']){
    const c=api.companies.find(c=>c.t.includes(ticker));
    assert.ok(elements.get('comparisonTableHead').innerHTML.includes(c.p[0].join(' to ')));
    assert.ok(elements.get('comparisonTableBody').innerHTML.includes(htmlText(api.metricLabel('income',c))));
  }
  elements.get('comparisonMetric').value='cash';elements.get('comparisonMetric').dispatch('change');
  assert.ok(elements.get('peerChart').innerHTML.includes('Operating cash flow'));
  const company=api.companies.find(c=>c.t.includes('KO'));
  elements.get('comparisonTableHead').dispatch('click',{target:{closest:()=>({dataset:{openReport:String(company.id)}})}});
  assert.equal(elements.get('companyName').textContent,company.n);assert.equal(elements.get('compareScreen').hidden,true);
});

test('cross-sector context and signed charts keep missing growth and losses distinct',()=>{
  const {api,elements}=createApp();
  const bank=api.companies.find(c=>c.t.includes('JPM')), manufacturer=api.companies.find(c=>c.t.includes('MMM'));
  api.openComparison([bank.id,manufacturer.id]);assert.ok(elements.get('comparisonContext').textContent.includes('Different sectors'));
  const clone=JSON.parse(JSON.stringify(manufacturer));clone.m.revenue[5]=-10;
  const positive=JSON.parse(JSON.stringify(bank));positive.m.revenue[5]=20;
  const missing=JSON.parse(JSON.stringify(manufacturer));missing.m.revenue[5]=null;
  const bars=api.comparisonBars([clone,positive,missing],'growth');
  assert.ok(bars.includes('−10.00%'));assert.ok(bars.includes('+20.00%'));assert.ok(bars.includes('Not supplied'));assert.ok(!bars.includes('NaN'));
});

test('saved and comparison controls escape company text and respect unavailable annual records',()=>{
  const data=JSON.parse(JSON.stringify(snapshot));const company=data.companies.find(c=>!c.profile);
  company.n='<img src=x onerror=alert(1)>';
  const {api,elements}=createApp(data);
  assert.ok(elements.get('companyResults').innerHTML.includes('&lt;img'));assert.ok(!elements.get('companyResults').innerHTML.includes('<img'));
  const other=api.companies.find(c=>c.id!==company.id&&api.hasAnnualComparison(c));
  api.openComparison([company.id,other.id]);assert.ok(elements.get('comparisonTableHead').innerHTML.includes('&lt;img'));
  api.renderCompany(api.companies.find(c=>c.profile==='spacex'));assert.equal(elements.get('compareCurrentBtn').disabled,true);
});

test('only Saved and Compare are added to the original browsing controls',()=>{
  for(const id of ['navSaved','navCompare','savedCompaniesTab','compareScreen'])assert.ok(template.includes(`id="${id}"`));
  for(const id of ['industryFilter','signalFilter','sortFilter','exportComparison','compareStaples','compareRetail'])assert.ok(!template.includes(`id="${id}"`));
  assert.ok(template.includes('<label for="sectorFilter">Browse by sector</label>'));
  assert.ok(!scripts.includes('function comparisonCsv'));
  assert.ok(!scripts.includes('function filterDirectory'));
});

test('company comparison searches reject missing, unknown, ambiguous and unavailable entries',()=>{
  for(const value of ['', 'zzzzzz', 'bank', 'TSM']){
    const {api,elements}=createApp();
    const first=api.companies.find(c=>c.t.includes('MSFT')),second=api.companies.find(c=>c.t.includes('AAPL'));
    api.openComparison([first.id,second.id]);
    elements.get('comparisonSecond').value=value;
    elements.get('comparisonSearchForm').dispatch('submit',{preventDefault(){}});
    assert.deepEqual(Array.from(api.explorer.selected),[String(first.id),String(second.id)]);
    assert.equal(elements.get('comparisonSearchError').hidden,false);
    assert.equal(elements.get('comparisonSecond').attributes['aria-invalid'],'true');
    assert.equal(elements.get('comparisonContent').hidden,false);
    elements.get('comparisonSecond').dispatch('input');
    assert.equal(elements.get('comparisonSearchError').hidden,true);
  }
});

test('three search boxes require distinct issuers and can replace an existing comparison',()=>{
  const {api,elements}=createApp();
  api.openComparison(api.companies.filter(api.hasAnnualComparison).slice(0,3).map(c=>c.id));
  assert.equal(elements.get('comparisonFirst').value,api.companies.find(c=>String(c.id)===api.explorer.selected[0]).t[0]);
  elements.get('comparisonFirst').value='GOOG';elements.get('comparisonSecond').value='GOOGL';
  elements.get('comparisonSearchForm').dispatch('submit',{preventDefault(){}});
  assert.equal(api.explorer.selected.length,3);
  assert.ok(elements.get('comparisonSearchError').textContent.includes('different companies'));
  elements.get('comparisonFirst').value='MSFT';elements.get('comparisonSecond').value='AAPL';elements.get('comparisonThird').value='';
  elements.get('comparisonMetric').value='ratio';elements.get('comparisonMetric').dispatch('change');
  assert.equal(elements.get('comparisonFirst').value,'MSFT');
  elements.get('comparisonSearchForm').dispatch('submit',{preventDefault(){}});
  assert.equal(api.explorer.selected.length,2);
  assert.equal(elements.get('comparisonSearchError').hidden,true);
  assert.ok(elements.get('comparisonTableHead').innerHTML.includes('MSFT'));
  assert.ok(elements.get('comparisonTableHead').innerHTML.includes('AAPL'));
});

test('Compare page contains three labeled searches, suggestions and a generic Compare button',()=>{
  const {elements}=createApp();
  const form=template.match(/<form id="comparisonSearchForm"[\s\S]*?<\/form>/)[0];
  assert.equal((form.match(/<input /g)||[]).length,3);
  assert.ok(form.includes('for="comparisonFirst"'));assert.ok(form.includes('for="comparisonSecond"'));assert.ok(form.includes('for="comparisonThird"'));
  assert.ok(form.includes('type="submit" class="solidButton">Compare</button>'));
  assert.equal((elements.get('comparisonCompanyOptions').innerHTML.match(/<option /g)||[]).length,482);
  assert.ok(!template.includes('emptyCompareExample'));
  assert.ok(!template.includes('ready-made comparison'));
  assert.ok(!template.includes('Compare Coca-Cola and PepsiCo'));
});

test('the top Saved button opens a separate page while the homepage Saved tab remains',()=>{
  const {api,elements}=createApp();
  const company=api.companies.find(c=>c.t.includes('MSFT'));
  api.toggleSavedCompany(company.id);
  elements.get('savedCompaniesTab').dispatch('click');
  assert.equal(elements.get('welcome').style.display,'flex');
  assert.equal(elements.get('savedScreen').hidden,true);
  assert.equal(api.directoryMatches().length,1);
  elements.get('navSaved').dispatch('click');
  assert.equal(elements.get('welcome').style.display,'none');
  assert.equal(elements.get('savedScreen').hidden,false);
  assert.equal(elements.get('navSaved').attributes['aria-pressed'],'true');
  assert.equal(elements.get('savedCount').textContent,'1 saved company');
  elements.get('savedResults').dispatch('click',{target:{closest:()=>({dataset:{save:String(company.id)}})}});
  assert.equal(elements.get('savedResults').innerHTML,'');
  assert.equal(elements.get('savedEmpty').hidden,false);
  assert.ok(elements.get('companyResults').innerHTML.includes('Your saved list starts here'));
  api.toggleSavedCompany(company.id);
  elements.get('savedResults').dispatch('click',{target:{closest:()=>({dataset:{company:String(company.id)}})}});
  assert.equal(elements.get('workspace').style.display,'block');
  assert.equal(elements.get('savedScreen').hidden,true);
  assert.equal(elements.get('companyName').textContent,snapshot.curated[company.profile].name);
});

test('company, Saved and Compare navigation remains usable without New search',()=>{
  const {api,elements}=createApp();
  assert.ok(!/Expanded preview/i.test(template));
  assert.ok(!template.includes('id="backToBrowse"'));
  assert.ok(!template.includes('Back to browse'));
  api.renderCompany(api.companies.find(c=>c.t.includes('KO')));
  assert.equal(elements.has('resetBtn'),false);
  assert.ok(!template.includes('New search'));
  assert.equal(elements.get('workspace').style.display,'block');
  elements.get('navCompare').dispatch('click');
  assert.equal(elements.get('compareScreen').hidden,false);
  elements.get('navSaved').dispatch('click');
  assert.equal(elements.get('savedScreen').hidden,false);
  assert.equal(elements.get('compareScreen').hidden,true);
  elements.get('brandHome').dispatch('click');
  assert.equal(elements.get('welcome').style.display,'flex');
  assert.equal(elements.get('savedScreen').hidden,true);
});

test('three company searches populate every chart and table column and can return to two',()=>{
  const {api,elements}=createApp();
  elements.get('navCompare').dispatch('click');
  for(const [field,ticker] of [['comparisonFirst','AAPL'],['comparisonSecond','MSFT'],['comparisonThird','AMZN']])elements.get(field).value=ticker;
  elements.get('comparisonSearchForm').dispatch('submit',{preventDefault(){}});
  assert.equal(api.explorer.selected.length,3);
  assert.equal(elements.get('comparisonContent').attributes['data-company-count'],'3');
  assert.equal((elements.get('comparisonTableHead').innerHTML.match(/scope="col"/g)||[]).length,4);
  assert.equal((elements.get('peerChart').innerHTML.match(/class="peerRow"/g)||[]).length,3);
  for(const row of elements.get('comparisonTableBody').innerHTML.match(/<tr>[\s\S]*?<\/tr>/g))assert.equal((row.match(/<td[ >]/g)||[]).length,3);
  const third=api.companies.find(c=>c.t.includes('AMZN'));
  assert.equal(elements.get('comparisonThird').value,'AMZN');
  assert.ok(elements.get('comparisonTableHead').innerHTML.includes(third.p[0].join(' to ')));
  elements.get('comparisonThird').value='';
  elements.get('comparisonSearchForm').dispatch('submit',{preventDefault(){}});
  assert.equal(api.explorer.selected.length,2);
  assert.equal(elements.get('comparisonContent').attributes['data-company-count'],'2');
  assert.equal((elements.get('comparisonTableHead').innerHTML.match(/scope="col"/g)||[]).length,3);
  assert.equal((elements.get('peerChart').innerHTML.match(/class="peerRow"/g)||[]).length,2);
});

test('invalid or duplicate third companies keep existing results and identify the third input',()=>{
  for(const value of ['zzzzzz','bank','TSM','AAPL']){
    const {api,elements}=createApp();
    const companies=['AAPL','MSFT','AMZN'].map(ticker=>api.companies.find(c=>c.t.includes(ticker)));
    api.openComparison(companies.map(company=>company.id));
    assert.equal(elements.get('comparisonThird').value,'AMZN');
    const previous=elements.get('comparisonTableHead').innerHTML;
    elements.get('comparisonThird').value=value;
    elements.get('comparisonSearchForm').dispatch('submit',{preventDefault(){}});
    assert.deepEqual(Array.from(api.explorer.selected),companies.map(company=>String(company.id)));
    assert.equal(elements.get('comparisonTableHead').innerHTML,previous);
    assert.equal(elements.get('comparisonThird').attributes['aria-invalid'],'true');
    assert.equal(elements.get('comparisonSearchError').hidden,false);
    elements.get('comparisonThird').dispatch('input');
    assert.equal(elements.get('comparisonSearchError').hidden,true);
  }
  const {api,elements}=createApp();
  for(const [field,ticker] of [['comparisonFirst','GOOG'],['comparisonSecond','MSFT'],['comparisonThird','GOOGL']])elements.get(field).value=ticker;
  elements.get('comparisonSearchForm').dispatch('submit',{preventDefault(){}});
  assert.equal(api.explorer.selected.length,0);
  assert.equal(elements.get('comparisonThird').attributes['aria-invalid'],'true');
});
