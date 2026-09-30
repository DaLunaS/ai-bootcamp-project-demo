const { calculateFreshness } = require('./freshness');

const ingredient = {
  baseShelfLifeDays: 10,
  multipliers: { fridge: 1, freezer: 5, ambient: 0.5 },
  canFreeze: true,
};

const purchasedAt = '2026-09-01T00:00:00.000Z';

describe('calculateFreshness', () => {
  test('accumulates used lifetime across storage changes without resetting it', () => {
    const lot = {
      purchasedAt,
      storageHistory: [
        { at: purchasedAt, storage: 'fridge' },
        { at: '2026-09-03T00:00:00.000Z', storage: 'freezer' },
      ],
    };

    const result = calculateFreshness(ingredient, lot, '2026-09-05T00:00:00.000Z');
    expect(result.progress).toBeCloseTo(0.24);
    expect(result.expired).toBe(false);
    expect(calculateFreshness(ingredient, lot, '2026-09-01T00:00:00.000Z'))
      .toEqual({ progress: 0, expired: false });
  });

  test('uses the ingredient-specific ambient multiplier and expires at 100%', () => {
    const lot = {
      purchasedAt,
      storageHistory: [{ at: purchasedAt, storage: 'ambient' }],
    };

    expect(calculateFreshness(ingredient, lot, '2026-09-03T12:00:00.000Z'))
      .toEqual({ progress: 0.5, expired: false });
    expect(calculateFreshness(ingredient, lot, '2026-09-06T00:00:00.000Z'))
      .toEqual({ progress: 1, expired: true });
  });

  test('ignores storage changes that happen after the requested time', () => {
    const lot = {
      purchasedAt,
      storageHistory: [
        { at: purchasedAt, storage: 'fridge' },
        { at: '2026-09-03T00:00:00.000Z', storage: 'freezer' },
      ],
    };

    expect(calculateFreshness(ingredient, lot, '2026-09-02T00:00:00.000Z'))
      .toEqual({ progress: 0.1, expired: false });
  });

  test('does not revive an already expired lot when it is moved into the freezer', () => {
    const lot = {
      purchasedAt,
      storageHistory: [
        { at: purchasedAt, storage: 'ambient' },
        { at: '2026-09-07T00:00:00.000Z', storage: 'freezer' },
      ],
    };

    expect(calculateFreshness(ingredient, lot, '2026-09-08T00:00:00.000Z').expired)
      .toBe(true);
  });

  test('treats the packaging expiration as fixed even after freezing', () => {
    const lot = {
      purchasedAt,
      expiresAt: '2026-09-03T00:00:00.000Z',
      storageHistory: [
        { at: purchasedAt, storage: 'fridge' },
        { at: '2026-09-02T00:00:00.000Z', storage: 'freezer' },
      ],
    };

    expect(calculateFreshness(ingredient, lot, '2026-09-03T00:00:00.000Z').expired)
      .toBe(true);
  });

  test('rejects freezer storage for an ingredient that cannot be frozen', () => {
    const lot = {
      purchasedAt,
      storageHistory: [{ at: purchasedAt, storage: 'freezer' }],
    };

    expect(() => calculateFreshness({ ...ingredient, canFreeze: false }, lot, purchasedAt))
      .toThrow('Ingredient cannot be frozen');
  });
});