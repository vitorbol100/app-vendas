const PALETA = [
  '#2563eb', '#f59e0b', '#10b981', '#8b5cf6',
  '#ef4444', '#06b6d4', '#f97316', '#84cc16',
  '#ec4899', '#6366f1', '#14b8a6', '#eab308'
];

function fmtMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtNum(valor) {
  return valor.toLocaleString('pt-BR');
}

// Guarda as instâncias de cada gráfico para destruir antes de recriar
const graficos = {};

function criarGrafico(canvasId, config) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (graficos[canvasId]) graficos[canvasId].destroy();
  graficos[canvasId] = new Chart(ctx, config);
}

function criarGraficoBarras(canvasId, labels, dados, titulo, cor = PALETA[0]) {
  criarGrafico(canvasId, {
    type: 'bar',
    data: { labels, datasets: [{ label: titulo, data: dados, backgroundColor: cor, borderRadius: 6 }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => v.toLocaleString('pt-BR') } } }
    }
  });
}

function criarGraficoLinha(canvasId, labels, dados, titulo, cor = PALETA[0]) {
  criarGrafico(canvasId, {
    type: 'line',
    data: { labels, datasets: [{ label: titulo, data: dados, borderColor: cor, backgroundColor: cor + '22', fill: true, tension: 0.4, pointRadius: 4 }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => v.toLocaleString('pt-BR') } } }
    }
  });
}

function criarGraficoHorizontal(canvasId, labels, dados, titulo) {
  criarGrafico(canvasId, {
    type: 'bar',
    data: { labels, datasets: [{ label: titulo, data: dados, backgroundColor: PALETA.slice(0, labels.length), borderRadius: 6 }] },
    options: {
      indexAxis: 'y', responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { callback: v => v.toLocaleString('pt-BR') } } }
    }
  });
}

function criarGraficoDonut(canvasId, labels, dados) {
  criarGrafico(canvasId, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: dados, backgroundColor: PALETA, borderWidth: 2 }] },
    options: { responsive: true, plugins: { legend: { position: 'right' } } }
  });
}