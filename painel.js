import { CONFIG } from './config.js';
import * as S from './store.js?v=2';
import {
  hoje, addDias, fmtDia, fmtMes, fmtN, fmtR$, parsePesos, soma, avatar, esc, semAcento, primeiroNome, nro, rotulo, busca, combina, exato, porNumero,
  ranking, porDia, listaDias, parseIso, SEMANA, toast, iso,
} from './util.js?v=2';
import { grafico, eixo, grad, C } from './charts.js?v=2';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const st = {
  aba: 'lancar', dia: hoje(), pessoas: [], salvo: {}, txt: {}, preco: 1.4, filtro: '',
  an: { modo: '30', ini: addDias(hoje(), -29), fim: hoje() }, ordem: { col: 'kg', dir: -1 },
};
$('#fazenda').textContent = CONFIG.FAZENDA;
if (S.DEMO) $('#demo').innerHTML = '<p class="aviso-demo">Modo demonstração: dados de exemplo, salvos só neste navegador. Depois do deploy com o Supabase, tudo fica guardado na nuvem.</p>';

/* ================= abas ================= */
$$('#abas button').forEach(b => b.onclick = () => irPara(b.dataset.aba));
function irPara(aba) {
  if (st.aba === 'lancar' && aba !== 'lancar' && sujos().length && !confirm('Há pesagens não salvas neste dia. Sair mesmo assim? (Elas ficam como rascunho.)')) return;
  st.aba = aba;
  $$('#abas button').forEach(b => b.setAttribute('aria-pressed', b.dataset.aba === aba));
  $('.salvarbar')?.classList.remove('on');
  ({ lancar: telaLancar, pessoas: telaPessoas, analise: telaAnalise })[aba]();
}

$('#btnLink').onclick = async () => {
  const url = new URL('./', location.href).href;
  try { await navigator.clipboard.writeText(url); toast('Link do ranking copiado. É só colar no WhatsApp.', 'ok'); }
  catch { prompt('Copie o link do ranking:', url); }
};
$('#btnSair').onclick = async () => {
  if (S.DEMO) { if (confirm('Modo demonstração: recomeçar com os dados de exemplo?')) { S.resetDemo(); location.reload(); } return; }
  await S.sair(); location.reload();
};

/* ================= LANÇAR ================= */
const rascunhoKey = d => `colheita-rascunho-${d}`;
const pesosDe = id => parsePesos(st.txt[id] ?? '');
const igual = (a, b) => a.length === b.length && a.every((v, i) => +v === +b[i]);
const sujos = () => Object.keys(st.txt).filter(id => !igual(pesosDe(id).pesos, st.salvo[id] || []) || pesosDe(id).erros.length);

async function telaLancar() {
  $('#conteudo').innerHTML = `
    <div class="diabar">
      <button class="btn icone" id="dAnt" aria-label="Dia anterior">‹</button>
      <label class="dia-centro"><b id="diaTxt"></b><small>toque para trocar o dia</small><input type="date" class="pick" id="diaPick" aria-label="Escolher dia"></label>
      <button class="btn icone" id="dProx" aria-label="Próximo dia">›</button>
    </div>
    <div class="stats" id="statsDia"></div>
    <div class="ferramentas"><input class="campo" id="filtro" inputmode="search" placeholder="Número ou nome" autocomplete="off" value="${esc(st.filtro)}" aria-label="Procurar pessoa por número ou nome"><button class="btn" id="btnColar">Colar lista</button></div>
    <p class="dica">Digite os pesos de cada vez que a pessoa pesou, separados por vírgula ou espaço — ex.: <kbd>50, 24, 34</kbd>. <kbd>Enter</kbd> pula para a próxima pessoa. Decimal com ponto: <kbd>24.5</kbd>. Para ir direto a alguém, digite o número da folha no campo de busca e aperte <kbd>Enter</kbd>.</p>
    <div class="grade-lanc" id="grade"></div>`;
  if (!$('.salvarbar')) {
    const bar = document.createElement('div'); bar.className = 'salvarbar';
    bar.innerHTML = '<span id="sbTxt"></span><button class="btn" id="sbDesfazer">Desfazer</button><button class="btn primario" id="sbSalvar">Salvar dia</button>';
    document.body.append(bar);
    $('#sbSalvar').onclick = salvar; $('#sbDesfazer').onclick = desfazer;
  }
  $('#dAnt').onclick = () => trocarDia(addDias(st.dia, -1));
  $('#dProx').onclick = () => trocarDia(addDias(st.dia, 1));
  $('#diaPick').onchange = e => e.target.value && trocarDia(e.target.value);
  $('#filtro').oninput = e => { st.filtro = e.target.value; desenharGrade(); };
  $('#filtro').onkeydown = e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const alvo = $('.lrow.alvo .pesos') || $('.lrow .pesos');
    if (alvo) { alvo.focus(); alvo.select(); }
  };
  $('#btnColar').onclick = abrirColar;
  await carregarDia();
}

async function trocarDia(d) {
  if (d > hoje()) return toast('Ainda não chegou esse dia.');
  if (sujos().length) guardarRascunho();
  st.dia = d; await carregarDia();
}

async function carregarDia() {
  $('#diaTxt').textContent = fmtDia(st.dia); $('#diaPick').value = st.dia; $('#diaPick').max = hoje();
  $('#dProx').disabled = st.dia >= hoje();
  $('#grade').innerHTML = '<div class="sem-resultado">Carregando…</div>';
  try {
    const pes = await S.pesagensDoDia(st.dia);
    st.salvo = {};
    for (const p of pes) (st.salvo[p.pessoa_id] ||= []).push(+p.kg);
    st.txt = {};
    for (const p of st.pessoas) st.txt[p.id] = (st.salvo[p.id] || []).join(', ');
    let rasc = null; try { rasc = JSON.parse(localStorage.getItem(rascunhoKey(st.dia))); } catch { }
    if (rasc) { Object.assign(st.txt, rasc); if (sujos().length) toast('Rascunho deste dia recuperado — falta salvar.'); }
    desenharGrade();
  } catch (e) { console.error(e); $('#grade').innerHTML = `<div class="sem-resultado">Não foi possível carregar o dia. ${esc(e.message)}</div>`; }
}

function visiveis() {
  const b = busca(st.filtro);
  const ps = st.pessoas.filter(p => (p.ativo || st.salvo[p.id]?.length) && combina(p, b));
  return b.num != null ? ps.sort((x, y) => exato(y, b) - exato(x, b) || porNumero(x, y)) : ps;
}

function desenharGrade() {
  const ps = visiveis();
  if (!st.pessoas.length) {
    $('#grade').innerHTML = '<div class="sem-resultado"><b style="color:var(--text)">Nenhuma pessoa cadastrada.</b><br>Cadastre a turma na aba Pessoas para começar a lançar.</div>';
  } else if (!ps.length) {
    const b = busca(st.filtro);
    $('#grade').innerHTML = `<div class="sem-resultado">${b.num != null ? `Ninguém com o número ${esc(b.num)}.` : 'Ninguém com esse nome.'}</div>`;
  } else {
    const b = busca(st.filtro);
    $('#grade').innerHTML = ps.map((p, i) => `
      <div class="lrow${st.filtro && (exato(p, b) || (i === 0 && b.num == null)) ? ' alvo' : ''}" data-id="${p.id}">
        ${avatar(p)}
        <div class="nm"><b>${nro(p)}${esc(p.nome)}</b><small class="nsub"></small></div>
        <div class="entrada">
          <input class="campo pesos" inputmode="decimal" enterkeyhint="next" autocomplete="off" placeholder="ex: 50, 24, 34" aria-label="Pesos de ${esc(p.nome)}" value="${esc(st.txt[p.id] || '')}">
          <div class="chips"></div>
        </div>
        <div class="tot"><b>0</b><small>kg</small></div>
      </div>`).join('');
    $$('.lrow').forEach(row => {
      const inp = $('.pesos', row);
      inp.oninput = () => { st.txt[row.dataset.id] = inp.value; atualizarLinha(row); atualizarResumo(); guardarRascunho(); };
      inp.onkeydown = e => {
        const ins = $$('.lrow .pesos'), i = ins.indexOf(inp);
        // Com busca ativa, Enter volta para a busca: número → Enter → pesos → Enter → próximo número
        if (e.key === 'Enter' && st.filtro) { e.preventDefault(); const f = $('#filtro'); f.focus(); f.select(); return; }
        if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); (ins[i + 1] || $('#sbSalvar'))?.focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); ins[i - 1]?.focus(); }
        if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); salvar(); }
      };
      atualizarLinha(row);
    });
  }
  atualizarResumo();
}

function atualizarLinha(row) {
  const id = row.dataset.id, { pesos, erros, tokens } = pesosDe(id);
  const total = soma(pesos);
  $('.chips', row).innerHTML = tokens.length > 1 || erros.length
    ? tokens.map(t => { const ok = !erros.includes(t); return `<span class="chip ${ok ? '' : 'ruim'}">${esc(ok ? fmtN(+t) : t)}</span>`; }).join('')
    : '';
  $('.tot', row).classList.toggle('zero', !total);
  $('.tot b', row).textContent = fmtN(total);
  $('.nsub', row).textContent = pesos.length ? `${pesos.length} ${pesos.length === 1 ? 'pesagem' : 'pesagens'}` : 'sem pesagem';
  row.classList.toggle('erro', erros.length > 0);
  row.classList.toggle('sujo', !erros.length && !igual(pesos, st.salvo[id] || []));
}

function atualizarResumo() {
  let kg = 0, n = 0, pessoas = 0;
  for (const p of st.pessoas) { const { pesos } = pesosDe(p.id); if (pesos.length) { pessoas++; n += pesos.length; kg += soma(pesos); } }
  $('#statsDia').innerHTML = `
    <div class="stat principal"><span>Colhido no dia</span><b>${fmtN(kg)}<small>kg</small></b></div>
    <div class="stat"><span>Pessoas que pesaram</span><b>${pessoas}<small>de ${st.pessoas.filter(p => p.ativo).length}</small></b></div>
    <div class="stat"><span>Pesagens</span><b>${n}</b></div>
    <div class="stat"><span>A pagar no dia</span><b>${fmtR$(kg * st.preco)}</b></div>`;
  const s = sujos(), bar = $('.salvarbar');
  if (!bar) return;
  bar.classList.toggle('on', s.length > 0 && st.aba === 'lancar');
  $('#sbTxt').innerHTML = `<b>${s.length}</b> ${s.length === 1 ? 'pessoa alterada' : 'pessoas alteradas'}`;
}

function guardarRascunho() {
  try {
    const s = sujos();
    if (s.length) localStorage.setItem(rascunhoKey(st.dia), JSON.stringify(Object.fromEntries(s.map(id => [id, st.txt[id]]))));
    else localStorage.removeItem(rascunhoKey(st.dia));
  } catch { }
}

function desfazer() {
  if (!confirm('Descartar as alterações não salvas deste dia?')) return;
  for (const p of st.pessoas) st.txt[p.id] = (st.salvo[p.id] || []).join(', ');
  try { localStorage.removeItem(rascunhoKey(st.dia)); } catch { }
  desenharGrade();
}

let salvando = false;
async function salvar() {
  const ids = sujos(); if (!ids.length || salvando) return;
  const comErro = ids.filter(id => pesosDe(id).erros.length);
  if (comErro.length) {
    const p = st.pessoas.find(x => x.id === comErro[0]);
    toast(`Peso inválido para ${primeiroNome(p.nome)}. Corrija o que está riscado.`, 'erro');
    $(`.lrow[data-id="${comErro[0]}"] .pesos`)?.focus(); return;
  }
  salvando = true; $('#sbSalvar').disabled = true; $('#sbSalvar').textContent = 'Salvando…';
  try {
    const dados = Object.fromEntries(ids.map(id => [id, pesosDe(id).pesos]));
    await S.salvarDia(st.dia, dados);
    for (const [id, arr] of Object.entries(dados)) st.salvo[id] = arr;
    try { localStorage.removeItem(rascunhoKey(st.dia)); } catch { }
    $$('.lrow').forEach(atualizarLinha); atualizarResumo();
    toast(`Dia salvo · ${ids.length} ${ids.length === 1 ? 'pessoa atualizada' : 'pessoas atualizadas'}`, 'ok');
  } catch (e) { console.error(e); toast('Não salvou: ' + e.message, 'erro'); }
  finally { salvando = false; $('#sbSalvar').disabled = false; $('#sbSalvar').textContent = 'Salvar dia'; }
}
window.addEventListener('beforeunload', e => { if (st.aba === 'lancar' && sujos().length) { guardarRascunho(); e.preventDefault(); e.returnValue = ''; } });

/* ---------- Colar lista ---------- */
function casarNome(txt) {
  const q = semAcento(txt).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!q) return null;
  const ps = st.pessoas.map(p => ({ p, n: semAcento(p.nome) }));
  let r = ps.filter(x => x.n === q); if (r.length === 1) return r[0].p;
  r = ps.filter(x => x.n.startsWith(q)); if (r.length === 1) return r[0].p;
  r = ps.filter(x => x.n.includes(q)); if (r.length === 1) return r[0].p;
  const partes = q.split(' ');
  r = ps.filter(x => partes.every(w => x.n.split(' ').some(y => y.startsWith(w)))); if (r.length === 1) return r[0].p;
  return r.length > 1 ? 'ambiguo' : null;
}
// Linhas aceitas: "Maria: 50 24 34", "26 = Neto Romão: 50 46 14" ou "26: 50 46 14" (número da folha e pesos)
function lerLista(texto) {
  return texto.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    let p = null, resto = l;
    const mn = l.match(/^(?:#|n[º°o.]*\s*)?(\d{1,4})\s*[.=:\-–)]?\s*(.*)$/i);
    if (mn) {
      p = st.pessoas.find(x => x.numero === +mn[1]) || null;
      resto = mn[2];
      if (!p && !/^[^\d]*[a-zà-ú]/i.test(resto)) return { linha: l, erro: `número ${mn[1]} não cadastrado` };
    }
    const m = resto.match(/^([^\d]*?)[\s:=\-–.]*(\d.*)?$/);
    if (!m || !m[2]) return { linha: l, erro: 'sem pesos' };
    if (!p) p = casarNome(m[1]);
    if (!p) return { linha: l, erro: 'nome não encontrado' };
    if (p === 'ambiguo') return { linha: l, erro: 'nome parecido com mais de uma pessoa' };
    const { pesos, erros } = parsePesos(m[2]);
    if (erros.length || !pesos.length) return { linha: l, erro: 'peso inválido' };
    return { linha: l, p, pesos };
  });
}
function abrirColar() {
  abrirSheet(`<div class="colar">
    <div class="card-cab"><div><h2 style="font:700 20px var(--f-disp)">Colar lista do dia</h2><div class="sub">Uma pessoa por linha: o número da folha ou o nome, e depois os pesos. Pode colar do bloco de notas ou do WhatsApp.</div></div><button class="btn icone fechar" aria-label="Fechar">✕</button></div>
    <textarea class="campo" id="txtLista" placeholder="26: 50 46 14&#10;27 = Wildo: 16 22 34 10&#10;Henrique - 26, 20, 40"></textarea>
    <ul class="previa" id="previa"></ul>
    <button class="btn primario" id="aplicar" disabled style="width:100%">Colocar nos campos</button>
    <p class="dica" style="margin-top:10px">Os pesos substituem o que já estiver no campo da pessoa. Depois é só conferir e salvar o dia.</p></div>`);
  $('.fechar', sheet).onclick = fecharSheet;
  const ta = $('#txtLista'), pv = $('#previa'), ap = $('#aplicar');
  let itens = [];
  ta.oninput = () => {
    itens = lerLista(ta.value);
    pv.innerHTML = itens.map(i => i.erro
      ? `<li class="falha"><span>${esc(i.linha)}</span><span>${i.erro}</span></li>`
      : `<li><span>${nro(i.p)}${esc(i.p.nome)}</span><span class="num">${i.pesos.map(fmtN).join(' + ')} = <b>${fmtN(soma(i.pesos))} kg</b></span></li>`).join('');
    const bons = itens.filter(i => !i.erro).length;
    ap.disabled = !bons; ap.textContent = bons ? `Colocar ${bons} ${bons === 1 ? 'pessoa' : 'pessoas'} nos campos` : 'Colocar nos campos';
  };
  ap.onclick = () => {
    for (const i of itens) if (!i.erro) st.txt[i.p.id] = i.pesos.join(', ');
    st.filtro = ''; $('#filtro').value = '';
    fecharSheet(); desenharGrade(); guardarRascunho();
    toast('Pesos colocados. Confira e toque em Salvar dia.');
  };
  setTimeout(() => ta.focus(), 300);
}

/* ================= PESSOAS ================= */
function telaPessoas() {
  const ativos = st.pessoas.filter(p => p.ativo).length;
  $('#conteudo').innerHTML = `<div class="duas">
    <div class="card">
      <h2>Cadastrar pessoas</h2><div class="sub">Uma pessoa por linha, com o número da folha antes do nome. Dá para colar a lista inteira de uma vez.</div>
      <textarea class="campo" id="novos" style="margin:12px 0" placeholder="39 Francisco Neto&#10;40 = Maria das Graças&#10;41 Cícero Alves"></textarea>
      <button class="btn primario" id="btnAdd" style="width:100%">Cadastrar</button>
    </div>
    <div class="card">
      <div class="card-cab"><div><h2>Turma</h2><div class="sub">${ativos} ativos · toque no número ou no nome para corrigir</div></div></div>
      <input class="campo" id="fP" placeholder="Número ou nome" style="margin-bottom:6px" aria-label="Procurar pessoa por número ou nome">
      <div id="listaP"></div>
    </div></div>`;
  const desenhar = () => {
    const b = busca($('#fP').value);
    const ps = st.pessoas.filter(p => combina(p, b)).sort((x, y) => exato(y, b) - exato(x, b) || (y.ativo - x.ativo) || porNumero(x, y));
    $('#listaP').innerHTML = ps.map(p => `<div class="prow ${p.ativo ? '' : 'inativo'}" data-id="${p.id}">${avatar(p)}
      <input class="campo num-campo" inputmode="numeric" value="${p.numero ?? ''}" placeholder="nº" aria-label="Número de ${esc(p.nome)}">
      <input class="campo nome-campo" value="${esc(p.nome)}" aria-label="Nome">
      <button class="btn tag">${p.ativo ? 'Ativo' : 'Inativo'}</button></div>`).join('') || '<div class="sem-resultado">Ninguém por aqui ainda.</div>';
    $$('.prow').forEach(row => {
      const p = st.pessoas.find(x => x.id === row.dataset.id);
      $('.num-campo', row).onchange = async e => {
        const v = e.target.value.trim(), numero = v === '' ? null : Number(v);
        if (numero !== null && (!Number.isInteger(numero) || numero < 1)) { e.target.value = p.numero ?? ''; return toast('O número precisa ser inteiro, como 12.', 'erro'); }
        if (numero === p.numero) return;
        const dono = numero !== null && st.pessoas.find(x => x.numero === numero && x.id !== p.id);
        if (dono) { e.target.value = p.numero ?? ''; return toast(`O número ${numero} já é de ${dono.nome}.`, 'erro'); }
        try { await S.atualizarPessoa(p.id, { numero }); p.numero = numero; st.pessoas.sort(porNumero); toast(numero === null ? 'Número removido' : `${primeiroNome(p.nome)} agora é o nº ${numero}`, 'ok'); }
        catch (er) { e.target.value = p.numero ?? ''; toast(er.message, 'erro'); }
      };
      $('.nome-campo', row).onchange = async e => {
        const nome = e.target.value.trim(); if (!nome || nome === p.nome) { e.target.value = p.nome; return; }
        try { await S.atualizarPessoa(p.id, { nome }); p.nome = nome; toast('Nome corrigido', 'ok'); } catch (er) { toast(er.message, 'erro'); }
      };
      $('button', row).onclick = async () => {
        try { await S.atualizarPessoa(p.id, { ativo: !p.ativo }); p.ativo = !p.ativo; toast(p.ativo ? `${primeiroNome(p.nome)} voltou para a lista de lançamento` : `${primeiroNome(p.nome)} saiu da lista de lançamento (o histórico continua no ranking)`); telaPessoas(); }
        catch (er) { toast(er.message, 'erro'); }
      };
    });
  };
  $('#fP').oninput = desenhar; desenhar();
  $('#btnAdd').onclick = async () => {
    const existentes = new Set(st.pessoas.map(p => semAcento(p.nome)));
    const usados = new Map(st.pessoas.filter(p => p.numero != null).map(p => [p.numero, p.nome]));
    const linhas = $('#novos').value.split('\n').map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean).map(s => {
      const m = s.match(/^(?:#|n[º°o.]*\s*)?(\d{1,4})\s*[.=:\-–)]?\s*(.+)$/i);
      return m ? { numero: +m[1], nome: m[2].trim() } : { numero: null, nome: s };
    });
    if (!linhas.length) return toast('Escreva pelo menos um nome.');
    const novos = [], vistos = new Set();
    for (const l of linhas) {
      if (existentes.has(semAcento(l.nome)) || vistos.has(semAcento(l.nome))) continue;
      if (l.numero != null && usados.has(l.numero)) return toast(`O número ${l.numero} já é de ${usados.get(l.numero)}. Escolha outro para ${l.nome}.`, 'erro');
      if (l.numero != null) usados.set(l.numero, l.nome);
      vistos.add(semAcento(l.nome)); novos.push(l);
    }
    if (!novos.length) return toast('Essas pessoas já estão cadastradas.');
    try {
      await S.adicionarPessoas(novos); st.pessoas = await S.listarPessoas();
      toast(`${novos.length} ${novos.length === 1 ? 'pessoa cadastrada' : 'pessoas cadastradas'}${linhas.length > novos.length ? ` (${linhas.length - novos.length} já existiam)` : ''}`, 'ok');
      telaPessoas();
    } catch (e) { toast(e.message, 'erro'); }
  };
}

/* ================= ANÁLISE ================= */
function faixa() {
  const a = st.an, h = hoje();
  if (a.modo === '7') return [addDias(h, -6), h];
  if (a.modo === '30') return [addDias(h, -29), h];
  if (a.modo === 'mes') return [h.slice(0, 8) + '01', h];
  if (a.modo === 'safra') return [CONFIG.INICIO_SAFRA, h];
  return [a.ini, a.fim];
}
async function telaAnalise() {
  const a = st.an;
  $('#conteudo').innerHTML = `
    <div class="periodos">
      <div class="seg" id="segAn">${[['7', '7 dias'], ['30', '30 dias'], ['mes', 'Este mês'], ['safra', 'Safra'], ['custom', 'Escolher']].map(([k, t]) => `<button data-m="${k}" aria-pressed="${a.modo === k}">${t}</button>`).join('')}</div>
      <div class="custom" ${a.modo === 'custom' ? '' : 'hidden'}><input type="date" class="campo" id="anIni" value="${a.ini}" max="${hoje()}"><span class="dim">até</span><input type="date" class="campo" id="anFim" value="${a.fim}" max="${hoje()}"></div>
      <label class="preco">R$ por kg <input class="campo" id="preco" inputmode="decimal" value="${String(st.preco).replace('.', ',')}"></label>
    </div>
    <div class="stats s5" id="anStats"></div>
    <div class="graficos">
      <div class="card largo"><div class="card-cab"><div><h2>Colheita por dia</h2><div class="sub">Total da fazenda · linha = média dos últimos 7 dias</div></div></div><div class="g" id="gDia"></div></div>
      <div class="card"><div class="card-cab"><div><h2>Quem mais colheu</h2><div class="sub">10 primeiros do período</div></div></div><div class="g" id="gTop" style="height:340px"></div></div>
      <div class="card"><div class="card-cab"><div><h2>Média por dia da semana</h2><div class="sub">Quilos em média nos dias com colheita</div></div></div><div class="g" id="gSem" style="height:340px"></div></div>
      <div class="card largo"><div class="card-cab"><div><h2>Presença e ritmo</h2><div class="sub">Quilos de cada pessoa por dia · quanto mais quente, mais colheu</div></div></div><div class="g" id="gMapa"></div></div>
      <div class="card largo"><div class="card-cab"><div><h2>Folha de pagamento</h2><div class="sub" id="folhaSub"></div></div>
        <div style="display:flex;gap:8px"><button class="btn" id="btnCsv">Baixar planilha</button><button class="btn" id="btnPrint">Imprimir</button></div></div>
        <div class="tabela-wrap"><table class="folha" id="folha"></table></div></div>
    </div>`;
  $$('#segAn button').forEach(b => b.onclick = () => { st.an.modo = b.dataset.m; telaAnalise(); });
  $('#anIni')?.addEventListener('change', e => { st.an.ini = e.target.value; if (st.an.ini > st.an.fim) st.an.fim = st.an.ini; telaAnalise(); });
  $('#anFim')?.addEventListener('change', e => { st.an.fim = e.target.value; if (st.an.fim < st.an.ini) st.an.ini = st.an.fim; telaAnalise(); });
  $('#preco').onchange = async e => {
    const v = Number(e.target.value.replace(',', '.'));
    if (!(v > 0 && v < 100)) { toast('Preço inválido', 'erro'); e.target.value = String(st.preco).replace('.', ','); return; }
    try { await S.definirPreco(v); st.preco = v; toast('Preço por kg atualizado', 'ok'); telaAnalise(); } catch (er) { toast(er.message, 'erro'); }
  };
  $('#btnPrint').onclick = () => window.print();

  const [ini, fim] = faixa();
  try {
    const dados = await S.totais(ini, fim);
    desenharAnalise(dados, ini, fim);
  } catch (e) { console.error(e); toast('Não foi possível carregar a análise: ' + e.message, 'erro'); }
}

function desenharAnalise(dados, ini, fim) {
  if (!window.echarts) return setTimeout(() => desenharAnalise(dados, ini, fim), 150);
  const rk = ranking(dados, st.pessoas), pd = porDia(dados);
  const total = rk.reduce((s, r) => s + r.kg, 0), nPes = rk.reduce((s, r) => s + r.n, 0);
  const diasCom = Object.keys(pd).sort();
  $('#anStats').innerHTML = `
    <div class="stat principal"><span>Castanha colhida</span><b>${fmtN(total)}<small>kg</small></b></div>
    <div class="stat"><span>Folha do período</span><b>${fmtR$(total * st.preco)}</b></div>
    <div class="stat"><span>Média por dia de colheita</span><b>${diasCom.length ? fmtN(total / diasCom.length) : '–'}<small>kg</small></b></div>
    <div class="stat"><span>Média por pessoa/dia</span><b>${dados.length ? fmtN(total / dados.length) : '–'}<small>kg</small></b></div>
    <div class="stat"><span>Peso médio por pesagem</span><b>${nPes ? fmtN(total / nPes) : '–'}<small>kg</small></b></div>`;

  const dias = listaDias(ini, fim);
  const serie = dias.map(d => pd[d]?.kg || 0);
  const mm = dias.map((d, i) => {
    const jan = dias.slice(Math.max(0, i - 6), i + 1).map(x => pd[x]?.kg).filter(v => v != null);
    return jan.length ? +(soma(jan) / jan.length).toFixed(1) : null;
  });
  grafico($('#gDia'), {
    grid: { left: 8, right: 12, top: 16, bottom: dias.length > 40 ? 40 : 4, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: v => (v == null ? '—' : fmtN(v) + ' kg') },
    dataZoom: dias.length > 40 ? [{ type: 'slider', height: 18, bottom: 6, borderColor: C.line, fillerColor: 'rgba(255,106,61,.15)', textStyle: { color: C.muted }, start: 100 - (40 / dias.length) * 100, end: 100 }, { type: 'inside' }] : [],
    xAxis: { type: 'category', data: dias.map(d => fmtDia(d, 'eixo')), ...eixo({ splitLine: { show: false } }) },
    yAxis: { type: 'value', ...eixo({ axisLine: { show: false } }) },
    series: [
      { name: 'Colhido', type: 'bar', barMaxWidth: 26, data: serie, itemStyle: { color: grad('#5A3A2A', '#FF6A3D'), borderRadius: [6, 6, 0, 0] } },
      { name: 'Média 7 dias', type: 'line', smooth: true, symbol: 'none', data: mm, lineStyle: { color: C.sol, width: 2.5 } },
    ],
  });

  const t10 = rk.slice(0, 10);
  grafico($('#gTop'), {
    grid: { left: 8, right: 54, top: 4, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'none' }, valueFormatter: v => fmtN(v) + ' kg' },
    xAxis: { type: 'value', show: false },
    yAxis: { type: 'category', inverse: true, data: t10.map(r => rotulo(r.pessoa)), ...eixo({ axisLine: { show: false }, axisLabel: { color: C.text, fontSize: 12.5 } }) },
    series: [{ type: 'bar', barWidth: 14, data: t10.map((r, i) => ({ value: r.kg, itemStyle: { color: i < 3 ? grad('#FF6A3D', '#F6B940', true) : grad('#4A3326', '#9C5B3B', true), borderRadius: [0, 7, 7, 0] } })), label: { show: true, position: 'right', color: C.text, fontFamily: 'IBM Plex Mono', fontSize: 12, formatter: p => fmtN(p.value) } }],
  });

  const sem = Array.from({ length: 7 }, () => ({ kg: 0, d: 0 }));
  for (const d of diasCom) { const w = parseIso(d).getDay(); sem[w].kg += pd[d].kg; sem[w].d++; }
  const ordemSem = [1, 2, 3, 4, 5, 6, 0];
  grafico($('#gSem'), {
    grid: { left: 8, right: 8, top: 16, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'none' }, formatter: ps => `${SEMANA[ordemSem[ps[0].dataIndex]]}<br><b>${fmtN(ps[0].value)} kg</b> em média · ${sem[ordemSem[ps[0].dataIndex]].d} dias` },
    xAxis: { type: 'category', data: ordemSem.map(w => SEMANA[w].slice(0, 3)), ...eixo({ splitLine: { show: false } }) },
    yAxis: { type: 'value', ...eixo({ axisLine: { show: false } }) },
    series: [{ type: 'bar', barMaxWidth: 30, data: ordemSem.map(w => sem[w].d ? +(sem[w].kg / sem[w].d).toFixed(1) : 0), itemStyle: { color: grad('#3A2A20', '#C9A27A'), borderRadius: [6, 6, 0, 0] } }],
  });

  const t15 = rk.slice(0, 15), diasMapa = dias.slice(-31);
  const elM = $('#gMapa'); elM.style.height = Math.max(220, t15.length * 26 + 70) + 'px';
  const vals = []; let vmax = 1;
  t15.forEach((r, y) => diasMapa.forEach((d, x) => { const v = r.porDia[d]; if (v) { vals.push([x, y, +v.toFixed(1)]); vmax = Math.max(vmax, v); } }));
  grafico(elM, {
    grid: { left: 8, right: 12, top: 4, bottom: 46, containLabel: true },
    tooltip: { formatter: p => `${esc(t15[p.value[1]].pessoa.nome)}<br>${fmtDia(diasMapa[p.value[0]])}<br><b>${fmtN(p.value[2])} kg</b>` },
    xAxis: { type: 'category', data: diasMapa.map(d => fmtDia(d, 'curto')), splitArea: { show: false }, ...eixo({ splitLine: { show: false } }) },
    yAxis: { type: 'category', inverse: true, data: t15.map(r => rotulo(r.pessoa)), ...eixo({ axisLine: { show: false }, splitLine: { show: false }, axisLabel: { color: C.text } }) },
    visualMap: { min: 0, max: Math.ceil(vmax), calculable: false, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 140, itemWidth: 10, text: [`${fmtN(vmax)} kg`, '0'], textStyle: { color: C.muted, fontSize: 11 }, inRange: { color: ['#2A1F18', '#7A3B22', '#D2582F', '#F6B940'] } },
    series: [{ type: 'heatmap', data: vals, itemStyle: { borderColor: '#1D1814', borderWidth: 2, borderRadius: 4 }, emphasis: { itemStyle: { borderColor: C.text } } }],
  });

  // Folha
  $('#folhaSub').textContent = `${fmtDia(ini, 'curto')}/${ini.slice(0, 4)} a ${fmtDia(fim, 'curto')}/${fim.slice(0, 4)} · ${fmtR$(st.preco)} por kg`;
  const linhas = rk.map(r => ({ numero: r.pessoa.numero ?? null, nome: r.pessoa.nome, dias: r.dias, n: r.n, kg: r.kg, media: r.kg / r.dias, valor: r.kg * st.preco }));
  const cols = [['numero', 'Nº'], ['nome', 'Nome'], ['dias', 'Dias'], ['n', 'Pesagens'], ['kg', 'Kg'], ['media', 'Kg/dia'], ['valor', 'A pagar']];
  const desenharFolha = () => {
    const { col, dir } = st.ordem;
    linhas.sort((a, b) => (typeof a[col] === 'string' ? a[col].localeCompare(b[col]) : a[col] - b[col]) * dir);
    $('#folha').innerHTML = `<thead><tr>${cols.map(([k, t]) => `<th data-k="${k}">${t}${col === k ? (dir > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}</tr></thead>
      <tbody>${linhas.map(l => `<tr><td class="num">${l.numero ?? '–'}</td><td>${esc(l.nome)}</td><td>${l.dias}</td><td>${l.n}</td><td>${fmtN(l.kg)}</td><td>${fmtN(l.media)}</td><td>${fmtR$(l.valor)}</td></tr>`).join('') || '<tr><td colspan="7" class="dim" style="text-align:center">Sem pesagens no período</td></tr>'}</tbody>
      <tfoot><tr><td>Total · ${linhas.length} pessoas</td><td></td><td>${nPes}</td><td>${fmtN(total)}</td><td></td><td>${fmtR$(total * st.preco)}</td></tr></tfoot>`;
    $$('#folha th').forEach(th => th.onclick = () => { st.ordem = { col: th.dataset.k, dir: st.ordem.col === th.dataset.k ? -st.ordem.dir : (th.dataset.k === 'nome' || th.dataset.k === 'numero' ? 1 : -1) }; desenharFolha(); });
  };
  desenharFolha();
  $('#btnCsv').onclick = () => {
    const n2 = v => v.toFixed(2).replace('.', ',');
    const csv = ['Nº;Nome;Dias;Pesagens;Kg;Kg por dia;Valor (R$)', ...linhas.map(l => [l.numero ?? '', `"${l.nome}"`, l.dias, l.n, n2(l.kg), n2(l.media), n2(l.valor)].join(';')),
      ['', '"TOTAL"', '', nPes, n2(total), '', n2(total * st.preco)].join(';')].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `folha-colheita-${ini}-a-${fim}.csv`; a.click();
  };
}

/* ================= sheet ================= */
const sheet = $('#sheet'), fundo = $('#fundo');
function abrirSheet(html) {
  sheet.innerHTML = '<div class="alca"></div>' + html; sheet.hidden = fundo.hidden = false;
  requestAnimationFrame(() => { sheet.classList.add('on'); fundo.classList.add('on'); });
}
function fecharSheet() { sheet.classList.remove('on'); fundo.classList.remove('on'); setTimeout(() => { sheet.hidden = fundo.hidden = true; }, 280); }
fundo.onclick = fecharSheet;
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) fecharSheet(); });

/* ================= início ================= */
async function iniciar() {
  try {
    [st.pessoas, st.preco] = await Promise.all([S.listarPessoas(), S.preco()]);
  } catch (e) { toast('Erro ao carregar: ' + e.message, 'erro'); }
  irPara(st.pessoas.length ? 'lancar' : 'pessoas');
}
(async () => {
  let sess = null; try { sess = await S.sessao(); } catch { }
  if (sess) return iniciar();
  $('#login').hidden = false; $('#app').hidden = true;
  $('#formLogin').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target); $('#erroLogin').textContent = '';
    try { await S.entrar(f.get('email'), f.get('senha')); $('#login').hidden = true; $('#app').hidden = false; iniciar(); }
    catch { $('#erroLogin').textContent = 'E-mail ou senha incorretos.'; }
  };
})();
