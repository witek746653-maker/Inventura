/**
 * Работа с локальной базой данных IndexedDB
 * 
 * IndexedDB - это встроенная база данных в браузере, которая позволяет
 * хранить большие объемы данных локально. Данные сохраняются даже после
 * закрытия браузера.
 */

// Название базы данных
const DB_NAME = 'InventuraDB';
// Версия базы данных (увеличиваем при изменении структуры)
const DB_VERSION = 5;

// Названия хранилищ (таблиц) в базе данных
const STORES = {
  ITEMS: 'items',                    // Товары
  INVENTORY_SESSIONS: 'sessions',    // Сессии инвентаризации
  INVENTORY_ITEMS: 'inventory_items',  // Записи инвентаризации
  INVENTORY_REPORTS: 'inventory_reports'  // Отчеты инвентаризации
};

let db = null; // Переменная для хранения подключения к базе данных
let isDeleting = false; // Флаг для предотвращения бесконечной рекурсии при удалении базы

/**
 * Инициализация базы данных
 * Создает базу данных и хранилища, если их еще нет
 * 
 * @returns {Promise} - Promise, который разрешается когда база готова
 */
export async function initDB() {
  return new Promise((resolve, reject) => {
    // Сначала проверяем, не открыта ли база уже
    if (db) {
      // Если база уже открыта, проверяем её версию и наличие всех хранилищ
      if (db.version === DB_VERSION && db.objectStoreNames.contains(STORES.INVENTORY_REPORTS)) {
        resolve(db);
        return;
      } else {
        // Если версия не совпадает или отсутствует хранилище, закрываем и переоткрываем
        console.log('База данных требует обновления. Версия:', db.version, 'Требуется:', DB_VERSION);
        console.log('Хранилище отчетов:', db.objectStoreNames.contains(STORES.INVENTORY_REPORTS) ? 'есть' : 'отсутствует');
        db.close();
        db = null;
      }
    }

    // Функция для обработки ошибки версии
    // Автоматически удаляет базу и создает новую при конфликте версий
    const handleVersionError = () => {
      // Защита от бесконечной рекурсии
      if (isDeleting) {
        console.error('Попытка удаления базы уже выполняется. Ждем...');
        // Ждем и пробуем снова
        setTimeout(() => {
          initDB().then(resolve).catch(reject);
        }, 500);
        return;
      }

      isDeleting = true;
      console.warn('Обнаружен конфликт версий базы данных. Автоматически исправляем...');

      // Закрываем текущее подключение, если оно есть
      if (db) {
        db.close();
        db = null;
      }

      // Удаляем базу данных при конфликте версий
      const deleteRequest = indexedDB.deleteDatabase(DB_NAME);

      deleteRequest.onsuccess = () => {
        console.log('База данных удалена. Создаем новую с версией', DB_VERSION);
        isDeleting = false;
        // Небольшая задержка перед повторной попыткой
        setTimeout(() => {
          initDB().then(resolve).catch(reject);
        }, 100);
      };

      deleteRequest.onerror = (deleteEvent) => {
        const deleteError = deleteRequest.error || deleteEvent.target.error;
        console.error('Не удалось удалить базу данных:', deleteError);
        // Пытаемся еще раз через задержку
        setTimeout(() => {
          const retryDelete = indexedDB.deleteDatabase(DB_NAME);
          retryDelete.onsuccess = () => {
            isDeleting = false;
            setTimeout(() => {
              initDB().then(resolve).catch(reject);
            }, 100);
          };
          retryDelete.onerror = () => {
            isDeleting = false;
            reject(new Error('Не удалось удалить базу данных. Закройте другие вкладки и обновите страницу (Ctrl+R).'));
          };
        }, 500);
      };

      deleteRequest.onblocked = () => {
        console.warn('База данных заблокирована. Закройте другие вкладки и попробуйте снова.');
        // Пытаемся удалить через задержку
        setTimeout(() => {
          const retryDelete = indexedDB.deleteDatabase(DB_NAME);
          retryDelete.onsuccess = () => {
            console.log('База данных удалена после повторной попытки');
            isDeleting = false;
            setTimeout(() => {
              initDB().then(resolve).catch(reject);
            }, 100);
          };
          retryDelete.onerror = () => {
            isDeleting = false;
            reject(new Error('Не удалось удалить базу данных. Закройте другие вкладки и обновите страницу (Ctrl+R).'));
          };
        }, 1000);
      };
    };

    let request;
    try {
      // Открываем базу данных (создаст, если не существует)
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      // Если ошибка версии возникла сразу при вызове open()
      if (error && (error.name === 'VersionError' || error.message?.includes('version') || error.message?.includes('less than'))) {
        handleVersionError();
        return;
      }
      reject(error);
      return;
    }

    // Вызывается при ошибке
    request.onerror = (event) => {
      const error = request.error || event.target.error;
      console.error('Ошибка открытия базы данных:', error);

      // Если ошибка версии (запрашиваемая версия меньше существующей),
      // обрабатываем её специальным образом
      if (error && (error.name === 'VersionError' || error.message?.includes('version') || error.message?.includes('less than'))) {
        handleVersionError();
        return;
      }

      reject(error);
    };

    // Вызывается при успешном открытии
    request.onsuccess = () => {
      db = request.result;
      console.log('База данных успешно открыта');
      resolve(db);
    };

    // Вызывается при первом создании или обновлении версии
    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      try {
        // Создаем хранилище для товаров
        if (!database.objectStoreNames.contains(STORES.ITEMS)) {
          const itemsStore = database.createObjectStore(STORES.ITEMS, {
            keyPath: 'id',           // id будет ключом
            autoIncrement: false     // id генерируем сами
          });
          // Создаем индексы для быстрого поиска
          if (!itemsStore.indexNames.contains('category')) {
            itemsStore.createIndex('category', 'category', { unique: false });
          }
          if (!itemsStore.indexNames.contains('location')) {
            itemsStore.createIndex('location', 'location', { unique: false });
          }
          if (!itemsStore.indexNames.contains('name')) {
            itemsStore.createIndex('name', 'name', { unique: false });
          }
        }

        // Создаем хранилище для сессий инвентаризации
        if (!database.objectStoreNames.contains(STORES.INVENTORY_SESSIONS)) {
          const sessionsStore = database.createObjectStore(STORES.INVENTORY_SESSIONS, {
            keyPath: 'id',
            autoIncrement: false
          });
          if (!sessionsStore.indexNames.contains('date')) {
            sessionsStore.createIndex('date', 'date', { unique: false });
          }
          if (!sessionsStore.indexNames.contains('status')) {
            sessionsStore.createIndex('status', 'status', { unique: false });
          }
        }

        // Создаем хранилище для записей инвентаризации
        if (!database.objectStoreNames.contains(STORES.INVENTORY_ITEMS)) {
          const inventoryItemsStore = database.createObjectStore(STORES.INVENTORY_ITEMS, {
            keyPath: 'id',
            autoIncrement: false
          });
          if (!inventoryItemsStore.indexNames.contains('session_id')) {
            inventoryItemsStore.createIndex('session_id', 'session_id', { unique: false });
          }
          if (!inventoryItemsStore.indexNames.contains('item_id')) {
            inventoryItemsStore.createIndex('item_id', 'item_id', { unique: false });
          }
        }

        // Создаем хранилище для отчетов инвентаризации
        if (!database.objectStoreNames.contains(STORES.INVENTORY_REPORTS)) {
          const reportsStore = database.createObjectStore(STORES.INVENTORY_REPORTS, {
            keyPath: 'id',
            autoIncrement: false
          });
          if (!reportsStore.indexNames.contains('session_id')) {
            reportsStore.createIndex('session_id', 'session_id', { unique: false });
          }
          if (!reportsStore.indexNames.contains('date')) {
            reportsStore.createIndex('date', 'date', { unique: false });
          }
        }

        console.log('База данных создана/обновлена');
      } catch (upgradeError) {
        console.error('Ошибка при обновлении базы данных:', upgradeError);
        // Если ошибка при обновлении, отклоняем Promise
        reject(upgradeError);
      }
    };

    // Обработка ошибок при обновлении (дополнительная защита)
    request.onblocked = () => {
      console.warn('Обновление базы данных заблокировано. Закройте другие вкладки.');
    };
  });
}

/**
 * Получить подключение к базе данных
 * Если база еще не открыта, открывает ее
 * 
 * @returns {Promise<IDBDatabase>} - Promise с подключением к базе
 */
async function getDB() {
  if (db) {
    // Проверяем, что все необходимые хранилища существуют
    if (!db.objectStoreNames.contains(STORES.INVENTORY_REPORTS)) {
      // Если хранилища нет, нужно переоткрыть базу с обновлением версии
      console.warn('Хранилище отчетов не найдено. Версия БД:', db.version, 'Требуется:', DB_VERSION);
      console.warn('Переоткрываем базу данных для обновления...');
      db.close();
      db = null;
      // Небольшая задержка перед переоткрытием
      await new Promise(resolve => setTimeout(resolve, 100));
      return await initDB();
    }
    return db;
  }
  return await initDB();
}

/**
 * Добавить товар в локальную базу
 * 
 * @param {Object} item - Объект товара
 * @returns {Promise} - Promise с результатом операции
 */
export async function addItem(item) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.ITEMS], 'readwrite');
    const store = transaction.objectStore(STORES.ITEMS);

    // Добавляем метаданные
    const itemWithMeta = {
      ...item,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced: false // Флаг синхронизации с сервером
    };

    const request = store.add(itemWithMeta);

    request.onsuccess = () => {
      console.log('Товар добавлен локально:', itemWithMeta);
      resolve(itemWithMeta);
    };

    request.onerror = () => {
      console.error('Ошибка добавления товара:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Получить все товары из локальной базы
 * 
 * @returns {Promise<Array>} - Promise с массивом товаров
 */
export async function getAllItems() {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.ITEMS], 'readonly');
    const store = transaction.objectStore(STORES.ITEMS);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('Ошибка получения товаров:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Получить товар по ID
 * 
 * @param {string} id - ID товара
 * @returns {Promise<Object>} - Promise с товаром
 */
export async function getItemById(id) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.ITEMS], 'readonly');
    const store = transaction.objectStore(STORES.ITEMS);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('Ошибка получения товара:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Обновить товар в локальной базе
 * 
 * @param {string} id - ID товара
 * @param {Object} updates - Объект с изменениями
 * @returns {Promise} - Promise с результатом операции
 */
export async function updateItem(id, updates) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.ITEMS], 'readwrite');
    const store = transaction.objectStore(STORES.ITEMS);

    // Сначала получаем существующий товар
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const item = getRequest.result;
      if (!item) {
        reject(new Error('Товар не найден'));
        return;
      }

      // Обновляем данные
      const updatedItem = {
        ...item,
        ...updates,
        updated_at: new Date().toISOString(),
        synced: false // Помечаем как не синхронизированный
      };

      const putRequest = store.put(updatedItem);

      putRequest.onsuccess = () => {
        console.log('Товар обновлен локально:', updatedItem);
        resolve(updatedItem);
      };

      putRequest.onerror = () => {
        console.error('Ошибка обновления товара:', putRequest.error);
        reject(putRequest.error);
      };
    };

    getRequest.onerror = () => {
      reject(getRequest.error);
    };
  });
}

/**
 * Удалить товар из локальной базы
 * 
 * @param {string} id - ID товара
 * @returns {Promise} - Promise с результатом операции
 */
export async function deleteItem(id) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.ITEMS], 'readwrite');
    const store = transaction.objectStore(STORES.ITEMS);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log('Товар удален локально:', id);
      resolve();
    };

    request.onerror = () => {
      console.error('Ошибка удаления товара:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Добавить сессию инвентаризации
 * 
 * @param {Object} session - Объект сессии
 * @returns {Promise} - Promise с результатом операции
 */
export async function addInventorySession(session) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.INVENTORY_SESSIONS], 'readwrite');
    const store = transaction.objectStore(STORES.INVENTORY_SESSIONS);

    const sessionWithMeta = {
      ...session,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced: false
    };

    const request = store.add(sessionWithMeta);

    request.onsuccess = () => {
      console.log('Сессия добавлена локально:', sessionWithMeta);
      resolve(sessionWithMeta);
    };

    request.onerror = () => {
      console.error('Ошибка добавления сессии:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Получить все сессии инвентаризации
 * 
 * @returns {Promise<Array>} - Promise с массивом сессий
 */
export async function getAllInventorySessions() {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.INVENTORY_SESSIONS], 'readonly');
    const store = transaction.objectStore(STORES.INVENTORY_SESSIONS);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('Ошибка получения сессий:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Получить сессию по ID
 * 
 * @param {string} id - ID сессии
 * @returns {Promise<Object>} - Promise с сессией
 */
export async function getInventorySessionById(id) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.INVENTORY_SESSIONS], 'readonly');
    const store = transaction.objectStore(STORES.INVENTORY_SESSIONS);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('Ошибка получения сессии:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Обновить сессию инвентаризации
 * 
 * @param {string} id - ID сессии
 * @param {Object} updates - Объект с изменениями
 * @returns {Promise} - Promise с результатом операции
 */
export async function updateInventorySession(id, updates) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.INVENTORY_SESSIONS], 'readwrite');
    const store = transaction.objectStore(STORES.INVENTORY_SESSIONS);

    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const session = getRequest.result;
      if (!session) {
        reject(new Error('Сессия не найдена'));
        return;
      }

      const updatedSession = {
        ...session,
        ...updates,
        updated_at: new Date().toISOString(),
        synced: false
      };

      const putRequest = store.put(updatedSession);

      putRequest.onsuccess = () => {
        console.log('Сессия обновлена локально:', updatedSession);
        resolve(updatedSession);
      };

      putRequest.onerror = () => {
        reject(putRequest.error);
      };
    };

    getRequest.onerror = () => {
      reject(getRequest.error);
    };
  });
}

/**
 * Добавить запись инвентаризации
 * 
 * @param {Object} inventoryItem - Объект записи инвентаризации
 * @returns {Promise} - Promise с результатом операции
 */
export async function addInventoryItem(inventoryItem) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.INVENTORY_ITEMS], 'readwrite');
    const store = transaction.objectStore(STORES.INVENTORY_ITEMS);

    const itemWithMeta = {
      ...inventoryItem,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced: false
    };

    const request = store.add(itemWithMeta);

    request.onsuccess = () => {
      console.log('Запись инвентаризации добавлена локально:', itemWithMeta);
      resolve(itemWithMeta);
    };

    request.onerror = () => {
      console.error('Ошибка добавления записи:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Получить все записи инвентаризации для сессии
 * 
 * @param {string} sessionId - ID сессии
 * @returns {Promise<Array>} - Promise с массивом записей
 */
export async function getInventoryItemsBySession(sessionId) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.INVENTORY_ITEMS], 'readonly');
    const store = transaction.objectStore(STORES.INVENTORY_ITEMS);
    const index = store.index('session_id');
    const request = index.getAll(sessionId);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('Ошибка получения записей:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Обновить запись инвентаризации
 * 
 * @param {string} id - ID записи
 * @param {Object} updates - Объект с изменениями
 * @returns {Promise} - Promise с результатом операции
 */
export async function updateInventoryItem(id, updates) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.INVENTORY_ITEMS], 'readwrite');
    const store = transaction.objectStore(STORES.INVENTORY_ITEMS);

    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const item = getRequest.result;
      if (!item) {
        reject(new Error('Запись не найдена'));
        return;
      }

      const updatedItem = {
        ...item,
        ...updates,
        updated_at: new Date().toISOString(),
        synced: false
      };

      const putRequest = store.put(updatedItem);

      putRequest.onsuccess = () => {
        console.log('Запись обновлена локально:', updatedItem);
        resolve(updatedItem);
      };

      putRequest.onerror = () => {
        reject(putRequest.error);
      };
    };

    getRequest.onerror = () => {
      reject(getRequest.error);
    };
  });
}

/**
 * Получить все несинхронизированные записи
 * Используется для синхронизации с сервером
 * 
 * @param {string} storeName - Название хранилища
 * @returns {Promise<Array>} - Promise с массивом несинхронизированных записей
 */
export async function getUnsyncedItems(storeName) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => {
      // Фильтруем только несинхронизированные записи
      const unsynced = request.result.filter(item => !item.synced);
      resolve(unsynced);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Пометить запись как синхронизированную
 * 
 * @param {string} storeName - Название хранилища
 * @param {string} id - ID записи
 * @returns {Promise} - Promise с результатом операции
 */
export async function markAsSynced(storeName, id) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const item = getRequest.result;
      if (!item) {
        reject(new Error('Запись не найдена'));
        return;
      }

      item.synced = true;
      const putRequest = store.put(item);

      putRequest.onsuccess = () => {
        resolve();
      };

      putRequest.onerror = () => {
        reject(putRequest.error);
      };
    };

    getRequest.onerror = () => {
      reject(getRequest.error);
    };
  });
}

/**
 * Добавить отчет инвентаризации
 * 
 * @param {Object} report - Объект отчета
 * @returns {Promise} - Promise с результатом операции
 */
export async function addInventoryReport(report) {
  let database = await getDB();

  // Проверяем существование хранилища
  if (!database.objectStoreNames.contains(STORES.INVENTORY_REPORTS)) {
    console.error('Хранилище отчетов не найдено в базе данных!');
    console.error('Попытка переоткрытия базы...');
    db = null;
    database = await initDB();

    if (!database.objectStoreNames.contains(STORES.INVENTORY_REPORTS)) {
      const error = new Error('Хранилище отчетов не может быть создано. Пожалуйста, обновите страницу (Ctrl+R или F5) для обновления базы данных.');
      console.error(error.message);
      throw error;
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction([STORES.INVENTORY_REPORTS], 'readwrite');
      const store = transaction.objectStore(STORES.INVENTORY_REPORTS);

      const reportWithMeta = {
        ...report,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        synced: false
      };

      const request = store.add(reportWithMeta);

      request.onsuccess = () => {
        console.log('Отчет добавлен локально:', reportWithMeta);
        resolve(reportWithMeta);
      };

      request.onerror = () => {
        console.error('Ошибка добавления отчета:', request.error);
        reject(request.error);
      };
    } catch (error) {
      console.error('Ошибка при создании транзакции для отчета:', error);
      reject(error);
    }
  });
}

/**
 * Получить все отчеты инвентаризации
 * 
 * @returns {Promise<Array>} - Promise с массивом отчетов
 */
export async function getAllInventoryReports() {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.INVENTORY_REPORTS], 'readonly');
    const store = transaction.objectStore(STORES.INVENTORY_REPORTS);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('Ошибка получения отчетов:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Получить отчет по ID
 * 
 * @param {string} id - ID отчета
 * @returns {Promise<Object>} - Promise с отчетом
 */
export async function getInventoryReportById(id) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.INVENTORY_REPORTS], 'readonly');
    const store = transaction.objectStore(STORES.INVENTORY_REPORTS);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('Ошибка получения отчета:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Получить отчет по ID сессии
 * 
 * @param {string} sessionId - ID сессии
 * @returns {Promise<Object>} - Promise с отчетом
 */
export async function getInventoryReportBySessionId(sessionId) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.INVENTORY_REPORTS], 'readonly');
    const store = transaction.objectStore(STORES.INVENTORY_REPORTS);
    const index = store.index('session_id');
    const request = index.get(sessionId);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('Ошибка получения отчета по сессии:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Обновить отчет инвентаризации
 * 
 * @param {string} id - ID отчета
 * @param {Object} updates - Объект с изменениями
 * @returns {Promise} - Promise с результатом операции
 */
export async function updateInventoryReport(id, updates) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.INVENTORY_REPORTS], 'readwrite');
    const store = transaction.objectStore(STORES.INVENTORY_REPORTS);

    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const report = getRequest.result;
      if (!report) {
        reject(new Error('Отчет не найден'));
        return;
      }

      const updatedReport = {
        ...report,
        ...updates,
        updated_at: new Date().toISOString(),
        synced: false
      };

      const putRequest = store.put(updatedReport);

      putRequest.onsuccess = () => {
        console.log('Отчет обновлен локально:', updatedReport);
        resolve(updatedReport);
      };

      putRequest.onerror = () => {
        reject(putRequest.error);
      };
    };

    getRequest.onerror = () => {
      reject(getRequest.error);
    };
  });
}

// Экспортируем названия хранилищ для использования в других файлах

/**
 * Удалить сессию инвентаризации
 * 
 * @param {string} id - ID сессии
 * @returns {Promise} - Promise с результатом операции
 */
export async function deleteInventorySession(id) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.INVENTORY_SESSIONS], 'readwrite');
    const store = transaction.objectStore(STORES.INVENTORY_SESSIONS);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log('Сессия удалена локально:', id);
      resolve();
    };

    request.onerror = () => {
      console.error('Ошибка удаления сессии:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Удалить все записи инвентаризации для сессии
 * 
 * @param {string} sessionId - ID сессии
 * @returns {Promise} - Promise с результатом операции
 */
export async function deleteInventoryItemsBySession(sessionId) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.INVENTORY_ITEMS], 'readwrite');
    const store = transaction.objectStore(STORES.INVENTORY_ITEMS);
    const index = store.index('session_id');
    const request = index.getAllKeys(sessionId);

    request.onsuccess = () => {
      const keys = request.result;
      if (keys.length === 0) {
        resolve();
        return;
      }

      let completed = 0;
      let errors = 0;

      // Создаем новую транзакцию для удаления, чтобы не блокировать
      const deleteTransaction = database.transaction([STORES.INVENTORY_ITEMS], 'readwrite');
      const deleteStore = deleteTransaction.objectStore(STORES.INVENTORY_ITEMS);

      deleteTransaction.oncomplete = () => {
        console.log(`Удалено ${completed} записей инвентаризации локально`);
        resolve();
      };

      deleteTransaction.onerror = () => {
        reject(deleteTransaction.error);
      };

      keys.forEach(key => {
        deleteStore.delete(key);
        completed++;
      });
    };

    request.onerror = () => {
      console.error('Ошибка поиска записей для удаления:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Удалить отчет инвентаризации
 * 
 * @param {string} id - ID отчета
 * @returns {Promise} - Promise с результатом операции
 */
export async function deleteInventoryReport(id) {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.INVENTORY_REPORTS], 'readwrite');
    const store = transaction.objectStore(STORES.INVENTORY_REPORTS);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log('Отчет удален локально:', id);
      resolve();
    };

    request.onerror = () => {
      console.error('Ошибка удаления отчета:', request.error);
      reject(request.error);
    };
  });
}

export { STORES };

