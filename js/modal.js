/**
 * Модуль для управления модальными окнами
 * Заменяет стандартные alert и confirm
 */

let modalElement = null;
let titleElement = null;
let messageElement = null;
let buttonsContainer = null;
let resolvePromise = null;
let closeTimeout = null; // Таймер для плавного закрытия

/**
 * Инициализация модального окна (создание DOM элементов)
 */
function initModal() {
    if (modalElement) return;

    // HTML структура модального окна
    const modalHTML = `
    <div id="custom-modal" class="fixed inset-0 z-[100000] bg-black/70 backdrop-blur-sm hidden items-center justify-center opacity-0 transition-opacity duration-200 p-4" style="z-index: 100000;">
        <div class="bg-white dark:bg-surface-dark rounded-3xl p-4 w-full max-w-md shadow-2xl transform scale-95 transition-all duration-200 flex flex-col max-h-[90vh]">
            <h3 id="custom-modal-title" class="text-xl font-black text-slate-900 dark:text-white mb-3 leading-tight"></h3>
            <div id="custom-modal-message" class="text-[14px] text-slate-600 dark:text-slate-400 mb-4 leading-relaxed overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar"></div>
            <div id="custom-modal-buttons" class="flex flex-col gap-2 mt-auto">
                <!-- Кнопки будут добавлены динамически -->
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    modalElement = document.getElementById('custom-modal');
    titleElement = document.getElementById('custom-modal-title');
    messageElement = document.getElementById('custom-modal-message');
    buttonsContainer = document.getElementById('custom-modal-buttons');
}

/**
 * Показать модальное окно
 * @param {Object} options - Параметры окна
 * @param {string} options.title - Заголовок
 * @param {string} options.message - Текст сообщения
 * @param {Array} options.buttons - Массив кнопок [{text, primary, onClick}]
 */
export function showModal({ title, message, buttons = [] }) {
    // Если планировалось закрытие — отменяем его
    if (closeTimeout) {
        clearTimeout(closeTimeout);
        closeTimeout = null;
    }

    initModal();

    // Установка текста
    titleElement.textContent = title;
    // Поддержка переносов строк
    messageElement.innerHTML = message;

    // Очистка кнопок
    buttonsContainer.innerHTML = '';

    // Определяем расположение кнопок: 1-2 кнопки — в ряд, 3 и более — в колонку
    if (buttons.length <= 2) {
        buttonsContainer.className = "flex gap-3";
    } else {
        buttonsContainer.className = "flex flex-col gap-2";
    }

    // Создание кнопок
    buttons.forEach((btn) => {
        const button = document.createElement('button');
        button.textContent = btn.text;

        // Стилизация кнопок
        const baseClasses = "flex-1 py-3 px-4 rounded-xl font-bold active:scale-95 transition-all text-sm";
        const primaryClasses = "bg-primary text-white hover:bg-blue-600 shadow-md shadow-blue-500/20";
        const secondaryClasses = "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600";
        const dangerClasses = "bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-500/20";

        button.className = `${baseClasses} ${btn.danger ? dangerClasses : (btn.primary ? primaryClasses : secondaryClasses)}`;

        button.onclick = async () => {
            // Если есть действие — выполняем его и ждем (важно для navigator.share и алертов)
            if (btn.onClick) {
                await btn.onClick();
            }

            // Если после выполнения действия заголовок не изменился, значит новое окно не открылось поверх — тогда закрываем
            if (titleElement.textContent === title) {
                closeModal();
            }
        };

        buttonsContainer.appendChild(button);
    });

    // Показать окно с анимацией
    const isAlreadyVisible = !modalElement.classList.contains('hidden') && !modalElement.classList.contains('opacity-0');

    modalElement.classList.remove('hidden');
    modalElement.classList.add('flex');

    if (!isAlreadyVisible) {
        // Небольшая задержка для плавного появления, если оно было скрыто
        requestAnimationFrame(() => {
            modalElement.classList.remove('opacity-0');
            modalElement.querySelector('div').classList.remove('scale-95');
            modalElement.querySelector('div').classList.add('scale-100');
        });
    } else {
        // Если окно уже было на экране (переход), просто сбрасываем стили если они вдруг были в процессе исчезновения
        modalElement.classList.remove('opacity-0');
        modalElement.querySelector('div').classList.remove('scale-95');
        modalElement.querySelector('div').classList.add('scale-100');
    }
}

/**
 * Закрыть модальное окно
 */
export function closeModal() {
    if (!modalElement || modalElement.classList.contains('hidden')) return;

    modalElement.classList.add('opacity-0');
    modalElement.querySelector('div').classList.remove('scale-100');
    modalElement.querySelector('div').classList.add('scale-95');

    closeTimeout = setTimeout(() => {
        modalElement.classList.add('hidden');
        modalElement.classList.remove('flex');
        closeTimeout = null;
    }, 200);
}

/**
 * Показать подтверждение (аналог confirm)
 * @param {string} message - Сообщение
 * @param {string} title - Заголовок (опционально)
 * @returns {Promise<boolean>}
 */
export function showConfirm(message, title = 'Подтверждение действия') {
    return new Promise((resolve) => {
        showModal({
            title,
            message,
            buttons: [
                {
                    text: 'Да',
                    primary: true, // или danger если это удаление, можно добавить логику
                    onClick: () => resolve(true)
                },
                {
                    text: 'Отмена',
                    primary: false,
                    onClick: () => resolve(false)
                }
            ]
        });
    });
}

/**
 * Специальная версия для опасных действий (удаление)
 * @param {string} message - Сообщение
 * @param {string} title - Заголовок (опционально)
 * @returns {Promise<boolean>}
 */
export function showDangerConfirm(message, title = 'Подтвердите действие') {
    return new Promise((resolve) => {
        showModal({
            title,
            message,
            buttons: [
                {
                    text: 'Удалить',
                    danger: true,
                    onClick: () => resolve(true)
                },
                {
                    text: 'Отмена',
                    primary: false,
                    onClick: () => resolve(false)
                }
            ]
        });
    });
}

/**
 * Показать уведомление (аналог alert)
 * @param {string} message - Сообщение
 * @param {string} title - Заголовок (опционально)
 * @returns {Promise<void>}
 */
export function showAlert(message, title = 'Внимание') {
    return new Promise((resolve) => {
        showModal({
            title,
            message,
            buttons: [
                {
                    text: 'OK',
                    primary: true,
                    onClick: () => resolve()
                }
            ]
        });
    });
}
