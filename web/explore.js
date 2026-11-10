const explorer = {saved: new Set(), selected: [], view: 'all', screen: 'welcome', company: null};
const savedCompaniesKey = 'cds_saved_companies_v1';
let noticeTimer;

function hasAnnualComparison(company) {
  return Boolean(company && typeof company.id === 'number' && company.p.length === 2 && company.m.revenue && company.m.income);
}

function readSavedCompanies() {
  try {
    const value = JSON.parse(window.localStorage?.getItem(savedCompaniesKey) ?? '[]');
    return Array.isArray(value) ? value.filter(id => typeof id === 'string') : [];
  } catch { return []; }
}

function writeSavedCompanies() {
  try {
    if (!window.localStorage) return false;
    window.localStorage.setItem(savedCompaniesKey, JSON.stringify([...explorer.saved]));
    return true;
  } catch { return false; }
}

function featureNotice(message) {
  if (window.clearTimeout) window.clearTimeout(noticeTimer);
  setText('featureNotice', message);
  byId('featureNotice').hidden = !message;
  if (message && window.setTimeout) noticeTimer = window.setTimeout(() => {byId('featureNotice').hidden = true;}, 4000);
}

function directoryMatches() {
  const matches = getMatches(byId('searchInput').value, byId('sectorFilter').value);
  return explorer.view === 'saved' ? matches.filter(company => explorer.saved.has(String(company.id))) : matches;
}

function directoryCard(company) {
  const id = String(company.id), saved = explorer.saved.has(id), selected = explorer.selected.includes(id);
  const available = hasAnnualComparison(company);
  const limitReached = explorer.selected.length >= 3 && !selected;
  return `<article class="directoryCard"><button class="companyResult" type="button" data-company="${escapeHtml(id)}"><span class="resultTicker">${escapeHtml(company.t.join(' / '))}</span><span class="resultName">${escapeHtml(company.n)}</span><span class="resultSector">${escapeHtml(company.s)}</span></button><div class="cardActions"><button type="button" data-save="${escapeHtml(id)}" aria-pressed="${saved}" aria-label="${saved ? 'Unsave' : 'Save'} ${escapeHtml(company.n)}">${saved ? '★ Saved' : '☆ Save'}</button><button type="button" data-compare="${escapeHtml(id)}" aria-pressed="${selected}" aria-label="${selected ? 'Remove' : 'Compare'} ${escapeHtml(company.n)}" ${!available || limitReached ? 'disabled' : ''} title="${!available ? 'Matched annual data is not available for this profile' : limitReached ? 'Choose up to three companies' : 'Compare annual results'}">${selected ? '✓ Added' : '+ Compare'}</button></div></article>`;
}

function selectionChips() {
  return explorer.selected.map(id => {
    const company = byCompanyId.get(id);
    return `<button class="selectionChip" type="button" data-remove="${escapeHtml(id)}" aria-label="Remove ${escapeHtml(company.n)} from comparison">${escapeHtml(company.t[0])}<span aria-hidden="true">×</span></button>`;
  }).join('');
}

function refreshSelectionControls() {
  const count = explorer.saved.size;
  setText('navSaved', `Saved (${count})`);
  setText('savedCompaniesTab', `Saved (${count})`);
  byId('navSaved').setAttribute('aria-pressed', String(explorer.screen === 'saved'));
  byId('savedCompaniesTab').setAttribute('aria-pressed', String(explorer.view === 'saved'));
  byId('allCompaniesTab').setAttribute('aria-pressed', String(explorer.view === 'all'));
  setText('navCompare', explorer.selected.length ? `Compare (${explorer.selected.length})` : 'Compare');
  const visible = explorer.selected.length > 0 && explorer.screen !== 'compare';
  byId('compareDock').hidden = !visible;
  byId('appRoot').classList.toggle('hasCompareDock', visible);
  setText('dockLabel', `${explorer.selected.length} of 3 selected`);
  byId('dockCompanies').innerHTML = selectionChips();
  byId('openComparison').disabled = explorer.selected.length < 2;
  setText('openComparison', explorer.selected.length < 2 ? 'Choose one more' : 'Compare companies ↗');
  renderSavedCompanies();
  updateCompanyTools();
}

function renderSavedCompanies() {
  const saved = companies.filter(company => explorer.saved.has(String(company.id)));
  setText('savedCount', `${saved.length} saved ${saved.length === 1 ? 'company' : 'companies'}`);
  byId('savedResults').innerHTML = saved.map(directoryCard).join('');
  byId('savedEmpty').hidden = saved.length > 0;
}

function openSavedPage() {
  showScreen('saved');
  byId('savedTitle').focus();
  window.scrollTo({top: 0, behavior: 'auto'});
}

function updateCompanyTools() {
  const company = explorer.company;
  if (!company) return;
  const id = String(company.id), selected = explorer.selected.includes(id), saved = explorer.saved.has(id);
  setText('saveCurrentBtn', saved ? '★ Company saved' : '☆ Save company');
  byId('saveCurrentBtn').setAttribute('aria-pressed', String(saved));
  setText('compareCurrentBtn', selected ? '✓ Added to comparison' : '+ Add to comparison');
  byId('compareCurrentBtn').setAttribute('aria-pressed', String(selected));
  byId('compareCurrentBtn').disabled = !hasAnnualComparison(company) || (explorer.selected.length >= 3 && !selected);
  byId('compareCurrentBtn').title = hasAnnualComparison(company) ? 'Compare annual results' : 'Matched annual data is not available for this profile';
}

function toggleSavedCompany(id) {
  id = String(id);
  if (!byCompanyId.has(id)) return;
  const company = byCompanyId.get(id);
  if (explorer.saved.has(id)) explorer.saved.delete(id); else explorer.saved.add(id);
  const persisted = writeSavedCompanies();
  featureNotice(persisted ? `${company.n} ${explorer.saved.has(id) ? 'saved' : 'removed from saved companies'}.` : 'Saved list updated for this visit. Browser storage is unavailable.');
  refreshSelectionControls(); renderResults();
}

function toggleComparison(id) {
  id = String(id);
  if (!hasAnnualComparison(byCompanyId.get(id))) return false;
  if (explorer.selected.includes(id)) explorer.selected = explorer.selected.filter(value => value !== id);
  else if (explorer.selected.length < 3) explorer.selected.push(id);
  else { featureNotice('Choose up to three companies. Remove one to add another.'); return false; }
  featureNotice(''); refreshSelectionControls(); renderResults();
  if (explorer.screen === 'compare') {syncComparisonSearch(); renderCompanyComparison();}
  return true;
}

function openComparison(ids) {
  if (Array.isArray(ids)) explorer.selected = [...new Set(ids.map(String))].filter(id => hasAnnualComparison(byCompanyId.get(id))).slice(0, 3);
  syncComparisonSearch();
  showScreen('compare'); renderCompanyComparison();
  byId('compareTitle').focus(); window.scrollTo({top: 0, behavior: 'auto'});
}

function browseCompanies(savedOnly = false, clearFilters = false) {
  explorer.view = savedOnly ? 'saved' : 'all';
  if (clearFilters) {byId('searchInput').value = ''; byId('sectorFilter').value = ''; featureNotice('');}
  visibleCount = 12; showScreen('welcome'); renderResults();
}

function handleDirectoryClick(event) {
  const save = event.target.closest('button[data-save]')?.dataset.save;
  const compare = event.target.closest('button[data-compare]')?.dataset.compare;
  if (save !== undefined) toggleSavedCompany(save);
  else if (compare !== undefined) toggleComparison(compare);
  else {
    const id = event.target.closest('button[data-company]')?.dataset.company;
    if (id !== undefined) renderCompany(byCompanyId.get(id));
  }
  const selector = save !== undefined ? `[data-save="${save}"]` : compare !== undefined ? `[data-compare="${compare}"]` : null;
  if (selector) {
    const container = byId(explorer.screen === 'saved' ? 'savedResults' : 'companyResults');
    const next = container.querySelector?.(selector) ?? container.querySelector?.('button[data-company]');
    if (next) next.focus();
    else if (explorer.screen === 'saved') byId('savedTitle').focus();
  }
}

function initializeExplorer() {
  explorer.saved = new Set(readSavedCompanies().filter(id => byCompanyId.has(id)));
  refreshSelectionControls();
  byId('navSaved').addEventListener('click', openSavedPage);
  byId('savedResults').addEventListener('click', handleDirectoryClick);
  byId('savedCompaniesTab').addEventListener('click', () => browseCompanies(true, true));
  byId('allCompaniesTab').addEventListener('click', () => browseCompanies(false));
  byId('navCompare').addEventListener('click', () => openComparison());
  byId('saveCurrentBtn').addEventListener('click', () => toggleSavedCompany(explorer.company.id));
  byId('compareCurrentBtn').addEventListener('click', () => toggleComparison(explorer.company.id));
  byId('openComparison').addEventListener('click', () => openComparison());
  byId('clearComparison').addEventListener('click', () => {explorer.selected = []; refreshSelectionControls(); renderResults();});
  for (const id of ['dockCompanies', 'comparisonSelection']) byId(id).addEventListener('click', event => {
    const company = event.target.closest('button[data-remove]')?.dataset.remove;
    if (company !== undefined) toggleComparison(company);
  });
  byId('comparisonCompanyOptions').innerHTML = companies.filter(hasAnnualComparison).map(company => `<option value="${escapeHtml(company.t[0])}" label="${escapeHtml(company.n)}"></option>`).join('');
  byId('comparisonSearchForm').addEventListener('submit', event => {event.preventDefault(); compareFromSearch();});
  for (const id of comparisonSearchFields) byId(id).addEventListener('input', clearComparisonSearchError);
  byId('comparisonMetric').addEventListener('change', renderCompanyComparison);
  byId('comparisonTableHead').addEventListener('click', event => {
    const id = event.target.closest('button[data-open-report]')?.dataset.openReport;
    if (id !== undefined) renderCompany(byCompanyId.get(id));
  });
}
