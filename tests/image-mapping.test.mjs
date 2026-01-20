/**
 * Тест логики маппинга изображений по координатам (Anchor logic)
 * Этот тест имитирует процесс парсинга Excel и сопоставления извлеченных данных с изображениями.
 */

import { hasCellValue } from './import-utils.test.mjs';

function simulateMapping(rawData, imageRowMap, extractedImages) {
    const stats = {
        totalRows: rawData.length,
        imagesMatched: 0,
        matchedRows: []
    };

    rawData.forEach((row, index) => {
        const excelRow = row._excelRowNumber;
        const sku = row.sku;

        // Поиск изображения по номеру строки
        const imageFileName = imageRowMap.get(excelRow);

        if (imageFileName && extractedImages.has(imageFileName)) {
            stats.imagesMatched++;
            stats.matchedRows.push({
                sku: sku,
                excelRow: excelRow,
                image: imageFileName
            });
        }
    });

    return stats;
}

// Тестовые данные
const mockRawData = [
    { sku: 'SKU_01', name: 'Item 1', _excelRowNumber: 2 },
    { sku: 'SKU_02', name: 'Item 2', _excelRowNumber: 3 },
    { sku: 'SKU_18', name: 'Item 18 (No Image)', _excelRowNumber: 19 },
    { sku: 'SKU_19', name: 'Item 19', _excelRowNumber: 20 },
    { sku: 'SKU_20', name: 'Item 20 (No Image)', _excelRowNumber: 21 },
    { sku: 'SKU_21', name: 'Item 21', _excelRowNumber: 22 }
];

// Карта из XML: row -> fileName
const mockImageRowMap = new Map([
    [2, 'image1.png'],
    [3, 'image2.png'],
    [20, 'image19.png'], // Пропустили 19 (SKU 18)
    [22, 'image21.png']  // Пропустили 21 (SKU 20)
]);

const mockExtractedImages = new Map([
    ['image1.png', {}],
    ['image2.png', {}],
    ['image19.png', {}],
    ['image21.png', {}]
]);

// Запуск симуляции
console.log('🧪 Запуск теста маппинга изображений...');
const results = simulateMapping(mockRawData, mockImageRowMap, mockExtractedImages);

console.log('📊 Результаты теста:');
results.matchedRows.forEach(res => {
    console.log(`✅ Товар ${res.sku} (Row ${res.excelRow}) -> ${res.image}`);
});

// Проверка на "съезжание"
const expectedMatches = [
    { sku: 'SKU_01', image: 'image1.png' },
    { sku: 'SKU_02', image: 'image2.png' },
    { sku: 'SKU_19', image: 'image19.png' },
    { sku: 'SKU_21', image: 'image21.png' }
];

let allCorrect = true;
expectedMatches.forEach(exp => {
    const match = results.matchedRows.find(m => m.sku === exp.sku);
    if (!match || match.image !== exp.image) {
        console.error(`❌ ОШИБКА: SKU ${exp.sku} должен соответствовать ${exp.image}`);
        allCorrect = false;
    }
});

if (allCorrect && results.imagesMatched === expectedMatches.length) {
    console.log('✨ ТЕСТ ПРОЙДЕН: Маппинг работает корректно, изображения не "съезжают" при пропусках.');
} else {
    console.log('❌ ТЕСТ ПРОВАЛЕН: Обнаружены ошибки в сопоставлении.');
}
