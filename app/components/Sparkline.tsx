type Props = {
  data: number[];
  width?: number;
  height?: number;
  positive: boolean;
};

export default function Sparkline({ data, width = 80, height = 28, positive }: Props) {
  if (data.length < 3) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  const color = positive ? '#15803d' : '#b91c1c';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <line x1={0} y1={height} x2={width} y2={height} stroke="#e5e7eb" strokeWidth={1} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
