/* global echarts */
export const C = {
  caju: '#FF6A3D', sol: '#F6B940', folha: '#7FC8A9', ceu: '#9DB4FF', flor: '#E58FB0', castanha: '#C9A27A',
  text: '#F4ECE1', muted: '#A39585', dim: '#6E6257', line: '#2E2621', card: '#1D1814', card2: '#241E19',
};
export const SERIE = [C.caju, C.sol, C.folha, C.ceu, C.flor, C.castanha];
export const grad = (a, b, horiz = false) => new echarts.graphic.LinearGradient(0, horiz ? 0 : 1, horiz ? 1 : 0, 0, [{ offset: 0, color: a }, { offset: 1, color: b }]);

const base = () => ({
  backgroundColor: 'transparent',
  textStyle: { fontFamily: 'Figtree, system-ui, sans-serif', color: C.muted },
  animationDuration: 700, animationEasing: 'cubicOut',
  tooltip: {
    backgroundColor: '#2A231E', borderColor: '#3A3029', borderWidth: 1, padding: [8, 12],
    textStyle: { color: C.text, fontSize: 13 }, extraCssText: 'border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.4)',
  },
});
export const eixo = (o = {}) => ({
  axisLine: { lineStyle: { color: C.line } }, axisTick: { show: false },
  axisLabel: { color: C.muted, fontSize: 11, ...(o.axisLabel || {}) },
  splitLine: { lineStyle: { color: C.line, type: [3, 4] } }, ...o, axisLabelX: undefined,
});

export function grafico(el, opt) {
  if (!el) return;
  const c = echarts.getInstanceByDom(el) || echarts.init(el, null, { renderer: 'canvas' });
  c.setOption({ ...base(), ...opt, tooltip: { ...base().tooltip, ...(opt.tooltip || {}) } }, true);
  return c;
}
let t;
window.addEventListener('resize', () => {
  clearTimeout(t);
  t = setTimeout(() => document.querySelectorAll('[_echarts_instance_]').forEach(el => echarts.getInstanceByDom(el)?.resize()), 120);
});
