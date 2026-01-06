/**
 * Главный файл приложения
 * 
 * Этот файл инициализирует приложение, настраивает навигацию
 * и подключает обработчики событий к HTML страницам.
 */

import { initDB } from './db.js';
import { setupAutoSync } from './sync.js';
import * as items from './items.js';
import * as inventory from './inventory.js';

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
  
  if (filename.includes('inventory.html')) return 'inventory';
  if (filename.includes('items.html')) return 'items';
  if (filename.includes('inventory-session.html')) return 'inventory-session';
  if (filename.includes('item-details.html')) return 'item-details';
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
      initInventorySessionPage();
      break;
    case 'item-details':
      initItemDetailsPage();
      break;
    case 'items-import':
      initItemsImportPage();
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
    
    if (activeSession) {
      // Обновляем информацию о сессии на странице
      updateInventoryOverview(activeSession);
    }
    
    // Загружаем историю
    const historySessions = sessions
      .filter(s => s.status === 'completed')
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
    
    updateInventoryHistory(historySessions);
    
    // Обработчик кнопки "Продолжить"
    const continueButton = document.querySelector('[data-continue-session]');
    if (continueButton && activeSession) {
      continueButton.addEventListener('click', () => {
        navigateTo(`inventory-session.html?id=${activeSession.id}`);
      });
    }
    
    // Обработчик кнопки "Начать новую"
    const newSessionButton = document.querySelector('[data-new-session]');
    if (newSessionButton) {
      newSessionButton.addEventListener('click', async () => {
        const today = new Date().toISOString().split('T')[0];
        const newSession = await inventory.createInventorySession({
          date: today,
          status: 'in_progress'
        });
        navigateTo(`inventory-session.html?id=${newSession.id}`);
      });
    }
  } catch (error) {
    console.error('Ошибка инициализации страницы инвентаризации:', error);
  }
}

/**
 * Обновить обзор инвентаризации на главной странице
 * 
 * @param {Object} session - Сессия инвентаризации
 */
function updateInventoryOverview(session) {
  // Здесь можно обновить DOM элементы с информацией о сессии
  // Например, прогресс, количество товаров и т.д.
  console.log('Обновление обзора инвентаризации:', session);
}

/**
 * Обновить историю инвентаризаций
 * 
 * @param {Array} sessions - Массив сессий
 */
function updateInventoryHistory(sessions) {
  // Здесь можно обновить список истории на странице
  console.log('Обновление истории:', sessions);
}

/**
 * Инициализация страницы списка товаров
 */
async function initItemsPage() {
  try {
    // Загружаем товары
    const allItems = await items.getAllItems();
    
    // Отображаем товары
    renderItemsList(allItems);
    
    // Настраиваем поиск
    const searchInput = document.querySelector('input[type="search"], input[placeholder*="Поиск"]');
    if (searchInput) {
      searchInput.addEventListener('input', async (e) => {
        const query = e.target.value;
        if (query.trim()) {
          const results = await items.searchItems(query);
          renderItemsList(results);
        } else {
          renderItemsList(allItems);
        }
      });
    }
    
    // Настраиваем фильтры по категориям
    const categoryButtons = document.querySelectorAll('[data-category]');
    categoryButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const category = button.getAttribute('data-category');
        if (category === 'all') {
          renderItemsList(allItems);
        } else {
          const filtered = await items.getItemsByCategory(category);
          renderItemsList(filtered);
        }
      });
    });
    
    // Обработчик кнопки добавления товара
    const addButton = document.querySelector('[data-add-item]');
    if (addButton) {
      addButton.addEventListener('click', () => {
        // Можно открыть модальное окно или перейти на страницу создания
        console.log('Добавление нового товара');
      });
    }
  } catch (error) {
    console.error('Ошибка инициализации страницы товаров:', error);
  }
}

/**
 * Отобразить список товаров
 * 
 * @param {Array} itemsList - Массив товаров
 */
function renderItemsList(itemsList) {
  // Здесь можно обновить DOM для отображения списка товаров
  // Это зависит от структуры HTML
  console.log('Отображение списка товаров:', itemsList.length, 'товаров');
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
    
    // Отображаем товары для инвентаризации
    renderInventoryItems(allItems, inventoryItems, sessionId);
    
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
          navigateTo('inventory.html');
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
    
    // Отображаем детали товара
    renderItemDetails(item);
    
    // Обработчик кнопки редактирования
    const editButton = document.querySelector('[data-edit-item]');
    if (editButton) {
      editButton.addEventListener('click', () => {
        // Можно открыть форму редактирования
        console.log('Редактирование товара:', itemId);
      });
    }
  } catch (error) {
    console.error('Ошибка инициализации страницы деталей товара:', error);
  }
}

/**
 * Отобразить детали товара
 * 
 * @param {Object} item - Товар
 */
function renderItemDetails(item) {
  // Обновляем DOM с информацией о товаре
  console.log('Отображение деталей товара:', item);
}

/**
 * Инициализация страницы импорта товаров
 */
function initItemsImportPage() {
  // Здесь можно добавить логику для импорта из Excel/CSV
  console.log('Инициализация страницы импорта');
}

/**
 * Инициализация страницы истории инвентаризаций
 */
async function initInventoryHistoryPage() {
  try {
    const sessions = await inventory.getAllInventorySessions();
    const completedSessions = sessions
      .filter(s => s.status === 'completed')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    renderHistoryList(completedSessions);
  } catch (error) {
    console.error('Ошибка инициализации страницы истории:', error);
  }
}

/**
 * Отобразить список истории
 * 
 * @param {Array} sessions - Массив сессий
 */
function renderHistoryList(sessions) {
  // Обновляем DOM со списком истории
  console.log('Отображение истории:', sessions.length, 'сессий');
}

/**
 * Показать сообщение об ошибке
 * 
 * @param {string} message - Текст ошибки
 */
function showError(message) {
  console.error(message);
  // Здесь можно добавить отображение ошибки в UI
  alert('Ошибка: ' + message);
}

/**
 * Показать сообщение об успехе
 * 
 * @param {string} message - Текст сообщения
 */
function showSuccess(message) {
  console.log(message);
  // Здесь можно добавить отображение успешного сообщения в UI
}

// Инициализируем приложение при загрузке страницы
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Экспортируем функции для использования в других модулях
export { navigateTo, showError, showSuccess };

