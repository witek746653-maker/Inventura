export function hasCellValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

export function findExcelDataRange(rows) {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  const headerRowIndex = normalizedRows.findIndex(row => {
    if (!Array.isArray(row)) return false;
    const firstCell = row[0];
    if (typeof firstCell !== 'string') return false;
    const normalized = firstCell.toLowerCase();
    return normalized.includes('артикул') || normalized.includes('sku');
  });

  const baseHeaderIndex = headerRowIndex === -1 ? 0 : headerRowIndex;
  let firstDataRowIndex = baseHeaderIndex + 1;
  while (firstDataRowIndex < normalizedRows.length && !hasCellValue(normalizedRows[firstDataRowIndex]?.[0])) {
    firstDataRowIndex += 1;
  }

  let lastDataRowIndex = normalizedRows.length - 1;
  while (lastDataRowIndex >= firstDataRowIndex && !hasCellValue(normalizedRows[lastDataRowIndex]?.[0])) {
    lastDataRowIndex -= 1;
  }

  if (firstDataRowIndex > lastDataRowIndex) {
    return {
      headerRowIndex: baseHeaderIndex,
      firstDataRowIndex: -1,
      lastDataRowIndex: -1
    };
  }

  return { headerRowIndex: baseHeaderIndex, firstDataRowIndex, lastDataRowIndex };
}

export function getExcelRowFromAnchor(anchorRow) {
  const rowNumber = Number(anchorRow);
  if (!Number.isFinite(rowNumber) || rowNumber < 0) return null;
  return rowNumber + 1;
}

export function buildRowImageLookup(imageRowMap, extractedImages) {
  const rowToImage = new Map();
  const unmappedImages = new Set(extractedImages?.keys ? extractedImages.keys() : []);
  const duplicateRowMappings = [];
  const invalidMappings = [];

  if (!imageRowMap || typeof imageRowMap.entries !== 'function') {
    return { rowToImage, unmappedImages, duplicateRowMappings, invalidMappings };
  }

  for (const [fileName, rowNumber] of imageRowMap.entries()) {
    if (!extractedImages || !extractedImages.has(fileName)) {
      invalidMappings.push({ fileName, rowNumber, reason: 'image_not_found' });
      continue;
    }

    if (typeof rowNumber !== 'number' || !Number.isFinite(rowNumber)) {
      invalidMappings.push({ fileName, rowNumber, reason: 'invalid_row' });
      continue;
    }

    if (rowToImage.has(rowNumber)) {
      duplicateRowMappings.push({
        rowNumber,
        fileName,
        existing: rowToImage.get(rowNumber)
      });
      continue;
    }

    rowToImage.set(rowNumber, fileName);
    unmappedImages.delete(fileName);
  }

  return { rowToImage, unmappedImages, duplicateRowMappings, invalidMappings };
}
