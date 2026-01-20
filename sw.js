/**
 * Service Worker для PWA "Sabor de la Vida - Инвентаризация"
 * 
 * Что это такое:
 * Service Worker — это скрипт, который браузер запускает в фоновом режиме.
 * Он перехватывает сетевые запросы и может отдавать файлы из кэша,
 * даже когда нет интернета.
 */

// Версия кэша — меняйте при обновлении приложения, чтобы пользователи получили новые файлы
const CACHE_VERSION = 'v1.0.7';
const CACHE_NAME = `sabor-inventura-${CACHE_VERSION}`;

// Список файлов для кэширования (эти файлы будут доступны офлайн)
// Используем относительные пути для совместимости с GitHub Pages
const FILES_TO_CACHE = [
  './',
  './index.html',
  './inventory-history.html',
  './inventory-session.html',
  './item-details.html',
  './items-import.html',
  './items-management.html',
  './items.html',
  './assets/tailwind.css',
  './js/app.js',
  './js/db.js',
  './js/inventory-session.js',
  './js/inventory.js',
  './js/items.js',
  './js/supabase.js',
  './js/sync.js',
  './config/supabase-config.js',
  './assets/images/logo-sabor.png',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg',
  './manifest.json'
];

/**
 * Событие "install" — срабатывает при первой установке Service Worker
 * Здесь мы кэшируем все необходимые файлы
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Установка...');

  // Избегаем ожидания и сразу активируем новый воркер
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Кэширование файлов...');
        return cache.addAll(FILES_TO_CACHE);
      })
      .catch((error) => {
        console.error('[Service Worker] Ошибка кэширования:', error);
      })
  );
});

/**
 * Событие "activate" — срабатывает когда Service Worker становится активным
 * Здесь мы удаляем старые версии кэша
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Активация...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => {
              console.log('[Service Worker] Удаление старого кэша:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

/**
 * Событие "fetch" — срабатывает при каждом сетевом запросе
 * Стратегия: "Сначала сеть, потом кэш" (Network First)
 */
self.addEventListener('fetch', (event) => {
  // Игнорируем запросы не GET (например, POST для Supabase)
  if (event.request.method !== 'GET') return;

  // Пропускаем внешние запросы (кроме шрифтов)
  const isGoogleFont = event.request.url.includes('fonts.googleapis.com') ||
    event.request.url.includes('fonts.gstatic.com');

  const isInternal = event.request.url.startsWith(self.location.origin);

  if (!isInternal && !isGoogleFont) return;

  event.respondWith(
    // Пытаемся получить свежее из сети
    fetch(event.request)
      .then((networkResponse) => {
        // Если получили ответ 200 — сохраняем в кэш
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // ОШИБКА СЕТИ — ищем в кэше
        return caches.match(event.request, { ignoreSearch: true })
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }

            // Если это запрос страницы (HTML), но её нет в кэше — отдаем главную
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
          });
      })
  );
});


/**
 * Обработка push-уведомлений (на будущее)
 */
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'Новое уведомление',
      icon: './assets/icons/icon-192.svg',
      badge: './assets/icons/icon-192.svg',
      vibrate: [100, 50, 100],
      data: data.data || {}
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Инвентура', options)
    );
  }
});

/**
 * Обработка клика по уведомлению
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});

