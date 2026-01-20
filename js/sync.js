/**
 * Синхронизация данных между локальной базой и Supabase
 * 
 * Этот файл содержит функции для автоматической синхронизации данных:
 * - Отправка локальных изменений на сервер
 * - Получение обновлений с сервера
 * - Разрешение конфликтов
 */

import * as db from './db.js';
import * as supabase from './supabase.js';
import { STORES } from './db.js';

/**
 * Проверить наличие интернета
 * 
 * @returns {boolean} - true если есть интернет
 */
function isOnline() {
  return navigator.onLine;
}

/**
 * Синхронизировать все несинхронизированные товары
 * 
 * @returns {Promise<Object>} - Promise с результатом синхронизации
 */
export async function syncItems() {
  if (!isOnline()) {
    console.log('Нет интернета, синхронизация пропущена');
    return { success: false, reason: 'no_internet' };
  }

  try {
    // Получаем несинхронизированные товары
    const unsyncedItems = await db.getUnsyncedItems(STORES.ITEMS);

    let synced = 0;
    let errors = 0;

    for (const item of unsyncedItems) {
      try {
        const { synced: _, ...itemToSend } = item;

        // Проверяем, существует ли товар на сервере
        let existingItem = null;
        try {
          existingItem = await supabase.fetchItemById(item.id);
        } catch (fetchError) {
          // Если товар не найден (404), existingItem останется null
          // Если другая ошибка, логируем и продолжаем
          if (!fetchError.message || !fetchError.message.includes('404')) {
            console.warn('Ошибка проверки существования товара:', item.id, fetchError.message);
          }
        }

        if (existingItem) {
          // Товар существует на сервере, обновляем
          try {
            const serverItem = await supabase.updateItem(item.id, itemToSend);
            await db.updateItem(item.id, { ...serverItem, synced: true });
            synced++;
          } catch (updateError) {
            // Если обновление не удалось (например, товар удален), пытаемся создать
            if (updateError.message && updateError.message.includes('404')) {
              console.log('Товар не найден при обновлении, пытаемся создать:', item.id);
              try {
                // НЕ передаем ID при создании, чтобы сервер создал новый
                const { id: _, ...itemWithoutId } = itemToSend;
                const serverItem = await supabase.createItem(itemWithoutId);
                // Обновляем локальный ID на серверный
                await db.updateItem(item.id, { ...serverItem, synced: true });
                synced++;
              } catch (createError) {
                console.error('Ошибка создания товара на сервере:', createError);
                errors++;
              }
            } else {
              console.error('Ошибка обновления товара на сервере:', item.id, updateError);
              errors++;
            }
          }
        } else {
          // Товар не существует на сервере, создаем новый
          try {
            // Если ID похож на UUID и не начинается с 'xxxxxxxx', пытаемся создать с ID
            // Если получаем ошибку 409 (дубликат), создаем без ID
            let serverItem;
            try {
              serverItem = await supabase.createItem(itemToSend);
            } catch (createError) {
              // Если ошибка 409 (duplicate key), создаем без ID
              if (createError.message && createError.message.includes('duplicate key')) {
                console.log('Дубликат ID при создании товара, создаем без ID:', item.id);
                const { id: _, ...itemWithoutId } = itemToSend;
                serverItem = await supabase.createItem(itemWithoutId);
              } else {
                throw createError; // Пробрасываем другие ошибки
              }
            }

            // Если сервер вернул товар с другим ID, обновляем локальный ID
            if (serverItem && serverItem.id && serverItem.id !== item.id) {
              // Удаляем старую запись и создаем новую с серверным ID
              await db.deleteItem(item.id);
              await db.addItem({ ...serverItem, synced: true });
            } else {
              await db.updateItem(item.id, { ...serverItem, synced: true });
            }
            synced++;
          } catch (createError) {
            console.error('Ошибка создания товара на сервере:', item.id, createError);
            errors++;
          }
        }
      } catch (error) {
        console.error('Ошибка синхронизации товара:', item.id, error);
        errors++;
      }
    }

    return { success: true, synced, errors, total: unsyncedItems.length };
  } catch (error) {
    console.error('Ошибка синхронизации товаров:', error);
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Синхронизировать все несинхронизированные сессии инвентаризации
 * 
 * @returns {Promise<Object>} - Promise с результатом синхронизации
 */
export async function syncInventorySessions() {
  if (!isOnline()) {
    return { success: false, reason: 'no_internet' };
  }

  try {
    const unsyncedSessions = await db.getUnsyncedItems(STORES.INVENTORY_SESSIONS);

    let synced = 0;
    let errors = 0;

    for (const session of unsyncedSessions) {
      try {
        const { synced: _, ...sessionToSend } = session;

        let existingSession = null;
        try {
          existingSession = await supabase.fetchInventorySessionById(session.id);
        } catch (fError) {
          // Игнорируем ошибки поиска
        }

        if (existingSession) {
          const serverSession = await supabase.updateInventorySession(session.id, sessionToSend);
          await db.updateInventorySession(session.id, { ...serverSession, synced: true });
        } else {
          try {
            const serverSession = await supabase.createInventorySession(sessionToSend);
            await db.updateInventorySession(session.id, { ...serverSession, synced: true });
          } catch (createError) {
            // Если возникла ошибка дубликата, значит сессия уже есть - просто обновим её
            if (createError.message && (createError.message.includes('duplicate') || createError.message.includes('409'))) {
              const serverSession = await supabase.updateInventorySession(session.id, sessionToSend);
              await db.updateInventorySession(session.id, { ...serverSession, synced: true });
            } else {
              throw createError;
            }
          }
        }
        synced++;
      } catch (error) {
        console.error('Ошибка синхронизации сессии:', session.id, error);
        errors++;
      }
    }

    return { success: true, synced, errors, total: unsyncedSessions.length };
  } catch (error) {
    console.error('Ошибка синхронизации сессий:', error);
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Синхронизировать все несинхронизированные записи инвентаризации
 * 
 * @returns {Promise<Object>} - Promise с результатом синхронизации
 */
export async function syncInventoryItems() {
  if (!isOnline()) {
    return { success: false, reason: 'no_internet' };
  }

  try {
    const unsyncedItems = await db.getUnsyncedItems(STORES.INVENTORY_ITEMS);

    let synced = 0;
    let errors = 0;

    for (const item of unsyncedItems) {
      try {
        const { synced: _, ...itemToSend } = item;

        try {
          // Пытаемся обновить существующую запись
          const serverItem = await supabase.updateInventoryItem(item.id, itemToSend);
          await db.updateInventoryItem(item.id, { ...serverItem, synced: true });
          synced++;
        } catch (error) {
          // Если не получилось, создаем новую
          try {
            const serverItem = await supabase.createInventoryItem(itemToSend);
            await db.updateInventoryItem(item.id, { ...serverItem, synced: true });
            synced++;
          } catch (createError) {
            console.error('Ошибка создания записи на сервере:', createError);
            errors++;
          }
        }
      } catch (error) {
        console.error('Ошибка синхронизации записи:', item.id, error);
        errors++;
      }
    }

    return { success: true, synced, errors, total: unsyncedItems.length };
  } catch (error) {
    console.error('Ошибка синхронизации записей инвентаризации:', error);
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Получить все данные с сервера и обновить локальную базу
 * 
 * @returns {Promise<Object>} - Promise с результатом синхронизации
 */
export async function pullFromServer() {
  if (!isOnline()) {
    return { success: false, reason: 'no_internet' };
  }

  try {
    // Получаем товары с сервера
    const serverItems = await supabase.fetchAllItems();
    for (const item of serverItems) {
      try {
        const localItem = await db.getItemById(item.id);
        if (localItem) {
          // Если локальный товар не синхронизирован, не перезаписываем его серверной версией полностью,
          // чтобы не потерять локальные правки (например, current_quantity)
          if (localItem.synced === false) {
            console.log(`Пропуск обновления ${item.id} - есть несинхронизированные локальные изменения`);
            // Можно сделать merge: {...item, ...localItem, synced: false} если хотим обновить только новые поля
            await db.updateItem(item.id, { ...item, ...localItem, synced: false });
          } else {
            await db.updateItem(item.id, { ...item, synced: true });
          }
        } else {
          await db.addItem({ ...item, synced: true });
        }
      } catch (error) {
        console.error('Ошибка обновления товара из сервера:', error);
      }
    }

    // Получаем сессии с сервера
    const serverSessions = await supabase.fetchAllInventorySessions();
    for (const session of serverSessions) {
      try {
        const localSession = await db.getInventorySessionById(session.id);
        if (localSession) {
          await db.updateInventorySession(session.id, { ...session, synced: true });
        } else {
          await db.addInventorySession({ ...session, synced: true });
        }
      } catch (error) {
        console.error('Ошибка обновления сессии из сервера:', error);
      }
    }

    return { success: true, items: serverItems.length, sessions: serverSessions.length };
  } catch (error) {
    console.error('Ошибка получения данных с сервера:', error);
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Полная синхронизация: отправка локальных изменений и получение обновлений с сервера
 * 
 * @returns {Promise<Object>} - Promise с результатом синхронизации
 */
export async function fullSync() {
  if (!isOnline()) {
    updateLastSyncStatus(false, 'Нет подключения к интернету');
    return { success: false, reason: 'no_internet' };
  }

  console.log('Начало полной синхронизации...');

  try {
    // Сначала получаем данные с сервера
    const pullResult = await pullFromServer();

    // Затем отправляем локальные изменения
    const itemsResult = await syncItems();
    const sessionsResult = await syncInventorySessions();
    const inventoryItemsResult = await syncInventoryItems();

    const result = {
      success: true,
      pull: pullResult,
      push: {
        items: itemsResult,
        sessions: sessionsResult,
        inventoryItems: inventoryItemsResult
      }
    };

    // Сохраняем время последней синхронизации
    updateLastSyncStatus(true);

    console.log('Синхронизация завершена:', result);
    return result;
  } catch (error) {
    console.error('Ошибка полной синхронизации:', error);
    updateLastSyncStatus(false, error.message);
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Обновить статус последней синхронизации в локальном хранилище
 * 
 * @param {boolean} success - Была ли синхронизация успешной
 * @param {string} error - Сообщение об ошибке (если есть)
 */
function updateLastSyncStatus(success, error = null) {
  const syncInfo = {
    time: new Date().toISOString(),
    success,
    error
  };
  localStorage.setItem('last_sync_info', JSON.stringify(syncInfo));
}

/**
 * Автоматическая синхронизация при восстановлении интернета
 */
export function setupAutoSync() {
  // Синхронизируем при восстановлении интернета
  window.addEventListener('online', () => {
    console.log('Интернет восстановлен, запускаем синхронизацию...');
    fullSync().catch(error => {
      console.error('Ошибка автоматической синхронизации:', error);
    });
  });

  // Периодическая синхронизация каждые 5 минут (если есть интернет)
  setInterval(() => {
    if (isOnline()) {
      fullSync().catch(error => {
        console.error('Ошибка периодической синхронизации:', error);
      });
    }
  }, 5 * 60 * 1000); // 5 минут
}

/**
 * Получить статус синхронизации
 * 
 * @returns {Promise<Object>} - Promise со статусом синхронизации
 */
export async function getSyncStatus() {
  try {
    const unsyncedItems = await db.getUnsyncedItems(STORES.ITEMS);
    const unsyncedSessions = await db.getUnsyncedItems(STORES.INVENTORY_SESSIONS);
    const unsyncedInventoryItems = await db.getUnsyncedItems(STORES.INVENTORY_ITEMS);

    const totalUnsynced = unsyncedItems.length + unsyncedSessions.length + unsyncedInventoryItems.length;

    return {
      online: isOnline(),
      unsynced: {
        items: unsyncedItems.length,
        sessions: unsyncedSessions.length,
        inventoryItems: unsyncedInventoryItems.length,
        total: totalUnsynced
      },
      needsSync: totalUnsynced > 0
    };
  } catch (error) {
    console.error('Ошибка получения статуса синхронизации:', error);
    return {
      online: isOnline(),
      unsynced: { items: 0, sessions: 0, inventoryItems: 0, total: 0 },
      needsSync: false,
      error: error.message
    };
  }
}

