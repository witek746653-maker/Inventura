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
  'Authorization': `Bearer ${supabaseConfig.anonKey}`,
  'Prefer': 'return=representation'
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

    // Читаем ответ один раз (тело ответа можно прочитать только один раз!)
    const responseText = await response.text();

    if (!response.ok) {
      // Пытаемся прочитать ошибку из ответа
      let errorMessage = response.statusText;
      if (responseText && responseText.trim() !== '') {
        try {
          const error = JSON.parse(responseText);
          errorMessage = error.message || errorMessage;
        } catch (parseError) {
          // Если не удалось распарсить ошибку, используем текст ответа или статус
          errorMessage = responseText || `HTTP ${response.status}: ${response.statusText}`;
        }
      } else {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(`Ошибка создания товара: ${errorMessage}`);
    }

    // Проверяем, что ответ не пустой перед парсингом JSON
    if (!responseText || responseText.trim() === '') {
      console.warn('Сервер вернул пустой ответ. Возвращаем исходный товар.');
      // Возвращаем исходный товар, если сервер вернул пустой ответ
      return item;
    }

    try {
      const data = JSON.parse(responseText);
      return data[0] || data || item;
    } catch (jsonError) {
      console.error('Ошибка парсинга JSON ответа:', jsonError);
      console.error('Ответ сервера:', responseText);
      // Если не удалось распарсить, возвращаем исходный товар
      return item;
    }
  } catch (error) {
    // Если это ошибка сети или другая ошибка, логируем и пробрасываем
    if (error.message && error.message.includes('Ошибка создания товара')) {
      // Это уже обработанная ошибка от сервера
      throw error;
    }
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

    // Читаем ответ один раз (тело ответа можно прочитать только один раз!)
    const responseText = await response.text();

    if (!response.ok) {
      // Пытаемся прочитать ошибку из ответа
      let errorMessage = response.statusText;
      if (responseText && responseText.trim() !== '') {
        try {
          const error = JSON.parse(responseText);
          errorMessage = error.message || error.details || errorMessage;
        } catch (parseError) {
          // Если не удалось распарсить ошибку, используем текст ответа или статус
          errorMessage = responseText || `HTTP ${response.status}: ${response.statusText}`;
        }
      } else {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(`Ошибка обновления товара: ${errorMessage}`);
    }

    // Проверяем, что ответ не пустой перед парсингом JSON
    if (!responseText || responseText.trim() === '') {
      console.warn('Сервер вернул пустой ответ при обновлении. Возвращаем исходные данные.');
      // Возвращаем обновленные данные, если сервер вернул пустой ответ
      return { ...updates, id };
    }

    try {
      const data = JSON.parse(responseText);
      return data[0] || data || { ...updates, id };
    } catch (jsonError) {
      console.error('Ошибка парсинга JSON ответа при обновлении:', jsonError);
      console.error('Ответ сервера:', responseText);
      // Если не удалось распарсить, возвращаем обновленные данные
      return { ...updates, id };
    }
  } catch (error) {
    // Если это ошибка сети или другая ошибка, логируем и пробрасываем
    if (error.message && error.message.includes('Ошибка обновления товара')) {
      // Это уже обработанная ошибка от сервера
      throw error;
    }
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
      const errorData = await safeJsonParse(response.clone());
      throw new Error(`Ошибка создания сессии: ${errorData?.message || response.statusText}`);
    }

    const data = await safeJsonParse(response);
    return Array.isArray(data) ? (data[0] || sessionToSend) : (data || sessionToSend);
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
      const errorData = await safeJsonParse(response.clone());
      throw new Error(`Ошибка обновления сессии: ${errorData?.message || response.statusText}`);
    }

    const data = await safeJsonParse(response);
    return Array.isArray(data) ? (data[0] || { ...updates, id }) : (data || { ...updates, id });
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
 * Выполнить fetch с таймаутом
 * 
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции для fetch
 * @param {number} timeout - Таймаут в миллисекундах (по умолчанию 10000)
 * @returns {Promise<Response>} - Promise с ответом
 */
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Запрос превысил время ожидания');
    }
    throw error;
  }
}

/**
 * Безопасно парсить JSON из ответа
 * 
 * @param {Response} response - Ответ от сервера
 * @returns {Promise<any>} - Promise с распарсенными данными
 */
async function safeJsonParse(response) {
  const text = await response.text();
  if (!text || text.trim() === '') {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('Ошибка парсинга JSON:', error, 'Текст ответа:', text);
    throw new Error('Неверный формат ответа от сервера');
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

    const response = await fetchWithTimeout(`${API_URL}/inventory_items`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(itemToSend)
    }, 8000); // Таймаут 8 секунд

    if (!response.ok) {
      let errorMessage = `Ошибка создания записи: ${response.statusText}`;
      try {
        // Клонируем response для чтения ошибки
        const clonedResponse = response.clone();
        const errorData = await safeJsonParse(clonedResponse);
        if (errorData && errorData.message) {
          errorMessage = `Ошибка создания записи: ${errorData.message}`;
        }
      } catch (parseError) {
        // Игнорируем ошибку парсинга, используем стандартное сообщение
      }
      throw new Error(errorMessage);
    }

    const data = await safeJsonParse(response);
    if (!data) {
      // Если сервер вернул пустой ответ, возвращаем исходные данные
      return itemToSend;
    }

    return Array.isArray(data) ? (data[0] || itemToSend) : data;
  } catch (error) {
    // Не логируем ошибку здесь, чтобы не засорять консоль
    // Ошибка будет обработана в inventory.js
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

    const response = await fetchWithTimeout(`${API_URL}/inventory_items?id=eq.${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updatesToSend)
    }, 8000); // Таймаут 8 секунд

    if (!response.ok) {
      let errorMessage = `Ошибка обновления записи: ${response.statusText}`;
      try {
        // Клонируем response для чтения ошибки
        const clonedResponse = response.clone();
        const errorData = await safeJsonParse(clonedResponse);
        if (errorData && errorData.message) {
          errorMessage = `Ошибка обновления записи: ${errorData.message}`;
        }
      } catch (parseError) {
        // Игнорируем ошибку парсинга, используем стандартное сообщение
      }
      throw new Error(errorMessage);
    }

    const data = await safeJsonParse(response);
    if (!data) {
      // Если сервер вернул пустой ответ, возвращаем исходные данные
      return updatesToSend;
    }

    return Array.isArray(data) ? (data[0] || updatesToSend) : data;
  } catch (error) {
    console.error('Ошибка обновления записи на сервере:', error);
    throw error;
  }
}

/**
 * Проверить существование bucket в Supabase Storage
 * 
 * Проверка выполняется путем попытки загрузить тестовый файл.
 * Это более надежный способ, так как API для проверки bucket может требовать специальных прав.
 * 
 * @param {string} bucketName - Название bucket для проверки
 * @returns {Promise<boolean>} - true если bucket существует, false если нет
 */
export async function checkBucketExists(bucketName = 'item-images') {
  try {
    // Создаем маленький тестовый файл для проверки
    const testBlob = new Blob(['test'], { type: 'text/plain' });
    const testFileName = `__test_${Date.now()}.txt`;

    // Пытаемся загрузить тестовый файл
    const storageUrl = `${supabaseConfig.url}/storage/v1/object/${bucketName}/${testFileName}`;

    const response = await fetch(storageUrl, {
      method: 'POST',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`
      },
      body: testBlob
    });

    // Если загрузка успешна (200 или 201), bucket существует
    if (response.ok || response.status === 201) {
      // Удаляем тестовый файл (опционально, можно оставить)
      // Для простоты просто возвращаем true
      return true;
    }

    // Читаем текст ошибки для более точной диагностики
    const errorText = await response.text();
    let errorMessage = '';
    try {
      const error = JSON.parse(errorText);
      errorMessage = error.message || errorText;
    } catch (e) {
      errorMessage = errorText;
    }

    // Если ошибка связана с bucket (не найден), возвращаем false
    if (errorMessage.includes('Bucket not found') ||
      errorMessage.includes('bucket') ||
      response.status === 400 ||
      response.status === 404) {
      return false;
    }

    // Для других ошибок (например, проблемы с правами доступа) считаем, что bucket может существовать
    // но у нас нет прав для проверки - в этом случае попробуем загрузить реальные файлы
    console.warn('Не удалось проверить bucket через тестовую загрузку. Продолжаем попытку загрузки...');
    return true; // Предполагаем, что bucket существует, если ошибка не связана с bucket
  } catch (error) {
    // В случае ошибки сети, предполагаем что bucket может существовать
    // и попробуем загрузить реальные файлы
    console.warn('Ошибка проверки bucket:', error.message || error);
    return true; // Предполагаем, что bucket существует, чтобы попробовать загрузить
  }
}

/**
 * Загрузить файл в Supabase Storage
 * 
 * @param {File|Blob} file - Файл для загрузки
 * @param {string} bucketName - Название bucket (по умолчанию 'item-images')
 * @param {string} fileName - Имя файла для сохранения
 * @returns {Promise<string>} - Promise с публичным URL загруженного файла
 */
export async function uploadFileToStorage(file, bucketName = 'item-images', fileName = null) {
  try {
    // Генерируем имя файла, если не указано
    if (!fileName) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9);
      const extension = file.name ? file.name.split('.').pop() : 'png';
      fileName = `${timestamp}-${random}.${extension}`;
    }

    // ВАЖНО: Кодируем имя файла для URL, чтобы специальные символы (скобки, пробелы и т.д.) обрабатывались правильно
    const encodedFileName = encodeURIComponent(fileName);

    // URL для загрузки в Storage (используем закодированное имя файла)
    const storageUrl = `${supabaseConfig.url}/storage/v1/object/${bucketName}/${encodedFileName}`;

    // Заголовки для загрузки файла
    const uploadHeaders = {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      // НЕ добавляем Content-Type, браузер установит его автоматически
    };

    // Загружаем файл
    const response = await fetch(storageUrl, {
      method: 'POST',
      headers: uploadHeaders,
      body: file
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Ошибка загрузки файла: ${response.statusText}`;
      let parsedError = null;

      try {
        parsedError = JSON.parse(errorText);
        errorMessage = parsedError.message || parsedError.error || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }

      // Проверяем, не является ли ошибка тем, что файл уже существует
      const isDuplicate = parsedError && (
        parsedError.statusCode === '409' ||
        parsedError.error === 'Duplicate' ||
        errorMessage.includes('already exists') ||
        errorMessage.includes('Duplicate') ||
        errorMessage.includes('уже существует')
      );

      if (isDuplicate) {
        // Если файл уже существует, возвращаем его публичный URL
        // Это нормальная ситуация - файл уже загружен ранее
        const publicUrl = `${supabaseConfig.url}/storage/v1/object/public/${bucketName}/${encodedFileName}`;
        console.log(`ℹ️ Файл "${fileName}" уже существует в bucket. Используем существующий файл.`);
        return publicUrl;
      }

      // Логируем детали ошибки для отладки (только первую ошибку)
      if (!window._bucketErrorLogged) {
        window._bucketErrorLogged = true;
        console.error('Детали ошибки загрузки:');
        console.error('Статус:', response.status);
        console.error('Статус текст:', response.statusText);
        console.error('Ответ сервера:', errorText);
        console.error('Распарсенная ошибка:', parsedError);
        console.error('URL:', storageUrl);
      }

      // Если bucket не найден, даем понятное сообщение
      // НЕ проверяем response.status === 400, так как это может быть и другая ошибка
      const isBucketError = parsedError && (
        parsedError.message && (
          parsedError.message.toLowerCase().includes('bucket not found') ||
          parsedError.message.toLowerCase().includes('bucket') && parsedError.message.toLowerCase().includes('not found')
        )
      ) || (
          errorMessage.toLowerCase().includes('bucket not found') ||
          (errorMessage.toLowerCase().includes('bucket') && errorMessage.toLowerCase().includes('not found'))
        );

      if (isBucketError) {
        errorMessage = `Bucket "${bucketName}" не найден в Supabase Storage. ` +
          `Создайте bucket "${bucketName}" в Supabase Dashboard → Storage → New bucket. ` +
          `Убедитесь, что bucket публичный (Public bucket).`;
      }

      throw new Error(errorMessage);
    }

    // Получаем публичный URL загруженного файла (используем закодированное имя)
    const publicUrl = `${supabaseConfig.url}/storage/v1/object/public/${bucketName}/${encodedFileName}`;

    console.log(`✅ Файл загружен: ${fileName} -> ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    // Не логируем здесь, чтобы избежать дублирования - логирование будет в uploadExtractedImages
    throw error;
  }
}

/**
 * Преобразовать base64 строку в Blob
 * 
 * @param {string} base64String - Base64 строка изображения
 * @param {string} mimeType - MIME тип (например, 'image/png')
 * @returns {Blob} - Blob объект
 */
export function base64ToBlob(base64String, mimeType = 'image/png') {
  // Удаляем префикс data:image/...;base64, если есть
  const base64Data = base64String.includes(',')
    ? base64String.split(',')[1]
    : base64String;

  // Преобразуем base64 в бинарные данные
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);

  return new Blob([byteArray], { type: mimeType });
}

/**
 * Получить все отчеты инвентаризации с сервера
 * 
 * @returns {Promise<Array>} - Promise с массивом отчетов
 */
export async function fetchAllInventoryReports() {
  try {
    const response = await fetch(`${API_URL}/inventory_reports?order=created_at.desc`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!response.ok) {
      // Если таблица не создана в Supabase, API вернет 404.
      // Для приложения это не критично: просто считаем, что отчетов на сервере пока нет.
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Ошибка получения отчетов: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Ошибка получения отчетов с сервера:', error);
    throw error;
  }
}

/**
 * Получить отчет по ID с сервера
 * 
 * @param {string} id - ID отчета
 * @returns {Promise<Object>} - Promise с отчетом
 */
export async function fetchInventoryReportById(id) {
  try {
    const response = await fetch(`${API_URL}/inventory_reports?id=eq.${id}`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Ошибка получения отчета: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Ошибка получения отчета с сервера:', error);
    throw error;
  }
}

/**
 * Создать отчет инвентаризации на сервере
 * 
 * @param {Object} report - Объект отчета
 * @returns {Promise<Object>} - Promise с созданным отчетом
 */
export async function createInventoryReport(report) {
  try {
    const { synced, ...reportToSend } = report;

    const response = await fetch(`${API_URL}/inventory_reports`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(reportToSend)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Ошибка создания отчета: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return data[0] || data;
  } catch (error) {
    console.error('Ошибка создания отчета на сервере:', error);
    throw error;
  }
}

/**
 * Обновить отчет инвентаризации на сервере
 * 
 * @param {string} id - ID отчета
 * @param {Object} updates - Объект с изменениями
 * @returns {Promise<Object>} - Promise с обновленным отчетом
 */
export async function updateInventoryReport(id, updates) {
  try {
    const { synced, ...updatesToSend } = updates;

    const response = await fetch(`${API_URL}/inventory_reports?id=eq.${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updatesToSend)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Ошибка обновления отчета: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return data[0] || data;
  } catch (error) {
    console.error('Ошибка обновления отчета на сервере:', error);
    throw error;
  }
}

