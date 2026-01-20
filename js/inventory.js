/**
 * Логика работы с инвентаризацией
 * 
 * Этот файл содержит функции для создания сессий инвентаризации,
 * подсчета товаров и управления процессом инвентаризации.
 */

import * as db from './db.js';
import * as supabase from './supabase.js';
import * as items from './items.js';

/**
 * Генерировать уникальный ID
 * 
 * @returns {string} - UUID
 */
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Создать новую сессию инвентаризации
 * 
 * @param {Object} sessionData - Данные сессии
 * @param {string} sessionData.date - Дата инвентаризации (YYYY-MM-DD)
 * @param {string} sessionData.status - Статус (in_progress, completed, draft)
 * @returns {Promise<Object>} - Promise с созданной сессией
 */
export async function createInventorySession(sessionData) {
  const session = {
    id: generateId(),
    date: sessionData.date || new Date().toISOString().split('T')[0],
    status: sessionData.status || 'in_progress',
    items_count: 0
  };
  
  try {
    // Сохраняем локально
    const localSession = await db.addInventorySession(session);
    
    // Пытаемся синхронизировать с сервером
    try {
      const serverSession = await supabase.createInventorySession(session);
      await db.updateInventorySession(session.id, { ...serverSession, synced: true });
      return { ...serverSession, synced: true };
    } catch (syncError) {
      console.warn('Не удалось синхронизировать сессию с сервером:', syncError);
      return localSession;
    }
  } catch (error) {
    console.error('Ошибка создания сессии инвентаризации:', error);
    throw error;
  }
}

/**
 * Получить все сессии инвентаризации
 * 
 * @returns {Promise<Array>} - Promise с массивом сессий
 */
export async function getAllInventorySessions() {
  try {
    const localSessions = await db.getAllInventorySessions();
    
    try {
      const serverSessions = await supabase.fetchAllInventorySessions();
      
      // Объединяем данные
      const sessionsMap = new Map();
      
      serverSessions.forEach(session => {
        sessionsMap.set(session.id, { ...session, synced: true });
      });
      
      localSessions.forEach(session => {
        if (!sessionsMap.has(session.id)) {
          sessionsMap.set(session.id, session);
        }
      });
      
      // Обновляем локальную базу
      for (const session of serverSessions) {
        await db.updateInventorySession(session.id, { ...session, synced: true }).catch(() => {
          db.addInventorySession({ ...session, synced: true }).catch(() => {});
        });
      }
      
      return Array.from(sessionsMap.values());
    } catch (syncError) {
      console.warn('Не удалось получить сессии с сервера:', syncError);
      return localSessions;
    }
  } catch (error) {
    console.error('Ошибка получения сессий:', error);
    throw error;
  }
}

/**
 * Получить сессию по ID
 * 
 * @param {string} id - ID сессии
 * @returns {Promise<Object>} - Promise с сессией
 */
export async function getInventorySessionById(id) {
  try {
    let session = await db.getInventorySessionById(id);
    
    if (!session || !session.synced) {
      try {
        const serverSession = await supabase.fetchInventorySessionById(id);
        if (serverSession) {
          if (session) {
            await db.updateInventorySession(id, { ...serverSession, synced: true });
          } else {
            await db.addInventorySession({ ...serverSession, synced: true });
          }
          return { ...serverSession, synced: true };
        }
      } catch (syncError) {
        console.warn('Не удалось получить сессию с сервера:', syncError);
      }
    }
    
    return session;
  } catch (error) {
    console.error('Ошибка получения сессии:', error);
    throw error;
  }
}

/**
 * Получить данные для сравнения текущей инвентаризации с предыдущей
 *
 * Логика (простыми словами):
 * - Берем текущую сессию
 * - Находим последнюю ЗАВЕРШЕННУЮ сессию до неё
 * - Берем количества товаров из той сессии и возвращаем "словарь" { itemId: quantity }
 *
 * Это нужно, чтобы при новой инвентаризации автоматически подставлять "Прошлый: X"
 * и считать расхождения (разницу).
 *
 * @param {string} sessionId - ID текущей сессии
 * @returns {Promise<{previousSession: Object|null, previousQuantitiesByItemId: Object}>}
 */
export async function getPreviousSessionComparison(sessionId) {
  try {
    const currentSession = await getInventorySessionById(sessionId);
    const currentDate =
      (currentSession && currentSession.date) || new Date().toISOString().split('T')[0];

    // Получаем все сессии и находим "последнюю завершенную до текущей"
    const allSessions = await getAllInventorySessions();
    const normalizedCompletedStatuses = new Set(['completed', 'complete', 'done']);

    // В реальности пользователь может сделать 2 инвентаризации в один день.
    // Поэтому НЕ требуем строго s.date < currentDate. Берем самую последнюю completed,
    // исключая текущую сессию. Если даты равны — выбираем по updated_at/created_at.
    const candidateSessions =
      (allSessions || [])
        .filter(s => {
          if (!s || s.id === sessionId) return false;
          const status = String(s.status || '').trim().toLowerCase();
          if (!normalizedCompletedStatuses.has(status)) return false;
          return true;
        })
        .sort((a, b) => {
          // Сортируем по date DESC (если есть)
          const ad = String(a.date || '');
          const bd = String(b.date || '');
          if (ad && bd && ad !== bd) return ad < bd ? 1 : -1;

          // Если даты нет или равны — сортируем по updated_at/created_at DESC
          const aUpdated = String(a.updated_at || a.created_at || '');
          const bUpdated = String(b.updated_at || b.created_at || '');
          if (aUpdated && bUpdated && aUpdated !== bUpdated) return aUpdated < bUpdated ? 1 : -1;

          // Фолбэк: стабильный порядок
          return 0;
        });

    // Важно: иногда бывают "пустые" завершенные сессии (без сохраненных позиций).
    // Тогда "прошлый" будет всегда 0. Поэтому ищем последнюю завершенную сессию,
    // в которой реально есть хотя бы 1 запись inventory_items.
    let previousSession = null;
    let prevItems = [];

    for (const candidate of candidateSessions.slice(0, 20)) {
      const rows = await getInventoryItemsBySession(candidate.id);
      if (Array.isArray(rows) && rows.length > 0) {
        previousSession = candidate;
        prevItems = rows;
        break;
      }
    }

    // Если прошлой сессии нет — сравнивать не с чем
    if (!previousSession) {
      return { previousSession: null, previousQuantitiesByItemId: {} };
    }

    // Берем все записи прошлой сессии и строим map item_id -> quantity
    const previousQuantitiesByItemId = {};

    (prevItems || []).forEach(row => {
      if (!row || !row.item_id) return;
      const qty = typeof row.quantity === 'number' ? row.quantity : Number(row.quantity);
      previousQuantitiesByItemId[row.item_id] = Number.isFinite(qty) ? qty : 0;
    });

    return { previousSession, previousQuantitiesByItemId };
  } catch (error) {
    console.error('Ошибка подготовки сравнения с прошлой сессией:', error);
    return { previousSession: null, previousQuantitiesByItemId: {} };
  }
}

/**
 * Обновить сессию инвентаризации
 * 
 * @param {string} id - ID сессии
 * @param {Object} updates - Объект с изменениями
 * @returns {Promise<Object>} - Promise с обновленной сессией
 */
export async function updateInventorySession(id, updates) {
  try {
    const localSession = await db.updateInventorySession(id, updates);
    
    try {
      const serverSession = await supabase.updateInventorySession(id, updates);
      await db.updateInventorySession(id, { ...serverSession, synced: true });
      return { ...serverSession, synced: true };
    } catch (syncError) {
      console.warn('Не удалось синхронизировать обновление сессии:', syncError);
      return localSession;
    }
  } catch (error) {
    console.error('Ошибка обновления сессии:', error);
    throw error;
  }
}

/**
 * Завершить сессию инвентаризации
 * 
 * @param {string} id - ID сессии
 * @returns {Promise<Object>} - Promise с обновленной сессией
 */
export async function completeInventorySession(id) {
  return await updateInventorySession(id, {
    status: 'completed',
    updated_at: new Date().toISOString()
  });
}

/**
 * Добавить или обновить запись инвентаризации для товара
 * 
 * @param {string} sessionId - ID сессии
 * @param {string} itemId - ID товара
 * @param {number} quantity - Количество
 * @param {number} previousQuantity - Предыдущее количество (опционально)
 * @param {string} comment - Комментарий (опционально)
 * @returns {Promise<Object>} - Promise с записью инвентаризации
 */
export async function addOrUpdateInventoryItem(sessionId, itemId, quantity, previousQuantity = null, comment = null) {
  try {
    // Получаем существующие записи для этой сессии и товара
    const existingItems = await db.getInventoryItemsBySession(sessionId);
    const existingItem = existingItems.find(item => item.item_id === itemId);
    
    const inventoryItem = {
      id: existingItem ? existingItem.id : generateId(),
      session_id: sessionId,
      item_id: itemId,
      quantity: quantity,
      previous_quantity: previousQuantity,
      difference: previousQuantity !== null ? quantity - previousQuantity : null,
      comment: comment
    };
    
    if (existingItem) {
      // Обновляем существующую запись
      const localItem = await db.updateInventoryItem(existingItem.id, inventoryItem);
      
      try {
        const serverItem = await supabase.updateInventoryItem(existingItem.id, inventoryItem);
        await db.updateInventoryItem(existingItem.id, { ...serverItem, synced: true });
        return { ...serverItem, synced: true };
      } catch (syncError) {
        console.warn('Не удалось синхронизировать обновление записи:', syncError);
        return localItem;
      }
    } else {
      // Создаем новую запись
      const localItem = await db.addInventoryItem(inventoryItem);
      
      try {
        const serverItem = await supabase.createInventoryItem(inventoryItem);
        await db.updateInventoryItem(inventoryItem.id, { ...serverItem, synced: true });
        return { ...serverItem, synced: true };
      } catch (syncError) {
        // Тихо игнорируем ошибки синхронизации - товар сохранен локально
        // Синхронизация произойдет позже автоматически
        if (syncError.message && !syncError.message.includes('Таймаут')) {
          // Логируем только не-таймауты, чтобы не засорять консоль
        }
        return localItem;
      }
    }
  } catch (error) {
    console.error('Ошибка добавления записи инвентаризации:', error);
    throw error;
  }
}

/**
 * Получить все записи инвентаризации для сессии
 * 
 * @param {string} sessionId - ID сессии
 * @returns {Promise<Array>} - Promise с массивом записей
 */
export async function getInventoryItemsBySession(sessionId) {
  try {
    const localItems = await db.getInventoryItemsBySession(sessionId);
    
    try {
      const serverItems = await supabase.fetchInventoryItemsBySession(sessionId);
      
      // Объединяем данные
      const itemsMap = new Map();
      
      serverItems.forEach(item => {
        itemsMap.set(item.id, { ...item, synced: true });
      });
      
      localItems.forEach(item => {
        if (!itemsMap.has(item.id)) {
          itemsMap.set(item.id, item);
        }
      });
      
      // Обновляем локальную базу
      for (const item of serverItems) {
        await db.updateInventoryItem(item.id, { ...item, synced: true }).catch(() => {
          db.addInventoryItem({ ...item, synced: true }).catch(() => {});
        });
      }
      
      return Array.from(itemsMap.values());
    } catch (syncError) {
      console.warn('Не удалось получить записи с сервера:', syncError);
      return localItems;
    }
  } catch (error) {
    console.error('Ошибка получения записей инвентаризации:', error);
    throw error;
  }
}

/**
 * Получить статистику по сессии инвентаризации
 * 
 * @param {string} sessionId - ID сессии
 * @returns {Promise<Object>} - Promise со статистикой
 */
export async function getSessionStatistics(sessionId) {
  try {
    const items = await getInventoryItemsBySession(sessionId);
    
    const total = items.length;
    const withDifference = items.filter(item => item.difference !== null && item.difference !== 0).length;
    const positiveDifference = items.filter(item => item.difference !== null && item.difference > 0).length;
    const negativeDifference = items.filter(item => item.difference !== null && item.difference < 0).length;
    
    return {
      total,
      withDifference,
      positiveDifference,
      negativeDifference,
      noDifference: total - withDifference
    };
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    throw error;
  }
}

/**
 * Обновить количество обработанных товаров в сессии
 * 
 * @param {string} sessionId - ID сессии
 * @returns {Promise} - Promise с результатом операции
 */
export async function updateSessionItemsCount(sessionId) {
  try {
    const items = await getInventoryItemsBySession(sessionId);
    await updateInventorySession(sessionId, {
      items_count: items.length
    });
  } catch (error) {
    console.error('Ошибка обновления количества товаров:', error);
    throw error;
  }
}

/**
 * Создать отчет по инвентаризации
 * 
 * @param {string} sessionId - ID сессии
 * @returns {Promise<Object>} - Promise с созданным отчетом
 */
export async function createInventoryReport(sessionId) {
  try {
    // Получаем сессию
    const session = await getInventorySessionById(sessionId);
    if (!session) {
      throw new Error('Сессия не найдена');
    }
    
    // Получаем все записи инвентаризации для этой сессии
    const inventoryItems = await getInventoryItemsBySession(sessionId);
    const validInventoryItems = inventoryItems.filter(item => item && item.item_id);
    
    // Получаем все товары для расчета статистики
    const allItems = await items.getAllItems();
    
    // Вычисляем статистику
    const totalItems = validInventoryItems.length;
    const itemsWithDifference = validInventoryItems.filter(item => 
      item.difference !== null && item.difference !== 0
    ).length;
    const positiveDifference = validInventoryItems.filter(item => 
      item.difference !== null && item.difference > 0
    ).length;
    const negativeDifference = validInventoryItems.filter(item => 
      item.difference !== null && item.difference < 0
    ).length;
    
    // Создаем отчет
    const report = {
      id: generateId(),
      session_id: sessionId,
      date: session.date,
      total_items: totalItems,
      items_with_difference: itemsWithDifference,
      positive_difference: positiveDifference,
      negative_difference: negativeDifference,
      items: validInventoryItems.map(item => ({
        item_id: item.item_id,
        item_name: allItems.find(i => i.id === item.item_id)?.name || 'Неизвестный товар',
        quantity: item.quantity,
        previous_quantity: item.previous_quantity,
        difference: item.difference,
        comment: item.comment
      }))
    };
    
    // Сохраняем локально
    const localReport = await db.addInventoryReport(report);
    
    // Пытаемся синхронизировать с сервером
    try {
      const serverReport = await supabase.createInventoryReport(report);
      await db.updateInventoryReport(report.id, { ...serverReport, synced: true });
      return { ...serverReport, synced: true };
    } catch (syncError) {
      console.warn('Не удалось синхронизировать отчет с сервером:', syncError);
      return localReport;
    }
  } catch (error) {
    console.error('Ошибка создания отчета:', error);
    throw error;
  }
}

/**
 * Получить все отчеты инвентаризации
 * 
 * @returns {Promise<Array>} - Promise с массивом отчетов
 */
export async function getAllInventoryReports() {
  try {
    const localReports = await db.getAllInventoryReports();
    
    try {
      const serverReports = await supabase.fetchAllInventoryReports();
      
      // Объединяем данные
      const reportsMap = new Map();
      
      serverReports.forEach(report => {
        reportsMap.set(report.id, { ...report, synced: true });
      });
      
      localReports.forEach(report => {
        if (!reportsMap.has(report.id)) {
          reportsMap.set(report.id, report);
        }
      });
      
      // Обновляем локальную базу
      for (const report of serverReports) {
        await db.updateInventoryReport(report.id, { ...report, synced: true }).catch(() => {
          db.addInventoryReport({ ...report, synced: true }).catch(() => {});
        });
      }
      
      return Array.from(reportsMap.values());
    } catch (syncError) {
      console.warn('Не удалось получить отчеты с сервера:', syncError);
      return localReports;
    }
  } catch (error) {
    console.error('Ошибка получения отчетов:', error);
    throw error;
  }
}

/**
 * Получить отчет по ID
 * 
 * @param {string} id - ID отчета
 * @returns {Promise<Object>} - Promise с отчетом
 */
export async function getInventoryReportById(id) {
  try {
    let report = await db.getInventoryReportById(id);
    
    if (!report || !report.synced) {
      try {
        const serverReport = await supabase.fetchInventoryReportById(id);
        if (serverReport) {
          if (report) {
            await db.updateInventoryReport(id, { ...serverReport, synced: true });
          } else {
            await db.addInventoryReport({ ...serverReport, synced: true });
          }
          return { ...serverReport, synced: true };
        }
      } catch (syncError) {
        console.warn('Не удалось получить отчет с сервера:', syncError);
      }
    }
    
    return report;
  } catch (error) {
    console.error('Ошибка получения отчета:', error);
    throw error;
  }
}
