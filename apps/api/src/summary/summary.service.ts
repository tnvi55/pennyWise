import { Injectable } from '@nestjs/common';

import { toDateString } from '../common/validation/calendar-date';
import { monthRange } from '../common/validation/month';
import { PrismaService } from '../prisma/prisma.service';
import type { CategoryExpenseDto, SummaryResponseDto } from './dto/summary-response.dto';

/** A money total as PostgreSQL returns it from round(…, 2)::text, e.g. "0.00" or "-1500.00". */
const MONEY_TOTAL = /^-?\d+\.\d{2}$/;

interface TotalsRow {
  income: string;
  expenses: string;
  net: string;
}

function isMoneyTotal(value: unknown): value is string {
  return typeof value === 'string' && MONEY_TOTAL.test(value);
}

/**
 * Raw SQL results have no compile-time types, so check them at runtime before trusting
 * them. A failure here is a server bug, and the global filter turns it into a generic 500.
 */
function parseTotals(rows: unknown): TotalsRow {
  const row: unknown = Array.isArray(rows) && rows.length === 1 ? rows[0] : undefined;
  if (typeof row === 'object' && row !== null) {
    const { income, expenses, net } = row as Record<string, unknown>;
    if (isMoneyTotal(income) && isMoneyTotal(expenses) && isMoneyTotal(net)) {
      return { income, expenses, net };
    }
  }
  throw new Error('Unexpected summary totals row from the database');
}

function parseBreakdown(rows: unknown): CategoryExpenseDto[] {
  if (!Array.isArray(rows)) throw new Error('Unexpected expenses-by-category result');
  return rows.map((row: unknown) => {
    if (typeof row === 'object' && row !== null) {
      const { categoryId, categoryName, amount } = row as Record<string, unknown>;
      if (
        typeof categoryId === 'string' &&
        typeof categoryName === 'string' &&
        isMoneyTotal(amount)
      ) {
        return { categoryId, categoryName, amount };
      }
    }
    throw new Error('Unexpected expenses-by-category row from the database');
  });
}

/**
 * Monthly totals, computed entirely by PostgreSQL: sum() over DECIMAL is exact, and
 * ::text hands each result to JavaScript as a string, so no floating-point number is
 * ever created. The queries are tagged templates, so ${…} values are bound parameters.
 */
@Injectable()
export class SummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async forMonth(month: string): Promise<SummaryResponseDto> {
    // Bounds as 'YYYY-MM-DD' strings cast to ::date. A JS Date would arrive as timestamptz,
    // and comparing DATE with timestamptz depends on the session's timezone.
    const range = monthRange(month);
    const from = toDateString(range.gte);
    const to = toDateString(range.lt);

    // One database transaction, so totals and breakdown see the same rows.
    const [totalsRows, breakdownRows] = await this.prisma.$transaction([
      this.prisma.$queryRaw`
        SELECT
          round(COALESCE(sum(amount) FILTER (WHERE type = 'INCOME'), 0), 2)::text AS income,
          round(COALESCE(sum(amount) FILTER (WHERE type = 'EXPENSE'), 0), 2)::text AS expenses,
          round(
            COALESCE(sum(amount) FILTER (WHERE type = 'INCOME'), 0)
              - COALESCE(sum(amount) FILTER (WHERE type = 'EXPENSE'), 0),
            2
          )::text AS net
        FROM transactions
        WHERE date >= ${from}::date AND date < ${to}::date`,
      this.prisma.$queryRaw`
        SELECT
          c.id::text AS "categoryId",
          c.name AS "categoryName",
          round(sum(t.amount), 2)::text AS amount
        FROM transactions t
        JOIN categories c ON c.id = t.category_id
        WHERE t.type = 'EXPENSE' AND t.date >= ${from}::date AND t.date < ${to}::date
        GROUP BY c.id, c.name
        ORDER BY sum(t.amount) DESC, c.name ASC, c.id ASC`,
    ]);

    return {
      month,
      currency: 'INR',
      ...parseTotals(totalsRows),
      expensesByCategory: parseBreakdown(breakdownRows),
    };
  }
}
