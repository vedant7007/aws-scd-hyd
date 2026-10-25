/**
 * The AWS Student Builder Group VJIT mark: a pixel chip, three pins a side,
 * traced block for block from the club's own logo so it stays sharp at any
 * size. Colour comes from currentColor.
 */
const BLOCKS: [number, number, number][] = [
  // [x, y, width] on a 9 by 9 grid, one unit high
  [2, 0, 1], [4, 0, 1], [6, 0, 1],
  [2, 1, 5],
  [0, 2, 2], [7, 2, 2],
  [1, 3, 1], [7, 3, 1],
  [0, 4, 2], [7, 4, 2],
  [1, 5, 1], [7, 5, 1],
  [0, 6, 2], [7, 6, 2],
  [2, 7, 5],
  [2, 8, 1], [4, 8, 1], [6, 8, 1],
]

export function SbgLogo({ className, title = 'AWS Student Builder Group VJIT' }: { className?: string; title?: string }) {
  return (
    <svg className={className} viewBox="0 0 9 9" role="img" aria-label={title} shapeRendering="crispEdges">
      {BLOCKS.map(([x, y, w]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={1} fill="currentColor" />
      ))}
    </svg>
  )
}
