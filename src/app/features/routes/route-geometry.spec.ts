import { badgeTextColor, drawableCoordinates } from './route-geometry';

describe('drawableCoordinates', () => {
  const line = (coordinates: unknown) => ({ type: 'LineString', coordinates }) as never;

  it('accepts a WGS84 LineString with at least two positions, in [lon, lat] order', () => {
    expect(
      drawableCoordinates(
        line([
          [123.86, 10.26],
          [123.9, 10.3],
        ]),
      ),
    ).toEqual([
      [123.86, 10.26],
      [123.9, 10.3],
    ]);
  });

  it('rejects missing, short, non-finite or out-of-range geometry instead of repairing it', () => {
    expect(drawableCoordinates(null)).toBeNull();
    expect(drawableCoordinates(line([[123.86, 10.26]]))).toBeNull();
    expect(drawableCoordinates(line([[123.86, 10.26], [Number.NaN, 10.3]]))).toBeNull();
    expect(drawableCoordinates(line([[123.86, 10.26], [10.3, 123.9]]))).toBeNull(); // lat > 90: swapped order
    expect(drawableCoordinates({ type: 'Point', coordinates: [1, 2] } as never)).toBeNull();
  });
});

describe('badgeTextColor', () => {
  it('uses white on dark route colors and black on light ones', () => {
    expect(badgeTextColor('#0B6E4F')).toBe('#FFFFFF');
    expect(badgeTextColor('#1E3A8A')).toBe('#FFFFFF');
    expect(badgeTextColor('#FFEB3B')).toBe('#000000');
    expect(badgeTextColor('#43A047')).toBe('#000000');
  });
});
