/**
 * Логика работы с товарами
 * 
 * Этот файл объединяет работу с локальной базой данных (IndexedDB)
 * и облачной базой (Supabase). Все операции сначала выполняются локально,
 * а затем синхронизируются с сервером.
 */

import * as db from './db.js';
import * as supabase from './supabase.js';
import { STORES } from './db.js';

/**
 * Генерировать уникальный ID для товара
 * 
 * @returns {string} - UUID в формате строки
 */
function generateId() {
  // Простая генерация UUID (для продакшена лучше использовать библиотеку)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Создать новый товар
 * 
 * @param {Object} itemData - Данные товара
 * @param {string} itemData.name - Название товара (обязательно)
 * @param {string} itemData.category - Категория
 * @param {string} itemData.unit - Единица измерения
 * @param {string} itemData.location - Место хранения
 * @param {string} itemData.image_url - URL изображения
 * @param {string} itemData.sku - Артикул
 * @param {string} itemData.description - Описание
 * @returns {Promise<Object>} - Promise с созданным товаром
 */
export async function createItem(itemData) {
  // Валидация обязательных полей
  if (!itemData.name || itemData.name.trim() === '') {
    throw new Error('Название товара обязательно');
  }
  
  // Создаем объект товара с ID
  const item = {
    id: generateId(),
    name: itemData.name.trim(),
    category: itemData.category || null,
    unit: itemData.unit || 'шт',
    location: itemData.location || null,
    image_url: itemData.image_url || null,
    sku: itemData.sku || null,
    description: itemData.description || null
  };
  
  try {
    // Сначала сохраняем локально
    const localItem = await db.addItem(item);
    
    // Пытаемся синхронизировать с сервером (если есть интернет)
    try {
      const serverItem = await supabase.createItem(item);
      // Обновляем локальную запись с данными с сервера
      await db.updateItem(item.id, { ...serverItem, synced: true });
      return { ...serverItem, synced: true };
    } catch (syncError) {
      // Если синхронизация не удалась, возвращаем локальную версию
      console.warn('Не удалось синхронизировать товар с сервером:', syncError);
      return localItem;
    }
  } catch (error) {
    console.error('Ошибка создания товара:', error);
    throw error;
  }
}

/**
 * Получить все товары
 * Сначала пытается получить с сервера, затем объединяет с локальными
 * 
 * @returns {Promise<Array>} - Promise с массивом товаров
 */
export async function getAllItems() {
  try {
    // Получаем локальные товары
    const localItems = await db.getAllItems();
    
    // Пытаемся получить товары с сервера (если есть интернет)
    try {
      const serverItems = await supabase.fetchAllItems();
      
      // Объединяем данные: приоритет у серверных данных
      const itemsMap = new Map();
      
      // Сначала добавляем серверные товары
      serverItems.forEach(item => {
        itemsMap.set(item.id, { ...item, synced: true });
      });
      
      // Затем добавляем локальные товары, которых нет на сервере
      localItems.forEach(item => {
        if (!itemsMap.has(item.id)) {
          itemsMap.set(item.id, item);
        }
      });
      
      // Обновляем локальную базу данными с сервера
      for (const item of serverItems) {
        await db.updateItem(item.id, { ...item, synced: true }).catch(() => {
          // Если товара нет локально, добавляем его
          db.addItem({ ...item, synced: true }).catch(() => {});
        });
      }
      
      return Array.from(itemsMap.values());
    } catch (syncError) {
      // Если синхронизация не удалась, возвращаем только локальные данные
      console.warn('Не удалось получить товары с сервера:', syncError);
      return localItems;
    }
  } catch (error) {
    console.error('Ошибка получения товаров:', error);
    throw error;
  }
}

/**
 * Получить товар по ID
 * 
 * @param {string} id - ID товара
 * @returns {Promise<Object>} - Promise с товаром
 */
export async function getItemById(id) {
  try {
    // Сначала проверяем локальную базу
    let item = await db.getItemById(id);
    
    // Если товар не найден локально или не синхронизирован, пытаемся получить с сервера
    if (!item || !item.synced) {
      try {
        const serverItem = await supabase.fetchItemById(id);
        if (serverItem) {
          // Сохраняем в локальную базу
          if (item) {
            await db.updateItem(id, { ...serverItem, synced: true });
          } else {
            await db.addItem({ ...serverItem, synced: true });
          }
          return { ...serverItem, synced: true };
        }
      } catch (syncError) {
        console.warn('Не удалось получить товар с сервера:', syncError);
      }
    }
    
    return item;
  } catch (error) {
    console.error('Ошибка получения товара:', error);
    throw error;
  }
}

/**
 * Обновить товар
 * 
 * @param {string} id - ID товара
 * @param {Object} updates - Объект с изменениями
 * @returns {Promise<Object>} - Promise с обновленным товаром
 */
export async function updateItem(id, updates) {
  try {
    // Обновляем локально
    const localItem = await db.updateItem(id, updates);
    
    // Пытаемся синхронизировать с сервером
    try {
      const serverItem = await supabase.updateItem(id, updates);
      // Обновляем локальную запись
      await db.updateItem(id, { ...serverItem, synced: true });
      return { ...serverItem, synced: true };
    } catch (syncError) {
      console.warn('Не удалось синхронизировать обновление с сервером:', syncError);
      return localItem;
    }
  } catch (error) {
    console.error('Ошибка обновления товара:', error);
    throw error;
  }
}

/**
 * Удалить товар
 * 
 * @param {string} id - ID товара
 * @returns {Promise} - Promise с результатом операции
 */
export async function deleteItem(id) {
  try {
    // Удаляем локально
    await db.deleteItem(id);
    
    // Пытаемся удалить с сервера
    try {
      await supabase.deleteItem(id);
    } catch (syncError) {
      console.warn('Не удалось удалить товар с сервера:', syncError);
      // В реальном приложении можно добавить в очередь на удаление
    }
    
    return true;
  } catch (error) {
    console.error('Ошибка удаления товара:', error);
    throw error;
  }
}

/**
 * Поиск товаров по названию
 * 
 * @param {string} query - Поисковый запрос
 * @returns {Promise<Array>} - Promise с массивом найденных товаров
 */
export async function searchItems(query) {
  try {
    const allItems = await getAllItems();
    const lowerQuery = query.toLowerCase().trim();
    
    if (!lowerQuery) {
      return allItems;
    }
    
    // Фильтруем товары по названию, категории, артикулу
    return allItems.filter(item => {
      const name = (item.name || '').toLowerCase();
      const category = (item.category || '').toLowerCase();
      const sku = (item.sku || '').toLowerCase();
      
      return name.includes(lowerQuery) || 
             category.includes(lowerQuery) || 
             sku.includes(lowerQuery);
    });
  } catch (error) {
    console.error('Ошибка поиска товаров:', error);
    throw error;
  }
}

/**
 * Получить товары по категории
 * 
 * @param {string} category - Название категории
 * @returns {Promise<Array>} - Promise с массивом товаров
 */
export async function getItemsByCategory(category) {
  try {
    const allItems = await getAllItems();
    return allItems.filter(item => item.category === category);
  } catch (error) {
    console.error('Ошибка получения товаров по категории:', error);
    throw error;
  }
}

/**
 * Получить товары по месту хранения
 * 
 * @param {string} location - Место хранения
 * @returns {Promise<Array>} - Promise с массивом товаров
 */
export async function getItemsByLocation(location) {
  try {
    const allItems = await getAllItems();
    return allItems.filter(item => item.location === location);
  } catch (error) {
    console.error('Ошибка получения товаров по месту хранения:', error);
    throw error;
  }
}

/**
 * Получить все категории
 * 
 * @returns {Promise<Array>} - Promise с массивом уникальных категорий
 */
export async function getAllCategories() {
  try {
    const allItems = await getAllItems();
    const categories = new Set();
    
    allItems.forEach(item => {
      if (item.category) {
        categories.add(item.category);
      }
    });
    
    return Array.from(categories).sort();
  } catch (error) {
    console.error('Ошибка получения категорий:', error);
    throw error;
  }
}

/**
 * Получить все места хранения
 * 
 * @returns {Promise<Array>} - Promise с массивом уникальных мест хранения
 */
export async function getAllLocations() {
  try {
    const allItems = await getAllItems();
    const locations = new Set();
    
    allItems.forEach(item => {
      if (item.location) {
        locations.add(item.location);
      }
    });
    
    return Array.from(locations).sort();
  } catch (error) {
    console.error('Ошибка получения мест хранения:', error);
    throw error;
  }
}

