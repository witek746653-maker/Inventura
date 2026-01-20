/**
 * Главный файл приложения
 * 
 * Этот файл инициализирует приложение, настраивает навигацию
 * и подключает обработчики событий к HTML страницам.
 */

import { initDB } from './db.js';
import * as db from './db.js';
import { setupAutoSync } from './sync.js';
import * as items from './items.js';
import * as inventory from './inventory.js';
import * as supabase from './supabase.js';
import { showConfirm, showDangerConfirm, showAlert, showModal, closeModal } from './modal.js';

// Состояние приложения
const appState = {
  initialized: false,
  currentPage: null
};

/**
 * Инициализация приложения
 * Вызывается при загрузке страницы
 */
export async function initApp() {
  if (appState.initialized) {
    return;
  }

  console.log('Инициализация приложения...');

  try {
    // Инициализируем локальную базу данных
    await initDB();
    console.log('База данных инициализирована');

    // Настраиваем автоматическую синхронизацию
    setupAutoSync();
    console.log('Автоматическая синхронизация настроена');

    // Определяем текущую страницу
    const currentPage = getCurrentPage();
    appState.currentPage = currentPage;

    // Инициализируем страницу
    initPage(currentPage);

    // Настраиваем навигацию
    setupNavigation();

    // Настраиваем кнопки справки
    setupHelpButtons();

    appState.initialized = true;
    console.log('Приложение инициализировано');
  } catch (error) {
    console.error('Ошибка инициализации приложения:', error);
    showError('Не удалось инициализировать приложение. Проверьте консоль для деталей.');
  }
}

/**
 * Определить текущую страницу по имени файла
 * 
 * @returns {string} - Название страницы
 */
function getCurrentPage() {
  const path = window.location.pathname;
  const filename = path.split('/').pop() || 'index.html';

  // Проверяем главную страницу
  if (filename === 'index.html' || filename === '' || filename === '/') return 'inventory';

  if (filename.includes('inventory.html')) return 'inventory';
  if (filename.includes('items.html') && !filename.includes('items-management.html')) return 'items';
  if (filename.includes('inventory-session.html')) return 'inventory-session';
  if (filename.includes('item-details.html')) return 'item-details';
  if (filename.includes('items-management.html')) return 'items-management';
  if (filename.includes('items-import.html')) return 'items-import';
  if (filename.includes('inventory-history.html')) return 'inventory-history';

  return 'inventory'; // По умолчанию
}

/**
 * Инициализировать конкретную страницу
 * 
 * @param {string} pageName - Название страницы
 */
function initPage(pageName) {
  console.log('Инициализация страницы:', pageName);

  switch (pageName) {
    case 'inventory':
      initInventoryPage();
      break;
    case 'items':
      initItemsPage();
      break;
    case 'inventory-session':
      // Страница inventory-session.html использует свой собственный модуль inventory-session.js
      // для инициализации, поэтому здесь ничего не делаем
      break;
    case 'item-details':
      initItemDetailsPage();
      break;
    case 'items-import':
      initItemsImportPage();
      break;
    case 'items-management':
      initItemsManagementPage();
      break;
    case 'inventory-history':
      initInventoryHistoryPage();
      break;
  }
}

/**
 * Настроить навигацию между страницами
 */
function setupNavigation() {
  // Обработчики для кнопок навигации
  document.querySelectorAll('a[href], button[data-navigate]').forEach(element => {
    element.addEventListener('click', (e) => {
      const href = element.getAttribute('href') || element.getAttribute('data-navigate');
      if (href && href !== '#' && !href.startsWith('http')) {
        e.preventDefault();
        navigateTo(href);
      }
    });
  });

  // Обработчики для кнопок "Назад"
  document.querySelectorAll('[data-back]').forEach(button => {
    button.addEventListener('click', () => {
      window.history.back();
    });
  });

  // Подсветка активной кнопки навигации
  highlightActiveNavButton();
}

/**
 * Подсветка активной кнопки навигации
 */
function highlightActiveNavButton() {
  // Определяем текущую страницу
  const path = window.location.pathname;
  const filename = path.split('/').pop() || 'index.html';

  let activePage = 'index';
  if (filename.includes('items.html') && !filename.includes('items-import.html') && !filename.includes('items-management.html')) {
    activePage = 'items';
  } else if (filename.includes('items-management.html')) {
    activePage = 'management';
  } else if (filename.includes('items-import.html')) {
    activePage = 'import';
  } else if (filename.includes('inventory-history.html')) {
    activePage = 'history';
  } else if (filename === 'index.html' || filename === '' || filename === '/') {
    activePage = 'index';
  }

  // Находим все кнопки навигации
  const navButtons = document.querySelectorAll('.nav-button[data-nav-page]');

  navButtons.forEach(button => {
    const pageId = button.getAttribute('data-nav-page');
    const icon = button.querySelector('.material-symbols-outlined');
    const label = button.querySelector('span:last-child');

    // Сбрасываем стили
    button.classList.remove('text-primary');
    button.classList.add('text-slate-400', 'dark:text-slate-500');
    if (icon) {
      icon.classList.remove('filled-icon');
    }
    if (label) {
      label.classList.remove('font-bold');
      label.classList.add('font-medium');
    }

    // Применяем активные стили для текущей страницы
    if (pageId === activePage) {
      button.classList.remove('text-slate-400', 'dark:text-slate-500');
      button.classList.add('text-primary');
      if (icon) {
        icon.classList.add('filled-icon');
      }
      if (label) {
        label.classList.remove('font-medium');
        label.classList.add('font-bold');
      }
    }
  });
}

/**
 * Переход на другую страницу
 * 
 * @param {string} path - Путь к странице
 */
function navigateTo(path) {
  window.location.href = path;
}

/**
 * Инициализация главной страницы инвентаризации
 */
async function initInventoryPage() {
  try {
    // Загружаем активную сессию
    const sessions = await inventory.getAllInventorySessions();
    const activeSession = sessions.find(s => s.status === 'in_progress');

    const continueButton = document.querySelector('[data-continue-session]');
    const newSessionButton = document.querySelector('[data-new-session]');

    // Загружаем статистику товаров, секций склада и категорий
    const allItems = await items.getAllItems();
    // Фиксированные секции склада и категории
    const warehouseSections = ['Бар', 'Кухня', 'Склад', 'Другое'];
    const categories = ['Посуда', 'Бокалы', 'Приборы', 'Инвентарь', 'Расходники', 'Прочее'];

    // Обновляем статистику на странице
    const totalItemsEl = document.getElementById('total-items');
    const totalWarehouseSectionsEl = document.getElementById('total-warehouse-sections');
    const totalCategoriesEl = document.getElementById('total-categories');

    if (totalItemsEl) {
      totalItemsEl.textContent = `${allItems.length} шт.`;
    }
    if (totalWarehouseSectionsEl) {
      totalWarehouseSectionsEl.textContent = warehouseSections.length.toString();
    }
    if (totalCategoriesEl) {
      totalCategoriesEl.textContent = categories.length.toString();
    }

    // Обновляем дату
    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) {
      const today = new Date();
      const options = { day: 'numeric', month: 'long', year: 'numeric' };
      currentDateEl.textContent = today.toLocaleDateString('ru-RU', options);
    }

    if (activeSession) {
      // Обновляем информацию о сессии на странице
      await updateInventoryOverview(activeSession, allItems.length);

      // Показываем кнопку "Продолжить" и "Закончить", скрываем "Начать новую"
      if (continueButton) {
        continueButton.style.display = 'block';
        // Удаляем старые обработчики, если они есть
        continueButton.replaceWith(continueButton.cloneNode(true));
        const newContinueButton = document.querySelector('[data-continue-session]');
        newContinueButton.addEventListener('click', () => {
          navigateTo(`inventory-session.html?id=${activeSession.id}`);
        });
      }

      // Показываем кнопку "Закончить инвентаризацию"
      const completeButton = document.querySelector('[data-complete-session]');
      if (completeButton) {
        completeButton.style.display = 'block';
        completeButton.replaceWith(completeButton.cloneNode(true));
        const newCompleteButton = document.querySelector('[data-complete-session]');
        newCompleteButton.addEventListener('click', () => {
          showCompleteModal(activeSession.id);
        });
      }

      if (newSessionButton) {
        newSessionButton.style.display = 'none';
      }
    } else {
      // Скрываем информацию о сессии
      const sessionStatusEl = document.getElementById('session-status');
      const sessionProgressEl = document.getElementById('session-progress');
      const sessionTitleEl = document.getElementById('session-title');

      if (sessionStatusEl) sessionStatusEl.style.display = 'none';
      if (sessionProgressEl) sessionProgressEl.style.display = 'none';
      if (sessionTitleEl) {
        sessionTitleEl.textContent = 'Нет активной сессии';
      }

      // Скрываем кнопку "Продолжить" и "Закончить", показываем "Начать новую"
      if (continueButton) {
        continueButton.style.display = 'none';
      }

      const completeButton = document.querySelector('[data-complete-session]');
      if (completeButton) {
        completeButton.style.display = 'none';
      }

      if (newSessionButton) {
        newSessionButton.style.display = 'block';
        // Удаляем старые обработчики, если они есть
        newSessionButton.replaceWith(newSessionButton.cloneNode(true));
        const newNewSessionButton = document.querySelector('[data-new-session]');
        newNewSessionButton.addEventListener('click', async () => {
          try {
            const today = new Date().toISOString().split('T')[0];
            const newSession = await inventory.createInventorySession({
              date: today,
              status: 'in_progress'
            });
            navigateTo(`inventory-session.html?id=${newSession.id}`);
          } catch (error) {
            console.error('Ошибка создания новой сессии:', error);
            showError('Не удалось создать новую сессию инвентаризации');
          }
        });
      }
    }

    // Загружаем отчеты для истории
    try {
      const reports = await inventory.getAllInventoryReports();
      const sortedReports = reports
        .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
        .slice(0, 5);
      updateInventoryHistory(sortedReports);
    } catch (error) {
      console.warn('Не удалось загрузить отчеты:', error);
      // Показываем сессии как запасной вариант
      const historySessions = sessions
        .filter(s => s.status === 'completed')
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
      updateInventoryHistory(historySessions);
    }
  } catch (error) {
    console.error('Ошибка инициализации страницы инвентаризации:', error);
  }
}

/**
 * Обновить обзор инвентаризации на главной странице
 * 
 * @param {Object} session - Сессия инвентаризации
 * @param {number} totalItems - Общее количество товаров в базе
 */
async function updateInventoryOverview(session, totalItems) {
  try {
    // Получаем записи инвентаризации для этой сессии
    const inventoryItems = await inventory.getInventoryItemsBySession(session.id);
    const processedCount = inventoryItems.length;

    // Рассчитываем прогресс
    const progressPercent = totalItems > 0 ? Math.round((processedCount / totalItems) * 100) : 0;

    // Обновляем статус сессии
    const sessionStatusEl = document.getElementById('session-status');
    if (sessionStatusEl) {
      sessionStatusEl.style.display = 'inline-flex';
    }

    // Обновляем название сессии
    const sessionTitleEl = document.getElementById('session-title');
    if (sessionTitleEl) {
      const sessionDate = new Date(session.date);
      const options = { day: 'numeric', month: 'long', year: 'numeric' };
      sessionTitleEl.textContent = `Инвентаризация от ${sessionDate.toLocaleDateString('ru-RU', options)}`;
    }

    // Обновляем прогресс
    const sessionProgressEl = document.getElementById('session-progress');
    const progressBarEl = document.getElementById('progress-bar');
    const progressPercentEl = document.getElementById('progress-percent');
    const progressTextEl = document.getElementById('progress-text');

    if (sessionProgressEl) {
      sessionProgressEl.style.display = 'block';
    }

    if (progressBarEl) {
      progressBarEl.style.width = `${progressPercent}%`;
    }

    if (progressPercentEl) {
      progressPercentEl.textContent = `${progressPercent}%`;
    }

    if (progressTextEl) {
      progressTextEl.textContent = `Обработано ${processedCount} из ${totalItems} позиций`;
    }

    // Проверяем расхождения
    const warningsSection = document.getElementById('warnings-section');
    const warningsText = document.getElementById('warnings-text');
    const itemsWithDifference = inventoryItems.filter(item =>
      item.difference !== null && item.difference !== 0
    );

    if (itemsWithDifference.length > 0 && warningsSection && warningsText) {
      warningsSection.style.display = 'flex';
      const positiveCount = itemsWithDifference.filter(item => item.difference > 0).length;
      const negativeCount = itemsWithDifference.filter(item => item.difference < 0).length;

      let warningMessage = `Обнаружено ${itemsWithDifference.length} расхождений: `;
      if (positiveCount > 0) {
        warningMessage += `+${positiveCount} излишек`;
      }
      if (positiveCount > 0 && negativeCount > 0) {
        warningMessage += ', ';
      }
      if (negativeCount > 0) {
        warningMessage += `-${negativeCount} недостача`;
      }

      warningsText.textContent = warningMessage;
    } else if (warningsSection) {
      warningsSection.style.display = 'none';
    }
  } catch (error) {
    console.error('Ошибка обновления обзора инвентаризации:', error);
  }
}

/**
 * Обновить историю инвентаризаций
 * 
 * @param {Array} sessions - Массив сессий
 */
function updateInventoryHistory(reports) {
  const historyListEl = document.getElementById('history-list');
  if (!historyListEl) return;

  if (reports.length === 0) {
    historyListEl.innerHTML = `
      <div class="text-center py-8 text-slate-400 dark:text-slate-500">
        <span class="material-symbols-outlined text-4xl mb-2">history</span>
        <p class="text-sm">История инвентаризаций пуста</p>
      </div>
    `;
    return;
  }

  historyListEl.innerHTML = reports.map(report => {
    const reportDate = new Date(report.date || report.created_at);
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    const formattedDate = reportDate.toLocaleDateString('ru-RU', options);

    return `
      <div class="bg-surface-light dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div class="flex-1">
          <h4 class="font-bold text-slate-900 dark:text-white mb-1">${formattedDate}</h4>
          <p class="text-xs text-slate-500 dark:text-slate-400">${report.total_items || 0} позиций</p>
        </div>
        <button class="text-primary hover:text-blue-600 transition-colors" data-navigate="inventory-history.html">
          <span class="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
    `;
  }).join('');

  // Добавляем обработчики для кнопок навигации
  historyListEl.querySelectorAll('[data-navigate]').forEach(button => {
    button.addEventListener('click', () => {
      navigateTo(button.getAttribute('data-navigate'));
    });
  });
}

/**
 * Показать модальное окно для завершения инвентаризации
 * 
 * @param {string} sessionId - ID сессии
 */
function showCompleteModal(sessionId) {
  const modal = document.getElementById('complete-modal');
  if (!modal) return;

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  // Обработчик кнопки "Сформировать отчет"
  const yesButton = document.getElementById('complete-yes');
  const cancelButton = document.getElementById('complete-cancel');

  const handleYes = async () => {
    try {
      // Создаем отчет
      const report = await inventory.createInventoryReport(sessionId);

      // Завершаем сессию
      await inventory.completeInventorySession(sessionId);

      showSuccess('Отчет сформирован и сохранен');

      // Закрываем модальное окно
      modal.classList.add('hidden');
      modal.classList.remove('flex');

      // Обновляем страницу через небольшую задержку
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Ошибка завершения инвентаризации:', error);
      showError('Не удалось завершить инвентаризацию и создать отчет');
    }
  };

  const handleCancel = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  };

  // Удаляем старые обработчики и добавляем новые
  const newYesButton = yesButton.cloneNode(true);
  yesButton.parentNode.replaceChild(newYesButton, yesButton);
  newYesButton.addEventListener('click', handleYes);

  const newCancelButton = cancelButton.cloneNode(true);
  cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);
  newCancelButton.addEventListener('click', handleCancel);
}

/**
 * Инициализация страницы списка товаров
 */
async function initItemsPage() {
  try {
    // Загружаем товары
    const allItems = await items.getAllItems();

    // Сохраняем все товары для фильтрации
    window.currentItems = allItems;
    window.currentCategory = 'all';

    // Отображаем товары
    renderItemsList(allItems);

    // Настраиваем поиск в реальном времени
    const searchInput = document.querySelector('input[type="search"], input[placeholder*="Поиск"]');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', async (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        // Задержка для оптимизации поиска
        searchTimeout = setTimeout(async () => {
          let filteredItems = allItems;

          // Применяем фильтр категории, если выбран
          if (window.currentCategory && window.currentCategory !== 'all') {
            filteredItems = filteredItems.filter(item => item.category === window.currentCategory);
          }

          // Применяем поиск
          if (query) {
            const lowerQuery = query.toLowerCase();
            filteredItems = filteredItems.filter(item => {
              const name = (item.name || '').toLowerCase();
              const category = (item.category || '').toLowerCase();
              const sku = item.sku ? String(item.sku).toLowerCase() : '';
              return name.includes(lowerQuery) || category.includes(lowerQuery) || sku.includes(lowerQuery);
            });
          }

          renderItemsList(filteredItems);
        }, 300);
      });
    }

    // Настраиваем фильтры по категориям
    // Ищем все кнопки в области фильтров
    const filterContainer = document.querySelector('.flex.gap-2.px-4.py-2');
    if (filterContainer) {
      const categoryButtons = filterContainer.querySelectorAll('button');

      categoryButtons.forEach(button => {
        button.addEventListener('click', async () => {
          const buttonText = button.querySelector('p')?.textContent.trim() || button.textContent.trim();

          // Убираем активный класс со всех кнопок
          categoryButtons.forEach(btn => {
            btn.classList.remove('bg-primary', 'text-white', 'shadow-sm');
            btn.classList.add('bg-white', 'dark:bg-slate-800', 'border', 'border-slate-200', 'dark:border-slate-700', 'text-slate-700', 'dark:text-slate-300');
            const p = btn.querySelector('p');
            if (p) p.classList.remove('text-white');
            if (p) p.classList.add('text-slate-700', 'dark:text-slate-300');
          });

          // Добавляем активный класс к выбранной кнопке
          button.classList.remove('bg-white', 'dark:bg-slate-800', 'border', 'border-slate-200', 'dark:border-slate-700', 'text-slate-700', 'dark:text-slate-300');
          button.classList.add('bg-primary', 'text-white', 'shadow-sm');
          const p = button.querySelector('p');
          if (p) {
            p.classList.remove('text-slate-700', 'dark:text-slate-300');
            p.classList.add('text-white');
          }

          let filteredItems = allItems;
          const searchQuery = searchInput?.value.trim() || '';

          // Определяем категорию
          if (buttonText === 'Все') {
            window.currentCategory = 'all';
          } else {
            window.currentCategory = buttonText;
            filteredItems = filteredItems.filter(item => item.category === buttonText);
          }

          // Применяем поиск, если есть
          if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            filteredItems = filteredItems.filter(item => {
              const name = (item.name || '').toLowerCase();
              const category = (item.category || '').toLowerCase();
              const sku = item.sku ? String(item.sku).toLowerCase() : '';
              return name.includes(lowerQuery) || category.includes(lowerQuery) || sku.includes(lowerQuery);
            });
          }

          renderItemsList(filteredItems);
        });
      });
    }

    // Настраиваем клики на элементы списка для перехода на страницу деталей
    setupItemClickHandlers();

    // Также обрабатываем существующие статические элементы на странице (если они есть)
    // Это для обратной совместимости, если на странице уже есть разметка товаров
    setTimeout(() => {
      const existingStaticItems = document.querySelectorAll('main > div.cursor-pointer:not([data-item-id])');
      existingStaticItems.forEach((itemEl) => {
        // Добавляем обработчик клика для статических элементов
        itemEl.addEventListener('click', (e) => {
          // Пытаемся найти название товара в элементе
          const nameElement = itemEl.querySelector('p.text-base.font-semibold');
          if (nameElement) {
            const itemName = nameElement.textContent.trim();
            // Ищем товар по имени в загруженных данных
            const foundItem = allItems.find(item => item.name === itemName);
            if (foundItem) {
              navigateTo(`item-details.html?id=${foundItem.id}`);
            } else {
              // Если товар не найден, можем создать временный ID или просто показать сообщение
              console.log('Товар не найден в базе данных:', itemName);
            }
          }
        });
      });
    }, 100);

    // Инициализируем модальное окно добавления товара
    initAddItemModal();
  } catch (error) {
    console.error('Ошибка инициализации страницы товаров:', error);
  }
}

/**
 * Инициализация модального окна добавления товара
 */
function initAddItemModal() {
  const modal = document.getElementById('add-item-modal');
  const fabButton = document.getElementById('add-item-fab');
  const closeButton = document.getElementById('close-add-item-modal');
  const cancelButton = document.getElementById('add-item-cancel');
  const saveButton = document.getElementById('add-item-save');

  if (!modal || !fabButton) return;

  // Открытие модального окна
  const openModal = () => {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    // Сбрасываем форму
    resetAddItemForm();
  };

  // Закрытие модального окна
  const closeModal = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    resetAddItemForm();
  };

  // Обработчики открытия
  fabButton.addEventListener('click', openModal);

  // Обработчики закрытия
  if (closeButton) closeButton.addEventListener('click', closeModal);
  if (cancelButton) cancelButton.addEventListener('click', closeModal);

  // Закрытие при клике на фон
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Инициализация полей формы
  setupAddItemFormFields();

  // Обработчик сохранения
  if (saveButton) {
    saveButton.addEventListener('click', async () => {
      await handleAddItemSave();
    });
  }
}

/**
 * Настройка полей формы добавления товара
 */
function setupAddItemFormFields() {
  const modal = document.getElementById('add-item-modal');
  if (!modal) return;

  // Обработчики для подсказок
  const hintToggles = modal.querySelectorAll('.hint-toggle-btn');
  hintToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const field = toggle.getAttribute('data-field');
      const hintContent = modal.querySelector(`.hint-content[data-field="${field}"]`);
      if (hintContent) {
        hintContent.classList.toggle('hidden');
      }
    });
  });

  // Обработчик для места хранения (показ/скрытие поля "другое")
  const locationSelect = document.getElementById('add-item-location');
  const locationCustomInput = document.getElementById('add-item-location-custom');

  if (locationSelect && locationCustomInput) {
    locationSelect.addEventListener('change', () => {
      if (locationSelect.value.toLowerCase() === 'другое') {
        locationCustomInput.classList.remove('hidden');
        locationCustomInput.setAttribute('required', 'required');
      } else {
        locationCustomInput.classList.add('hidden');
        locationCustomInput.removeAttribute('required');
        locationCustomInput.value = '';
      }
      validateAddItemField('location');
    });
  }

  // Обработчики валидации для всех полей
  const fields = modal.querySelectorAll('.add-item-field');
  fields.forEach(field => {
    field.addEventListener('input', () => {
      const fieldName = field.getAttribute('data-field');
      if (fieldName) {
        validateAddItemField(fieldName);
      }
    });
    field.addEventListener('change', () => {
      const fieldName = field.getAttribute('data-field');
      if (fieldName) {
        validateAddItemField(fieldName);
      }
    });
  });

  // Обработчик загрузки фото
  const imageInput = document.getElementById('add-item-image');
  const imageBtn = document.getElementById('add-item-image-btn');
  const imagePreview = document.getElementById('add-item-image-preview');
  const imagePreviewImg = document.getElementById('add-item-image-preview-img');
  const imageRemoveBtn = document.getElementById('add-item-image-remove');

  if (imageBtn && imageInput) {
    imageBtn.addEventListener('click', () => {
      imageInput.click();
    });
  }

  if (imageInput) {
    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (imagePreviewImg) {
            imagePreviewImg.src = event.target.result;
          }
          if (imagePreview) {
            imagePreview.classList.remove('hidden');
          }
          if (imageBtn) {
            imageBtn.classList.add('hidden');
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (imageRemoveBtn) {
    imageRemoveBtn.addEventListener('click', () => {
      if (imageInput) imageInput.value = '';
      if (imagePreview) imagePreview.classList.add('hidden');
      if (imageBtn) imageBtn.classList.remove('hidden');
      if (imagePreviewImg) imagePreviewImg.src = '';
    });
  }
}

/**
 * Сброс формы добавления товара
 */
function resetAddItemForm() {
  const modal = document.getElementById('add-item-modal');
  if (!modal) return;

  // Очищаем все поля
  const nameInput = document.getElementById('add-item-name');
  const skuInput = document.getElementById('add-item-sku');
  const categorySelect = document.getElementById('add-item-category');
  const locationSelect = document.getElementById('add-item-location');
  const locationCustomInput = document.getElementById('add-item-location-custom');
  const unitSelect = document.getElementById('add-item-unit');
  const descriptionInput = document.getElementById('add-item-description');
  const imageInput = document.getElementById('add-item-image');
  const imagePreview = document.getElementById('add-item-image-preview');
  const imageBtn = document.getElementById('add-item-image-btn');

  if (nameInput) nameInput.value = '';
  if (skuInput) skuInput.value = '';
  if (categorySelect) categorySelect.value = '';
  if (locationSelect) locationSelect.value = '';
  if (locationCustomInput) {
    locationCustomInput.value = '';
    locationCustomInput.classList.add('hidden');
  }
  if (unitSelect) unitSelect.value = '';
  if (descriptionInput) descriptionInput.value = '';
  if (imageInput) imageInput.value = '';
  if (imagePreview) imagePreview.classList.add('hidden');
  if (imageBtn) imageBtn.classList.remove('hidden');

  // Сбрасываем валидацию
  const fields = modal.querySelectorAll('.add-item-field');
  fields.forEach(field => {
    field.classList.remove('border-red-300', 'dark:border-red-700', 'border-green-500', 'dark:border-green-600');
    field.classList.add('border-slate-300', 'dark:border-slate-600');
    const icon = field.parentElement.querySelector('.field-icon');
    if (icon) {
      icon.classList.add('hidden');
    }
  });
}

/**
 * Валидация поля формы добавления товара
 */
function validateAddItemField(fieldName) {
  const modal = document.getElementById('add-item-modal');
  if (!modal) return false;

  const VALID_CATEGORIES = ['Посуда', 'Бокалы', 'Приборы', 'Инвентарь', 'Расходники', 'Прочее'];
  const VALID_LOCATIONS = ['Бар', 'Кухня', 'Склад'];
  const VALID_UNITS = ['шт.', 'комп.', 'упак.'];

  let field, value, isValid = false;

  if (fieldName === 'name') {
    field = document.getElementById('add-item-name');
    value = field?.value.trim() || '';
    isValid = value !== '';
  } else if (fieldName === 'sku') {
    field = document.getElementById('add-item-sku');
    value = field?.value.trim() || '';
    isValid = value !== '';
  } else if (fieldName === 'category') {
    field = document.getElementById('add-item-category');
    value = field?.value || '';
    isValid = value !== '' && VALID_CATEGORIES.some(category => category.toLowerCase() === value.toLowerCase());
  } else if (fieldName === 'location') {
    const locationSelect = document.getElementById('add-item-location');
    const locationCustomInput = document.getElementById('add-item-location-custom');
    field = locationSelect;
    const locationValue = locationSelect?.value || '';
    if (locationValue.toLowerCase() === 'другое') {
      const customValue = locationCustomInput?.value.trim() || '';
      isValid = customValue !== '';
      if (locationCustomInput) {
        updateAddItemFieldValidation(locationCustomInput, isValid);
      }
    } else {
      isValid = locationValue !== '' && VALID_LOCATIONS.some(location => location.toLowerCase() === locationValue.toLowerCase());
    }
  } else if (fieldName === 'unit') {
    field = document.getElementById('add-item-unit');
    value = field?.value || '';
    isValid = value !== '' && VALID_UNITS.includes(value);
  } else if (fieldName === 'description') {
    // Описание необязательное, всегда валидно
    isValid = true;
  } else if (fieldName === 'image') {
    // Изображение необязательное, всегда валидно
    isValid = true;
  }

  if (field && fieldName !== 'description' && fieldName !== 'image') {
    updateAddItemFieldValidation(field, isValid);
  }

  return isValid;
}

/**
 * Обновить визуальное состояние валидации поля в модальном окне добавления товара
 */
function updateAddItemFieldValidation(field, isValid) {
  if (!field) return;

  // Удаляем все классы валидации
  field.classList.remove('border-red-300', 'dark:border-red-700', 'border-green-500', 'dark:border-green-600', 'focus:ring-red-500', 'focus:border-red-500', 'focus:ring-green-500', 'focus:border-green-500');

  // Добавляем соответствующие классы
  if (isValid) {
    field.classList.add('border-green-500', 'dark:border-green-600', 'focus:ring-green-500', 'focus:border-green-500');
  } else {
    field.classList.add('border-red-300', 'dark:border-red-700', 'focus:ring-red-500', 'focus:border-red-500');
  }

  // Обновляем иконку
  const icon = field.parentElement.querySelector('.field-icon');
  if (icon) {
    if (isValid) {
      icon.classList.remove('hidden', 'text-red-500', 'text-slate-400');
      icon.classList.add('text-green-500');
      icon.textContent = 'check_circle';
    } else {
      icon.classList.remove('hidden', 'text-green-500', 'text-slate-400');
      icon.classList.add('text-red-500');
      icon.textContent = 'warning';
    }
  }
}

/**
 * Обработчик сохранения новой позиции
 */
async function handleAddItemSave() {
  const modal = document.getElementById('add-item-modal');
  if (!modal) return;

  // Получаем значения полей
  const nameInput = document.getElementById('add-item-name');
  const skuInput = document.getElementById('add-item-sku');
  const categorySelect = document.getElementById('add-item-category');
  const locationSelect = document.getElementById('add-item-location');
  const locationCustomInput = document.getElementById('add-item-location-custom');
  const unitSelect = document.getElementById('add-item-unit');
  const descriptionInput = document.getElementById('add-item-description');
  const imageInput = document.getElementById('add-item-image');
  const saveButton = document.getElementById('add-item-save');

  const name = (nameInput?.value || '').trim();
  const sku = (skuInput?.value || '').trim();
  const category = categorySelect?.value || '';
  let location = locationSelect?.value || '';
  if (location.toLowerCase() === 'другое') {
    location = (locationCustomInput?.value || '').trim();
  }
  const unit = unitSelect?.value || '';
  const description = (descriptionInput?.value || '').trim();

  // Валидация всех полей
  const nameValid = validateAddItemField('name');
  const skuValid = validateAddItemField('sku');
  const categoryValid = validateAddItemField('category');
  const locationValid = validateAddItemField('location');
  const unitValid = validateAddItemField('unit');

  if (!nameValid) {
    showError('Введите название товара');
    nameInput?.focus();
    return;
  }

  if (!skuValid) {
    showError('Введите артикул. Артикул обязателен и должен быть уникальным');
    skuInput?.focus();
    return;
  }

  // Проверяем уникальность артикула
  try {
    const existingItems = await items.getAllItems();
    const existingSkus = new Set(existingItems.map(item => item.sku ? item.sku.toString().toLowerCase().trim() : '').filter(s => s));
    const skuLower = sku.toLowerCase();

    if (existingSkus.has(skuLower)) {
      showError(`Артикул "${sku}" уже существует в базе. Артикул должен быть уникальным`);
      skuInput?.focus();
      updateAddItemFieldValidation(skuInput, false);
      return;
    }
  } catch (error) {
    console.error('Ошибка проверки уникальности артикула:', error);
  }

  if (!categoryValid) {
    showError('Выберите категорию');
    categorySelect?.focus();
    return;
  }

  if (!locationValid) {
    showError('Выберите место хранения или введите свой вариант');
    locationSelect?.focus();
    return;
  }

  if (!unitValid) {
    showError('Выберите единицу измерения');
    unitSelect?.focus();
    return;
  }

  // Проверяем уникальность описания (если указано)
  if (description) {
    try {
      const existingItems = await items.getAllItems();
      const existingDescriptions = new Set(existingItems.map(item => item.description ? item.description.toLowerCase().trim() : '').filter(d => d));
      const descLower = description.toLowerCase();

      if (existingDescriptions.has(descLower)) {
        showError('Описание уже существует в базе. Описание должно быть уникальным');
        descriptionInput?.focus();
        return;
      }
    } catch (error) {
      console.error('Ошибка проверки уникальности описания:', error);
    }
  }

  // Блокируем кнопку сохранения
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = 'Сохранение...';
  }

  try {
    let imageUrl = null;

    // Загружаем изображение, если выбрано
    if (imageInput && imageInput.files && imageInput.files.length > 0) {
      try {
        const file = imageInput.files[0];
        // Импортируем функцию загрузки из supabase.js
        const { uploadFileToStorage } = await import('./supabase.js');
        imageUrl = await uploadFileToStorage(file, 'item-images');
        console.log('Изображение загружено:', imageUrl);
      } catch (imageError) {
        console.error('Ошибка загрузки изображения:', imageError);
        showError('Не удалось загрузить изображение: ' + (imageError.message || 'Неизвестная ошибка'));
        if (saveButton) {
          saveButton.disabled = false;
          saveButton.textContent = 'Сохранить';
        }
        return;
      }
    }

    // Создаем товар
    const itemData = {
      name: name,
      sku: sku,
      category: category,
      location: location,
      unit: unit,
      description: description || null,
      image_url: imageUrl
    };

    const newItem = await items.createItem(itemData);
    console.log('Товар создан:', newItem);

    // Показываем успешное сообщение
    showSuccess(`Товар "${name}" успешно добавлен`);

    // Закрываем модальное окно
    const modal = document.getElementById('add-item-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      resetAddItemForm();
    }

    // Обновляем список товаров
    if (window.currentItems) {
      window.currentItems.push(newItem);
    }

    // Перезагружаем страницу для обновления списка
    // Или можно обновить список без перезагрузки
    const allItems = await items.getAllItems();
    window.currentItems = allItems;
    renderItemsList(allItems);

  } catch (error) {
    console.error('Ошибка создания товара:', error);
    showError('Не удалось создать товар: ' + (error.message || 'Неизвестная ошибка'));
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = 'Сохранить';
    }
  }
}

/**
 * Отобразить список товаров
 * 
 * @param {Array} itemsList - Массив товаров
 */
function renderItemsList(itemsList) {
  const mainContainer = document.querySelector('main');
  if (!mainContainer) return;

  // Очищаем контейнер (кроме первого элемента, если он существует)
  const existingItems = mainContainer.querySelectorAll('[data-item-id]');
  existingItems.forEach(el => el.remove());

  // Если нет товаров, показываем сообщение
  if (itemsList.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'flex flex-col items-center justify-center py-12 px-4';
    emptyMessage.innerHTML = `
      <span class="material-symbols-outlined text-slate-400 dark:text-slate-500 text-6xl mb-4">inventory_2</span>
      <p class="text-slate-500 dark:text-slate-400 text-center">Товары не найдены</p>
    `;
    mainContainer.appendChild(emptyMessage);
    return;
  }

  // Создаем элементы для каждого товара
  itemsList.forEach(item => {
    const itemElement = createItemElement(item);
    mainContainer.appendChild(itemElement);
  });

  // Настраиваем обработчики кликов
  setupItemClickHandlers();
}

/**
 * Создать элемент товара для списка
 * 
 * @param {Object} item - Товар
 * @returns {HTMLElement} - Элемент товара
 */
function createItemElement(item) {
  const div = document.createElement('div');
  div.className = 'flex items-center gap-4 bg-white dark:bg-[#1e293b] p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 active:scale-[0.99] transition-transform cursor-pointer';
  div.setAttribute('data-item-id', item.id);

  const categoryColors = {
    'Посуда': 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 ring-orange-600/10',
    'Приборы': 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-blue-700/10',
    'Оборудование': 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 ring-slate-500/10',
    'Расходники': 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 ring-gray-500/10',
    'Кухня': 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 ring-orange-600/10',
    'Бар': 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 ring-purple-700/10',
    'Зал': 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-blue-700/10',
    'Бокалы': 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 ring-green-700/10',
    'Инвентарь': 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 ring-yellow-700/10',
    'Прочее': 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 ring-slate-500/10'
  };

  // Нормализуем категорию: делаем первую букву заглавной
  const normalizeCategory = (category) => {
    if (!category) return '';
    return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  };

  const normalizedCategory = normalizeCategory(item.category);
  const categoryColor = categoryColors[normalizedCategory] || 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 ring-slate-500/10';

  // Обрабатываем URL изображения: если пустой или null, используем placeholder
  // Проверяем, что image_url существует И является строкой, прежде чем вызывать .trim()
  const imageUrl = (item.image_url && typeof item.image_url === 'string' && item.image_url.trim() !== '')
    ? item.image_url.trim()
    : 'https://via.placeholder.com/64';

  div.innerHTML = `
    <div class="bg-center bg-no-repeat bg-cover rounded-lg size-16 shrink-0 bg-slate-200" style="background-image: url('${imageUrl}');"></div>
    <div class="flex flex-col justify-center flex-1 min-w-0">
      <p class="text-slate-900 dark:text-white text-base font-semibold leading-tight line-clamp-1 mb-1">${item.name || 'Без названия'}</p>
      <div class="flex items-center gap-2">
        ${normalizedCategory ? `<span class="inline-flex items-center rounded-md ${categoryColor} px-2 py-1 text-xs font-medium ring-1 ring-inset">${normalizedCategory}</span>` : ''}
        <p class="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">${item.unit || 'шт'}</p>
      </div>
    </div>
    <div class="shrink-0 text-slate-400 dark:text-slate-500">
      <span class="material-symbols-outlined" style="font-size: 24px;">chevron_right</span>
    </div>
  `;

  return div;
}

/**
 * Настроить обработчики кликов на товары
 */
function setupItemClickHandlers() {
  document.querySelectorAll('[data-item-id]').forEach(element => {
    element.addEventListener('click', (e) => {
      const itemId = element.getAttribute('data-item-id');
      if (itemId) {
        navigateTo(`item-details.html?id=${itemId}`);
      }
    });
  });
}

/**
 * Инициализация страницы сессии инвентаризации
 */
async function initInventorySessionPage() {
  try {
    // Получаем ID сессии из URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('id');

    if (!sessionId) {
      showError('ID сессии не указан');
      return;
    }

    // Загружаем сессию
    const session = await inventory.getInventorySessionById(sessionId);
    if (!session) {
      showError('Сессия не найдена');
      return;
    }

    // Загружаем записи инвентаризации
    const inventoryItems = await inventory.getInventoryItemsBySession(sessionId);

    // Загружаем все товары для отображения
    const allItems = await items.getAllItems();

    // Сохраняем для фильтрации
    window.allInventoryItems = allItems;
    window.inventoryItemsData = inventoryItems;
    window.currentSessionId = sessionId;

    // Отображаем товары для инвентаризации
    renderInventoryItems(allItems, inventoryItems, sessionId);

    // Настраиваем поиск в реальном времени
    const searchInput = document.querySelector('input[placeholder*="Поиск"]');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        searchTimeout = setTimeout(() => {
          let filteredItems = allItems;

          if (query) {
            const lowerQuery = query.toLowerCase();
            filteredItems = filteredItems.filter(item => {
              const name = (item.name || '').toLowerCase();
              return name.includes(lowerQuery);
            });
          }

          renderInventoryItems(filteredItems, inventoryItems, sessionId);
        }, 300);
      });
    }

    // Обработчик сохранения
    const saveButton = document.querySelector('[data-save-session]');
    if (saveButton) {
      saveButton.addEventListener('click', async () => {
        await inventory.updateSessionItemsCount(sessionId);
        showSuccess('Прогресс сохранен');
      });
    }

    // Обработчик завершения сессии
    const completeButton = document.querySelector('[data-complete-session]');
    if (completeButton) {
      completeButton.addEventListener('click', async () => {
        await inventory.completeInventorySession(sessionId);
        showSuccess('Инвентаризация завершена');
        setTimeout(() => {
          navigateTo('index.html');
        }, 1500);
      });
    }
  } catch (error) {
    console.error('Ошибка инициализации страницы сессии:', error);
  }
}

/**
 * Отобразить товары для инвентаризации
 * 
 * @param {Array} allItems - Все товары
 * @param {Array} inventoryItems - Записи инвентаризации
 * @param {string} sessionId - ID сессии
 */
function renderInventoryItems(allItems, inventoryItems, sessionId) {
  // Здесь можно обновить DOM для отображения товаров
  // с возможностью ввода количества
  console.log('Отображение товаров для инвентаризации:', {
    totalItems: allItems.length,
    countedItems: inventoryItems.length,
    sessionId
  });
}

/**
 * Инициализация страницы деталей товара
 */
let currentItem = null; // Храним текущий товар для редактирования
let isEditMode = false; // Флаг режима редактирования

async function initItemDetailsPage() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const itemId = urlParams.get('id');

    if (!itemId) {
      showError('ID товара не указан');
      return;
    }

    const item = await items.getItemById(itemId);
    if (!item) {
      showError('Товар не найден');
      return;
    }

    currentItem = item;

    // Отображаем детали товара
    renderItemDetails(item);

    // Обработчик кнопки "Назад"
    const backButton = document.getElementById('back-button');
    if (backButton) {
      backButton.addEventListener('click', () => {
        window.history.back();
      });
    }

    // Обработчик кнопки переключения режима редактирования
    const editToggleButton = document.getElementById('edit-toggle-button');
    if (editToggleButton) {
      editToggleButton.addEventListener('click', toggleEditMode);
    }

    // Обработчик кнопки сохранения
    const saveButton = document.getElementById('save-item-button');
    if (saveButton) {
      saveButton.addEventListener('click', saveItemChanges);
    }

    // Обработчик кнопки удаления и инициализация видимости
    const deleteButton = document.getElementById('delete-item-button');
    if (deleteButton) {
      deleteButton.addEventListener('click', handleDeleteItem);
      // Инициализируем видимость кнопки удаления (должна быть видна в режиме просмотра)
      if (!isEditMode) {
        deleteButton.classList.remove('hidden');
      } else {
        deleteButton.classList.add('hidden');
      }
    }

    // Обработчики кнопок изменения количества (активны только в режиме редактирования)
    const quantityDecrease = document.getElementById('quantity-decrease');
    const quantityIncrease = document.getElementById('quantity-increase');
    const quantityInput = document.getElementById('item-quantity');

    if (quantityDecrease) {
      quantityDecrease.addEventListener('click', () => {
        // Проверяем, что мы в режиме редактирования
        if (!isEditMode || quantityDecrease.disabled) return;

        if (quantityInput) {
          const currentValue = parseFloat(quantityInput.value) || 0;
          const step = parseFloat(quantityInput.step) || 1;
          const newValue = Math.max(0, currentValue - step);
          quantityInput.value = newValue;
          updateSaveButtonText(newValue);
        }
      });
    }

    if (quantityIncrease) {
      quantityIncrease.addEventListener('click', () => {
        // Проверяем, что мы в режиме редактирования
        if (!isEditMode || quantityIncrease.disabled) return;

        if (quantityInput) {
          const currentValue = parseFloat(quantityInput.value) || 0;
          const step = parseFloat(quantityInput.step) || 1;
          const newValue = currentValue + step;
          quantityInput.value = newValue;
          updateSaveButtonText(newValue);
        }
      });
    }

    // Обновляем текст кнопки при изменении количества вручную (только в режиме редактирования)
    if (quantityInput) {
      quantityInput.addEventListener('input', () => {
        if (!isEditMode) return;
        const value = parseFloat(quantityInput.value) || 0;
        updateSaveButtonText(value);
      });
    }

  } catch (error) {
    console.error('Ошибка инициализации страницы деталей товара:', error);
    showError('Ошибка загрузки товара: ' + error.message);
  }
}

/**
 * Отобразить детали товара
 * 
 * @param {Object} item - Товар
 */
function renderItemDetails(item) {
  console.log('Отображение деталей товара:', item);

  // Название товара
  const nameDisplay = document.getElementById('item-name-display');
  const nameEdit = document.getElementById('item-name-edit');
  if (nameDisplay) nameDisplay.textContent = item.name || 'Без названия';
  if (nameEdit) nameEdit.value = item.name || '';

  // Категория
  const categoryDisplay = document.getElementById('item-category-display');
  const categoryEdit = document.getElementById('item-category-edit');
  if (categoryDisplay) {
    const categoryText = categoryDisplay.querySelector('p');
    if (categoryText) categoryText.textContent = item.category || 'Не указана';
  }
  if (categoryEdit) {
    const categoryValue = (item.category || '').trim().toLowerCase();

    // Проверяем, есть ли такая опция в списке
    let optionExists = false;
    for (let i = 0; i < categoryEdit.options.length; i++) {
      if (categoryEdit.options[i].value === categoryValue) {
        optionExists = true;
        break;
      }
    }

    // Если опции нет и значение не пустое, добавляем её динамически
    if (!optionExists && categoryValue) {
      const newOption = document.createElement('option');
      newOption.value = categoryValue;
      // Делаем первую букву заглавной для красоты
      newOption.textContent = item.category;
      newOption.classList.add('text-primary');
      categoryEdit.appendChild(newOption);
    }

    categoryEdit.value = categoryValue;
  }

  // Единица измерения
  const unitDisplay = document.getElementById('item-unit-display');
  const unitEdit = document.getElementById('item-unit-edit');
  const unitBadge = document.getElementById('item-unit-badge');
  if (unitDisplay) {
    const unitText = unitDisplay.querySelector('p');
    if (unitText) unitText.textContent = item.unit || 'шт';
  }

  if (unitEdit) {
    const unitValue = item.unit || 'шт.';

    // Проверяем наличие опции
    let optionExists = false;
    for (let i = 0; i < unitEdit.options.length; i++) {
      if (unitEdit.options[i].value === unitValue) {
        optionExists = true;
        break;
      }
    }

    // Добавляем, если нет
    if (!optionExists) {
      const newOption = document.createElement('option');
      newOption.value = unitValue;
      newOption.textContent = unitValue;
      newOption.classList.add('text-slate-700', 'dark:text-slate-200');
      unitEdit.appendChild(newOption);
    }

    unitEdit.value = unitValue;
  }

  if (unitBadge) unitBadge.textContent = item.unit || 'шт';

  // Описание
  const descriptionDisplay = document.getElementById('item-description-display');
  const descriptionEdit = document.getElementById('item-description-edit');
  if (descriptionDisplay) descriptionDisplay.textContent = item.description || 'Описание не указано';
  if (descriptionEdit) descriptionEdit.value = item.description || '';

  // Место хранения
  const locationDisplay = document.getElementById('item-location-display');
  const locationEdit = document.getElementById('item-location-edit');
  const locationCustomEdit = document.getElementById('item-location-custom-edit');
  const VALID_LOCATIONS = ['Бар', 'Кухня', 'Склад'];
  if (locationDisplay) locationDisplay.textContent = item.location || 'Не указано';
  if (locationEdit) {
    const locationLower = (item.location || '').trim().toLowerCase();

    const matchedLocation = VALID_LOCATIONS.find(location => location.toLowerCase() === locationLower);
    if (matchedLocation) {
      locationEdit.value = matchedLocation;
      if (locationCustomEdit) locationCustomEdit.classList.add('hidden');
    } else if (item.location) {
      locationEdit.value = 'Другое';
      if (locationCustomEdit) {
        locationCustomEdit.classList.remove('hidden');
        locationCustomEdit.value = item.location;
      }
    } else {
      locationEdit.value = '';
      if (locationCustomEdit) locationCustomEdit.classList.add('hidden');
    }
  }

  // Артикул
  const skuDisplay = document.getElementById('item-sku-display');
  const skuEdit = document.getElementById('item-sku-edit');
  if (skuDisplay) skuDisplay.textContent = item.sku || 'Не указан';
  if (skuEdit) skuEdit.value = item.sku || '';

  // Изображение
  const imageElement = document.getElementById('item-image');
  if (imageElement) {
    // Проверяем, есть ли валидный URL изображения
    if (item.image_url && item.image_url.trim() !== '') {
      imageElement.style.backgroundImage = `url("${item.image_url}")`;
    } else {
      // Если изображения нет, сбрасываем backgroundImage
      imageElement.style.backgroundImage = 'none';
    }
  }

  // Дата обновления
  const updatedDisplay = document.getElementById('item-updated-display');
  if (updatedDisplay && item.updated_at) {
    const updateDate = new Date(item.updated_at);
    const now = new Date();
    const diffTime = Math.abs(now - updateDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    let dateText = '';
    if (diffDays === 0) {
      dateText = 'Сегодня';
    } else if (diffDays === 1) {
      dateText = 'Вчера';
    } else if (diffDays < 7) {
      dateText = `${diffDays} ${diffDays === 1 ? 'день' : diffDays < 5 ? 'дня' : 'дней'} назад`;
    } else {
      dateText = updateDate.toLocaleDateString('ru-RU');
    }
    updatedDisplay.textContent = dateText;
  } else if (updatedDisplay) {
    updatedDisplay.textContent = 'Не указано';
  }

  // Текущий остаток
  const quantityInput = document.getElementById('item-quantity');
  if (quantityInput) {
    quantityInput.value = item.quantity || 0;
  }

  // Статистика инвентаризации (Предыдущий замер и Разница)
  const prevMeasureEl = document.getElementById('prev-measurement-display');
  const diffMeasureEl = document.getElementById('diff-measurement-display');

  if (prevMeasureEl && diffMeasureEl) {
    // Асинхронно загружаем данные
    (async () => {
      try {
        // 1. Получаем все сессии
        const sessions = await inventory.getAllInventorySessions();
        // 2. Ищем последнюю завершенную (completed)
        const completedSessions = sessions
          .filter(s => ['completed', 'complete', 'done'].includes((s.status || '').toLowerCase()))
          .sort((a, b) => new Date(b.date) - new Date(a.date));

        const lastSession = completedSessions[0];

        if (lastSession) {
          // 3. Получаем товары этой сессии
          const sessionItems = await inventory.getInventoryItemsBySession(lastSession.id);
          // 4. Ищем наш товар
          const historyItem = sessionItems.find(i => i.item_id === item.id);
          const prevQty = historyItem ? (Number(historyItem.quantity) || 0) : 0;

          // 5. Считаем разницу
          const currentQty = Number(item.quantity) || 0;
          const diff = currentQty - prevQty;
          const diffSign = diff > 0 ? '+' : '';
          const diffClass = diff > 0 ? 'text-green-500' : (diff < 0 ? 'text-red-500' : 'text-slate-400');

          // 6. Обновляем UI
          prevMeasureEl.textContent = `Предыдущий замер: ${prevQty} ${item.unit || 'шт.'}`;
          diffMeasureEl.innerHTML = `Разница: <span class="${diffClass} font-medium">${diffSign}${diff}</span>`;
        } else {
          // Нет предыдущих сессий
          prevMeasureEl.textContent = 'Предыдущий замер: -';
          diffMeasureEl.innerHTML = 'Разница: -';
        }
      } catch (err) {
        console.error('Ошибка загрузки истории для товара:', err);
        prevMeasureEl.textContent = 'Предыдущий замер: Ошибка';
      }
    })();
  }
}

/**
 * Обновить текст кнопки сохранения
 */
function updateSaveButtonText(quantity) {
  // Кнопка сохранения больше не используется, функция оставлена для совместимости
}

/**
 * Переключить режим редактирования
 */
function toggleEditMode() {
  isEditMode = !isEditMode;

  // Элементы для отображения и редактирования
  const displayElements = [
    { display: 'item-name-display', edit: 'item-name-edit', wrapper: null },
    { display: 'item-category-display', edit: 'item-category-edit', wrapper: 'item-category-edit-wrapper' },
    { display: 'item-unit-display', edit: 'item-unit-edit', wrapper: 'item-unit-edit-wrapper' },
    { display: 'item-description-display', edit: 'item-description-edit', wrapper: null },
    { display: 'item-location-display', edit: 'item-location-edit', wrapper: 'item-location-edit-wrapper' },
    { display: 'item-sku-display', edit: 'item-sku-edit', wrapper: 'item-sku-edit-wrapper' }
  ];

  displayElements.forEach(({ display, edit, wrapper }) => {
    const displayEl = document.getElementById(display);
    const editEl = document.getElementById(edit);
    const wrapperEl = wrapper ? document.getElementById(wrapper) : null;

    if (displayEl && editEl) {
      if (isEditMode) {
        // Переключаемся в режим редактирования
        displayEl.classList.add('hidden');
        if (wrapperEl) {
          wrapperEl.classList.remove('hidden');
        } else {
          editEl.classList.remove('hidden');
        }
        // Копируем значение из отображения в поле редактирования (только для текстовых полей)
        if ((editEl.tagName === 'TEXTAREA' || editEl.tagName === 'INPUT') && editEl.type !== 'file') {
          if (editEl.value === '' || editEl.value === '-') {
            editEl.value = displayEl.textContent.trim();
          }
        } else if (editEl.tagName === 'SELECT' && currentItem) {
          console.log('DEBUG: Setting SELECT value', edit, currentItem);
          // Принудительно устанавливаем значение для селектов при входе в режим редактирования
          let val = '';
          if (edit === 'item-category-edit' && currentItem.category) {
            const categoryValue = currentItem.category.trim();
            const categoryLower = categoryValue.toLowerCase();
            // Динамическое добавление опции для категории если нет
            let exists = false;
            for (let i = 0; i < editEl.options.length; i++) {
              if (editEl.options[i].value.toLowerCase() === categoryLower) { exists = true; break; }
            }
            if (!exists && categoryValue) {
              const opt = document.createElement('option');
              opt.value = categoryValue;
              opt.textContent = categoryValue;
              opt.classList.add('text-primary');
              editEl.appendChild(opt);
            }
            if (exists) {
              for (let i = 0; i < editEl.options.length; i++) {
                if (editEl.options[i].value.toLowerCase() === categoryLower) {
                  val = editEl.options[i].value;
                  break;
                }
              }
            } else {
              val = categoryValue;
            }
            editEl.value = val;
          } else if (edit === 'item-unit-edit' && currentItem.unit) {
            val = currentItem.unit; // init usually exact match or we add it
            let exists = false;
            for (let i = 0; i < editEl.options.length; i++) {
              if (editEl.options[i].value === val) { exists = true; break; }
            }
            if (!exists && val) {
              const opt = document.createElement('option');
              opt.value = val;
              opt.textContent = val;
              opt.classList.add('text-slate-700', 'dark:text-slate-200');
              editEl.appendChild(opt);
            }
            editEl.value = val;
          } else if (edit === 'item-location-edit' && currentItem.location) {
            const loc = currentItem.location.trim().toLowerCase();
            const VALID = ['Бар', 'Кухня', 'Склад'];
            const matchedLocation = VALID.find(location => location.toLowerCase() === loc);
            if (matchedLocation) {
              editEl.value = matchedLocation;
              const custom = document.getElementById('item-location-custom-edit');
              if (custom) custom.classList.add('hidden');
            } else {
              editEl.value = 'Другое';
              const custom = document.getElementById('item-location-custom-edit');
              if (custom) {
                custom.classList.remove('hidden');
                custom.value = currentItem.location;
              }
            }
          }
        }
        // Фокус только на первом поле
        if (display === 'item-name-display') {
          editEl.focus();
        }
      } else {
        // Переключаемся в режим просмотра
        displayEl.classList.remove('hidden');
        if (wrapperEl) {
          wrapperEl.classList.add('hidden');
        } else {
          editEl.classList.add('hidden');
        }
      }
    }
  });

  // Управление секцией редактирования изображения
  const imageEditSection = document.getElementById('item-image-edit-section');
  if (imageEditSection) {
    if (isEditMode) {
      imageEditSection.classList.remove('hidden');
      setupImageEditHandlers();
    } else {
      imageEditSection.classList.add('hidden');
    }
  }

  // Управление кнопками и полем количества
  const quantityDecrease = document.getElementById('quantity-decrease');
  const quantityIncrease = document.getElementById('quantity-increase');
  const quantityInput = document.getElementById('item-quantity');

  if (isEditMode) {
    // В режиме редактирования кнопки активны
    if (quantityDecrease) {
      quantityDecrease.disabled = false;
      quantityDecrease.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-100', 'dark:bg-slate-800', 'text-slate-400', 'dark:text-slate-600');
      quantityDecrease.classList.add('bg-slate-100', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300', 'hover:bg-slate-200', 'dark:hover:bg-slate-700', 'active:scale-95');
    }
    if (quantityIncrease) {
      quantityIncrease.disabled = false;
      quantityIncrease.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-100', 'dark:bg-slate-800', 'text-slate-400', 'dark:text-slate-600');
      quantityIncrease.classList.add('bg-primary', 'text-white', 'hover:bg-primary/90', 'shadow-lg', 'shadow-primary/30', 'active:scale-95');
    }
    if (quantityInput) {
      quantityInput.readOnly = false;
      quantityInput.classList.add('cursor-text');
    }
  } else {
    // В режиме просмотра кнопки неактивны
    if (quantityDecrease) {
      quantityDecrease.disabled = true;
      quantityDecrease.classList.remove('bg-slate-100', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300', 'hover:bg-slate-200', 'dark:hover:bg-slate-700', 'active:scale-95');
      quantityDecrease.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-100', 'dark:bg-slate-800', 'text-slate-400', 'dark:text-slate-600');
    }
    if (quantityIncrease) {
      quantityIncrease.disabled = true;
      quantityIncrease.classList.remove('bg-primary', 'text-white', 'hover:bg-primary/90', 'shadow-lg', 'shadow-primary/30', 'active:scale-95');
      quantityIncrease.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-100', 'dark:bg-slate-800', 'text-slate-400', 'dark:text-slate-600');
    }
    if (quantityInput) {
      quantityInput.readOnly = true;
      quantityInput.classList.remove('cursor-text');
    }
  }

  // Меняем иконку редактирования
  const editIcon = document.getElementById('edit-icon');
  if (editIcon) {
    if (isEditMode) {
      editIcon.textContent = 'close';
    } else {
      editIcon.textContent = 'edit';
    }
  }

  // Управление кнопкой удаления
  const deleteButton = document.getElementById('delete-item-button');
  if (deleteButton) {
    if (isEditMode) {
      // Скрываем кнопку удаления в режиме редактирования
      deleteButton.classList.add('hidden');
    } else {
      // Показываем кнопку удаления в режиме просмотра
      deleteButton.classList.remove('hidden');
    }
  }

  // Инициализируем валидацию и обработчики в режиме редактирования
  if (isEditMode) {
    setupEditItemValidation();
    setupLocationCustomHandler();
    // Показываем кнопку сохранения
    const saveFooter = document.getElementById('save-item-footer');
    if (saveFooter) {
      saveFooter.classList.remove('hidden');
    }
  } else {
    // Скрываем кнопку сохранения
    const saveFooter = document.getElementById('save-item-footer');
    if (saveFooter) {
      saveFooter.classList.add('hidden');
    }
  }
}

/**
 * Сохранить изменения товара
 */
async function saveItemChanges() {
  if (!currentItem) {
    showError('Товар не загружен');
    return;
  }

  // В режиме просмотра ничего не сохраняем
  if (!isEditMode) {
    return;
  }

  try {
    // Собираем данные из полей редактирования
    const updates = {};

    const nameEdit = document.getElementById('item-name-edit');
    const categoryEdit = document.getElementById('item-category-edit');
    const unitEdit = document.getElementById('item-unit-edit');
    const descriptionEdit = document.getElementById('item-description-edit');
    const locationEdit = document.getElementById('item-location-edit');
    const skuEdit = document.getElementById('item-sku-edit');
    const quantityInput = document.getElementById('item-quantity');

    // Название (обязательное поле)
    if (nameEdit && nameEdit.value.trim()) {
      updates.name = nameEdit.value.trim();
    }

    // Категория
    if (categoryEdit) {
      updates.category = categoryEdit.value.trim() || null;
    }

    // Единица измерения
    if (unitEdit && unitEdit.value.trim()) {
      updates.unit = unitEdit.value.trim();
    }

    // Описание
    if (descriptionEdit) {
      updates.description = descriptionEdit.value.trim() || null;
    }

    // Место хранения
    const locationCustomEdit = document.getElementById('item-location-custom-edit');
    if (locationEdit) {
      let location = locationEdit.value || '';
      if (location.toLowerCase() === 'другое' && locationCustomEdit) {
        location = locationCustomEdit.value.trim() || '';
      }
      updates.location = location || null;
    }

    // Артикул
    if (skuEdit) {
      updates.sku = skuEdit.value.trim() || null;
    }

    // Количество (только в режиме редактирования)
    if (quantityInput && quantityInput.value !== undefined) {
      updates.quantity = parseFloat(quantityInput.value) || 0;
    }

    // Базовая валидация (без визуальных индикаторов ошибок)
    if (!updates.name || updates.name.trim() === '') {
      showError('Название товара не может быть пустым');
      nameEdit?.focus();
      return;
    }

    // Проверяем уникальность артикула (только если артикул изменился)
    // Исключаем текущий товар из проверки
    if (updates.sku && updates.sku.trim() !== '' && updates.sku !== currentItem.sku) {
      try {
        const existingItems = await items.getAllItems();
        // Исключаем текущий товар из проверки уникальности
        const otherItems = existingItems.filter(item => item.id !== currentItem.id);
        const existingSkus = new Set(otherItems.map(item => item.sku ? item.sku.toString().toLowerCase().trim() : '').filter(s => s));
        const skuLower = updates.sku.toLowerCase().trim();

        if (existingSkus.has(skuLower)) {
          showError(`Артикул "${updates.sku}" уже существует в базе. Артикул должен быть уникальным`);
          skuEdit?.focus();
          return;
        }
      } catch (error) {
        console.error('Ошибка проверки уникальности артикула:', error);
      }
    }

    // Обработка изображения (если выбрано новое)
    const imageInput = document.getElementById('item-image-input');
    if (imageInput && imageInput.files && imageInput.files.length > 0) {
      const file = imageInput.files[0];
      // Конвертируем файл в base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        updates.image_url = e.target.result;
        // Обновляем превью основного изображения
        const imageElement = document.getElementById('item-image');
        if (imageElement) {
          imageElement.style.backgroundImage = `url("${e.target.result}")`;
        }
        await saveItemUpdates(updates);
      };
      reader.onerror = () => {
        showError('Не удалось прочитать изображение');
      };
      reader.readAsDataURL(file);
      return; // Выходим, так как сохранение произойдет в onload
    }

    // Сохраняем изменения (если нет нового изображения)
    await saveItemUpdates(updates);

  } catch (error) {
    console.error('Ошибка сохранения товара:', error);
    showError('Не удалось сохранить изменения: ' + error.message);
  }
}

/**
 * Сохранить обновления товара
 */
async function saveItemUpdates(updates) {
  try {
    console.log('Сохранение изменений:', updates);
    const updatedItem = await items.updateItem(currentItem.id, updates);

    // Обновляем текущий товар
    currentItem = updatedItem;

    // Обновляем отображение
    renderItemDetails(updatedItem);

    // Выходим из режима редактирования
    toggleEditMode();

    showSuccess('Изменения сохранены успешно');
  } catch (error) {
    console.error('Ошибка сохранения обновлений:', error);
    throw error;
  }
}

/**
 * Обработчик удаления товара
 */
async function handleDeleteItem() {
  if (!currentItem) {
    showError('Товар не загружен');
    return;
  }

  // Показываем подтверждение удаления
  const confirmed = await showDangerConfirm(`Вы уверены, что хотите удалить позицию "${currentItem.name}"?\n\nЭто действие удалит позицию из локального хранилища и с сервера. Это действие нельзя отменить.`);

  if (!confirmed) {
    return;
  }

  try {
    // Удаляем товар
    await items.deleteItem(currentItem.id);

    // Показываем успешное сообщение
    showSuccess('Позиция успешно удалена');

    // Возвращаемся на страницу товаров
    setTimeout(() => {
      navigateTo('items.html');
    }, 1000);
  } catch (error) {
    console.error('Ошибка удаления товара:', error);
    showError('Не удалось удалить позицию: ' + error.message);
  }
}

/**
 * Настроить обработчики для редактирования изображения
 */
function setupImageEditHandlers() {
  const imageInput = document.getElementById('item-image-input');
  const imageBtn = document.getElementById('item-image-btn');
  const imagePreview = document.getElementById('item-image-preview');
  const imagePreviewImg = document.getElementById('item-image-preview-img');
  const imageRemoveBtn = document.getElementById('item-image-remove');
  const imageElement = document.getElementById('item-image');

  if (!imageInput || !imageBtn) return;

  // Удаляем старые обработчики через клонирование
  const newImageBtn = imageBtn.cloneNode(true);
  imageBtn.parentNode.replaceChild(newImageBtn, imageBtn);

  const newImageInput = imageInput.cloneNode(true);
  imageInput.parentNode.replaceChild(newImageInput, imageInput);

  // Обработчик кнопки выбора фото
  newImageBtn.addEventListener('click', () => {
    newImageInput.click();
  });

  // Обработчик выбора файла
  newImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      // Проверяем размер файла (максимум 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showError('Размер файла не должен превышать 5MB');
        newImageInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        if (imagePreviewImg) {
          imagePreviewImg.src = event.target.result;
        }
        if (imagePreview) {
          imagePreview.classList.remove('hidden');
        }
        if (newImageBtn) {
          newImageBtn.classList.add('hidden');
        }
        // Также обновляем основное изображение сразу для предпросмотра
        if (imageElement) {
          imageElement.style.backgroundImage = `url("${event.target.result}")`;
        }
      };
      reader.onerror = () => {
        showError('Не удалось прочитать изображение');
      };
      reader.readAsDataURL(file);
    }
  });

  // Обработчик кнопки удаления фото
  if (imageRemoveBtn) {
    const newImageRemoveBtn = imageRemoveBtn.cloneNode(true);
    imageRemoveBtn.parentNode.replaceChild(newImageRemoveBtn, imageRemoveBtn);

    newImageRemoveBtn.addEventListener('click', () => {
      newImageInput.value = '';
      if (imagePreview) {
        imagePreview.classList.add('hidden');
      }
      if (newImageBtn) {
        newImageBtn.classList.remove('hidden');
      }
      if (imagePreviewImg) {
        imagePreviewImg.src = '';
      }
      // Также очищаем основное изображение
      if (imageElement) {
        imageElement.style.backgroundImage = 'none';
      }
    });
  }

  // Показываем текущее изображение в превью, если оно есть
  if (imageElement && imageElement.style.backgroundImage && imageElement.style.backgroundImage !== 'none') {
    const bgImage = imageElement.style.backgroundImage;
    const urlMatch = bgImage.match(/url\(["']?(.+?)["']?\)/);
    if (urlMatch && urlMatch[1]) {
      if (imagePreviewImg) {
        imagePreviewImg.src = urlMatch[1];
      }
      if (imagePreview) {
        imagePreview.classList.remove('hidden');
      }
      if (newImageBtn) {
        newImageBtn.classList.add('hidden');
      }
    }
  }
}

/**
 * Настроить обработчик для поля "другое" в месте хранения
 */
function setupLocationCustomHandler() {
  const locationEdit = document.getElementById('item-location-edit');
  const locationCustomEdit = document.getElementById('item-location-custom-edit');

  if (locationEdit && locationCustomEdit) {
    // Удаляем старые обработчики
    const currentValue = locationEdit.value;
    const newLocationEdit = locationEdit.cloneNode(true);
    locationEdit.parentNode.replaceChild(newLocationEdit, locationEdit);
    if (currentValue !== undefined) {
      newLocationEdit.value = currentValue;
    }

    newLocationEdit.addEventListener('change', () => {
      if (newLocationEdit.value.toLowerCase() === 'другое') {
        locationCustomEdit.classList.remove('hidden');
        locationCustomEdit.setAttribute('required', 'required');
      } else {
        locationCustomEdit.classList.add('hidden');
        locationCustomEdit.removeAttribute('required');
        locationCustomEdit.value = '';
      }
      validateEditItemField('location');
    });

    // Проверяем начальное состояние
    if (newLocationEdit.value.toLowerCase() === 'другое') {
      locationCustomEdit.classList.remove('hidden');
    }
  }
}

/**
 * Настроить валидацию полей редактирования
 */
function setupEditItemValidation() {
  const fields = document.querySelectorAll('.edit-item-field');
  fields.forEach(field => {
    // Удаляем старые обработчики
    const currentValue = field.value;
    const newField = field.cloneNode(true);
    field.parentNode.replaceChild(newField, field);
    if (newField.type !== 'file' && currentValue !== undefined) {
      newField.value = currentValue;
    }

    newField.addEventListener('input', () => {
      const fieldName = newField.getAttribute('data-field');
      if (fieldName) {
        validateEditItemField(fieldName);
      }
    });
    newField.addEventListener('change', () => {
      const fieldName = newField.getAttribute('data-field');
      if (fieldName) {
        validateEditItemField(fieldName);
      }
    });
  });

  // Обработчики для подсказок
  const hintToggles = document.querySelectorAll('.hint-toggle-btn');
  hintToggles.forEach(toggle => {
    // Удаляем старые обработчики
    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);

    newToggle.addEventListener('click', () => {
      const field = newToggle.getAttribute('data-field');
      const hintContent = document.querySelector(`.hint-content[data-field="${field}"]`);
      if (hintContent) {
        hintContent.classList.toggle('hidden');
      }
    });
  });
}

/**
 * Валидация поля редактирования товара
 * При редактировании существующей карточки не показываем визуальные ошибки
 */
function validateEditItemField(fieldName) {
  // При редактировании существующей карточки валидация работает только для логики,
  // но не показывает визуальные индикаторы ошибок
  const VALID_CATEGORIES = ['Посуда', 'Бокалы', 'Приборы', 'Инвентарь', 'Расходники', 'Прочее'];
  const VALID_LOCATIONS = ['Бар', 'Кухня', 'Склад'];
  const VALID_UNITS = ['шт.', 'комп.', 'упак.'];

  let field, value, isValid = false;

  if (fieldName === 'name') {
    field = document.getElementById('item-name-edit');
    value = field?.value.trim() || '';
    isValid = value !== '';
  } else if (fieldName === 'sku') {
    field = document.getElementById('item-sku-edit');
    value = field?.value.trim() || '';
    isValid = value !== '';
  } else if (fieldName === 'category') {
    field = document.getElementById('item-category-edit');
    value = field?.value || '';
    isValid = value !== '' && VALID_CATEGORIES.some(category => category.toLowerCase() === value.toLowerCase());
  } else if (fieldName === 'location') {
    const locationSelect = document.getElementById('item-location-edit');
    const locationCustomInput = document.getElementById('item-location-custom-edit');
    field = locationSelect;
    const locationValue = locationSelect?.value || '';
    if (locationValue.toLowerCase() === 'другое') {
      const customValue = locationCustomInput?.value.trim() || '';
      isValid = customValue !== '';
    } else {
      isValid = locationValue !== '' && VALID_LOCATIONS.some(location => location.toLowerCase() === locationValue.toLowerCase());
    }
  } else if (fieldName === 'location-custom') {
    field = document.getElementById('item-location-custom-edit');
    value = field?.value.trim() || '';
    isValid = value !== '';
  } else if (fieldName === 'unit') {
    field = document.getElementById('item-unit-edit');
    value = field?.value || '';
    isValid = value !== '' && VALID_UNITS.includes(value);
    // Обновляем бейдж единицы измерения
    if (isValid) {
      const unitBadge = document.getElementById('item-unit-badge');
      if (unitBadge) {
        unitBadge.textContent = value;
      }
    }
  } else if (fieldName === 'description') {
    // Описание необязательное, всегда валидно
    isValid = true;
  } else if (fieldName === 'image') {
    // Изображение необязательное, всегда валидно
    isValid = true;
  }

  // Не вызываем updateEditItemFieldValidation - не показываем визуальные ошибки при редактировании
  return isValid;
}

/**
 * Обновить визуальное состояние валидации поля редактирования
 * При редактировании существующей карточки не показываем ошибки валидации
 */
function updateEditItemFieldValidation(field, isValid) {
  if (!field) return;

  // При редактировании существующей карточки не показываем визуальные индикаторы ошибок
  // Только обновляем border при фокусе для лучшего UX
  field.classList.remove('border-red-300', 'dark:border-red-700', 'border-green-500', 'dark:border-green-600', 'focus:ring-red-500', 'focus:border-red-500', 'focus:ring-green-500', 'focus:border-green-500', 'border-slate-300', 'dark:border-slate-600');

  // Для полей с border-b-2 просто обновляем цвет при фокусе
  if (field.classList.contains('border-b-2')) {
    // Ничего не делаем - стиль уже настроен через CSS классы
  }
}

// Глобальная переменная для хранения загруженных данных из файла
let importedData = {
  items: [], // Массив товаров для импорта
  errors: [], // Массив ошибок
  duplicates: [] // Массив дубликатов
};

/**
 * Показать прогресс-бар загрузки
 * @param {number} percent - Процент (0-100)
 * @param {string} text - Текст статуса
 */
function showUploadProgress(percent, text) {
  const defaultContent = document.getElementById('upload-default-content');
  const progressContent = document.getElementById('upload-progress-content');
  const successContent = document.getElementById('upload-success-content');

  if (defaultContent) defaultContent.classList.add('hidden');
  if (successContent) successContent.classList.add('hidden');
  if (progressContent) {
    progressContent.classList.remove('hidden');
    updateUploadProgress(percent, text);
  }
}

/**
 * Обновить прогресс загрузки
 * @param {number} percent - Процент (0-100)
 * @param {string} text - Текст статуса
 */
function updateUploadProgress(percent, text) {
  const progressCircle = document.getElementById('upload-progress-circle');
  const progressPercentage = document.getElementById('upload-progress-percentage');
  const progressText = document.getElementById('upload-progress-text');

  // Вычисляем смещение для круга (283 - окружность с радиусом 45)
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (circumference * percent / 100);

  if (progressCircle) {
    progressCircle.style.strokeDashoffset = offset;
  }
  if (progressPercentage) {
    progressPercentage.textContent = `${Math.round(percent)}%`;
  }
  if (progressText && text) {
    progressText.textContent = text;
  }
}

/**
 * Скрыть прогресс-бар загрузки
 */
function hideUploadProgress() {
  const progressContent = document.getElementById('upload-progress-content');
  if (progressContent) {
    progressContent.classList.add('hidden');
  }
}

/**
 * Показать информацию о загруженном файле
 * @param {string} fileName - Имя файла
 * @param {Object} data - Данные импорта
 */
function showUploadSuccess(fileName, data) {
  const defaultContent = document.getElementById('upload-default-content');
  const progressContent = document.getElementById('upload-progress-content');
  const successContent = document.getElementById('upload-success-content');
  const fileSuccessIcon = document.getElementById('file-success-icon');

  if (defaultContent) defaultContent.classList.add('hidden');
  if (progressContent) progressContent.classList.add('hidden');
  if (successContent) {
    successContent.classList.remove('hidden');

    const uploadFileName = document.getElementById('upload-file-name');
    const uploadFileStats = document.getElementById('upload-file-stats');
    const totalItems = data.items.length + data.errors.length + data.duplicates.length;

    if (uploadFileName) {
      uploadFileName.textContent = fileName || `Загружено ${totalItems} позиций`;
    }
    if (uploadFileStats) {
      uploadFileStats.textContent = `Загружено ${totalItems} позиций • Новых: ${data.items.length} | Ошибок: ${data.errors.length} | Дубликатов: ${data.duplicates.length}`;
    }
  }
  if (fileSuccessIcon) {
    fileSuccessIcon.classList.remove('hidden');
  }

  // Обработчик кнопки "Заменить файл"
  const replaceFileBtn = document.getElementById('replace-file-btn');
  if (replaceFileBtn) {
    replaceFileBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Сбрасываем состояние к начальному
      if (defaultContent) defaultContent.classList.remove('hidden');
      if (successContent) successContent.classList.add('hidden');
      if (fileSuccessIcon) fileSuccessIcon.classList.add('hidden');
      // Очищаем данные
      importedData = { items: [], errors: [], duplicates: [] };
      // Очищаем предпросмотр
      const previewContainer = document.getElementById('import-preview');
      if (previewContainer) previewContainer.innerHTML = '';
      // Скрываем фильтры
      const filterButtons = document.getElementById('filter-buttons');
      if (filterButtons) filterButtons.classList.add('hidden');
      // Сбрасываем кнопку импорта
      const importBtn = document.getElementById('import-btn');
      if (importBtn) {
        importBtn.disabled = true;
        importBtn.innerHTML = `
          <div class="size-6 rounded-full bg-slate-700 dark:bg-slate-200 flex items-center justify-center">
            <span class="material-symbols-outlined text-[16px]">save</span>
          </div>
          Импортировать
        `;
      }
      // Открываем выбор файла
      window.openFilePicker();
    };
  }
}

/**
 * Обработка выбранного файла
 * Читает Excel или CSV файл и парсит данные
 * 
 * @param {File} file - Выбранный файл
 */
async function handleFileSelect(file) {
  console.log('Обработка файла:', file.name);

  try {
    // Проверяем тип файла
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const isCSV = fileName.endsWith('.csv');

    if (!isExcel && !isCSV) {
      showError('Неподдерживаемый формат файла. Используйте .xlsx, .xls или .csv');
      return;
    }

    // Показываем прогресс-бар
    showUploadProgress(0, 'Чтение файла...');

    let parsedData = [];
    let extractedImages = new Map();
    let imageRowMap = new Map(); // Карта связи изображений со строками

    if (isExcel) {
      // Читаем Excel файл (теперь возвращает объект с data и images)
      console.log('📥 Начинаем парсинг Excel файла...');
      console.log('📋 Файл:', file.name, file.size, 'байт');
      updateUploadProgress(20, 'Парсинг Excel файла...');

      let result;
      try {
        result = await parseExcelFile(file);
        console.log('✅ Парсинг Excel завершен. Результат:', {
          hasData: !!result.data,
          hasImages: !!result.images,
          dataLength: result.data ? result.data.length : 0,
          imagesSize: result.images ? result.images.size : 0,
          isArray: Array.isArray(result),
          keys: Object.keys(result)
        });
      } catch (parseError) {
        console.error('❌ Ошибка парсинга Excel:', parseError);
        hideUploadProgress();
        throw parseError;
      }

      parsedData = result.data || result; // Поддержка старого формата
      extractedImages = result.images || new Map();
      imageRowMap = result.imageRowMap || new Map(); // Карта связи изображений со строками
      console.log(`🖼️ Извлечено изображений из результата: ${extractedImages.size}`);
      if (imageRowMap.size > 0) {
        console.log(`📋 Найдена связь для ${imageRowMap.size} изображений со строками`);
      }

      if (extractedImages.size === 0) {
        console.warn('⚠️ ВНИМАНИЕ: Изображения не были извлечены из Excel файла!');
        console.warn('Проверьте логи выше, чтобы понять причину.');
      }
    } else if (isCSV) {
      // Читаем CSV файл
      updateUploadProgress(30, 'Парсинг CSV файла...');
      parsedData = await parseCSVFile(file);
    }

    console.log('📊 Распарсено строк:', parsedData.length);
    updateUploadProgress(50, 'Обработка данных...');

    // Валидируем и обрабатываем данные (передаем изображения и карту связей)
    const processedData = await processImportedData(parsedData, extractedImages, imageRowMap);

    updateUploadProgress(90, 'Завершение...');

    // Сохраняем данные для импорта
    importedData = processedData;

    // Сохраняем информацию о файле
    importedData.fileName = file.name;

    // Обновляем интерфейс с результатами
    updateImportPreview(processedData, file.name);

    // Скрываем прогресс и показываем информацию о файле
    updateUploadProgress(100, 'Готово!');
    setTimeout(() => {
      hideUploadProgress();
      showUploadSuccess(file.name, processedData);
    }, 300);

  } catch (error) {
    console.error('Ошибка обработки файла:', error);
    hideUploadProgress();
    showError('Не удалось обработать файл: ' + error.message);
  }
}

// Делаем функцию handleFileSelect доступной глобально для обработчиков событий
// Это нужно, потому что обработчик события создается динамически
window.handleFileSelect = handleFileSelect;

/**
 * Извлечь изображения из Excel файла
 * Excel файлы - это ZIP архивы, содержащие изображения в папке xl/media/
 * 
 * @param {File} file - Excel файл
 * @returns {Promise<Object>} - Объект с изображениями и их связями со строками:
 *   { images: Map<fileName, Blob>, imageRowMap: Map<fileName, rowIndex> }
 */
async function extractImagesFromExcel(file) {
  const imagesMap = new Map();
  const imageRowMap = new Map(); // Карта: имя файла изображения -> индекс строки (0-based)

  try {
    console.log('🔍 Начинаем извлечение изображений из Excel файла...');
    console.log('📋 Параметры файла:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified).toLocaleString()
    });

    // Проверяем, что файл доступен
    if (!file || !file.arrayBuffer) {
      console.error('❌ Файл недоступен или не поддерживает arrayBuffer()');
      return imagesMap;
    }

    // Проверяем, что библиотека JSZip загружена
    if (typeof JSZip === 'undefined' && typeof window.JSZip === 'undefined') {
      console.warn('⚠️ Библиотека JSZip не загружена. Изображения не будут извлечены.');
      console.warn('Проверьте, что библиотека JSZip подключена в items-import.html');
      return imagesMap;
    }

    const JSZipLib = window.JSZip || JSZip;
    console.log('✅ Библиотека JSZip найдена');

    // Читаем файл как ArrayBuffer
    console.log('📖 Читаем файл через arrayBuffer()...');
    let arrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
      console.log(`✅ Файл прочитан. Размер: ${(arrayBuffer.byteLength / 1024).toFixed(2)} КБ`);
    } catch (readError) {
      console.error('❌ Ошибка чтения файла:', readError);
      // Пытаемся прочитать через FileReader как запасной вариант
      console.log('🔄 Пытаемся прочитать через FileReader...');
      arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
      console.log(`✅ Файл прочитан через FileReader. Размер: ${(arrayBuffer.byteLength / 1024).toFixed(2)} КБ`);
    }

    // Распаковываем ZIP архив
    console.log('📦 Распаковываем ZIP архив...');
    const zip = await JSZipLib.loadAsync(arrayBuffer);
    console.log('✅ ZIP архив распакован');

    // Показываем все папки для отладки
    const allFiles = Object.keys(zip.files);
    console.log(`📁 Всего файлов в архиве: ${allFiles.length}`);
    const folders = new Set(allFiles.map(f => f.split('/')[0]));
    console.log('📂 Папки в архиве:', Array.from(folders));

    // Изображения в Excel хранятся в папке xl/media/
    // В JSZip нужно использовать полный путь к файлу, а не получать через folder().file()
    const mediaFolderPath = 'xl/media/';

    // Ищем все файлы, которые начинаются с xl/media/ и являются изображениями
    const imageFiles = allFiles.filter(filePath => {
      // Проверяем, что файл находится в папке xl/media/
      if (!filePath.startsWith(mediaFolderPath)) {
        return false;
      }

      // Проверяем, что это файл изображения (не папка)
      const lowerName = filePath.toLowerCase();
      return !filePath.endsWith('/') && ( // Не папка
        lowerName.endsWith('.png') ||
        lowerName.endsWith('.jpg') ||
        lowerName.endsWith('.jpeg') ||
        lowerName.endsWith('.gif') ||
        lowerName.endsWith('.webp')
      );
    });

    console.log(`🖼️ Найдено изображений в Excel: ${imageFiles.length}`);

    if (imageFiles.length === 0) {
      console.warn('⚠️ Изображения не найдены в папке xl/media/');
      // Проверяем, есть ли изображения в других местах
      const otherImages = allFiles.filter(filePath => {
        const lowerName = filePath.toLowerCase();
        return !filePath.endsWith('/') && (
          lowerName.endsWith('.png') ||
          lowerName.endsWith('.jpg') ||
          lowerName.endsWith('.jpeg') ||
          lowerName.endsWith('.gif') ||
          lowerName.endsWith('.webp')
        );
      });
      if (otherImages.length > 0) {
        console.warn(`⚠️ Найдено ${otherImages.length} изображений в других местах:`, otherImages.slice(0, 5));
      }
      return imagesMap;
    }

    console.log('📸 Первые изображения:', imageFiles.slice(0, 5));

    // ВАЖНО: Сначала пытаемся определить связь изображений со строками через XML файлы
    // Это нужно для правильного сопоставления изображений товарам
    try {
      console.log(`🔍 Вызываем parseImageRowMappings для ${imageFiles.length} изображений...`);
      await parseImageRowMappings(zip, imageRowMap, imageFiles);
      console.log(`✅ parseImageRowMappings завершена. Создано связей: ${imageRowMap.size}`);
      if (imageRowMap.size === 0) {
        console.error(`❌ КРИТИЧЕСКАЯ ПРОБЛЕМА: parseImageRowMappings не создала ни одной связи!`);
        console.error(`   Изображения не смогут быть сопоставлены с товарами.`);
      }
    } catch (parseError) {
      console.error('❌ Ошибка в parseImageRowMappings:', parseError);
      console.error('   Детали:', parseError.message);
      console.error('   Стек:', parseError.stack);
      console.warn('⚠️ Не удалось определить связь изображений со строками из XML');
    }

    // Извлекаем каждое изображение напрямую из zip по полному пути
    for (const imagePath of imageFiles) {
      try {
        // Получаем файл напрямую из zip по полному пути
        const zipFile = zip.file(imagePath);

        if (!zipFile) {
          console.warn(`⚠️ Файл не найден в zip: ${imagePath}`);
          continue;
        }

        // Извлекаем данные изображения
        const imageData = await zipFile.async('blob');
        const fileName = imagePath.split('/').pop(); // Получаем только имя файла (например, image1.png)
        imagesMap.set(fileName, imageData);
        console.log(`✅ Извлечено изображение: ${fileName} (${(imageData.size / 1024).toFixed(2)} КБ)`);
      } catch (error) {
        console.warn(`❌ Не удалось извлечь изображение ${imagePath}:`, error);
        console.warn('Детали ошибки:', error.message);
      }
    }

    console.log(`✅ Извлечение завершено. Всего извлечено: ${imagesMap.size} изображений`);
    if (imageRowMap.size > 0) {
      console.log(`📋 Определена связь для ${imageRowMap.size} изображений со строками`);
    }

    return { images: imagesMap, imageRowMap: imageRowMap };
  } catch (error) {
    console.error('❌ Ошибка извлечения изображений из Excel:', error);
    console.error('Детали ошибки:', error.message, error.stack);
    return { images: imagesMap, imageRowMap: new Map() };
  }
}

/**
 * Парсинг XML файлов Excel для определения связи изображений со строками
 * 
 * @param {JSZip} zip - Распакованный Excel файл
 * @param {Map} imageRowMap - Карта для сохранения связей (имя файла -> индекс строки)
 * @param {Array} imageFiles - Массив путей к файлам изображений
 */
async function parseImageRowMappings(zip, imageRowMap, imageFiles) {
  console.log(`🔍 Начинаем parseImageRowMappings: ${imageFiles.length} изображений для обработки`);
  try {
    // Ищем файл worksheet (обычно xl/worksheets/sheet1.xml)
    const worksheetFiles = Object.keys(zip.files).filter(path =>
      path.startsWith('xl/worksheets/sheet') && path.endsWith('.xml')
    );

    console.log(`📄 Найдено worksheet файлов: ${worksheetFiles.length}`);

    if (worksheetFiles.length === 0) {
      console.warn('⚠️ Файлы worksheet не найдены');
      return;
    }

    // Используем первый лист
    const worksheetPath = worksheetFiles[0];
    const worksheetFile = zip.file(worksheetPath);

    if (!worksheetFile) {
      console.warn(`⚠️ Файл worksheet не найден: ${worksheetPath}`);
      return;
    }

    // Читаем XML worksheet
    const worksheetXml = await worksheetFile.async('string');
    const parser = new DOMParser();
    const worksheetDoc = parser.parseFromString(worksheetXml, 'text/xml');

    // Ищем все элементы drawing (изображения)
    const drawings = worksheetDoc.getElementsByTagName('drawing');

    console.log(`🖼️ Найдено элементов drawing: ${drawings.length}`);

    if (drawings.length === 0) {
      console.warn('⚠️ Элементы drawing не найдены в worksheet');
      console.warn('   Это может означать, что изображения встроены нестандартным способом');
      return;
    }

    // Получаем rId из атрибута r:id (например, "rId1")
    const drawingRIds = [];
    for (let i = 0; i < drawings.length; i++) {
      const rId = drawings[i].getAttribute('r:id');
      if (rId) {
        drawingRIds.push(rId);
      }
    }

    console.log(`📋 Найдено ${drawingRIds.length} элементов drawing в worksheet`);

    // Находим файл relationships для worksheet
    const sheetNumber = worksheetPath.match(/sheet(\d+)\.xml/)?.[1] || '1';
    const relsPath = `xl/worksheets/_rels/sheet${sheetNumber}.xml.rels`;
    const relsFile = zip.file(relsPath);

    if (!relsFile) {
      console.warn(`⚠️ Файл relationships не найден: ${relsPath}`);
      return;
    }

    // Читаем relationships XML
    const relsXml = await relsFile.async('string');
    const relsDoc = parser.parseFromString(relsXml, 'text/xml');

    // Находим связь между drawing и файлом drawings
    const relationships = relsDoc.getElementsByTagName('Relationship');
    const drawingRelations = new Map();

    for (let i = 0; i < relationships.length; i++) {
      const rel = relationships[i];
      const id = rel.getAttribute('Id');
      const target = rel.getAttribute('Target');
      const type = rel.getAttribute('Type');

      console.log(`   Relationship ${i}: Id="${id}", Type="${type}", Target="${target}"`);

      // Ищем связи с типом drawing
      if (type && type.includes('drawing')) {
        // Преобразуем относительный путь в абсолютный
        // Relationships файл находится в xl/worksheets/_rels/, поэтому относительные пути идут оттуда
        let fullPath;
        if (target.startsWith('/')) {
          // Абсолютный путь
          fullPath = target.substring(1);
        } else if (target.startsWith('../')) {
          // "../drawings/drawing1.xml" -> убираем "../" и получаем "drawings/drawing1.xml"
          // Затем добавляем "xl/" -> "xl/drawings/drawing1.xml"
          const relativePath = target.replace('../', '');
          fullPath = `xl/${relativePath}`;
        } else if (target.startsWith('drawings/')) {
          // "drawings/drawing1.xml" -> "xl/drawings/drawing1.xml"
          fullPath = `xl/${target}`;
        } else {
          // Просто имя файла -> "xl/drawings/drawing1.xml"
          fullPath = `xl/drawings/${target}`;
        }

        // Нормализуем путь: убираем все "../" и двойные слеши
        // Например: "xl/drawings/../drawings/drawing1.xml" -> "xl/drawings/drawing1.xml"
        const pathParts = fullPath.split('/');
        const normalizedParts = [];
        for (const part of pathParts) {
          if (part === '..') {
            normalizedParts.pop(); // Убираем предыдущую часть
          } else if (part !== '.' && part !== '') {
            normalizedParts.push(part);
          }
        }
        fullPath = normalizedParts.join('/');

        console.log(`   ✅ Drawing relation: ${id} -> "${target}" -> "${fullPath}"`);
        drawingRelations.set(id, fullPath);
      }
    }

    // Создаем массив для хранения информации о связи изображений со строками
    const imageRowMappings = [];

    console.log(`📋 Найдено drawing RIds: ${drawingRIds.length}`, drawingRIds);
    console.log(`📋 Найдено drawing relations: ${drawingRelations.size}`);
    console.log(`📋 Drawing relations:`, Array.from(drawingRelations.entries()));

    // Проходим по всем drawing файлам и извлекаем информацию о позициях изображений
    for (const rId of drawingRIds) {
      const drawingPath = drawingRelations.get(rId);
      console.log(`🔍 Обрабатываем rId "${rId}": drawingPath = "${drawingPath}"`);

      if (!drawingPath) {
        console.warn(`⚠️ Для rId "${rId}" не найден drawingPath в drawingRelations`);
        continue;
      }

      const drawingFile = zip.file(drawingPath);
      if (!drawingFile) {
        console.error(`❌ Drawing файл не найден в zip: ${drawingPath}`);
        console.error(`   Проверяем доступные файлы в xl/drawings/:`);
        const drawingsFiles = Object.keys(zip.files).filter(f => f.includes('drawings/') && !f.includes('_rels'));
        console.error(`   Найдено файлов:`, drawingsFiles);
        continue;
      }

      console.log(`✅ Drawing файл найден: ${drawingPath}`);

      try {
        console.log(`📖 Читаем drawing файл: ${drawingPath}`);
        const drawingXml = await drawingFile.async('string');
        console.log(`✅ Drawing файл прочитан, размер: ${drawingXml.length} символов`);

        const drawingDoc = parser.parseFromString(drawingXml, 'text/xml');

        // Проверяем на ошибки парсинга
        const parserError = drawingDoc.querySelector('parsererror');
        if (parserError) {
          console.error(`❌ Ошибка парсинга XML в ${drawingPath}:`, parserError.textContent);
          continue;
        }

        console.log(`🔍 Ищем anchors в drawing файле...`);

        // Ищем элементы twoCellAnchor (позиция изображения между двумя ячейками)
        // Также проверяем oneCellAnchor (изображение в одной ячейке)
        let anchors = drawingDoc.getElementsByTagName('xdr:twoCellAnchor');
        console.log(`   xdr:twoCellAnchor найдено: ${anchors.length}`);
        if (anchors.length === 0) {
          anchors = drawingDoc.getElementsByTagName('twoCellAnchor');
          console.log(`   twoCellAnchor найдено: ${anchors.length}`);
        }

        // Пробуем также oneCellAnchor
        let oneCellAnchors = drawingDoc.getElementsByTagName('xdr:oneCellAnchor');
        console.log(`   xdr:oneCellAnchor найдено: ${oneCellAnchors.length}`);
        if (oneCellAnchors.length === 0) {
          oneCellAnchors = drawingDoc.getElementsByTagName('oneCellAnchor');
          console.log(`   oneCellAnchor найдено: ${oneCellAnchors.length}`);
        }

        // Объединяем все anchors
        const allAnchors = [...Array.from(anchors), ...Array.from(oneCellAnchors)];

        console.log(`🔍 Найдено anchors в drawing файле ${drawingPath}: ${allAnchors.length}`);

        if (allAnchors.length === 0) {
          console.error(`❌ КРИТИЧЕСКАЯ ПРОБЛЕМА: Не найдено ни одного anchor в drawing файле!`);
          console.error(`   Проверяем структуру XML...`);
          // Выводим первые 500 символов XML для отладки
          console.error(`   Начало XML:`, drawingXml.substring(0, 500));
          // Пробуем найти элементы через другие методы (без querySelectorAll, так как он не поддерживает XPath функции)
          const allElements = drawingDoc.getElementsByTagName('*');
          const anchorLikeElements = Array.from(allElements).filter(el =>
            el.tagName && (el.tagName.includes('Anchor') || el.tagName.includes('anchor'))
          );
          console.error(`   Элементы с "anchor" в имени (через getElementsByTagName): ${anchorLikeElements.length}`);
          if (anchorLikeElements.length > 0) {
            console.error(`   Примеры:`, anchorLikeElements.slice(0, 3).map(el => el.tagName));
          }
        }

        console.log(`🔄 Начинаем обработку ${allAnchors.length} anchors...`);

        for (let i = 0; i < allAnchors.length; i++) {
          const anchor = allAnchors[i];

          // Логируем первые несколько anchors для отладки
          if (i < 3) {
            console.log(`🔍 Обрабатываем anchor ${i}, tagName: ${anchor.tagName}`);
          }

          // Ищем элемент from с разными вариантами пространств имен
          let from = anchor.getElementsByTagName('xdr:from')[0];
          if (!from) {
            from = anchor.getElementsByTagName('from')[0];
          }

          if (!from) {
            if (i < 5) {
              console.warn(`⚠️ Anchor ${i}: элемент 'from' не найден`);
              // Показываем структуру anchor для первых нескольких
              console.warn(`   Дочерние элементы:`, Array.from(anchor.children).map(c => c.tagName));
            }
            continue;
          }

          // Ищем элемент row
          let rowElem = from.getElementsByTagName('xdr:row')[0];
          if (!rowElem) {
            rowElem = from.getElementsByTagName('row')[0];
          }

          if (!rowElem || rowElem.textContent === null || rowElem.textContent === undefined) {
            console.warn(`⚠️ Anchor ${i}: элемент 'row' не найден или пустой`);
            console.warn(`   Дочерние элементы 'from':`, Array.from(from.children).map(c => `${c.tagName}=${c.textContent}`));
            continue;
          }

          const row = parseInt(rowElem.textContent, 10);
          // ВАЖНО: В Excel XML нумерация строк может быть 0-based или 1-based
          // Проверяем: если row = 0, то это может быть 0-based (первая строка данных = 0)
          // Если row >= 1, то это 1-based (первая строка данных = 1 или 2)
          console.log(`📊 Anchor ${i}: найдена строка ${row} (textContent: "${rowElem.textContent}")`);
          console.log(`   → Если 1-based: строка Excel ${row}, индекс данных ${row - 2}, артикул ${row - 1}`);
          console.log(`   → Если 0-based: строка Excel ${row + 1}, индекс данных ${row}, артикул ${row + 1}`);

          // Используем row как есть (обычно это 1-based, где 1 = первая строка Excel)

          // Пропускаем строку 0 (заголовки)
          if (isNaN(row) || row < 1) {
            console.warn(`⚠️ Anchor ${i}: строка ${row} невалидна, пропускаем`);
            continue;
          }

          // Ищем связанное изображение через blip
          let blip = anchor.getElementsByTagName('a:blip')[0];
          if (!blip) {
            blip = anchor.getElementsByTagName('blip')[0];
          }

          if (!blip) {
            if (i < 5) {
              console.warn(`⚠️ Anchor ${i}: элемент 'blip' не найден`);
              // Показываем структуру anchor для отладки
              const pic = anchor.getElementsByTagName('xdr:pic')[0] || anchor.getElementsByTagName('pic')[0];
              if (pic) {
                console.warn(`   Найден элемент 'pic', его дочерние:`, Array.from(pic.children).map(c => c.tagName));
              }
            }
            continue;
          }

          // Пробуем разные варианты атрибута embed
          const embed = blip.getAttribute('r:embed') || blip.getAttribute('embed') || blip.getAttribute('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed');

          if (i < 5) {
            console.log(`   Anchor ${i}: найден blip, embed = "${embed}"`);
          }

          if (!embed) {
            if (i < 5) {
              console.warn(`⚠️ Anchor ${i}: атрибут 'embed' не найден в blip`);
              console.warn(`   Все атрибуты blip:`, Array.from(blip.attributes).map(a => `${a.name}="${a.value}"`));
            }
            continue;
          }

          if (i < 5) {
            console.log(`🔗 Anchor ${i}: найден embed ID "${embed}"`);
          }

          // Находим файл изображения через relationships
          const drawingFileName = drawingPath.split('/').pop();
          const imageRelPath = `xl/drawings/_rels/${drawingFileName}.rels`;
          const imageRelsFile = zip.file(imageRelPath);

          if (imageRelsFile) {
            try {
              const imageRelsXml = await imageRelsFile.async('string');
              const imageRelsDoc = parser.parseFromString(imageRelsXml, 'text/xml');
              const imageRels = imageRelsDoc.getElementsByTagName('Relationship');

              if (i < 5) {
                console.log(`📋 В relationships файле найдено ${imageRels.length} связей, ищем embed ID "${embed}"`);
              }

              let foundRel = false;
              for (let j = 0; j < imageRels.length; j++) {
                const rel = imageRels[j];
                const relId = rel.getAttribute('Id');

                if (i < 5) {
                  console.log(`   Связь ${j}: Id="${relId}", Target="${rel.getAttribute('Target')}"`);
                }

                if (relId === embed) {
                  foundRel = true;
                  const imageTarget = rel.getAttribute('Target');
                  if (!imageTarget) continue;

                  // Правильно определяем путь к изображению
                  // Target в relationships может быть: "../media/image1.png" или "media/image1.png"
                  let fullImagePath;
                  if (imageTarget.startsWith('/')) {
                    fullImagePath = imageTarget.substring(1);
                  } else if (imageTarget.startsWith('../')) {
                    // "../media/image1.png" -> "xl/media/image1.png"
                    fullImagePath = imageTarget.replace('../', 'xl/');
                  } else if (imageTarget.startsWith('media/')) {
                    // "media/image1.png" -> "xl/media/image1.png"
                    fullImagePath = `xl/${imageTarget}`;
                  } else {
                    // Просто имя файла -> "xl/media/image1.png"
                    fullImagePath = `xl/media/${imageTarget}`;
                  }

                  const fileName = fullImagePath.split('/').pop();

                  // Проверяем, что файл действительно существует в списке изображений
                  const imageFileExists = imageFiles.some(path => path.includes(fileName));
                  if (!imageFileExists) {
                    console.warn(`⚠️ Изображение "${fileName}" найдено в XML, но не найдено в списке файлов`);
                  }

                  // В Excel нумерация строк начинается с 1
                  // row в XML - это номер строки в Excel (1-based)
                  // В Excel: строка 1 = заголовки, строка 2 = первая строка данных (артикул 1, индекс 0)
                  // dataIndex - это индекс в массиве данных (0-based)
                  // 
                  // ПРАВИЛЬНАЯ ФОРМУЛА: dataIndex = row - 2
                  // row = 2 (первая строка данных) -> dataIndex = 0 ✓
                  // row = 3 (вторая строка данных) -> dataIndex = 1 ✓
                  const dataIndex = row - 2; // row = 2 -> index = 0, row = 3 -> index = 1

                  // Детальное логирование для отладки
                  console.log(`📊 XML: row=${row} -> dataIndex=${dataIndex} -> артикул должен быть ${dataIndex + 1}`);

                  // Пропускаем строку 1 (заголовки) и строки с отрицательным индексом
                  if (dataIndex >= 0 && row >= 2) {
                    imageRowMappings.push({
                      fileName: fileName,
                      rowExcel: row,
                      dataIndex: dataIndex
                    });
                    console.log(`   ✅ Сохранено: "${fileName}" -> строка Excel ${row} (индекс ${dataIndex}, артикул ${dataIndex + 1})`);
                  } else {
                    console.warn(`   ⚠️ Пропущено: "${fileName}" в строке ${row} (заголовки или невалидная строка)`);
                  }
                  break;
                }
              }

              if (!foundRel) {
                console.error(`❌ Embed ID "${embed}" не найден в relationships файле!`);
                console.error(`   Доступные ID:`, Array.from(imageRels).map(r => r.getAttribute('Id')));
              }
            } catch (relsError) {
              console.error(`❌ Ошибка чтения relationships файла ${imageRelPath}:`, relsError);
              console.error(`   Детали:`, relsError.message);
            }
          } else {
            console.error(`❌ Relationships файл не найден: ${imageRelPath}`);
            console.error(`   Проверяем доступные файлы в xl/drawings/_rels/:`);
            const relsFiles = Object.keys(zip.files).filter(f => f.includes('drawings/_rels'));
            console.error(`   Найдено файлов:`, relsFiles);
          }
        }
      } catch (drawingError) {
        console.warn(`⚠️ Ошибка парсинга drawing файла ${drawingPath}:`, drawingError.message);
      }
    }

    // Сортируем связи по номеру строки в Excel для правильного порядка
    imageRowMappings.sort((a, b) => a.rowExcel - b.rowExcel);

    // Выводим информацию о найденных связях
    console.log(`📋 Найдено ${imageRowMappings.length} связей изображений со строками:`);
    for (let i = 0; i < Math.min(imageRowMappings.length, 10); i++) {
      const mapping = imageRowMappings[i];
      console.log(`  - "${mapping.fileName}" -> строка Excel ${mapping.rowExcel} (индекс данных ${mapping.dataIndex})`);
    }
    if (imageRowMappings.length > 10) {
      console.log(`  ... и еще ${imageRowMappings.length - 10} связей`);
    }

    // Сохраняем все найденные связи в карту
    for (let i = 0; i < imageRowMappings.length; i++) {
      const mapping = imageRowMappings[i];
      imageRowMap.set(mapping.fileName, mapping.dataIndex);
      if (i < 5) {
        console.log(`✅ Сохранена связь: "${mapping.fileName}" -> индекс ${mapping.dataIndex} (строка Excel ${mapping.rowExcel})`);
      }
    }

    if (imageRowMappings.length > 5) {
      console.log(`✅ ... и еще ${imageRowMappings.length - 5} связей сохранено`);
    }

    // Если не удалось определить связи из XML
    if (imageRowMappings.length === 0 && imageFiles.length > 0) {
      console.error('❌ КРИТИЧЕСКАЯ ПРОБЛЕМА: Не удалось определить связи изображений со строками из XML!');
      console.error(`   Изображений найдено: ${imageFiles.length}`);
      console.error(`   Элементов drawing: ${drawings.length}`);
      console.error(`   Это означает, что изображения не смогут быть сопоставлены с товарами.`);
      console.error(`   Возможные причины:`);
      console.error(`   1. Изображения встроены нестандартным способом`);
      console.error(`   2. XML структура отличается от ожидаемой`);
      console.error(`   3. Ошибка при парсинге XML файлов`);
    } else if (imageRowMappings.length > 0) {
      console.log(`✅ Успешно определено ${imageRowMappings.length} связей изображений со строками`);
    }
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА в parseImageRowMappings:', error);
    console.error('   Сообщение:', error.message);
    console.error('   Стек:', error.stack);
    // НЕ пробрасываем ошибку дальше, чтобы не прерывать процесс
    // Просто логируем и продолжаем
  }
}

/**
 * Парсинг Excel файла
 * 
 * @param {File} file - Excel файл
 * @returns {Promise<Object>} - Объект с данными и изображениями: { data: Array, images: Map }
 */
function parseExcelFile(file) {
  return new Promise(async (resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        // Проверяем, что библиотека xlsx загружена
        if (typeof window.XLSX === 'undefined' && typeof XLSX === 'undefined') {
          reject(new Error('Библиотека для чтения Excel не загружена. Обновите страницу.'));
          return;
        }

        // Используем глобальную библиотеку xlsx
        const XLSXLib = window.XLSX || XLSX;

        // Читаем данные из файла
        const data = new Uint8Array(e.target.result);
        // Парсим Excel с помощью библиотеки xlsx
        const workbook = XLSXLib.read(data, { type: 'array' });

        // Берем первый лист
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Преобразуем в JSON (массив объектов)
        const jsonData = XLSXLib.utils.sheet_to_json(worksheet, {
          header: 1, // Используем первую строку как заголовки
          defval: '' // Значение по умолчанию для пустых ячеек
        });

        if (jsonData.length < 2) {
          reject(new Error('Файл пуст или содержит только заголовки'));
          return;
        }

        // Первая строка - заголовки
        const headers = jsonData[0].map(h => String(h).trim().toLowerCase());
        console.log('Заголовки из Excel:', headers);

        // Остальные строки - данные
        const rows = jsonData.slice(1);
        console.log('Всего строк данных:', rows.length);

        // Преобразуем в массив объектов
        // Фильтруем строки: оставляем только те, где есть хотя бы одно непустое значение
        // и при этом есть значение в колонке "название" (обязательное поле)
        const result = rows
          .filter(row => {
            // Проверяем, что строка не полностью пустая
            const hasData = row.some(cell => cell !== '' && cell !== null && cell !== undefined);
            if (!hasData) return false;

            // Проверяем, что есть название (это обязательное поле)
            const nameIndex = headers.indexOf('название');
            if (nameIndex >= 0 && row[nameIndex]) {
              const nameValue = String(row[nameIndex]).trim();
              return nameValue !== '';
            }

            // Если колонка "название" не найдена, но есть данные - оставляем строку
            return hasData;
          })
          .map((row, rowIndex) => {
            const item = {};
            headers.forEach((header, index) => {
              const value = row[index];
              // Обрабатываем значения: null, undefined, пустые строки
              item[header] = (value !== null && value !== undefined && value !== '')
                ? String(value).trim()
                : '';
            });
            // ВАЖНО: Сохраняем номер строки Excel для правильной привязки изображений
            // rowIndex - это индекс в массиве rows (0-based)
            // В Excel: строка 1 = заголовки, строка 2 = первая строка данных (rowIndex = 0)
            // ПРАВИЛЬНАЯ ФОРМУЛА: rowIndex + 2
            // rowIndex = 0 (первая строка данных) -> Excel строка 2 ✓
            // rowIndex = 1 (вторая строка данных) -> Excel строка 3 ✓
            item._excelRowNumber = rowIndex + 2;
            return item;
          });

        console.log('✅ Преобразовано объектов:', result.length);
        if (result.length > 0) {
          console.log('📋 Пример первого объекта:', result[0]);
        }

        // Извлекаем изображения из Excel файла
        console.log('═══════════════════════════════════════');
        console.log('🔄 ЭТАП: Начинаем извлечение изображений из Excel...');
        console.log('📋 Проверяем доступность файла:', {
          name: file?.name,
          size: file?.size,
          type: file?.type,
          hasArrayBuffer: typeof file?.arrayBuffer === 'function'
        });
        console.log('📋 Проверка библиотеки JSZip:', typeof JSZip !== 'undefined' || typeof window.JSZip !== 'undefined');
        console.log('📁 Файл для извлечения:', file.name, file.size, 'байт');

        let imagesResult = { images: new Map(), imageRowMap: new Map() };
        try {
          imagesResult = await extractImagesFromExcel(file);
          console.log(`✅ Извлечение завершено. Найдено изображений: ${imagesResult.images.size}`);
          if (imagesResult.images.size > 0) {
            console.log('📸 Список извлеченных изображений:', Array.from(imagesResult.images.keys()));
            if (imagesResult.imageRowMap.size > 0) {
              console.log(`✅ Определена связь для ${imagesResult.imageRowMap.size} изображений со строками`);
            }
          } else {
            console.log('⚠️ Изображения не найдены в Excel файле');
          }
        } catch (extractError) {
          console.error('❌ Ошибка при извлечении изображений:', extractError);
          console.error('Детали:', extractError.message, extractError.stack);
          // Продолжаем работу даже если извлечение изображений не удалось
          imagesResult = { images: new Map(), imageRowMap: new Map() };
        }

        resolve({
          data: result,
          images: imagesResult.images,
          imageRowMap: imagesResult.imageRowMap
        });
      } catch (error) {
        reject(new Error('Ошибка чтения Excel файла: ' + error.message));
      }
    };

    reader.onerror = () => {
      reject(new Error('Не удалось прочитать файл'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Парсинг CSV файла
 * 
 * @param {File} file - CSV файл
 * @returns {Promise<Array>} - Массив объектов с данными
 */
function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim() !== '');

        if (lines.length < 2) {
          reject(new Error('Файл пуст или содержит только заголовки'));
          return;
        }

        // Парсим CSV (простая версия, поддерживает запятые и точки с запятой)
        const delimiter = text.includes(';') ? ';' : ',';
        const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''));

        const result = lines.slice(1)
          .filter(line => line.trim() !== '')
          .map(line => {
            const values = line.split(delimiter).map(v => v.trim().replace(/"/g, ''));
            const item = {};
            headers.forEach((header, index) => {
              item[header] = values[index] || '';
            });
            return item;
          });

        resolve(result);
      } catch (error) {
        reject(new Error('Ошибка чтения CSV файла: ' + error.message));
      }
    };

    reader.onerror = () => {
      reject(new Error('Не удалось прочитать файл'));
    };

    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Создать slug из текста (транслитерация кириллицы + очистка)
 * 
 * @param {string} text - Исходный текст
 * @returns {string} - URL-friendly slug
 */
function createSlug(text) {
  if (!text || typeof text !== 'string') return '';

  // Карта транслитерации кириллицы в латиницу
  const translitMap = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
    'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };

  return text
    .toLowerCase()
    .split('')
    .map(char => translitMap[char] || char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-') // Заменяем не-буквенно-цифровые символы на дефис
    .replace(/^-+|-+$/g, '') // Убираем дефисы в начале и конце
    .substring(0, 50); // Ограничиваем длину до 50 символов
}

/**
 * Обработка импортированных данных
 * Валидация, проверка на дубликаты, преобразование формата
 * 
 * @param {Array} rawData - Сырые данные из файла
 * @returns {Promise<Object>} - Обработанные данные с ошибками и дубликатами
 */
async function processImportedData(rawData, extractedImages = new Map(), imageRowMap = new Map()) {
  console.log(`📦 Начинаем обработку данных:`);
  console.log(`   Строк данных: ${rawData.length}`);
  console.log(`   Изображений извлечено: ${extractedImages.size}`);

  // НОВАЯ ЛОГИКА: игнорируем XML координаты (imageRowMap)
  // Сортируем изображения по имени файла и привязываем последовательно
  const sortedImages = Array.from(extractedImages.entries())
    .sort((a, b) => {
      // Извлекаем номера из имён файлов для сортировки
      const numA = parseInt(a[0].match(/\d+/)?.[0] || '0');
      const numB = parseInt(b[0].match(/\d+/)?.[0] || '0');
      return numA - numB;
    });

  console.log(`   📊 Изображения отсортированы по именам файлов`);
  if (sortedImages.length > 0) {
    console.log(`   📋 Первые изображения:`, sortedImages.slice(0, 5).map(([name]) => name).join(', '));
  }

  // Список строк Excel БЕЗ картинок (пропускаем их при привязке изображений)
  const rowsWithoutImages = new Set([18, 20, 68, 69, 73, 80, 90, 99, 100, 107, 109, 130, 142, 149]);
  console.log(`   🚫 Строки без картинок (${rowsWithoutImages.size} шт):`, Array.from(rowsWithoutImages).sort((a, b) => a - b).join(', '));

  // Счётчик для последовательной привязки изображений к строкам с товарами
  let imageIndex = 0;

  // Получаем все существующие товары для проверки дубликатов
  const existingItems = await items.getAllItems();

  // Импортируем функцию для загрузки изображений в Supabase Storage
  const { uploadFileToStorage } = await import('./supabase.js');

  const processed = {
    items: [],
    errors: [],
    duplicates: []
  };

  // Set для отслеживания дубликатов внутри импортируемого файла
  // Ключ = "название|описание|артикул|фото" (все 4 поля)
  const importedDuplicateKeys = new Set();

  // Set для отслеживания артикулов внутри файла (для проверки конфликтов)
  const importedSkus = new Set();

  // Маппинг русских названий столбцов на английские
  // Важно: ключи должны быть в нижнем регистре, так как заголовки нормализуются
  const columnMapping = {
    'название': 'name',
    'name': 'name',
    'категория': 'category',
    'category': 'category',
    'единица измерения': 'unit',
    'единица': 'unit',
    'unit': 'unit',
    'место хранения': 'location',
    'location': 'location',
    'артикул': 'sku',
    'sku': 'sku',
    'описание': 'description',
    'description': 'description',
    // Все возможные варианты названий колонок с изображениями
    'фото': 'photo',
    'photo': 'photo',
    'image_url': 'photo',
    'image': 'photo',
    'изображение': 'photo',
    'url изображения': 'photo',
    'ссылка на фото': 'photo',
    'ссылка на изображение': 'photo',
    'картинка': 'photo',
    'img': 'photo',
    'img_url': 'photo',
    'picture': 'photo',
    'url': 'photo' // Если колонка называется просто "url", это может быть изображение
  };

  console.log('Обработка данных. Всего строк:', rawData.length);
  console.log('Пример первой строки:', rawData[0]);

  // Логируем все найденные колонки для отладки
  if (rawData.length > 0) {
    const allColumns = Object.keys(rawData[0]);
    console.log('Найденные колонки в файле:', allColumns);
    console.log('Колонки, которые будут распознаны как изображения:',
      allColumns.filter(col => columnMapping[col.toLowerCase()] === 'photo'));
  }

  rawData.forEach((row, index) => {
    // Используем _excelRowNumber если есть, иначе вычисляем из индекса
    // В Excel: строка 1 = заголовки, строка 2 = первая строка данных (index = 0)
    // ПРАВИЛЬНАЯ ФОРМУЛА: index + 2
    const rowNumber = row._excelRowNumber || (index + 2); // +2 потому что первая строка - заголовки, нумерация с 1

    // Преобразуем ключи в нижний регистр и нормализуем
    const normalizedRow = {};
    Object.keys(row).forEach(key => {
      const normalizedKey = columnMapping[key.toLowerCase()] || key.toLowerCase();
      normalizedRow[normalizedKey] = row[key];
    });

    // Логируем первые несколько строк для отладки
    if (index < 3) {
      console.log(`Строка ${rowNumber}:`, { оригинал: row, нормализовано: normalizedRow });
      // Специально логируем информацию об изображениях
      if (normalizedRow.photo) {
        console.log(`  → Найдено изображение: "${normalizedRow.photo}"`);
      } else {
        // Проверяем, есть ли в оригинале колонка с изображением, которая не была распознана
        const imageColumns = Object.keys(row).filter(col => {
          const colLower = col.toLowerCase();
          return colLower.includes('фото') || colLower.includes('image') ||
            colLower.includes('photo') || colLower.includes('img') ||
            colLower.includes('изображение') || colLower.includes('картинка');
        });
        if (imageColumns.length > 0) {
          console.log(`  → ВНИМАНИЕ: Найдена колонка, похожая на изображение, но не распознанная:`, imageColumns);
          imageColumns.forEach(col => {
            console.log(`    - "${col}": "${row[col]}"`);
          });
        }
      }
    }

    // Валидация
    const name = (normalizedRow.name || '').trim();
    const sku = (normalizedRow.sku || '').trim();
    const unit = (normalizedRow.unit || '').trim();
    const category = (normalizedRow.category || '').trim();
    const location = (normalizedRow.location || '').trim();
    const description = (normalizedRow.description || '').trim();

    // Проверка обязательных полей
    if (!name) {
      processed.errors.push({
        row: rowNumber,
        data: normalizedRow,
        message: 'Отсутствует название товара'
      });
      return;
    }

    // Проверка обязательного поля: артикул
    if (!sku) {
      processed.errors.push({
        row: rowNumber,
        data: normalizedRow,
        message: 'Отсутствует артикул'
      });
      return;
    }

    // Проверка обязательного поля: категория
    if (!category) {
      processed.errors.push({
        row: rowNumber,
        data: normalizedRow,
        message: 'Отсутствует категория'
      });
      return;
    }

    // Проверка обязательного поля: место хранения
    if (!location) {
      processed.errors.push({
        row: rowNumber,
        data: normalizedRow,
        message: 'Отсутствует место хранения'
      });
      return;
    }

    // Проверка обязательного поля: единица измерения
    if (!unit) {
      processed.errors.push({
        row: rowNumber,
        data: normalizedRow,
        message: 'Отсутствует единица измерения'
      });
      return;
    }

    // ВАЖНО: Обрабатываем изображения ДО проверки на дубликаты,
    // чтобы изображения были доступны и для дубликатов
    // Обрабатываем поле "фото" - может быть URL или путь к изображению
    let imageUrl = null;

    // Проверяем normalizedRow.photo (после маппинга)
    if (normalizedRow.photo) {
      const photoValue = String(normalizedRow.photo).trim();
      // Пропускаем пустые значения, null, undefined
      if (photoValue && photoValue !== 'null' && photoValue !== 'undefined' && photoValue !== '') {
        // Если это URL (начинается с http:// или https://), используем как есть
        if (photoValue.startsWith('http://') || photoValue.startsWith('https://')) {
          imageUrl = photoValue;
        } else if (photoValue.startsWith('data:image')) {
          // Если это base64 изображение, используем как есть
          imageUrl = photoValue;
        } else if (photoValue !== '') {
          // Если это путь к файлу, можно попробовать преобразовать в URL
          // Или просто сохранить как есть, если это относительный путь
          imageUrl = photoValue;
        }
      }
    }

    // Также проверяем оригинальные ключи на случай, если маппинг не сработал
    // Ищем любую колонку, которая может содержать изображение
    if (!imageUrl) {
      Object.keys(row).forEach(key => {
        const keyLower = key.toLowerCase();
        // Если это похоже на колонку с изображением
        if ((keyLower.includes('фото') || keyLower.includes('image') ||
          keyLower.includes('photo') || keyLower.includes('img') ||
          keyLower.includes('изображение') || keyLower.includes('картинка') ||
          keyLower === 'url') && row[key]) {
          const value = String(row[key]).trim();
          if (value && value !== 'null' && value !== 'undefined' && value !== '') {
            imageUrl = value;
            console.log(`Найдено изображение в колонке "${key}":`, imageUrl);
          }
        }
      });
    }

    // НОВАЯ ЛОГИКА: последовательная привязка изображений к непустым строкам
    // Игнорируем XML координаты, так как изображения размещены "поверх" таблицы
    if (!imageUrl && sortedImages.length > 0) {
      let matchedImage = null;
      let matchedFileName = null;

      console.log(`\n🔍 ====== СТРОКА EXCEL ${rowNumber} ======`);
      console.log(`   📝 Товар: "${name.substring(0, 40)}..."`);

      // ВАЖНО: Проверяем, не входит ли эта строка Excel в список строк БЕЗ картинок
      if (rowsWithoutImages.has(rowNumber)) {
        console.log(`   🚫 Строка Excel ${rowNumber} в списке БЕЗ картинок`);
        console.log(`   ❌ РЕЗУЛЬТАТ: image_url = null (по списку исключений)\n`);
        // Явно устанавливаем null
        normalizedRow._extractedImage = null;
        normalizedRow.image_url = null;
      }
      // Проверяем, что это непустая строка с товаром (есть название)
      else if (name && name.trim() !== '') {
        // Берём следующее изображение из отсортированного списка
        if (imageIndex < sortedImages.length) {
          const [fileName, imageBlob] = sortedImages[imageIndex];
          matchedImage = imageBlob;
          matchedFileName = fileName;
          imageIndex++; // Переходим к следующему изображению

          console.log(`   ✅ Привязано изображение #${imageIndex}: "${fileName}"`);
          console.log(`   🔢 Осталось изображений: ${sortedImages.length - imageIndex}`);

          // Извлекаем расширение из оригинального файла
          let fileExtension = 'png'; // По умолчанию png
          if (matchedFileName && matchedFileName.includes('.')) {
            const parts = matchedFileName.split('.');
            fileExtension = parts[parts.length - 1].toLowerCase();
          }

          // Создаём slug из названия товара
          const slug = createSlug(name);

          // Формируем имя в формате {slug}.{расширение}
          const finalFileName = slug ? `${slug}.${fileExtension}` : `image${imageIndex}.${fileExtension}`;

          normalizedRow._extractedImage = {
            blob: matchedImage,
            fileName: finalFileName,
            originalFileName: matchedFileName
          };

          console.log(`   📎 ✅ РЕЗУЛЬТАТ: "${matchedFileName}" → "${finalFileName}"`);
          console.log(`   🏷️ Slug: "${slug}" (из: "${name.substring(0, 30)}...")\n`);
        } else {
          console.log(`   ⚠️ Изображения закончились (всего было ${sortedImages.length})`);
          console.log(`   ❌ РЕЗУЛЬТАТ: image_url = null\n`);
          normalizedRow._extractedImage = null;
          normalizedRow.image_url = null;
        }
      } else {
        console.log(`   ⏭️ Пропускаем: пустая строка или нет названия`);
        console.log(`   ❌ РЕЗУЛЬТАТ: image_url = null\n`);
        normalizedRow._extractedImage = null;
        normalizedRow.image_url = null;
      }
    } else if (!imageUrl && extractedImages.size === 0) {
      // Если изображений вообще нет в файле
      normalizedRow._extractedImage = null;
    }

    // Сохраняем обработанное изображение в normalizedRow для использования в дубликатах
    // ВАЖНО: Если изображение не найдено (_extractedImage === null и нет imageUrl), то image_url должен быть null
    if (normalizedRow._extractedImage === null && !imageUrl) {
      normalizedRow.image_url = null; // Явно устанавливаем null, если изображение не найдено
    } else {
      normalizedRow.image_url = imageUrl || null; // Используем URL из колонки, если есть, иначе null
    }

    // Логируем все изображения для отладки
    if (normalizedRow._extractedImage) {
      console.log(`✓ Строка ${rowNumber} (${name}): изображение "${normalizedRow._extractedImage.fileName}" будет загружено`);
    } else if (imageUrl) {
      console.log(`✓ Строка ${rowNumber} (${name}): используется URL из колонки:`, imageUrl);
    } else {
      console.log(`✗ Строка ${rowNumber} (${name}): изображение отсутствует, image_url = null`);
    }

    // Получаем URL изображения для сравнения
    // Для извлечённых изображений используем имя файла, для URL - сам URL
    let currentImageIdentifier = null;
    if (normalizedRow._extractedImage && normalizedRow._extractedImage.fileName) {
      currentImageIdentifier = normalizedRow._extractedImage.fileName.toLowerCase();
    } else if (imageUrl) {
      try {
        const url = new URL(imageUrl);
        currentImageIdentifier = url.pathname.split('/').pop().toLowerCase();
      } catch {
        currentImageIdentifier = imageUrl.split('/').pop().toLowerCase();
      }
    }

    // Проверка на дубликаты: ПОЛНОЕ совпадение ВСЕХ 4 полей
    // Дубликат = название + описание + артикул + фото полностью идентичны
    let isDuplicate = false;
    let existingItem = null;

    const normalizedSku = String(sku).trim().toLowerCase();
    const descLower = description ? description.toLowerCase() : '';

    // Сначала проверяем дубликаты в СУЩЕСТВУЮЩЕЙ базе данных
    existingItem = existingItems.find(item => {
      // Сравниваем название
      const itemName = (item.name || '').toLowerCase().trim();
      if (itemName !== name.toLowerCase()) return false;

      // Сравниваем описание
      const itemDesc = (item.description || '').toLowerCase().trim();
      if (itemDesc !== descLower) return false;

      // Сравниваем артикул
      const itemSku = item.sku ? String(item.sku).trim().toLowerCase() : '';
      if (itemSku !== normalizedSku) return false;

      // Сравниваем фото (по имени файла или URL)
      let itemImageIdentifier = null;
      // Проверяем, что image_url существует И является строкой
      if (item.image_url && typeof item.image_url === 'string') {
        try {
          const url = new URL(item.image_url);
          itemImageIdentifier = url.pathname.split('/').pop().toLowerCase();
        } catch {
          itemImageIdentifier = item.image_url.split('/').pop().toLowerCase();
        }
      }

      // Если оба пустые - это совпадение
      if (!currentImageIdentifier && !itemImageIdentifier) return true;
      // Если только один пустой - не совпадение
      if (!currentImageIdentifier || !itemImageIdentifier) return false;
      // Сравниваем идентификаторы изображений
      return currentImageIdentifier === itemImageIdentifier;
    });

    if (existingItem) {
      isDuplicate = true;
    }

    // Если не нашли в базе, проверяем дубликаты ВНУТРИ импортируемого файла
    if (!isDuplicate) {
      // Создаём уникальный ключ из всех 4 полей для сравнения
      const duplicateKey = `${name.toLowerCase()}|${descLower}|${normalizedSku}|${currentImageIdentifier || ''}`;

      if (importedDuplicateKeys.has(duplicateKey)) {
        // Нашли дубликат внутри файла - добавляем как дубликат
        // Находим первую запись с таким же ключом
        const firstItem = processed.items.find(item => {
          const itemDesc = (item.description || '').toLowerCase().trim();
          const itemSku = item.sku ? String(item.sku).trim().toLowerCase() : '';
          let itemImageId = null;
          if (item._extractedImage && item._extractedImage.fileName) {
            itemImageId = item._extractedImage.fileName.toLowerCase();
            // Проверяем, что image_url существует И является строкой
          } else if (item.image_url && typeof item.image_url === 'string') {
            try {
              const url = new URL(item.image_url);
              itemImageId = url.pathname.split('/').pop().toLowerCase();
            } catch {
              itemImageId = item.image_url.split('/').pop().toLowerCase();
            }
          }
          const itemKey = `${item.name.toLowerCase()}|${itemDesc}|${itemSku}|${itemImageId || ''}`;
          return itemKey === duplicateKey;
        });

        if (firstItem) {
          processed.duplicates.push({
            row: rowNumber,
            data: normalizedRow,
            existing: firstItem,
            duplicateType: 'file' // Помечаем, что это дубликат внутри файла
          });
          console.log(`Дубликат в файле для "${name}" (строка ${rowNumber})`);
          return;
        }
      }

      // Проверяем конфликт артикулов внутри файла
      // Если артикул уже встречался, проверяем обязательные поля
      if (importedSkus.has(normalizedSku)) {
        // Находим первый товар с таким артикулом
        const firstItemWithSku = processed.items.find(item => {
          const itemSku = item.sku ? String(item.sku).trim().toLowerCase() : '';
          return itemSku === normalizedSku;
        });

        if (firstItemWithSku) {
          // Проверяем совпадают ли все обязательные поля
          const itemName = (firstItemWithSku.name || '').toLowerCase().trim();
          const itemCategory = (firstItemWithSku.category || '').toLowerCase().trim();
          const itemLocation = (firstItemWithSku.location || '').toLowerCase().trim();
          const itemUnit = (firstItemWithSku.unit || '').toLowerCase().trim();

          const nameMatches = itemName === name.toLowerCase();
          const categoryMatches = itemCategory === category.toLowerCase();
          const locationMatches = itemLocation === location.toLowerCase();
          const unitMatches = itemUnit === unit.toLowerCase();

          // Если ВСЕ обязательные поля совпадают → это дубликат
          if (nameMatches && categoryMatches && locationMatches && unitMatches) {
            processed.duplicates.push({
              row: rowNumber,
              data: normalizedRow,
              existing: firstItemWithSku,
              duplicateType: 'file' // Дубликат внутри файла (по обязательным полям)
            });
            console.log(`Дубликат в файле (по артикулу и обязательным полям) для "${name}"`);
            return;
          }
        }

        // Если обязательные поля отличаются → ошибка (конфликт артикулов)
        processed.errors.push({
          row: rowNumber,
          data: normalizedRow,
          message: `Артикул "${sku}" дублируется в файле (первый: "${firstItemWithSku?.name || 'неизвестно'}"). Артикул должен быть уникальным`
        });
        return;
      }

      // Добавляем ключ для отслеживания дубликатов внутри файла
      importedDuplicateKeys.add(duplicateKey);
      // Добавляем артикул для отслеживания конфликтов
      importedSkus.add(normalizedSku);
    }

    // Если это дубликат с существующим в базе товаром
    if (isDuplicate && existingItem) {
      processed.duplicates.push({
        row: rowNumber,
        data: normalizedRow,
        existing: existingItem,
        duplicateType: 'database' // Помечаем, что это дубликат с базой
      });
      console.log(`Дубликат с базой для "${name}":`, existingItem);
      return; // НЕ добавляем дубликат в список для импорта
    }

    // Проверка: артикул совпадает с базой
    // Если все обязательные поля идентичны → дубликат
    // Если обязательные поля отличаются → ошибка (конфликт артикулов)
    if (!isDuplicate) {
      const itemWithSameSku = existingItems.find(item => {
        const itemSku = item.sku ? String(item.sku).trim().toLowerCase() : '';
        return itemSku !== '' && itemSku === normalizedSku;
      });

      if (itemWithSameSku) {
        // Проверяем совпадают ли все обязательные поля
        const itemName = (itemWithSameSku.name || '').toLowerCase().trim();
        const itemCategory = (itemWithSameSku.category || '').toLowerCase().trim();
        const itemLocation = (itemWithSameSku.location || '').toLowerCase().trim();
        const itemUnit = (itemWithSameSku.unit || '').toLowerCase().trim();

        const nameMatches = itemName === name.toLowerCase();
        const categoryMatches = itemCategory === category.toLowerCase();
        const locationMatches = itemLocation === location.toLowerCase();
        const unitMatches = itemUnit === unit.toLowerCase();

        // Логируем сравнение для отладки
        console.log(`🔍 Сравнение с базой для артикула "${sku}":`);
        console.log(`   Название: файл="${name}" vs база="${itemWithSameSku.name}" → ${nameMatches ? '✅' : '❌'}`);
        console.log(`   Категория: файл="${category}" vs база="${itemWithSameSku.category}" → ${categoryMatches ? '✅' : '❌'}`);
        console.log(`   Место: файл="${location}" vs база="${itemWithSameSku.location}" → ${locationMatches ? '✅' : '❌'}`);
        console.log(`   Единица: файл="${unit}" vs база="${itemWithSameSku.unit}" → ${unitMatches ? '✅' : '❌'}`);

        // Если ВСЕ обязательные поля совпадают → это дубликат
        if (nameMatches && categoryMatches && locationMatches && unitMatches) {
          processed.duplicates.push({
            row: rowNumber,
            data: normalizedRow,
            existing: itemWithSameSku,
            duplicateType: 'database' // Дубликат с базой (по обязательным полям)
          });
          console.log(`Дубликат с базой (по артикулу и обязательным полям) для "${name}":`, itemWithSameSku);
          return;
        }

        // Собираем список несовпадающих полей для информативного сообщения
        const mismatches = [];
        if (!nameMatches) mismatches.push(`название: "${name}" ≠ "${itemWithSameSku.name}"`);
        if (!categoryMatches) mismatches.push(`категория: "${category}" ≠ "${itemWithSameSku.category}"`);
        if (!locationMatches) mismatches.push(`место: "${location}" ≠ "${itemWithSameSku.location}"`);
        if (!unitMatches) mismatches.push(`единица: "${unit}" ≠ "${itemWithSameSku.unit}"`);

        // Если обязательные поля отличаются → ошибка (конфликт артикулов)
        processed.errors.push({
          row: rowNumber,
          data: normalizedRow,
          message: `Артикул "${sku}" уже существует в базе. Отличия: ${mismatches.join('; ')}`
        });
        return;
      }
    }

    // Добавляем валидный товар (только если это НЕ дубликат и нет конфликта артикулов)
    // Сохраняем информацию об извлеченном изображении для последующей загрузки
    const itemData = {
      name: name,
      category: category || null,
      unit: unit,
      location: (normalizedRow.location || '').trim() || null,
      // Преобразуем sku в строку или число в зависимости от типа (если это число, сохраняем как число)
      sku: normalizedRow.sku !== null && normalizedRow.sku !== undefined && normalizedRow.sku !== ''
        ? (typeof normalizedRow.sku === 'number' ? normalizedRow.sku : String(normalizedRow.sku).trim())
        : null,
      description: (normalizedRow.description || '').trim() || null,
      image_url: imageUrl, // Сохраняем URL изображения (если есть)
      _extractedImage: normalizedRow._extractedImage // Сохраняем извлеченное изображение для загрузки
    };

    // Удаляем служебные поля перед сохранением (они не должны попасть в базу данных)
    // _excelRowNumber используется только для сопоставления изображений

    processed.items.push(itemData);
  });

  // Загружаем извлеченные изображения в Supabase Storage
  // Это делаем после обработки всех товаров, чтобы не блокировать интерфейс

  // Подсчитываем, сколько товаров имеют изображения для загрузки
  const itemsWithImages = processed.items.filter(item => item._extractedImage && item._extractedImage.blob);
  console.log(`📊 Статистика после обработки:`);
  console.log(`   Всего товаров: ${processed.items.length}`);
  console.log(`   Товаров с изображениями: ${itemsWithImages.length}`);
  console.log(`   Извлечено изображений из Excel: ${extractedImages.size}`);
  console.log(`   Связей в imageRowMap: ${imageRowMap.size}`);

  if (itemsWithImages.length === 0 && extractedImages.size > 0) {
    console.error(`❌ ПРОБЛЕМА: Изображения извлечены (${extractedImages.size}), но ни одно не сопоставлено с товарами!`);
    console.error(`   Возможные причины:`);
    console.error(`   1. imageRowMap не работает или пустой (${imageRowMap.size} связей)`);
    console.error(`   2. Неправильное сопоставление индексов строк`);
    console.error(`   3. Артикулы не извлекаются из строк`);
  }

  if (extractedImages.size > 0 && itemsWithImages.length > 0) {
    console.log(`Начинаем загрузку ${itemsWithImages.length} изображений в Supabase Storage...`);
    await uploadExtractedImages(processed, uploadFileToStorage);
  } else if (extractedImages.size > 0) {
    console.warn(`⚠️ Изображения извлечены, но не будут загружены, так как не сопоставлены с товарами.`);
  }

  return processed;
}

/**
 * Загрузить извлеченные изображения в Supabase Storage
 * 
 * @param {Object} processedData - Обработанные данные с товарами и дубликатами
 * @param {Function} uploadFunction - Функция для загрузки файлов в Storage
 */
async function uploadExtractedImages(processedData, uploadFunction) {
  const bucketName = 'item-images';

  console.log(`Начинаем загрузку изображений в bucket "${bucketName}"...`);

  // Подсчитываем, сколько товаров имеют изображения
  const itemsWithImages = processedData.items.filter(item => item._extractedImage && item._extractedImage.blob);
  console.log(`📊 Товаров с изображениями: ${itemsWithImages.length} из ${processedData.items.length}`);

  if (itemsWithImages.length === 0) {
    console.warn(`⚠️ Нет товаров с изображениями для загрузки!`);
    console.warn(`   Проверьте, что изображения были извлечены из Excel и сопоставлены со строками.`);
    return;
  }

  const uploadPromises = [];
  let uploadCount = 0;
  let bucketErrorShown = false; // Флаг, чтобы показать ошибку bucket только один раз

  // Обрабатываем товары для импорта
  for (const item of processedData.items) {
    if (item._extractedImage && item._extractedImage.blob) {
      uploadCount++;
      const { blob, fileName } = item._extractedImage;
      // ВАЖНО: fileName уже содержит правильное имя image{номер}.png
      // Используем его для загрузки на сервер
      // НЕ используем catch здесь, чтобы Promise.allSettled правильно определил статус
      const uploadPromise = uploadFunction(blob, bucketName, fileName)
        .then(url => {
          item.image_url = url;
          // Логируем каждое успешное изображение для отладки
          console.log(`✅ Изображение загружено (${uploadCount}/${processedData.items.length}): "${fileName}" -> ${item.name}`);
          delete item._extractedImage; // Удаляем временное поле
          return url; // Возвращаем URL для успешного случая
        })
        .catch(error => {
          // Проверяем, связана ли ошибка с bucket
          const isBucketError = error.message && (
            error.message.includes('Bucket') ||
            error.message.includes('bucket') ||
            error.message.includes('не найден')
          );

          // Если это ошибка bucket и мы еще не показывали сообщение, показываем его
          if (isBucketError && !bucketErrorShown) {
            bucketErrorShown = true;
            console.error('');
            console.error('═══════════════════════════════════════');
            console.error('❌ ВАЖНО: Bucket не найден в Supabase!');
            console.error('═══════════════════════════════════════');
            console.error(`Bucket "${bucketName}" не найден в Supabase Storage.`);
            console.error('Для загрузки изображений нужно создать bucket:');
            console.error('');
            console.error('1. Откройте Supabase Dashboard: https://supabase.com/dashboard');
            console.error('2. Выберите ваш проект');
            console.error('3. Перейдите в раздел "Storage" (в левом меню)');
            console.error('4. Нажмите кнопку "New bucket"');
            console.error(`5. Введите название: ${bucketName}`);
            console.error('6. Включите опцию "Public bucket" (важно!)');
            console.error('7. Нажмите "Create bucket"');
            console.error('');
            console.error('После создания bucket попробуйте импортировать файл снова.');
            console.error('═══════════════════════════════════════');
            console.error('');
          }

          // Логируем все ошибки для отладки
          if (!isBucketError) {
            console.error(`❌ Ошибка загрузки изображения "${fileName}" для товара "${item.name}":`, error.message || error);
            console.error(`   Имя файла: ${fileName}`);
            console.error(`   Bucket: ${bucketName}`);
          }

          // Пробрасываем ошибку дальше, чтобы Promise.allSettled правильно определил статус
          throw error;
        });
      uploadPromises.push(uploadPromise);
    }
  }

  // Обрабатываем дубликаты
  for (const duplicate of processedData.duplicates) {
    if (duplicate.data._extractedImage && duplicate.data._extractedImage.blob) {
      uploadCount++;
      const { blob, fileName } = duplicate.data._extractedImage;
      // НЕ используем catch здесь, чтобы Promise.allSettled правильно определил статус
      const uploadPromise = uploadFunction(blob, bucketName, fileName)
        .then(url => {
          duplicate.data.image_url = url;
          // Логируем только каждое 10-е успешное изображение
          if (uploadCount % 10 === 0) {
            console.log(`✅ Загружено ${uploadCount} изображений...`);
          }
          delete duplicate.data._extractedImage; // Удаляем временное поле
          return url; // Возвращаем URL для успешного случая
        })
        .catch(error => {
          // Проверяем, связана ли ошибка с bucket (только реальные ошибки "bucket not found")
          // НЕ считаем ошибкой bucket, если это ошибка дубликата или другая ошибка
          const isBucketError = error.message && (
            error.message.includes('Bucket') && error.message.includes('не найден') ||
            error.message.includes('bucket') && error.message.includes('not found') ||
            error.message.includes('Bucket not found')
          ) && !error.message.includes('already exists') && !error.message.includes('Duplicate');

          // Если это ошибка bucket и мы еще не показывали сообщение, показываем его
          if (isBucketError && !bucketErrorShown) {
            bucketErrorShown = true;
            console.error('');
            console.error('═══════════════════════════════════════');
            console.error('❌ ВАЖНО: Bucket не найден в Supabase!');
            console.error('═══════════════════════════════════════');
            console.error(`Bucket "${bucketName}" не найден в Supabase Storage.`);
            console.error('Для загрузки изображений нужно создать bucket:');
            console.error('');
            console.error('1. Откройте Supabase Dashboard: https://supabase.com/dashboard');
            console.error('2. Выберите ваш проект');
            console.error('3. Перейдите в раздел "Storage" (в левом меню)');
            console.error('4. Нажмите кнопку "New bucket"');
            console.error(`5. Введите название: ${bucketName}`);
            console.error('6. Включите опцию "Public bucket" (важно!)');
            console.error('7. Нажмите "Create bucket"');
            console.error('');
            console.error('После создания bucket попробуйте импортировать файл снова.');
            console.error('═══════════════════════════════════════');
            console.error('');
          }

          // Не логируем каждую ошибку bucket отдельно
          if (!isBucketError) {
            console.error(`❌ Ошибка загрузки изображения для дубликата "${duplicate.data.name}":`, error.message || error);
          }

          // Пробрасываем ошибку дальше, чтобы Promise.allSettled правильно определил статус
          throw error;
        });
      uploadPromises.push(uploadPromise);
    }
  }

  // Ждем завершения всех загрузок
  if (uploadPromises.length > 0) {
    const results = await Promise.allSettled(uploadPromises);

    // Подсчитываем успешные и неудачные загрузки
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`📊 Загрузка изображений завершена:`);
    console.log(`   ✅ Успешно: ${successful}`);
    console.log(`   ❌ Ошибок: ${failed}`);

    if (failed > 0) {
      console.warn(`⚠️ ${failed} изображений не удалось загрузить.`);
      // Проверяем, есть ли другие ошибки (не связанные с bucket, так как мы уже проверили)
      const otherErrors = results.filter(r =>
        r.status === 'rejected' &&
        r.reason &&
        r.reason.message &&
        !r.reason.message.includes('Bucket')
      );

      if (otherErrors.length > 0 && otherErrors.length <= 5) {
        // Показываем первые 5 ошибок, если их немного
        console.error('Примеры ошибок:');
        otherErrors.slice(0, 5).forEach((result, index) => {
          console.error(`${index + 1}. ${result.reason.message || result.reason}`);
        });
      } else if (otherErrors.length > 5) {
        console.error('Слишком много ошибок. Проверьте консоль для деталей.');
      }
    }
  }
}

/**
 * Обновить предпросмотр импорта на странице
 * 
 * @param {Object} data - Обработанные данные
 */
function updateImportPreview(data, fileName) {
  console.log('Данные для импорта:', {
    товаров: data.items.length,
    ошибок: data.errors.length,
    дубликатов: data.duplicates.length
  });

  // Показываем кнопки фильтров
  const filterButtons = document.getElementById('filter-buttons');
  if (filterButtons) {
    filterButtons.classList.remove('hidden');
  }

  // Обновляем счетчики в кнопках фильтров
  updateFilterButtons(data);

  // Отображаем ошибки, дубликаты и валидные товары
  renderImportPreview(data);

  // Обновляем кнопку "Импортировать"
  const importButton = document.getElementById('import-btn');

  if (importButton) {
    const totalItems = data.items.length + data.errors.length + data.duplicates.length;

    // Если есть ошибки или дубликаты, импортировать нельзя (только 0 из totalItems)
    const hasErrors = data.errors.length > 0;
    const hasDuplicates = data.duplicates.length > 0;

    if (hasErrors || hasDuplicates) {
      // Есть проблемы - импорт заблокирован
      importButton.disabled = true;
      importButton.innerHTML = `
        <div class="size-6 rounded-full bg-slate-700 dark:bg-slate-200 flex items-center justify-center">
          <span class="material-symbols-outlined text-[16px]">save</span>
        </div>
        Импортировать (0/${totalItems})
      `;
      console.log('Кнопка отключена - есть ошибки или дубликаты, которые нужно решить');
    } else {
      // Нет ошибок и дубликатов - можно импортировать только валидные товары
      const itemsToProcess = data.items.length;

      if (itemsToProcess > 0) {
        importButton.disabled = false;
        importButton.removeAttribute('disabled');
        importButton.innerHTML = `
          <div class="size-6 rounded-full bg-slate-700 dark:bg-slate-200 flex items-center justify-center">
            <span class="material-symbols-outlined text-[16px]">save</span>
          </div>
          Импортировать (${itemsToProcess}/${totalItems})
        `;
        console.log(`Кнопка активирована. Новых товаров: ${itemsToProcess}`);
      } else {
        importButton.disabled = true;
        importButton.innerHTML = `
          <div class="size-6 rounded-full bg-slate-700 dark:bg-slate-200 flex items-center justify-center">
            <span class="material-symbols-outlined text-[16px]">save</span>
          </div>
          Импортировать (0/${totalItems})
        `;
        console.log('Кнопка отключена - нет товаров для импорта');
      }
    }
  }

  // Обновляем сообщение об ошибках и дубликатах
  const errorMessage = document.getElementById('error-message');
  const errorMessageText = document.getElementById('error-message-text');

  if (errorMessage) {
    const hasErrors = data.errors.length > 0;
    const hasDuplicates = data.duplicates.length > 0;

    if (hasErrors || hasDuplicates) {
      let messageParts = [];

      if (hasErrors) {
        const errorText = data.errors.length === 1
          ? '1 ошибку'
          : `${data.errors.length} ${data.errors.length < 5 ? 'ошибки' : 'ошибок'}`;
        messageParts.push(`Исправьте ${errorText}`);
      }

      if (hasDuplicates) {
        const duplicateText = data.duplicates.length === 1
          ? '1 дубликат'
          : `${data.duplicates.length} ${data.duplicates.length < 5 ? 'дубликата' : 'дубликатов'}`;
        messageParts.push(`решите ${duplicateText}`);
      }

      const message = messageParts.join(' и ') + ' перед сохранением';

      if (errorMessageText) {
        errorMessageText.textContent = message;
      }
      errorMessage.classList.remove('hidden');
      errorMessage.classList.add('flex');
    } else {
      errorMessage.classList.add('hidden');
      errorMessage.classList.remove('flex');
    }
  }
}

/**
 * Создать сворачиваемую секцию
 */
function createCollapsibleSection(id, title, count, type, duplicates = null) {
  const section = document.createElement('div');
  section.className = 'collapsible-section';
  section.setAttribute('data-section-id', id);

  // Определяем, свернута ли секция по умолчанию (для длинных списков)
  const isCollapsed = count > 5;

  // Иконка для типа секции
  let icon = 'expand_more';
  let iconColor = 'text-slate-500';
  if (type === 'error') {
    icon = 'error';
    iconColor = 'text-red-500';
  } else if (type === 'duplicate') {
    icon = 'content_copy';
    iconColor = 'text-amber-500';
  } else if (type === 'item') {
    icon = 'check_circle';
    iconColor = 'text-green-500';
  }

  // Кнопки массовых действий для дубликатов
  let bulkActions = '';
  if (type === 'duplicate' && duplicates && duplicates.length > 0) {
    bulkActions = `
      <div class="flex gap-2 mt-2">
        <button class="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 active:scale-95 transition-all bulk-keep-old-btn" data-section="${id}">
          Оставить старое для всех
        </button>
        <button class="flex-1 py-2 px-3 rounded-xl bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-500/20 hover:bg-amber-600 active:scale-95 transition-all bulk-update-btn" data-section="${id}">
          Обновить все
        </button>
      </div>
    `;
  }

  // Кнопка массового удаления для ошибок
  if (type === 'error' && count > 0) {
    bulkActions = `
      <div class="flex gap-2 mt-2">
        <button class="w-full py-2 px-3 rounded-xl bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95 transition-all bulk-remove-errors-btn" data-section="${id}">
          Удалить все ошибки
        </button>
      </div>
    `;
  }

  // Если секция должна быть свернута по умолчанию, не добавляем класс expanded
  if (!isCollapsed) {
    section.classList.add('expanded');
  }

  section.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <button class="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors section-toggle-btn" data-section="${id}">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined ${iconColor} text-xl">${icon}</span>
          <div class="text-left">
            <h3 class="font-bold text-base text-slate-900 dark:text-white">${title}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">${count} ${count === 1 ? 'элемент' : count < 5 ? 'элемента' : 'элементов'}</p>
          </div>
        </div>
        <span class="material-symbols-outlined text-slate-400 chevron-icon transition-transform">expand_more</span>
      </button>
      <div class="section-content px-4 pb-4 space-y-4">
        ${bulkActions}
        <div class="section-items space-y-4"></div>
      </div>
    </div>
  `;

  // Обработчик сворачивания/разворачивания
  const toggleBtn = section.querySelector('.section-toggle-btn');
  const content = section.querySelector('.section-content');
  const arrow = section.querySelector('.chevron-icon');
  const itemsContainer = section.querySelector('.section-items');

  toggleBtn.addEventListener('click', () => {
    // Переключаем класс expanded на самой секции
    section.classList.toggle('expanded');
  });

  // Перемещаем элементы в контейнер items
  // Это будет сделано позже, когда элементы будут добавлены

  return section;
}

/**
 * Обновить счетчики в кнопках фильтров
 */
function updateFilterButtons(data) {
  const totalCount = data.items.length + data.errors.length + data.duplicates.length;

  // Обновляем счетчики по ID
  const countAll = document.getElementById('count-all');
  const countErrors = document.getElementById('count-errors');
  const countDuplicates = document.getElementById('count-duplicates');

  if (countAll) countAll.textContent = totalCount;
  if (countErrors) countErrors.textContent = data.errors.length;
  if (countDuplicates) countDuplicates.textContent = data.duplicates.length;

  // Добавляем обработчики кликов на кнопки фильтров
  setupFilterButtons();
}

/**
 * Настроить обработчики кликов на кнопки фильтров
 */
function setupFilterButtons() {
  // Проверяем, не были ли обработчики уже добавлены
  if (window.filterButtonsSetup) {
    return;
  }

  // Находим кнопки фильтров
  const allButtons = Array.from(document.querySelectorAll('button'));

  const allButton = allButtons.find(btn => {
    const text = btn.textContent.trim().toLowerCase();
    return text.startsWith('все') && !btn.hasAttribute('data-filter-handler');
  });

  const errorsButton = allButtons.find(btn => {
    const text = btn.textContent.trim().toLowerCase();
    return text.startsWith('ошибки') && !btn.hasAttribute('data-filter-handler');
  });

  const duplicatesButton = allButtons.find(btn => {
    const text = btn.textContent.trim().toLowerCase();
    return text.startsWith('дубликаты') && !btn.hasAttribute('data-filter-handler');
  });

  // Добавляем обработчики
  if (allButton) {
    allButton.setAttribute('data-filter-handler', 'true');
    allButton.addEventListener('click', () => {
      window.currentImportFilter = 'all';
      if (importedData) {
        renderImportPreview(importedData);
      }
      // Обновляем активное состояние кнопок
      updateActiveFilterButton('all', allButton, errorsButton, duplicatesButton);
    });
  }

  if (errorsButton) {
    errorsButton.setAttribute('data-filter-handler', 'true');
    errorsButton.addEventListener('click', () => {
      window.currentImportFilter = 'errors';
      if (importedData) {
        renderImportPreview(importedData);
      }
      // Обновляем активное состояние кнопок
      updateActiveFilterButton('errors', allButton, errorsButton, duplicatesButton);
    });
  }

  if (duplicatesButton) {
    duplicatesButton.setAttribute('data-filter-handler', 'true');
    duplicatesButton.addEventListener('click', () => {
      window.currentImportFilter = 'duplicates';
      if (importedData) {
        renderImportPreview(importedData);
      }
      // Обновляем активное состояние кнопок
      updateActiveFilterButton('duplicates', allButton, errorsButton, duplicatesButton);
    });
  }

  window.filterButtonsSetup = true;
}

/**
 * Обновить активное состояние кнопок фильтров
 */
function updateActiveFilterButton(activeFilter, allBtn, errorsBtn, duplicatesBtn) {
  // Сбрасываем все кнопки к неактивному состоянию
  if (allBtn) {
    // Кнопка "Все" - активное состояние
    if (activeFilter === 'all') {
      allBtn.className = 'shrink-0 h-9 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full text-xs font-bold shadow-md active:scale-95 transition-all flex items-center gap-2';
    } else {
      allBtn.className = 'shrink-0 h-9 px-4 bg-white dark:bg-surface-dark text-slate-600 dark:text-slate-300 rounded-full text-xs font-bold shadow-sm border border-slate-200 dark:border-slate-700 active:scale-95 transition-all flex items-center gap-2';
    }
  }

  if (errorsBtn) {
    // Кнопка "Ошибки" - активное состояние
    if (activeFilter === 'errors') {
      errorsBtn.className = 'shrink-0 h-9 px-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full text-xs font-bold shadow-md border-2 border-red-300 dark:border-red-700 active:scale-95 transition-all flex items-center gap-2';
    } else {
      errorsBtn.className = 'shrink-0 h-9 px-4 bg-white dark:bg-surface-dark text-red-600 dark:text-red-400 rounded-full text-xs font-bold shadow-sm border border-red-100 dark:border-red-900/30 active:bg-red-50 dark:active:bg-red-900/20 transition-colors flex items-center gap-2';
    }
  }

  if (duplicatesBtn) {
    // Кнопка "Дубликаты" - активное состояние
    if (activeFilter === 'duplicates') {
      duplicatesBtn.className = 'shrink-0 h-9 px-4 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full text-xs font-bold shadow-md border-2 border-amber-300 dark:border-amber-700 active:scale-95 transition-all flex items-center gap-2';
    } else {
      duplicatesBtn.className = 'shrink-0 h-9 px-4 bg-white dark:bg-surface-dark text-amber-600 dark:text-amber-400 rounded-full text-xs font-bold shadow-sm border border-amber-100 dark:border-amber-900/30 active:bg-amber-50 dark:active:bg-amber-900/20 transition-colors flex items-center gap-2';
    }
  }
}

/**
 * Массовое действие: удалить все ошибки
 */
async function handleBulkRemoveErrors(errors) {
  if (!errors || errors.length === 0) {
    return;
  }

  const confirmed = await showDangerConfirm(
    `Вы уверены, что хотите удалить все ${errors.length} ошибок?`
  );

  if (!confirmed) {
    return;
  }

  try {
    // Удаляем все ошибки из данных
    importedData.errors = [];

    // Обновляем предпросмотр
    updateImportPreview(importedData);
    renderImportPreview(importedData);

    showSuccess(`Удалено ${errors.length} ошибок`);
  } catch (error) {
    console.error('Ошибка при массовом удалении:', error);
    showError('Не удалось удалить ошибки: ' + error.message);
  }
}

/**
 * Массовое действие: оставить старое для всех дубликатов
 */
async function handleBulkKeepOld(duplicates) {
  if (!duplicates || duplicates.length === 0) {
    return;
  }

  const confirmed = await showConfirm(
    `Вы уверены, что хотите оставить старое для всех ${duplicates.length} дубликатов?`
  );

  if (!confirmed) {
    return;
  }

  try {
    // Заменяем каждый блок дубликата на блок с пометкой "Пропущен"
    duplicates.forEach(duplicate => {
      const duplicateElement = document.querySelector(`[data-duplicate-row="${duplicate.row}"]`);
      if (duplicateElement) {
        const processedElement = createProcessedDuplicateElement(duplicate, 'skipped');
        let parentContainer = duplicateElement.parentElement;
        // Если родитель - это .section-items, используем его
        if (parentContainer && parentContainer.classList.contains('section-items')) {
          parentContainer.replaceChild(processedElement, duplicateElement);
        } else if (parentContainer) {
          parentContainer.replaceChild(processedElement, duplicateElement);
        }
      }
    });

    // Удаляем все дубликаты из списка (оставляем старое)
    importedData.duplicates = importedData.duplicates.filter(d =>
      !duplicates.some(dup => dup.row === d.row)
    );

    // Обновляем счетчики
    updateFilterButtons(importedData);

    // Обновляем кнопку импорта и предпросмотр
    updateImportPreview(importedData);

    showSuccess(`Оставлено старое для ${duplicates.length} дубликатов`);
  } catch (error) {
    console.error('Ошибка при массовом действии "оставить старое":', error);
    showError('Не удалось выполнить действие: ' + error.message);
  }
}

/**
 * Массовое действие: обновить все дубликаты
 */
async function handleBulkUpdate(duplicates) {
  if (!duplicates || duplicates.length === 0) {
    return;
  }

  const confirmed = await showConfirm(
    `Вы уверены, что хотите обновить все ${duplicates.length} дубликатов данными из файла?`
  );

  if (!confirmed) {
    return;
  }

  try {
    showSuccess('Обновление начато...');

    let updated = 0;
    let updatedLocal = 0;
    let failed = 0;

    // Обновляем каждый дубликат
    for (const duplicate of duplicates) {
      try {
        // Подготавливаем данные для обновления
        let imageUrl = duplicate.data.image_url || null;

        // Если image_url не найден, проверяем photo (на случай старого формата данных)
        if (!imageUrl && duplicate.data.photo) {
          const photoValue = String(duplicate.data.photo).trim();
          if (photoValue && photoValue !== 'null' && photoValue !== 'undefined' && photoValue !== '') {
            imageUrl = photoValue;
          }
        }

        const updateData = {
          name: duplicate.data.name,
          category: duplicate.data.category || null,
          unit: duplicate.data.unit,
          location: duplicate.data.location || null,
          sku: duplicate.data.sku || null,
          description: duplicate.data.description || null,
          image_url: imageUrl
        };

        const result = await items.updateItem(duplicate.existing.id, updateData);

        // Проверяем, синхронизирован ли товар с сервером
        const isSynced = result && result.synced === true;
        const status = isSynced ? 'updated' : 'updated-local';

        if (isSynced) {
          updated++;
        } else {
          updatedLocal++;
        }

        // Заменяем блок дубликата на блок с пометкой
        const duplicateElement = document.querySelector(`[data-duplicate-row="${duplicate.row}"]`);
        if (duplicateElement) {
          const processedElement = createProcessedDuplicateElement(duplicate, status);
          let parentContainer = duplicateElement.parentElement;
          // Если родитель - это .section-items, используем его
          if (parentContainer && parentContainer.classList.contains('section-items')) {
            parentContainer.replaceChild(processedElement, duplicateElement);
          } else if (parentContainer) {
            parentContainer.replaceChild(processedElement, duplicateElement);
          }
        }

        // Удаляем дубликат из списка
        importedData.duplicates = importedData.duplicates.filter(d => d.row !== duplicate.row);

        if ((updated + updatedLocal) % 10 === 0) {
          console.log(`Обработано ${updated + updatedLocal} из ${duplicates.length} дубликатов...`);
        }
      } catch (error) {
        console.error(`Ошибка обновления дубликата "${duplicate.data.name}":`, error);
        failed++;
      }
    }

    // Обновляем счетчики
    updateFilterButtons(importedData);

    // Обновляем кнопку импорта и предпросмотр
    updateImportPreview(importedData);

    // Формируем итоговое сообщение
    let message = `Обновление завершено! `;
    if (updated > 0) {
      message += `Обновлено с синхронизацией: ${updated}. `;
    }
    if (updatedLocal > 0) {
      message += `Обновлено локально (без синхронизации): ${updatedLocal}. `;
    }
    if (failed > 0) {
      message += `Ошибок: ${failed}.`;
    }

    if (updatedLocal > 0) {
      showSuccess(message);
      console.warn(`⚠️ ${updatedLocal} товаров обновлены локально, но не синхронизированы с сервером. Они будут синхронизированы позже автоматически.`);
    } else {
      showSuccess(message);
    }
  } catch (error) {
    console.error('Ошибка при массовом обновлении:', error);
    showError('Не удалось выполнить массовое обновление: ' + error.message);
  }
}

/**
 * Отобразить предпросмотр импорта (ошибки, дубликаты, валидные товары)
 */
function renderImportPreview(data) {
  const container = document.getElementById('import-preview') || document.querySelector('.px-4.space-y-4.mt-2');
  if (!container) {
    console.error('Контейнер для предпросмотра не найден');
    return;
  }

  // Очищаем контейнер (кроме фильтров)
  container.innerHTML = '';

  // Получаем текущий активный фильтр
  const activeFilter = window.currentImportFilter || 'all';

  // Отображаем ошибки (если активен фильтр "all" или "errors")
  if (data.errors.length > 0 && (activeFilter === 'all' || activeFilter === 'errors')) {
    const errorsSection = createCollapsibleSection('errors', 'Ошибки', data.errors.length, 'error');
    const errorsItemsContainer = errorsSection.querySelector('.section-items');

    data.errors.forEach(error => {
      errorsItemsContainer.appendChild(createErrorElement(error));
    });

    // Добавляем обработчик для массового удаления ошибок
    const bulkRemoveBtn = errorsSection.querySelector('.bulk-remove-errors-btn');
    if (bulkRemoveBtn) {
      bulkRemoveBtn.addEventListener('click', () => {
        handleBulkRemoveErrors(data.errors);
      });
    }

    container.appendChild(errorsSection);
  }

  // Отображаем дубликаты (если активен фильтр "all" или "duplicates")
  if (data.duplicates.length > 0 && (activeFilter === 'all' || activeFilter === 'duplicates')) {
    const duplicatesSection = createCollapsibleSection('duplicates', 'Дубликаты', data.duplicates.length, 'duplicate', data.duplicates);
    const duplicatesItemsContainer = duplicatesSection.querySelector('.section-items');

    data.duplicates.forEach(duplicate => {
      duplicatesItemsContainer.appendChild(createDuplicateElement(duplicate));
    });

    // Добавляем обработчики для массовых действий
    const bulkKeepOldBtn = duplicatesSection.querySelector('.bulk-keep-old-btn');
    const bulkUpdateBtn = duplicatesSection.querySelector('.bulk-update-btn');

    if (bulkKeepOldBtn) {
      bulkKeepOldBtn.addEventListener('click', async () => {
        await handleBulkKeepOld(data.duplicates);
      });
    }

    if (bulkUpdateBtn) {
      bulkUpdateBtn.addEventListener('click', async () => {
        await handleBulkUpdate(data.duplicates);
      });
    }

    container.appendChild(duplicatesSection);
  }

  // Отображаем валидные товары (если активен фильтр "all" или "items")
  if (data.items.length > 0 && (activeFilter === 'all' || activeFilter === 'items')) {
    const itemsSection = createCollapsibleSection('items', 'Валидные товары', data.items.length, 'item');
    const itemsItemsContainer = itemsSection.querySelector('.section-items');

    data.items.forEach((item, index) => {
      itemsItemsContainer.appendChild(createValidItemElement(item));
    });

    container.appendChild(itemsSection);
  }
}

/**
 * Обновить валидность поля
 */
function updateFieldValidation(container, fieldName) {
  const VALID_CATEGORIES = ['Посуда', 'Бокалы', 'Приборы', 'Инвентарь', 'Расходники', 'Прочее'];
  const VALID_LOCATIONS = ['Бар', 'Кухня', 'Склад'];
  const VALID_UNITS = ['шт.', 'комп.', 'упак.'];

  const field = container.querySelector(`[data-field="${fieldName}"]`);
  if (!field) return;

  let isValid = false;
  let icon = field.parentElement.querySelector('.material-symbols-outlined');

  if (fieldName === 'name') {
    isValid = field.value.trim() !== '';
  } else if (fieldName === 'sku') {
    isValid = field.value.trim() !== '';
  } else if (fieldName === 'category') {
    isValid = VALID_CATEGORIES.some(category => category.toLowerCase() === field.value.toLowerCase());
  } else if (fieldName === 'location') {
    const locationValue = field.value;
    if (locationValue.toLowerCase() === 'другое') {
      const customInput = container.querySelector('input[data-field="location-custom"]');
      isValid = customInput && customInput.value.trim() !== '';
    } else {
      isValid = VALID_LOCATIONS.some(location => location.toLowerCase() === locationValue.toLowerCase());
    }
  } else if (fieldName === 'location-custom') {
    isValid = field.value.trim() !== '';
    // Обновляем также родительский select
    const locationSelect = container.querySelector('select[data-field="location"]');
    if (locationSelect && locationSelect.value.toLowerCase() === 'другое') {
      updateFieldValidation(container, 'location');
    }
  } else if (fieldName === 'unit') {
    isValid = VALID_UNITS.includes(field.value);
  }

  // Обновляем классы поля
  field.classList.remove('border-red-300', 'border-red-700', 'border-green-500', 'border-green-600', 'dark:border-red-700', 'dark:border-green-600');
  if (isValid) {
    field.classList.add('border-green-500', 'dark:border-green-600');
  } else {
    field.classList.add('border-red-300', 'dark:border-red-700');
  }

  // Обновляем иконку
  if (icon && (fieldName === 'sku' || fieldName === 'unit')) {
    icon.textContent = isValid ? 'check_circle' : 'warning';
    icon.classList.remove('text-red-500', 'text-green-500');
    icon.classList.add(isValid ? 'text-green-500' : 'text-red-500');
  }
}

/**
 * Создать элемент ошибки
 */
function createErrorElement(error) {
  const div = document.createElement('div');
  div.className = 'bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-red-200 dark:border-red-800/50 relative';
  div.setAttribute('data-error-row', error.row);

  const errorType = error.message || 'Нет данных';

  // Константы для выпадающих списков
  const VALID_CATEGORIES = ['Посуда', 'Бокалы', 'Приборы', 'Инвентарь', 'Расходники', 'Прочее'];
  const VALID_LOCATIONS = ['Бар', 'Кухня', 'Склад'];
  const VALID_UNITS = ['шт.', 'комп.', 'упак.'];

  // Проверяем, выбрано ли "другое" для места хранения
  const isCustomLocation = error.data.location
    && !VALID_LOCATIONS.some(location => location.toLowerCase() === error.data.location.toLowerCase());
  const customLocationValue = isCustomLocation ? error.data.location : '';

  // Формируем опции для категорий
  const categoryOptions = VALID_CATEGORIES.map(cat => {
    const selected = error.data.category && error.data.category.toLowerCase() === cat.toLowerCase() ? 'selected' : '';
    return `<option value="${cat}" ${selected}>${cat}</option>`;
  }).join('');

  // Формируем опции для мест хранения
  const locationOptions = VALID_LOCATIONS.map(loc => {
    const selected = error.data.location && error.data.location.toLowerCase() === loc.toLowerCase() ? 'selected' : '';
    return `<option value="${loc}" ${selected}>${loc}</option>`;
  }).join('');

  // Формируем опции для единиц измерения
  const unitOptions = VALID_UNITS.map(unit => {
    const selected = error.data.unit === unit ? 'selected' : '';
    return `<option value="${unit}" ${selected}>${unit}</option>`;
  }).join('');

  // Определяем валидность полей
  const nameValid = error.data.name && error.data.name.trim() !== '';
  const skuValid = error.data.sku && error.data.sku.trim() !== '';
  const categoryValid = error.data.category
    && VALID_CATEGORIES.some(category => category.toLowerCase() === error.data.category.toLowerCase());
  const locationValid = error.data.location
    && (VALID_LOCATIONS.some(location => location.toLowerCase() === error.data.location.toLowerCase()) || isCustomLocation);
  const unitValid = error.data.unit && VALID_UNITS.includes(error.data.unit);

  div.innerHTML = `
    <div class="mb-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="material-symbols-outlined text-red-500 text-xl">error</span>
        <div>
          <h4 class="text-sm font-bold text-slate-900 dark:text-white">Строка ${error.row}</h4>
          <p class="text-xs text-red-600 dark:text-red-400">${errorType.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        </div>
      </div>
    </div>
    
    <!-- Название -->
    <div class="mb-3">
      <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-2">
        Название товара *
        <button class="hint-toggle-btn text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" data-field="name" type="button">
          <span class="material-symbols-outlined text-sm">info</span>
        </button>
      </label>
      <input class="error-field w-full bg-white dark:bg-slate-800 border-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${nameValid ? 'border-green-500 dark:border-green-600 focus:ring-green-500 focus:border-green-500' : 'border-red-300 dark:border-red-700 focus:ring-red-500 focus:border-red-500'} focus:ring-2 outline-none" placeholder="Название товара" type="text" value="${(error.data.name || '').replace(/"/g, '&quot;')}" data-field="name"/>
      <div class="hint-content hidden mt-1.5 p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-400" data-field="name">
        Обязательное поле. Название товара должно быть заполнено.
      </div>
    </div>
    
    <!-- Артикул -->
    <div class="mb-3">
      <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-2">
        Артикул (SKU) *
        <button class="hint-toggle-btn text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" data-field="sku" type="button">
          <span class="material-symbols-outlined text-sm">info</span>
        </button>
      </label>
      <div class="relative">
        <input class="error-field w-full bg-white dark:bg-slate-800 border-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${skuValid ? 'border-green-500 dark:border-green-600 focus:ring-green-500 focus:border-green-500' : 'border-red-300 dark:border-red-700 focus:ring-red-500 focus:border-red-500'} focus:ring-2 outline-none" placeholder="Артикул" type="text" value="${(error.data.sku || '').replace(/"/g, '&quot;')}" data-field="sku"/>
        <span class="absolute right-3 top-1/2 -translate-y-1/2 ${skuValid ? 'text-green-500' : 'text-red-500'} material-symbols-outlined text-lg">${skuValid ? 'check_circle' : 'warning'}</span>
      </div>
      <div class="hint-content hidden mt-1.5 p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-400" data-field="sku">
        Обязательное поле. Артикул должен быть уникальным и не повторяться в базе данных или в импортируемом файле.
      </div>
    </div>
    
    <!-- Категория и Место хранения -->
    <div class="grid grid-cols-2 gap-3 mb-3">
      <div>
        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-2">
          Категория *
          <button class="hint-toggle-btn text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" data-field="category" type="button">
            <span class="material-symbols-outlined text-sm">info</span>
          </button>
        </label>
        <select class="error-field w-full bg-white dark:bg-slate-800 border-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${categoryValid ? 'border-green-500 dark:border-green-600 focus:ring-green-500 focus:border-green-500' : 'border-red-300 dark:border-red-700 focus:ring-red-500 focus:border-red-500'} focus:ring-2 outline-none" data-field="category">
          <option value="">Выберите категорию</option>
          ${categoryOptions}
        </select>
        <div class="hint-content hidden mt-1.5 p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-400" data-field="category">
          Обязательное поле. Выберите одну из категорий: Посуда, Бокалы, Приборы, Инвентарь, Расходники, Прочее.
        </div>
      </div>
      <div>
        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-2">
          Место хранения *
          <button class="hint-toggle-btn text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" data-field="location" type="button">
            <span class="material-symbols-outlined text-sm">info</span>
          </button>
        </label>
        <select class="error-field w-full bg-white dark:bg-slate-800 border-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${locationValid ? 'border-green-500 dark:border-green-600 focus:ring-green-500 focus:border-green-500' : 'border-red-300 dark:border-red-700 focus:ring-red-500 focus:border-red-500'} focus:ring-2 outline-none" data-field="location">
          <option value="">Выберите место</option>
          ${locationOptions}
          <option value="Другое" ${isCustomLocation ? 'selected' : ''}>Другое</option>
        </select>
        ${isCustomLocation ? `<input class="error-field mt-2 w-full bg-white dark:bg-slate-800 border-2 border-green-500 dark:border-green-600 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" placeholder="Введите свой вариант" type="text" value="${customLocationValue.replace(/"/g, '&quot;')}" data-field="location-custom"/>` : ''}
        <div class="hint-content hidden mt-1.5 p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-400" data-field="location">
          Обязательное поле. Выберите место хранения: Бар, Кухня, Склад, или выберите "Другое" и введите свой вариант.
        </div>
      </div>
    </div>
    
    <!-- Единица измерения -->
    <div class="mb-3">
      <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-2">
        Единица измерения *
        <button class="hint-toggle-btn text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" data-field="unit" type="button">
          <span class="material-symbols-outlined text-sm">info</span>
        </button>
      </label>
      <div class="relative">
        <select class="error-field w-full bg-white dark:bg-slate-800 border-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${unitValid ? 'border-green-500 dark:border-green-600 focus:ring-green-500 focus:border-green-500' : 'border-red-300 dark:border-red-700 focus:ring-red-500 focus:border-red-500'} focus:ring-2 outline-none" data-field="unit">
          <option value="">Выберите единицу</option>
          ${unitOptions}
        </select>
        <span class="absolute right-3 top-1/2 -translate-y-1/2 ${unitValid ? 'text-green-500' : 'text-red-500'} material-symbols-outlined text-lg pointer-events-none">${unitValid ? 'check_circle' : 'warning'}</span>
      </div>
      <div class="hint-content hidden mt-1.5 p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-400" data-field="unit">
        Обязательное поле. Выберите единицу измерения: шт., комп., упак.
      </div>
    </div>
    
    <!-- Описание -->
    <div class="mb-4">
      <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-2">
        Описание
        <button class="hint-toggle-btn text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" data-field="description" type="button">
          <span class="material-symbols-outlined text-sm">info</span>
        </button>
      </label>
      <input class="error-field w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-primary outline-none" placeholder="Описание (необязательно)" type="text" value="${(error.data.description || '').replace(/"/g, '&quot;')}" data-field="description"/>
      <div class="hint-content hidden mt-1.5 p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-400" data-field="description">
        Необязательное поле. Если указано, описание должно быть уникальным.
      </div>
    </div>
    
    <!-- Загрузка фото -->
    <div class="mb-4">
      <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-2">
        Фото товара
        <button class="hint-toggle-btn text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" data-field="image" type="button">
          <span class="material-symbols-outlined text-sm">info</span>
        </button>
      </label>
      <div class="relative">
        <input class="error-image-input hidden" type="file" accept="image/*" data-field="image" data-row="${error.row}"/>
        <div class="error-image-preview hidden mb-2" data-row="${error.row}">
          <img class="error-image-preview-img w-full h-48 object-cover rounded-xl border border-slate-200 dark:border-slate-700" src="" alt="Превью" data-row="${error.row}"/>
          <button class="error-image-remove-btn mt-2 text-xs font-bold text-red-600 hover:text-red-800" data-row="${error.row}">Удалить фото</button>
        </div>
        ${error.data.image_url || error.data._extractedImage ? `
          <div class="mb-2">
            <img class="w-full h-48 object-cover rounded-xl border border-slate-200 dark:border-slate-700" src="${error.data.image_url || error.data._extractedImage}" alt="Текущее фото"/>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Текущее фото из файла</p>
          </div>
        ` : ''}
        <button class="error-image-btn w-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl px-3 py-4 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-2" type="button" data-row="${error.row}">
          <span class="material-symbols-outlined">image</span>
          <span>Выбрать фото</span>
        </button>
      </div>
      <div class="hint-content hidden mt-1.5 p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-400" data-field="image">
        Необязательное поле. Вы можете загрузить фото товара. Поддерживаются форматы: JPG, PNG, GIF.
      </div>
    </div>
    
    <!-- Кнопки действий -->
    <div class="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
      <button class="text-xs font-bold text-red-600 hover:text-red-800 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors remove-error-btn" data-row="${error.row}">Удалить</button>
      <button class="text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors fix-error-btn" data-row="${error.row}">Исправить</button>
    </div>
  `;

  // Обработчики для разворачивания подсказок
  const hintToggles = div.querySelectorAll('.hint-toggle-btn');
  hintToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const field = toggle.getAttribute('data-field');
      const hintContent = div.querySelector(`.hint-content[data-field="${field}"]`);
      if (hintContent) {
        hintContent.classList.toggle('hidden');
      }
    });
  });

  // Обработчики для изменения цвета полей при валидности
  const errorFields = div.querySelectorAll('.error-field');
  errorFields.forEach(field => {
    const fieldName = field.getAttribute('data-field');

    // Для select и input
    field.addEventListener('change', () => updateFieldValidation(div, fieldName));
    field.addEventListener('input', () => updateFieldValidation(div, fieldName));

    // Для места хранения - обработка выбора "другое"
    if (fieldName === 'location') {
      field.addEventListener('change', () => {
        const locationSelect = field;
        const locationValue = locationSelect.value;
        const locationContainer = locationSelect.closest('div');
        let customInput = locationContainer.querySelector('input[data-field="location-custom"]');

        if (locationValue.toLowerCase() === 'другое') {
          if (!customInput) {
            customInput = document.createElement('input');
            customInput.className = 'error-field mt-2 w-full bg-white dark:bg-slate-800 border-2 border-green-500 dark:border-green-600 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none';
            customInput.placeholder = 'Введите свой вариант';
            customInput.type = 'text';
            customInput.setAttribute('data-field', 'location-custom');
            locationContainer.appendChild(customInput);

            customInput.addEventListener('input', () => updateFieldValidation(div, 'location'));
          }
          customInput.style.display = 'block';
        } else {
          if (customInput) {
            customInput.style.display = 'none';
            customInput.value = '';
          }
        }
        updateFieldValidation(div, 'location');
      });
    }
  });

  // Обработчик кнопки удаления
  const removeBtn = div.querySelector('.remove-error-btn');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      // Удаляем ошибку из данных
      importedData.errors = importedData.errors.filter(e => e.row !== error.row);
      // Обновляем предпросмотр
      updateImportPreview(importedData);
      renderImportPreview(importedData);
    });
  }

  // Обработчики для загрузки фото
  const imageBtn = div.querySelector(`.error-image-btn[data-row="${error.row}"]`);
  const imageInput = div.querySelector(`.error-image-input[data-row="${error.row}"]`);
  const imagePreview = div.querySelector(`.error-image-preview[data-row="${error.row}"]`);
  const imagePreviewImg = div.querySelector(`.error-image-preview-img[data-row="${error.row}"]`);
  const imageRemoveBtn = div.querySelector(`.error-image-remove-btn[data-row="${error.row}"]`);

  if (imageBtn && imageInput) {
    imageBtn.addEventListener('click', () => {
      imageInput.click();
    });
  }

  if (imageInput) {
    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (imagePreviewImg) {
            imagePreviewImg.src = event.target.result;
          }
          if (imagePreview) {
            imagePreview.classList.remove('hidden');
          }
          if (imageBtn) {
            imageBtn.classList.add('hidden');
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (imageRemoveBtn) {
    imageRemoveBtn.addEventListener('click', () => {
      if (imageInput) imageInput.value = '';
      if (imagePreview) imagePreview.classList.add('hidden');
      if (imageBtn) imageBtn.classList.remove('hidden');
      if (imagePreviewImg) imagePreviewImg.src = '';
    });
  }

  // Обработчик кнопки исправления
  const fixBtn = div.querySelector('.fix-error-btn');
  if (fixBtn) {
    fixBtn.addEventListener('click', async () => {
      // Получаем значения из полей
      const nameInput = div.querySelector('input[placeholder="Название товара"]');
      const skuInput = div.querySelector('input[placeholder="Артикул"]');
      const selects = div.querySelectorAll('select');
      const categorySelect = selects[0]; // Первый select - категория
      const locationSelect = selects[1]; // Второй select - место хранения
      const unitSelect = selects[2]; // Третий select - единица измерения
      const descriptionInput = div.querySelector('input[placeholder*="Описание"]');
      const locationCustomInput = div.querySelector('input[data-field="location-custom"]');
      const errorImageInput = div.querySelector(`.error-image-input[data-row="${error.row}"]`);

      const name = (nameInput?.value || '').trim();
      const sku = (skuInput?.value || '').trim();
      const category = categorySelect?.value || '';
      let location = locationSelect?.value || '';
      // Если выбрано "другое", берем значение из поля ввода
      if (location.toLowerCase() === 'другое' && locationCustomInput) {
        location = (locationCustomInput.value || '').trim();
      }
      const unit = unitSelect?.value || '';
      const description = (descriptionInput?.value || '').trim();

      // Проверяем валидность
      if (!name) {
        showError('Введите название товара');
        nameInput?.focus();
        return;
      }

      if (!sku) {
        showError('Введите артикул. Артикул обязателен и должен быть уникальным');
        skuInput?.focus();
        return;
      }

      // Проверка обязательных полей
      if (!category) {
        showError('Выберите категорию');
        categorySelect?.focus();
        return;
      }

      if (!location) {
        showError('Выберите место хранения или введите свой вариант');
        locationSelect?.focus();
        return;
      }

      if (!unit) {
        showError('Выберите единицу измерения');
        unitSelect?.focus();
        return;
      }

      // Проверяем артикул на совпадение с базой
      const existingItems = await items.getAllItems();
      const skuLower = sku.toLowerCase().trim();

      // Ищем товар с таким же артикулом в базе
      const itemWithSameSku = existingItems.find(item => {
        const itemSku = item.sku ? item.sku.toString().toLowerCase().trim() : '';
        return itemSku !== '' && itemSku === skuLower;
      });

      if (itemWithSameSku) {
        // Проверяем совпадают ли все обязательные поля
        const itemName = (itemWithSameSku.name || '').toLowerCase().trim();
        const itemCategory = (itemWithSameSku.category || '').toLowerCase().trim();
        const itemLocation = (itemWithSameSku.location || '').toLowerCase().trim();
        const itemUnit = (itemWithSameSku.unit || '').toLowerCase().trim();

        const nameMatches = itemName === name.toLowerCase().trim();
        const categoryMatches = itemCategory === category.toLowerCase().trim();
        const locationMatches = itemLocation === location.toLowerCase().trim();
        const unitMatches = itemUnit === unit.toLowerCase().trim();

        // Если ВСЕ обязательные поля совпадают → переводим в дубликаты
        if (nameMatches && categoryMatches && locationMatches && unitMatches) {
          // Создаём данные дубликата
          const duplicateData = {
            row: error.row,
            data: {
              name: name,
              sku: sku,
              category: category,
              location: location,
              unit: unit,
              description: description || null,
              image_url: error.data?.image_url || null,
              _extractedImage: error.data?._extractedImage || null
            },
            existing: itemWithSameSku,
            duplicateType: 'database'
          };

          // Добавляем в дубликаты
          importedData.duplicates.push(duplicateData);

          // Удаляем из ошибок
          importedData.errors = importedData.errors.filter(e => e.row !== error.row);

          // Обновляем UI
          updateFilterButtons(importedData);
          updateImportPreview(importedData);
          renderImportPreview(importedData);

          showError(`Товар перенесён в дубликаты (совпадает с "${itemWithSameSku.name}")`);
          return;
        }

        // Если обязательные поля отличаются → показываем конкретные отличия
        const mismatches = [];
        if (!nameMatches) mismatches.push(`название: "${name}" ≠ "${itemWithSameSku.name}"`);
        if (!categoryMatches) mismatches.push(`категория: "${category}" ≠ "${itemWithSameSku.category}"`);
        if (!locationMatches) mismatches.push(`место: "${location}" ≠ "${itemWithSameSku.location}"`);
        if (!unitMatches) mismatches.push(`единица: "${unit}" ≠ "${itemWithSameSku.unit}"`);

        showError(`Артикул "${sku}" уже в базе. Отличия: ${mismatches.join('; ')}`);
        skuInput?.focus();
        return;
      }

      // Проверяем уникальность артикула среди уже добавленных товаров для импорта
      const importedSkuItem = importedData.items.find(item => {
        const itemSku = item.sku ? item.sku.toString().toLowerCase().trim() : '';
        return itemSku === skuLower;
      });

      if (importedSkuItem) {
        // Проверяем совпадают ли обязательные поля
        const itemName = (importedSkuItem.name || '').toLowerCase().trim();
        const itemCategory = (importedSkuItem.category || '').toLowerCase().trim();
        const itemLocation = (importedSkuItem.location || '').toLowerCase().trim();
        const itemUnit = (importedSkuItem.unit || '').toLowerCase().trim();

        const nameMatches = itemName === name.toLowerCase().trim();
        const categoryMatches = itemCategory === category.toLowerCase().trim();
        const locationMatches = itemLocation === location.toLowerCase().trim();
        const unitMatches = itemUnit === unit.toLowerCase().trim();

        if (nameMatches && categoryMatches && locationMatches && unitMatches) {
          // Переводим в дубликаты (дубликат внутри файла)
          const duplicateData = {
            row: error.row,
            data: {
              name: name,
              sku: sku,
              category: category,
              location: location,
              unit: unit,
              description: description || null,
              image_url: error.data?.image_url || null,
              _extractedImage: error.data?._extractedImage || null
            },
            existing: importedSkuItem,
            duplicateType: 'file'
          };

          importedData.duplicates.push(duplicateData);
          importedData.errors = importedData.errors.filter(e => e.row !== error.row);

          updateFilterButtons(importedData);
          updateImportPreview(importedData);
          renderImportPreview(importedData);

          showError(`Товар перенесён в дубликаты (совпадает с "${importedSkuItem.name}" в файле)`);
          return;
        }

        // Отличия есть → ошибка
        const mismatches = [];
        if (!nameMatches) mismatches.push(`название`);
        if (!categoryMatches) mismatches.push(`категория`);
        if (!locationMatches) mismatches.push(`место`);
        if (!unitMatches) mismatches.push(`единица`);

        showError(`Артикул "${sku}" уже есть в файле. Отличия: ${mismatches.join(', ')}`);
        skuInput?.focus();
        return;
      }

      // Загружаем изображение, если выбрано новое
      let imageUrl = error.data.image_url || error.data._extractedImage || null;

      if (errorImageInput && errorImageInput.files && errorImageInput.files.length > 0) {
        try {
          const file = errorImageInput.files[0];
          // Импортируем функцию загрузки из supabase.js
          const { uploadFileToStorage } = await import('./supabase.js');
          imageUrl = await uploadFileToStorage(file, 'item-images');
          console.log('Изображение загружено для исправленного товара:', imageUrl);
        } catch (imageError) {
          console.error('Ошибка загрузки изображения:', imageError);
          showError('Не удалось загрузить изображение: ' + (imageError.message || 'Неизвестная ошибка'));
          return;
        }
      }

      // Создаем валидный товар из исправленной ошибки
      const fixedItem = {
        name: name,
        sku: sku,
        unit: unit,
        category: category,
        location: location,
        description: description || null,
        image_url: imageUrl
      };

      // Добавляем в список валидных товаров
      importedData.items.push(fixedItem);

      // Удаляем из списка ошибок
      importedData.errors = importedData.errors.filter(e => e.row !== error.row);

      // Удаляем элемент ошибки из DOM
      div.remove();

      // Обновляем предпросмотр (чтобы обновить счетчики и кнопку импорта)
      updateImportPreview(importedData);

      // Перерисовываем предпросмотр, чтобы показать исправленный товар в списке валидных
      renderImportPreview(importedData);

      showSuccess(`Ошибка исправлена. Товар "${name}" готов к импорту`);
    });
  }

  return div;
}

/**
 * Создать элемент дубликата
 */
function createDuplicateElement(duplicate) {
  const div = document.createElement('div');
  div.className = 'bg-amber-50 dark:bg-amber-900/10 rounded-3xl p-4 shadow-sm border border-amber-200 dark:border-amber-800/50 relative';
  div.setAttribute('data-duplicate-row', duplicate.row);

  const itemName = duplicate.data.name || 'Без названия';
  const fileCategory = duplicate.data.category || '—';
  const fileUnit = duplicate.data.unit || '—';
  const dbCategory = duplicate.existing?.category || '—';
  const dbUnit = duplicate.existing?.unit || '—';

  div.innerHTML = `
    <div class="flex gap-4">
      <div class="size-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
        <span class="material-symbols-outlined">content_copy</span>
      </div>
      <div class="flex-1 min-w-0">
        <h3 class="font-bold text-base text-slate-900 dark:text-white truncate">${itemName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h3>
        <p class="text-xs text-amber-700 dark:text-amber-500 font-medium mt-0.5">Найден дубликат в базе</p>
      </div>
    </div>
    <div class="mt-4 bg-white dark:bg-slate-800 rounded-xl p-3 border border-amber-100 dark:border-amber-800/30">
      <div class="flex items-center justify-between mb-2 pb-2 border-b border-slate-100 dark:border-slate-700">
        <span class="text-xs text-slate-500">В файле:</span>
        <span class="text-xs font-bold text-slate-900 dark:text-white">${fileCategory} • ${fileUnit}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-xs text-slate-500">В базе:</span>
        <span class="text-xs font-bold text-slate-900 dark:text-white">${dbCategory} • ${dbUnit}</span>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-2 mt-3">
      <button class="py-2 px-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 active:scale-95 transition-all keep-old-btn" data-row="${duplicate.row}">
        Оставить старое
      </button>
      <button class="py-2 px-2 rounded-xl bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-500/20 hover:bg-amber-600 active:scale-95 transition-all update-btn" data-row="${duplicate.row}">
        Обновить
      </button>
    </div>
  `;

  // Обработчики кнопок
  const keepOldBtn = div.querySelector('.keep-old-btn');
  const updateBtn = div.querySelector('.update-btn');
  if (keepOldBtn) {
    keepOldBtn.addEventListener('click', async () => {
      // Заменяем блок дубликата на блок с пометкой "Пропущен"
      const processedElement = createProcessedDuplicateElement(duplicate, 'skipped');

      // Находим родительский контейнер (может быть .section-items или прямой родитель)
      let parentContainer = div.parentElement;
      // Если родитель - это .section-items, используем его, иначе ищем выше
      if (parentContainer && parentContainer.classList.contains('section-items')) {
        parentContainer.replaceChild(processedElement, div);
      } else if (parentContainer) {
        parentContainer.replaceChild(processedElement, div);
      }

      // Удаляем дубликат из списка (оставляем старое)
      importedData.duplicates = importedData.duplicates.filter(d => d.row !== duplicate.row);

      // Обновляем счетчики
      updateFilterButtons(importedData);

      // Обновляем кнопку импорта и предпросмотр
      updateImportPreview(importedData);

      showSuccess(`Товар "${duplicate.data.name}" пропущен (оставлено старое)`);
    });
  }

  if (updateBtn) {
    updateBtn.addEventListener('click', async () => {
      // Обновляем существующий товар данными из файла
      try {
        // Подготавливаем данные для обновления
        // image_url уже обработан в processImportedData и сохранен в duplicate.data.image_url
        let imageUrl = duplicate.data.image_url || null;

        // Если image_url не найден, проверяем photo (на случай старого формата данных)
        if (!imageUrl && duplicate.data.photo) {
          const photoValue = String(duplicate.data.photo).trim();
          if (photoValue && photoValue !== 'null' && photoValue !== 'undefined' && photoValue !== '') {
            imageUrl = photoValue;
          }
        }

        console.log(`Обновление дубликата "${duplicate.data.name}": image_url =`, imageUrl);

        const updateData = {
          name: duplicate.data.name,
          category: duplicate.data.category || null,
          unit: duplicate.data.unit,
          location: duplicate.data.location || null,
          sku: duplicate.data.sku || null,
          description: duplicate.data.description || null,
          image_url: imageUrl
        };

        const result = await items.updateItem(duplicate.existing.id, updateData);

        // Проверяем, синхронизирован ли товар с сервером
        const isSynced = result && result.synced === true;
        const status = isSynced ? 'updated' : 'updated-local';

        // Заменяем блок дубликата на блок с пометкой
        const processedElement = createProcessedDuplicateElement(duplicate, status);

        // Находим родительский контейнер (может быть .section-items или прямой родитель)
        let parentContainer = div.parentElement;
        // Если родитель - это .section-items, используем его, иначе ищем выше
        if (parentContainer && parentContainer.classList.contains('section-items')) {
          parentContainer.replaceChild(processedElement, div);
        } else if (parentContainer) {
          parentContainer.replaceChild(processedElement, div);
        }

        // Удаляем дубликат из списка
        importedData.duplicates = importedData.duplicates.filter(d => d.row !== duplicate.row);

        // Обновляем счетчики
        updateFilterButtons(importedData);

        // Обновляем кнопку импорта и предпросмотр
        updateImportPreview(importedData);

        if (isSynced) {
          showSuccess(`Товар "${duplicate.data.name}" обновлен`);
        } else {
          showSuccess(`Товар "${duplicate.data.name}" обновлен локально (синхронизация с сервером не удалась)`);
        }
      } catch (error) {
        console.error('Ошибка обновления товара:', error);
        showError('Не удалось обновить товар: ' + error.message);
      }
    });
  }

  return div;
}

/**
 * Создать элемент валидного товара
 */
function createValidItemElement(item) {
  const div = document.createElement('div');
  div.className = 'bg-white dark:bg-surface-dark rounded-3xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none border border-slate-100 dark:border-slate-800 flex items-center gap-4 group';

  div.innerHTML = `
    <div class="size-12 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0 transition-colors group-hover:bg-green-100 dark:group-hover:bg-green-900/30">
      <span class="material-symbols-outlined">check_circle</span>
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex justify-between items-start">
        <h3 class="font-bold text-base text-slate-900 dark:text-white truncate pr-2">${(item.name || 'Без названия').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h3>
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${item.unit || 'шт'} ${item.category ? '• ' + item.category : ''}</p>
    </div>
  `;

  return div;
}

/**
 * Создать элемент обработанного дубликата (обновлен или пропущен)
 */
function createProcessedDuplicateElement(duplicate, status) {
  // status может быть 'updated' (обновлен), 'updated-local' (обновлен локально) или 'skipped' (пропущен)
  const div = document.createElement('div');
  div.className = 'bg-white dark:bg-surface-dark rounded-3xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none border border-slate-100 dark:border-slate-800 flex items-center gap-4 group';
  div.setAttribute('data-processed-row', duplicate.row);

  const itemName = duplicate.data.name || 'Без названия';
  const unit = duplicate.data.unit || 'шт';
  const category = duplicate.data.category || '';

  let statusText, statusColor;
  if (status === 'updated') {
    statusText = 'Файл обновлен';
    statusColor = 'text-green-600 dark:text-green-400';
  } else if (status === 'updated-local') {
    statusText = 'Обновлено локально';
    statusColor = 'text-amber-600 dark:text-amber-400';
  } else {
    statusText = 'Пропущен';
    statusColor = 'text-slate-500 dark:text-slate-400';
  }

  // Форматируем строку с единицей и категорией (как на скриншоте: "2 кг • Мешок")
  const unitCategoryText = category
    ? `${unit} • ${category}`
    : unit;

  div.innerHTML = `
    <div class="size-12 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0 transition-colors group-hover:bg-green-100 dark:group-hover:bg-green-900/30">
      <span class="material-symbols-outlined">check_circle</span>
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex justify-between items-start">
        <h3 class="font-bold text-base text-slate-900 dark:text-white truncate pr-2">${itemName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h3>
        <button class="text-slate-300 hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-[20px]">edit</span>
        </button>
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${unitCategoryText}</p>
      <p class="text-xs ${statusColor} font-medium mt-1">${statusText}</p>
    </div>
  `;

  return div;
}

/**
 * Импорт товаров в базу данных
 */
async function handleImport() {
  console.log('handleImport вызвана. Данные:', importedData);

  // Проверяем, есть ли данные для импорта (новые товары или дубликаты с изображениями)
  const duplicatesWithImages = importedData.duplicates?.filter(dup =>
    dup.data.image_url || dup.data._extractedImage
  ) || [];

  if (!importedData || (importedData.items.length === 0 && duplicatesWithImages.length === 0)) {
    console.error('Нет данных для импорта!', importedData);
    showError('Нет данных для импорта. Сначала загрузите файл.');
    return;
  }

  console.log(`Начинаем импорт ${importedData.items.length} товаров...`);

  // Проверяем, есть ли ошибки
  if (importedData.errors.length > 0) {
    const confirm = await showConfirm(
      `Обнаружено ${importedData.errors.length} ошибок. ` +
      `Импортировать только валидные товары (${importedData.items.length})?`
    );
    if (!confirm) {
      console.log('Пользователь отменил импорт из-за ошибок');
      return;
    }
  }

  // Показываем модальное окно прогресса
  showImportProgressModal('Импорт данных...', 'Подготовка к импорту');

  try {
    console.log('Импорт начат. Всего товаров:', importedData.items.length);

    let imported = 0;
    let failed = 0;
    const totalItems = importedData.items.length + duplicatesWithImages.length;
    let processedCount = 0;

    // Импортируем каждый товар
    for (let i = 0; i < importedData.items.length; i++) {
      const itemData = importedData.items[i];
      try {
        console.log(`Импорт товара ${i + 1}/${importedData.items.length}:`, itemData.name);
        if (itemData.image_url) {
          console.log(`  → image_url: "${itemData.image_url}"`);
        }
        await items.createItem(itemData);
        imported++;
        processedCount++;

        // Обновляем прогресс
        const percent = Math.round((processedCount / totalItems) * 100);
        updateImportProgress(percent, `Импортировано ${processedCount} из ${totalItems}`);

      } catch (error) {
        console.error(`Ошибка импорта товара "${itemData.name}":`, error);
        failed++;
        processedCount++;
      }
    }

    // Обрабатываем дубликаты с изображениями
    let updatedCount = 0;

    if (duplicatesWithImages.length > 0) {
      console.log(`Обновляем ${duplicatesWithImages.length} существующих товаров с новыми изображениями...`);

      for (const duplicate of duplicatesWithImages) {
        try {
          const existingItem = duplicate.existing;
          const newImageUrl = duplicate.data.image_url;

          if (newImageUrl && newImageUrl !== existingItem.image_url) {
            console.log(`Обновление изображения для "${existingItem.name}": ${newImageUrl}`);
            await items.updateItem(existingItem.id, {
              image_url: newImageUrl
            });
            imported++;
            updatedCount++;
            console.log(`✅ Изображение обновлено для "${existingItem.name}"`);
          }
          processedCount++;

          // Обновляем прогресс
          const percent = Math.round((processedCount / totalItems) * 100);
          updateImportProgress(percent, `Обновлено ${processedCount} из ${totalItems}`);

        } catch (error) {
          console.error(`Ошибка обновления изображения для "${duplicate.data.name}":`, error);
          failed++;
          processedCount++;
        }
      }
    }

    // Завершаем прогресс
    updateImportProgress(100, 'Завершение...');

    // Формируем сообщение результата
    let message = '';
    if (imported > 0) {
      message += `Импортировано: ${imported - updatedCount}`;
    }
    if (updatedCount > 0) {
      message += message ? `, обновлено: ${updatedCount}` : `Обновлено: ${updatedCount}`;
    }
    if (failed > 0) {
      message += message ? `, ошибок: ${failed}` : `Ошибок: ${failed}`;
    }
    if (!message) {
      message = 'Нет изменений';
    }

    console.log('Импорт завершен:', message);

    // Очищаем данные
    importedData = { items: [], errors: [], duplicates: [] };

    // Скрываем прогресс и показываем модалку успеха
    setTimeout(() => {
      hideImportProgressModal();
      showImportSuccessModal(message);
    }, 500);

  } catch (error) {
    console.error('Критическая ошибка импорта:', error);
    hideImportProgressModal();
    showError('Не удалось импортировать товары: ' + error.message);
  }
}

/**
 * Показать модальное окно прогресса импорта
 */
function showImportProgressModal(title, subtitle) {
  const modal = document.getElementById('import-progress-modal');
  const titleEl = document.getElementById('import-progress-title');
  const subtitleEl = document.getElementById('import-progress-subtitle');
  const percentageEl = document.getElementById('import-progress-percentage');
  const fillEl = document.getElementById('import-progress-fill');

  if (modal) {
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;
    if (percentageEl) percentageEl.textContent = '0%';
    if (fillEl) fillEl.style.width = '0%';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

/**
 * Обновить прогресс импорта
 */
function updateImportProgress(percent, subtitle) {
  const percentageEl = document.getElementById('import-progress-percentage');
  const subtitleEl = document.getElementById('import-progress-subtitle');
  const fillEl = document.getElementById('import-progress-fill');

  if (percentageEl) percentageEl.textContent = `${Math.round(percent)}%`;
  if (subtitleEl) subtitleEl.textContent = subtitle;
  if (fillEl) fillEl.style.width = `${percent}%`;
}

/**
 * Скрыть модальное окно прогресса импорта
 */
function hideImportProgressModal() {
  const modal = document.getElementById('import-progress-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

/**
 * Показать модальное окно успешного импорта
 */
function showImportSuccessModal(message) {
  const modal = document.getElementById('import-success-modal');
  const messageEl = document.getElementById('import-success-message');
  const stayBtn = document.getElementById('import-success-stay-btn');
  const goBtn = document.getElementById('import-success-go-btn');

  if (modal) {
    if (messageEl) messageEl.textContent = message;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Обработчик "Остаться"
    if (stayBtn) {
      stayBtn.onclick = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        // Сбрасываем UI страницы импорта
        resetImportPageUI();
      };
    }

    // Обработчик "К товарам"
    if (goBtn) {
      goBtn.onclick = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        navigateTo('items.html');
      };
    }
  }
}

/**
 * Сбросить UI страницы импорта после успешного импорта
 */
function resetImportPageUI() {
  // Сбрасываем зону загрузки
  const defaultContent = document.getElementById('upload-default-content');
  const successContent = document.getElementById('upload-success-content');
  const fileSuccessIcon = document.getElementById('file-success-icon');

  if (defaultContent) defaultContent.classList.remove('hidden');
  if (successContent) successContent.classList.add('hidden');
  if (fileSuccessIcon) fileSuccessIcon.classList.add('hidden');

  // Очищаем предпросмотр
  const previewContainer = document.getElementById('import-preview');
  if (previewContainer) previewContainer.innerHTML = '';

  // Скрываем фильтры
  const filterButtons = document.getElementById('filter-buttons');
  if (filterButtons) filterButtons.classList.add('hidden');

  // Сбрасываем кнопку импорта
  const importBtn = document.getElementById('import-btn');
  if (importBtn) {
    importBtn.disabled = true;
    importBtn.innerHTML = `
      <div class="size-6 rounded-full bg-slate-700 dark:bg-slate-200 flex items-center justify-center">
        <span class="material-symbols-outlined text-[16px]">save</span>
      </div>
      Импортировать
    `;
  }
}

// Делаем функцию handleImport доступной глобально для обработчиков событий
window.handleImport = handleImport;

/**
 * Инициализация страницы управления данными (items-management.html)
 * Содержит 3 основные функции: Экспорт, Импорт, Удаление всех данных
 */
function initItemsManagementPage() {
  console.log('Инициализация страницы управления данными...');

  // Загружаем статистику при открытии страницы
  loadDataStats();

  // Получаем элементы карточек
  const exportCard = document.getElementById('export-card');
  const importCard = document.getElementById('import-card');
  const deleteCard = document.getElementById('delete-card');
  const helpBtn = document.getElementById('help-btn');

  // Обработчик кнопки "Экспорт данных"
  if (exportCard) {
    exportCard.addEventListener('click', async () => {
      console.log('Клик по карточке "Экспорт данных"');
      await handleExportData();
    });
  }

  // Обработчик кнопки "Импорт данных" - переход на страницу импорта
  if (importCard) {
    importCard.addEventListener('click', () => {
      console.log('Клик по карточке "Импорт данных"');
      navigateTo('items-import.html');
    });
  }

  // Обработчик кнопки "Удалить все данные"
  if (deleteCard) {
    deleteCard.addEventListener('click', () => {
      console.log('Клик по карточке "Удалить все данные"');
      showDeleteConfirmModal();
    });
  }

  // Обработчик кнопки справки
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      showManagementHelpModal();
    });
  }

  // Настраиваем модальные окна
  setupManagementModals();
}

/**
 * Загрузить статистику базы данных
 */
async function loadDataStats() {
  try {
    const allItems = await items.getAllItems();
    const categories = [...new Set(allItems.map(item => item.category).filter(Boolean))];

    const itemsCountEl = document.getElementById('stats-items-count');
    const categoriesCountEl = document.getElementById('stats-categories-count');

    if (itemsCountEl) itemsCountEl.textContent = allItems.length;
    if (categoriesCountEl) categoriesCountEl.textContent = categories.length;
  } catch (error) {
    console.error('Ошибка загрузки статистики:', error);
  }
}

/**
 * Показать модальное окно прогресса
 * @param {string} title - Заголовок
 * @param {string} subtitle - Подзаголовок
 * @param {boolean} isRed - Использовать красный цвет (для удаления)
 */
function showProgressModal(title, subtitle, isRed = false) {
  const modal = document.getElementById('progress-modal');
  const linearProgress = document.getElementById('linear-progress');
  const progressBar = document.getElementById('progress-bar');
  const titleEl = document.getElementById('progress-title');
  const subtitleEl = document.getElementById('progress-subtitle');
  const percentageEl = document.getElementById('progress-percentage');
  const timeEl = document.getElementById('progress-time');

  if (modal) {
    // Устанавливаем цвет прогресса (красный для удаления, синий для остального)
    if (linearProgress) {
      linearProgress.classList.toggle('red', isRed);
    }

    // Сбрасываем прогресс
    if (progressBar) {
      progressBar.style.width = '0%';
    }
    if (percentageEl) percentageEl.textContent = '0%';
    if (timeEl) timeEl.textContent = '';

    // Устанавливаем текст
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;

    // Показываем модальное окно
    modal.classList.add('active');
  }
}

/**
 * Обновить прогресс в модальном окне
 * @param {number} percent - Процент выполнения (0-100)
 * @param {string} timeText - Текст времени (опционально)
 */
function updateProgress(percent, timeText = '') {
  const progressBar = document.getElementById('progress-bar');
  const percentageEl = document.getElementById('progress-percentage');
  const timeEl = document.getElementById('progress-time');

  // Обновляем ширину линейного прогресс-бара
  if (progressBar) {
    progressBar.style.width = `${Math.round(percent)}%`;
  }
  if (percentageEl) {
    percentageEl.textContent = `${Math.round(percent)}%`;
  }
  if (timeEl && timeText) {
    timeEl.textContent = timeText;
  }
}

/**
 * Скрыть модальное окно прогресса
 */
function hideProgressModal() {
  const modal = document.getElementById('progress-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * Показать модальное окно успеха
 * @param {string} title - Заголовок
 * @param {string} message - Сообщение
 */
function showSuccessModal(title, message) {
  const modal = document.getElementById('success-modal');
  const titleEl = document.getElementById('success-title');
  const messageEl = document.getElementById('success-message');

  if (modal) {
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    modal.classList.add('active');
  }
}

/**
 * Скрыть модальное окно успеха
 */
function hideSuccessModal() {
  const modal = document.getElementById('success-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * Показать модальное окно подтверждения удаления
 */
function showDeleteConfirmModal() {
  const modal = document.getElementById('confirm-delete-modal');
  if (modal) {
    modal.classList.add('active');
  }
}

/**
 * Скрыть модальное окно подтверждения удаления
 */
function hideDeleteConfirmModal() {
  const modal = document.getElementById('confirm-delete-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * Настроить обработчики модальных окон
 */
function setupManagementModals() {
  // Кнопка отмены удаления
  const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', hideDeleteConfirmModal);
  }

  // Кнопка подтверждения удаления
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      hideDeleteConfirmModal();
      await handleDeleteAllData();
    });
  }

  // Кнопка OK в модальном окне успеха
  const successOkBtn = document.getElementById('success-ok-btn');
  if (successOkBtn) {
    successOkBtn.addEventListener('click', () => {
      hideSuccessModal();
      // Обновляем статистику после успешной операции
      loadDataStats();
    });
  }
}

/**
 * Экспорт всех данных в Excel файл
 */
async function handleExportData() {
  console.log('Начинаем экспорт данных...');

  try {
    // Показываем прогресс (синий цвет)
    showProgressModal('Выгрузка данных...', 'Пожалуйста, не закрывайте приложение', false);

    const startTime = Date.now();

    // Получаем все товары
    updateProgress(10, '~5 сек');
    const allItems = await items.getAllItems();

    if (allItems.length === 0) {
      hideProgressModal();
      showSuccessModal('База пуста', 'Нет данных для экспорта. Сначала добавьте товары.');
      return;
    }

    updateProgress(30);

    // Подготавливаем данные для Excel
    // Заголовки столбцов на русском
    const headers = ['Название', 'Категория', 'Единица измерения', 'Место хранения', 'Артикул', 'Изображение', 'Дата создания'];

    // Преобразуем данные
    const rows = allItems.map(item => [
      item.name || '',
      item.category || '',
      item.unit || '',
      item.location || '',
      item.sku || '',
      item.image_url || '',
      item.created_at ? new Date(item.created_at).toLocaleDateString('ru-RU') : ''
    ]);

    updateProgress(50);

    // Создаем рабочую книгу Excel
    const wb = XLSX.utils.book_new();
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Устанавливаем ширину столбцов
    ws['!cols'] = [
      { wch: 30 }, // Название
      { wch: 20 }, // Категория
      { wch: 15 }, // Единица
      { wch: 20 }, // Место хранения
      { wch: 15 }, // Артикул
      { wch: 50 }, // Изображение URL
      { wch: 15 }  // Дата
    ];

    updateProgress(70);

    // Добавляем лист в книгу
    XLSX.utils.book_append_sheet(wb, ws, 'Товары');

    updateProgress(85);

    // Генерируем имя файла с датой
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const fileName = `Инвентура_экспорт_${dateStr}.xlsx`;

    // Скачиваем файл
    XLSX.writeFile(wb, fileName);

    updateProgress(100);

    // Вычисляем время выполнения
    const duration = Math.round((Date.now() - startTime) / 1000);

    // Небольшая задержка перед показом успеха
    setTimeout(() => {
      hideProgressModal();
      showSuccessModal('Экспорт завершён!', `Файл "${fileName}" успешно создан. Экспортировано ${allItems.length} товаров за ${duration} сек.`);
    }, 500);

  } catch (error) {
    console.error('Ошибка экспорта:', error);
    hideProgressModal();
    showError('Не удалось экспортировать данные: ' + error.message);
  }
}

/**
 * Удаление всех данных из базы (локально и на сервере)
 */
async function handleDeleteAllData() {
  console.log('Начинаем удаление всех данных...');

  try {
    // Показываем прогресс (красный цвет)
    showProgressModal('Удаление базы...', 'Не закрывайте приложение', true);

    const startTime = Date.now();

    // Получаем все товары для подсчета
    updateProgress(10);
    const allItems = await items.getAllItems();
    const totalItems = allItems.length;

    if (totalItems === 0) {
      hideProgressModal();
      showSuccessModal('База уже пуста', 'Нет данных для удаления.');
      return;
    }

    updateProgress(20);

    // Удаляем товары с сервера (Supabase)
    let deletedFromServer = 0;
    let serverErrors = 0;

    for (let i = 0; i < allItems.length; i++) {
      try {
        // Пытаемся удалить с сервера
        await supabase.deleteItem(allItems[i].id);
        deletedFromServer++;
      } catch (err) {
        // Если товара нет на сервере, это не критическая ошибка
        console.warn('Не удалось удалить с сервера:', allItems[i].id, err.message);
        serverErrors++;
      }

      // Обновляем прогресс (от 20% до 60%)
      const progress = 20 + (40 * (i + 1) / totalItems);
      updateProgress(progress);
    }

    updateProgress(65);

    // Удаляем товары из локальной базы (IndexedDB)
    let deletedLocally = 0;

    for (let i = 0; i < allItems.length; i++) {
      try {
        await db.deleteItem(allItems[i].id);
        deletedLocally++;
      } catch (err) {
        console.error('Ошибка удаления из локальной базы:', err);
      }

      // Обновляем прогресс (от 65% до 95%)
      const progress = 65 + (30 * (i + 1) / totalItems);
      updateProgress(progress);
    }

    updateProgress(100);

    // Вычисляем время выполнения
    const duration = Math.round((Date.now() - startTime) / 1000);

    // Небольшая задержка перед показом успеха
    setTimeout(() => {
      hideProgressModal();

      let message = `Удалено ${deletedLocally} товаров за ${duration} сек.`;
      if (serverErrors > 0) {
        message += ` (${serverErrors} не было на сервере)`;
      }

      showSuccessModal('Удаление завершено!', message);

      // Обновляем статистику
      loadDataStats();
    }, 500);

  } catch (error) {
    console.error('Ошибка удаления:', error);
    hideProgressModal();
    showError('Не удалось удалить данные: ' + error.message);
  }
}

/**
 * Показать модальное окно справки для страницы управления данными
 */
function showManagementHelpModal() {
  // Проверяем, не открыто ли уже модальное окно
  if (document.getElementById('management-help-modal')) {
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'management-help-modal';
  modal.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
      <div class="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Справка</h2>
        <button id="close-management-help" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
          <span class="material-symbols-outlined text-slate-600 dark:text-slate-400">close</span>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-6 space-y-4">
        <div>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">download</span>
            Экспорт данных
          </h3>
          <p class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
            Выгружает все товары из базы данных в файл Excel (.xlsx). 
            Используйте для создания резервной копии или отчетности.
          </p>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <span class="material-symbols-outlined text-emerald-600">upload_file</span>
            Импорт данных
          </h3>
          <p class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
            Загружает товары из файла Excel (.xlsx) или CSV. 
            Файл должен содержать столбцы: Название, Категория, Единица измерения и т.д.
          </p>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <span class="material-symbols-outlined text-red-600">delete_forever</span>
            Удаление данных
          </h3>
          <p class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
            <strong class="text-red-600">Внимание!</strong> Полностью удаляет все товары из локальной базы и с сервера. 
            Это действие необратимо. Рекомендуется сделать экспорт перед удалением.
          </p>
        </div>
      </div>
      <div class="p-6 border-t border-slate-200 dark:border-slate-700">
        <button id="close-management-help-btn" class="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-xl transition-colors">
          Понятно
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Обработчики закрытия
  const closeButtons = modal.querySelectorAll('#close-management-help, #close-management-help-btn');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => modal.remove());
  });

  // Закрытие по клику вне модального окна
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  // Закрытие по Escape
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

/**
 * Инициализация страницы импорта товаров
 */
function initItemsImportPage() {
  console.log('Инициализация страницы импорта...');

  // Устанавливаем фильтр по умолчанию
  window.currentImportFilter = 'all';

  // Элементы страницы
  const selectFileBtn = document.getElementById('select-file-btn');
  const dropZone = document.getElementById('drop-zone');
  const importBtn = document.getElementById('import-btn');
  const helpBtn = document.getElementById('help-btn');
  const filterButtons = document.querySelectorAll('.filter-btn');

  // Создаем скрытый input для выбора файла
  let fileInput = document.getElementById('hidden-file-input');
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.id = 'hidden-file-input';
    fileInput.type = 'file';
    fileInput.accept = '.xlsx,.xls,.csv';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        console.log('Файл выбран:', file.name);
        await handleFileSelect(file);
      }
      e.target.value = '';
    });
    document.body.appendChild(fileInput);
  }

  // Функция открытия выбора файла
  window.openFilePicker = function () {
    fileInput.click();
  };

  // Обработчик кнопки "Выбрать файл"
  if (selectFileBtn) {
    selectFileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.openFilePicker();
    });
  }

  // Обработчик клика по зоне загрузки
  if (dropZone) {
    dropZone.addEventListener('click', (e) => {
      // Не открываем, если кликнули по кнопке
      if (e.target.closest('button')) return;
      window.openFilePicker();
    });

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('bg-blue-100', 'dark:bg-blue-900/30');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('bg-blue-100', 'dark:bg-blue-900/30');
    });

    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.classList.remove('bg-blue-100', 'dark:bg-blue-900/30');

      const file = e.dataTransfer.files[0];
      if (file) {
        console.log('Файл перетащен:', file.name);
        await handleFileSelect(file);
      }
    });
  }

  // Обработчик кнопки "Импортировать"
  if (importBtn) {
    importBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (importBtn.disabled) {
        console.warn('Кнопка отключена');
        return;
      }

      console.log('Кнопка "Импортировать" нажата');
      await handleImport();
    });
  }

  // Обработчики кнопок фильтров
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      window.currentImportFilter = filter;

      // Обновляем активную кнопку
      filterButtons.forEach(b => {
        if (b.dataset.filter === filter) {
          b.classList.add('bg-slate-900', 'dark:bg-white', 'text-white', 'dark:text-slate-900');
          b.classList.remove('bg-white', 'dark:bg-surface-dark');
        } else {
          b.classList.remove('bg-slate-900', 'dark:bg-white', 'text-white', 'dark:text-slate-900');
          b.classList.add('bg-white', 'dark:bg-surface-dark');
        }
      });

      // Перерисовываем предпросмотр с фильтром
      if (importedData && (importedData.items.length > 0 || importedData.errors.length > 0 || importedData.duplicates.length > 0)) {
        renderImportPreview(importedData);
      }
    });
  });

  // Обработчик кнопки справки
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      showHelpModal();
    });
  }

  console.log('Инициализация страницы импорта завершена');
}

/**
 * Показать модальное окно справки
 */
function showHelpModal() {
  // Проверяем, не открыто ли уже модальное окно
  if (document.getElementById('help-modal')) {
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'help-modal';
  modal.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
      <div class="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Справка по импорту</h2>
        <button id="close-help-modal" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
          <span class="material-symbols-outlined text-slate-600 dark:text-slate-400">close</span>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-6 space-y-4">
        <div>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">Как импортировать данные</h3>
          <p class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
            Вы можете импортировать товары из файлов Excel или CSV. Поддерживаемые форматы: .xlsx, .xls, .csv
          </p>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">Формат CSV файла</h3>
          <p class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-2">
            Первая строка должна содержать заголовки столбцов:
          </p>
          <div class="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 font-mono text-xs text-slate-700 dark:text-slate-300">
            name, category, unit, location, sku
          </div>
          <p class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mt-2">
            Или на русском:
          </p>
          <div class="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 font-mono text-xs text-slate-700 dark:text-slate-300">
            название, категория, единица измерения, место хранения, артикул
          </div>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">Пример данных</h3>
          <div class="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 font-mono text-xs text-slate-700 dark:text-slate-300 overflow-x-auto">
            name,category,unit<br>
            Тарелка обеденная,Посуда,шт<br>
            Вилка столовая,Приборы,шт
          </div>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">Обработка ошибок</h3>
          <p class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
            Товары с ошибками будут отмечены красным цветом. Исправьте их перед импортом. Дубликаты будут помечены желтым цветом.
          </p>
        </div>
      </div>
      <div class="p-6 border-t border-slate-200 dark:border-slate-700">
        <button id="close-help-modal-btn" class="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-xl transition-colors">
          Понятно
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Обработчики закрытия
  const closeButtons = modal.querySelectorAll('#close-help-modal, #close-help-modal-btn');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modal.remove();
    });
  });

  // Закрытие по клику вне модального окна
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Закрытие по Escape
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

/**
 * Инициализация страницы истории инвентаризаций
 */
async function initInventoryHistoryPage() {
  try {
    // Загружаем отчеты
    const reports = await inventory.getAllInventoryReports();
    const sortedReports = reports
      .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));

    renderHistoryList(sortedReports);
  } catch (error) {
    console.error('Ошибка инициализации страницы истории:', error);
    // Показываем пустой список при ошибке
    renderHistoryList([]);
  }
}

/**
 * Отобразить список истории отчетов
 * 
 * @param {Array} reports - Массив отчетов
 */
/**
 * Отобразить список истории отчетов
 * 
 * @param {Array} reports - Массив отчетов
 */
function renderHistoryList(reports) {
  const archiveSection = document.querySelector('section:last-of-type');
  if (!archiveSection) return;

  const archiveList = archiveSection.querySelector('.bg-white.dark\\:bg-slate-800');
  if (!archiveList) return;

  if (reports.length === 0) {
    archiveList.innerHTML = `
      <div class="p-8 text-center text-slate-400 dark:text-slate-500">
        <span class="material-symbols-outlined text-4xl mb-2">description</span>
        <p class="text-sm">Отчеты отсутствуют</p>
      </div>
    `;
    return;
  }

  // Очищаем и создаем элементы заново, чтобы навесить обработчики
  archiveList.innerHTML = '';

  reports.forEach(report => {
    const reportDate = new Date(report.date || report.created_at);
    const options = { month: 'long', year: 'numeric' };
    const formattedDate = reportDate.toLocaleDateString('ru-RU', options);
    const dayDate = reportDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });

    // Вычисляем процент изменения
    const totalItems = report.total_items || 1;
    const differencePercent = report.items_with_difference > 0
      ? ((report.items_with_difference / totalItems) * 100).toFixed(1)
      : '0.0';

    const isPositive = report.positive_difference > report.negative_difference;
    const percentClass = isPositive
      ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
      : report.negative_difference > report.positive_difference
        ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400';

    const percentSign = isPositive ? '+' : report.negative_difference > report.positive_difference ? '-' : '';

    const itemEl = document.createElement('div');
    itemEl.className = 'group flex items-center justify-between p-4 active:bg-slate-50 dark:active:bg-slate-700/50 transition-colors cursor-pointer';
    itemEl.innerHTML = `
        <div class="flex items-center gap-4">
          <div class="flex items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 shrink-0 w-10 h-10 text-green-600 dark:text-green-400">
            <span class="material-symbols-outlined text-[20px]">check_circle</span>
          </div>
          <div class="flex flex-col">
            <p class="text-slate-900 dark:text-white text-base font-semibold leading-snug">${formattedDate}</p>
            <p class="text-slate-500 dark:text-slate-400 text-sm font-normal">Позиций: <span class="text-slate-700 dark:text-slate-300 font-medium">${report.total_items || 0}</span></p>
          </div>
        </div>
        <div class="flex flex-col items-end gap-1">
          <span class="text-slate-400 dark:text-slate-500 text-xs">${dayDate}</span>
          <div class="px-2 py-0.5 rounded ${percentClass} text-xs font-bold">
            ${percentSign}${differencePercent}%
          </div>
        </div>
    `;

    itemEl.addEventListener('click', () => handleReportAction(report));
    archiveList.appendChild(itemEl);
  });
}

/**
 * Обработка действий с отчетом (модальное окно)
 * 
 * @param {Object} report - Данные отчета
 */
function handleReportAction(report) {
  const reportDate = new Date(report.date || report.created_at);
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  const formattedDate = reportDate.toLocaleDateString('ru-RU', options);

  showModal({
    title: 'Управление отчетом',
    message: `Отчет от ${formattedDate}\nВыберите действие с этим документом.`,
    buttons: [
      {
        text: 'Сохранить',
        primary: true,
        onClick: () => exportReportToExcel(report)
      },
      {
        text: 'Отправить',
        primary: true,
        onClick: () => shareReport(report)
      },
      {
        text: 'Просмотреть',
        primary: false,
        onClick: () => viewReportDetails(report)
      }
    ]
  });
}

/**
 * Экспорт отчета в Excel
 * 
 * @param {Object} report - Данные отчета
 */
function exportReportToExcel(report) {
  try {
    if (typeof XLSX === 'undefined') {
      showAlert('Библиотека Excel не загружена. Проверьте подключение к интернету.');
      return;
    }

    const reportData = report.items.map(item => ({
      'Товар': item.item_name,
      'Количество': item.quantity,
      'Предыдущее': item.previous_quantity || 0,
      'Разница': item.difference || 0,
      'Комментарий': item.comment || ''
    }));

    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Отчет");

    const fileName = `Инвентаризация_${report.date || 'отчет'}.xlsx`;
    XLSX.writeFile(wb, fileName);
  } catch (error) {
    console.error('Ошибка экспорта:', error);
    showAlert('Не удалось сохранить файл Excel.');
  }
}

/**
 * Отправить отчет
 * 
 * @param {Object} report - Данные отчета
 */
async function shareReport(report) {
  const reportDate = new Date(report.date || report.created_at).toLocaleDateString('ru-RU');
  const text = `Отчет по инвентаризации от ${reportDate}\nПозиций: ${report.total_items}\nРасхождений: ${report.items_with_difference}`;

  // Закрываем модалку сразу, чтобы она не "висела" на фоне выбора приложения
  closeModal();

  if (navigator.share) {
    try {
      // Не ждем (await), чтобы не блокировать поток, если системное окно долго открыто
      navigator.share({
        title: 'Отчет по инвентаризации',
        text: text,
      }).catch(err => {
        if (err.name !== 'AbortError') console.error('Share error:', err);
      });
      return;
    } catch (error) {
      console.warn('Ошибка Web Share:', error);
    }
  }

  // Фолбэк на буфер обмена
  try {
    await navigator.clipboard.writeText(text);
    showAlert('Текст отчета скопирован', 'Готово');
  } catch (err) {
    showAlert(text, 'Текст отчета');
  }
}

/**
 * Просмотреть детали отчета
 * 
 * @param {Object} report - Данные отчета
 */
function viewReportDetails(report) {
  const reportDate = new Date(report.date || report.created_at).toLocaleDateString('ru-RU');

  // Компактная разметка с принудительной шириной
  let html = `<div class="w-full space-y-4">
      <div class="grid grid-cols-2 gap-2 w-full">
        <div class="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 w-full">
          <p class="text-[9px] uppercase font-black text-slate-400 mb-0.5">Всего</p>
          <p class="text-lg font-black text-slate-900 dark:text-white leading-none">${report.total_items}</p>
        </div>
        <div class="bg-amber-50/50 dark:bg-amber-900/10 p-2.5 rounded-xl border border-amber-100/50 dark:border-amber-900/30 w-full">
          <p class="text-[9px] uppercase font-black text-amber-500 mb-0.5">Разница</p>
          <p class="text-lg font-black text-amber-600 dark:text-amber-400 leading-none">${report.items_with_difference}</p>
        </div>
        <div class="bg-green-50/50 dark:bg-green-900/20 p-2.5 rounded-xl border border-green-100/50 dark:border-green-900/30 w-full">
          <p class="text-[9px] uppercase font-black text-green-500 mb-0.5">Излишки</p>
          <p class="text-lg font-black text-green-600 dark:text-green-400 leading-none">${report.positive_difference}</p>
        </div>
        <div class="bg-red-50/50 dark:bg-red-900/20 p-2.5 rounded-xl border border-red-100/50 dark:border-red-900/30 w-full">
          <p class="text-[9px] uppercase font-black text-red-500 mb-0.5">Недостачи</p>
          <p class="text-lg font-black text-red-600 dark:text-red-400 leading-none">${report.negative_difference}</p>
        </div>
      </div>
      <div class="space-y-2 w-full">
        <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-tighter flex items-center gap-1.5 ml-1">
          <span class="material-symbols-outlined text-[14px]">list_alt</span>
          Список расхождений
        </h4>
        <div class="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden w-full">`;

  const diffItems = report.items.filter(i => i.difference !== 0);

  if (diffItems.length > 0) {
    diffItems.forEach(i => {
      const colorClass = i.difference > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
      html += `
        <div class="px-3 py-2 flex items-start gap-3 w-full border-b border-slate-50 dark:border-slate-800/50 last:border-0">
          <div class="flex-1 min-w-0">
            <p class="text-[12px] font-medium text-slate-700 dark:text-slate-300 leading-tight break-all">${i.item_name}</p>
          </div>
          <div class="shrink-0 text-right pt-0.5">
            <p class="text-[13px] font-black ${colorClass} whitespace-nowrap">${i.difference > 0 ? '+' : ''}${i.difference}</p>
          </div>
        </div>`;
    });
  } else {
    html += `<p class="py-4 text-center text-slate-400 text-xs italic">Расхождений нет</p>`;
  }

  html += `</div></div></div>`;

  return showAlert(html, `Отчет от ${reportDate}`);
}


/**
 * Показать сообщение об ошибке
 * 
 * @param {string} message - Текст ошибки
 */
async function showError(message) {
  console.error(message);
  // Здесь можно добавить отображение ошибки в UI
  await showAlert('Ошибка: ' + message, 'Ошибка');
}

/**
 * Показать сообщение об успехе
 * 
 * @param {string} message - Текст сообщения
 */
function showSuccess(message) {
  console.log(message);
  // Используем алерт, так как отдельного тоста пока нет
  showAlert(message, 'Успешно');
}

// Инициализируем приложение при загрузке страницы
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

/**
 * Настройка кнопок справки на всех страницах
 */
function setupHelpButtons() {
  const helpBtn = document.getElementById('help-btn');
  if (helpBtn) {
    // Удаляем старые обработчики, если есть
    helpBtn.replaceWith(helpBtn.cloneNode(true));
    const newHelpBtn = document.getElementById('help-btn');
    newHelpBtn.addEventListener('click', () => {
      showPageHelp();
    });
  }
}

/**
 * Показать модальное окно справки для текущей страницы
 */
function showPageHelp() {
  const page = getCurrentPage();
  console.log('Показ справки для страницы:', page);

  // Для страниц с уже существующей логикой
  if (page === 'items-management') {
    if (typeof showManagementHelpModal === 'function') {
      showManagementHelpModal();
      return;
    }
  }

  if (page === 'items-import') {
    if (typeof showHelpModal === 'function') {
      showHelpModal();
      return;
    }
  }

  let title = 'Справка';
  let content = '';

  switch (page) {
    case 'inventory':
      title = 'Главная панель';
      content = `
        <div class="space-y-4">
          <div>
            <h3 class="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">analytics</span>
              Обзор инвентаризации
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">Здесь отображается статус активной сессии. Вы можете увидеть прогресс подсчета и обнаруженные расхождения.</p>
          </div>
          <div>
            <h3 class="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">play_circle</span>
              Управление сессией
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">Нажмите <b>"Начать"</b> для новой инвентаризации или <b>"Продолжить"</b>, если работа уже начата.</p>
          </div>
          <div>
            <h3 class="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">history</span>
              История
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">Ниже представлен список последних завершенных инвентаризаций. Нажмите на любой отчет для просмотра деталей.</p>
          </div>
        </div>
      `;
      break;
    case 'items':
      title = 'База товаров';
      content = `
        <div class="space-y-4">
          <div>
            <h3 class="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">search</span>
              Поиск и фильтрация
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">Используйте строку поиска для нахождения товара по названию или SKU. Кнопки выше позволяют фильтровать список по категориям.</p>
          </div>
          <div>
            <h3 class="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">add_circle</span>
              Добавление товара
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">Синяя плавающая кнопка <b>"+"</b> внизу справа открывает форму создания нового товара в системе.</p>
          </div>
          <div>
            <h3 class="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">info</span>
              Управление
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">Нажмите на карточку любого товара, чтобы перейти в режим редактирования или посмотреть историю замеров.</p>
          </div>
        </div>
      `;
      break;
    case 'inventory-history':
      title = 'Статистика и отчеты';
      content = `
        <div class="space-y-4">
          <div>
            <h3 class="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">show_chart</span>
              Динамика остатков
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">График показывает общее изменение количества товаров по месяцам. Рост или падение отображается в процентах.</p>
          </div>
          <div>
            <h3 class="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">folder_zip</span>
              Архив отчетов
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">Все завершенные инвентаризации хранятся здесь. Вы можете открыть любой старый отчет для анализа расхождений.</p>
          </div>
        </div>
      `;
      break;
    case 'item-details':
      title = 'Инфо о товаре';
      content = `
        <div class="space-y-4">
          <div>
            <h3 class="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">edit</span>
              Режим правки
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">Нажмите на значок карандаша вверху, чтобы изменить фото, название, SKU или место хранения товара.</p>
          </div>
          <div>
            <h3 class="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span class="material-symbols-outlined text-green-600">calculate</span>
              Текущий замер
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">В центральном блоке отображается количество, зафиксированное в текущей (или последней) сессии, и его отличие от предыдущего замера.</p>
          </div>
          <div>
            <h3 class="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span class="material-symbols-outlined text-red-600">delete</span>
              Удаление
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">Кнопка внизу позволяет безвозвратно удалить товар из базы данных. Будьте осторожны!</p>
          </div>
        </div>
      `;
      break;
    case 'inventory-session':
      title = 'Процесс инвентаризации';
      content = `
        <div class="space-y-4">
          <div>
            <h3 class="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">filter_list</span>
              Категории и поиск
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">Выбирайте категорию в верхней ленте или воспользуйтесь плавающим меню справа. Кнопка <b>"Все"</b> сбрасывает все фильтры.</p>
          </div>
          <div>
            <h3 class="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">add_box</span>
              Ввод данных
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">Используйте <b>"+"</b> и <b>"-"</b> для изменения количества. Нажмите на число, чтобы открыть калькулятор или добавить промежуточное значение.</p>
          </div>
          <div>
            <h3 class="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">save</span>
              Сохранение
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">Приложение сохраняет данные автоматически каждые 30 сек. Также вы можете нажать <b>"Сохранить прогресс"</b> вручную перед выходом.</p>
          </div>
        </div>
      `;
      break;
  }

  if (content) {
    createHelpModal(title, content);
  } else {
    // Если контент не задан, показываем общую справку
    createHelpModal('Помощь', '<p class="text-sm text-slate-600 dark:text-slate-400">На этой странице пока нет подробного описания. Используйте навигацию меню для перехода между разделами.</p>');
  }
}

/**
 * Создание и отображение модального окна справки
 */
function createHelpModal(title, htmlContent) {
  // Проверяем, не открыто ли уже модальное окно
  const existingModal = document.getElementById('global-help-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'global-help-modal';
  modal.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 opacity-0 transition-opacity duration-300';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col transform scale-95 transition-transform duration-300">
      <div class="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
        <div class="flex items-center gap-3">
          <div class="size-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-primary">
            <span class="material-symbols-outlined">help</span>
          </div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">${title}</h2>
        </div>
        <button id="close-global-help" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-6 custom-scrollbar">
        ${htmlContent}
      </div>
      <div class="p-6 border-t border-slate-200 dark:border-slate-700">
        <button id="close-global-help-btn" class="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-blue-500/25">
          Понятно
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Анимация появления
  requestAnimationFrame(() => {
    modal.classList.add('opacity-100');
    modal.querySelector('div').classList.remove('scale-95');
    modal.querySelector('div').classList.add('scale-100');
  });

  // Обработчики закрытия
  const closeModal = () => {
    modal.classList.remove('opacity-100');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => modal.remove(), 300);
  };

  modal.querySelector('#close-global-help').addEventListener('click', closeModal);
  modal.querySelector('#close-global-help-btn').addEventListener('click', closeModal);

  // Закрытие по клику вне модального окна
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Закрытие по Escape
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

// Экспортируем функции для использования в других модулях
export { navigateTo, showError, showSuccess, showPageHelp };

