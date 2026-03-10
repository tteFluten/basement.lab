/**
 * Database client wrapper that mimics the Neon query-builder API.
 * Backed by Neon (PostgreSQL) via @neondatabase/serverless.
 *
 * Supports: select, insert, update, delete, upsert
 * Filters:  eq, neq, in, or, not, is, like, ilike, gte, lte, gt, lt, contains
 * Extras:   order, limit, single, count (head: true)
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL ?? "";

export function hasDb(): boolean {
  return Boolean(DATABASE_URL);
}

// ---------------------------------------------------------------------------
// Low-level query executor
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

/**
 * Execute a query with positional $1..$N placeholders.
 * We rebuild a TemplateStringsArray by splitting on those placeholders so we
 * can pass it to the neon tagged-template function, which handles type
 * serialisation (arrays → postgres arrays, objects → jsonb, etc.).
 */
async function rawQuery(queryText: string, queryParams: unknown[]): Promise<Row[]> {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  const sql = neon(DATABASE_URL);
  // Split the query on every $N placeholder to get n+1 string segments.
  const parts = queryText.split(/\$\d+/);
  // Extract the $N indices in textual order so params are passed in the
  // correct position regardless of the order they were added to _params.
  // e.g. "SET col = $2 WHERE id = $1" → indices [1, 0] → reorder accordingly.
  const indices = Array.from(queryText.matchAll(/\$(\d+)/g)).map((m) => parseInt(m[1], 10) - 1);
  const orderedParams = indices.map((i) => queryParams[i]);
  const strings = Object.assign([...parts], { raw: [...parts] }) as TemplateStringsArray;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (sql as any)(strings, ...orderedParams);
  return rows as Row[];
}

// ---------------------------------------------------------------------------
// Query result shape
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbResult = {
  // Using `any` here because the result shape varies between single-row and
  // multi-row queries and the calling code already does explicit casts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  error: { message: string } | null;
  count: number | null;
};

// ---------------------------------------------------------------------------
// Query Builder
// ---------------------------------------------------------------------------

type Operation = "select" | "insert" | "update" | "delete" | "upsert";

class QueryBuilder {
  private _table: string;
  private _operation: Operation = "select";
  private _selectCols = "*";
  private _returning: string | null = null;
  private _wheres: string[] = [];
  private _params: unknown[] = [];
  private _orders: string[] = [];
  private _limitVal: number | null = null;
  private _isSingle = false;
  private _isCount = false;
  private _mutationData: Row | Row[] | null = null;
  private _upsertConflict: string | null = null;

  constructor(table: string) {
    this._table = table;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private nextParam(value: unknown): string {
    this._params.push(value);
    return `$${this._params.length}`;
  }

  private formatCols(cols: string): string {
    if (cols === "*") return "*";
    return cols
      .split(",")
      .map((c) => `"${c.trim()}"`)
      .join(", ");
  }

  private whereClause(): string {
    return this._wheres.length > 0 ? `WHERE ${this._wheres.join(" AND ")}` : "";
  }

  private orderClause(): string {
    return this._orders.length > 0 ? `ORDER BY ${this._orders.join(", ")}` : "";
  }

  private limitClause(): string {
    return this._limitVal !== null ? `LIMIT ${this._limitVal}` : "";
  }

  /**
   * Ensure undefined becomes null; stringify complex values for JSONB columns.
   * Arrays of primitives (string[], number[]) stay as arrays for text[]/int[] columns.
   * Arrays containing objects are stringified for JSONB columns (e.g. drawing).
   */
  private normalizeValue(val: unknown): unknown {
    if (val === undefined) return null;
    if (val === null) return null;
    if (typeof val !== "object") return val;
    if (Array.isArray(val)) {
      if (val.length === 0) return val;
      const hasComplex = val.some((item) => item !== null && typeof item === "object");
      return hasComplex ? JSON.stringify(val) : val;
    }
    return JSON.stringify(val);
  }

  // -------------------------------------------------------------------------
  // Operation setters
  // -------------------------------------------------------------------------

  select(cols = "*", opts?: { count?: string; head?: boolean }): this {
    if (this._operation === "select") {
      // Initial SELECT operation setup
      if (opts?.count === "exact") this._isCount = true;
      this._selectCols = cols;
    } else {
      // Called after insert / update / upsert → RETURNING clause
      this._returning = cols;
    }
    return this;
  }

  insert(data: Row | Row[]): this {
    this._operation = "insert";
    this._mutationData = data;
    return this;
  }

  update(data: Row): this {
    this._operation = "update";
    this._mutationData = data;
    return this;
  }

  delete(): this {
    this._operation = "delete";
    return this;
  }

  upsert(data: Row | Row[], opts?: { onConflict?: string }): this {
    this._operation = "upsert";
    this._mutationData = data;
    this._upsertConflict = opts?.onConflict ?? null;
    return this;
  }

  // -------------------------------------------------------------------------
  // Filter methods
  // -------------------------------------------------------------------------

  eq(col: string, val: unknown): this {
    if (val === null) {
      this._wheres.push(`"${col}" IS NULL`);
    } else {
      this._wheres.push(`"${col}" = ${this.nextParam(val)}`);
    }
    return this;
  }

  neq(col: string, val: unknown): this {
    if (val === null) {
      this._wheres.push(`"${col}" IS NOT NULL`);
    } else {
      this._wheres.push(`"${col}" != ${this.nextParam(val)}`);
    }
    return this;
  }

  in(col: string, vals: unknown[]): this {
    if (vals.length === 0) {
      this._wheres.push("FALSE");
    } else {
      const ps = vals.map((v) => this.nextParam(v));
      this._wheres.push(`"${col}" IN (${ps.join(", ")})`);
    }
    return this;
  }

  /**
   * or() filter string format: "col.op.value[,col.op.value]"
   * e.g. "user_id.eq.abc-123,is_public.eq.true"
   */
  or(filter: string): this {
    const conditions = filter.split(",").map((part) => {
      const dotIdx1 = part.indexOf(".");
      const dotIdx2 = part.indexOf(".", dotIdx1 + 1);
      const col = part.slice(0, dotIdx1);
      const op = part.slice(dotIdx1 + 1, dotIdx2);
      const val = part.slice(dotIdx2 + 1);
      return this.buildCondition(col, op, val);
    });
    this._wheres.push(`(${conditions.join(" OR ")})`);
    return this;
  }

  private buildCondition(col: string, op: string, val: string): string {
    switch (op) {
      case "eq": {
        if (val === "null") return `"${col}" IS NULL`;
        if (val === "true") return `"${col}" = ${this.nextParam(true)}`;
        if (val === "false") return `"${col}" = ${this.nextParam(false)}`;
        return `"${col}" = ${this.nextParam(val)}`;
      }
      case "neq":
        return `"${col}" != ${this.nextParam(val)}`;
      case "is":
        if (val === "null") return `"${col}" IS NULL`;
        if (val === "true") return `"${col}" IS TRUE`;
        if (val === "false") return `"${col}" IS FALSE`;
        return `"${col}" IS ${val}`;
      case "gte":
        return `"${col}" >= ${this.nextParam(val)}`;
      case "lte":
        return `"${col}" <= ${this.nextParam(val)}`;
      case "gt":
        return `"${col}" > ${this.nextParam(val)}`;
      case "lt":
        return `"${col}" < ${this.nextParam(val)}`;
      default:
        return "TRUE";
    }
  }

  not(col: string, op: string, val: unknown): this {
    if (op === "is") {
      if (val === null) this._wheres.push(`"${col}" IS NOT NULL`);
      else if (val === true) this._wheres.push(`"${col}" IS NOT TRUE`);
      else if (val === false) this._wheres.push(`"${col}" IS NOT FALSE`);
      else this._wheres.push(`"${col}" IS NOT ${this.nextParam(val)}`);
    } else {
      this._wheres.push(`NOT ("${col}" ${op.toUpperCase()} ${this.nextParam(val)})`);
    }
    return this;
  }

  is(col: string, val: unknown): this {
    if (val === null) this._wheres.push(`"${col}" IS NULL`);
    else if (val === true) this._wheres.push(`"${col}" IS TRUE`);
    else if (val === false) this._wheres.push(`"${col}" IS FALSE`);
    else this._wheres.push(`"${col}" IS ${this.nextParam(val)}`);
    return this;
  }

  like(col: string, pattern: string): this {
    this._wheres.push(`"${col}" LIKE ${this.nextParam(pattern)}`);
    return this;
  }

  ilike(col: string, pattern: string): this {
    this._wheres.push(`"${col}" ILIKE ${this.nextParam(pattern)}`);
    return this;
  }

  gte(col: string, val: unknown): this {
    this._wheres.push(`"${col}" >= ${this.nextParam(val)}`);
    return this;
  }

  lte(col: string, val: unknown): this {
    this._wheres.push(`"${col}" <= ${this.nextParam(val)}`);
    return this;
  }

  gt(col: string, val: unknown): this {
    this._wheres.push(`"${col}" > ${this.nextParam(val)}`);
    return this;
  }

  lt(col: string, val: unknown): this {
    this._wheres.push(`"${col}" < ${this.nextParam(val)}`);
    return this;
  }

  /** Array containment: column @> value */
  contains(col: string, val: unknown[]): this {
    this._wheres.push(`"${col}" @> ${this.nextParam(val)}`);
    return this;
  }

  // -------------------------------------------------------------------------
  // Ordering / pagination / single-row
  // -------------------------------------------------------------------------

  order(col: string, opts?: { ascending?: boolean }): this {
    const dir = opts?.ascending === false ? "DESC" : "ASC";
    this._orders.push(`"${col}" ${dir}`);
    return this;
  }

  limit(n: number): this {
    this._limitVal = n;
    return this;
  }

  single(): this {
    this._isSingle = true;
    this._limitVal = 1;
    return this;
  }

  // -------------------------------------------------------------------------
  // Thenable — makes QueryBuilder awaitable
  // -------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then(onFulfilled?: ((v: DbResult) => any) | null, onRejected?: ((e: unknown) => any) | null): Promise<any> {
    return this.execute().then(onFulfilled, onRejected);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  catch(onRejected?: ((e: unknown) => any) | null): Promise<any> {
    return this.execute().catch(onRejected);
  }

  // -------------------------------------------------------------------------
  // SQL execution
  // -------------------------------------------------------------------------

  private async execute(): Promise<DbResult> {
    try {
      switch (this._operation) {
        case "select": return await this.execSelect();
        case "insert": return await this.execInsert();
        case "update": return await this.execUpdate();
        case "delete": return await this.execDelete();
        case "upsert": return await this.execUpsert();
        default:
          return { data: null, error: { message: "Unknown operation" }, count: null };
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[db] ${this._operation} "${this._table}":`, message);
      return { data: null, error: { message }, count: null };
    }
  }

  private async execSelect(): Promise<DbResult> {
    if (this._isCount) {
      const q = [
        `SELECT COUNT(*) as _count FROM "${this._table}"`,
        this.whereClause(),
      ].filter(Boolean).join(" ");
      const rows = await rawQuery(q, this._params);
      return { data: null, error: null, count: Number(rows[0]?._count ?? 0) };
    }

    const cols = this.formatCols(this._selectCols);
    const q = [
      `SELECT ${cols} FROM "${this._table}"`,
      this.whereClause(),
      this.orderClause(),
      this.limitClause(),
    ].filter(Boolean).join(" ");

    const rows = await rawQuery(q, this._params);

    if (this._isSingle) {
      if (rows.length === 0) {
        return { data: null, error: { message: `No rows found in "${this._table}"` }, count: null };
      }
      return { data: rows[0] as Row, error: null, count: null };
    }
    return { data: rows as Row[], error: null, count: null };
  }

  private async execInsert(): Promise<DbResult> {
    const dataArr = Array.isArray(this._mutationData) ? this._mutationData : [this._mutationData!];
    if (dataArr.length === 0) return { data: null, error: { message: "No data to insert" }, count: null };

    const cols = Object.keys(dataArr[0]);
    const colsSql = cols.map((c) => `"${c}"`).join(", ");

    const valueRows: string[] = [];
    for (const row of dataArr) {
      const ps = cols.map((col) => this.nextParam(this.normalizeValue(row[col])));
      valueRows.push(`(${ps.join(", ")})`);
    }

    const returning = this._returning ? ` RETURNING ${this.formatCols(this._returning)}` : "";
    const q = `INSERT INTO "${this._table}" (${colsSql}) VALUES ${valueRows.join(", ")}${returning}`;

    const rows = await rawQuery(q, this._params);
    return this._returning ? this.wrapRows(rows) : { data: null, error: null, count: null };
  }

  private async execUpdate(): Promise<DbResult> {
    const data = this._mutationData as Row;
    if (!data) return { data: null, error: { message: "No data to update" }, count: null };

    const setClauses = Object.keys(data).map((col) => {
      return `"${col}" = ${this.nextParam(this.normalizeValue(data[col]))}`;
    });

    const returning = this._returning ? ` RETURNING ${this.formatCols(this._returning)}` : "";
    const q = [
      `UPDATE "${this._table}" SET ${setClauses.join(", ")}`,
      this.whereClause(),
    ].filter(Boolean).join(" ") + returning;

    const rows = await rawQuery(q, this._params);
    return this._returning ? this.wrapRows(rows) : { data: null, error: null, count: null };
  }

  private async execDelete(): Promise<DbResult> {
    const q = [`DELETE FROM "${this._table}"`, this.whereClause()].filter(Boolean).join(" ");
    await rawQuery(q, this._params);
    return { data: null, error: null, count: null };
  }

  private async execUpsert(): Promise<DbResult> {
    const dataArr = Array.isArray(this._mutationData) ? this._mutationData : [this._mutationData!];
    if (dataArr.length === 0) return { data: null, error: { message: "No data to upsert" }, count: null };

    const cols = Object.keys(dataArr[0]);
    const colsSql = cols.map((c) => `"${c}"`).join(", ");

    const valueRows: string[] = [];
    for (const row of dataArr) {
      const ps = cols.map((col) => this.nextParam(this.normalizeValue(row[col])));
      valueRows.push(`(${ps.join(", ")})`);
    }

    let conflictClause = "ON CONFLICT DO NOTHING";
    if (this._upsertConflict) {
      const conflictColSet = new Set(this._upsertConflict.split(",").map((c) => c.trim()));
      const conflictColsSql = Array.from(conflictColSet).map((c) => `"${c}"`).join(", ");
      const updateCols = cols.filter((c) => !conflictColSet.has(c));
      if (updateCols.length > 0) {
        const updateSet = updateCols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ");
        conflictClause = `ON CONFLICT (${conflictColsSql}) DO UPDATE SET ${updateSet}`;
      } else {
        conflictClause = `ON CONFLICT (${conflictColsSql}) DO NOTHING`;
      }
    }

    const returning = this._returning ? ` RETURNING ${this.formatCols(this._returning)}` : "";
    const q = `INSERT INTO "${this._table}" (${colsSql}) VALUES ${valueRows.join(", ")} ${conflictClause}${returning}`;

    const rows = await rawQuery(q, this._params);
    return this._returning ? this.wrapRows(rows) : { data: null, error: null, count: null };
  }

  private wrapRows(rows: Row[]): DbResult {
    if (this._isSingle) {
      return { data: rows[0] ?? null, error: null, count: null };
    }
    return { data: rows, error: null, count: null };
  }
}

// ---------------------------------------------------------------------------
// Public API — Neon-backed DB client exposed to API routes
// ---------------------------------------------------------------------------

type DbClient = {
  from(table: string): QueryBuilder;
};

export function getDb(): DbClient {
  if (!DATABASE_URL) {
    throw new Error("Missing DATABASE_URL (Neon connection string)");
  }
  return {
    from(table: string) {
      return new QueryBuilder(table);
    },
  };
}
