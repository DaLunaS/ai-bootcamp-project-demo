const DAY_MS = 24 * 60 * 60 * 1000;
const STORAGE_STATES = new Set(['ambient', 'fridge', 'freezer']);

function calculateFreshness(ingredient, lot, at) {
  const purchasedAt = Date.parse(lot.purchasedAt);
  const checkAt = Date.parse(at);
  if (!Number.isFinite(purchasedAt) || !Number.isFinite(checkAt) || checkAt < purchasedAt) {
    throw new RangeError('Freshness date must be on or after a valid purchase date');
  }
  if (!Number.isFinite(ingredient.baseShelfLifeDays) || ingredient.baseShelfLifeDays <= 0) {
    throw new RangeError('Base shelf life must be positive');
  }

  const history = lot.storageHistory;
  if (!Array.isArray(history) || !history.length || Date.parse(history[0].at) !== purchasedAt) {
    throw new RangeError('Storage history must begin at purchase');
  }

  let progress = 0;
  for (let i = 0; i < history.length; i += 1) {
    const { at: start, storage } = history[i];
    const startAt = Date.parse(start);
    const multiplier = ingredient.multipliers?.[storage];

    if (!STORAGE_STATES.has(storage) || !Number.isFinite(multiplier) || multiplier <= 0) {
      throw new RangeError('Storage state requires a positive lifetime multiplier');
    }
    if (storage === 'freezer' && !ingredient.canFreeze) {
      throw new RangeError('Ingredient cannot be frozen');
    }
    if (startAt >= checkAt) break;
    const endAt = i + 1 < history.length ? Date.parse(history[i + 1].at) : checkAt;
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt < startAt) {
      throw new RangeError('Storage changes must be chronological');
    }

    progress += (Math.min(endAt, checkAt) - startAt)
      / (DAY_MS * ingredient.baseShelfLifeDays * multiplier);
  }

  const expired = lot.expiresAt != null
    ? checkAt >= Date.parse(lot.expiresAt)
    : progress >= 1;
  return { progress, expired };
}

module.exports = { calculateFreshness };