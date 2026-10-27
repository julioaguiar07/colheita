import { CONFIG } from './config.js';
import { iso, addDias, hoje, porNumero } from './util.js?v=3';

export const DEMO = !CONFIG.SUPABASE_URL;

let _sb;
async function sb() {
  if (!_sb) {
    const m = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    _sb = m.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return _sb;
}
const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

/* ---------------- modo demonstração ---------------- */
const KEY = 'colheita-caju-demo-v1';
let mem = null;
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function semear() {
  const nomes = ['Antônio Carlos', 'Maria das Graças', 'Francisco Neto', 'Raimunda Sousa', 'José Wilson', 'Francisca Lima', 'Cícero Alves', 'Luzia Pereira', 'Expedito Rocha', 'Damiana Costa', 'Raimundo Nonato', 'Joana Darc', 'Edilson Barros', 'Socorro Melo', 'Valdemir Gomes', 'Ivonete Silva', 'Manoel Bezerra', 'Terezinha Lopes', 'Gildásio Ramos', 'Aparecida Nunes'];
  const r = rng(42);
  const pessoas = nomes.map((nome, i) => ({ id: `p${String(i + 1).padStart(2, '0')}`, numero: i + 1, nome, ativo: true, forca: 0.6 + r() * 0.8 }));
  const pesagens = [];
  for (let d = addDias(hoje(), -45); d <= hoje(); d = addDias(d, 1)) {
    if (new Date(d + 'T12:00').getDay() === 0) continue;
    for (const p of pessoas) {
      if (r() < 0.12) continue;
      const vezes = 2 + Math.floor(r() * 4 * p.forca);
      for (let k = 0; k < vezes; k++) pesagens.push({ pessoa_id: p.id, dia: d, kg: Math.round(14 + r() * 34 * p.forca), ordem: k });
    }
  }
  pessoas.forEach(p => delete p.forca);
  return { pessoas, pesagens, preco: 1.4 };
}
function db() {
  if (mem) return mem;
  try { mem = JSON.parse(localStorage.getItem(KEY)); } catch { }
  if (!mem) { mem = semear(); salvar(); }
  return mem;
}
function salvar() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { } }
export function resetDemo() { mem = semear(); salvar(); }

/* ---------------- autenticação ---------------- */
export async function sessao() {
  if (DEMO) return { user: { email: 'demo' } };
  return ok(await (await sb()).auth.getSession()).session;
}
export async function entrar(email, senha) {
  if (DEMO) return true;
  ok(await (await sb()).auth.signInWithPassword({ email, password: senha }));
}
export async function sair() { if (!DEMO) await (await sb()).auth.signOut(); }

/* ---------------- pessoas ---------------- */
export async function listarPessoas() {
  if (DEMO) return db().pessoas.map(p => ({ ...p })).sort(porNumero);
  return ok(await (await sb()).from('pessoas').select('id,numero,nome,ativo')).sort(porNumero);
}
// lista = [{ nome, numero }] (numero pode ser null)
export async function adicionarPessoas(lista) {
  if (DEMO) { const d = db(); for (const { nome, numero } of lista) d.pessoas.push({ id: 'p' + Math.random().toString(36).slice(2, 9), nome, numero: numero ?? null, ativo: true }); salvar(); return; }
  ok(await (await sb()).from('pessoas').insert(lista.map(({ nome, numero }) => ({ nome, numero: numero ?? null }))));
}
export async function atualizarPessoa(id, patch) {
  if (DEMO) { Object.assign(db().pessoas.find(p => p.id === id), patch); salvar(); return; }
  ok(await (await sb()).from('pessoas').update(patch).eq('id', id));
}

/* ---------------- pesagens ---------------- */
export async function pesagensDoDia(dia) {
  if (DEMO) return db().pesagens.filter(p => p.dia === dia).sort((a, b) => a.ordem - b.ordem);
  return ok(await (await sb()).from('pesagens').select('pessoa_id,kg,ordem').eq('dia', dia).order('ordem').limit(5000));
}
// dados = { pessoa_id: [kg, ...] } — substitui as pesagens daquele dia para cada pessoa enviada
export async function salvarDia(dia, dados) {
  if (DEMO) {
    const d = db(); const ids = new Set(Object.keys(dados));
    d.pesagens = d.pesagens.filter(p => !(p.dia === dia && ids.has(p.pessoa_id)));
    for (const [id, arr] of Object.entries(dados)) arr.forEach((kg, i) => d.pesagens.push({ pessoa_id: id, dia, kg, ordem: i }));
    salvar(); return;
  }
  ok(await (await sb()).rpc('salvar_dia', { p_dia: dia, p_dados: dados }));
}
// [{pessoa_id, dia, kg, n}]
export async function totais(inicio, fim) {
  if (DEMO) {
    const m = new Map();
    for (const p of db().pesagens) {
      if (p.dia < inicio || p.dia > fim) continue;
      const k = p.pessoa_id + '|' + p.dia;
      const t = m.get(k) || { pessoa_id: p.pessoa_id, dia: p.dia, kg: 0, n: 0 };
      t.kg += p.kg; t.n++; m.set(k, t);
    }
    return [...m.values()];
  }
  const c = await sb(); const out = []; const passo = 1000;
  for (let de = 0; ; de += passo) {
    const lote = ok(await c.rpc('totais_por_dia', { inicio, fim }).range(de, de + passo - 1));
    out.push(...lote);
    if (lote.length < passo) break;
  }
  return out;
}
export async function ultimoDia() {
  if (DEMO) { const h = hoje(); return db().pesagens.reduce((m, p) => (p.dia <= h && p.dia > m ? p.dia : m), '') || null; }
  return ok(await (await sb()).rpc('ultimo_dia'));
}

/* ---------------- preço por kg ---------------- */
export async function preco() {
  if (DEMO) return db().preco ?? 1.4;
  const r = ok(await (await sb()).from('configuracoes').select('valor').eq('chave', 'preco_kg').maybeSingle());
  return r ? Number(r.valor) : 1.4;
}
export async function definirPreco(v) {
  if (DEMO) { db().preco = v; salvar(); return; }
  ok(await (await sb()).from('configuracoes').upsert({ chave: 'preco_kg', valor: v }));
}
