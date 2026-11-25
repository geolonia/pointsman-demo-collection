// The collection demo page: a bulky waste booking in five steps (place,
// items, day, check and send, result). The items come from the city's
// catalogue in the data platform; Pointsman checks the booking and picks the
// day. Plain JavaScript, no build step.
(function () {
  'use strict';

  var T = {
    en: {
      demo: 'collection demo', devTitle: 'For developers', title: 'Bulky waste, collected on a day that fits',
      lead: 'Book a bulky waste collection in Nishinomiya or Ashiya, step by step. The items and fees are the cities’ own lists, kept in GeonicDB, a FIWARE data platform. Pointsman checks the booking, and picks a day that fits the collection truck’s route, with a reason for each.',
      care: 'A demo: nothing goes to the cities, no truck comes, and the booking is deleted after a day. The route costs are a simple model for now, not real routes. Book with your city for a real collection.',
      steps: 'Steps', s1: 'Place', s2: 'Items', s3: 'Day', s4: 'Check and send', s5: 'Result',
      t1: 'Where are the items put out?', t2: 'What is to be collected?', t3: 'Which day?', t4: 'Check and send', t5: 'Your booking',
      placeHint: 'Click the map where the items will be put out, or search for a place. Pick a spot near the street, not your exact home: the demo needs no address.',
      search: 'Search for a place', searchBtn: 'Search', searching: 'Searching…', noHit: 'Nothing found in Nishinomiya or Ashiya.',
      outside: 'This place is not in Nishinomiya or Ashiya. Pick a place in one of the two cities.', placeFailed: 'The address service did not answer. Try again.',
      placeIs: '{city}, {town}', area: 'Collection area', facility: 'Facility the items go to',
      catalogLoading: 'Loading the city’s item list…', catalogFailed: 'The item list could not be loaded.', filter: 'Find an item', all: 'All',
      c_furniture: 'Furniture', c_bedding: 'Bedding', c_appliance: 'Appliances', c_bicycle: 'Bicycles', c_sports: 'Sports and leisure', c_other: 'Other',
      add: 'Add', notCollected: 'Not collected as bulky waste', twoPerson: 'Two people carry it', feeUnknown: 'fee not published',
      yourItems: 'Your items', none: 'No items yet.', remove: 'Remove', qty: 'Number', total: 'Fee', kinds: '{n} kinds of item', kindsMax: '{n} of at most {max} kinds of item',
      overMax: 'More kinds of item than one booking may have. Pointsman will ask you to split the booking.', yen: '¥{n}',
      needQ: 'How much do you need a certain day?', n_fixed: 'It must be that day (for example, I am moving out)', n_preferred: 'I would like that day, but another is fine', n_any: 'Any day is fine',
      dayQ: 'Wished day', carryQ: 'I cannot carry the items out myself (age, illness or disability)', carryHint: '{city} carries bulky waste out of the home for people who cannot ({service}). A person arranges it.',
      noCarry: '{city} does not carry bulky waste out of the home: the items must be put out where agreed. Ask family or neighbours, or a private service.',
      noDays: 'No collection days in the next two weeks for this area.',
      next: 'Next', back: 'Back', send: 'Send', change: 'Change the booking', retry: 'Try again', cityPage: 'The city\u2019s page', again: 'Make another booking', sending: 'Sending…',
      sendNote: 'This is a demo: nothing goes to the city, and the booking is deleted after a day. No name or phone number is asked for.',
      closed: 'Bookings are not taken yet. You can look at the items and fees.',
      e_busy: 'The demo is busy, or has had enough bookings for today. Try again later.', e_other: 'The booking could not be sent. Try again.', e_lost: 'The booking is no longer there (bookings are deleted after a day).',
      waiting: 'Pointsman is checking the booking…', waitingDay: 'Pointsman is choosing a day…', slow: 'This takes longer than usual. The result appears here as soon as it is there.', lookAgain: 'Look again',
      gaveUp: 'No result yet. The demo tries again every hour; you can also look again later.',
      checkStep: 'Check of the booking', dayStep: 'Collection day', why: 'Why',
      ia_plan: 'Can be planned', ia_redirect: 'Some items go elsewhere', ia_ask: 'Please change the booking', ia_review: 'A person arranges it',
      in_redirect: 'The city does not collect these as bulky waste. Take them out of the booking:', in_ask_over: 'One booking may have at most {max} kinds of item. Split them over two bookings.', in_ask_none: 'There is nothing to collect.',
      in_review: 'In a real service, staff would call you to arrange a time for carrying the items out. This demo sends it to no one.',
      sa_accept: 'Your wished day', sa_assign_best: 'The day that fits the route best', sa_offer_days: 'Pick one of these days', sa_review: 'A person finds a day', sa_hold: 'No day yet',
      sn_accept: 'The truck is near your place that day anyway, or you need that day.', sn_assign_best: 'Any day was fine, so Pointsman chose the day that costs the route least.',
      sn_offer_days: 'Your wished day would cost the route a lot more, or is full. These days fit the route better.', sn_review: 'No day in the next two weeks could take it. In a real service, staff would call you.',
      sn_hold: 'The booking needs a change first.', chosen: 'Collection on {day}', choose: 'Choose', chooseFailed: 'The day could not be saved. Try again.',
      extra: '+{n} min for the truck', full: 'full', wished: 'wished', costsTitle: 'What one more stop costs each day (mock)', putOut: 'Put the items out by {time} on the day, with the fee stickers (粗大ごみ処理券) on them.',
      devLead: 'What the page asks the data platform (NGSI-LD), and what it gets back.', devCatalog: 'The city’s catalogue (CatalogItem entities)', devRequest: 'The booking (ServiceRequest entity)',
      devIntake: 'Pointsman’s intake decision (Decision entity)', devSlot: 'Pointsman’s day decision (Decision entity)',
      lSource: 'Source of this demo', lPointsman: 'Pointsman', gsi: 'GSI map tiles', credit: 'Items and fees: the bulky waste pages of Nishinomiya City and Ashiya City (see the source).',
      noMap: 'The map could not be loaded.',
      ri0: 'Some of the booking\u2019s data is missing.', ri1: 'Some items are not collected as bulky waste.', ri2: 'There are no items.', ri3: 'More kinds of item than one booking may have.',
      ri4: 'Carrying items out of the home needs a person to arrange it.', rid: 'Every item is collected as bulky waste, within the city\u2019s limit, and you put them out yourself.',
      rs0: 'The check of the booking did not let it through.', rs1: 'Some data for choosing a day is missing.', rs2: 'Any day is fine, and the cheapest day adds only {best} minutes to the route (at most 20).',
      rs3: 'Your wished day adds only {wished} minutes to the route (at most 15).', rs4: 'You need that day, and the truck can still take it (+{wished} minutes).',
      rs5: 'Your wished day would add {wished} minutes to the route, or is full; other days add as little as {best} minutes.', rsd: 'No day in the next two weeks can take one more stop.',
    },
    ja: {
      demo: '収集デモ', devTitle: '開発者向け', title: '粗大ごみを、ルートに合う日に',
      lead: '西宮市・芦屋市の粗大ごみ収集を、順番に申し込めます。品目と手数料は両市の公表しているもので、FIWARE のデータ基盤 GeonicDB に入っています。Pointsman が申込を確認し、収集車のルートに合う日を、理由とともに選びます。',
      care: 'これはデモです。市には何も届かず、収集車も来ません。申込は1日で削除されます。ルートの負担は今のところ簡単なモデルで、実際のルートではありません。実際の収集は各市にお申し込みください。',
      steps: '手順', s1: '場所', s2: '品目', s3: '日', s4: '確認して送信', s5: '結果',
      t1: '品目を出す場所はどこですか', t2: '何を出しますか', t3: 'いつにしますか', t4: '確認して送信', t5: 'あなたの申込',
      placeHint: '品目を出す場所を地図でクリックするか、場所を検索してください。自宅そのものではなく、近くの道路ぎわを選んでください。このデモに住所は不要です。',
      search: '場所を検索', searchBtn: '検索', searching: '検索しています…', noHit: '西宮市・芦屋市で見つかりませんでした。',
      outside: 'この場所は西宮市・芦屋市ではありません。どちらかの市の場所を選んでください。', placeFailed: '住所のサービスから応答がありません。もう一度お試しください。',
      placeIs: '{city} {town}', area: '収集地区', facility: '品目を運ぶ施設',
      catalogLoading: '市の品目一覧を読み込んでいます…', catalogFailed: '品目一覧を読み込めませんでした。', filter: '品目を探す', all: 'すべて',
      c_furniture: '家具', c_bedding: '寝具', c_appliance: '電化製品', c_bicycle: '自転車', c_sports: 'スポーツ・レジャー', c_other: 'その他',
      add: '追加', notCollected: '粗大ごみとして収集しない', twoPerson: '2人で運ぶ', feeUnknown: '手数料の公表なし',
      yourItems: '申込む品目', none: 'まだ品目がありません。', remove: '削除', qty: '数', total: '手数料', kinds: '{n} 品目', kindsMax: '{n} 品目（最大 {max} 品目）',
      overMax: '1回の申込の品目数の上限を超えています。Pointsman が申込を分けるようお願いします。', yen: '{n} 円',
      needQ: 'その日でないと困りますか', n_fixed: 'その日でないと困る（引っ越しなど）', n_preferred: 'できればその日。ほかの日でもよい', n_any: 'いつでもよい',
      dayQ: '希望日', carryQ: '自分で品目を運び出せない（高齢・病気・障がい）', carryHint: '{city}には、運び出せない方のために家の中から運び出す制度（{service}）があります。職員が日時を調整します。',
      noCarry: '{city}は粗大ごみを家の中から運び出しません。決めた場所に出す必要があります。家族や近所の方、民間のサービスにご相談ください。',
      noDays: 'この地区には、2週間以内に収集日がありません。',
      next: '次へ', back: '戻る', send: '送信', change: '申込を変える', retry: 'もう一度読み込む', cityPage: '市のページ', again: 'もう一度申し込む', sending: '送信しています…',
      sendNote: 'これはデモです。市には何も届かず、申込は1日で削除されます。名前や電話番号は聞きません。',
      closed: '申込はまだ受け付けていません。品目と手数料はご覧いただけます。',
      e_busy: 'デモが混み合っているか、今日の受付数に達しました。時間をおいてお試しください。', e_other: '申込を送れませんでした。もう一度お試しください。', e_lost: '申込はもうありません（申込は1日で削除されます）。',
      waiting: 'Pointsman が申込を確認しています…', waitingDay: 'Pointsman が日を選んでいます…', slow: 'いつもより時間がかかっています。結果が出しだい、ここに表示します。', lookAgain: 'もう一度見る',
      gaveUp: 'まだ結果がありません。デモは1時間ごとにやり直します。あとでもう一度ご覧ください。',
      checkStep: '申込の確認', dayStep: '収集日', why: '理由',
      ia_plan: '計画できます', ia_redirect: '別の出し方の品目があります', ia_ask: '申込を変えてください', ia_review: '職員が調整します',
      in_redirect: '市は、これらを粗大ごみとして収集しません。申込から外してください：', in_ask_over: '1回の申込は {max} 品目までです。2回に分けてください。', in_ask_none: '収集する品目がありません。',
      in_review: '実際のサービスでは、職員が運び出しの日時を電話で調整します（このデモではどこにも届きません）。',
      sa_accept: '希望日で受けます', sa_assign_best: 'ルートに最も合う日', sa_offer_days: 'この中から選んでください', sa_review: '職員が日を探します', sa_hold: 'まだ日はありません',
      sn_accept: 'その日は収集車がもともと近くを通るか、その日が必要です。', sn_assign_best: 'いつでもよいとのことなので、ルートへの負担が最も少ない日を選びました。',
      sn_offer_days: '希望日はルートへの負担が大きいか、いっぱいです。こちらの日のほうがルートに合います。', sn_review: '2週間以内に受けられる日がありません。実際のサービスでは、職員から電話します。',
      sn_hold: 'まず申込の変更が必要です。', chosen: '収集日：{day}', choose: 'この日にする', chooseFailed: '日を保存できませんでした。もう一度お試しください。',
      extra: '収集車 +{n} 分', full: '満杯', wished: '希望日', costsTitle: '1か所増えたときの日ごとの負担（モデル）', putOut: '当日の朝 {time} までに、粗大ごみ処理券を貼って出してください。',
      devLead: 'このページがデータ基盤に何を問い合わせ（NGSI-LD）、何が返ってくるか。', devCatalog: '市の品目一覧（CatalogItem エンティティ）', devRequest: '申込（ServiceRequest エンティティ）',
      devIntake: 'Pointsman の受付の判断（Decision エンティティ）', devSlot: 'Pointsman の収集日の判断（Decision エンティティ）',
      lSource: 'このデモのソース', lPointsman: 'Pointsman', gsi: '地理院タイル', credit: '品目と手数料：西宮市・芦屋市の粗大ごみのページ（ソースを参照）。',
      noMap: '地図を読み込めませんでした。',
      ri0: '申込のデータの一部が欠けています。', ri1: '粗大ごみとして収集しない品目があります。', ri2: '品目がありません。', ri3: '1回の申込の品目数の上限を超えています。',
      ri4: '家の中からの運び出しは、職員の調整が必要です。', rid: 'すべて粗大ごみとして収集する品目で、市の上限内で、ご自身で出せます。',
      rs0: '申込の確認を通っていません。', rs1: '日を選ぶためのデータの一部が欠けています。', rs2: 'いつでもよく、最も負担の少ない日はルートへの追加が {best} 分だけです（20 分以内）。',
      rs3: '希望日はルートへの追加が {wished} 分だけです（15 分以内）。', rs4: 'その日が必要で、収集車にまだ余裕があります（+{wished} 分）。',
      rs5: '希望日はルートに {wished} 分追加になるか、いっぱいです。ほかの日なら {best} 分で済みます。', rsd: '2週間以内に、もう1か所を受けられる日がありません。',
    },
  };

  var stored = null;
  try { stored = localStorage.getItem('lang'); } catch (e) {}
  var lang = stored === 'ja' || stored === 'en' ? stored : (navigator.language || '').indexOf('ja') === 0 ? 'ja' : 'en';
  /** /api/config, or null until it answers. */
  var config = null;
  var map = null;
  var marker = null;
  /** The booking being made, and what came back. */
  var flow = { step: 1, query: '', place: null, catalog: null, catalogFor: null, filter: '', category: '', lines: [], dateNeed: 'preferred', wishedDay: '', carryOut: false, id: null, result: null, sending: false, error: '', polls: 0 };

  function t(key, vars) {
    var s = (T[lang] && T[lang][key]) || T.en[key] || key;
    Object.keys(vars || {}).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  }
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (children || []).forEach(function (c) { if (c != null) e.append(c); });
    return e;
  }
  function btn(label, onclick, cls) { return el('button', { type: 'button', class: 'btn' + (cls ? ' ' + cls : ''), onclick: onclick }, [label]); }
  function L(m) { return m ? (m[lang] || m.ja || m.en) : ''; }
  function yen(n) { return t('yen', { n: Number(n).toLocaleString(lang === 'ja' ? 'ja-JP' : 'en-GB') }); }
  function dayLabel(iso) {
    var d = new Date(iso + 'T00:00:00Z');
    return d.toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-GB', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  function city() { return config && flow.place ? config.cities.filter(function (c) { return c.code === flow.place.city; })[0] : null; }
  function area() { var c = city(); return c ? c.areas.filter(function (a) { return a.key === flow.place.area; })[0] : null; }

  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (n) { n.textContent = t(n.dataset.i18n); });
    document.querySelectorAll('[data-i18n-label]').forEach(function (n) { n.setAttribute('aria-label', t(n.dataset.i18nLabel)); });
    var b = document.getElementById('lang');
    b.textContent = lang === 'ja' ? 'English' : '日本語';
    b.lang = lang === 'ja' ? 'en' : 'ja';
    render();
  }

  // --- the map ---------------------------------------------------------------
  function theme() {
    var set = document.documentElement.dataset.theme;
    if (set === 'light' || set === 'dark') return set;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function style() {
    return {
      version: 8,
      sources: { gsi: { type: 'raster', tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 18, attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>' } },
      layers: [{ id: 'gsi', type: 'raster', source: 'gsi', paint: theme() === 'dark' ? { 'raster-brightness-max': 0.55, 'raster-saturation': -0.6 } : {} }],
    };
  }
  function makeMap() {
    if (!window.maplibregl) { document.getElementById('status').textContent = t('noMap'); return null; }
    var m = new maplibregl.Map({ container: 'map', style: style(), center: [135.33, 34.75], zoom: 11.2, attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    m.on('click', function (e) { if (flow.step === 1) pickPlace([e.lngLat.lng, e.lngLat.lat]); });
    (config ? config.cities : []).forEach(function (c) {
      c.areas.forEach(function (a) {
        var dot = el('div', { class: 'depot', title: L(a.name) });
        new maplibregl.Marker({ element: dot }).setLngLat(a.depot).addTo(m);
      });
    });
    return m;
  }

  function pickPlace(at) {
    flow.error = '';
    flow.place = { at: at, loading: true };
    if (map) {
      if (!marker) marker = new maplibregl.Marker({ color: '#2E9E6B' });
      marker.setLngLat(at).addTo(map);
    }
    render();
    fetch('/api/place?lon=' + at[0].toFixed(6) + '&lat=' + at[1].toFixed(6)).then(function (r) {
      if (r.status === 404) return { outside: true };
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    }).then(function (j) {
      if (!flow.place || flow.place.at !== at) return;
      if (j.outside) { flow.place = null; flow.error = t('outside'); }
      else {
        flow.place = { at: at, city: j.city, area: j.area, town: j.town };
        if (flow.catalogFor !== j.city) { flow.lines = []; loadCatalog(j.city); }
        else if (flow.catalog === false) loadCatalog(j.city);
      }
      render();
    }).catch(function () {
      if (!flow.place || flow.place.at !== at) return;
      flow.place = null;
      flow.error = t('placeFailed');
      render();
    });
  }

  function search(q) {
    var status = document.getElementById('search-status');
    status.textContent = t('searching');
    // GSI's address search, from the browser: the words go to GSI, nowhere else.
    fetch('https://msearch.gsi.go.jp/address-search/AddressSearch?q=' + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (hits) {
      var hit = (hits || []).filter(function (h) { var a = h.geometry && h.geometry.coordinates; return a && a[0] > 135.1 && a[0] < 135.5 && a[1] > 34.6 && a[1] < 34.95; })[0];
      if (!hit) { status.textContent = t('noHit'); return; }
      status.textContent = '';
      var at = hit.geometry.coordinates;
      if (map) map.flyTo({ center: at, zoom: 15 });
      pickPlace([at[0], at[1]]);
    }).catch(function () { status.textContent = t('placeFailed'); });
  }

  // --- the catalogue -----------------------------------------------------------
  function loadCatalog(code) {
    flow.catalog = null;
    flow.catalogFor = code;
    fetch('/api/catalog?city=' + code).then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); }).then(function (j) {
      if (flow.catalogFor !== code) return;
      flow.catalog = j.items;
      document.getElementById('dev-catalog').textContent = 'GET /ngsi-ld/v1' + j.query + '\n\n→ ' + j.items.length + ' CatalogItem entities\n\n' + JSON.stringify(j.items[0] || null, null, 2);
      render();
    }).catch(function () { if (flow.catalogFor === code) { flow.catalog = false; render(); } });
  }

  function addItem(item) {
    var line = flow.lines.filter(function (l) { return l.item.id === item.id; })[0];
    if (line) line.qty = Math.min(10, line.qty + 1);
    else flow.lines.push({ item: item, qty: 1 });
    render();
  }

  // --- rendering -------------------------------------------------------------
  function render() {
    document.querySelectorAll('.steps li').forEach(function (li) {
      var n = Number(li.dataset.step);
      li.classList.toggle('current', n === flow.step);
      li.classList.toggle('done', n < flow.step);
      if (n === flow.step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    document.getElementById('flow-title').textContent = t('t' + flow.step);
    document.getElementById('map-wrap').hidden = flow.step !== 1;
    if (flow.step === 1 && map) setTimeout(function () { map.resize(); }, 0);
    var before = document.getElementById('flow-before');
    var body = document.getElementById('flow-body');
    // The step is drawn anew (for example when /api/config arrives): keep the
    // focus and the cursor in the search box for someone who is typing.
    var typing = document.activeElement && document.activeElement.id === 'q' ? document.activeElement : null;
    var caret = typing ? [typing.selectionStart, typing.selectionEnd] : null;
    before.replaceChildren();
    var parts = [stepPlace, stepItems, stepDay, stepCheck, stepResult][flow.step - 1]();
    if (flow.step === 1) { before.append.apply(before, parts[0]); body.replaceChildren.apply(body, parts[1]); }
    else body.replaceChildren.apply(body, parts);
    if (flow.error) body.append(el('p', { class: 'field-error', role: 'alert' }, [flow.error]));
    var q = typing && document.getElementById('q');
    if (q) { q.focus(); q.setSelectionRange(caret[0], caret[1]); }
  }

  function actions(back, nextLabel, nextFn, nextOk) {
    return el('div', { class: 'actions' }, [
      back ? btn(t('back'), function () { flow.error = ''; flow.step -= 1; render(); }, 'ghost') : null,
      nextFn ? el('button', { type: 'button', class: 'btn', disabled: !nextOk, onclick: nextFn }, [nextLabel]) : null,
    ]);
  }

  function stepPlace() {
    var input = el('input', { type: 'search', id: 'q', value: flow.query, autocomplete: 'off', 'aria-label': t('search'), placeholder: t('search'), oninput: function (e) { flow.query = e.target.value; } });
    var form = el('form', { class: 'search', onsubmit: function (e) { e.preventDefault(); if (input.value.trim()) search(input.value.trim()); } }, [input, el('button', { type: 'submit', class: 'btn ghost' }, [t('searchBtn')])]);
    var top = [el('p', { class: 'muted' }, [t('placeHint')]), form, el('p', { class: 'status', id: 'search-status', role: 'status' })];
    var c = city(), a = area();
    var info = [];
    if (flow.place && flow.place.loading) info.push(el('p', { class: 'muted' }, ['…']));
    else if (c && a) {
      var dl = el('dl');
      dl.append(el('dt', {}, [t('s1')]), el('dd', {}, [t('placeIs', { city: L(c.name), town: flow.place.town || '' })]));
      dl.append(el('dt', {}, [t('area')]), el('dd', {}, [L(a.name)]));
      info.push(dl);
    }
    info.push(actions(false, t('next'), function () { flow.step = 2; render(); }, !!(c && a)));
    return [top, info];
  }

  function stepItems() {
    var c = city();
    var out = [];
    if (flow.catalog === null) return [el('p', { class: 'muted' }, [t('catalogLoading')]), actions(true)];
    if (flow.catalog === false) return [el('p', { class: 'field-error' }, [t('catalogFailed')]), btn(t('retry'), function () { loadCatalog(flow.place.city); render(); }, 'ghost'), actions(true)];
    var cats = ['furniture', 'bedding', 'appliance', 'bicycle', 'sports', 'other'];
    var filter = el('input', { type: 'search', value: flow.filter, 'aria-label': t('filter'), placeholder: t('filter'), oninput: function (e) { flow.filter = e.target.value; renderList(); } });
    var chips = el('div', { class: 'cats' }, [''].concat(cats).map(function (k) {
      return el('button', { type: 'button', class: 'chip', 'aria-pressed': flow.category === k ? 'true' : 'false', onclick: function () { flow.category = k; render(); } }, [k ? t('c_' + k) : t('all')]);
    }));
    var list = el('ul', { class: 'catalog' });
    function renderList() {
      var q = flow.filter.trim().toLowerCase();
      var shown = flow.catalog.filter(function (i) {
        return (!flow.category || i.category === flow.category) && (!q || i.name.ja.toLowerCase().indexOf(q) >= 0 || i.name.en.toLowerCase().indexOf(q) >= 0);
      }).slice(0, 60);
      list.replaceChildren.apply(list, shown.map(function (i) {
        return el('li', { class: i.collected ? '' : 'not-collected' }, [
          el('span', { class: 'name' }, [L(i.name), lang === 'en' ? el('small', { lang: 'ja' }, [' ' + i.name.ja]) : null]),
          el('span', { class: 'meta' }, [i.collected ? (i.fee === null ? t('feeUnknown') : yen(i.fee)) : t('notCollected'), i.twoPerson ? ' · ' + t('twoPerson') : '']),
          btn(t('add'), function () { addItem(i); }, 'ghost small'),
        ]);
      }));
    }
    renderList();
    out.push(el('div', { class: 'catalog-tools' }, [filter, chips]), list);
    // The booking so far.
    var lines = el('ul', { class: 'lines' }, flow.lines.map(function (l, n) {
      var qty = el('input', { type: 'number', min: '1', max: '10', value: String(l.qty), 'aria-label': t('qty'), onchange: function (e) { var v = Math.max(1, Math.min(10, Math.round(Number(e.target.value) || 1))); l.qty = v; render(); } });
      return el('li', { class: l.item.collected ? '' : 'not-collected' }, [
        el('span', { class: 'name' }, [L(l.item.name)]), qty,
        el('span', { class: 'meta' }, [l.item.collected ? (l.item.fee === null ? t('feeUnknown') : yen(l.item.fee * l.qty)) : t('notCollected')]),
        btn(t('remove'), function () { flow.lines.splice(n, 1); render(); }, 'ghost small'),
      ]);
    }));
    var fee = flow.lines.reduce(function (s, l) { return s + (l.item.collected && l.item.fee ? l.item.fee * l.qty : 0); }, 0);
    // A collected item without a published fee: the sum is only part of the fee.
    var feeOpen = flow.lines.some(function (l) { return l.item.collected && l.item.fee === null; });
    out.push(el('h3', {}, [t('yourItems')]), flow.lines.length ? lines : el('p', { class: 'muted' }, [t('none')]));
    if (flow.lines.length) {
      var kinds = flow.lines.length;
      out.push(el('p', {}, [el('strong', {}, [t('total') + ': ' + yen(fee) + (feeOpen ? ' + ' + t('feeUnknown') : '')]), ' · ', c.maxItemKinds ? t('kindsMax', { n: kinds, max: c.maxItemKinds }) : t('kinds', { n: kinds })]));
      if (c.maxItemKinds && kinds > c.maxItemKinds) out.push(el('p', { class: 'note' }, [t('overMax')]));
    }
    out.push(actions(true, t('next'), function () { flow.step = 3; render(); }, flow.lines.length > 0));
    return out;
  }

  function stepDay() {
    var a = area();
    var days = a ? a.days : [];
    if (!flow.wishedDay || days.indexOf(flow.wishedDay) < 0) flow.wishedDay = days[0] || '';
    var needs = el('fieldset', { class: 'field' }, [el('legend', {}, [t('needQ')])].concat(['fixed', 'preferred', 'any'].map(function (k) {
      return el('label', { class: 'choice' }, [el('input', { type: 'radio', name: 'need', value: k, checked: flow.dateNeed === k, onchange: function () { flow.dateNeed = k; render(); } }), ' ' + t('n_' + k)]);
    })));
    var out = [needs];
    if (!days.length) out.push(el('p', { class: 'field-error' }, [t('noDays')]));
    else if (flow.dateNeed !== 'any') {
      var sel = el('select', { id: 'day', onchange: function (e) { flow.wishedDay = e.target.value; } }, days.map(function (d) { return el('option', { value: d, selected: d === flow.wishedDay }, [dayLabel(d)]); }));
      out.push(el('div', { class: 'field' }, [el('label', { for: 'day' }, [t('dayQ')]), sel]));
    }
    var c = city();
    if (!c.carryOutService) flow.carryOut = false;
    out.push(c.carryOutService ? el('div', { class: 'field' }, [
      el('label', { class: 'choice' }, [el('input', { type: 'checkbox', checked: flow.carryOut, onchange: function (e) { flow.carryOut = e.target.checked; } }), ' ' + t('carryQ')]),
      el('p', { class: 'muted small' }, [t('carryHint', { city: L(c.name), service: L(c.carryOutService) })]),
    ]) : el('p', { class: 'muted small' }, [t('noCarry', { city: L(c.name) })]));
    out.push(actions(true, t('next'), function () { flow.step = 4; render(); }, days.length > 0));
    return out;
  }

  function stepCheck() {
    var c = city(), a = area();
    var dl = el('dl');
    function row(k, v) { dl.append(el('dt', {}, [k]), el('dd', {}, [v])); }
    row(t('s1'), t('placeIs', { city: L(c.name), town: flow.place.town || '' }) + ' (' + L(a.name) + ')');
    row(t('s2'), flow.lines.map(function (l) { return L(l.item.name) + (l.qty > 1 ? ' × ' + l.qty : ''); }).join(', '));
    row(t('s3'), (flow.dateNeed === 'any' ? t('n_any') : dayLabel(flow.wishedDay) + ' · ' + t('n_' + flow.dateNeed)) + (flow.carryOut ? ' · ' + t('carryQ') : ''));
    var out = [dl, el('p', { class: 'note' }, [t('sendNote')])];
    if (config && !config.bookings) out.push(el('p', { class: 'note' }, [t('closed')]));
    out.push(actions(true, flow.sending ? t('sending') : t('send'), send, !!(config && config.bookings) && !flow.sending));
    return out;
  }

  function send() {
    flow.sending = true;
    flow.error = '';
    render();
    var body = {
      location: flow.place.at.map(function (n) { return Math.round(n * 1e5) / 1e5; }),
      items: flow.lines.map(function (l) { return { id: l.item.id, qty: l.qty }; }),
      dateNeed: flow.dateNeed, wishedDay: flow.dateNeed === 'any' ? null : flow.wishedDay, carryOut: flow.carryOut, lang: lang,
    };
    fetch('/api/requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; });
    }).then(function (res) {
      flow.sending = false;
      if (res.status !== 201) { flow.error = res.status === 429 ? t('e_busy') : (res.body.error ? t('e_other') + ' (' + res.body.error + ')' : t('e_other')); render(); return; }
      flow.id = res.body.id;
      flow.step = 5;
      flow.polls = 0;
      flow.result = null;
      try { history.replaceState(null, '', '#' + encodeURIComponent(flow.id)); } catch (e) {}
      render();
      poll();
    }).catch(function () { flow.sending = false; flow.error = t('e_other'); render(); });
  }

  function poll() {
    if (!flow.id) return;
    var id = flow.id;
    fetch('/api/requests/' + encodeURIComponent(id)).then(function (r) {
      if (r.status === 404) return { lost: true };
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    }).then(function (j) {
      if (flow.id !== id) return;
      flow.polls += 1;
      flow.result = j;
      // A linked booking: the city's catalogue, for the names and the advice.
      var code = j.entity && j.entity.municipality && j.entity.municipality.value;
      if (code && flow.catalogFor !== code) loadCatalog(code);
      showDev(j);
      render();
      var done = j.lost || (j.entity && j.entity.intake && (j.entity.slot || finalOf(j.entity.intake) !== 'plan'));
      if (!done && flow.polls < MAX_POLLS) setTimeout(poll, flow.polls < 10 ? 1500 : 4000);
    }).catch(function () {
      if (flow.id !== id) return;
      flow.polls += 1;
      render();
      if (flow.polls < MAX_POLLS) setTimeout(poll, 4000);
    });
  }

  /** Polls before the page stops asking; then it offers to look again. */
  var MAX_POLLS = 40;
  function gaveUp() {
    return flow.polls >= MAX_POLLS ? [el('p', {}, [t('gaveUp')]), btn(t('lookAgain'), function () { flow.polls = 0; render(); poll(); }, 'ghost')] : [];
  }

  function showDev(j) {
    document.getElementById('dev-request').textContent = j.entity ? 'GET /ngsi-ld/v1' + j.query + '\n\n' + JSON.stringify(j.entity, null, 2) : '';
    document.getElementById('dev-intake').textContent = j.intakeDecision ? JSON.stringify(j.intakeDecision, null, 2) : '';
    document.getElementById('dev-slot').textContent = j.slotDecision ? JSON.stringify(j.slotDecision, null, 2) : '';
  }

  function verdict(prefix, action) { return el('p', { class: 'verdict v-' + action }, [t(prefix + action)]); }
  /** The rule that decided, as a sentence (profiles/*.yaml, in the same order), with the route minutes. */
  function ruleOf(result, prefix, costs) {
    var r = result && result.policyRule && result.policyRule.value;
    if (r === undefined || r === null) return '';
    var key = prefix + (r === 'default' ? 'd' : r);
    var text = t(key, costs ? { wished: costs.wishedExtraMin, best: costs.bestExtraMin } : {});
    return text === key ? String(r) : text;
  }
  function finalOf(result) { return result && result.finalAction && result.finalAction.value ? result.finalAction.value : result && result.value; }

  function stepResult() {
    var j = flow.result;
    var again = el('div', { class: 'actions' }, [btn(t('again'), function () {
      flow.step = 1; flow.id = null; flow.result = null; flow.lines = []; flow.error = '';
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
      render();
    }, 'ghost')]);
    if (!j) return [el('p', { class: 'muted' }, [el('span', { class: 'spinner' }), ' ', t(flow.polls > 15 ? 'slow' : 'waiting')])].concat(gaveUp());
    if (j.lost) return [el('p', {}, [t('e_lost')]), again];
    var e = j.entity;
    var out = [];
    // Step 1: the intake.
    out.push(el('h3', {}, [t('checkStep')]));
    if (!e.intake) {
      out.push(el('p', { class: 'muted' }, [el('span', { class: 'spinner' }), ' ', t(flow.polls > 15 ? 'slow' : 'waiting')]));
      return out.concat(gaveUp(), [again]);
    }
    var ia = finalOf(e.intake);
    out.push(verdict('ia_', ia), el('p', { class: 'muted small' }, [t('why') + ': ' + ruleOf(e.intake, 'ri')]));
    var lines = (e.items && e.items.value) || [];
    if (ia === 'redirect') {
      var byId = {};
      (flow.catalog || []).forEach(function (i) { byId[i.id] = i; });
      out.push(el('p', {}, [t('in_redirect')]), el('ul', {}, lines.filter(function (l) { return !l.collected; }).map(function (l) {
        var item = byId[l.item];
        return el('li', {}, [el('strong', {}, [item ? L(item.name) : l.name]), item && item.advice ? ' — ' + L(item.advice) + ' ' : '',
          item ? el('a', { href: item.source, rel: 'noopener', target: '_blank' }, [t('cityPage')]) : null]);
      })));
    } else if (ia === 'ask') {
      out.push(el('p', {}, [e.itemKinds && e.itemKinds.value < 1 ? t('in_ask_none') : t('in_ask_over', { max: e.maxItemKinds ? e.maxItemKinds.value : '' })]));
    }
    if ((ia === 'redirect' || ia === 'ask') && flow.place && flow.lines.length) {
      // Back to the items, as they were: take out what the city does not collect, or split the booking.
      out.push(el('div', { class: 'actions' }, [btn(t('change'), function () {
        flow.step = 2; flow.id = null; flow.result = null; flow.error = '';
        try { history.replaceState(null, '', location.pathname); } catch (err) {}
        render();
      })]));
    }
    if (ia === 'review') out.push(el('p', {}, [t('in_review')]));
    // Step 2: the day.
    if (ia === 'plan') {
      out.push(el('h3', {}, [t('dayStep')]));
      if (!e.slot) out.push.apply(out, [el('p', { class: 'muted' }, [el('span', { class: 'spinner' }), ' ', t(flow.polls > 15 ? 'slow' : 'waitingDay')])].concat(gaveUp()));
      else {
        var sa = finalOf(e.slot);
        var costs = e.slotCosts && e.slotCosts.value;
        out.push(verdict('sa_', sa), el('p', {}, [t('sn_' + sa)]), el('p', { class: 'muted small' }, [t('why') + ': ' + ruleOf(e.slot, 'rs', costs)]));
        if (j.day) out.push(el('p', { class: 'chosen' }, [el('strong', {}, [t('chosen', { day: dayLabel(j.day) })])]), el('p', { class: 'muted' }, [t('putOut', { time: putOutOf(e) })]));
        else if (sa === 'offer_days' && costs) {
          out.push(el('div', { class: 'actions' }, costs.offers.map(function (d) {
            return btn(dayLabel(d), function () { choose(d); });
          })));
        }
        if (costs) out.push(costTable(costs, j.day));
      }
    }
    out.push(again);
    return out;
  }

  /** The put-out time of the booking's city (from the config: also for a linked booking). */
  function putOutOf(e) {
    var code = e.municipality && e.municipality.value;
    var c = config && config.cities.filter(function (x) { return x.code === code; })[0];
    return c ? c.putOutBy : '8:00';
  }

  function costTable(costs, chosen) {
    var max = costs.days.reduce(function (m, d) { return Math.max(m, d.extraMin); }, 1);
    return el('details', { class: 'costs' }, [el('summary', {}, [t('costsTitle')]), el('ul', {}, costs.days.map(function (d) {
      var mark = d.date === chosen ? ' ✓' : d.date === costs.wishedDay ? ' (' + t('wished') + ')' : '';
      return el('li', { class: d.feasible ? '' : 'full' }, [
        el('span', { class: 'day' }, [dayLabel(d.date) + mark]),
        el('span', { class: 'bar', style: 'width:' + Math.round(100 * d.extraMin / max) + '%' }),
        el('span', { class: 'meta' }, [d.feasible ? t('extra', { n: d.extraMin }) : t('full')]),
      ]);
    }))]);
  }

  function choose(day) {
    fetch('/api/requests/' + encodeURIComponent(flow.id) + '/day', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ day: day }) }).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      flow.error = '';
      flow.polls = 0;
      poll();
    }).catch(function () { flow.error = t('chooseFailed'); render(); });
  }

  // --- start -------------------------------------------------------------------
  document.getElementById('lang').addEventListener('click', function () {
    lang = lang === 'ja' ? 'en' : 'ja';
    try { localStorage.setItem('lang', lang); } catch (e) {}
    applyLang();
  });
  document.getElementById('theme').addEventListener('click', function () {
    var next = theme() === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    if (map) map.setStyle(style());
  });
  var devButton = document.getElementById('dev-toggle');
  function setDev(on) {
    document.getElementById('dev').hidden = !on;
    document.querySelector('.layout').classList.toggle('with-dev', on);
    devButton.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (map) setTimeout(function () { map.resize(); }, 0);
  }
  devButton.addEventListener('click', function () {
    var on = devButton.getAttribute('aria-pressed') !== 'true';
    try { localStorage.setItem('dev', on ? '1' : '0'); } catch (e) {}
    setDev(on);
  });
  try { setDev(localStorage.getItem('dev') === '1'); } catch (e) {}

  applyLang();
  fetch('/api/config').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (c) {
    config = c;
    map = makeMap();
    // A link to a booking (#urn:…): show its result.
    var linked = (function () { try { return decodeURIComponent(location.hash.slice(1)); } catch (e) { return ''; } })();
    if (/^urn:ngsi-ld:ServiceRequest:demo-[0-9a-f-]{36}$/.test(linked)) { flow.id = linked; flow.step = 5; poll(); }
    render();
  });
})();
