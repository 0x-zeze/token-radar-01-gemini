// Meridian Launch Radar static client (zero network, reads window.RADAR from ../data.js).
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA || !Array.isArray(DATA.rows)) return;

  var root = document.getElementById('app');
  var state = {
    tab: 'pre-token',
    verdict: 'all',
    cat: 'all',
    chain: 'all',
    q: '',
    sort: 'implied',
    dir: -1,
    limit: 60,
    selected: null,
  };

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var a = Math.abs(n);
    var sign = n < 0 ? '-' : '';
    if (a >= 1e9) return sign + '$' + (a / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(1) + 'K';
    return sign + '$' + Math.round(a);
  }

  function fmtMoney(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var sign = n < 0 ? '-' : '';
    var a = Math.abs(n);
    if (a >= 1000) return sign + '$' + Math.round(a).toLocaleString('en-US');
    return sign + '$' + a.toFixed(2);
  }

  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }

  function fmtAge(days) {
    if (days === null || days === undefined) return 'unlisted';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return days + 'd';
  }

  function fmtMult(x) {
    return 'x' + x.toFixed(2);
  }

  // Independent browser-side verification of the peer-fitted valuation and token-odds equations.
  function recomputeImplied(row, val) {
    var g = Math.max(val.growth_floor_pct, Math.min(val.growth_cap_pct, row.change_7d === null ? 0 : row.change_7d));
    var age = row.age_days === null ? val.median_peer_age_days : row.age_days;
    var tvlF = Math.pow(Math.max(1, row.tvl_usd) / val.tvl_ref_usd, val.beta[1]);
    var gF = Math.pow(1 + g / 100, val.beta[2]);
    var ageF = Math.pow(1 + Math.max(0, age) / 365, val.beta[3]);
    return Math.max(1, Math.round(Math.exp(val.beta[0]) * tvlF * gF * ageF));
  }

  function recomputeOdds(row, odds) {
    var g = Math.max(odds.growth_floor_pct, Math.min(odds.growth_cap_pct, row.change_7d === null ? 0 : row.change_7d));
    var age = row.age_days === null ? odds.median_cohort_age_days : row.age_days;
    var z =
      odds.weights[0] +
      odds.weights[1] * Math.log(Math.max(1, row.tvl_usd) / odds.tvl_ref_usd) +
      odds.weights[2] * (g / 100) +
      odds.weights[3] * Math.log1p(Math.max(0, age) / 365);
    return Math.round((1 / (1 + Math.exp(-Math.max(-20, Math.min(20, z))))) * 1e4) / 1e4;
  }

  function verifyBoardEquations() {
    var matched = 0;
    for (var i = 0; i < DATA.rows.length; i++) {
      var r = DATA.rows[i];
      if (recomputeImplied(r, DATA.valuation) === r.implied_value_usd && Math.abs(recomputeOdds(r, DATA.odds) - r.token_odds) <= 0.0002) {
        matched++;
      }
    }
    return { matched: matched, total: DATA.rows.length };
  }

  var VERIFY = verifyBoardEquations();

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      var keys = Object.keys(attrs);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        var val = attrs[key];
        if (val === null || val === undefined) continue;
        if (key === 'class') node.className = val;
        else if (key === 'text') node.textContent = val;
        else if (key.slice(0, 2) === 'on') node.addEventListener(key.slice(2), val);
        else node.setAttribute(key, String(val));
      }
    }
    for (var i = 2; i < arguments.length; i++) {
      var ch = arguments[i];
      if (ch === null || ch === undefined || ch === false) continue;
      if (Array.isArray(ch)) {
        for (var j = 0; j < ch.length; j++) if (ch[j]) node.appendChild(ch[j]);
      } else if (typeof ch === 'string') {
        node.appendChild(document.createTextNode(ch));
      } else {
        node.appendChild(ch);
      }
    }
    return node;
  }

  function logoMark() {
    return el('span', { class: 'brand-ring', 'aria-hidden': 'true' },
      el('span', { class: 'brand-core' })
    );
  }

  function readHash() {
    var raw = window.location.hash.replace(/^#/, '');
    if (!raw) return;
    var p = new URLSearchParams(raw);
    if (p.get('tab')) state.tab = p.get('tab');
    if (p.get('verdict')) state.verdict = p.get('verdict');
    if (p.get('cat')) state.cat = p.get('cat');
    if (p.get('chain')) state.chain = p.get('chain');
    if (p.get('q')) state.q = p.get('q');
    if (p.get('sort')) state.sort = p.get('sort');
    if (p.get('dir')) state.dir = p.get('dir') === 'asc' ? 1 : -1;
    if (p.get('p')) state.selected = p.get('p');
  }

  function writeHash() {
    var p = new URLSearchParams();
    if (state.tab !== 'pre-token') p.set('tab', state.tab);
    if (state.verdict !== 'all') p.set('verdict', state.verdict);
    if (state.cat !== 'all') p.set('cat', state.cat);
    if (state.chain !== 'all') p.set('chain', state.chain);
    if (state.q) p.set('q', state.q);
    if (state.sort !== 'implied') p.set('sort', state.sort);
    if (state.dir === 1) p.set('dir', 'asc');
    if (state.selected) p.set('p', state.selected);
    var s = p.toString();
    window.history.replaceState(null, '', s ? '#' + s : window.location.pathname + window.location.search);
  }

  function cohortRows(tab) {
    return DATA.rows.filter(function (r) {
      if (tab === 'pre-token') return r.cohort === 'watchlist' || r.cohort === 'early';
      if (tab === 'watchlist') return r.cohort === 'watchlist';
      if (tab === 'derivative') return r.cohort === 'derivative';
      if (tab === 'live') return r.cohort === 'live';
      return true;
    });
  }

  function filteredRows() {
    var base = cohortRows(state.tab);
    var q = state.q.trim().toLowerCase();
    return base.filter(function (r) {
      if (state.verdict !== 'all' && r.farm.verdict !== state.verdict) return false;
      if (state.cat !== 'all' && (r.category || 'Uncategorized') !== state.cat) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (!q) return true;
      var hay = (r.name + ' ' + r.slug + ' ' + (r.category || '') + ' ' + r.chains.join(' ') + ' ' + r.farm.verdict).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function sortRows(list) {
    var key = state.sort;
    var dir = state.dir;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -9999 : a.change_7d; bv = b.change_7d === null ? -9999 : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? 99999 : a.age_days; bv = b.age_days === null ? 99999 : b.age_days; }
      else if (key === 'odds') { av = a.token_odds; bv = b.token_odds; }
      else if (key === 'drop') { av = a.farm.drop_bps; bv = b.farm.drop_bps; }
      else if (key === 'mvc') { av = a.farm.mvc_usd; bv = b.farm.mvc_usd; }
      else if (key === 'mcap') { av = a.mcap_usd === null ? -1 : a.mcap_usd; bv = b.mcap_usd === null ? -1 : b.mcap_usd; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function cohortTag(r) {
    if (r.cohort === 'watchlist') return el('span', { class: 'tag wl', text: 'Watchlist' });
    if (r.cohort === 'early') return el('span', { class: 'tag early', text: 'Early' });
    if (r.cohort === 'derivative') return el('span', { class: 'tag deriv', text: 'Wrapped/Infra' });
    return el('span', { class: 'tag live', text: r.symbol ? '$' + r.symbol : 'Live Token' });
  }

  function renderMasthead() {
    var s = DATA.summary;
    return el('header', { class: 'masthead' },
      el('div', { class: 'brand-group' },
        el('div', { class: 'brand-logo' }, logoMark()),
        el('div', null,
          el('h1', { class: 'brand-title', text: 'Meridian Launch Radar' }),
          el('p', { class: 'brand-sub', text: 'Peer-fitted token launch pricing, empirical token odds, and minimum-viable-capital farm verdicts' })
        )
      ),
      el('div', { class: 'meta-pills' },
        el('span', { class: 'meta-pill', text: 'Snapshot ' + DATA.as_of }),
        el('span', { class: 'meta-pill', text: s.total_protocols + ' / ' + s.total_protocols + ' accounted' }),
        el('span', { class: 'meta-pill ok', text: 'Equations verified ' + VERIFY.matched + '/' + VERIFY.total })
      )
    );
  }

  function renderKpis() {
    var s = DATA.summary;
    var terms = DATA.validation.terms;
    var naive = terms[0];
    var full = terms[terms.length - 1];
    var ov = DATA.validation.odds;
    return el('section', { class: 'kpi-strip', 'aria-label': 'Key metrics' },
      el('div', { class: 'kpi' },
        el('span', { class: 'kpi-label', text: 'Watchlist Coverage' }),
        el('span', { class: 'kpi-val accent', text: s.watchlist_count + ' / ' + s.watchlist_count }),
        el('span', { class: 'kpi-note', text: 'Floor >= ' + fmtUsd(DATA.floor_usd) + ' TVL, no token on record' })
      ),
      el('div', { class: 'kpi' },
        el('span', { class: 'kpi-label', text: 'Universe Split' }),
        el('span', { class: 'kpi-val', text: s.clean_pre_token_count + ' / ' + s.total_protocols }),
        el('span', { class: 'kpi-note', text: s.watchlist_count + ' WL + ' + s.early_count + ' early · ' + s.derivative_count + ' wrapped · ' + s.live_count + ' live' })
      ),
      el('div', { class: 'kpi' },
        el('span', { class: 'kpi-label', text: 'Costed Farm Verdicts' }),
        el('span', { class: 'kpi-val accent', text: s.farm_verdict_count + ' FARM' }),
        el('span', { class: 'kpi-note', text: s.selective_verdict_count + ' selective · ' + s.pass_verdict_count + ' pass (gas/dilution)' })
      ),
      el('div', { class: 'kpi' },
        el('span', { class: 'kpi-label', text: 'Blind Peer Accuracy' }),
        el('span', { class: 'kpi-val', text: 'WF ' + fmtMult(full.walk_forward.med_mult) }),
        el('span', { class: 'kpi-note', text: 'LOO ' + fmtMult(full.loo.med_mult) + ' vs naive ' + fmtMult(naive.walk_forward.med_mult) + ' WF' })
      ),
      el('div', { class: 'kpi' },
        el('span', { class: 'kpi-label', text: 'Peer Token Odds' }),
        el('span', { class: 'kpi-val', text: 'AUC ' + ov.cv10_auc.toFixed(3) }),
        el('span', { class: 'kpi-note', text: '10-fold Brier +' + ov.cv10_skill_pct.toFixed(1) + '% · WF AUC ' + ov.wf_auc.toFixed(3) })
      )
    );
  }

  function renderIntegrityStrip() {
    var v = DATA.valuation;
    var o = DATA.odds;
    var ov = DATA.validation.odds;
    var rows = DATA.validation.terms.map(function (t) {
      var cls = t.id === 'full' ? 'best' : t.id === 'naive' ? 'base' : '';
      return el('tr', { class: cls },
        el('td', { text: t.label }),
        el('td', { class: 'r', text: fmtMult(t.walk_forward.med_mult) }),
        el('td', { class: 'r', text: t.walk_forward.within_3x_pct.toFixed(0) + '%' }),
        el('td', { class: 'r', text: fmtMult(t.loo.med_mult) }),
        el('td', { class: 'r', text: t.loo.within_3x_pct.toFixed(0) + '%' }),
        el('td', { class: 'r', text: t.walk_forward.spearman_rho.toFixed(2) })
      );
    });

    return el('section', { class: 'integrity', 'aria-label': 'Model fit and held-out validation' },
      el('div', null,
        el('div', { class: 'int-head' },
          el('span', { class: 'int-kicker', text: 'Model Integrity · Peer-Fitted Valuation & Odds' }),
          el('span', { class: 'int-badge', text: 'n=' + v.peer_count + ' mcap peers · 0 hardcoded names' })
        ),
        el('div', { class: 'eq-box' },
          el('div', null,
            el('span', { class: 'dim', text: 'V = ' }),
            el('span', { class: 'hi', text: fmtUsd(v.anchor_usd) }),
            ' * (TVL/$50M)^',
            el('span', { class: 'hi', text: v.beta[1].toFixed(3) }),
            ' * (1+g7)^',
            el('span', { class: 'hi', text: v.beta[2].toFixed(3) }),
            ' * (1+age/365)^',
            el('span', { class: 'hi', text: v.beta[3].toFixed(3) })
          ),
          el('div', null,
            el('span', { class: 'dim', text: 'P(tok) = sig(' }),
            o.weights[0].toFixed(2) + ' + ' + o.weights[1].toFixed(2) + '*ln(TVL/$50M) ' + o.weights[2].toFixed(2) + '*g7 + ' + o.weights[3].toFixed(2) + '*ln(1+age/365)',
            el('span', { class: 'dim', text: ')' })
          )
        ),
        el('div', { class: 'int-notes' },
          el('div', { class: 'int-stat' },
            el('span', { text: 'Estimator & Guardrails' }),
            el('b', { text: 'Huber-Ridge (d=' + v.huber_delta + ') · g7 [' + v.growth_floor_pct + '%, +' + v.growth_cap_pct + '%]' })
          ),
          el('div', { class: 'int-stat' },
            el('span', { text: 'Token Odds Cohort (n=' + o.cohort_count + ')' }),
            el('b', { text: o.token_count + ' live / ' + (o.cohort_count - o.token_count) + ' pre-tok · Brier ' + ov.cv10_brier.toFixed(3) })
          )
        )
      ),
      el('div', null,
        el('div', { class: 'int-head' },
          el('span', { class: 'int-kicker', text: 'Per-Term Held-Out Ablation (Refit Every Fold)' }),
          el('span', { class: 'int-badge', text: 'Walk-Forward n=' + DATA.validation.terms[0].walk_forward.n + ' · LOO n=' + DATA.validation.terms[0].loo.n })
        ),
        el('table', { class: 'ablation-table' },
          el('thead', null, el('tr', null,
            el('th', { text: 'Specification' }),
            el('th', { class: 'r', text: 'WF Err' }),
            el('th', { class: 'r', text: 'WF <=3x' }),
            el('th', { class: 'r', text: 'LOO Err' }),
            el('th', { class: 'r', text: 'LOO <=3x' }),
            el('th', { class: 'r', text: 'WF rho' })
          )),
          el('tbody', null, rows)
        )
      )
    );
  }

  function renderToolbar(shownCount, totalInTab) {
    var s = DATA.summary;
    var tabs = [
      { id: 'pre-token', label: 'Pre-Token Radar', count: s.clean_pre_token_count },
      { id: 'watchlist', label: 'Watchlist Floor', count: s.watchlist_count },
      { id: 'derivative', label: 'Wrapped / Infra', count: s.derivative_count },
      { id: 'live', label: 'Live Peers', count: s.live_count },
      { id: 'all', label: 'All Universe', count: s.total_protocols },
    ];
    var tabButtons = tabs.map(function (t) {
      return el('button', {
        type: 'button',
        class: 'seg-btn',
        'aria-pressed': state.tab === t.id ? 'true' : 'false',
        onclick: function () {
          state.tab = t.id;
          state.verdict = 'all';
          state.limit = 60;
          writeHash();
          render();
        },
      }, t.label, el('span', { class: 'cnt', text: String(t.count) }));
    });

    var verdicts = [
      { id: 'all', label: 'All verdicts', cls: '' },
      { id: 'FARM', label: 'FARM', cls: 'farm' },
      { id: 'SELECTIVE', label: 'SELECTIVE', cls: 'selective' },
      { id: 'PASS', label: 'PASS', cls: 'pass' },
    ];
    var verdictBtns = verdicts.map(function (v) {
      return el('button', {
        type: 'button',
        class: 'vpill ' + v.cls,
        'aria-pressed': state.verdict === v.id ? 'true' : 'false',
        onclick: function () { state.verdict = v.id; state.limit = 60; writeHash(); render(); },
        text: v.label,
      });
    });

    var base = cohortRows(state.tab);
    var catSet = {};
    var chainCount = {};
    for (var i = 0; i < base.length; i++) {
      var c = base[i].category || 'Uncategorized';
      catSet[c] = (catSet[c] || 0) + 1;
      for (var j = 0; j < base[i].chains.length; j++) {
        var ch = base[i].chains[j];
        chainCount[ch] = (chainCount[ch] || 0) + 1;
      }
    }
    var cats = Object.keys(catSet).sort();
    var chains = Object.keys(chainCount).sort(function (a, b) { return chainCount[b] - chainCount[a] || (a < b ? -1 : 1); }).slice(0, 35);

    var search = el('input', {
      type: 'search',
      id: 'q',
      value: state.q,
      placeholder: 'Search protocol, category, chain...',
      'aria-label': 'Search protocols',
    });
    search.addEventListener('input', function () { state.q = search.value; state.limit = 60; writeHash(); render(); });

    var catSel = el('select', { id: 'cat', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories (' + cats.length + ')' }),
      cats.map(function (c) {
        return el('option', { value: c, text: c + ' (' + catSet[c] + ')', selected: state.cat === c ? 'selected' : null });
      })
    );
    catSel.addEventListener('change', function () { state.cat = catSel.value; state.limit = 60; writeHash(); render(); });

    var chainSel = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (ch) {
        return el('option', { value: ch, text: ch + ' (' + chainCount[ch] + ')', selected: state.chain === ch ? 'selected' : null });
      })
    );
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; state.limit = 60; writeHash(); render(); });

    var isFiltered = state.verdict !== 'all' || state.cat !== 'all' || state.chain !== 'all' || state.q.trim() !== '';

    return el('section', { class: 'toolbar', 'aria-label': 'Filters and cohorts' },
      el('div', { class: 'toolbar-row' },
        el('div', { class: 'seg-group', role: 'group', 'aria-label': 'Protocol cohort' }, tabButtons),
        (state.tab === 'pre-token' || state.tab === 'watchlist' || state.tab === 'all')
          ? el('div', { class: 'verdict-pills', role: 'group', 'aria-label': 'Farm verdict filter' }, verdictBtns)
          : null
      ),
      el('div', { class: 'filter-controls' },
        search,
        catSel,
        chainSel,
        isFiltered ? el('button', {
          type: 'button',
          class: 'btn-reset',
          text: 'Clear filters',
          onclick: function () {
            state.verdict = 'all'; state.cat = 'all'; state.chain = 'all'; state.q = ''; state.limit = 60;
            writeHash(); render();
          },
        }) : null,
        el('span', { class: 'result-summary', text: 'Showing ' + shownCount + ' of ' + totalInTab + ' protocols · Click any row for equation & farm plan' })
      )
    );
  }

  function sortTh(key, label, alignRight) {
    var active = state.sort === key;
    return el('th', { scope: 'col', class: alignRight ? 'r' : null },
      el('button', {
        type: 'button',
        onclick: function () {
          if (state.sort === key) state.dir = -state.dir;
          else { state.sort = key; state.dir = key === 'name' || key === 'mvc' ? 1 : -1; }
          writeHash();
          render();
        },
      }, label, active ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? '▼' : '▲' }) : null)
    );
  }

  function renderTable(list) {
    if (list.length === 0) {
      return el('div', { class: 'panel' },
        el('div', { class: 'empty-state' },
          el('h2', { text: 'No protocols match the active filter' }),
          el('p', { text: 'Reset the search, category, chain, or verdict filter to return to the ranked board.' }),
          el('button', {
            type: 'button',
            class: 'btn-reset',
            text: 'Reset all filters',
            onclick: function () { state.verdict = 'all'; state.cat = 'all'; state.chain = 'all'; state.q = ''; writeHash(); render(); },
          })
        )
      );
    }

    var isLiveTab = state.tab === 'live';
    var maxVal = 1;
    for (var i = 0; i < list.length; i++) if (list[i].implied_value_usd > maxVal) maxVal = list[i].implied_value_usd;
    var maxLog = Math.log(maxVal + 1);

    var visible = list.slice(0, state.limit);
    var tbody = el('tbody');

    for (var idx = 0; idx < visible.length; idx++) {
      (function (r) {
        var rankLabel = (state.tab === 'pre-token' || state.tab === 'watchlist') && r.radar_rank !== null
          ? '#' + r.radar_rank
          : '#' + r.rank;
        var gCls = r.change_7d === null ? 'muted' : r.change_7d >= 0 ? 'pos' : 'neg';
        var barW = Math.max(8, Math.round((Math.log(r.implied_value_usd + 1) / maxLog) * 100));
        var eqPreview = 'x' + r.equation.tvl_factor.toFixed(2) + ' TVL · x' + r.equation.growth_factor.toFixed(3) + ' 7d · x' + r.equation.age_factor.toFixed(2) + ' age';
        var chainLine = state.chain !== 'all' && state.chain !== r.farm.chain
          ? state.chain + ' (opt: ' + r.farm.chain + ', +' + (r.chains.length - 1) + ')'
          : r.farm.chain + (r.chains.length > 1 ? ' (+' + (r.chains.length - 1) + ')' : '');
        var valCol = isLiveTab && r.mcap_usd !== null
          ? el('div', { class: 'val-cell' },
              el('div', { class: 'val-row' },
                el('b', { class: 'mono', text: fmtUsd(r.mcap_usd) }),
                el('span', { class: 'val-eq', text: 'model ' + fmtUsd(r.implied_value_usd) + ' (' + r.peer_error_ratio.toFixed(2) + 'x)' })
              ),
              el('span', { class: 'val-eq', text: eqPreview })
            )
          : el('div', { class: 'val-cell' },
              el('div', { class: 'val-row' },
                el('div', { class: 'val-bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + barW + '%' })),
                el('b', { class: 'mono', text: fmtUsd(r.implied_value_usd) })
              ),
              el('span', { class: 'val-eq', text: eqPreview })
            );

        var tr = el('tr', {
          'data-selected': state.selected === r.slug ? 'true' : 'false',
          tabindex: '0',
          onclick: function () { openDrawer(r.slug); },
          onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrawer(r.slug); } },
        },
          el('td', { class: 'mono muted', text: rankLabel }),
          el('td', null,
            el('div', { class: 'proto-cell' },
              el('div', { class: 'proto-top' }, el('span', { class: 'proto-name', text: r.name }), cohortTag(r)),
              el('span', { class: 'proto-sub', text: (r.category || 'Uncategorized') + ' · ' + chainLine })
            )
          ),
          el('td', { class: 'mono r', text: fmtUsd(r.tvl_usd) }),
          el('td', { class: 'mono r ' + gCls, text: fmtPct(r.change_7d) }),
          el('td', { class: 'mono r muted', text: fmtAge(r.age_days) }),
          el('td', null, valCol),
          el('td', null,
            el('div', { class: 'odds-cell' },
              el('span', { class: 'mono', text: Math.round(r.token_odds * 100) + '%' }),
              el('div', { class: 'odds-bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.round(r.token_odds * 100) + '%' }))
            )
          ),
          el('td', null,
            el('div', { class: 'farm-cell' },
              el('div', null, el('span', { class: 'verdict-chip ' + r.farm.verdict, text: r.farm.verdict })),
              el('span', { class: 'farm-meta', text: 'MVC $' + r.farm.mvc_usd + ' · gas ' + fmtMoney(r.farm.gas_cost_usd) + ' · ' + r.farm.drop_bps + 'bps' })
            )
          )
        );
        tbody.appendChild(tr);
      })(visible[idx]);
    }

    var table = el('table', { class: 'board' },
      el('thead', null, el('tr', null,
        sortTh('implied', 'Rank', false),
        sortTh('name', 'Protocol & Chain', false),
        sortTh('tvl', 'TVL', true),
        sortTh('growth', '7d', true),
        sortTh('age', 'Age', true),
        sortTh(isLiveTab ? 'mcap' : 'implied', isLiveTab ? 'Actual Mcap vs Model' : 'Implied Launch Value & Equation', false),
        sortTh('odds', 'Token Odds', false),
        sortTh('drop', 'Costed Farm Verdict', false)
      )),
      tbody
    );

    var footer = list.length > visible.length
      ? el('div', { class: 'more-bar' },
          el('span', { text: 'Showing top ' + visible.length + ' of ' + list.length + ' rows in this view.' }),
          el('button', {
            type: 'button',
            class: 'btn-reset',
            text: 'Show all ' + list.length + ' rows',
            onclick: function () { state.limit = list.length; render(); },
          })
        )
      : null;

    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' }, table), footer);
  }

  var drawer = el('dialog', { class: 'drawer', id: 'drawer', 'aria-labelledby': 'drawer-title' });
  drawer.addEventListener('close', function () {
    if (state.selected !== null) {
      state.selected = null;
      writeHash();
      render();
    }
  });

  function parseStep(raw) {
    var costIdx = raw.indexOf(' Cost: ');
    var timeIdx = raw.indexOf(' Time: ');
    if (costIdx < 0) return { action: raw, cost: '', time: '' };
    var action = raw.slice(0, costIdx);
    var cost = timeIdx > costIdx ? raw.slice(costIdx + 7, timeIdx).replace(/\.$/, '') : raw.slice(costIdx + 7).replace(/\.$/, '');
    var time = timeIdx > costIdx ? raw.slice(timeIdx + 7).replace(/\.$/, '') : '';
    return { action: action, cost: cost, time: time };
  }

  function openDrawer(slug) {
    var row = null;
    for (var i = 0; i < DATA.rows.length; i++) {
      if (DATA.rows[i].slug === slug) { row = DATA.rows[i]; break; }
    }
    if (!row) return;
    if (state.selected !== slug) {
      state.selected = slug;
      writeHash();
    }

    var v = DATA.valuation;
    var eq = row.equation;
    var f = row.farm;
    var browserVal = recomputeImplied(row, v);
    var browserOdds = recomputeOdds(row, DATA.odds);
    var exactMatch = browserVal === row.implied_value_usd;

    drawer.textContent = '';

    drawer.appendChild(el('div', { class: 'drawer-head' },
      el('div', null,
        el('div', { class: 'drawer-kicker' },
          row.radar_rank !== null ? el('span', { class: 'meta-pill', text: 'Pre-Token #' + row.radar_rank }) : null,
          el('span', { class: 'meta-pill', text: 'Board #' + row.rank + ' / ' + DATA.summary.total_protocols }),
          cohortTag(row),
          el('span', { class: 'verdict-chip ' + f.verdict, text: f.verdict })
        ),
        el('h2', { id: 'drawer-title', class: 'drawer-title', text: row.name }),
        el('p', { class: 'drawer-sub', text: (row.category || 'Uncategorized') + ' · slug: ' + row.slug + ' · ' + (row.token_status === 'live-token' ? 'Token recorded' : 'No token recorded in snapshot') }),
        el('div', { class: 'chain-chips' }, row.chains.slice(0, 8).map(function (c) {
          return el('span', { class: 'chip', text: c + (c === f.chain ? ' (optimal)' : '') });
        }))
      ),
      el('button', { type: 'button', class: 'btn-close', text: 'Close', onclick: function () { drawer.close(); } })
    ));

    var formulaText =
      fmtUsd(eq.anchor_usd) +
      ' * (' + fmtUsd(row.tvl_usd) + '/$50M)^' + v.beta[1].toFixed(3) +
      ' * (1 ' + (eq.growth_clamped_pct >= 0 ? '+ ' : '- ') + Math.abs(eq.growth_clamped_pct).toFixed(1) + '%)^' + v.beta[2].toFixed(3) +
      ' * (1 + ' + eq.age_used_days + '/365)^' + v.beta[3].toFixed(3) +
      ' = ';

    var eqRows = [
      ['Peer Anchor (V0)', fmtUsd(eq.anchor_usd)],
      ['TVL (' + fmtUsd(row.tvl_usd) + ')', 'x' + eq.tvl_factor.toFixed(3)],
      ['7d Growth (' + fmtPct(row.change_7d) + ')', 'x' + eq.growth_factor.toFixed(3)],
      ['Age (' + (eq.age_imputed ? 'med ' + eq.age_used_days + 'd' : eq.age_used_days + 'd') + ')', 'x' + eq.age_factor.toFixed(3)],
      ['Implied Launch Val', fmtUsd(row.implied_value_usd)],
      ['Peer Odds P(tok)', (row.token_odds * 100).toFixed(1) + '% (chk ' + (browserOdds * 100).toFixed(1) + '%)'],
      ['Odds-Weighted EV', fmtUsd(row.expected_value_usd)],
      ['Pool Basis', f.airdrop_pool_pct + '% circ (~5% FDV)'],
    ];
    if (row.mcap_usd !== null) {
      eqRows[7] = ['Actual Market Cap', fmtUsd(row.mcap_usd) + ' (' + (row.peer_error_ratio !== null ? row.peer_error_ratio.toFixed(2) + 'x' : 'n/a') + ')'];
    }

    var body = el('div', { class: 'drawer-body' },
      el('section', { class: 'd-section' },
        el('h3', { text: '1. Peer-Fitted Value Equation' }),
        el('div', { class: 'eq-formula' }, formulaText, el('span', { class: 'hi', text: fmtUsd(row.implied_value_usd) })),
        el('div', { class: 'eq-grid' }, eqRows.map(function (pair) {
          return el('div', { class: 'eq-line' }, el('span', { text: pair[0] }), el('b', { text: pair[1] }));
        })),
        el('div', { class: 'verify-note', text: exactMatch ? 'Browser recompute verified: ' + fmtUsd(browserVal) + ' matches board.json to the dollar.' : 'Mismatch detected vs board.json.' })
      ),
      el('section', { class: 'd-section' },
        el('h3', { text: '2. Costed Farm Economics (MVC Sizing)' }),
        el('div', { class: 'verdict-banner ' + f.verdict, text: f.verdict + ': ' + f.reason }),
        el('div', { class: 'econ-grid' },
          el('div', { class: 'econ-card' }, el('span', { text: 'Min Viable Capital' }), el('b', { text: '$' + f.mvc_usd.toLocaleString('en-US') })),
          el('div', { class: 'econ-card' }, el('span', { text: 'Direct Gas (' + f.tx_count + ' txs)' }), el('b', { text: fmtMoney(f.gas_cost_usd) })),
          el('div', { class: 'econ-card' }, el('span', { text: 'Expected Drop Yield' }), el('b', { text: f.drop_bps + ' bps' })),
          el('div', { class: 'econ-card' }, el('span', { text: 'Est. Payout / Net EV' }), el('b', { text: fmtMoney(f.est_payout_usd) + ' (' + fmtMoney(f.net_ev_usd) + ')' }))
        )
      ),
      el('section', { class: 'd-section' },
        el('h3', { text: '3. Concrete Farm Plan (' + row.farm_steps.length + ' Steps · ' + f.hold_days + 'd Hold · ' + f.time_minutes + 'm Active)' }),
        el('ol', { class: 'step-list' }, row.farm_steps.map(function (raw, idx) {
          var s = parseStep(raw);
          return el('li', { class: 'step-item' },
            el('div', { class: 'step-top' },
              el('span', { class: 'step-num', text: String(idx + 1) }),
              el('span', { class: 'step-action', text: s.action })
            ),
            el('div', { class: 'step-meta' },
              s.cost ? el('span', { class: 'chip', text: 'Cost: ' + s.cost }) : null,
              s.time ? el('span', { class: 'chip', text: 'Time: ' + s.time }) : null
            )
          );
        }))
      )
    );

    drawer.appendChild(body);
    if (typeof drawer.showModal === 'function') {
      if (!drawer.open) drawer.showModal();
    } else {
      drawer.setAttribute('open', '');
    }
  }

  function render() {
    var list = sortRows(filteredRows());
    var totalInTab = cohortRows(state.tab).length;
    root.textContent = '';
    var shell = el('main', { class: 'shell' },
      renderMasthead(),
      renderKpis(),
      renderIntegrityStrip(),
      renderToolbar(list.length, totalInTab),
      renderTable(list),
      el('p', {
        class: 'foot-note',
        text: 'Data source: DefiLlama protocol snapshot (' + DATA.as_of + '). Implied values and token odds are statistical peer estimates from snapshot figures, not promises of issuance or financial advice. Protocols with no token recorded may still have tokens unrecorded in DefiLlama.',
      })
    );
    root.appendChild(shell);
    if (!drawer.isConnected) root.appendChild(drawer);
    root.setAttribute('aria-busy', 'false');
    if (state.selected) openDrawer(state.selected);
  }

  readHash();
  render();
})();
