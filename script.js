/* ALIEN RPG — Banco de Itens · script.js */
(function () {
  'use strict';

  var ARQUIVOS_DADOS = ['dados/itens.json', 'itens.json', 'Dados/itens.json', 'dados/Itens.json'];
  var CHAVE_PERSONALIZADOS = 'alienitens.personalizados.v1';
  var CHAVE_VISUAL = 'alienitens.visualizacao.v1';
  var CATEGORIA_PADRAO = 'Personalizados';

  var estado = {
    originais: [],
    personalizados: [],
    busca: '',
    categoria: '',
    tipo: '',
    raridade: '',
    ordem: 'nome-asc',
    visual: 'grade'
  };

  var $ = function (id) { return document.getElementById(id); };
  var elBusca = $('busca'), elRapidos = $('rapidos');
  var selCategoria = $('filtro-categoria'), selTipo = $('filtro-tipo'), selRaridade = $('filtro-raridade');
  var grupoRaridade = $('grupo-raridade'), selOrdem = $('ordenacao');
  var elResultados = $('resultados'), elSemResultados = $('sem-resultados');
  var elContagem = $('contagem'), elErro = $('aviso-erro'), elToast = $('toast');
  var btnGrade = $('btn-grade'), btnLista = $('btn-lista');
  var modalDetalhes = $('modal-detalhes'), modalCadastro = $('modal-cadastro');
  var ultimoFoco = null, toastTimer = null;

  /* ---------- utilidades ---------- */
  function normalizar(t) {
    return String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }
  function el(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto != null) e.textContent = texto;
    return e;
  }
  function todos() { return estado.originais.concat(estado.personalizados); }
  function unicos(lista, campo) {
    var vistos = {}, saida = [];
    lista.forEach(function (i) {
      var v = i[campo];
      if (v && !vistos[v]) { vistos[v] = true; saida.push(v); }
    });
    return saida.sort(function (a, b) { return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }); });
  }
  function mostrarToast(msg, erro) {
    elToast.textContent = msg;
    elToast.className = 'toast' + (erro ? ' erro' : '');
    elToast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { elToast.hidden = true; }, 3200);
  }

  /* ---------- armazenamento local ---------- */
  function carregarPersonalizados() {
    try {
      var bruto = localStorage.getItem(CHAVE_PERSONALIZADOS);
      if (!bruto) return [];
      var lista = JSON.parse(bruto);
      if (!Array.isArray(lista)) return [];
      return lista.filter(function (i) { return i && typeof i.id === 'string' && typeof i.nome === 'string'; })
        .map(function (i) {
          return {
            id: i.id, nome: i.nome, categoria: i.categoria || CATEGORIA_PADRAO, tipo: i.tipo || '',
            raridade: i.raridade || '', fabricante: i.fabricante || '', descricao: i.descricao || '',
            atributos: {}, tags: Array.isArray(i.tags) ? i.tags : [], personalizado: true
          };
        });
    } catch (e) { return []; }
  }
  function salvarPersonalizados() {
    try {
      var dados = estado.personalizados.map(function (i) {
        return { id: i.id, nome: i.nome, categoria: i.categoria, tipo: i.tipo, raridade: i.raridade,
          fabricante: i.fabricante, descricao: i.descricao, tags: i.tags };
      });
      localStorage.setItem(CHAVE_PERSONALIZADOS, JSON.stringify(dados));
      return true;
    } catch (e) { return false; }
  }

  /* ---------- carregamento dos dados ---------- */
  function enderecoCompleto(u) {
    try { return new URL(u, document.baseURI).href; } catch (x) { return u; }
  }
  function carregarDados() {
    var tentativas = [];
    function aceitar(json, url) {
      var lista = Array.isArray(json) ? json : json && json.itens;
      if (!Array.isArray(lista)) throw new Error('O arquivo ' + enderecoCompleto(url) + ' foi encontrado, mas não contém uma lista de itens válida.');
      estado.originais = lista.filter(function (i) { return i && i.id && i.nome; });
    }
    function tentar(n) {
      if (n >= ARQUIVOS_DADOS.length) {
        var falha = new Error('nenhum dos endereços respondeu');
        falha.tentativas = tentativas;
        throw falha;
      }
      var url = ARQUIVOS_DADOS[n];
      return fetch(url, { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) {
          tentativas.push(enderecoCompleto(url) + '  →  status ' + r.status);
          return tentar(n + 1);
        }
        return r.json().then(function (json) { aceitar(json, url); }, function () {
          throw new Error('O arquivo ' + enderecoCompleto(url) + ' foi encontrado, mas o JSON é inválido (erro de vírgula, aspas ou chaves).');
        });
      }, function (e) {
        tentativas.push(enderecoCompleto(url) + '  →  ' + (e && e.message ? e.message : 'falha de rede'));
        return tentar(n + 1);
      });
    }
    return tentar(0);
  }
  function mostrarErroCarregamento(e) {
    elErro.hidden = false;
    elErro.textContent = '';
    elErro.appendChild(el('strong', null, 'Não foi possível carregar o catálogo de itens.'));
    if (e && e.tentativas) {
      elErro.appendChild(el('span', null, 'O site procurou o arquivo de dados nestes endereços e não encontrou:'));
      var ul = el('ul');
      e.tentativas.forEach(function (t) { ul.appendChild(el('li', null, t)); });
      elErro.appendChild(ul);
      elErro.appendChild(el('span', null, 'Confira no GitHub se existe a pasta "dados" (minúscula) com o arquivo "itens.json" dentro, na mesma pasta do index.html. Se estiver rodando no computador, abra pelo Live Server do VS Code e não clicando direto no index.html.'));
    } else {
      elErro.appendChild(el('span', null, (e && e.message ? e.message : 'Erro desconhecido.') + ' Se estiver rodando no computador, use o Live Server do VS Code.'));
    }
  }

  /* ---------- filtros ---------- */
  function preencherSelect(sel, rotuloTodos, valores, atual) {
    sel.textContent = '';
    var o = el('option', null, rotuloTodos); o.value = ''; sel.appendChild(o);
    valores.forEach(function (v) { var op = el('option', null, v); op.value = v; sel.appendChild(op); });
    sel.value = valores.indexOf(atual) >= 0 ? atual : '';
    return sel.value;
  }
  function atualizarOpcoes() {
    var lista = todos();
    var categorias = unicos(lista, 'categoria');
    estado.categoria = preencherSelect(selCategoria, 'Todas as categorias', categorias, estado.categoria);
    estado.tipo = preencherSelect(selTipo, 'Todos os tipos', unicos(lista, 'tipo'), estado.tipo);
    var raridades = unicos(lista, 'raridade');
    grupoRaridade.hidden = raridades.length === 0;
    estado.raridade = preencherSelect(selRaridade, 'Todas as raridades', raridades, estado.raridade);

    elRapidos.textContent = '';
    var todas = el('button', 'chip' + (estado.categoria === '' ? ' ativo' : ''), 'Todas');
    todas.type = 'button'; todas.dataset.categoria = '';
    elRapidos.appendChild(todas);
    categorias.forEach(function (c) {
      var b = el('button', 'chip' + (estado.categoria === c ? ' ativo' : ''), c);
      b.type = 'button'; b.dataset.categoria = c; b.setAttribute('aria-pressed', estado.categoria === c ? 'true' : 'false');
      elRapidos.appendChild(b);
    });
    todas.setAttribute('aria-pressed', estado.categoria === '' ? 'true' : 'false');

    preencherDatalist($('lista-categorias'), categorias);
    preencherDatalist($('lista-tipos'), unicos(lista, 'tipo'));
  }
  function preencherDatalist(dl, valores) {
    dl.textContent = '';
    valores.forEach(function (v) { var o = document.createElement('option'); o.value = v; dl.appendChild(o); });
  }

  function textoBusca(i) {
    return normalizar([i.nome, i.categoria, i.tipo, i.fabricante, i.descricao, (i.tags || []).join(' ')].join(' '));
  }
  function filtrar() {
    var termos = normalizar(estado.busca).split(/\s+/).filter(Boolean);
    return todos().filter(function (i) {
      if (estado.categoria && i.categoria !== estado.categoria) return false;
      if (estado.tipo && i.tipo !== estado.tipo) return false;
      if (estado.raridade && i.raridade !== estado.raridade) return false;
      if (!termos.length) return true;
      var t = textoBusca(i);
      return termos.every(function (x) { return t.indexOf(x) >= 0; });
    });
  }
  function ordenar(lista) {
    var copia = lista.slice();
    var chave = function (t) { return normalizar(t).replace(/^[^a-z0-9]+/, ''); };
    var cmp = function (a, b) { return chave(a).localeCompare(chave(b), 'pt-BR', { sensitivity: 'base', numeric: true }); };
    copia.sort(function (a, b) {
      if (estado.ordem === 'nome-desc') return cmp(b.nome, a.nome);
      if (estado.ordem === 'categoria') return cmp(a.categoria || '', b.categoria || '') || cmp(a.nome, b.nome);
      return cmp(a.nome, b.nome);
    });
    return copia;
  }

  /* ---------- renderização ---------- */
  function resumoCartao(i) {
    if (i.descricao) return i.descricao;
    if (i.atributos && i.atributos.Efeito) return 'Efeito: ' + i.atributos.Efeito;
    if (i.atributos && i.atributos.Especial) return 'Especial: ' + i.atributos.Especial;
    return 'Descrição não informada.';
  }
  function criarCartao(i) {
    var c = el('article', 'cartao');
    c.tabIndex = 0; c.setAttribute('role', 'button');
    c.setAttribute('aria-label', 'Abrir detalhes de ' + i.nome);
    c.dataset.id = i.id;
    c.appendChild(el('h3', 'cartao-nome', i.nome));
    var meta = el('div', 'cartao-meta');
    if (i.categoria) meta.appendChild(el('span', 'selo selo-categoria', i.categoria));
    if (i.tipo) meta.appendChild(el('span', 'selo', i.tipo));
    if (i.raridade) meta.appendChild(el('span', 'selo selo-raridade', i.raridade));
    if (i.personalizado) meta.appendChild(el('span', 'selo selo-personalizado', 'Personalizado'));
    c.appendChild(meta);
    c.appendChild(el('p', 'cartao-descricao', resumoCartao(i)));
    c.appendChild(el('span', 'cartao-indicador', 'Ver detalhes'));
    return c;
  }
  function renderizar() {
    var lista = ordenar(filtrar());
    var total = todos();
    elResultados.textContent = '';
    var frag = document.createDocumentFragment();
    lista.forEach(function (i) { frag.appendChild(criarCartao(i)); });
    elResultados.appendChild(frag);
    elResultados.className = 'resultados ' + (estado.visual === 'lista' ? 'modo-lista' : 'modo-grade');
    elSemResultados.hidden = lista.length !== 0 || total.length === 0;
    $('stat-total').textContent = total.length;
    $('stat-resultados').textContent = lista.length;
    $('stat-categorias').textContent = unicos(total, 'categoria').length;
    elContagem.textContent = total.length ? (lista.length + ' de ' + total.length + ' itens exibidos') : '';
    btnGrade.setAttribute('aria-pressed', estado.visual === 'grade' ? 'true' : 'false');
    btnLista.setAttribute('aria-pressed', estado.visual === 'lista' ? 'true' : 'false');
  }
  function atualizarTudo() { atualizarOpcoes(); renderizar(); }

  /* ---------- janelas ---------- */
  function abrirModal(m) {
    ultimoFoco = document.activeElement;
    m.hidden = false;
    document.body.classList.add('modal-aberto');
    var caixa = m.querySelector('.modal-caixa');
    caixa.scrollTop = 0;
    var alvo = m.querySelector('input,textarea,.modal-fechar');
    if (alvo) alvo.focus();
  }
  function fecharModal(m) {
    m.hidden = true;
    if (modalDetalhes.hidden && modalCadastro.hidden) document.body.classList.remove('modal-aberto');
    if (ultimoFoco && ultimoFoco.focus && document.contains(ultimoFoco)) ultimoFoco.focus();
  }

  function abrirDetalhes(id) {
    var i = todos().filter(function (x) { return x.id === id; })[0];
    if (!i) return;
    var corpo = $('detalhes-corpo');
    corpo.textContent = '';
    var h = el('h2', 'detalhes-nome', i.nome); h.id = 'detalhes-titulo';
    corpo.appendChild(h);
    var meta = el('div', 'detalhes-meta');
    if (i.categoria) meta.appendChild(el('span', 'selo selo-categoria', i.categoria));
    if (i.tipo) meta.appendChild(el('span', 'selo', i.tipo));
    if (i.raridade) meta.appendChild(el('span', 'selo selo-raridade', i.raridade));
    if (i.personalizado) meta.appendChild(el('span', 'selo selo-personalizado', 'Personalizado'));
    corpo.appendChild(meta);
    if (i.fabricante) {
      var f = el('p', 'detalhes-fab'); f.appendChild(el('strong', null, 'Fabricante: ')); f.appendChild(document.createTextNode(i.fabricante));
      corpo.appendChild(f);
    }
    corpo.appendChild(i.descricao ? el('p', 'detalhes-descricao', i.descricao) : el('p', 'detalhes-descricao detalhes-vazio', 'Descrição não informada.'));
    var chaves = i.atributos ? Object.keys(i.atributos) : [];
    if (chaves.length) {
      corpo.appendChild(el('h3', 'detalhes-secao', 'Dados do item'));
      var dl = el('dl', 'atributos');
      chaves.forEach(function (k) { dl.appendChild(el('dt', null, k)); dl.appendChild(el('dd', null, i.atributos[k])); });
      corpo.appendChild(dl);
    }
    if (i.observacao) corpo.appendChild(el('p', 'detalhes-obs', 'Observação: ' + i.observacao));
    if (i.fonte) corpo.appendChild(el('p', 'detalhes-fonte', 'Fonte: ' + i.fonte));
    if (i.tags && i.tags.length) {
      var tg = el('div', 'detalhes-tags');
      i.tags.forEach(function (t) { tg.appendChild(el('span', 'selo', t)); });
      corpo.appendChild(tg);
    }
    var rod = el('div', 'detalhes-rodape');
    if (i.personalizado) {
      var bExcluir = el('button', 'botao botao-perigo', 'Excluir item'); bExcluir.type = 'button';
      var conf = el('div', 'confirmar-exclusao'); conf.hidden = true;
      conf.appendChild(el('span', null, 'Excluir este item personalizado?'));
      var grupo = el('span');
      var sim = el('button', 'botao botao-perigo', 'Sim, excluir'); sim.type = 'button';
      var nao = el('button', 'botao', 'Cancelar'); nao.type = 'button';
      grupo.appendChild(sim); grupo.appendChild(document.createTextNode(' ')); grupo.appendChild(nao);
      conf.appendChild(grupo);
      bExcluir.addEventListener('click', function () { bExcluir.hidden = true; conf.hidden = false; sim.focus(); });
      nao.addEventListener('click', function () { conf.hidden = true; bExcluir.hidden = false; bExcluir.focus(); });
      sim.addEventListener('click', function () { excluirPersonalizado(i.id); });
      rod.appendChild(bExcluir); rod.appendChild(conf);
    }
    var bFechar = el('button', 'botao', 'Fechar'); bFechar.type = 'button'; bFechar.setAttribute('data-fechar', '');
    rod.appendChild(bFechar);
    corpo.appendChild(rod);
    abrirModal(modalDetalhes);
  }

  /* ---------- itens personalizados ---------- */
  function novoId() { return 'custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
  function nomeJaExiste(nome) {
    var n = normalizar(nome);
    return todos().some(function (i) { return normalizar(i.nome) === n; });
  }
  function abrirCadastro() {
    $('form-cadastro').reset();
    $('cad-erro').hidden = true;
    abrirModal(modalCadastro);
  }
  function salvarCadastro(ev) {
    ev.preventDefault();
    var erro = $('cad-erro');
    var nome = $('cad-nome').value.replace(/\s+/g, ' ').trim();
    if (nome.length < 2) { erro.textContent = 'Informe o nome do item (mínimo de 2 caracteres).'; erro.hidden = false; $('cad-nome').focus(); return; }
    if (nomeJaExiste(nome)) { erro.textContent = 'Já existe um item com esse nome no catálogo.'; erro.hidden = false; $('cad-nome').focus(); return; }
    var item = {
      id: novoId(), nome: nome,
      categoria: $('cad-categoria').value.trim() || CATEGORIA_PADRAO,
      tipo: $('cad-tipo').value.trim(), raridade: '',
      fabricante: $('cad-fabricante').value.trim(),
      descricao: $('cad-descricao').value.trim(),
      atributos: {}, tags: ['personalizado'], personalizado: true
    };
    estado.personalizados.push(item);
    if (!salvarPersonalizados()) {
      estado.personalizados.pop();
      erro.textContent = 'Não foi possível salvar no navegador (armazenamento local indisponível).';
      erro.hidden = false; return;
    }
    ultimoFoco = null;
    fecharModal(modalCadastro);
    atualizarTudo();
    mostrarToast('Item "' + nome + '" adicionado ao catálogo.');
  }
  function excluirPersonalizado(id) {
    var antes = estado.personalizados.slice();
    estado.personalizados = estado.personalizados.filter(function (i) { return i.id !== id; });
    if (!salvarPersonalizados()) {
      estado.personalizados = antes;
      mostrarToast('Não foi possível excluir: armazenamento local indisponível.', true);
      return;
    }
    ultimoFoco = null;
    fecharModal(modalDetalhes);
    atualizarTudo();
    mostrarToast('Item personalizado excluído.');
  }

  /* ---------- eventos ---------- */
  function limparFiltros() {
    estado.busca = ''; estado.categoria = ''; estado.tipo = ''; estado.raridade = ''; estado.ordem = 'nome-asc';
    elBusca.value = ''; selOrdem.value = 'nome-asc';
    atualizarTudo();
  }
  function definirVisual(v) {
    estado.visual = v;
    try { localStorage.setItem(CHAVE_VISUAL, v); } catch (e) { /* ignora */ }
    renderizar();
  }
  function ligarEventos() {
    elBusca.addEventListener('input', function () { estado.busca = elBusca.value; renderizar(); });
    selCategoria.addEventListener('change', function () { estado.categoria = selCategoria.value; atualizarTudo(); });
    selTipo.addEventListener('change', function () { estado.tipo = selTipo.value; renderizar(); });
    selRaridade.addEventListener('change', function () { estado.raridade = selRaridade.value; renderizar(); });
    selOrdem.addEventListener('change', function () { estado.ordem = selOrdem.value; renderizar(); });
    elRapidos.addEventListener('click', function (ev) {
      var b = ev.target.closest('.chip'); if (!b) return;
      estado.categoria = b.dataset.categoria || '';
      atualizarTudo();
    });
    $('btn-limpar').addEventListener('click', limparFiltros);
    btnGrade.addEventListener('click', function () { definirVisual('grade'); });
    btnLista.addEventListener('click', function () { definirVisual('lista'); });
    $('btn-adicionar').addEventListener('click', abrirCadastro);
    $('form-cadastro').addEventListener('submit', salvarCadastro);

    elResultados.addEventListener('click', function (ev) {
      var c = ev.target.closest('.cartao'); if (c) abrirDetalhes(c.dataset.id);
    });
    elResultados.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var c = ev.target.closest('.cartao'); if (!c) return;
      ev.preventDefault(); abrirDetalhes(c.dataset.id);
    });
    [modalDetalhes, modalCadastro].forEach(function (m) {
      m.addEventListener('click', function (ev) {
        if (ev.target.closest('[data-fechar]')) fecharModal(m);
      });
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (!modalCadastro.hidden) fecharModal(modalCadastro);
      else if (!modalDetalhes.hidden) fecharModal(modalDetalhes);
    });
  }

  /* ---------- início ---------- */
  function iniciar() {
    try { var v = localStorage.getItem(CHAVE_VISUAL); if (v === 'lista' || v === 'grade') estado.visual = v; } catch (e) { /* ignora */ }
    estado.personalizados = carregarPersonalizados();
    ligarEventos();
    carregarDados().then(function () {
      elErro.hidden = true;
      atualizarTudo();
    }).catch(function (e) {
      mostrarErroCarregamento(e);
      atualizarTudo();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();