/**
 * Модуль для управления модальными окнами
 * Заменяет стандартные alert и confirm
 */

let modalElement = null;
let titleElement = null;
let messageElement = null;
let buttonsContainer = null;
let resolvePromise = null;

/**
 * Инициализация модального окна (создание DOM элементов)
 */
function initModal() {
    if (modalElement) return;

    // HTML структура модального окна
    const modalHTML = `
    <div id="custom-modal" class="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm hidden items-center justify-center flex opacity-0 transition-opacity duration-200">
        <div class="bg-white dark:bg-surface-dark rounded-3xl p-6 mx-4 max-w-sm w-full shadow-2xl transform scale-95 transition-all duration-200">
            <h3 id="custom-modal-title" class="text-xl font-bold text-slate-900 dark:text-white mb-2"></h3>
            <div id="custom-modal-message" class="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed"></div>
            <div id="custom-modal-buttons" class="flex gap-3">
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
function showModal({ title, message, buttons = [] }) {
    initModal();

    // Установка текста
    titleElement.textContent = title;
    // Поддержка переносов строк
    messageElement.innerHTML = message.replace(/\n/g, '<br>');

    // Очистка кнопок
    buttonsContainer.innerHTML = '';

    // Создание кнопок
    buttons.forEach((btn, index) => {
        const button = document.createElement('button');
        button.textContent = btn.text;

        // Стилизация кнопок
        const baseClasses = "flex-1 py-3 px-4 rounded-xl font-bold active:scale-95 transition-all";
        const primaryClasses = "bg-primary text-white hover:bg-blue-600 shadow-md shadow-blue-500/20";
        const secondaryClasses = "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600";
        const dangerClasses = "bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-500/20";

        button.className = `${baseClasses} ${btn.danger ? dangerClasses : (btn.primary ? primaryClasses : secondaryClasses)}`;

        button.onclick = () => {
            closeModal();
            if (btn.onClick) btn.onClick();
        };

        buttonsContainer.appendChild(button);
    });

    // Показать окно с анимацией
    modalElement.classList.remove('hidden');
    // Небольшая задержка для срабатывания transition
    requestAnimationFrame(() => {
        modalElement.classList.remove('opacity-0');
        modalElement.querySelector('div').classList.remove('scale-95');
        modalElement.querySelector('div').classList.add('scale-100');
    });
}

/**
 * Закрыть модальное окно
 */
function closeModal() {
    if (!modalElement) return;

    modalElement.classList.add('opacity-0');
    modalElement.querySelector('div').classList.remove('scale-100');
    modalElement.querySelector('div').classList.add('scale-95');

    setTimeout(() => {
        modalElement.classList.add('hidden');
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
