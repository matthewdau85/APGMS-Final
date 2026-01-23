type Row = Record<string, any>;

function makeModel() {
  const rows: Row[] = [];

  return {
    _rows: rows,

    async create(opts: { data: Row }) {
      const r = { ...opts.data };
      rows.push(r);
      return r;
    },

    async findMany(opts?: { where?: Row }) {
      if (!opts?.where) return rows.slice();
      const where = opts.where;
      return rows.filter((r) => {
        for (const k of Object.keys(where)) {
          if (r[k] !== where[k]) return false;
        }
        return true;
      });
    },

    async count(opts?: { where?: Row }) {
      const found = await this.findMany(opts);
      return found.length;
    },

    async deleteMany() {
      rows.splice(0, rows.length);
      return { count: 0 };
    },
  };
}

export function createInMemoryDb() {
  return {
    __reachable: true,

    // Models used directly by tests (seeding)
    payrollItem: makeModel(),
    gstTransaction: makeModel(),

    // Optional common shapes if other handlers query them
    ledgerEntry: makeModel(),
    obligation: makeModel(),

    ping() {
      return this.__reachable === true;
    },
  };
}
