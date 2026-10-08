/**
 * JUJUTSU KAISEN - Explorador de Personajes y Técnicas Malditas
 * Consume la API: https://data.jujutsukaisenapi.site/api/v1/characters
 */

// ==================== ESTADO DE LA APLICACIÓN ====================
const state = {
  apiUrl: 'https://data.jujutsukaisenapi.site/api/v1/characters',
  currentPage: 1,
  totalPages: 15,
  totalCharacters: 283,
  perPage: 20,
  
  // Caché de páginas ya descargadas para navegación instantánea
  pageCache: new Map(),
  
  // Personajes actualmente disponibles
  currentCharacters: [],
  
  // Modo global (todos los 283 personajes cargados para búsqueda simultánea)
  isGlobalMode: false,
  allCharacters: [],
  isLoadingGlobal: false,
  
  // Filtros aplicados
  filters: {
    search: '',
    status: 'all',
    grade: 'all',
    species: 'all',
    sort: 'id-asc'
  },
  
  // Personaje activo en el modal
  selectedCharacter: null
};

// ==================== ELEMENTOS DEL DOM ====================
const DOM = {
  // Contenedores principales
  grid: document.getElementById('characters-grid'),
  loadingState: document.getElementById('loading-state'),
  errorState: document.getElementById('error-state'),
  errorMessage: document.getElementById('error-message'),
  emptyState: document.getElementById('empty-state'),
  retryBtn: document.getElementById('retry-btn'),
  emptyResetBtn: document.getElementById('empty-reset-btn'),

  // Filtros y búsqueda
  searchInput: document.getElementById('search-input'),
  clearSearchBtn: document.getElementById('clear-search-btn'),
  statusFilter: document.getElementById('status-filter'),
  gradeFilter: document.getElementById('grade-filter'),
  speciesFilter: document.getElementById('species-filter'),
  sortFilter: document.getElementById('sort-filter'),
  activeFiltersBar: document.getElementById('active-filters-bar'),
  activeTagsContainer: document.getElementById('active-tags-container'),
  resetFiltersBtn: document.getElementById('reset-filters-btn'),

  // Botón de búsqueda global
  fetchAllToggleBtn: document.getElementById('fetch-all-toggle-btn'),
  fetchAllText: document.getElementById('fetch-all-text'),

  // Badges y contadores
  totalBadge: document.getElementById('total-characters-badge'),
  visibleCount: document.getElementById('visible-count'),
  pageIndicatorText: document.getElementById('page-indicator-text'),

  // Paginadores
  topPagination: document.getElementById('top-pagination'),
  bottomPaginationWrapper: document.getElementById('bottom-pagination-wrapper'),
  paginationInfo: document.getElementById('pagination-info'),
  paginationControls: document.getElementById('pagination-controls'),

  // Modal
  modal: document.getElementById('character-modal'),
  modalBox: document.getElementById('modal-box'),
  modalTitle: document.getElementById('modal-title'),
  modalContent: document.getElementById('modal-content'),
  closeModalBtn: document.getElementById('close-modal-btn')
};

// ==================== UTILIDADES ====================

/**
 * Escapa strings HTML para prevenir XSS
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Devuelve un avatar SVG por defecto cuando no hay imagen disponible
 */
function getPlaceholderAvatarSvg() {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400" fill="%230f111a"><rect width="300" height="400" fill="%230f111a"/><circle cx="150" cy="150" r="60" fill="%231f2438"/><path d="M70,330 C70,240 230,240 230,330" fill="%231f2438"/><text x="150" y="370" font-family="sans-serif" font-size="16" fill="%23e11d48" text-anchor="middle" font-weight="bold">JUJUTSU</text></svg>`;
}

/**
 * Normaliza nombres para comparaciones flexibles
 */
function normalizeText(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Genera el badge HTML para el estado de vida
 */
function renderStatusBadge(status) {
  const statusName = typeof status === 'object' && status !== null ? status.name : status;
  if (!statusName) return '';

  if (statusName.toLowerCase() === 'alive') {
    return `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        Vivo
      </span>
    `;
  } else if (statusName.toLowerCase() === 'dead') {
    return `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-400">
        <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
        Fallecido
      </span>
    `;
  }
  return `
    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
      ${escapeHtml(statusName)}
    </span>
  `;
}

/**
 * Genera el badge HTML para el grado de hechicero
 */
function renderGradeBadge(grade) {
  const gradeName = typeof grade === 'object' && grade !== null ? grade.name : grade;
  if (!gradeName) return '';

  if (gradeName.toLowerCase().includes('special')) {
    return `
      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-500/40 text-amber-300 shadow-sm">
        <svg class="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
        ${escapeHtml(gradeName)}
      </span>
    `;
  }
  return `
    <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-500/10 border border-purple-500/30 text-purple-300">
      ${escapeHtml(gradeName)}
    </span>
  `;
}

// ==================== SKELETONS DE CARGA ====================

function showSkeletons() {
  DOM.loadingState.innerHTML = '';
  DOM.loadingState.classList.remove('hidden');
  DOM.grid.classList.add('hidden');
  DOM.emptyState.classList.add('hidden');
  DOM.errorState.classList.add('hidden');

  const skeletonCount = 8;
  for (let i = 0; i < skeletonCount; i++) {
    const card = document.createElement('div');
    card.className = 'bg-jjk-card border border-jjk-border/60 rounded-2xl overflow-hidden animate-pulse flex flex-col';
    card.innerHTML = `
      <div class="w-full aspect-[3/4] bg-zinc-800/60"></div>
      <div class="p-4 space-y-3 flex-1 flex flex-col justify-between">
        <div class="space-y-2">
          <div class="h-4 bg-zinc-800 rounded w-3/4"></div>
          <div class="h-3 bg-zinc-800/60 rounded w-1/2"></div>
        </div>
        <div class="flex gap-2">
          <div class="h-5 bg-zinc-800 rounded-full w-14"></div>
          <div class="h-5 bg-zinc-800 rounded-full w-16"></div>
        </div>
        <div class="h-9 bg-zinc-800/80 rounded-xl w-full mt-2"></div>
      </div>
    `;
    DOM.loadingState.appendChild(card);
  }
}

function hideSkeletons() {
  DOM.loadingState.classList.add('hidden');
  DOM.grid.classList.remove('hidden');
}

// ==================== PETICIONES A LA API ====================

/**
 * Carga una página específica de la API
 */
async function loadPage(pageNumber = 1) {
  showSkeletons();
  
  // Si ya tenemos la página en caché y no estamos forzando búsqueda global
  if (state.pageCache.has(pageNumber) && !state.isGlobalMode) {
    state.currentPage = pageNumber;
    state.currentCharacters = state.pageCache.get(pageNumber);
    hideSkeletons();
    applyFilters();
    updatePaginationControls();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  try {
    const url = `${state.apiUrl}?page=${pageNumber}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    
    // Almacenar metadatos si vienen de la API
    if (json.meta) {
      state.currentPage = json.meta.current_page || pageNumber;
      state.totalPages = json.meta.last_page || state.totalPages;
      state.totalCharacters = json.meta.total || state.totalCharacters;
      state.perPage = json.meta.per_page || 20;
    }

    const characters = Array.isArray(json.data) ? json.data : [];
    state.pageCache.set(pageNumber, characters);
    state.currentCharacters = characters;

    // Actualizar badge de total en header
    DOM.totalBadge.textContent = `${state.totalCharacters} Hechiceros en total`;

    hideSkeletons();
    applyFilters();
    updatePaginationControls();

    // Scroll suave arriba al cambiar de página
    if (pageNumber !== 1) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

  } catch (error) {
    console.error('Error al obtener datos de la API:', error);
    DOM.loadingState.classList.add('hidden');
    DOM.grid.classList.add('hidden');
    DOM.emptyState.classList.add('hidden');
    DOM.errorState.classList.remove('hidden');
    DOM.errorMessage.textContent = error.message || 'No se pudo conectar con el servidor de la API.';
  }
}

/**
 * Carga todos los personajes de las 15 páginas para habilitar búsqueda global
 */
async function loadAllCharacters() {
  if (state.isLoadingGlobal) return;
  state.isLoadingGlobal = true;
  DOM.fetchAllToggleBtn.disabled = true;

  const totalPagesToFetch = state.totalPages || 15;
  let loadedCount = 0;
  
  DOM.fetchAllText.textContent = `Descargando (0/${totalPagesToFetch})...`;

  try {
    const promises = [];
    for (let p = 1; p <= totalPagesToFetch; p++) {
      if (state.pageCache.has(p)) {
        promises.push(Promise.resolve(state.pageCache.get(p)));
        loadedCount++;
      } else {
        promises.push(
          fetch(`${state.apiUrl}?page=${p}`)
            .then(res => res.json())
            .then(data => {
              loadedCount++;
              DOM.fetchAllText.textContent = `Descargando (${loadedCount}/${totalPagesToFetch})...`;
              const items = data.data || [];
              state.pageCache.set(p, items);
              return items;
            })
            .catch(err => {
              console.warn(`Error al obtener página ${p}:`, err);
              return [];
            })
        );
      }
    }

    const results = await Promise.all(promises);
    state.allCharacters = results.flat();
    state.isGlobalMode = true;

    DOM.fetchAllText.textContent = `✓ Modo Global (${state.allCharacters.length} personajes)`;
    DOM.fetchAllToggleBtn.classList.remove('bg-purple-600/20', 'text-purple-300');
    DOM.fetchAllToggleBtn.classList.add('bg-emerald-600/20', 'text-emerald-300', 'border-emerald-500/40');

    // Desactivar paginador inferior en modo global
    DOM.bottomPaginationWrapper.classList.add('hidden');
    DOM.topPagination.classList.add('hidden');

    applyFilters();

  } catch (error) {
    console.error('Error cargando todos los personajes:', error);
    DOM.fetchAllText.textContent = 'Error al cargar todos';
  } finally {
    state.isLoadingGlobal = false;
    DOM.fetchAllToggleBtn.disabled = false;
  }
}

// ==================== FILTRADO Y ORDEN ====================

function applyFilters() {
  const sourceList = state.isGlobalMode ? state.allCharacters : state.currentCharacters;
  
  let filtered = sourceList.filter(char => {
    // 1. Filtro por término de búsqueda (nombre, alias, técnicas, afiliaciones)
    if (state.filters.search) {
      const q = normalizeText(state.filters.search);
      const nameMatch = normalizeText(char.name).includes(q);
      
      const aliasMatch = Array.isArray(char.alias) && char.alias.some(a => normalizeText(a).includes(q));
      
      const techMatch = Array.isArray(char.cursedTechniques) && char.cursedTechniques.some(t => {
        const tName = typeof t === 'object' ? t.technique_name : t;
        return normalizeText(tName).includes(q);
      });

      const affilMatch = Array.isArray(char.affiliations) && char.affiliations.some(a => {
        const aName = typeof a === 'object' ? a.affiliation_name : a;
        return normalizeText(aName).includes(q);
      });

      if (!nameMatch && !aliasMatch && !techMatch && !affilMatch) {
        return false;
      }
    }

    // 2. Filtro por estado (Alive, Dead, Unknown)
    if (state.filters.status !== 'all') {
      const charStatus = typeof char.status === 'object' && char.status ? char.status.name : char.status;
      if (!charStatus || charStatus.toLowerCase() !== state.filters.status.toLowerCase()) {
        return false;
      }
    }

    // 3. Filtro por Grado
    if (state.filters.grade !== 'all') {
      const charGrade = typeof char.grade === 'object' && char.grade ? char.grade.name : char.grade;
      if (!charGrade || !charGrade.toLowerCase().includes(state.filters.grade.toLowerCase())) {
        return false;
      }
    }

    // 4. Filtro por Especie
    if (state.filters.species !== 'all') {
      const charSpecies = typeof char.species === 'object' && char.species ? char.species.species_name : char.species;
      if (!charSpecies || !charSpecies.toLowerCase().includes(state.filters.species.toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  // Ordenamiento
  filtered.sort((a, b) => {
    switch (state.filters.sort) {
      case 'name-asc':
        return (a.name || '').localeCompare(b.name || '');
      case 'name-desc':
        return (b.name || '').localeCompare(a.name || '');
      case 'techniques-desc':
        return (b.cursedTechniques?.length || 0) - (a.cursedTechniques?.length || 0);
      case 'id-asc':
      default:
        return (a.id || 0) - (b.id || 0);
    }
  });

  // Renderizar tarjetas resultantes
  renderCards(filtered);
  updateActiveFiltersUI();
}

// ==================== RENDERIZADO DE TARJETAS ====================

function renderCards(characters) {
  DOM.grid.innerHTML = '';
  DOM.visibleCount.textContent = characters.length;

  if (characters.length === 0) {
    DOM.grid.classList.add('hidden');
    DOM.emptyState.classList.remove('hidden');
    return;
  }

  DOM.emptyState.classList.add('hidden');
  DOM.grid.classList.remove('hidden');

  characters.forEach(char => {
    const card = document.createElement('article');
    card.className = 'group bg-jjk-card hover:bg-jjk-cardHover border border-jjk-border hover:border-rose-500/50 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col hover:shadow-cursed-red hover:-translate-y-1 cursor-pointer';
    
    // Imagen con fallback
    const imageUrl = char.image || getPlaceholderAvatarSvg();
    const fallbackUrl = getPlaceholderAvatarSvg();

    // Subtítulo (primer alias o especie)
    const subtitle = (Array.isArray(char.alias) && char.alias.length > 0)
      ? `"${char.alias[0]}"`
      : (char.species?.species_name || 'Hechicero');

    // Tags de afiliación u ocupación
    let tagHtml = '';
    if (Array.isArray(char.affiliations) && char.affiliations.length > 0) {
      const aff = typeof char.affiliations[0] === 'object' ? char.affiliations[0].affiliation_name : char.affiliations[0];
      if (aff) {
        tagHtml = `<span class="inline-block truncate max-w-[170px] text-[11px] px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-300 border border-zinc-700/60">${escapeHtml(aff)}</span>`;
      }
    }

    // Indicador de Técnicas y Dominio
    const techCount = Array.isArray(char.cursedTechniques) ? char.cursedTechniques.length : 0;
    const hasDomain = char.domainExpansion && char.domainExpansion.name;

    card.innerHTML = `
      <!-- Contenedor Imagen -->
      <div class="relative w-full aspect-[4/5] bg-jjk-black overflow-hidden">
        <img 
          src="${escapeHtml(imageUrl)}" 
          alt="${escapeHtml(char.name)}" 
          loading="lazy"
          onerror="this.onerror=null; this.src='${fallbackUrl}';"
          class="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
        />
        
        <!-- Gradiente oscuro inferior sobre la imagen -->
        <div class="absolute inset-0 bg-gradient-to-t from-jjk-card via-transparent to-black/40"></div>

        <!-- Badges superiores -->
        <div class="absolute top-3 inset-x-3 flex items-start justify-between gap-1 pointer-events-none">
          <div>
            ${renderGradeBadge(char.grade)}
          </div>
          <div>
            ${renderStatusBadge(char.status)}
          </div>
        </div>

        <!-- Dominio indicador si existe -->
        ${hasDomain ? `
          <div class="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-950/80 border border-purple-500/40 text-[11px] font-bold text-purple-300 backdrop-blur-sm">
            <span class="font-kanji text-xs text-purple-400">界</span>
            <span>Expansión de Dominio</span>
          </div>
        ` : ''}
      </div>

      <!-- Contenido de la tarjeta -->
      <div class="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <div class="flex items-center justify-between gap-2">
            <h3 class="font-display font-bold text-lg text-white group-hover:text-rose-400 transition-colors truncate">
              ${escapeHtml(char.name)}
            </h3>
            <span class="text-xs font-mono text-zinc-500">#${char.id}</span>
          </div>
          <p class="text-xs text-zinc-400 truncate italic mt-0.5">${escapeHtml(subtitle)}</p>
        </div>

        <!-- Info secundaria / Tags -->
        <div class="flex items-center gap-2 flex-wrap">
          ${tagHtml}
          ${techCount > 0 ? `
            <span class="text-[11px] px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-300 font-medium flex items-center gap-1">
              <svg class="w-3 h-3 text-rose-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.316.492-.533 1.035-.672 1.579a7.994 7.994 0 00-.77 2.875c-.15 1.157.065 2.22.427 3.123A8.005 8.005 0 014.28 12.01c-.18.73-.28 1.492-.28 2.274 0 4.418 3.582 8 8 8s8-3.582 8-8c0-.782-.1-1.544-.28-2.274a8.005 8.005 0 01-3.69-4.898c.362-.903.577-1.966.427-3.123a7.994 7.994 0 00-.77-2.875 6.973 6.973 0 00-.822-.88 1 1 0 00-1.47.385l-.01.02a.853.853 0 01-.76.486.853.853 0 01-.76-.486l-.01-.02z" clip-rule="evenodd"></path></svg>
              ${techCount} ${techCount === 1 ? 'técnica' : 'técnicas'}
            </span>
          ` : ''}
        </div>

        <!-- Botón Ver Detalles -->
        <button class="w-full mt-2 py-2 px-3 rounded-xl bg-jjk-black/60 group-hover:bg-rose-600 border border-jjk-border group-hover:border-rose-500 text-xs font-semibold text-zinc-300 group-hover:text-white transition-all flex items-center justify-center gap-1.5 shadow-sm">
          <span>Ver ficha completa</span>
          <svg class="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </button>
      </div>
    `;

    // Click abre modal
    card.addEventListener('click', () => openModal(char));
    DOM.grid.appendChild(card);
  });
}

// ==================== MODAL DE DETALLES ====================

function openModal(char) {
  state.selectedCharacter = char;
  DOM.modalTitle.textContent = char.name || 'Detalles del Personaje';

  const imageUrl = char.image || getPlaceholderAvatarSvg();
  const fallbackUrl = getPlaceholderAvatarSvg();

  // Técnicas malditas
  let techniquesHtml = '';
  if (Array.isArray(char.cursedTechniques) && char.cursedTechniques.length > 0) {
    techniquesHtml = `
      <div class="space-y-3">
        <h4 class="font-display font-bold text-sm tracking-wide text-rose-400 flex items-center gap-2 border-b border-jjk-border pb-1">
          <svg class="w-4 h-4 text-rose-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.316.492-.533 1.035-.672 1.579a7.994 7.994 0 00-.77 2.875c-.15 1.157.065 2.22.427 3.123A8.005 8.005 0 014.28 12.01c-.18.73-.28 1.492-.28 2.274 0 4.418 3.582 8 8 8s8-3.582 8-8c0-.782-.1-1.544-.28-2.274a8.005 8.005 0 01-3.69-4.898c.362-.903.577-1.966.427-3.123a7.994 7.994 0 00-.77-2.875 6.973 6.973 0 00-.822-.88 1 1 0 00-1.47.385l-.01.02a.853.853 0 01-.76.486.853.853 0 01-.76-.486l-.01-.02z" clip-rule="evenodd"></path></svg>
          TÉCNICAS MALDITAS (${char.cursedTechniques.length})
        </h4>
        <div class="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto pr-1">
          ${char.cursedTechniques.map(tech => {
            const techName = typeof tech === 'object' ? tech.technique_name : tech;
            const techDesc = typeof tech === 'object' ? tech.description : '';
            const techType = typeof tech?.type === 'object' ? tech.type.name : tech?.type;
            const techRange = typeof tech?.range === 'object' ? tech.range.name : tech?.range;
            const techImg = tech?.image;

            return `
              <div class="p-3.5 rounded-xl bg-jjk-black/80 border border-jjk-border/80 hover:border-zinc-700 transition-colors space-y-2">
                <div class="flex items-start justify-between gap-2">
                  <h5 class="font-bold text-sm text-white">${escapeHtml(techName)}</h5>
                  <div class="flex gap-1 flex-wrap">
                    ${techType ? `<span class="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300">${escapeHtml(techType)}</span>` : ''}
                    ${techRange ? `<span class="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">${escapeHtml(techRange)}</span>` : ''}
                  </div>
                </div>
                ${techDesc ? `<p class="text-xs text-zinc-400 leading-relaxed">${escapeHtml(techDesc)}</p>` : ''}
                ${techImg ? `
                  <div class="mt-2 rounded-lg overflow-hidden border border-zinc-800 max-h-36">
                    <img src="${escapeHtml(techImg)}" alt="${escapeHtml(techName)}" class="w-full h-36 object-cover" onerror="this.style.display='none'">
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // Expansión de Dominio
  let domainHtml = '';
  if (char.domainExpansion && char.domainExpansion.name) {
    const dom = char.domainExpansion;
    domainHtml = `
      <div class="p-4 rounded-xl bg-gradient-to-br from-purple-950/40 to-jjk-black border border-purple-500/40 shadow-cursed-purple space-y-3">
        <div class="flex items-center gap-2">
          <span class="font-kanji text-purple-400 text-lg">領域展開</span>
          <h4 class="font-display font-bold text-sm tracking-wider text-purple-300">
            EXPANSIÓN DE DOMINIO: ${escapeHtml(dom.name)}
          </h4>
        </div>
        ${dom.description ? `<p class="text-xs text-purple-200/90 leading-relaxed">${escapeHtml(dom.description)}</p>` : ''}
        ${dom.image ? `
          <div class="rounded-lg overflow-hidden border border-purple-500/30 max-h-48">
            <img src="${escapeHtml(dom.image)}" alt="${escapeHtml(dom.name)}" class="w-full h-48 object-cover" onerror="this.style.display='none'">
          </div>
        ` : ''}
      </div>
    `;
  }

  // Afiliaciones y Ocupaciones
  const affils = Array.isArray(char.affiliations)
    ? char.affiliations.map(a => typeof a === 'object' ? a.affiliation_name : a).filter(Boolean)
    : [];

  const occupations = Array.isArray(char.occupations)
    ? char.occupations.map(o => typeof o === 'object' ? o.occupation_name : o).filter(Boolean)
    : [];

  const aliases = Array.isArray(char.alias) ? char.alias.filter(Boolean) : [];
  const relatives = Array.isArray(char.relatives) ? char.relatives.filter(Boolean) : [];

  // Inyectar cuerpo completo del modal
  DOM.modalContent.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
      
      <!-- Columna Izquierda: Retrato y Datos Físicos (5 cols) -->
      <div class="md:col-span-5 space-y-4">
        <div class="rounded-2xl overflow-hidden bg-jjk-black border border-jjk-border shadow-xl aspect-[3/4]">
          <img 
            src="${escapeHtml(imageUrl)}" 
            alt="${escapeHtml(char.name)}" 
            onerror="this.onerror=null; this.src='${fallbackUrl}';"
            class="w-full h-full object-cover object-top"
          />
        </div>

        <!-- Badges de estado en fila -->
        <div class="flex flex-wrap items-center gap-2">
          ${renderStatusBadge(char.status)}
          ${renderGradeBadge(char.grade)}
        </div>

        <!-- Ficha técnica básica -->
        <div class="p-4 rounded-xl bg-jjk-black/60 border border-jjk-border space-y-2.5 text-xs">
          <h5 class="font-bold text-zinc-300 border-b border-jjk-border pb-1">Datos Biográficos</h5>
          <div class="grid grid-cols-2 gap-2 text-zinc-400">
            <div><span class="text-zinc-500">Especie:</span> <span class="text-zinc-200 font-medium">${escapeHtml(char.species?.species_name || 'Desconocido')}</span></div>
            <div><span class="text-zinc-500">Género:</span> <span class="text-zinc-200 font-medium">${escapeHtml(char.gender?.name || 'N/A')}</span></div>
            <div><span class="text-zinc-500">Edad:</span> <span class="text-zinc-200 font-medium">${escapeHtml(char.age || 'Desconocida')}</span></div>
            <div><span class="text-zinc-500">Cumpleaños:</span> <span class="text-zinc-200 font-medium">${escapeHtml(char.birthday || 'N/A')}</span></div>
            <div><span class="text-zinc-500">Altura:</span> <span class="text-zinc-200 font-medium">${escapeHtml(char.height || 'N/A')}</span></div>
            <div><span class="text-zinc-500">Debut Anime:</span> <span class="text-zinc-200 font-medium">${escapeHtml(char.animeDebut || 'N/A')}</span></div>
          </div>
        </div>

        <!-- Aliases si tiene -->
        ${aliases.length > 0 ? `
          <div class="p-3.5 rounded-xl bg-jjk-black/40 border border-jjk-border space-y-1.5 text-xs">
            <span class="text-zinc-500 font-semibold block">Alias conocidos:</span>
            <div class="flex flex-wrap gap-1.5">
              ${aliases.map(a => `<span class="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[11px]">${escapeHtml(a)}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Familiares si tiene -->
        ${relatives.length > 0 ? `
          <div class="p-3.5 rounded-xl bg-jjk-black/40 border border-jjk-border space-y-1.5 text-xs max-h-32 overflow-y-auto">
            <span class="text-zinc-500 font-semibold block">Parientes y familiares:</span>
            <ul class="list-disc list-inside space-y-0.5 text-zinc-400 text-[11px]">
              ${relatives.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

      </div>

      <!-- Columna Derecha: Habilidades, Dominio y Afiliaciones (7 cols) -->
      <div class="md:col-span-7 space-y-5">
        
        <!-- Afiliaciones y roles -->
        <div class="space-y-2">
          <h5 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Afiliaciones & Ocupación</h5>
          <div class="flex flex-wrap gap-2">
            ${affils.map(a => `
              <span class="px-3 py-1 rounded-lg bg-jjk-black border border-zinc-700 text-xs font-medium text-zinc-200">
                ${escapeHtml(a)}
              </span>
            `).join('')}
            ${occupations.map(o => `
              <span class="px-3 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/80 text-xs font-medium text-zinc-300">
                ${escapeHtml(o)}
              </span>
            `).join('')}
            ${affils.length === 0 && occupations.length === 0 ? '<span class="text-xs text-zinc-500">Sin datos registrados</span>' : ''}
          </div>
        </div>

        <!-- Expansión de Dominio -->
        ${domainHtml}

        <!-- Técnicas Malditas -->
        ${techniquesHtml || '<p class="text-xs text-zinc-500 italic p-3 bg-jjk-black/40 rounded-xl border border-jjk-border">No cuenta con técnicas malditas registradas.</p>'}

        <!-- Herramientas Malditas -->
        ${Array.isArray(char.cursedTools) && char.cursedTools.length > 0 ? `
          <div class="space-y-2 pt-2">
            <h5 class="text-xs font-bold text-amber-400 uppercase tracking-wider">Herramientas Malditas</h5>
            <div class="flex flex-wrap gap-2">
              ${char.cursedTools.map(tool => {
                const toolName = typeof tool === 'object' ? tool.name : tool;
                return `
                  <span class="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                    🗡️ ${escapeHtml(toolName)}
                  </span>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

      </div>

    </div>
  `;

  // Mostrar modal con animación
  DOM.modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  setTimeout(() => {
    DOM.modalBox.classList.remove('scale-95');
    DOM.modalBox.classList.add('scale-100');
  }, 10);
}

function closeModal() {
  DOM.modalBox.classList.remove('scale-100');
  DOM.modalBox.classList.add('scale-95');
  setTimeout(() => {
    DOM.modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    state.selectedCharacter = null;
  }, 150);
}

// ==================== PAGINACIÓN ====================

function updatePaginationControls() {
  if (state.isGlobalMode) {
    DOM.bottomPaginationWrapper.classList.add('hidden');
    DOM.topPagination.classList.add('hidden');
    DOM.pageIndicatorText.textContent = `(Modo global activo — ${state.allCharacters.length} personajes cargados)`;
    return;
  }

  DOM.bottomPaginationWrapper.classList.remove('hidden');
  DOM.topPagination.classList.remove('hidden');

  DOM.paginationInfo.textContent = `Página ${state.currentPage} de ${state.totalPages} (${state.perPage} personajes por página)`;
  DOM.pageIndicatorText.textContent = `— Página ${state.currentPage} de ${state.totalPages}`;

  // Paginador superior compacto
  DOM.topPagination.innerHTML = `
    <button 
      id="top-prev-btn" 
      class="px-2.5 py-1 rounded-lg border border-jjk-border bg-jjk-card hover:bg-zinc-800 text-xs text-zinc-300 font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      ${state.currentPage <= 1 ? 'disabled' : ''}
    >
      &larr; Prev
    </button>
    <span class="text-xs font-mono text-zinc-400 px-1">
      ${state.currentPage} / ${state.totalPages}
    </span>
    <button 
      id="top-next-btn" 
      class="px-2.5 py-1 rounded-lg border border-jjk-border bg-jjk-card hover:bg-zinc-800 text-xs text-zinc-300 font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      ${state.currentPage >= state.totalPages ? 'disabled' : ''}
    >
      Next &rarr;
    </button>
  `;

  document.getElementById('top-prev-btn')?.addEventListener('click', () => loadPage(state.currentPage - 1));
  document.getElementById('top-next-btn')?.addEventListener('click', () => loadPage(state.currentPage + 1));

  // Paginador inferior numérico
  DOM.paginationControls.innerHTML = '';

  // Botón Anterior
  const prevBtn = document.createElement('button');
  prevBtn.className = `px-3 py-1.5 rounded-lg border border-jjk-border bg-jjk-card hover:bg-zinc-800 text-xs text-zinc-300 font-medium transition-colors ${state.currentPage <= 1 ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`;
  prevBtn.textContent = '« Anterior';
  prevBtn.addEventListener('click', () => loadPage(state.currentPage - 1));
  DOM.paginationControls.appendChild(prevBtn);

  // Lógica de páginas a mostrar (ventana deslizante)
  const total = state.totalPages;
  const current = state.currentPage;
  const pagesToShow = new Set([1, total]);

  for (let p = Math.max(1, current - 2); p <= Math.min(total, current + 2); p++) {
    pagesToShow.add(p);
  }

  const sortedPages = Array.from(pagesToShow).sort((a, b) => a - b);
  let lastPageRendered = 0;

  sortedPages.forEach(p => {
    if (lastPageRendered && p - lastPageRendered > 1) {
      const dots = document.createElement('span');
      dots.className = 'px-2 py-1 text-zinc-600 text-xs select-none';
      dots.textContent = '...';
      DOM.paginationControls.appendChild(dots);
    }

    const pageBtn = document.createElement('button');
    const isActive = p === current;
    pageBtn.className = `w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
      isActive 
        ? 'bg-rose-600 text-white shadow-cursed-red font-bold' 
        : 'border border-jjk-border bg-jjk-card hover:bg-zinc-800 text-zinc-300'
    }`;
    pageBtn.textContent = p;
    pageBtn.addEventListener('click', () => {
      if (p !== current) loadPage(p);
    });
    DOM.paginationControls.appendChild(pageBtn);

    lastPageRendered = p;
  });

  // Botón Siguiente
  const nextBtn = document.createElement('button');
  nextBtn.className = `px-3 py-1.5 rounded-lg border border-jjk-border bg-jjk-card hover:bg-zinc-800 text-xs text-zinc-300 font-medium transition-colors ${state.currentPage >= state.totalPages ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`;
  nextBtn.textContent = 'Siguiente »';
  nextBtn.addEventListener('click', () => loadPage(state.currentPage + 1));
  DOM.paginationControls.appendChild(nextBtn);
}

// ==================== UI DE FILTROS ACTIVOS ====================

function updateActiveFiltersUI() {
  const activeTags = [];

  if (state.filters.search) {
    activeTags.push({ label: `Búsqueda: "${state.filters.search}"`, clear: () => {
      state.filters.search = '';
      DOM.searchInput.value = '';
      DOM.clearSearchBtn.classList.add('hidden');
    }});
  }

  if (state.filters.status !== 'all') {
    activeTags.push({ label: `Estado: ${state.filters.status}`, clear: () => {
      state.filters.status = 'all';
      DOM.statusFilter.value = 'all';
    }});
  }

  if (state.filters.grade !== 'all') {
    activeTags.push({ label: `Grado: ${state.filters.grade}`, clear: () => {
      state.filters.grade = 'all';
      DOM.gradeFilter.value = 'all';
    }});
  }

  if (state.filters.species !== 'all') {
    activeTags.push({ label: `Especie: ${state.filters.species}`, clear: () => {
      state.filters.species = 'all';
      DOM.speciesFilter.value = 'all';
    }});
  }

  if (activeTags.length > 0) {
    DOM.activeFiltersBar.classList.remove('hidden');
    DOM.activeTagsContainer.innerHTML = '';
    activeTags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 text-[11px]';
      chip.innerHTML = `
        <span>${escapeHtml(tag.label)}</span>
        <button class="hover:text-rose-400 font-bold ml-0.5">&times;</button>
      `;
      chip.querySelector('button').addEventListener('click', () => {
        tag.clear();
        applyFilters();
      });
      DOM.activeTagsContainer.appendChild(chip);
    });
  } else {
    DOM.activeFiltersBar.classList.add('hidden');
  }
}

function resetAllFilters() {
  state.filters.search = '';
  state.filters.status = 'all';
  state.filters.grade = 'all';
  state.filters.species = 'all';
  state.filters.sort = 'id-asc';

  DOM.searchInput.value = '';
  DOM.clearSearchBtn.classList.add('hidden');
  DOM.statusFilter.value = 'all';
  DOM.gradeFilter.value = 'all';
  DOM.speciesFilter.value = 'all';
  DOM.sortFilter.value = 'id-asc';

  applyFilters();
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
  // Búsqueda con debounce ligero
  let debounceTimeout = null;
  DOM.searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val.length > 0) {
      DOM.clearSearchBtn.classList.remove('hidden');
    } else {
      DOM.clearSearchBtn.classList.add('hidden');
    }

    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      state.filters.search = val;
      applyFilters();
    }, 250);
  });

  DOM.clearSearchBtn.addEventListener('click', () => {
    DOM.searchInput.value = '';
    DOM.clearSearchBtn.classList.add('hidden');
    state.filters.search = '';
    applyFilters();
  });

  // Selectores de filtro
  DOM.statusFilter.addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    applyFilters();
  });

  DOM.gradeFilter.addEventListener('change', (e) => {
    state.filters.grade = e.target.value;
    applyFilters();
  });

  DOM.speciesFilter.addEventListener('change', (e) => {
    state.filters.species = e.target.value;
    applyFilters();
  });

  DOM.sortFilter.addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    applyFilters();
  });

  // Botones de reset
  DOM.resetFiltersBtn.addEventListener('click', resetAllFilters);
  DOM.emptyResetBtn.addEventListener('click', resetAllFilters);
  DOM.retryBtn.addEventListener('click', () => loadPage(state.currentPage));

  // Toggle modo global
  DOM.fetchAllToggleBtn.addEventListener('click', loadAllCharacters);

  // Modal
  DOM.closeModalBtn.addEventListener('click', closeModal);
  DOM.modal.addEventListener('click', (e) => {
    if (e.target === DOM.modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !DOM.modal.classList.contains('hidden')) {
      closeModal();
    }
  });
}

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadPage(1);
});
