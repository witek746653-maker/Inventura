/**
 * Работа с Supabase (облачная база данных)
 * 
 * Supabase - это готовое решение для базы данных, которое работает через REST API.
 * Мы отправляем HTTP запросы для получения и сохранения данных на сервере.
 */

import { supabaseConfig } from '../config/supabase-config.js';

// Базовый URL для API запросов
const API_URL = `${supabaseConfig.url}/rest/v1`;

// Заголовки для всех запросов
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'apikey': supabaseConfig.anonKey,
  'Authorization': `Bearer ${supabaseConfig.anonKey}`
});

/**
 * Проверить подключение к Supabase
 * 
 * @returns {Promise<boolean>} - true если подключение успешно
 */
export async function checkConnection() {
  try {
    const response = await fetch(`${API_URL}/items?limit=1`, {
      method: 'GET',
      headers: getHeaders()
    });
    
    return response.ok;
  } catch (error) {
    console.error('Ошибка подключения к Supabase:', error);
    return false;
  }
}

/**
 * Получить все товары с сервера
 * 
 * @returns {Promise<Array>} - Promise с массивом товаров
 */
export async function fetchAllItems() {
  try {
    const response = await fetch(`${API_URL}/items?order=created_at.desc`, {
      method: 'GET',
      headers: getHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка получения товаров: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка получения товаров с сервера:', error);
    throw error;
  }
}

/**
 * Получить товар по ID с сервера
 * 
 * @param {string} id - ID товара
 * @returns {Promise<Object>} - Promise с товаром
 */
export async function fetchItemById(id) {
  try {
    const response = await fetch(`${API_URL}/items?id=eq.${id}`, {
      method: 'GET',
      headers: getHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка получения товара: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data[0] || null;
  } catch (error) {
    console.error('Ошибка получения товара с сервера:', error);
    throw error;
  }
}

/**
 * Создать товар на сервере
 * 
 * @param {Object} item - Объект товара
 * @returns {Promise<Object>} - Promise с созданным товаром
 */
export async function createItem(item) {
  try {
    // Удаляем локальные поля перед отправкой
    const { synced, ...itemToSend } = item;
    
    const response = await fetch(`${API_URL}/items`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(itemToSend)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Ошибка создания товара: ${error.message || response.statusText}`);
    }
    
    const data = await response.json();
    return data[0] || data;
  } catch (error) {
    console.error('Ошибка создания товара на сервере:', error);
    throw error;
  }
}

/**
 * Обновить товар на сервере
 * 
 * @param {string} id - ID товара
 * @param {Object} updates - Объект с изменениями
 * @returns {Promise<Object>} - Promise с обновленным товаром
 */
export async function updateItem(id, updates) {
  try {
    // Удаляем локальные поля перед отправкой
    const { synced, ...updatesToSend } = updates;
    
    const response = await fetch(`${API_URL}/items?id=eq.${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updatesToSend)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Ошибка обновления товара: ${error.message || response.statusText}`);
    }
    
    const data = await response.json();
    return data[0] || data;
  } catch (error) {
    console.error('Ошибка обновления товара на сервере:', error);
    throw error;
  }
}

/**
 * Удалить товар с сервера
 * 
 * @param {string} id - ID товара
 * @returns {Promise} - Promise с результатом операции
 */
export async function deleteItem(id) {
  try {
    const response = await fetch(`${API_URL}/items?id=eq.${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка удаления товара: ${response.statusText}`);
    }
    
    return true;
  } catch (error) {
    console.error('Ошибка удаления товара с сервера:', error);
    throw error;
  }
}

/**
 * Получить все сессии инвентаризации с сервера
 * 
 * @returns {Promise<Array>} - Promise с массивом сессий
 */
export async function fetchAllInventorySessions() {
  try {
    const response = await fetch(`${API_URL}/inventory_sessions?order=date.desc`, {
      method: 'GET',
      headers: getHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка получения сессий: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка получения сессий с сервера:', error);
    throw error;
  }
}

/**
 * Получить сессию по ID с сервера
 * 
 * @param {string} id - ID сессии
 * @returns {Promise<Object>} - Promise с сессией
 */
export async function fetchInventorySessionById(id) {
  try {
    const response = await fetch(`${API_URL}/inventory_sessions?id=eq.${id}`, {
      method: 'GET',
      headers: getHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка получения сессии: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data[0] || null;
  } catch (error) {
    console.error('Ошибка получения сессии с сервера:', error);
    throw error;
  }
}

/**
 * Создать сессию инвентаризации на сервере
 * 
 * @param {Object} session - Объект сессии
 * @returns {Promise<Object>} - Promise с созданной сессией
 */
export async function createInventorySession(session) {
  try {
    const { synced, ...sessionToSend } = session;
    
    const response = await fetch(`${API_URL}/inventory_sessions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(sessionToSend)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Ошибка создания сессии: ${error.message || response.statusText}`);
    }
    
    const data = await response.json();
    return data[0] || data;
  } catch (error) {
    console.error('Ошибка создания сессии на сервере:', error);
    throw error;
  }
}

/**
 * Обновить сессию инвентаризации на сервере
 * 
 * @param {string} id - ID сессии
 * @param {Object} updates - Объект с изменениями
 * @returns {Promise<Object>} - Promise с обновленной сессией
 */
export async function updateInventorySession(id, updates) {
  try {
    const { synced, ...updatesToSend } = updates;
    
    const response = await fetch(`${API_URL}/inventory_sessions?id=eq.${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updatesToSend)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Ошибка обновления сессии: ${error.message || response.statusText}`);
    }
    
    const data = await response.json();
    return data[0] || data;
  } catch (error) {
    console.error('Ошибка обновления сессии на сервере:', error);
    throw error;
  }
}

/**
 * Получить все записи инвентаризации для сессии с сервера
 * 
 * @param {string} sessionId - ID сессии
 * @returns {Promise<Array>} - Promise с массивом записей
 */
export async function fetchInventoryItemsBySession(sessionId) {
  try {
    const response = await fetch(`${API_URL}/inventory_items?session_id=eq.${sessionId}`, {
      method: 'GET',
      headers: getHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка получения записей: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка получения записей с сервера:', error);
    throw error;
  }
}

/**
 * Создать запись инвентаризации на сервере
 * 
 * @param {Object} inventoryItem - Объект записи
 * @returns {Promise<Object>} - Promise с созданной записью
 */
export async function createInventoryItem(inventoryItem) {
  try {
    const { synced, ...itemToSend } = inventoryItem;
    
    const response = await fetch(`${API_URL}/inventory_items`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(itemToSend)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Ошибка создания записи: ${error.message || response.statusText}`);
    }
    
    const data = await response.json();
    return data[0] || data;
  } catch (error) {
    console.error('Ошибка создания записи на сервере:', error);
    throw error;
  }
}

/**
 * Обновить запись инвентаризации на сервере
 * 
 * @param {string} id - ID записи
 * @param {Object} updates - Объект с изменениями
 * @returns {Promise<Object>} - Promise с обновленной записью
 */
export async function updateInventoryItem(id, updates) {
  try {
    const { synced, ...updatesToSend } = updates;
    
    const response = await fetch(`${API_URL}/inventory_items?id=eq.${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updatesToSend)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Ошибка обновления записи: ${error.message || response.statusText}`);
    }
    
    const data = await response.json();
    return data[0] || data;
  } catch (error) {
    console.error('Ошибка обновления записи на сервере:', error);
    throw error;
  }
}

