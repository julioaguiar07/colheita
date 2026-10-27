import { CONFIG } from './config.js';
import * as S from './store.js?v=4';
import { hoje, addDias, fmtDia, fmtMes, fmtN, periodo, ranking, porDia, entre, listaDias, avatar, esc, primeiroNome, semAcento, parseIso, toast, nro, rotulo, busca, combina, exato, fmtR$, valores, diasSemPreco, fmtPreco, listaCurta } from './util.js?v=4';
import { grafico, eixo, grad, C, SERIE } from './charts.js?v=4';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const st = {
  modo: ['dia', '7', '30', 'mes'].includes(params.get('modo')) ? params.get('modo') : 'dia',
  dia: params.get('dia') || null,
  mes: params.get('mes') || hoje().slice(0, 7),
  pessoas: [], rk: [], dados: [], per: null,
  aba: params.get('aba') === 'ranking' ? 'ranking' : 'numeros', safra: [], pesDia: [], fNum: '', precos: {},
};

$('#fazenda').textContent = CONFIG.FAZENDA;
if (S.DEMO) $('#demo').innerHTML = '<p class="aviso-demo">Modo demonstração: nomes e pesos de exemplo.</p>';

function syncUrl() {
  const p = new URLSearchParams({ aba: st.aba, modo: st.modo });
  if (st.modo === 'mes') p.set('mes', st.mes); else p.set('dia', st.dia);
  history.replaceState(null, '', '?' + p);
}

function setModo(m) {
  st.modo = m;
  document.querySelectorAll('#modos button').forEach(b => b.setAttribute('aria-pressed', b.dataset.modo === m));
  $('#pickDia').hidden = m === 'mes'; $('#pickMes').hidden = m !== 'mes';
  carregar();
}
document.querySelectorAll('#modos button').forEach(b => b.onclick = () => setModo(b.dataset.modo));

function setAba(a) {
  st.aba = a;
  document.querySelectorAll('#abas button').forEach(b => b.setAttribute('aria-pressed', b.dataset.aba === a));
  $('#vNumeros').hidden = a !== 'numeros'; $('#vRanking').hidden = a !== 'ranking';
  syncUrl();
  if (st.per) render();
}
document.querySelectorAll('#abas button').forEach(b => b.onclick = () => setAba(b.dataset.aba));
$('#fNum').oninput = e => { st.fNum = e.target.value; renderNumeros(); };
$('#fNum').onkeydown = e => { if (e.key === 'Enter') { const b = $('#nLista [data-id]'); if (b) abrirPerfil(b.dataset.id); } };

function mover(dir) {
  if (st.modo === 'mes') {
    const d = parseIso(st.mes + '-01'); d.setMonth(d.getMonth() + dir);
    st.mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } else {
    const passo = st.modo === 'dia' ? 1 : +st.modo;
    st.dia = addDias(st.dia, dir * passo);
    if (st.dia > hoje()) st.dia = hoje();
  }
  carregar();
}
$('#ant').onclick = () => mover(-1);
$('#prox').onclick = () => mover(1);
$('#pickDia').onchange = e => { if (e.target.value) { st.dia = e.target.value; carregar(); } };
$('#pickMes').onchange = e => { if (e.target.value) { st.mes = e.target.value; carregar(); } };

function textoQuando(per) {
  if (st.modo === 'mes') return fmtMes(st.mes);
  if (st.modo === 'dia') return fmtDia(st.dia);
  return `${fmtDia(per.inicio, 'eixo')} – ${fmtDia(per.fim, 'eixo')}`;
}

async function carregar(silencioso = false) {
  const per = periodo(st.modo, st.modo === 'mes' ? st.mes : st.dia);
  st.per = per;
  $('#quandoTxt').textContent = textoQuando(per);
  $('#pickDia').value = st.dia; $('#pickMes').value = st.mes;
  $('#prox').disabled = st.modo === 'mes' ? st.mes >= hoje().slice(0, 7) : st.dia >= hoje();
  syncUrl();
  try {
    const [pessoas, dados, safra, pesDia, precos] = await Promise.all([
      S.listarPessoas(), S.totais(per.anterior.inicio, per.fim),
      S.totais(CONFIG.INICIO_SAFRA, hoje()),
      st.modo === 'dia' ? S.pesagensDoDia(st.dia) : Promise.resolve([]),
      S.precosDias().catch(() => ({})),
    ]);
    st.pessoas = pessoas; st.dados = dados; st.safra = safra; st.pesDia = pesDia; st.precos = precos;
    render(silencioso);
    $('#atualizado').textContent = 'atualizado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    console.error(e); toast('Não foi possível carregar os dados. Verifique a internet.', 'erro');
  }
}

function render() {
  const { per, dados, pessoas } = st;
  const atual = dados.filter(t => entre(t, per));
  const ant = dados.filter(t => entre(t, per.anterior));
  const rk = ranking(atual, pessoas); st.rk = rk;
  const posAnt = new Map(ranking(ant, pessoas).map(r => [r.pessoa.id, r.pos]));
  const total = rk.reduce((s, r) => s + r.kg, 0), nPes = rk.reduce((s, r) => s + r.n, 0);

  $('#resumo').innerHTML = rk.length
    ? `<span><b>${fmtN(total)}</b>kg colhidos</span><span><b>${rk.length}</b>${rk.length === 1 ? 'pessoa' : 'pessoas'}</span><span><b>${nPes}</b>pesagens</span>`
    : '';

  // Pódio
  const max = rk[0]?.kg || 1;
  const slot = (r, p) => {
    if (!r) return `<div class="degrau p${p} vazio-slot"><div class="bloco" style="--h:40px"></div></div>`;
    const h = Math.round(56 + 96 * (r.kg / max) * (p === 1 ? 1 : 0.92));
    return `<button class="degrau p${p}" data-id="${r.pessoa.id}" aria-label="${p}º lugar: ${esc(r.pessoa.nome)}, ${fmtN(r.kg)} quilos">
      ${p === 1 ? '<span class="coroa" aria-hidden="true">🏆</span>' : ''}
      <span class="anel" data-pos="${p}">${avatar(r.pessoa)}</span>
      <span class="nome">${nro(r.pessoa)}${esc(primeiroNome(r.pessoa.nome))}</span>
      <span class="kg">${fmtN(r.kg)}<small>kg</small></span>
      <span class="bloco" style="--h:${h}px" aria-hidden="true">${p}</span>
    </button>`;
  };
  $('#podio').innerHTML = rk.length
    ? slot(rk[1], 2) + slot(rk[0], 1) + slot(rk[2], 3)
    : `<div class="vazio" style="grid-column:1/-1"><b>Ninguém pesou ${st.modo === 'dia' ? 'neste dia' : 'neste período'}</b>Use as setas ou toque na data para ver outro ${st.modo === 'mes' ? 'mês' : 'dia'}.</div>`;

  // Lista (4º em diante)
  const mostraDelta = st.modo !== 'dia';
  $('#lista').innerHTML = rk.slice(3).map(r => {
    let d = '';
    if (mostraDelta) {
      const a = posAnt.get(r.pessoa.id);
      d = a == null ? '<span class="delta novo">novo</span>'
        : a > r.pos ? `<span class="delta sobe">▲ ${a - r.pos}</span>`
          : a < r.pos ? `<span class="delta desce">▼ ${r.pos - a}</span>` : '<span class="delta igual">–</span>';
    }
    const sub = st.modo === 'dia' ? `${r.n} ${r.n === 1 ? 'pesagem' : 'pesagens'}` : `${r.dias} ${r.dias === 1 ? 'dia' : 'dias'} · ${r.n} pesagens`;
    return `<li><button data-id="${r.pessoa.id}">
      <span class="pos">${r.pos}</span>${avatar(r.pessoa)}
      <span class="quem"><b>${nro(r.pessoa)}${esc(r.pessoa.nome)}</b><small>${sub}</small><span class="barra"><i style="--w:${(r.kg / max * 100).toFixed(1)}%"></i></span></span>
      <span class="val"><b>${fmtN(r.kg)} <small>kg</small></b>${d}</span>
    </button></li>`;
  }).join('');
  document.querySelectorAll('[data-id]').forEach(b => b.onclick = () => abrirPerfil(b.dataset.id));

  if (st.aba === 'ranking') graficos(rk, atual);
  renderNumeros();
}

/* ---------------- Aba "Por número": todos em ordem de número ---------------- */
function renderNumeros() {
  const atual = st.dados.filter(t => entre(t, st.per));
  const per = new Map(), safra = new Map(), pes = new Map();
  for (const t of atual) { const a = per.get(t.pessoa_id) || { kg: 0, n: 0, dias: 0 }; a.kg += +t.kg; a.n += +t.n; a.dias++; per.set(t.pessoa_id, a); }
  for (const t of st.safra) safra.set(t.pessoa_id, (safra.get(t.pessoa_id) || 0) + +t.kg);
  for (const p of st.pesDia) { if (!pes.has(p.pessoa_id)) pes.set(p.pessoa_id, []); pes.get(p.pessoa_id).push(+p.kg); }

  const vPer = valores(atual, st.precos), vSaf = valores(st.safra, st.precos);
  const semPer = diasSemPreco(atual, st.precos), comPreco = Object.keys(st.precos).length > 0;
  const rs = v => (comPreco ? `<small class="rs">${v ? fmtR$(v) : 'R$ –'}</small>` : '');
  $('#nInfo').innerHTML = st.modo === 'dia'
    ? (st.precos[st.dia] != null ? `Preço do kg neste dia: <b>${fmtPreco(st.precos[st.dia])}</b>` : atual.length ? 'O preço do kg deste dia ainda não foi definido.' : '')
    : (semPer.length ? `Preço do kg ainda não definido para ${listaCurta(semPer)}. O valor em reais conta só os dias com preço.` : atual.length && comPreco ? 'Valor em reais pelo preço do kg de cada dia.' : '');
  const rotPer = st.modo === 'dia' ? 'No dia' : st.modo === 'mes' ? 'No mês' : `Em ${st.modo} dias`;
  $('#nCab').innerHTML = `<span>Nº</span><span>Nome</span><span>${rotPer}</span><span>Na safra</span>`;

  const b = busca(st.fNum);
  const ps = st.pessoas.filter(p => (p.ativo || per.has(p.id) || safra.has(p.id)) && combina(p, b))
    .sort((x, y) => exato(y, b) - exato(x, b) || (x.numero ?? 1e9) - (y.numero ?? 1e9) || x.nome.localeCompare(y.nome));

  $('#nLista').innerHTML = ps.map(p => {
    const a = per.get(p.id), s = safra.get(p.id) || 0;
    let sub;
    if (st.modo === 'dia') sub = pes.has(p.id) ? pes.get(p.id).map(fmtN).join(' + ') : 'não pesou neste dia';
    else sub = a ? `${a.dias} ${a.dias === 1 ? 'dia' : 'dias'} · ${a.n} ${a.n === 1 ? 'pesagem' : 'pesagens'}` : 'sem pesagem no período';
    return `<li><button data-id="${p.id}" aria-label="Número ${p.numero ?? 'sem número'}, ${esc(p.nome)}: ${fmtN(a?.kg || 0)} quilos ${rotPer.toLowerCase()}, ${fmtN(s)} na safra">
      <span class="nbig${p.numero == null ? ' sem' : ''}">${p.numero ?? '–'}</span>
      <span class="quem"><b>${esc(p.nome)}</b><small class="num">${esc(sub)}</small></span>
      <span class="cper${a ? '' : ' zero'}"><b>${fmtN(a?.kg || 0)}</b><small>kg</small>${rs(vPer.get(p.id)?.valor)}</span>
      <span class="csaf"><b>${fmtN(s)}</b><small>kg</small>${rs(vSaf.get(p.id)?.valor)}</span>
    </button></li>`;
  }).join('') || `<li class="vazio">${b.num != null ? `Ninguém com o número ${esc(b.num)}.` : 'Ninguém com esse nome.'}</li>`;
  $('#nLista').querySelectorAll('[data-id]').forEach(el => el.onclick = () => abrirPerfil(el.dataset.id));

  const totPer = atual.reduce((x, t) => x + +t.kg, 0), totSaf = st.safra.reduce((x, t) => x + +t.kg, 0);
  $('#nTot').innerHTML = `<span></span><span>Todos (${st.pessoas.filter(p => p.ativo || per.has(p.id)).length} pessoas)</span>
    <span class="cper"><b>${fmtN(totPer)}</b><small>kg</small>${rs([...vPer.values()].reduce((x, v) => x + v.valor, 0))}</span><span class="csaf"><b>${fmtN(totSaf)}</b><small>kg</small>${rs([...vSaf.values()].reduce((x, v) => x + v.valor, 0))}</span>`;
}

function graficos(rk, atual) {
  if (!window.echarts) { setTimeout(() => graficos(rk, atual), 150); return; }
  const top = rk.slice(0, 15);
  const elB = $('#gBarras');
  elB.style.height = Math.max(200, top.length * 34 + 40) + 'px';
  $('#subBarras').textContent = rk.length > 15 ? 'Os 15 primeiros, em quilos' : 'Quilos de castanha no período';
  grafico(elB, {
    grid: { left: 8, right: 56, top: 6, bottom: 6, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'none' }, valueFormatter: v => fmtN(v) + ' kg' },
    xAxis: { type: 'value', show: false },
    yAxis: { type: 'category', inverse: true, data: top.map(r => rotulo(r.pessoa)), ...eixo({ axisLine: { show: false }, axisLabel: { color: C.text, fontSize: 12.5 } }) },
    series: [{
      type: 'bar', barWidth: 16, data: top.map((r, i) => ({ value: r.kg, itemStyle: { color: i === 0 ? grad('#FF6A3D', '#F6B940', true) : grad('#5A3A2A', '#B4532A', true), borderRadius: [0, 8, 8, 0] } })),
      label: { show: true, position: 'right', color: C.text, fontFamily: 'IBM Plex Mono', fontSize: 12, formatter: p => fmtN(p.value) },
      showBackground: true, backgroundStyle: { color: 'rgba(255,255,255,.03)', borderRadius: [0, 8, 8, 0] },
    }],
  });

  const periodoLongo = st.modo !== 'dia';
  $('#cardLinha').hidden = !periodoLongo || !rk.length;
  $('#cardFazenda').hidden = !periodoLongo;
  if (!periodoLongo) return;
  const dias = listaDias(st.per.inicio, st.per.fim > hoje() ? hoje() : st.per.fim);
  const t5 = rk.slice(0, 5);
  grafico($('#gLinha'), {
    color: SERIE,
    grid: { left: 8, right: 12, top: 40, bottom: 4, containLabel: true },
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: C.muted, fontSize: 12 } },
    tooltip: { trigger: 'axis', valueFormatter: v => (v == null ? '—' : fmtN(v) + ' kg') },
    xAxis: { type: 'category', data: dias.map(d => fmtDia(d, 'curto')), boundaryGap: false, ...eixo({ splitLine: { show: false } }) },
    yAxis: { type: 'value', ...eixo({ axisLine: { show: false } }) },
    series: t5.map((r, i) => ({
      name: rotulo(r.pessoa), type: 'line', smooth: .35, symbol: 'circle', symbolSize: 6, connectNulls: false,
      lineStyle: { width: i === 0 ? 3 : 2 }, data: dias.map(d => r.porDia[d] ?? null),
    })),
  });
  const pd = porDia(atual);
  grafico($('#gFazenda'), {
    grid: { left: 8, right: 12, top: 12, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: v => fmtN(v) + ' kg' },
    xAxis: { type: 'category', data: dias.map(d => fmtDia(d, 'curto')), ...eixo({ splitLine: { show: false } }) },
    yAxis: { type: 'value', ...eixo({ axisLine: { show: false } }) },
    series: [{ name: 'Fazenda', type: 'bar', barMaxWidth: 22, data: dias.map(d => pd[d]?.kg || 0), itemStyle: { color: grad('#3A2A20', '#C9A27A'), borderRadius: [6, 6, 0, 0] } }],
  });
}

/* ---------------- Sheet: busca e perfil ---------------- */
const sheet = $('#sheet'), fundo = $('#fundo');
let ultimoFoco = null;
function abrirSheet(html) {
  ultimoFoco = document.activeElement;
  sheet.innerHTML = '<div class="alca"></div>' + html;
  sheet.hidden = fundo.hidden = false;
  requestAnimationFrame(() => { sheet.classList.add('on'); fundo.classList.add('on'); });
}
function fecharSheet() {
  sheet.classList.remove('on'); fundo.classList.remove('on');
  setTimeout(() => { sheet.hidden = fundo.hidden = true; sheet.innerHTML = ''; ultimoFoco?.focus?.(); }, 280);
}
fundo.onclick = fecharSheet;
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) fecharSheet(); });

$('#btnBusca').onclick = () => {
  abrirSheet(`<div class="perfil-cab"><h2 id="sheetTitulo">Ver uma pessoa</h2><button class="btn icone fechar" aria-label="Fechar">✕</button></div>
    <input class="campo" id="q" placeholder="Digite o número ou o nome" aria-label="Procurar por número ou nome" autocomplete="off" style="margin-top:14px">
    <ul class="busca-lista" id="qres"></ul>`);
  sheet.querySelector('.fechar').onclick = fecharSheet;
  const q = sheet.querySelector('#q'), res = sheet.querySelector('#qres');
  const pos = new Map(st.rk.map(r => [r.pessoa.id, r]));
  const lista = () => {
    const b = busca(q.value);
    const ps = st.pessoas.filter(p => combina(p, b)).sort((x, y) => exato(y, b) - exato(x, b) || (pos.get(x.id)?.pos ?? 999) - (pos.get(y.id)?.pos ?? 999) || (x.numero ?? 1e9) - (y.numero ?? 1e9) || x.nome.localeCompare(y.nome));
    res.innerHTML = ps.map(p => { const r = pos.get(p.id); return `<li><button data-p="${p.id}">${avatar(p)}<span style="flex:1">${nro(p)}${esc(p.nome)}</span><span class="num muted">${r ? `${r.pos}º · ${fmtN(r.kg)} kg` : ''}</span></button></li>`; }).join('')
      || `<li class="muted" style="padding:14px 4px">${b.num != null ? `Ninguém com o número ${esc(b.num)}.` : 'Ninguém com esse nome.'}</li>`;
    res.querySelectorAll('[data-p]').forEach(b => b.onclick = () => abrirPerfil(b.dataset.p));
  };
  q.oninput = lista; lista(); setTimeout(() => q.focus(), 300);
  q.onkeydown = e => { if (e.key === 'Enter') { const pr = res.querySelector('[data-p]'); if (pr) abrirPerfil(pr.dataset.p); } };
};

async function abrirPerfil(id) {
  const p = st.pessoas.find(x => x.id === id); if (!p) return;
  const r = st.rk.find(x => x.pessoa.id === id);
  const fim = hoje(), ini = addDias(fim, -29);
  const iniSafra = CONFIG.INICIO_SAFRA < ini ? CONFIG.INICIO_SAFRA : ini;
  const html = `<div class="perfil-cab">${avatar(p)}<div><h2 id="sheetTitulo">${esc(p.nome)}</h2><div class="muted" style="font-size:13px">${p.numero != null ? `Nº ${p.numero} · ` : ''}${r ? `${r.pos}º lugar · ${esc($('#quandoTxt').textContent)}` : `Sem pesagens em ${esc($('#quandoTxt').textContent.toLowerCase())}`}</div></div>
      <button class="btn icone fechar" aria-label="Fechar">✕</button></div>
    <div class="kpis" id="pk"><div class="kpi"><span>Carregando…</span><b>–</b></div></div>
    <div class="card" style="padding:14px"><h2 style="font-size:15px">Últimos 30 dias</h2><div class="sub">Quilos por dia · linha pontilhada = média da fazenda por pessoa</div><div id="gPessoa" style="height:220px;margin-top:8px"></div></div>`;
  if (sheet.hidden) abrirSheet(html); else sheet.innerHTML = '<div class="alca"></div>' + html;
  sheet.querySelector('.fechar').onclick = fecharSheet;
  try {
    const dados = await S.totais(iniSafra, fim);
    const meus = dados.filter(t => t.pessoa_id === id);
    const safra = meus.reduce((s, t) => s + +t.kg, 0);
    const pMeu = {}; for (const t of meus) pMeu[t.dia] = (pMeu[t.dia] || 0) + +t.kg;
    const melhor = Object.entries(pMeu).sort((a, b) => b[1] - a[1])[0];
    const diasTrab = Object.keys(pMeu).length;
    const rkSafra = ranking(dados, st.pessoas).find(x => x.pessoa.id === id);
    const temPreco = Object.keys(st.precos).length > 0;
    const vPer = valores(st.dados.filter(t => t.pessoa_id === id && entre(t, st.per)), st.precos).get(id);
    const vSaf = valores(meus.filter(t => t.dia >= CONFIG.INICIO_SAFRA), st.precos).get(id);
    const semP = diasSemPreco(meus.filter(t => t.dia >= CONFIG.INICIO_SAFRA), st.precos);
    sheet.querySelector('#pk').innerHTML = `
      <div class="kpi destaque"><span>No período</span><b>${fmtN(r?.kg || 0)}<small>kg</small></b></div>
      <div class="kpi"><span>Na safra toda</span><b>${fmtN(safra)}<small>kg</small></b></div>
      <div class="kpi"><span>Posição na safra</span><b>${rkSafra ? rkSafra.pos + 'º' : '–'}<small>de ${new Set(dados.map(t => t.pessoa_id)).size}</small></b></div>
      <div class="kpi"><span>Média por dia</span><b>${diasTrab ? fmtN(safra / diasTrab) : '–'}<small>kg</small></b></div>
      <div class="kpi"><span>Melhor dia</span><b>${melhor ? fmtN(melhor[1]) : '–'}<small>${melhor ? fmtDia(melhor[0], 'curto') : ''}</small></b></div>
      <div class="kpi"><span>Dias colhendo</span><b>${diasTrab}</b></div>
      ${temPreco ? `<div class="kpi dinheiro"><span>A receber no período</span><b>${fmtR$(vPer?.valor || 0)}</b></div>
      <div class="kpi dinheiro"><span>A receber na safra</span><b>${fmtR$(vSaf?.valor || 0)}</b></div>
      ${semP.length ? `<p class="kpi-nota">Sem preço definido ainda: ${listaCurta(semP)}. Esses dias não entram no valor.</p>` : ''}` : ''}`;
    const dias = listaDias(ini, fim);
    const fz = porDia(dados.filter(t => t.dia >= ini));
    grafico(sheet.querySelector('#gPessoa'), {
      grid: { left: 4, right: 8, top: 10, bottom: 4, containLabel: true },
      tooltip: { trigger: 'axis', valueFormatter: v => (v == null ? '—' : fmtN(v) + ' kg') },
      xAxis: { type: 'category', data: dias.map(d => fmtDia(d, 'curto')), ...eixo({ splitLine: { show: false } }) },
      yAxis: { type: 'value', ...eixo({ axisLine: { show: false } }) },
      series: [
        { name: primeiroNome(p.nome), type: 'bar', barMaxWidth: 14, data: dias.map(d => pMeu[d] || 0), itemStyle: { color: grad('#B4532A', '#FF8F5A'), borderRadius: [5, 5, 0, 0] } },
        { name: 'Média da fazenda', type: 'line', smooth: true, symbol: 'none', lineStyle: { color: C.sol, type: 'dashed', width: 1.5 }, data: dias.map(d => fz[d] ? +(fz[d].kg / fz[d].pessoas).toFixed(1) : null) },
      ],
    });
  } catch (e) { console.error(e); toast('Não foi possível carregar esta pessoa.', 'erro'); }
}

/* ---------------- início ---------------- */
(async () => {
  if (!st.dia) { try { st.dia = (await S.ultimoDia()) || hoje(); } catch { st.dia = hoje(); } }
  setAba(st.aba);
  setModo(st.modo);
  setInterval(() => { if (document.visibilityState === 'visible' && sheet.hidden) carregar(true); }, 60000);
})();
