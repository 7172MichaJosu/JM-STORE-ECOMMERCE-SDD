export function connect(binding) {
  if (!binding?.prepare || !binding?.batch)
    throw Error("Binding D1 requerido.");
  let preparedCount = 0;
  const stmt = (sql, ...values) => {
    preparedCount++;
    const s = binding.prepare(sql);
    return values.length ? s.bind(...values) : s;
  };
  return {
    stmt,
    get preparedCount() {
      return preparedCount;
    },
    first: (sql, ...v) => stmt(sql, ...v).first(),
    all: async (sql, ...v) => (await stmt(sql, ...v).all()).results,
    run: (sql, ...v) => stmt(sql, ...v).run(),
    batch: (statements) => binding.batch(statements),
  };
}
