/**
 * Логика страницы сессии инвентаризации
 * 
 * Этот файл управляет отображением и взаимодействием
 * со страницей подсчета товаров во время инвентаризации.
 */

import { initApp } from './app.js';
import * as items from './items.js';
import * as inventory from './inventory.js';
import { showAlert } from './modal.js';

// Состояние страницы
const pageState = {
  sessionId: null,
  // Прошлая завершенная сессия (для сравнения)
  previousSession: null,
  currentCategory: '',
  searchQuery: '',
  allItems: [],
  inventoryItems: {}, // { itemId: { quantity, comment, saved } }
  currentItemId: null, // Для модальных окон
  calculatorValue: '0',
  calculatorResult: null,
  // Флаг для предотвращения повторных кликов по категориям
  isNavigating: false,
  // Интервал автосохранения
  autoSaveInterval: null,
  // Состояние виртуализации
  virtualScroll: {
    container: null,
    itemsData: [], // Массив всех товаров с метаданными
    visibleStart: 0,
    visibleEnd: 0,
    itemHeight: 200, // Примерная высота карточки товара
    buffer: 3, // Количество элементов сверху и снизу для буфера
    renderedItems: new Map(), // Кеш отрендеренных элементов
    scrollDebounce: null,
    intersectionObserver: null
  }
};

// Категории будут загружаться динамически из товаров
let CATEGORIES = {
  '': 'Все'
};

/**
 * Инициализация страницы
 */
async function initPage() {
  try {
    // Инициализируем приложение
    await initApp();

    // Получаем ID сессии из URL
    const urlParams = new URLSearchParams(window.location.search);
    pageState.sessionId = urlParams.get('id');

    if (!pageState.sessionId) {
      await showAlert('ID сессии не указан');
      window.location.href = 'index.html';
      return;
    }

    // Устанавливаем текущую дату
    setCurrentDate();

    // Загружаем данные
    await loadData();

    // Настраиваем обработчики событий
    setupEventHandlers();

    // Отображаем товары
    renderItems();

  } catch (error) {
    console.error('Ошибка инициализации страницы:', error);
    await showAlert('Не удалось загрузить страницу. Проверьте консоль для деталей.');
  }
}

/**
 * Установить текущую дату в заголовке
 */
function setCurrentDate() {
  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    const now = new Date();
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    dateEl.textContent = now.toLocaleDateString('ru-RU', options);
  }
}

/**
 * Обновить строку даты с подсказкой, с чем сравниваем
 * (например: "18 января 2026 г. · сравнение с 17 декабря 2025 г.")
 */
function updateDateWithComparisonInfo() {
  const dateEl = document.getElementById('current-date');
  if (!dateEl) return;

  const now = new Date();
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  let text = now.toLocaleDateString('ru-RU', options);

  if (pageState.previousSession && pageState.previousSession.date) {
    const prev = new Date(pageState.previousSession.date);
    // Если дата в неверном формате — просто покажем строкой
    const prevText = isNaN(prev.getTime())
      ? String(pageState.previousSession.date)
      : prev.toLocaleDateString('ru-RU', options);
    text += ` · сравнение с ${prevText}`;
  }

  dateEl.textContent = text;
}

/**
 * Загрузить данные сессии и товаров
 */
async function loadData() {
  try {
    // Загружаем саму сессию (нужна дата, чтобы понять "предыдущую" инвентаризацию)
    const currentSession = await inventory.getInventorySessionById(pageState.sessionId);
    pageState.currentSession = currentSession || null;

    // Загружаем все товары
    pageState.allItems = await items.getAllItems();

    // Загружаем категории из товаров динамически
    await loadCategoriesFromItems();

    // Обновляем UI категорий
    renderCategoryButtons();

    // Загружаем записи инвентаризации для этой сессии
    const inventoryItems = await inventory.getInventoryItemsBySession(pageState.sessionId);

    // Преобразуем в удобный формат
    inventoryItems.forEach(item => {
      pageState.inventoryItems[item.item_id] = {
        baseQuantity: item.quantity || 0, // При загрузке базовое = сохраненное количество
        // Важно: используем ??, чтобы не терять "0" (0 — валидное значение)
        // Если previous_quantity не было — оставляем null и заполним из прошлой инвентаризации ниже
        previousQuantity: item.previous_quantity ?? null,
        comment: item.comment || '',
        saved: true,
        additions: [] // Промежуточные значения не сохраняются в БД, только в памяти
      };
    });

    // Подтягиваем "прошлые количества" из предыдущей завершенной инвентаризации
    // (если она есть). Это делает сравнение "месяц к месяцу" автоматически.
    const comparison = await inventory.getPreviousSessionComparison(pageState.sessionId);
    pageState.previousSession = comparison.previousSession || null;

    const prevMap = comparison.previousQuantitiesByItemId || {};

    // Для каждого товара гарантируем, что у нас есть запись в pageState.inventoryItems
    // и заполнено previousQuantity (по умолчанию 0).
    pageState.allItems.forEach(it => {
      const existing = pageState.inventoryItems[it.id];
      const prevQty = (prevMap[it.id] ?? 0);

      if (existing) {
        if (existing.previousQuantity === null || typeof existing.previousQuantity !== 'number') {
          existing.previousQuantity = prevQty;
        }
        return;
      }

      // Если товар ещё не считали в этой сессии — создаем "пустую" запись
      pageState.inventoryItems[it.id] = {
        baseQuantity: 0,
        previousQuantity: prevQty,
        comment: '',
        saved: false, // ещё не сохранено, покажем кнопку "сохранить"
        additions: []
      };
    });

    // Обновляем дату в шапке с информацией о сравнении
    updateDateWithComparisonInfo();

  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    throw error;
  }
}

/**
 * Загрузить категории из товаров динамически
 */
async function loadCategoriesFromItems() {
  // Начинаем с "Все"
  CATEGORIES = { '': 'Все' };

  // Собираем уникальные категории из товаров
  const categoriesSet = new Set();
  pageState.allItems.forEach(item => {
    if (item.category && item.category.trim() !== '') {
      categoriesSet.add(item.category.toLowerCase().trim());
    }
  });

  // Добавляем категории в объект
  categoriesSet.forEach(cat => {
    // Делаем первую букву заглавной для отображения
    const displayName = cat.charAt(0).toUpperCase() + cat.slice(1);
    CATEGORIES[cat] = displayName;
  });
}

/**
 * Отрисовать кнопки категорий динамически
 */
function renderCategoryButtons() {
  const navContainer = document.querySelector('#category-navigation .flex');
  const floatingContainer = document.querySelector('#floating-category-nav .flex.flex-col');

  if (!navContainer) return;

  // Очищаем существующие кнопки (кроме заголовка в floating)
  navContainer.innerHTML = '';

  // Создаём массив категорий с гарантированным порядком: "Все" всегда первая
  const categoriesArray = [['', 'Все']]; // Пустая строка = "Все"

  // Добавляем остальные категории (отсортированные по алфавиту)
  Object.entries(CATEGORIES)
    .filter(([key]) => key !== '') // Исключаем "Все", она уже добавлена
    .sort((a, b) => a[1].localeCompare(b[1], 'ru'))
    .forEach(entry => categoriesArray.push(entry));

  // Создаём кнопки для каждой категории
  categoriesArray.forEach(([key, name]) => {
    // Кнопка для основной навигации
    const btn = document.createElement('button');
    // При инициализации первая кнопка "Все" должна быть активной
    const isActive = key === '' && pageState.currentCategory === '';

    if (isActive) {
      btn.className = 'category-btn shrink-0 h-10 px-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full text-sm font-medium shadow-md border border-slate-200 dark:border-slate-700 transition-colors';
    } else {
      btn.className = 'category-btn shrink-0 h-10 px-6 bg-white dark:bg-surface-dark text-slate-600 dark:text-slate-300 rounded-full text-sm font-medium shadow-sm border border-slate-200 dark:border-slate-700 active:bg-slate-50 dark:active:bg-slate-800 transition-colors';
    }
    btn.setAttribute('data-category', key);
    btn.textContent = name;
    navContainer.appendChild(btn);
  });

  // Обновляем плавающую навигацию
  if (floatingContainer) {
    // Удаляем старые кнопки
    floatingContainer.querySelectorAll('.floating-category-btn').forEach(btn => btn.remove());

    // Добавляем новые кнопки после заголовка
    categoriesArray.forEach(([key, name]) => {
      const btn = document.createElement('button');
      const isActive = key === '' && pageState.currentCategory === '';

      if (isActive) {
        btn.className = 'floating-category-btn category-btn w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors bg-primary text-white dark:bg-blue-600 dark:text-white font-bold';
      } else {
        btn.className = 'floating-category-btn category-btn w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400';
      }
      btn.setAttribute('data-category', key);
      btn.textContent = name;
      floatingContainer.appendChild(btn);
    });
  }
}

/**
 * Настроить обработчики событий
 */
function setupEventHandlers() {
  // Кнопка "Назад"
  const backBtn = document.getElementById('back-button');
  if (backBtn) {
    backBtn.addEventListener('click', handleBack);
  }

  // Кнопка "Готово"
  const doneBtn = document.getElementById('done-button');
  if (doneBtn) {
    doneBtn.addEventListener('click', handleDone);
  }

  // Поиск
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      pageState.searchQuery = e.target.value.trim().toLowerCase();
      renderItems();
    });
  }

  // Кнопки категорий (обычные и плавающие)
  // Используем делегирование событий для лучшей производительности
  const categoryNav = document.getElementById('category-navigation');
  if (categoryNav) {
    categoryNav.addEventListener('click', (e) => {
      const btn = e.target.closest('.category-btn');
      if (btn && !pageState.isNavigating) {
        e.preventDefault();
        e.stopPropagation();
        const category = btn.getAttribute('data-category') || '';
        // Для кнопок в навигации всегда прокручиваем к категории
        selectCategory(category, true);
      }
    });
  }

  // Обработчик для плавающих кнопок категорий
  const floatingNav = document.getElementById('floating-category-nav');
  if (floatingNav) {
    floatingNav.addEventListener('click', (e) => {
      const btn = e.target.closest('.floating-category-btn');
      if (btn && !pageState.isNavigating) {
        e.preventDefault();
        e.stopPropagation();
        const category = btn.getAttribute('data-category') || '';
        selectCategory(category, true);
      }
    });
  }

  // Инициализируем плавающую навигацию
  initFloatingNavigation();

  // Обработчик прокрутки для обновления активной категории
  const container = document.getElementById('items-container');
  if (container) {
    const debouncedScrollHandler = debounce(() => {
      // Обновляем активную категорию при прокрутке
      updateFloatingNavigation();
    }, 100);

    container.addEventListener('scroll', debouncedScrollHandler, { passive: true });

    // Сохраняем контейнер для виртуализации
    pageState.virtualScroll.container = container;
  }

  // Кнопка "Сохранить прогресс"
  const saveBtn = document.getElementById('save-progress-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', handleSaveAll);
  }

  // Умное позиционирование кнопки сохранения
  setupSmartSaveButton();

  // Модальное окно выхода
  const exitModal = document.getElementById('exit-modal');
  const modalSaveYes = document.getElementById('modal-save-yes');
  const modalSaveNo = document.getElementById('modal-save-no');

  if (modalSaveYes) {
    modalSaveYes.addEventListener('click', async () => {
      await handleSaveAll();
      exitModal.classList.add('hidden');
      exitModal.classList.remove('flex');
      // Очищаем интервал автосохранения перед уходом
      if (pageState.autoSaveInterval) {
        clearInterval(pageState.autoSaveInterval);
      }
      window.location.href = 'index.html';
    });
  }

  if (modalSaveNo) {
    modalSaveNo.addEventListener('click', () => {
      exitModal.classList.add('hidden');
      exitModal.classList.remove('flex');
      // Очищаем интервал автосохранения перед уходом
      if (pageState.autoSaveInterval) {
        clearInterval(pageState.autoSaveInterval);
      }
      window.location.href = 'index.html';
    });
  }

  // Закрытие по клику на фон (только закрывает окно, не уходит)
  if (exitModal) {
    exitModal.addEventListener('click', (e) => {
      if (e.target === exitModal) {
        exitModal.classList.add('hidden');
        exitModal.classList.remove('flex');
      }
    });
  }

  // Модальное окно комментария
  setupCommentModal();

  // Модальное окно калькулятора
  setupCalculatorModal();

  // Модальное окно добавления количества
  setupAdditionModal();

  // Модальное окно просмотра товара (фото + название)
  setupPreviewModal();

  // Обработчики кликов на карточках товаров (один раз, делегирование)
  setupItemHandlers();

  // Автосохранение каждые 30 секунд
  setupAutoSave();

  // Предупреждение при закрытии страницы с несохранёнными данными
  setupBeforeUnload();
}

/**
 * Настроить автосохранение
 */
function setupAutoSave() {
  // Очищаем предыдущий интервал, если был
  if (pageState.autoSaveInterval) {
    clearInterval(pageState.autoSaveInterval);
  }

  // Автосохранение каждые 30 секунд
  pageState.autoSaveInterval = setInterval(async () => {
    const hasUnsaved = Object.values(pageState.inventoryItems).some(item => !item.saved);
    if (hasUnsaved) {
      console.log('Автосохранение...');
      await handleSaveAll(true); // silent = true
      showToast('Автосохранение выполнено', 'success', 1500);
    }
  }, 30000);
}

/**
 * Настроить предупреждение при закрытии страницы
 */
function setupBeforeUnload() {
  window.addEventListener('beforeunload', (e) => {
    const hasUnsaved = Object.values(pageState.inventoryItems).some(item => !item.saved);
    if (hasUnsaved) {
      // Стандартное сообщение браузера
      e.preventDefault();
      e.returnValue = 'У вас есть несохранённые изменения. Вы уверены, что хотите уйти?';
      return e.returnValue;
    }
  });
}

/**
 * Обработка кнопки "Назад"
 */
function handleBack() {
  // Проверяем, есть ли несохраненные изменения
  const hasUnsaved = Object.values(pageState.inventoryItems).some(item => !item.saved);

  if (hasUnsaved) {
    showExitModal();
  } else {
    window.location.href = 'index.html';
  }
}

/**
 * Обработка кнопки "Готово"
 */
function handleDone() {
  showExitModal();
}

/**
 * Показать модальное окно выхода
 */
function showExitModal() {
  const modal = document.getElementById('exit-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Проверяем, есть ли несохранённые изменения для показа правильного текста
    const hasUnsaved = Object.values(pageState.inventoryItems).some(item => !item.saved);
    const messageEl = modal.querySelector('p');
    if (messageEl) {
      if (hasUnsaved) {
        messageEl.textContent = 'У вас есть несохранённые изменения. Сохранить перед выходом?';
      } else {
        messageEl.textContent = 'Вы хотите сохранить текущий прогресс перед выходом?';
      }
    }
  }
}

/**
 * Получить ID категории для якорной ссылки по коду категории
 * 
 * @param {string} categoryCode - Код категории (например, "бокалы")
 * @returns {string} - ID для якорной ссылки
 */
function getCategoryId(categoryCode) {
  if (!categoryCode || categoryCode === '') return 'category-all';

  // Используем сам код категории напрямую для создания ID
  // Это гарантирует соответствие между тем, что мы ищем и тем, что создаем
  const normalized = categoryCode.toLowerCase().trim().replace(/\s+/g, '-');
  return `category-${normalized}`;
}

/**
 * Получить ID категории для якорной ссылки по названию категории
 * 
 * @param {string} categoryName - Название категории (например, "Бокалы")
 * @returns {string} - ID для якорной ссылки
 */
function getCategoryIdByName(categoryName) {
  if (!categoryName || categoryName === '') return 'category-all';

  if (categoryName === 'Без категории') return 'category-no-category';

  // Преобразуем название категории в ID (кириллица остается, все строчные, пробелы заменяются на дефисы)
  const normalized = categoryName.toLowerCase().replace(/\s+/g, '-');
  return `category-${normalized}`;
}

/**
 * Выбрать категорию
 * Исправленная версия с гарантированным обновлением состояния
 */
function selectCategory(category, scrollToSection = true) {
  // Нормализуем категорию для сравнения
  // ВАЖНО: пустая строка означает "Все"
  const normalizedCategory = (category === '' || category === null || category === undefined)
    ? ''
    : category.toLowerCase().trim();
  const normalizedCurrent = (pageState.currentCategory || '').toLowerCase().trim();

  // Если категория уже выбрана и не нужно прокручивать, не делаем ничего
  if (normalizedCurrent === normalizedCategory && !scrollToSection) {
    return;
  }

  // Предотвращаем повторные клики во время навигации (но только если это действительно другой выбор)
  if (pageState.isNavigating && normalizedCurrent === normalizedCategory) {
    return;
  }

  // Устанавливаем флаг навигации
  pageState.isNavigating = true;

  // ВАЖНО: Сразу обновляем состояние категории
  // Для "Все" устанавливаем пустую строку, которая отключит фильтрацию
  pageState.currentCategory = normalizedCategory;

  // Обновляем заголовок
  const titleEl = document.getElementById('category-title');
  if (titleEl) {
    // Для "Все" (пустая строка) показываем "Все категории"
    if (normalizedCategory === '') {
      titleEl.textContent = 'Все категории';
    } else {
      titleEl.textContent = CATEGORIES[normalizedCategory] || normalizedCategory.charAt(0).toUpperCase() + normalizedCategory.slice(1);
    }
  }

  // Обновляем стили всех кнопок категорий (обычных и плавающих)
  updateCategoryButtons(normalizedCategory);

  // Рендерим товары с новым фильтром
  renderItems();

  // Если категория "Все", просто прокручиваем к началу
  if (normalizedCategory === '') {
    const container = document.getElementById('items-container');
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Снимаем флаг навигации сразу
    pageState.isNavigating = false;
    return;
  }

  // Для конкретной категории: прокручиваем к категории после рендеринга
  if (scrollToSection) {
    // Используем небольшую задержку, чтобы дать браузеру время отрендерить элементы
    setTimeout(() => {
      const container = document.getElementById('items-container');
      if (!container) {
        pageState.isNavigating = false;
        return;
      }

      const categoryId = getCategoryId(normalizedCategory);

      // Ищем элемент категории - делаем только одну попытку
      let categoryElement = document.getElementById(categoryId);

      // Если не найдено, ищем через querySelector
      if (!categoryElement) {
        categoryElement = container.querySelector(`#${categoryId}`);
      }

      // Если все еще не найдено, ищем по всем секциям (но только один раз)
      if (!categoryElement) {
        const allSections = container.querySelectorAll('.category-section');
        categoryElement = Array.from(allSections).find(section => {
          const sectionId = section.id.toLowerCase();
          return sectionId === categoryId.toLowerCase() ||
            sectionId.includes(normalizedCategory) ||
            normalizedCategory.includes(sectionId.replace('category-', ''));
        });
      }

      if (categoryElement) {
        // Вычисляем позицию прокрутки
        // Используем offsetTop вместо getBoundingClientRect для избежания forced reflow
        const elementOffsetTop = categoryElement.offsetTop;
        const scrollPosition = elementOffsetTop - 120;

        container.scrollTo({
          top: Math.max(0, scrollPosition),
          behavior: 'smooth'
        });
      }

      // Снимаем флаг навигации
      pageState.isNavigating = false;
    }, 100); // Увеличиваем задержку для гарантии завершения рендеринга
  } else {
    // Если не нужно прокручивать, просто снимаем флаг
    pageState.isNavigating = false;
  }
}

/**
 * Обновить стили кнопок категорий
 */
function updateCategoryButtons(activeCategory) {
  document.querySelectorAll('.category-btn').forEach(btn => {
    const btnCategory = btn.getAttribute('data-category') || '';
    const isFloating = btn.classList.contains('floating-category-btn');
    const isActive = btnCategory === activeCategory;

    if (isActive) {
      // Активная кнопка - сначала удаляем все неактивные классы
      if (isFloating) {
        // Плавающая кнопка - синий фон
        btn.classList.remove(
          'text-slate-600', 'dark:text-slate-400',
          'bg-white', 'dark:bg-surface-dark'
        );
        btn.classList.add('bg-primary', 'text-white', 'dark:bg-blue-600', 'dark:text-white', 'font-bold');
      } else {
        // Обычная кнопка - темный фон
        btn.classList.remove(
          'bg-white', 'dark:bg-surface-dark',
          'text-slate-600', 'dark:text-slate-300',
          'bg-primary', 'text-white', 'dark:bg-blue-600', 'dark:text-white', 'font-bold'
        );
        btn.classList.add('bg-slate-900', 'dark:bg-white', 'text-white', 'dark:text-slate-900', 'shadow-md');
      }
    } else {
      // Неактивная кнопка - сначала удаляем все активные классы
      if (isFloating) {
        // Плавающая кнопка - обычный вид
        btn.classList.remove(
          'bg-primary', 'text-white', 'dark:bg-blue-600', 'dark:text-white', 'font-bold'
        );
        btn.classList.add('text-slate-600', 'dark:text-slate-400');
      } else {
        // Обычная кнопка - белый фон
        btn.classList.remove(
          'bg-slate-900', 'dark:bg-white', 'text-white', 'dark:text-slate-900', 'shadow-md',
          'bg-primary', 'text-white', 'dark:bg-blue-600', 'dark:text-white', 'font-bold'
        );
        btn.classList.add('bg-white', 'dark:bg-surface-dark', 'text-slate-600', 'dark:text-slate-300');
      }
    }
  });
}

/**
 * Отфильтровать товары по категории и поисковому запросу
 */
function getFilteredItems() {
  let filtered = pageState.allItems;

  // Фильтр по категории
  if (pageState.currentCategory) {
    // Нормализуем категории для сравнения (приводим к нижнему регистру)
    const normalizedCategory = pageState.currentCategory.toLowerCase().trim();
    filtered = filtered.filter(item => {
      const itemCategory = (item.category || '').toLowerCase().trim();
      return itemCategory === normalizedCategory;
    });
  }

  // Фильтр по поисковому запросу
  if (pageState.searchQuery) {
    filtered = filtered.filter(item => {
      const name = (item.name || '').toLowerCase();
      return name.includes(pageState.searchQuery);
    });
  }

  return filtered;
}

/**
 * Отобразить товары
 */
function renderItems() {
  const container = document.getElementById('items-container');
  if (!container) return;

  const filteredItems = getFilteredItems();

  if (filteredItems.length === 0) {
    // Проверяем, почему список пустой (для отладки)
    const totalItems = pageState.allItems.length;
    const hasCategoryFilter = pageState.currentCategory !== '';
    const hasSearchFilter = pageState.searchQuery !== '';

    if (totalItems > 0) {
      console.log('Товары не найдены после фильтрации:', {
        totalItems,
        currentCategory: pageState.currentCategory,
        searchQuery: pageState.searchQuery,
        hasCategoryFilter,
        hasSearchFilter
      });
    }

    container.innerHTML = `
      <div class="px-4 py-12 text-center">
        <p class="text-slate-400 dark:text-slate-500">Товары не найдены</p>
        ${hasCategoryFilter || hasSearchFilter ? `
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Попробуйте изменить фильтры или очистить поиск
          </p>
        ` : ''}
      </div>
    `;
    // Останавливаем наблюдение, если было запущено
    if (pageState.virtualScroll.intersectionObserver) {
      pageState.virtualScroll.intersectionObserver.disconnect();
      pageState.virtualScroll.intersectionObserver = null;
    }
    return;
  }

  // Группируем по категориям (item.category может быть в разном регистре)
  const grouped = {};
  const categoryMap = {}; // Маппинг нормализованных категорий к оригинальным

  filteredItems.forEach(item => {
    const originalCategory = item.category || '';
    // Нормализуем категорию для группировки (приводим к нижнему регистру)
    const normalizedCategory = originalCategory.toLowerCase().trim();

    // Сохраняем оригинальное значение для первого вхождения
    if (!categoryMap[normalizedCategory]) {
      categoryMap[normalizedCategory] = originalCategory;
    }

    if (!grouped[normalizedCategory]) {
      grouped[normalizedCategory] = [];
    }
    grouped[normalizedCategory].push(item);
  });

  // Подготавливаем данные для виртуализации
  pageState.virtualScroll.itemsData = [];
  // Сортируем категории по названию для отображения
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    // Используем нормализованную категорию для поиска в CATEGORIES
    const nameA = CATEGORIES[a] || CATEGORIES[categoryMap[a]] || categoryMap[a] || a;
    const nameB = CATEGORIES[b] || CATEGORIES[categoryMap[b]] || categoryMap[b] || b;
    return nameA.localeCompare(nameB, 'ru');
  });

  sortedCategories.forEach(normalizedCategory => {
    // Получаем код категории (оригинальный или нормализованный)
    const categoryCode = categoryMap[normalizedCategory] || normalizedCategory;
    // Получаем название категории из CATEGORIES или используем код
    const categoryName = CATEGORIES[normalizedCategory] || CATEGORIES[categoryCode] || categoryCode || 'Без категории';

    // Создаем ID для якорной ссылки на основе нормализованной категории
    // Используем нормализованную категорию для создания ID
    const categoryId = getCategoryId(normalizedCategory);

    // Добавляем заголовок категории
    pageState.virtualScroll.itemsData.push({
      type: 'category-header',
      category: categoryName, // Название для отображения
      categoryCode: categoryCode, // Код для фильтрации
      id: categoryId // ID для якорной ссылки
    });

    // Добавляем товары этой категории
    // Используем normalizedCategory для доступа к grouped, так как там категории нормализованы
    const categoryItems = grouped[normalizedCategory];
    if (categoryItems && Array.isArray(categoryItems)) {
      categoryItems.forEach(item => {
        pageState.virtualScroll.itemsData.push({
          type: 'item',
          item: item,
          category: categoryCode
        });
      });
    }
  });

  // Очищаем старый кеш при полной перерисовке
  pageState.virtualScroll.renderedItems.clear();

  // Рендерим все элементы
  renderItemsWithVirtualization(container);

  // Настраиваем отслеживание активной категории
  setupCategoryObserver();

  // Обновляем позицию кнопки сохранения
  if (window.updateSaveButtonPosition) {
    setTimeout(window.updateSaveButtonPosition, 100);
  }
}

/**
 * Рендерить товары с виртуализацией
 * Использует DocumentFragment для батчинга DOM операций и кеширование для оптимизации
 */
function renderItemsWithVirtualization(container) {
  const fragment = document.createDocumentFragment();
  const itemsData = pageState.virtualScroll.itemsData;

  if (!container || itemsData.length === 0) {
    return;
  }

  // Для небольших списков (< 500 элементов) рендерим все элементы сразу
  // Увеличен лимит, т.к. виртуализация плохо работает с CSS Grid
  if (itemsData.length < 500) {
    // Создаем все элементы через DocumentFragment для батчинга DOM операций
    // Это предотвращает множественные forced reflow
    itemsData.forEach((data) => {
      if (data.type === 'category-header') {
        const headerEl = renderCategoryHeader(data.category, data.id);
        fragment.appendChild(headerEl);
      } else if (data.type === 'item') {
        const itemEl = renderItemCardElement(data.item);
        fragment.appendChild(itemEl);
      }
    });

    // Очищаем и добавляем все элементы за одну операцию
    // Это минимизирует количество forced reflow
    container.innerHTML = '';
    // Сбрасываем минимальную высоту (могла быть установлена виртуализацией)
    container.style.minHeight = '';
    container.appendChild(fragment);
    return;
  }

  // Для больших списков используем виртуализацию
  // Вычисляем видимые элементы
  const containerHeight = container.clientHeight || window.innerHeight;
  const scrollTop = container.scrollTop || 0;
  const visibleStart = Math.max(0, Math.floor(scrollTop / pageState.virtualScroll.itemHeight) - pageState.virtualScroll.buffer);
  const visibleEnd = Math.min(itemsData.length, Math.ceil((scrollTop + containerHeight) / pageState.virtualScroll.itemHeight) + pageState.virtualScroll.buffer);

  // Сохраняем только если изменились границы видимости
  if (visibleStart !== pageState.virtualScroll.visibleStart || visibleEnd !== pageState.virtualScroll.visibleEnd) {
    pageState.virtualScroll.visibleStart = visibleStart;
    pageState.virtualScroll.visibleEnd = visibleEnd;

    // Удаляем элементы, которые больше не видимы
    pageState.virtualScroll.renderedItems.forEach((element, index) => {
      if (index < visibleStart || index >= visibleEnd) {
        if (element && element.parentNode) {
          element.remove();
        }
      }
    });

    // Рендерим видимые элементы
    for (let i = visibleStart; i < visibleEnd; i++) {
      const data = itemsData[i];
      if (!data) continue;

      let element = pageState.virtualScroll.renderedItems.get(i);

      // Если элемента нет или он не в DOM, создаем/пересоздаем
      if (!element || !element.parentNode) {
        if (data.type === 'category-header') {
          element = renderCategoryHeader(data.category, data.id);
        } else if (data.type === 'item') {
          element = renderItemCardElement(data.item);
        }

        if (element) {
          pageState.virtualScroll.renderedItems.set(i, element);
          fragment.appendChild(element);
        }
      }
    }

    // Устанавливаем общую высоту контейнера для прокрутки
    const totalHeight = itemsData.length * pageState.virtualScroll.itemHeight;
    container.style.minHeight = `${totalHeight}px`;

    // Добавляем новые элементы в контейнер
    if (fragment.childNodes.length > 0) {
      container.appendChild(fragment);
    }
  }
}

/**
 * Создать заголовок категории как DOM элемент
 * На широких экранах занимает все колонки сетки (col-span-full)
 */
function renderCategoryHeader(category, categoryId) {
  const wrapper = document.createElement('div');
  // col-span-full - заголовок занимает все колонки в Grid
  // md:px-0 - убираем лишние отступы на широких экранах (они есть на контейнере)
  wrapper.className = 'px-4 pt-4 category-section md:col-span-full md:px-0';
  wrapper.id = categoryId;

  wrapper.innerHTML = `
    <div class="flex items-center gap-3 mb-3">
      <h2 class="text-sm font-bold text-slate-400 uppercase tracking-wider">${category}</h2>
      <div class="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
    </div>
  `;

  return wrapper;
}

/**
 * Создать карточку товара как DOM элемент
 * На широких экранах карточки размещаются в сетке (Grid)
 */
function renderItemCardElement(item) {
  const wrapper = document.createElement('div');
  // md:px-0 md:mb-0 - убираем отступы на широких экранах (gap в Grid их заменяет)
  wrapper.className = 'px-4 mb-5 md:px-0 md:mb-0';
  const cardHtml = renderItemCard(item);
  wrapper.innerHTML = cardHtml;
  // Возвращаем обертку с карточкой внутри
  return wrapper;
}

/**
 * Дебаунс функция для оптимизации обновлений
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Отобразить карточку товара
 */
function renderItemCard(item) {
  const itemData = pageState.inventoryItems[item.id] || { quantity: 0, previousQuantity: 0, comment: '', saved: false, additions: [] };
  const baseQuantity = Math.floor(itemData.baseQuantity || itemData.quantity || 0);
  const additions = itemData.additions || [];
  const additionsSum = additions.reduce((sum, val) => sum + val, 0);
  const totalQuantity = baseQuantity + additionsSum; // Общее количество
  const isSaved = itemData.saved;
  const hasComment = itemData.comment && itemData.comment.trim() !== '';

  // Предыдущее количество (для сравнения)
  const previousQuantity = typeof itemData.previousQuantity === 'number' ? itemData.previousQuantity : 0;
  const diff = totalQuantity - previousQuantity;
  const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;
  const diffClass =
    diff === 0
      ? 'text-slate-500 dark:text-slate-400'
      : diff > 0
        ? 'text-green-600 dark:text-green-400'
        : 'text-red-600 dark:text-red-400';

  // Экранируем HTML в комментарии для безопасности
  const escapedComment = hasComment ? itemData.comment.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';

  return `
      <div class="bg-white dark:bg-surface-dark rounded-3xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none border border-slate-100 dark:border-slate-800 relative overflow-hidden">
        
        <div class="flex gap-4 mb-5">
          <!-- Изображение товара (кликабельное для увеличения) -->
          <button class="item-preview-btn size-16 rounded-2xl bg-slate-100 dark:bg-slate-800 shrink-0 bg-cover bg-center shadow-inner hover:ring-2 hover:ring-primary/50 active:scale-95 transition-all cursor-zoom-in" 
                  style="background-image: url('${item.image_url || ''}');"
                  data-item-id="${item.id}"
                  data-image="${item.image_url || ''}"
                  data-name="${(item.name || 'Без названия').replace(/"/g, '&quot;')}"
                  data-unit="${item.unit || 'шт.'}"
                  title="Нажмите для увеличения"></button>
          
          <!-- Информация о товаре -->
          <div class="flex flex-col justify-center flex-1 min-w-0">
            <!-- Название: полная высота, кликабельное для увеличения -->
            <button class="item-preview-btn font-bold text-base text-slate-900 dark:text-white leading-snug text-left hover:text-primary dark:hover:text-blue-400 transition-colors cursor-zoom-in"
                    data-item-id="${item.id}"
                    data-image="${item.image_url || ''}"
                    data-name="${(item.name || 'Без названия').replace(/"/g, '&quot;')}"
                    data-unit="${item.unit || 'шт.'}"
                    title="Нажмите для увеличения">${item.name || 'Без названия'}</button>
            
            <!-- Единица измерения и статус сохранения -->
            <div class="flex items-center gap-2 mt-1">
              <span class="text-sm text-slate-500 dark:text-slate-400">${item.unit || 'шт.'}</span>
              ${isSaved ? `
              <span class="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-green-600 dark:text-green-400">
                <span class="material-symbols-outlined text-[12px]" style="font-variation-settings: 'FILL' 1;">check_circle</span>
                сохранено
              </span>
              ` : `
              <button class="item-save-btn flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-primary hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors" data-item-id="${item.id}" title="Сохранить">
                <span class="material-symbols-outlined text-[12px]">save</span>
                сохранить
              </button>
              `}
            </div>
          </div>
        </div>
        
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-3">
            <button class="item-decrease size-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all touch-manipulation" data-item-id="${item.id}">
              <span class="material-symbols-outlined text-3xl">remove</span>
            </button>
            <div class="flex-1 h-14 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700 flex items-center justify-center relative focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all">
              <input class="item-quantity-input w-full h-full bg-transparent text-center font-bold text-3xl text-slate-900 dark:text-white border-none focus:ring-0 p-0" 
                     type="number" 
                     value="${totalQuantity}" 
                     data-item-id="${item.id}"
                     min="0"
                     step="1"/>
            </div>
            <button class="item-increase size-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-blue-500/30 hover:bg-blue-600 active:scale-95 transition-all touch-manipulation" data-item-id="${item.id}">
              <span class="material-symbols-outlined text-3xl">add</span>
            </button>
          </div>
          
          ${additions.length > 0 ? `
          <div class="flex items-center justify-center gap-2 flex-wrap">
            ${additions.map((val, idx) => `
              <div class="group flex items-center gap-0.5 pl-2.5 pr-1.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50">
                <span class="text-xs font-bold text-blue-600 dark:text-blue-400">+ ${val}</span>
                <button class="item-remove-addition size-5 flex items-center justify-center rounded-lg text-blue-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-800 transition-colors ml-1" data-item-id="${item.id}" data-index="${idx}">
                  <span class="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            `).join('')}
            <button class="item-add-addition size-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" data-item-id="${item.id}" title="Добавить значение">
              <span class="material-symbols-outlined text-[16px]">add</span>
            </button>
          </div>
          ` : `
          <div class="flex items-center justify-center gap-2">
            <button class="item-add-addition size-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" data-item-id="${item.id}" title="Добавить значение">
              <span class="material-symbols-outlined text-[16px]">add</span>
            </button>
          </div>
          `}
        </div>
        
        <div class="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button class="flex-1 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-[18px]">history</span>
            <span class="truncate">
              Было: ${previousQuantity}
              <span class="${diffClass}"> · Разница: ${diffLabel}</span>
            </span>
          </button>
          <button class="item-comment-btn size-9 rounded-xl flex items-center justify-center ${hasComment ? 'text-primary bg-blue-50 dark:bg-blue-900/20' : 'text-slate-400 hover:text-primary hover:bg-blue-50 dark:hover:bg-slate-800'} active:scale-95 transition-all" data-item-id="${item.id}" title="Комментарий">
            <span class="material-symbols-outlined text-[20px]">${hasComment ? 'comment' : 'comment'}</span>
          </button>
          <button class="item-calculator-btn size-9 rounded-xl flex items-center justify-center text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 active:scale-95 transition-all" data-item-id="${item.id}" title="Калькулятор">
            <span class="material-symbols-outlined text-[20px]">calculate</span>
          </button>
        </div>
        
        ${hasComment ? `
        <div class="mt-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-100 dark:border-amber-800/30 flex items-start gap-3">
          <span class="material-symbols-outlined text-amber-600 dark:text-amber-500 text-[18px] mt-0.5">chat_bubble</span>
          <div class="flex-1">
            <p class="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">${escapedComment}</p>
          </div>
        </div>
        ` : ''}
      </div>
  `;
}

/**
 * Настроить обработчики для товаров
 * Используем делегирование событий для лучшей производительности
 */
function setupItemHandlers() {
  const container = document.getElementById('items-container');
  if (!container) return;

  // Используем делегирование событий - один обработчик на контейнере
  // Это работает даже для динамически добавленных элементов
  container.addEventListener('click', (e) => {
    const target = e.target.closest('[data-item-id]');
    if (!target) return;

    const itemId = target.getAttribute('data-item-id');
    if (!itemId) return;

    // Увеличение количества
    if (target.classList.contains('item-increase') || target.closest('.item-increase')) {
      e.preventDefault();
      e.stopPropagation();
      changeQuantity(itemId, 1);
      return;
    }

    // Уменьшение количества
    if (target.classList.contains('item-decrease') || target.closest('.item-decrease')) {
      e.preventDefault();
      e.stopPropagation();
      changeQuantity(itemId, -1);
      return;
    }

    // Добавление промежуточного значения (через модальное окно)
    if (target.classList.contains('item-add-addition') || target.closest('.item-add-addition')) {
      e.preventDefault();
      e.stopPropagation();
      showAdditionModal(itemId);
      return;
    }

    // Удаление промежуточного значения
    if (target.classList.contains('item-remove-addition') || target.closest('.item-remove-addition')) {
      e.preventDefault();
      e.stopPropagation();
      const index = parseInt(target.getAttribute('data-index') || target.closest('[data-index]')?.getAttribute('data-index') || '0');
      removeAddition(itemId, index);
      return;
    }

    // Кнопка сохранения отдельного товара
    if (target.classList.contains('item-save-btn') || target.closest('.item-save-btn')) {
      e.preventDefault();
      e.stopPropagation();
      saveItem(itemId);
      return;
    }

    // Кнопка комментария
    if (target.classList.contains('item-comment-btn') || target.closest('.item-comment-btn')) {
      e.preventDefault();
      e.stopPropagation();
      showCommentModal(itemId);
      return;
    }

    // Кнопка калькулятора
    if (target.classList.contains('item-calculator-btn') || target.closest('.item-calculator-btn')) {
      e.preventDefault();
      e.stopPropagation();
      showCalculatorModal(itemId);
      return;
    }

    // Клик по фото или названию для просмотра
    if (target.classList.contains('item-preview-btn') || target.closest('.item-preview-btn')) {
      e.preventDefault();
      e.stopPropagation();
      const btn = target.classList.contains('item-preview-btn') ? target : target.closest('.item-preview-btn');
      const image = btn.getAttribute('data-image') || '';
      const name = btn.getAttribute('data-name') || 'Без названия';
      const unit = btn.getAttribute('data-unit') || 'шт.';
      showPreviewModal(image, name, unit);
      return;
    }
  });

  // Обработка ввода количества (отдельно, так как это input событие)
  container.addEventListener('change', (e) => {
    if (e.target.classList.contains('item-quantity-input')) {
      const itemId = e.target.getAttribute('data-item-id');
      if (!itemId) return;

      const value = parseInt(e.target.value) || 0;

      // Вычитаем промежуточные значения из введенного значения, чтобы получить базовое
      const itemData = pageState.inventoryItems[itemId] || { additions: [] };
      const additionsSum = (itemData.additions || []).reduce((sum, val) => sum + val, 0);
      const baseQuantity = Math.max(0, value - additionsSum);

      setQuantity(itemId, baseQuantity);
    }
  });

  container.addEventListener('input', (e) => {
    if (e.target.classList.contains('item-quantity-input')) {
      // Предотвращаем ввод отрицательных чисел
      if (e.target.value < 0) {
        e.target.value = 0;
      }
    }
  });
}

/**
 * Изменить количество товара
 */
function changeQuantity(itemId, delta) {
  if (!pageState.inventoryItems[itemId]) {
    pageState.inventoryItems[itemId] = { baseQuantity: 0, comment: '', saved: false, additions: [] };
  }

  const currentBase = pageState.inventoryItems[itemId].baseQuantity || 0;
  const newBaseQuantity = Math.max(0, currentBase + delta);

  setQuantity(itemId, newBaseQuantity);
}

/**
 * Установить количество товара
 */
function setQuantity(itemId, baseQuantity) {
  if (!pageState.inventoryItems[itemId]) {
    pageState.inventoryItems[itemId] = { baseQuantity: 0, comment: '', saved: false, additions: [] };
  }

  // Устанавливаем базовое количество
  pageState.inventoryItems[itemId].baseQuantity = Math.max(0, baseQuantity);
  pageState.inventoryItems[itemId].saved = false;

  // Обновляем отображение (показываем общее количество)
  const additionsSum = (pageState.inventoryItems[itemId].additions || []).reduce((sum, val) => sum + val, 0);
  const totalQuantity = pageState.inventoryItems[itemId].baseQuantity + additionsSum;

  // Обновляем значение в инпуте, если он существует
  const input = document.querySelector(`.item-quantity-input[data-item-id="${itemId}"]`);
  if (input) {
    input.value = totalQuantity;

    // Обновляем статус сохранения (меняем на кнопку "сохранить")
    const cardWrapper = input.closest('.px-4');
    if (cardWrapper) {
      // Находим контейнер со статусом (рядом с единицей измерения)
      const statusContainer = cardWrapper.querySelector('.flex.items-center.gap-2.mt-1');
      if (statusContainer) {
        // Ищем статус "сохранено" (текст зелёного цвета)
        const savedStatus = statusContainer.querySelector('.text-green-600, .dark\\:text-green-400');
        if (savedStatus && !savedStatus.classList.contains('item-save-btn')) {
          // Заменяем на кнопку "сохранить"
          const unit = statusContainer.querySelector('.text-slate-500')?.textContent || 'шт.';
          statusContainer.innerHTML = `
            <span class="text-sm text-slate-500 dark:text-slate-400">${unit}</span>
            <button class="item-save-btn flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-primary hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors" data-item-id="${itemId}" title="Сохранить">
              <span class="material-symbols-outlined text-[12px]">save</span>
              сохранить
            </button>
          `;
        }
      }
    }
  } else {
    console.log(`Товар ${itemId} не найден в DOM (возможно, отфильтрован)`);
  }
}

/**
 * Добавить промежуточное значение
 */
function addAddition(itemId, value) {
  if (!pageState.inventoryItems[itemId]) {
    pageState.inventoryItems[itemId] = { baseQuantity: 0, comment: '', saved: false, additions: [] };
  }

  if (!pageState.inventoryItems[itemId].additions) {
    pageState.inventoryItems[itemId].additions = [];
  }

  // Добавляем новое промежуточное значение
  pageState.inventoryItems[itemId].additions.push(value);
  pageState.inventoryItems[itemId].saved = false;

  // Обновляем только эту карточку (вместо перерисовки всего списка)
  updateSingleItemCard(itemId);
}

/**
 * Удалить промежуточное значение
 */
function removeAddition(itemId, index) {
  if (!pageState.inventoryItems[itemId] || !pageState.inventoryItems[itemId].additions) {
    return;
  }

  // Удаляем промежуточное значение
  pageState.inventoryItems[itemId].additions.splice(index, 1);
  pageState.inventoryItems[itemId].saved = false;

  // Обновляем только эту карточку (вместо перерисовки всего списка)
  updateSingleItemCard(itemId);
}

/**
 * Обновить одну карточку товара без перерисовки всего списка
 * Оптимизированная версия для частых обновлений
 */
function updateSingleItemCard(itemId) {
  // Находим карточку в DOM
  const itemInput = document.querySelector(`.item-quantity-input[data-item-id="${itemId}"]`);
  if (!itemInput) {
    // Если карточка не найдена, перерисовываем весь список
    renderItems();
    return;
  }

  const cardWrapper = itemInput.closest('.px-4.mb-5');
  if (!cardWrapper) {
    renderItems();
    return;
  }

  // Находим товар в данных
  const item = pageState.allItems.find(i => i.id === itemId);
  if (!item) {
    renderItems();
    return;
  }

  // Создаём новую карточку
  const newCardHtml = renderItemCard(item);

  // Заменяем содержимое
  cardWrapper.innerHTML = newCardHtml;
}

/**
 * Сохранить отдельный товар
 * Оптимизированная версия с неблокирующим сохранением
 */
async function saveItem(itemId) {
  try {
    const itemData = pageState.inventoryItems[itemId];
    if (!itemData) return;

    const item = pageState.allItems.find(i => i.id === itemId);
    if (!item) return;

    // Сохраняем текущее состояние перед сохранением
    const currentScrollTop = document.getElementById('items-container')?.scrollTop || 0;

    // Вычисляем общее количество (базовое + промежуточные)
    const additionsSum = (itemData.additions || []).reduce((sum, val) => sum + val, 0);
    const totalQuantity = (itemData.baseQuantity || 0) + additionsSum;

    // Получаем предыдущее количество
    const previousQuantity = itemData.previousQuantity || 0;

    // Помечаем как сохраняемый, чтобы показать индикатор загрузки
    const wasSaved = itemData.saved;
    itemData.saved = false; // Временно, чтобы показать процесс сохранения

    // Сохраняем асинхронно, не блокируя интерфейс
    // Используем Promise.race с таймаутом для предотвращения зависаний
    const savePromise = inventory.addOrUpdateInventoryItem(
      pageState.sessionId,
      itemId,
      totalQuantity,
      previousQuantity,
      itemData.comment || null
    );

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Таймаут сохранения')), 10000)
    );

    try {
      await Promise.race([savePromise, timeoutPromise]);
      itemData.saved = true;

      // Обновляем только визуальное отображение сохраненного товара
      updateItemCard(itemId);

      // Восстанавливаем позицию прокрутки
      const container = document.getElementById('items-container');
      if (container) {
        requestAnimationFrame(() => {
          container.scrollTop = currentScrollTop;
        });
      }
    } catch (error) {
      // Восстанавливаем состояние при ошибке
      itemData.saved = wasSaved;
      console.warn('Ошибка сохранения товара (товар сохранен локально):', error);
      // Не показываем alert, чтобы не блокировать интерфейс
      // Товар все равно сохранен локально и будет синхронизирован позже
      updateItemCard(itemId);
    }

  } catch (error) {
    console.error('Критическая ошибка сохранения товара:', error);
    // Не показываем alert для критических ошибок, чтобы не блокировать интерфейс
  }
}

/**
 * Обновить карточку товара без перерисовки всего списка
 * Упрощённая версия - просто перерисовываем всю карточку
 */
function updateItemCard(itemId) {
  // Находим элемент товара в DOM
  const itemInput = document.querySelector(`.item-quantity-input[data-item-id="${itemId}"]`);
  if (!itemInput) {
    console.log(`Элемент товара ${itemId} не найден в DOM`);
    return;
  }

  // Находим обёртку карточки (px-4 mb-5 или px-4)
  const itemCard = itemInput.closest('.px-4');
  if (!itemCard) {
    console.log(`Карточка товара ${itemId} не найдена`);
    return;
  }

  const item = pageState.allItems.find(i => i.id === itemId);
  if (!item) {
    console.log(`Товар ${itemId} не найден в данных`);
    return;
  }

  // Просто перерисовываем HTML карточки целиком
  // Это проще и надёжнее, чем пытаться обновить отдельные элементы
  const newCardHtml = renderItemCard(item);
  itemCard.innerHTML = newCardHtml;
}

/**
 * Сохранить все товары
 * Оптимизированная версия с параллельным сохранением
 * 
 * @param {boolean} silent - Не показывать уведомления (для автосохранения)
 */
async function handleSaveAll(silent = false) {
  try {
    const unsavedItems = Object.keys(pageState.inventoryItems).filter(
      itemId => !pageState.inventoryItems[itemId].saved
    );

    if (unsavedItems.length === 0) {
      if (!silent) {
        showToast('Все изменения уже сохранены', 'info');
      }
      return;
    }

    // Показываем индикатор сохранения
    if (!silent) {
      showToast('Сохранение...', 'info', 1000);
    }

    // Сохраняем текущее состояние перед сохранением
    const currentScrollTop = document.getElementById('items-container')?.scrollTop || 0;

    // Сохраняем все несохраненные товары параллельно (но с ограничением)
    // Это быстрее, чем последовательное сохранение
    const savePromises = unsavedItems.map(itemId =>
      saveItem(itemId).catch(error => {
        console.warn(`Ошибка сохранения товара ${itemId}:`, error);
        return null; // Продолжаем сохранение других товаров
      })
    );

    // Ждем завершения всех сохранений (или таймаута)
    await Promise.allSettled(savePromises);

    // Восстанавливаем позицию прокрутки
    const container = document.getElementById('items-container');
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = currentScrollTop;
      });
    }

    // Показываем уведомление о результате
    const savedCount = unsavedItems.filter(itemId =>
      pageState.inventoryItems[itemId]?.saved
    ).length;

    if (savedCount > 0) {
      if (!silent) {
        showToast(`Сохранено ${savedCount} из ${unsavedItems.length} позиций`, 'success');
      }
      console.log(`Сохранено ${savedCount} из ${unsavedItems.length} позиций`);
    } else if (!silent) {
      showToast('Не удалось сохранить изменения', 'error');
    }

  } catch (error) {
    console.error('Ошибка сохранения прогресса:', error);
    if (!silent) {
      showToast('Ошибка сохранения', 'error');
    }
  }
}

/**
 * Настроить модальное окно комментария
 */
function setupCommentModal() {
  const modal = document.getElementById('comment-modal');
  const textarea = document.getElementById('comment-textarea');
  const saveBtn = document.getElementById('comment-save');
  const cancelBtn = document.getElementById('comment-cancel');

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const comment = textarea.value.trim();
      if (pageState.currentItemId) {
        if (!pageState.inventoryItems[pageState.currentItemId]) {
          pageState.inventoryItems[pageState.currentItemId] = { baseQuantity: 0, comment: '', saved: false, additions: [] };
        }
        pageState.inventoryItems[pageState.currentItemId].comment = comment;
        pageState.inventoryItems[pageState.currentItemId].saved = false;

        // Обновляем только эту карточку
        updateSingleItemCard(pageState.currentItemId);

        showToast(comment ? 'Комментарий сохранён' : 'Комментарий удалён', 'success');
      }
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    });
  }

  // Закрытие по клику на фон
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }
    });
  }
}

/**
 * Показать модальное окно комментария
 */
function showCommentModal(itemId) {
  pageState.currentItemId = itemId;
  const modal = document.getElementById('comment-modal');
  const textarea = document.getElementById('comment-textarea');

  const itemData = pageState.inventoryItems[itemId] || { comment: '' };
  textarea.value = itemData.comment || '';

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  textarea.focus();
}

/**
 * Настроить модальное окно калькулятора
 */
function setupCalculatorModal() {
  const modal = document.getElementById('calculator-modal');
  const display = document.getElementById('calc-display');
  const applyBtn = document.getElementById('calc-apply');
  const closeBtn = document.getElementById('calc-close');

  // Обработчики кнопок калькулятора
  document.querySelectorAll('.calc-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = e.currentTarget.getAttribute('data-calc');
      handleCalculatorAction(action);
    });
  });

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      applyCalculatorResult();
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      resetCalculator();
    });
  }

  // Закрытие по клику на фон
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        resetCalculator();
      }
    });
  }
}

/**
 * Безопасный парсер математических выражений (без eval)
 * Поддерживает: +, -, *, /
 * 
 * @param {string} expression - Математическое выражение
 * @returns {number} - Результат вычисления
 */
function safeCalculate(expression) {
  // Удаляем все символы кроме цифр и операторов
  const cleanExpr = expression.replace(/[^0-9+\-*/]/g, '');

  // Разбиваем на токены (числа и операторы)
  const tokens = cleanExpr.match(/(\d+|[+\-*/])/g);
  if (!tokens || tokens.length === 0) return 0;

  // Сначала обрабатываем умножение и деление (приоритет операций)
  let i = 0;
  while (i < tokens.length) {
    if (tokens[i] === '*' || tokens[i] === '/') {
      const left = parseInt(tokens[i - 1]) || 0;
      const right = parseInt(tokens[i + 1]) || 0;
      let result;

      if (tokens[i] === '*') {
        result = left * right;
      } else {
        result = right !== 0 ? Math.floor(left / right) : 0;
      }

      // Заменяем три элемента (число, оператор, число) на результат
      tokens.splice(i - 1, 3, result.toString());
      i = 0; // Начинаем сначала
    } else {
      i++;
    }
  }

  // Теперь обрабатываем сложение и вычитание
  let result = parseInt(tokens[0]) || 0;
  for (let j = 1; j < tokens.length; j += 2) {
    const operator = tokens[j];
    const operand = parseInt(tokens[j + 1]) || 0;

    if (operator === '+') {
      result += operand;
    } else if (operator === '-') {
      result -= operand;
    }
  }

  return Math.floor(result);
}

/**
 * Обработка действий калькулятора
 */
function handleCalculatorAction(action) {
  const display = document.getElementById('calc-display');
  if (!display) return;

  if (action === 'clear') {
    pageState.calculatorValue = '0';
    pageState.calculatorResult = null;
    display.textContent = '0';
  } else if (action === 'backspace') {
    if (pageState.calculatorValue.length > 1) {
      pageState.calculatorValue = pageState.calculatorValue.slice(0, -1);
    } else {
      pageState.calculatorValue = '0';
    }
    display.textContent = pageState.calculatorValue;
  } else if (action === '=') {
    try {
      // Безопасное вычисление без eval()
      const result = safeCalculate(pageState.calculatorValue);
      pageState.calculatorResult = result;
      pageState.calculatorValue = result.toString();
      display.textContent = result.toString();
    } catch (error) {
      display.textContent = 'Ошибка';
      pageState.calculatorValue = '0';
    }
  } else {
    if (pageState.calculatorValue === '0' && !['+', '-', '*', '/'].includes(action)) {
      pageState.calculatorValue = action;
    } else {
      pageState.calculatorValue += action;
    }
    display.textContent = pageState.calculatorValue;
  }
}

/**
 * Применить результат калькулятора
 */
function applyCalculatorResult() {
  if (pageState.calculatorResult !== null && pageState.currentItemId) {
    setQuantity(pageState.currentItemId, pageState.calculatorResult);
    resetCalculator();
  }
}

/**
 * Сбросить калькулятор
 */
function resetCalculator() {
  pageState.calculatorValue = '0';
  pageState.calculatorResult = null;
  const display = document.getElementById('calc-display');
  if (display) {
    display.textContent = '0';
  }
}

/**
 * Показать модальное окно калькулятора
 */
function showCalculatorModal(itemId) {
  pageState.currentItemId = itemId;
  const modal = document.getElementById('calculator-modal');
  resetCalculator();

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

/**
 * Показать Toast-уведомление
 * 
 * @param {string} message - Текст уведомления
 * @param {string} type - Тип уведомления: 'success', 'error', 'info'
 * @param {number} duration - Длительность показа в мс
 */
function showToast(message, type = 'info', duration = 2500) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  // Устанавливаем текст и иконку
  const icon = toast.querySelector('.toast-icon');
  const text = toast.querySelector('.toast-text');

  if (text) text.textContent = message;

  // Устанавливаем иконку в зависимости от типа
  if (icon) {
    switch (type) {
      case 'success':
        icon.textContent = 'check_circle';
        icon.className = 'toast-icon material-symbols-outlined text-green-400 text-[20px]';
        break;
      case 'error':
        icon.textContent = 'error';
        icon.className = 'toast-icon material-symbols-outlined text-red-400 text-[20px]';
        break;
      default:
        icon.textContent = 'info';
        icon.className = 'toast-icon material-symbols-outlined text-blue-400 text-[20px]';
    }
  }

  // Показываем toast
  toast.classList.remove('opacity-0', 'translate-y-4');
  toast.classList.add('opacity-100', 'translate-y-0');

  // Скрываем через указанное время
  setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'translate-y-4');
  }, duration);
}

/**
 * Показать модальное окно для добавления промежуточного значения
 */
function showAdditionModal(itemId) {
  pageState.currentItemId = itemId;
  const modal = document.getElementById('addition-modal');
  const input = document.getElementById('addition-input');

  if (!modal || !input) {
    // Fallback если модальное окно не найдено
    const value = prompt('Введите количество для добавления:');
    if (value !== null) {
      const numValue = parseInt(value);
      if (!isNaN(numValue) && numValue > 0) {
        addAddition(itemId, numValue);
      }
    }
    return;
  }

  // Очищаем и фокусируем input
  input.value = '';

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  // Фокус на input после открытия модального окна
  setTimeout(() => input.focus(), 100);
}

/**
 * Настроить модальное окно добавления количества
 */
function setupAdditionModal() {
  const modal = document.getElementById('addition-modal');
  const input = document.getElementById('addition-input');
  const confirmBtn = document.getElementById('addition-confirm');
  const cancelBtn = document.getElementById('addition-cancel');

  if (!modal) return;

  // Подтверждение
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      const value = parseInt(input.value);
      if (!isNaN(value) && value > 0 && pageState.currentItemId) {
        addAddition(pageState.currentItemId, value);
        showToast(`Добавлено: +${value}`, 'success');
      } else if (input.value !== '') {
        showToast('Введите положительное число', 'error');
        return;
      }
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    });
  }

  // Отмена
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    });
  }

  // Enter для подтверждения
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        confirmBtn?.click();
      } else if (e.key === 'Escape') {
        cancelBtn?.click();
      }
    });
  }

  // Закрытие по клику на фон
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  });
}

/**
 * Настроить модальное окно просмотра товара (фото + название)
 */
function setupPreviewModal() {
  const modal = document.getElementById('item-preview-modal');
  const closeBtn = document.getElementById('preview-close');

  if (!modal) return;

  // Закрытие по кнопке
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    });
  }

  // Закрытие по клику на фон
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  });

  // Закрытие по Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  });
}

/**
 * Показать модальное окно просмотра товара
 * 
 * @param {string} imageUrl - URL изображения товара
 * @param {string} name - Название товара
 * @param {string} unit - Единица измерения
 */
function showPreviewModal(imageUrl, name, unit) {
  const modal = document.getElementById('item-preview-modal');
  const previewImage = document.getElementById('preview-image');
  const previewName = document.getElementById('preview-name');
  const previewUnit = document.getElementById('preview-unit');

  if (!modal) return;

  // Устанавливаем данные
  if (previewImage) {
    if (imageUrl) {
      previewImage.style.backgroundImage = `url('${imageUrl}')`;
      previewImage.classList.remove('hidden');
    } else {
      // Показываем плейсхолдер если нет фото
      previewImage.style.backgroundImage = 'none';
      previewImage.innerHTML = '<span class="material-symbols-outlined text-[80px] text-slate-400">image</span>';
      previewImage.classList.add('flex', 'items-center', 'justify-center');
    }
  }

  if (previewName) {
    // Декодируем HTML-сущности
    previewName.textContent = name.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }

  if (previewUnit) {
    previewUnit.textContent = unit;
  }

  // Показываем модальное окно
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

/**
 * Настроить отслеживание активной категории при прокрутке
 */
function setupCategoryObserver() {
  // Отключаем предыдущий observer, если был
  if (pageState.virtualScroll.intersectionObserver) {
    pageState.virtualScroll.intersectionObserver.disconnect();
  }

  // Создаем новый Intersection Observer для отслеживания видимых категорий
  const options = {
    root: document.getElementById('items-container'),
    rootMargin: '-20% 0px -70% 0px', // Категория считается активной, когда она в верхней трети экрана
    threshold: 0
  };

  pageState.virtualScroll.intersectionObserver = new IntersectionObserver((entries) => {
    // Находим последнюю видимую категорию
    let lastVisibleCategory = null;
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const categoryId = entry.target.id;
        if (categoryId && categoryId.startsWith('category-')) {
          lastVisibleCategory = categoryId;
        }
      }
    });

    // Обновляем активную категорию
    if (lastVisibleCategory) {
      updateActiveCategoryFromId(lastVisibleCategory);
    }
  }, options);

  // Наблюдаем за всеми секциями категорий
  const categorySections = document.querySelectorAll('.category-section');
  categorySections.forEach(section => {
    pageState.virtualScroll.intersectionObserver.observe(section);
  });

  // Также обновляем плавающую навигацию
  updateFloatingNavigation();
}

/**
 * Обновить активную категорию из ID
 */
function updateActiveCategoryFromId(categoryId) {
  // Извлекаем название категории из ID
  let categoryKey = '';
  if (categoryId === 'category-all') {
    categoryKey = '';
  } else {
    categoryKey = categoryId.replace('category-', '');
  }

  // Обновляем стили всех кнопок категорий (обычных и плавающих) без прокрутки
  document.querySelectorAll('.category-btn').forEach(btn => {
    const btnCategory = btn.getAttribute('data-category') || '';
    const isFloating = btn.classList.contains('floating-category-btn');

    if (btnCategory === categoryKey) {
      if (isFloating) {
        btn.classList.remove('text-slate-600', 'dark:text-slate-400');
        btn.classList.add('bg-primary', 'text-white', 'dark:bg-blue-600', 'dark:text-white', 'font-bold');
      } else {
        btn.classList.remove('bg-white', 'dark:bg-surface-dark', 'text-slate-600', 'dark:text-slate-300');
        btn.classList.add('bg-slate-900', 'dark:bg-white', 'text-white', 'dark:text-slate-900', 'shadow-md');
      }
    } else {
      if (isFloating) {
        btn.classList.remove('bg-primary', 'text-white', 'dark:bg-blue-600', 'dark:text-white', 'font-bold');
        btn.classList.add('text-slate-600', 'dark:text-slate-400');
      } else {
        btn.classList.remove('bg-slate-900', 'dark:bg-white', 'text-white', 'dark:text-slate-900', 'shadow-md');
        btn.classList.add('bg-white', 'dark:bg-surface-dark', 'text-slate-600', 'dark:text-slate-300');
      }
    }
  });

  // Обновляем плавающую навигацию
  updateFloatingNavigation();
}

/**
 * Инициализировать плавающую навигацию
 * Обработчики событий теперь настраиваются в setupEventHandlers через делегирование
 */
function initFloatingNavigation() {
  const floatingNav = document.getElementById('floating-category-nav');
  if (!floatingNav) return;

  // Обновляем стили плавающих кнопок при изменении активной категории
  updateFloatingNavigation();
}

/**
 * Обновить плавающую навигацию
 */
function updateFloatingNavigation() {
  const floatingNav = document.getElementById('floating-category-nav');
  if (!floatingNav) return;

  // Находим активную категорию
  const activeCategoryBtn = document.querySelector('.category-btn.bg-slate-900, .category-btn.dark\\:bg-white');
  let activeCategoryName = 'Все';

  if (activeCategoryBtn) {
    activeCategoryName = activeCategoryBtn.textContent.trim() || 'Все';
    const categoryKey = activeCategoryBtn.getAttribute('data-category') || '';

    // Обновляем стили плавающих кнопок
    floatingNav.querySelectorAll('.floating-category-btn').forEach(btn => {
      const btnCategory = btn.getAttribute('data-category') || '';
      if (btnCategory === categoryKey) {
        btn.classList.remove('text-slate-600', 'dark:text-slate-400');
        btn.classList.add('bg-primary', 'text-white', 'dark:bg-blue-600', 'dark:text-white', 'font-bold');
      } else {
        btn.classList.remove('bg-primary', 'text-white', 'dark:bg-blue-600', 'dark:text-white', 'font-bold');
        btn.classList.add('text-slate-600', 'dark:text-slate-400');
      }
    });
  }

  // Обновляем заголовок
  const navTitle = floatingNav.querySelector('.floating-nav-title');
  if (navTitle) {
    navTitle.textContent = activeCategoryName;
  }
}

/**
 * Умное позиционирование кнопки сохранения
 * - Когда контента мало: кнопка сразу под контентом
 * - Когда контент не помещается: кнопка прилипает к низу экрана
 */
function setupSmartSaveButton() {
  const btnContainer = document.getElementById('save-btn-container');
  if (!btnContainer) return;

  // Базовые стили кнопки (static позиция)
  const staticClasses = 'px-4 py-4 flex justify-center';
  // Стили для fixed позиции
  const fixedClasses = 'fixed bottom-0 left-0 right-0 px-4 py-4 flex justify-center z-50 bg-gradient-to-t from-background-light via-background-light/95 to-transparent dark:from-background-dark dark:via-background-dark/95';

  function updateButtonPosition() {
    const container = btnContainer;
    const rect = container.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    // Проверяем, видна ли кнопка на экране (с учётом её высоты ~80px)
    const isVisible = rect.top < windowHeight - 20;

    if (isVisible) {
      // Кнопка видна - используем static позицию
      container.className = staticClasses;
    } else {
      // Кнопка не видна - делаем fixed
      container.className = fixedClasses;
    }
  }

  // Обновляем позицию при загрузке
  updateButtonPosition();

  // Обновляем при прокрутке
  window.addEventListener('scroll', debounce(updateButtonPosition, 50), { passive: true });

  // Обновляем при изменении размера окна
  window.addEventListener('resize', debounce(updateButtonPosition, 100), { passive: true });

  // Также обновляем после рендеринга товаров
  // Сохраняем функцию для вызова из renderItems
  window.updateSaveButtonPosition = updateButtonPosition;
}

// Инициализация при загрузке страницы
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}

