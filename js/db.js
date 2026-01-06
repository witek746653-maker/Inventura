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
const DB_VERSION = 1;

// Названия хранилищ (таблиц) в базе данных
const STORES = {
  ITEMS: 'items',                    // Товары
  INVENTORY_SESSIONS: 'sessions',    // Сессии инвентаризации
  INVENTORY_ITEMS: 'inventory_items'  // Записи инвентаризации
};

let db = null; // Переменная для хранения подключения к базе данных

/**
 * Инициализация базы данных
 * Создает базу данных и хранилища, если их еще нет
 * 
 * @returns {Promise} - Promise, который разрешается когда база готова
 */
export async function initDB() {
  return new Promise((resolve, reject) => {
    // Открываем базу данных (создаст, если не существует)
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Вызывается при ошибке
    request.onerror = () => {
      console.error('Ошибка открытия базы данных:', request.error);
      reject(request.error);
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

      // Создаем хранилище для товаров
      if (!database.objectStoreNames.contains(STORES.ITEMS)) {
        const itemsStore = database.createObjectStore(STORES.ITEMS, {
          keyPath: 'id',           // id будет ключом
          autoIncrement: false     // id генерируем сами
        });
        // Создаем индексы для быстрого поиска
        itemsStore.createIndex('category', 'category', { unique: false });
        itemsStore.createIndex('location', 'location', { unique: false });
        itemsStore.createIndex('name', 'name', { unique: false });
      }

      // Создаем хранилище для сессий инвентаризации
      if (!database.objectStoreNames.contains(STORES.INVENTORY_SESSIONS)) {
        const sessionsStore = database.createObjectStore(STORES.INVENTORY_SESSIONS, {
          keyPath: 'id',
          autoIncrement: false
        });
        sessionsStore.createIndex('date', 'date', { unique: false });
        sessionsStore.createIndex('status', 'status', { unique: false });
      }

      // Создаем хранилище для записей инвентаризации
      if (!database.objectStoreNames.contains(STORES.INVENTORY_ITEMS)) {
        const inventoryItemsStore = database.createObjectStore(STORES.INVENTORY_ITEMS, {
          keyPath: 'id',
          autoIncrement: false
        });
        inventoryItemsStore.createIndex('session_id', 'session_id', { unique: false });
        inventoryItemsStore.createIndex('item_id', 'item_id', { unique: false });
      }

      console.log('База данных создана/обновлена');
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

// Экспортируем названия хранилищ для использования в других файлах
export { STORES };

