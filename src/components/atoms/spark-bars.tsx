interface SparkBarsProps {
  values: number[];
}

export function SparkBars({ values }: SparkBarsProps) {
  const max = Math.max(...values, 1);
  return (
    <div className="spark-mini">
      {values.map((v, i) => (
        <span
          key={i}
          className={i === values.length - 1 ? 'last' : ''}
          style={{ height: `${(v / max) * 100}%` }}
        />
      ))}
    </div>
  );
}
