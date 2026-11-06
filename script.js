
/* ALIEN RPG — Banco de Itens e Aliens */
(() => {
'use strict';

const $ = id => document.getElementById(id);

const norm = s => String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[c]));

const KEYS = {
    items: 'alienitens.personalizados.v1',
    aliens: 'alienitens.aliens.personalizados.v1',
    favs: 'alienitens.favoritos.v1',
    cols: 'alienitens.colecoes.v1',
    view: 'alienitens.visualizacao.v1'
};

const read = k => {
    try {
        return JSON.parse(localStorage.getItem(k) || '[]');
    } catch {
        return [];
    }
};

const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const toast = (m, bad = false) => {
    const t = $('toast');
    t.textContent = m;
    t.className = 'toast' + (bad ? ' erro' : '');
    t.hidden = false;

    clearTimeout(window.__toastTimer);

    window.__toastTimer = setTimeout(() => {
        t.hidden = true;
    }, 3200);
};

const open = id => {
    $(id).hidden = false;
    document.body.classList.add('modal-aberto');
};

const close = m => {
    m.hidden = true;

    if (!document.querySelector('.modal:not([hidden])')) {
        document.body.classList.remove('modal-aberto');
    }
};

let itemsOriginal = [];
let itemsUser = read(KEYS.items);

let aliensBase = [];
let aliensUser = read(KEYS.aliens);

let favorites = new Set(read(KEYS.favs));
let collections = read(KEYS.cols);

let showFavorites = false;
let activeAlienGroup = '';

const el = (tag, cls, txt) => {
    const n = document.createElement(tag);

    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;

    return n;
};

const parseAttrs = s => {
    const o = {};

    String(s || '').split('\n').forEach(line => {
        const p = line.indexOf(':');

        if (p > 0) {
            o[line.slice(0, p).trim()] =
                line.slice(p + 1).trim();
        }
    });

    return o;
};


/* =========================================
   CARREGAMENTO DOS DADOS
========================================= */

async function loadItems() {
    try {
        const r = await fetch('dados/itens.json');
        const j = await r.json();

        itemsOriginal = Array.isArray(j)
            ? j
            : (j.itens || []);

    } catch {
        itemsOriginal = [];
        toast('Não foi possível carregar os itens.', true);
    }
}

async function loadAliens() {
    try {
        const r = await fetch('dados/aliens.json');
        aliensBase = await r.json();

    } catch {
        aliensBase = [];
        toast('Não foi possível carregar os aliens.', true);
    }
}

function fillSelect(id, label, values) {
    const s = $(id);
    const old = s.value;

    s.innerHTML = `<option value="">${label}</option>`;

    [...new Set(values.filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'pt-BR'))
        .forEach(v => s.add(new Option(v, v)));

    s.value = [...s.options].some(o => o.value === old)
        ? old
        : '';
}

const allItems = () => itemsOriginal.concat(
    itemsUser.map(x => ({ ...x, personalizado: true }))
);


/* =========================================
   FORMATAÇÃO DAS ESTATÍSTICAS DOS ALIENS
========================================= */

function formatarEstatisticasAlien(texto) {
    if (!texto || !String(texto).trim()) {
        return '<p>Estatísticas não informadas.</p>';
    }

    /*
       Separa títulos de variações que aparecem
       depois de um ponto, como "Abraçador Real:".
    */

    const textoSeparado = String(texto).replace(
        /\.\s*([^.;:]+):\s*/g,
        ';§GRUPO§$1: '
    );

    const partes = textoSeparado
        .split(/[;；]/)
        .map(p => p.trim())
        .filter(Boolean);

    let html = '';
    let grupoAberto = false;

    partes.forEach(parte => {

        const grupo = parte.match(/^§GRUPO§(.+):\s*(.*)$/);

        if (grupo) {
            if (grupoAberto) {
                html += '</div>';
            }

            html += `
                <div class="estatisticas-grupo">
                    <h4>${esc(grupo[1])}</h4>
            `;

            grupoAberto = true;

            if (grupo[2]) {
                html += `
                    <div class="estatistica-alien-linha">
                        ${esc(grupo[2])}
                    </div>
                `;
            }

            return;
        }

        html += `
            <div class="estatistica-alien-linha">
                ${esc(parte)}
            </div>
        `;
    });

    if (grupoAberto) {
        html += '</div>';
    }

    return html;
}


/* =========================================
   CATÁLOGO DE ITENS
========================================= */

function renderItems() {
    const q = norm($('busca-itens').value);
    const cat = $('filtro-categoria').value;
    const typ = $('filtro-tipo').value;
    const rar = $('filtro-raridade').value;
    const ord = $('ordenacao').value;

    const all = allItems();

    fillSelect(
        'filtro-categoria',
        'Todas as categorias',
        all.map(x => x.categoria)
    );

    fillSelect(
        'filtro-tipo',
        'Todos os tipos',
        all.map(x => x.tipo)
    );

    fillSelect(
        'filtro-raridade',
        'Todas as raridades',
        all.map(x => x.raridade)
    );

    $('grupo-raridade').hidden =
        !all.some(x => x.raridade);

    const cats = [
        ...new Set(all.map(x => x.categoria).filter(Boolean))
    ];

    $('rapidos-itens').innerHTML = '';

    [['', 'Todas'], ...cats.map(c => [c, c])]
        .forEach(([v, l]) => {
            const b = el(
                'button',
                'chip' + (cat === v ? ' ativo' : ''),
                l
            );

            b.onclick = () => {
                $('filtro-categoria').value = v;
                renderItems();
            };

            $('rapidos-itens').append(b);
        });

    let list = all.filter(x =>
        (!cat || x.categoria === cat) &&
        (!typ || x.tipo === typ) &&
        (!rar || x.raridade === rar) &&
        (!q || norm([
            x.nome,
            x.categoria,
            x.tipo,
            x.fabricante,
            x.descricao,
            (x.tags || []).join(' ')
        ].join(' ')).includes(q))
    );

    list.sort((a, b) =>
        ord === 'nome-desc'
            ? b.nome.localeCompare(a.nome, 'pt-BR')
            : ord === 'categoria'
                ? (a.categoria || '').localeCompare(
                    b.categoria || '',
                    'pt-BR'
                ) || a.nome.localeCompare(b.nome, 'pt-BR')
                : a.nome.localeCompare(b.nome, 'pt-BR')
    );

    $('stat-total').textContent = all.length;
    $('stat-resultados').textContent = list.length;
    $('stat-categorias').textContent = cats.length;

    $('contagem-itens').textContent =
        `${list.length} de ${all.length} itens exibidos`;

    $('sem-itens').hidden = !!list.length;

    const grid = $('resultados-itens');

    grid.innerHTML = '';

    /*
       LISTA E GRADE:
       A classe visual e a cor dos botões agora
       são atualizadas juntas.
    */

    const visualizacao =
        localStorage.getItem(KEYS.view) || 'grade';

    grid.className =
        'resultados ' +
        (visualizacao === 'lista'
            ? 'modo-lista'
            : 'modo-grade');

    $('btn-lista').setAttribute(
        'aria-pressed',
        visualizacao === 'lista' ? 'true' : 'false'
    );

    $('btn-grade').setAttribute(
        'aria-pressed',
        visualizacao === 'grade' ? 'true' : 'false'
    );

    list.forEach(x => {
        const c = el('article', 'cartao');

        c.tabIndex = 0;

        c.innerHTML = `
            <h3 class="cartao-nome">
                ${esc(x.nome)}
            </h3>

            <div class="cartao-meta">
                <span class="selo selo-categoria">
                    ${esc(x.categoria || '')}
                </span>

                ${x.tipo
                    ? `<span class="selo">${esc(x.tipo)}</span>`
                    : ''
                }

                ${x.personalizado
                    ? '<span class="selo selo-personalizado">Personalizado</span>'
                    : ''
                }
            </div>

            <p class="cartao-descricao">
                ${esc(x.descricao || 'Descrição não informada.')}
            </p>

            <span class="cartao-indicador">
                Ver detalhes
            </span>
        `;

        c.onclick = () => detailsItem(x);

        c.onkeydown = e => {
            if (e.key === 'Enter') detailsItem(x);
        };

        grid.append(c);
    });
}


/* =========================================
   CATÁLOGO DE ALIENS
========================================= */

function renderAliens() {
    const q = norm($('busca-aliens').value);
    const sp = $('filtro-especie').value;
    const ph = $('filtro-fase').value;
    const cl = $('filtro-classificacao').value;
    const ord = $('ordenacao-aliens').value;

    const all = aliensBase.concat(
        aliensUser.map(x => ({ ...x, personalizado: true }))
    );

    fillSelect(
        'filtro-especie',
        'Todas as espécies',
        all.map(x => x.especie)
    );

    fillSelect(
        'filtro-fase',
        'Todas as fases',
        all.map(x => x.fase)
    );

    fillSelect(
        'filtro-classificacao',
        'Todas as classificações',
        all.map(x => x.classificacao)
    );

    const groups = [
        ...new Set(all.map(x => x.grupo || x.especie).filter(Boolean))
    ];

    $('rapidos-aliens').innerHTML = '';

    [['', 'Todos'], ...groups.map(x => [x, x])]
        .forEach(([v, l]) => {
            const b = el(
                'button',
                'chip' + (activeAlienGroup === v ? ' ativo' : ''),
                l
            );

            b.onclick = () => {
                activeAlienGroup = v;
                renderAliens();
            };

            $('rapidos-aliens').append(b);
        });

    let list = all.filter(x =>
        (!sp || x.especie === sp) &&
        (!activeAlienGroup ||
            (x.grupo || x.especie) === activeAlienGroup) &&
        (!ph || x.fase === ph) &&
        (!cl || x.classificacao === cl) &&
        (!showFavorites || favorites.has(String(x.id))) &&
        (!q || norm([
            x.nome,
            x.especie,
            x.fase,
            x.classificacao,
            x.descricao,
            x.caracteristicas
        ].join(' ')).includes(q))
    );

    list.sort((a, b) =>
        ord === 'nome-desc'
            ? b.nome.localeCompare(a.nome, 'pt-BR')
            : ord === 'especie'
                ? (a.especie || '').localeCompare(
                    b.especie || '',
                    'pt-BR'
                ) || a.nome.localeCompare(b.nome, 'pt-BR')
                : a.nome.localeCompare(b.nome, 'pt-BR')
    );

    $('alien-total').textContent = all.length;
    $('alien-resultados').textContent = list.length;
    $('alien-especies').textContent = groups.length;

    $('contagem-aliens').textContent =
        `${list.length} de ${all.length} criaturas exibidas`;

    $('sem-aliens').hidden = !!list.length;

    const grid = $('resultados-aliens');

    grid.innerHTML = '';

    list.forEach(x => {
        const c = el('article', 'cartao');

        c.tabIndex = 0;

        const image = x.imagem_url
            ? `<img class="alien-thumb" src="${esc(x.imagem_url)}" alt="">`
            : '<div class="alien-placeholder">IMAGEM NÃO CADASTRADA</div>';

        c.innerHTML = `
            ${image}

            <h3 class="cartao-nome">
                ${esc(x.nome)}
            </h3>

            <div class="cartao-meta">
                <span class="selo selo-categoria">
                    ${esc(x.especie || 'Sem espécie')}
                </span>

                ${x.fase
                    ? `<span class="selo">${esc(x.fase)}</span>`
                    : ''
                }

                ${x.personalizado
                    ? '<span class="selo selo-personalizado">Personalizado</span>'
                    : ''
                }
            </div>

            <p class="cartao-descricao">
                ${esc(x.descricao || 'Descrição não informada.')}
            </p>

            <span class="cartao-indicador">
                Ver detalhes
            </span>
        `;

        c.onclick = () => detailsAlien(x);

        c.onkeydown = e => {
            if (e.key === 'Enter') detailsAlien(x);
        };

        grid.append(c);
    });
}


/* =========================================
   ABAS DOS DETALHES
========================================= */

function tabs(b) {
    b.querySelectorAll('[data-pane]').forEach(t => {
        t.onclick = () => {

            b.querySelectorAll('.aba-detalhe')
                .forEach(z => {
                    z.classList.toggle('ativa', z === t);
                });

            b.querySelectorAll('.pane-detalhe')
                .forEach(p => {
                    p.hidden =
                        p.id !== 'pane-' + t.dataset.pane;
                });
        };
    });
}


/* =========================================
   DETALHES DOS ITENS
========================================= */

function detailsItem(x) {
    const b = $('detalhes-corpo');

    b.innerHTML = `
        <h2 class="detalhes-nome">
            ${esc(x.nome)}
        </h2>

        <div class="detalhes-meta">
            <span class="selo selo-categoria">
                ${esc(x.categoria || '')}
            </span>

            ${x.tipo
                ? `<span class="selo">${esc(x.tipo)}</span>`
                : ''
            }
        </div>

        ${x.fabricante
            ? `<p><b>Fabricante:</b> ${esc(x.fabricante)}</p>`
            : ''
        }

        <div class="detalhe-tabs">
            <button class="aba-detalhe ativa" data-pane="desc">
                Descrição
            </button>

            <button class="aba-detalhe" data-pane="stats">
                Características
            </button>

            <button class="aba-detalhe" data-pane="obs">
                Observações
            </button>
        </div>

        <div class="pane-detalhe" id="pane-desc">
            ${esc(x.descricao || 'Descrição não informada.')}
        </div>

        <div class="pane-detalhe" id="pane-stats" hidden>
            ${
                Object.entries(x.atributos || {})
                    .map(([k, v]) =>
                        `<p><b>${esc(k)}:</b> ${esc(v)}</p>`
                    ).join('')
                || 'Nenhuma característica cadastrada.'
            }
        </div>

        <div class="pane-detalhe" id="pane-obs" hidden>
            ${esc(x.observacao || x.fonte || 'Sem observações.')}
        </div>

        ${x.personalizado
            ? '<button class="botao botao-perigo" id="excluir-item">Excluir item</button>'
            : ''
        }
    `;

    tabs(b);

    if (x.personalizado) {
        $('excluir-item').onclick = () => deleteItem(x.id);
    }

    open('modal-detalhes');
}


/* =========================================
   DETALHES DOS ALIENS
========================================= */

function detailsAlien(x) {
    const b = $('detalhes-corpo');
    const fav = favorites.has(String(x.id));

    const imagem = x.imagem_url
        ? `
            <img
                class="alien-detail-image"
                src="${esc(x.imagem_url)}"
                alt="${esc(x.nome)}"
            >
        `
        : `
            <div class="alien-detail-placeholder">
                <span>IMAGEM NÃO CADASTRADA</span>
            </div>
        `;

    const caracteristicas = x.caracteristicas
        ? `
            <div class="alien-caracteristicas">
                ${esc(x.caracteristicas)}
            </div>
        `
        : '<p>Características não cadastradas.</p>';

    const estatisticas = formatarEstatisticasAlien(
        x.estatisticas
    );

    b.innerHTML = `
        ${imagem}

        <h2 class="detalhes-nome">
            ${esc(x.nome)}
        </h2>

        <div class="detalhes-meta">
            <span class="selo selo-categoria">
                ${esc(x.especie || '')}
            </span>

            ${x.fase
                ? `<span class="selo">${esc(x.fase)}</span>`
                : ''
            }

            ${x.classificacao
                ? `<span class="selo">${esc(x.classificacao)}</span>`
                : ''
            }
        </div>

        <div class="detalhe-tabs">
            <button class="aba-detalhe ativa" data-pane="desc">
                Descrição
            </button>

            <button class="aba-detalhe" data-pane="car">
                Características
            </button>

            <button class="aba-detalhe" data-pane="stats">
                Estatísticas
            </button>

            <button class="aba-detalhe" data-pane="obs">
                Observações
            </button>
        </div>

        <div class="pane-detalhe" id="pane-desc">
            ${esc(x.descricao || 'Sem descrição.')}
        </div>

        <div class="pane-detalhe" id="pane-car" hidden>
            ${caracteristicas}
        </div>

        <div class="pane-detalhe" id="pane-stats" hidden>
            <div class="alien-estatisticas">
                ${estatisticas}
            </div>
        </div>

        <div class="pane-detalhe" id="pane-obs" hidden>
            ${esc(x.observacoes || x.fonte || 'Sem observações.')}
        </div>

        <div class="detalhes-rodape">

            <button class="botao" id="btn-fav-alien">
                ${fav
                    ? '★ Remover favorito'
                    : '☆ Adicionar favorito'
                }
            </button>

            ${x.personalizado
                ? `
                    <button class="botao botao-perigo" id="excluir-alien">
                        Excluir alien
                    </button>
                `
                : ''
            }

            <button class="botao" id="btn-add-colecao">
                Adicionar a uma coleção
            </button>

        </div>
    `;

    tabs(b);

    $('btn-fav-alien').onclick = () => toggleFavorite(x);

    $('btn-add-colecao').onclick = () => addAlienToCollection(x);

    if (x.personalizado) {
        $('excluir-alien').onclick = () => deleteAlien(x.id);
    }

    open('modal-detalhes');
}


/* =========================================
   CADASTRO DE ITENS
========================================= */

function saveItem(e) {
    e.preventDefault();

    const name = $('item-nome').value.trim();

    if (name.length < 2) {
        return showError(
            'item-erro',
            'Informe um nome com pelo menos 2 caracteres.'
        );
    }

    itemsUser.push({
        id: crypto.randomUUID(),
        nome: name,
        categoria: $('item-categoria').value.trim() || 'Personalizados',
        tipo: $('item-tipo').value.trim(),
        fabricante: $('item-fabricante').value.trim(),
        descricao: $('item-descricao').value.trim(),
        atributos: parseAttrs($('item-atributos').value),
        observacao: $('item-observacao').value.trim()
    });

    write(KEYS.items, itemsUser);

    close($('modal-item'));
    $('form-item').reset();

    renderItems();

    toast('Item salvo neste navegador.');
}

function showError(id, msg) {
    $(id).textContent = msg;
    $(id).hidden = false;
}


/* =========================================
   CADASTRO DE ALIENS
========================================= */

function saveAlien(e) {
    e.preventDefault();

    const file = $('alien-imagem').files[0];

    if (file && file.size > 1.5 * 1024 * 1024) {
        return showError(
            'alien-erro',
            'A imagem deve ter no máximo 1,5 MB para não ocupar muito armazenamento.'
        );
    }

    const payload = {
        id: crypto.randomUUID(),
        nome: $('alien-nome').value.trim(),
        especie: $('alien-especie').value.trim(),
        fase: $('alien-fase').value.trim(),
        classificacao: $('alien-classificacao').value.trim(),
        imagem_url: null,
        descricao: $('alien-descricao').value.trim(),
        caracteristicas: $('alien-caracteristicas').value.trim(),
        estatisticas: $('alien-estatisticas').value.trim(),
        observacoes: $('alien-observacoes').value.trim()
    };

    if (payload.nome.length < 2) {
        return showError(
            'alien-erro',
            'Informe um nome com pelo menos 2 caracteres.'
        );
    }

    const finish = data => {
        aliensUser.push({
            ...payload,
            imagem_url: data || null
        });

        try {
            write(KEYS.aliens, aliensUser);
        } catch {
            aliensUser.pop();

            return showError(
                'alien-erro',
                'Armazenamento cheio. Tente uma imagem menor.'
            );
        }

        close($('modal-alien'));

        $('form-alien').reset();

        renderAliens();

        toast('Alien salvo neste navegador.');
    };

    if (file) {
        const reader = new FileReader();

        reader.onload = () => finish(reader.result);

        reader.onerror = () => {
            showError(
                'alien-erro',
                'Não foi possível ler a imagem.'
            );
        };

        reader.readAsDataURL(file);

    } else {
        finish(null);
    }
}


/* =========================================
   EXCLUSÃO
========================================= */

function deleteItem(id) {
    if (!confirm('Excluir este item personalizado?')) return;

    itemsUser = itemsUser.filter(x => x.id !== id);

    write(KEYS.items, itemsUser);

    close($('modal-detalhes'));

    renderItems();

    toast('Item excluído.');
}

function deleteAlien(id) {
    if (!confirm('Excluir este alien personalizado?')) return;

    aliensUser = aliensUser.filter(x => x.id !== id);

    write(KEYS.aliens, aliensUser);

    favorites.delete(String(id));

    write(KEYS.favs, [...favorites]);

    collections = collections.map(c => ({
        ...c,
        alienIds: (c.alienIds || []).filter(v => v !== id)
    }));

    write(KEYS.cols, collections);

    close($('modal-detalhes'));

    renderAliens();

    toast('Alien excluído.');
}


/* =========================================
   FAVORITOS
========================================= */

function toggleFavorite(x) {
    const id = String(x.id);

    favorites.has(id)
        ? favorites.delete(id)
        : favorites.add(id);

    write(KEYS.favs, [...favorites]);

    detailsAlien(x);

    renderAliens();
}


/* =========================================
   COLEÇÕES
========================================= */

function addAlienToCollection(x) {
    if (!collections.length) {
        openCollections();
        toast('Crie uma coleção primeiro.');
        return;
    }

    const opts = $('lista-colecoes');

    opts.innerHTML = collections.map(c => `
        <div class="colecao-linha">
            <button class="botao" data-add-to="${esc(c.id)}">
                ${esc(c.nome)}
            </button>
        </div>
    `).join('');

    opts.querySelectorAll('[data-add-to]').forEach(b => {
        b.onclick = () => {
            const c = collections.find(
                z => z.id === b.dataset.addTo
            );

            if (!c.alienIds.includes(x.id)) {
                c.alienIds.push(x.id);
            }

            write(KEYS.cols, collections);

            close($('modal-colecoes'));

            toast('Alien adicionado à coleção ' + c.nome + '.');
        };
    });

    open('modal-colecoes');
}

function openCollections() {
    renderCollections();
    open('modal-colecoes');
}

function renderCollections() {
    $('lista-colecoes').innerHTML = collections.map(c => `
        <div class="colecao-linha">
            <button class="botao" data-view-collection="${esc(c.id)}">
                ${esc(c.nome)} (${(c.alienIds || []).length})
            </button>

            <button class="botao botao-perigo" data-del-collection="${esc(c.id)}">
                Excluir
            </button>
        </div>
    `).join('') || '<p class="texto-suave">Você ainda não criou coleções.</p>';
}

function createCollection(e) {
    e.preventDefault();

    const nome = $('colecao-nome').value.trim();

    if (!nome) return;

    collections.push({
        id: crypto.randomUUID(),
        nome,
        alienIds: []
    });

    write(KEYS.cols, collections);

    $('colecao-nome').value = '';

    renderCollections();

    toast('Coleção criada.');
}


/* =========================================
   NAVEGAÇÃO
========================================= */

function switchTab(tab) {
    document.querySelectorAll('.aba[data-aba]')
        .forEach(b => {
            b.classList.toggle('ativa', b.dataset.aba === tab);
        });

    $('pagina-itens').hidden = tab !== 'itens';
    $('pagina-aliens').hidden = tab !== 'aliens';

    $('btn-adicionar-item').hidden = tab !== 'itens';
    $('btn-adicionar-alien').hidden = tab !== 'aliens';
}


/* =========================================
   EVENTOS
========================================= */

function bind() {

    document.querySelectorAll('[data-aba]').forEach(b => {
        b.onclick = () => switchTab(b.dataset.aba);
    });

    $('btn-adicionar-item').onclick = () => {
        $('form-item').reset();
        $('item-erro').hidden = true;
        open('modal-item');
    };

    $('btn-adicionar-alien').onclick = () => {
        $('form-alien').reset();
        $('alien-erro').hidden = true;
        open('modal-alien');
    };

    $('form-item').onsubmit = saveItem;
    $('form-alien').onsubmit = saveAlien;

    $('btn-limpar-itens').onclick = () => {
        [
            'busca-itens',
            'filtro-categoria',
            'filtro-tipo',
            'filtro-raridade'
        ].forEach(id => $(id).value = '');

        $('ordenacao').value = 'nome-asc';

        renderItems();
    };

    $('btn-limpar-aliens').onclick = () => {
        [
            'busca-aliens',
            'filtro-especie',
            'filtro-fase',
            'filtro-classificacao'
        ].forEach(id => $(id).value = '');

        $('ordenacao-aliens').value = 'nome-asc';

        showFavorites = false;
        activeAlienGroup = '';

        $('btn-favoritos').classList.remove('ativo');

        renderAliens();
    };

    [
        'busca-itens',
        'filtro-categoria',
        'filtro-tipo',
        'filtro-raridade',
        'ordenacao'
    ].forEach(id => {
        $(id).addEventListener(
            id === 'busca-itens' ? 'input' : 'change',
            renderItems
        );
    });

    [
        'busca-aliens',
        'filtro-especie',
        'filtro-fase',
        'filtro-classificacao',
        'ordenacao-aliens'
    ].forEach(id => {
        $(id).addEventListener(
            id === 'busca-aliens' ? 'input' : 'change',
            () => {
                if (id === 'filtro-especie') {
                    activeAlienGroup = '';
                }

                renderAliens();
            }
        );
    });

    $('btn-grade').onclick = () => {
        localStorage.setItem(KEYS.view, 'grade');
        renderItems();
    };

    $('btn-lista').onclick = () => {
        localStorage.setItem(KEYS.view, 'lista');
        renderItems();
    };

    $('btn-favoritos').onclick = () => {
        showFavorites = !showFavorites;

        $('btn-favoritos').classList.toggle(
            'ativo',
            showFavorites
        );

        renderAliens();
    };

    $('btn-minhas-colecoes').onclick = openCollections;

    $('form-colecao').onsubmit = createCollection;

    $('lista-colecoes').onclick = e => {

        const view = e.target.closest('[data-view-collection]');

        if (view) {
            const c = collections.find(
                z => z.id === view.dataset.viewCollection
            );

            const ids = c?.alienIds || [];

            const names = ids.map(id =>
                [...aliensBase, ...aliensUser]
                    .find(a => String(a.id) === String(id))
                    ?.nome
            ).filter(Boolean);

            alert(
                names.length
                    ? 'Criaturas nesta coleção:\n\n' + names.join('\n')
                    : 'Esta coleção ainda está vazia.'
            );

            return;
        }

        const b = e.target.closest('[data-del-collection]');

        if (b && confirm('Excluir esta coleção?')) {
            collections = collections.filter(
                c => c.id !== b.dataset.delCollection
            );

            write(KEYS.cols, collections);

            renderCollections();
        }
    };

    document.querySelectorAll('.modal').forEach(m => {
        m.addEventListener('click', e => {
            if (e.target.closest('[data-fechar]')) {
                close(m);
            }
        });
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal:not([hidden])')
                .forEach(close);
        }
    });
}


/* =========================================
   INICIALIZAÇÃO
========================================= */

async function start() {
    bind();

    await Promise.all([
        loadItems(),
        loadAliens()
    ]);

    renderItems();
    renderAliens();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
} else {
    start();
}

})();
