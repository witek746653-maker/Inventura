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
        
        if (item.id && item.id.startsWith('xxxxxxxx')) {
          // Это новый товар, создаем на сервере
          const serverItem = await supabase.createItem(itemToSend);
          await db.updateItem(item.id, { ...serverItem, synced: true });
          synced++;
        } else {
          // Проверяем, существует ли товар на сервере
          try {
            const existingItem = await supabase.fetchItemById(item.id);
            if (existingItem) {
              // Товар существует, обновляем
              const serverItem = await supabase.updateItem(item.id, itemToSend);
              await db.updateItem(item.id, { ...serverItem, synced: true });
            } else {
              // Товар не существует, создаем
              const serverItem = await supabase.createItem(itemToSend);
              await db.updateItem(item.id, { ...serverItem, synced: true });
            }
            synced++;
          } catch (error) {
            // Если товар не найден, создаем новый
            try {
              const serverItem = await supabase.createItem(itemToSend);
              await db.updateItem(item.id, { ...serverItem, synced: true });
              synced++;
            } catch (createError) {
              console.error('Ошибка создания товара на сервере:', createError);
              errors++;
            }
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
        
        try {
          const existingSession = await supabase.fetchInventorySessionById(session.id);
          if (existingSession) {
            const serverSession = await supabase.updateInventorySession(session.id, sessionToSend);
            await db.updateInventorySession(session.id, { ...serverSession, synced: true });
          } else {
            const serverSession = await supabase.createInventorySession(sessionToSend);
            await db.updateInventorySession(session.id, { ...serverSession, synced: true });
          }
          synced++;
        } catch (error) {
          try {
            const serverSession = await supabase.createInventorySession(sessionToSend);
            await db.updateInventorySession(session.id, { ...serverSession, synced: true });
            synced++;
          } catch (createError) {
            console.error('Ошибка создания сессии на сервере:', createError);
            errors++;
          }
        }
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
          await db.updateItem(item.id, { ...item, synced: true });
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
    
    console.log('Синхронизация завершена:', result);
    return result;
  } catch (error) {
    console.error('Ошибка полной синхронизации:', error);
    return { success: false, reason: 'error', error: error.message };
  }
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

