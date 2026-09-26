// ============================================
// app.js — Lógica principal do painel (v4)
// Login por perfil (APR/GV) + filtro por sala
// ============================================

// ---------- Estado global ----------
let dados = { vendas: [], produtos: [], base: [] };
let mapaProdutos = {};
let mapaBase = {};
let fotos = {};
let filtroMes = 'todos';
let filtroRn = 'todos';
let filtroVisitaRn = 'todos';
let filtroVisitaBees = 'todos';
let baseFiltradaAtual = [];
let porProdutoAtual = {};

// Aba Estáveis e Instáveis
let filtroRnEstaveis = 'todos';
let clienteExpandido = null;
let vendasPorCliente = {};

// Sessão e visibilidade
let USUARIO_ATUAL = null;
let vendasVisiveis = [];
let baseVisivel = [];

const NOMES_MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS = ['SEG','TER','QUA','QUI','SEX','SAB','DOM'];

// ============================================
// PERFIS E SALAS
// ============================================
const NOME_RN = {
  101:'Marcela', 102:'Mauricio', 103:'Beatriz', 104:'Tatiane',
  105:'Marcus', 106:'Alan', 107:'Marcos', 108:'Reginaldo',
  109:'Thiago', 110:'Raphael', 111:'Diones', 112:'Gustavo',
  201:'Ana', 202:'Alvaro', 203:'Alexandre', 204:'Sergio',
  205:'Nayra', 207:'Claudia',
  301:'Marcio', 302:'Marcos', 303:'Pedro', 304:'Alexandre',
  305:'Leonardo', 306:'Antonio', 307:'Marcão', 308:'Igor', 309:'Wilton'
};

const SALAS_RNS = {
  'Marcos': ['101','102','103','104','105','106','107','108','109','110','111','112'],
  'Ulisses': ['201','202','203','204','205','207'],
  'Junior': ['301','302','303','304','305','306','307','308','309']
};

function getSalaDoRn(rn) {
  const n = parseInt(rn, 10);
  if (n >= 101 && n <= 112) return 'Marcos';
  if (n >= 201 && n <= 207) return 'Ulisses';
  if (n >= 301 && n <= 309) return 'Junior';
  return 'A definir';
}

function getNomeRn(rn) {
  return NOME_RN[parseInt(rn, 10)] || '';
}

function getStatusCliente(status) {
  const s = String(status || '').trim().toLowerCase();
  const ativo = s === '' || s === 'ativo' || s === 'at' || s.startsWith('ativ');
  return ativo
    ? '<span class="badge ok">Ativo</span>'
    : '<span class="badge bad">Bloqueado</span>';
}

// ---------- Permissões por perfil ----------
function podeVerRn(rn) {
  if (!USUARIO_ATUAL) return false;
  if (USUARIO_ATUAL.perfil === 'APR') return true;
  if (USUARIO_ATUAL.perfil === 'RN') return String(rn) === String(USUARIO_ATUAL.setor);
  const lista = SALAS_RNS[USUARIO_ATUAL.sala] || [];
  return lista.includes(String(rn));
}

function rnsPermitidos() {
  if (!USUARIO_ATUAL) return [];
  if (USUARIO_ATUAL.perfil === 'APR') return Object.keys(NOME_RN);
  if (USUARIO_ATUAL.perfil === 'RN') return [String(USUARIO_ATUAL.setor)];
  return SALAS_RNS[USUARIO_ATUAL.sala] || [];
}

function podeAcessarFotos() {
  return USUARIO_ATUAL && USUARIO_ATUAL.perfil === 'APR';
}

// ---------- Sessão ----------
function aplicarVisibilidadePorPerfil() {
  const ehRn = USUARIO_ATUAL && USUARIO_ATUAL.perfil === 'RN';
  const btnApp = document.getElementById('btnEnviarApp');
  if (btnApp) btnApp.style.display = (USUARIO_ATUAL && USUARIO_ATUAL.perfil === 'APR') ? 'inline-flex' : 'none';

  // Abas permitidas por perfil
  const abasPermitidas = ehRn
    ? ['clientes', 'estaveis']
    : null; // null = todas (para APR/GV, exceto fotos para GV)

  if (ehRn) {
    ['dashboard', 'rns', 'relatorio', 'fotos'].forEach(id => {
      const tab = document.querySelector(`.tab[data-tab="${id}"]`);
      if (tab) tab.style.display = 'none';
      const painel = document.getElementById(id);
      if (painel) painel.style.display = 'none';
    });
    // Esconde o filtro "Selecionar RN" na aba Clientes e Produtos
    const cardRn = document.querySelector('#rnButtons')?.closest('.card');
    if (cardRn) cardRn.style.display = 'none';
    // Esconde o filtro "Filtro RN" na aba Estáveis e Instáveis
    const cardRnEst = document.querySelector('#rnButtonsEstaveis')?.closest('.card');
    if (cardRnEst) cardRnEst.style.display = 'none';
  }

  if (!podeAcessarFotos()) {
    const tab = document.querySelector('.tab[data-tab="fotos"]');
    if (tab) tab.style.display = 'none';
    const painel = document.getElementById('fotos');
    if (painel) painel.style.display = 'none';
  }
}

function mostrarUsuario() {
  if (!USUARIO_ATUAL) return;
  const avatar = document.getElementById('userAvatar');
  const nome = document.getElementById('userName');
  const papel = document.getElementById('userRole');
  if (avatar) avatar.textContent = USUARIO_ATUAL.nome.charAt(0).toUpperCase();
  if (nome) nome.textContent = USUARIO_ATUAL.nome;
  if (papel) {
    if (USUARIO_ATUAL.perfil === 'APR') {
      papel.textContent = 'Perfil APR · Acesso total';
    } else if (USUARIO_ATUAL.perfil === 'GV') {
      papel.textContent = 'Perfil GV · Sala ' + USUARIO_ATUAL.sala;
    } else {
      papel.textContent = 'Perfil RN · Setor ' + USUARIO_ATUAL.setor;
    }
  }
}

function sair() {
  localStorage.removeItem('conebel_usuario');
  USUARIO_ATUAL = null;
  document.getElementById('telaLogin').classList.remove('oculta');
}

// ---------- Abas (anexadas primeiro) ----------
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const painel = document.getElementById(tab.dataset.tab);
    if (painel) painel.classList.add('active');
    // Garante que os gráficos da aba aberta redesenhem com o tamanho correto
    setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 80);
  });
});

// ---------- Parser CSV ----------
function parseCSV(texto) {
  texto = texto.replace(/^\uFEFF/, '');
  const linhas = texto.trim().split(/\r?\n/).filter(l => l.trim());
  if (linhas.length === 0) return [];
  const primeira = linhas[0];
  const sep = (primeira.split(';').length > primeira.split(',').length) ? ';' : ',';
  const cabecalho = primeira.split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
  return linhas.slice(1).map(linha => {
    const valores = linha.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    cabecalho.forEach((h, i) => { obj[h] = valores[i] || ''; });
    return obj;
  });
}

function num(obj, campo) {
  const v = parseFloat(String(obj[campo] ?? '').replace(/\./g, '').replace(',', '.'));
  return isNaN(v) ? 0 : v;
}

// ---------- Carregar dados ----------
async function carregarDados() {
  try {
    const [vendasCsv, produtosCsv, baseCsv] = await Promise.all([
      fetch('data/vendas.csv').then(r => r.text()),
      fetch('data/produtos.csv').then(r => r.text()),
      fetch('data/base.csv').then(r => r.text())
    ]);

    dados.vendas = parseCSV(vendasCsv);
    dados.produtos = parseCSV(produtosCsv);
    dados.base = parseCSV(baseCsv);

    dados.produtos.forEach(p => { mapaProdutos[p.Cod_Produto] = p; });
    dados.base.forEach(b => { mapaBase[b.PDV] = b; });

    // Filtra por perfil (APR vê tudo; GV só a sala dele)
    vendasVisiveis = dados.vendas.filter(v => podeVerRn(v.Setor_cl));
    baseVisivel = dados.base.filter(b => podeVerRn(b.RN));

    await carregarFotos();
    indexarVendas();
    preencherSelectProdutos();

    const renders = [
      renderizarDashboard, renderizarRns,
      renderizarFiltrosMes, renderizarFiltrosRn,
      renderizarFiltrosVisitaRn, renderizarFiltrosVisitaBees,
      renderizarClientes, renderizarProdutos,
      renderizarRelatorio, renderizarFotos,
      renderizarFiltrosEstaveis, renderizarClientesEstaveis
    ];
    renders.forEach(fn => {
      try { fn(); } catch (e) { console.error('Erro em ' + fn.name + ':', e); }
    });

    const buscaCliente = document.getElementById('buscaCliente');
    if (buscaCliente) {
      buscaCliente.addEventListener('input', e => {
        const termo = e.target.value.toLowerCase();
        document.querySelector('#tabelaClientes tbody').innerHTML =
          baseFiltradaAtual.filter(b => JSON.stringify(b).toLowerCase().includes(termo)).map(linhaCliente).join('');
      });
    }

    const buscaProduto = document.getElementById('buscaProduto');
    if (buscaProduto) {
      buscaProduto.addEventListener('input', e => {
        const termo = e.target.value.toLowerCase();
        document.querySelector('#tabelaProdutos tbody').innerHTML =
          dados.produtos.filter(p => JSON.stringify(p).toLowerCase().includes(termo)).map(linhaProduto).join('');
      });
    }
  } catch (e) {
    console.error('Erro ao carregar dados:', e);
    alert('Não foi possível carregar os dados. Verifique os CSVs na pasta data/ e o servidor local.');
  }
}

// ============================================
// ABA 1 — DASHBOARD
// ============================================
function renderizarDashboard() {
  const vendas = vendasVisiveis;
  const total = vendas.reduce((s, v) => s + num(v, 'Total_Agrupado'), 0);
  const volume = vendas.reduce((s, v) => s + num(v, 'Volume'), 0);
  const qtde = vendas.reduce((s, v) => s + num(v, 'Qtde_Agrupada'), 0);
  const clientesUnicos = new Set(vendas.map(v => v.Cliente)).size;
  const produtosUnicos = new Set(vendas.map(v => v.Produto)).size;

  const kpiGrid = document.getElementById('kpiGrid');
  if (kpiGrid) {
    kpiGrid.innerHTML = `
      <div class="kpi"><div class="label">Total de Vendas</div><div class="value">${fmtMoeda(total)}</div><div class="sub">Análise completa</div></div>
      <div class="kpi green"><div class="label">Volume Total</div><div class="value">${fmtNum(volume)}</div><div class="sub">Unidades</div></div>
      <div class="kpi orange"><div class="label">Qtd. Vendida</div><div class="value">${fmtNum(qtde)}</div><div class="sub">Itens</div></div>
      <div class="kpi purple"><div class="label">Clientes Atendidos</div><div class="value">${fmtNum(clientesUnicos)}</div><div class="sub">PDVs</div></div>
      <div class="kpi"><div class="label">Produtos</div><div class="value">${fmtNum(produtosUnicos)}</div><div class="sub">Itens distintos</div></div>
    `;
  }

  const porMes = {};
  vendas.forEach(v => {
    const mes = v.Mes || '?';
    if (!porMes[mes]) porMes[mes] = { total: 0, volume: 0 };
    porMes[mes].total += num(v, 'Total_Agrupado');
    porMes[mes].volume += num(v, 'Volume');
  });
  const meses = Object.keys(porMes).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  criarGraficoLinha('chartMensal', meses, meses.map(m => porMes[m].total), 'Total de Vendas');
  criarGraficoBarras('chartVolume', meses, meses.map(m => porMes[m].volume), 'Volume', PALETA[2]);

  const porSetor = {};
  vendas.forEach(v => {
    const setor = v.Setor_cl || '?';
    if (!porSetor[setor]) porSetor[setor] = 0;
    porSetor[setor] += num(v, 'Total_Agrupado');
  });
  const setores = Object.keys(porSetor).sort((a, b) => porSetor[b] - porSetor[a]);
  criarGraficoDonut('chartSetor', setores.slice(0, 8), setores.slice(0, 8).map(s => porSetor[s]));
  criarGraficoHorizontal('chartTopSetores', setores.slice(0, 10), setores.slice(0, 10).map(s => porSetor[s]), 'Total de Vendas');
}

// ============================================
// ABA 2 — RNs E SALAS
// ============================================
function renderizarRns() {
  const vendas = vendasVisiveis;
  const porRn = {};

  vendas.forEach(v => {
    const rn = v.Setor_cl || '?';
    if (!porRn[rn]) porRn[rn] = { clientes: new Set(), produtos: new Set(), volume: 0, total: 0 };
    porRn[rn].clientes.add(v.Cliente);
    porRn[rn].produtos.add(v.Produto);
    porRn[rn].volume += num(v, 'Volume');
    porRn[rn].total += num(v, 'Total_Agrupado');
  });

  const rns = Object.keys(porRn).sort((a, b) => porRn[b].total - porRn[a].total);
  const tbody = document.querySelector('#tabelaRns tbody');
  if (tbody) {
    tbody.innerHTML = rns.map(rn => {
      const d = porRn[rn];
      const nome = getNomeRn(rn);
      return `<tr>
        <td><b>${rn}</b>${nome ? ` <span class="muted">· ${nome}</span>` : ''}</td>
        <td>${getSalaDoRn(rn)}</td>
        <td class="num">${fmtNum(d.clientes.size)}</td>
        <td class="num">${fmtNum(d.produtos.size)}</td>
        <td class="num">${fmtNum(d.volume)}</td>
        <td class="num"><b>${fmtMoeda(d.total)}</b></td>
      </tr>`;
    }).join('');
  }

  const porSala = {};
  rns.forEach(rn => {
    const sala = getSalaDoRn(rn);
    if (!porSala[sala]) porSala[sala] = 0;
    porSala[sala] += porRn[rn].total;
  });
  criarGraficoDonut('chartSalas', Object.keys(porSala), Object.values(porSala));

  const topRns = rns.slice(0, 10);
  const labels = topRns.map(r => `${r} ${getNomeRn(r)}`).map(s => s.trim());
  criarGraficoHorizontal('chartTopRns', labels, topRns.map(r => porRn[r].total), 'Total de Vendas');
}

// ============================================
// ABA 3 — FILTROS (MÊS, RN, VISITA)
// ============================================
function renderizarFiltrosMes() {
  const container = document.getElementById('mesButtons');
  if (!container) return;
  const meses = [...new Set(vendasVisiveis.map(v => v.Mes))]
    .map(m => parseInt(m, 10) || 0).filter(m => m > 0)
    .sort((a, b) => a - b);
  container.innerHTML = '<button class="filter-btn active" data-mes="todos">Todos</button>' +
    meses.map(m => `<button class="filter-btn" data-mes="${m}">${m}</button>`).join('');
  container.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filtroMes = btn.dataset.mes;
      container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderizarClientes();
      renderizarProdutos();
    });
  });
}

function renderizarFiltrosRn() {
  const container = document.getElementById('rnButtons');
  if (!container) return;
  const rns = rnsPermitidos().sort((a, b) => a - b);
  container.innerHTML = '<button class="filter-btn active" data-rn="todos">Todos</button>' +
    rns.map(rn => `<button class="filter-btn" data-rn="${rn}">${rn} ${NOME_RN[rn]}</button>`).join('');
  container.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filtroRn = btn.dataset.rn;
      container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderizarClientes();
      renderizarProdutos();
    });
  });
}

function diasDaString(valor) {
  return String(valor || '').toUpperCase()
    .split(/[\/,;]/)
    .map(s => s.trim())
    .filter(s => DIAS.includes(s));
}

function temDia(valor, dia) {
  return diasDaString(valor).includes(dia);
}

function montarFiltroVisita(containerId, campo, setFiltro, base) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const presentes = new Set();
  base.forEach(b => diasDaString(b[campo]).forEach(d => presentes.add(d)));
  const dias = DIAS.filter(d => presentes.has(d));
  container.innerHTML = '<button class="filter-btn active" data-dia="todos">Todos</button>' +
    dias.map(d => `<button class="filter-btn" data-dia="${d}">${d}/</button>`).join('');
  container.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setFiltro(btn.dataset.dia);
      container.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      renderizarClientes();
      renderizarProdutos();
    });
  });
}

function renderizarFiltrosVisitaRn() {
  montarFiltroVisita('visitaRnButtons', 'Vis_RN', d => { filtroVisitaRn = d; }, baseVisivel);
}

function renderizarFiltrosVisitaBees() {
  montarFiltroVisita('visitaBeesButtons', 'Vis_BEES', d => { filtroVisitaBees = d; }, baseVisivel);
}

function baseFiltrada() {
  let base = baseVisivel;
  if (filtroRn !== 'todos') base = base.filter(b => String(b.RN) === String(filtroRn));
  if (filtroVisitaRn !== 'todos') base = base.filter(b => temDia(b.Vis_RN, filtroVisitaRn));
  if (filtroVisitaBees !== 'todos') base = base.filter(b => temDia(b.Vis_BEES, filtroVisitaBees));
  return base;
}

// ============================================
// ABA 3 — CLIENTES E PRODUTOS
// ============================================
function linhaCliente(b) {
  const rnNum = b.RN || '';
  return `<tr>
    <td>${b.PDV}</td>
    <td><b>${b.Fantasia}</b></td>
    <td>${rnNum}</td>
    <td>${getNomeRn(rnNum) || rnNum}</td>
    <td>${getStatusCliente(b.Status_PDV)}</td>
    <td>${b['Status Inad'] || '—'}</td>
  </tr>`;
}

function linhaProduto(p) {
  const cod = p.Cod_Produto;
  const agg = porProdutoAtual[cod] || { qtde: 0, total: 0, clientes: new Set(), volume: 0 };
  const foto = fotos[cod];
  return `<tr>
    <td>${foto ? `<img src="${foto}" class="mini-foto" alt="foto">` : '<div class="placeholder-foto">📦</div>'}</td>
    <td>${cod}</td>
    <td><b>${p.Desc_Produto}</b></td>
    <td>${p.Embalagem_Consolidada}</td>
    <td class="num">${fmtNum(agg.qtde)}</td>
    <td class="num"><b>${fmtMoeda(agg.total)}</b></td>
    <td class="num">${fmtNum(agg.clientes.size)}</td>
    <td class="num">${fmtNum(agg.volume)}</td>
  </tr>`;
}

function renderizarClientes() {
  const tbody = document.querySelector('#tabelaClientes tbody');
  if (!tbody) return;

  let base = baseFiltrada();

  if (filtroMes !== 'todos') {
    const compradores = new Set(vendasVisiveis.filter(v => v.Mes === filtroMes).map(v => v.Cliente));
    base = base.filter(b => compradores.has(b.PDV));
  }

  baseFiltradaAtual = base;
  tbody.innerHTML = base.map(linhaCliente).join('');
}

function renderizarProdutos() {
  const tbody = document.querySelector('#tabelaProdutos tbody');
  if (!tbody) return;

  let vendasFiltradas = vendasVisiveis;
  if (filtroMes !== 'todos') vendasFiltradas = vendasFiltradas.filter(v => v.Mes === filtroMes);

  const clientesPermitidos = new Set(baseFiltrada().map(b => String(b.PDV)));
  if (filtroRn !== 'todos' || filtroVisitaRn !== 'todos' || filtroVisitaBees !== 'todos') {
    vendasFiltradas = vendasFiltradas.filter(v => clientesPermitidos.has(String(v.Cliente)));
  }

  porProdutoAtual = {};
  vendasFiltradas.forEach(v => {
    const cod = v.Produto;
    if (!porProdutoAtual[cod]) porProdutoAtual[cod] = { qtde: 0, total: 0, clientes: new Set(), volume: 0 };
    porProdutoAtual[cod].qtde += num(v, 'Qtde_Agrupada');
    porProdutoAtual[cod].total += num(v, 'Total_Agrupado');
    porProdutoAtual[cod].clientes.add(v.Cliente);
    porProdutoAtual[cod].volume += num(v, 'Volume');
  });

  tbody.innerHTML = dados.produtos.map(linhaProduto).join('');
}

// ============================================
// ABA 4 — RELATÓRIO EXECUTIVO
// ============================================
function renderizarRelatorio() {
  const conteudo = document.getElementById('relatorioConteudo');
  if (!conteudo) return;

  const vendas = vendasVisiveis;
  const total = vendas.reduce((s, v) => s + num(v, 'Total_Agrupado'), 0);
  const volume = vendas.reduce((s, v) => s + num(v, 'Volume'), 0);

  const porMes = {};
  vendas.forEach(v => {
    if (!porMes[v.Mes]) porMes[v.Mes] = 0;
    porMes[v.Mes] += num(v, 'Total_Agrupado');
  });
  const melhorMes = Object.entries(porMes).sort((a, b) => b[1] - a[1])[0];

  const porSetor = {};
  vendas.forEach(v => {
    if (!porSetor[v.Setor_cl]) porSetor[v.Setor_cl] = 0;
    porSetor[v.Setor_cl] += num(v, 'Total_Agrupado');
  });
  const melhorSetor = Object.entries(porSetor).sort((a, b) => b[1] - a[1])[0];
  const melhorSetorNome = melhorSetor ? `${melhorSetor[0]} ${getNomeRn(melhorSetor[0])}`.trim() : '—';

  const escopo = USUARIO_ATUAL && USUARIO_ATUAL.perfil === 'GV'
    ? `Sala ${USUARIO_ATUAL.sala}`
    : 'todas as salas (visão APR)';

  conteudo.innerHTML = `
    <div class="relatorio-destaque">
      <strong>Total vendido no período: ${fmtMoeda(total)}</strong><br>
      <span class="muted">Volume total de ${fmtNum(volume)} unidades · Escopo: ${escopo}</span>
    </div>
    <div class="relatorio-item">
      <h4>📅 Melhor mês de vendas</h4>
      <p>O mês de <strong>${melhorMes?.[0]}</strong> registrou o maior faturamento, com <strong>${fmtMoeda(melhorMes?.[1] || 0)}</strong>.</p>
    </div>
    <div class="relatorio-item">
      <h4>🏢 RN de destaque</h4>
      <p>O RN <strong>${melhorSetorNome}</strong> lidera o faturamento com <strong>${fmtMoeda(melhorSetor?.[1] || 0)}</strong>.</p>
    </div>
    <div class="relatorio-item">
      <h4>📊 Panorama</h4>
      <p>O painel consolida as vendas da Conebel, cruzando <strong>${dados.produtos.length} produtos</strong> e <strong>${baseVisivel.length} clientes (PDVs) no escopo atual</strong>.</p>
    </div>
  `;
}

// ============================================
// ABA 5 — FOTOS DE PRODUTOS (somente APR)
// ============================================
async function carregarFotos() {
  try {
    const resp = await fetch('fotos');
    const dadosResp = await resp.json();
    fotos = (dadosResp.fotos || {});
  } catch (e) {
    fotos = {};
    console.error('Erro ao carregar fotos:', e);
  }
}

async function enviarFoto(cod, dataUrl) {
  const resp = await fetch('upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cod: cod, data: dataUrl })
  });
  const resultado = await resp.json();
  if (!resultado.ok) throw new Error(resultado.erro || 'Falha no upload');
  return resultado.arquivo;
}

function preencherSelectProdutos() {
  const select = document.getElementById('selectProduto');
  if (!select) return;
  select.innerHTML = dados.produtos.map(p =>
    `<option value="${p.Cod_Produto}">${p.Cod_Produto} - ${p.Desc_Produto}</option>`).join('');
}

function renderizarFotos() {
  const grid = document.getElementById('fotoGrid');
  if (!grid) return;
  const comFoto = Object.entries(fotos);
  if (comFoto.length === 0) {
    grid.innerHTML = '<p class="muted">Nenhuma foto cadastrada ainda. Escolha um produto acima e envie uma imagem.</p>';
    return;
  }
  grid.innerHTML = comFoto.map(([cod, src]) => {
    const prod = mapaProdutos[cod] || {};
    return `<div class="foto-card">
      <img src="${src}" alt="${cod}">
      <div class="foto-info">
        <b>${cod}</b>
        <span>${prod.Desc_Produto || ''}</span><br>
        <button class="remove-photo" data-cod="${cod}">🗑 Remover</button>
      </div>
    </div>`;
  }).join('');

  document.querySelectorAll('.remove-photo').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cod = btn.dataset.cod;
      try {
        await fetch('delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cod: cod })
        });
        delete fotos[cod];
        renderizarFotos();
        renderizarProdutos();
      } catch (e) {
        alert('Erro ao remover foto: ' + e.message);
      }
    });
  });
}

// Upload (somente APR tem a aba visível)
const btnEscolherFoto = document.getElementById('btnEscolherFoto');
if (btnEscolherFoto) btnEscolherFoto.addEventListener('click', () => {
  const inputFoto = document.getElementById('inputFoto');
  if (inputFoto) inputFoto.click();
});

const inputFoto = document.getElementById('inputFoto');
if (inputFoto) {
  inputFoto.addEventListener('change', e => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    const reader = new FileReader();
    reader.onload = ev => {
      window._fotoTemp = ev.target.result;
      alert('Imagem selecionada! Clique em "Salvar foto" para vincular ao produto.');
    };
    reader.readAsDataURL(arquivo);
  });
}

const btnSalvarFoto = document.getElementById('btnSalvarFoto');
if (btnSalvarFoto) {
  btnSalvarFoto.addEventListener('click', async () => {
    if (!window._fotoTemp) { alert('Escolha uma imagem primeiro.'); return; }
    const select = document.getElementById('selectProduto');
    const cod = select ? select.value : '';
    if (!cod) { alert('Selecione um produto.'); return; }
    try {
      const arquivo = await enviarFoto(cod, window._fotoTemp);
      fotos[cod] = arquivo;
      renderizarFotos();
      renderizarProdutos();
      alert('Foto salva em ' + arquivo + '!');
    } catch (e) {
      alert('Erro ao salvar foto: ' + e.message);
    }
  });
}

// ============================================
// ABA 6 — ESTÁVEIS E INSTÁVEIS
// ============================================
function renderizarFiltrosEstaveis() {
  const cRn = document.getElementById('rnButtonsEstaveis');
  if (!cRn) return;
  const rns = rnsPermitidos().sort((a, b) => a - b);
  cRn.innerHTML = '<button class="filter-btn active" data-rn="todos">Todos</button>' +
    rns.map(rn => `<button class="filter-btn" data-rn="${rn}">${rn}</button>`).join('');
  cRn.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filtroRnEstaveis = btn.dataset.rn;
      cRn.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderizarClientesEstaveis();
      if (clienteExpandido) montarDetalheEstaveis(clienteExpandido);
    });
  });
}

function renderizarClientesEstaveis() {
  const tbody = document.querySelector('#tabelaClientesEstaveis tbody');
  if (!tbody) return;

  let clientes = baseVisivel;
  if (filtroRnEstaveis !== 'todos') {
    clientes = clientes.filter(b => String(b.RN) === String(filtroRnEstaveis));
  }

  tbody.innerHTML = clientes.map(b => {
    const expandido = String(clienteExpandido) === String(b.PDV);
    return `<tr class="cliente-linha${expandido ? ' expandida' : ''}" data-pdv="${b.PDV}">
      <td>${b.PDV} ${expandido ? '▼' : '▶'}</td>
      <td><b>${b.Fantasia}</b> <span class="muted">(RN ${b.RN})</span></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.cliente-linha').forEach(tr => {
    tr.addEventListener('click', () => {
      const pdv = tr.dataset.pdv;
      try {
        clienteExpandido = (String(clienteExpandido) === String(pdv)) ? null : pdv;
        renderizarClientesEstaveis();
        if (clienteExpandido) montarDetalheEstaveis(clienteExpandido);
        else fecharDetalheEstaveis();
      } catch (e) {
        console.error('Erro ao abrir detalhe:', e);
        mostrarErroDetalhe('Erro ao abrir o histórico: ' + e.message);
      }
    });
  });
}

function mesReferencia() {
  let ultimo = 0;
  for (const v of vendasVisiveis) {
    const m = parseInt(v.Mes, 10) || 0;
    if (m > ultimo) ultimo = m;
  }
  return ultimo;
}

function indexarVendas() {
  vendasPorCliente = {};
  for (const v of vendasVisiveis) {
    const pdv = String(v.Cliente);
    if (!vendasPorCliente[pdv]) vendasPorCliente[pdv] = [];
    vendasPorCliente[pdv].push(v);
  }
}

function mostrarErroDetalhe(msg) {
  const cont = document.getElementById('detalheEstaveis');
  if (!cont) return;
  cont.innerHTML = `<div class="relatorio-destaque" style="color:var(--danger);">⚠️ ${msg}</div>`;
  cont.style.display = 'block';
}

function montarDetalheEstaveis(pdv) {
  const cont = document.getElementById('detalheEstaveis');
  if (!cont) {
    console.error('Container #detalheEstaveis não encontrado no HTML.');
    return;
  }
  const cliente = baseVisivel.find(b => String(b.PDV) === String(pdv));
  if (!cliente) {
    mostrarErroDetalhe('Este cliente não pertence à sua sala.');
    return;
  }
  const m0 = mesReferencia();

  const porProduto = {};
  const vendasDoCliente = vendasPorCliente[String(pdv)] || [];
  vendasDoCliente.forEach(v => {
    const cod = v.Produto;
    const mesNum = parseInt(v.Mes, 10);
    if (!mesNum) return;
    if (!porProduto[cod]) porProduto[cod] = {};
    porProduto[cod][mesNum] = { vol: num(v, 'Volume'), fat: num(v, 'Total_Agrupado') };
  });

  const linhas = dados.produtos.map(p => {
    const cod = p.Cod_Produto;
    const regs = porProduto[cod] || {};
    const foto = fotos[cod];
    const celulas = NOMES_MESES.map((nome, i) => {
      const mes = i + 1;
      return regs[mes]
        ? '<td class="mes-comprou">X</td>'
        : '<td class="mes-nao-comprou">-</td>';
    }).join('');
    return `<tr>
      <td>${foto ? `<img src="${foto}" class="mini-foto">` : '<div class="placeholder-foto">📦</div>'}</td>
      <td>${cod}</td>
      <td class="desc">${p.Desc_Produto}</td>
      ${celulas}
    </tr>`;
  }).join('');

  cont.innerHTML = `
    <div class="detalhe-header">
      <h3>Histórico de ${cliente.Fantasia} <span class="muted">· PDV ${pdv} · RN ${cliente.RN}</span></h3>
      <button class="btn" onclick="fecharDetalheEstaveis()">✕ Fechar</button>
    </div>
    <div class="matriz-wrap">
      <table class="matriz-produtos">
        <thead><tr>
          <th>Foto</th><th>Cód Produto</th><th>Descrição</th>
          ${NOMES_MESES.map(n => `<th>${n}</th>`).join('')}
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>
    <p class="muted">Mês de referência: ${m0}.</p>`;
  cont.style.display = 'block';
}

function fecharDetalheEstaveis() {
  clienteExpandido = null;
  const cont = document.getElementById('detalheEstaveis');
  if (cont) cont.style.display = 'none';
  renderizarClientesEstaveis();
}

// ---------- Rodapé ----------
// ---------- Login (tela sobreposta) ----------
let perfilSelecionado = 'APR';

function selecionarPerfil(p) {
  perfilSelecionado = p;
  document.getElementById('btnApr').classList.toggle('active', p === 'APR');
  document.getElementById('btnGv').classList.toggle('active', p === 'GV');
  document.getElementById('btnRn').classList.toggle('active', p === 'RN');
}

async function entrar() {
  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;
  const erro = document.getElementById('erro');
  erro.textContent = '';
  if (!email || !senha) { erro.textContent = 'Informe e-mail e senha.'; return; }
  try {
    const resp = await fetch('login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ perfil: perfilSelecionado, email: email, senha: senha })
    });
    const resultado = await resp.json();
    if (resultado.ok) {
      localStorage.setItem('conebel_usuario', JSON.stringify(resultado.usuario));
      USUARIO_ATUAL = resultado.usuario;
      document.getElementById('telaLogin').classList.add('oculta');
      aplicarVisibilidadePorPerfil();
      mostrarUsuario();
      carregarDados();
    } else {
      erro.textContent = resultado.erro || 'Falha no login.';
    }
  } catch (e) {
    erro.textContent = 'Erro de conexão. Verifique se o servidor está rodando (py server.py).';
  }
}

function iniciar() {
  const sessao = localStorage.getItem('conebel_usuario');
  if (sessao) {
    try {
      USUARIO_ATUAL = JSON.parse(sessao);
      document.getElementById('telaLogin').classList.add('oculta');
      aplicarVisibilidadePorPerfil();
      mostrarUsuario();
      carregarDados();
    } catch (e) {
      document.getElementById('telaLogin').classList.remove('oculta');
    }
  } else {
    document.getElementById('telaLogin').classList.remove('oculta');
  }

  const btnSair = document.getElementById('btnSair');
  if (btnSair) btnSair.addEventListener('click', sair);

  const dataAtual = document.getElementById('dataAtual');
  if (dataAtual) dataAtual.textContent = new Date().toLocaleDateString('pt-BR');

  const senhaInput = document.getElementById('senha');
  if (senhaInput) senhaInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') entrar();
  });
}

// ============================================
// ENVIAR DADOS PARA O APP (somente APR)
// ============================================
const btnEnviarApp = document.getElementById('btnEnviarApp');
if (btnEnviarApp) btnEnviarApp.addEventListener('click', abrirModalApp);

function abrirModalApp() {
  const lista = document.getElementById('rnCheckList');
  const rns = Object.keys(NOME_RN).sort((a, b) => a - b);
  lista.innerHTML = rns.map(rn =>
    `<label class="rn-check"><input type="checkbox" value="${rn}"> ${rn} ${NOME_RN[rn]}</label>`
  ).join('');
  document.getElementById('enderecoServidor').textContent = window.location.origin;
  document.getElementById('resultadoEnvio').textContent = '';
  document.getElementById('senhaAprModal').value = '';
  document.getElementById('modalApp').style.display = 'flex';
}

function fecharModalApp() {
  document.getElementById('modalApp').style.display = 'none';
}

const btnEnviarEmails = document.getElementById('btnEnviarEmails');
if (btnEnviarEmails) btnEnviarEmails.addEventListener('click', async () => {
  const selecionados = [...document.querySelectorAll('#rnCheckList input:checked')].map(c => c.value);
  const senhaApr = document.getElementById('senhaAprModal').value;
  const resultado = document.getElementById('resultadoEnvio');
  if (selecionados.length === 0) { resultado.textContent = 'Selecione pelo menos um RN.'; return; }
  if (!senhaApr) { resultado.textContent = 'Informe a senha do APR.'; return; }
  resultado.textContent = '⏳ Enviando e-mails...';
  try {
    const resp = await fetch('enviar-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rns: selecionados, senha_apr: senhaApr })
    });
    const r = await resp.json();
    if (r.ok) {
      resultado.textContent = '✅ Enviado para: ' + r.enviados.join(', ') +
        (r.erros.length ? ' | Falhas: ' + r.erros.join(', ') : '');
    } else {
      resultado.textContent = '❌ ' + (r.erro || 'Falha no envio.');
    }
  } catch (e) {
    resultado.textContent = '❌ Erro de conexão com o servidor.';
  }
});

document.addEventListener('DOMContentLoaded', iniciar);