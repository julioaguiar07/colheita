// Datas sempre como string local 'YYYY-MM-DD'
export const pad = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const hoje = () => iso(new Date());
export const addDias = (s, n) => { const d = parseIso(s); d.setDate(d.getDate() + n); return iso(d); };
export const diasEntre = (a, b) => Math.round((parseIso(b) - parseIso(a)) / 864e5);
export function listaDias(inicio, fim) { const out = []; for (let d = inicio; d <= fim; d = addDias(d, 1)) out.push(d); return out; }

export const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const SEM_CURTA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function fmtDia(s, estilo = 'medio') {
  const d = parseIso(s);
  if (estilo === 'curto') return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  if (estilo === 'eixo') return `${d.getDate()} ${MES_CURTO[d.getMonth()]}`;
  if (estilo === 'semana') return `${SEM_CURTA[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  const rel = s === hoje() ? 'Hoje' : s === addDias(hoje(), -1) ? 'Ontem' : null;
  const base = `${SEM_CURTA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
  return rel ? `${rel} · ${base}` : base;
}
export function fmtMes(ym) { const [y, m] = ym.split('-').map(Number); return `${MESES[m - 1]} de ${y}`; }

const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtN = v => (Math.abs(v) >= 1000 ? nf0 : nf1).format(v);
export const fmtKg = v => `${fmtN(v)} kg`;
export const fmtR$ = v => brl.format(v);

// "50 24 34", "50,24,34", "50+24+34" → [50,24,34]. Decimal com ponto: 24.5
export function parsePesos(txt) {
  const tokens = String(txt || '').split(/[\s,;+\/:=\-–]+/).filter(Boolean);
  const pesos = [], erros = [];
  for (const t of tokens) {
    const v = Number(t);
    if (Number.isFinite(v) && v > 0 && v < 1000) pesos.push(Math.round(v * 100) / 100);
    else erros.push(t);
  }
  return { pesos, erros, tokens };
}
export const soma = a => a.reduce((s, v) => s + v, 0);

export const semAcento = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export function iniciais(nome) {
  const p = nome.trim().split(/\s+/).filter(w => w.length > 2 || /^[A-ZÀ-Ú]/.test(w));
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : (p[0]?.[1] || ''))).toUpperCase();
}
const TONS = ['#B4532A', '#8A6A2E', '#5E7F5A', '#3F6F7A', '#7A4E6E', '#9C5B3B', '#6B6A3A', '#4F5F8A'];
export function tom(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return TONS[h % TONS.length]; }
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function avatar(p, cls = '') {
  return `<span class="av ${cls}" style="--tom:${tom(p.id)}" aria-hidden="true">${esc(iniciais(p.nome))}</span>`;
}
// Número da pessoa (o mesmo da folha de pesagem)
export const nro = p => (p.numero != null ? `<span class="nro" title="Número ${p.numero}">${p.numero}</span>` : '');
export const porNumero = (a, b) => (a.numero ?? 1e9) - (b.numero ?? 1e9) || a.nome.localeCompare(b.nome);
// "26", "nº 26", "#26" → busca por número; qualquer outra coisa → busca por nome
export function busca(q) {
  const s = semAcento(q || '').replace(/^(#|n[º°o.]*\s*)(?=\d)/, '').trim();
  return /^\d+$/.test(s) ? { num: s } : { txt: s };
}
export function combina(p, b) {
  if (b.num != null) return p.numero != null && String(p.numero).startsWith(b.num);
  return !b.txt || semAcento(p.nome).includes(b.txt);
}
export const rotulo = p => (p.numero != null ? `${p.numero} · ` : '') + primeiroNome(p.nome);
export const exato = (p, b) => b.num != null && String(p.numero) === b.num;
export const primeiroNome = n => { const p = n.trim().split(/\s+/); return p.length > 1 && p[1].length <= 3 ? p.slice(0, 3).join(' ') : p.slice(0, 2).join(' '); };

// Períodos
export function periodo(modo, ref) {
  if (modo === 'mes') {
    const [y, m] = ref.split('-').map(Number);
    const ini = iso(new Date(y, m - 1, 1)), fim = iso(new Date(y, m, 0));
    const aIni = iso(new Date(y, m - 2, 1)), aFim = iso(new Date(y, m - 1, 0));
    return { inicio: ini, fim, anterior: { inicio: aIni, fim: aFim } };
  }
  const n = modo === '7' ? 7 : modo === '30' ? 30 : 1;
  return { inicio: addDias(ref, -(n - 1)), fim: ref, anterior: { inicio: addDias(ref, -(2 * n - 1)), fim: addDias(ref, -n) } };
}

// totais = [{pessoa_id, dia, kg, n}]
export function ranking(totais, pessoas) {
  const byId = new Map(pessoas.map(p => [p.id, p]));
  const m = new Map();
  for (const t of totais) {
    if (!byId.has(t.pessoa_id)) continue;
    let a = m.get(t.pessoa_id);
    if (!a) m.set(t.pessoa_id, a = { pessoa: byId.get(t.pessoa_id), kg: 0, n: 0, dias: 0, porDia: {} });
    a.kg += +t.kg; a.n += +t.n;
    if (!a.porDia[t.dia]) a.dias++;
    a.porDia[t.dia] = (a.porDia[t.dia] || 0) + +t.kg;
  }
  return [...m.values()]
    .sort((x, y) => y.kg - x.kg || x.pessoa.nome.localeCompare(y.pessoa.nome))
    .map((r, i) => ({ ...r, kg: Math.round(r.kg * 100) / 100, pos: i + 1 }));
}
export function porDia(totais) {
  const m = {};
  for (const t of totais) { const d = m[t.dia] || (m[t.dia] = { kg: 0, n: 0, pessoas: 0 }); d.kg += +t.kg; d.n += +t.n; d.pessoas++; }
  return m;
}
export const entre = (t, p) => t.dia >= p.inicio && t.dia <= p.fim;

export function toast(msg, tipo = '') {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.append(el); }
  el.textContent = msg; el.dataset.tipo = tipo; el.classList.add('on');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 2600);
}

// Valor a receber: soma de (kg do dia × preço do dia). Dias sem preço não entram no valor.
// totais = [{pessoa_id, dia, kg}], precos = {dia: preço} → Map(pessoa_id → { valor, kgSemPreco })
export function valores(totais, precos) {
  const m = new Map();
  for (const t of totais) {
    const a = m.get(t.pessoa_id) || { valor: 0, kgSemPreco: 0 };
    const p = precos[t.dia];
    if (p != null) a.valor += +t.kg * p; else a.kgSemPreco += +t.kg;
    m.set(t.pessoa_id, a);
  }
  for (const a of m.values()) a.valor = Math.round(a.valor * 100) / 100;
  return m;
}
export const diasSemPreco = (totais, precos) => [...new Set(totais.map(t => t.dia))].filter(d => precos[d] == null).sort();
export const fmtPreco = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`;
export const lerPreco = s => { const v = Number(String(s || '').trim().replace(/^r\$\s*/i, '').replace(',', '.')); return v > 0 && v < 100 ? Math.round(v * 1000) / 1000 : null; };
// "26/10, 27/10" — com muitos dias mostra os 4 primeiros e "+N"
export const listaCurta = (ds, max = 4) => ds.slice(0, max).map(d => fmtDia(d, 'curto')).join(', ') + (ds.length > max ? ` e mais ${ds.length - max}` : '');
