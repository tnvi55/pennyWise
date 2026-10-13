// Development seed: synthetic categories and transactions for learning and manual testing.
// Run with `npm run db:seed` (Prisma runs `tsx prisma/seed.ts` from prisma.config.ts).
//
// Repeatable and non-destructive:
// - categories are upserted on their unique (name, type) pair;
// - transactions are upserted on fixed ids;
// - existing rows are never deleted or overwritten (`update: {}`), so your own data is safe.
import { PrismaPg } from '@prisma/adapter-pg';

import { CategoryType, PrismaClient } from '../src/generated/prisma/client';

const { INCOME, EXPENSE } = CategoryType;

const CATEGORIES = [
  { name: 'Salary', type: INCOME },
  { name: 'Freelance', type: INCOME },
  { name: 'Other', type: INCOME },
  { name: 'Groceries', type: EXPENSE },
  { name: 'Rent', type: EXPENSE },
  { name: 'Transport', type: EXPENSE },
  { name: 'Utilities', type: EXPENSE },
  { name: 'Eating out', type: EXPENSE },
  { name: 'Other', type: EXPENSE },
] as const;

type CategoryKey = `${(typeof CATEGORIES)[number]['type']}:${(typeof CATEGORIES)[number]['name']}`;

interface SeedTransaction {
  id: string;
  category: CategoryKey;
  /** Decimal string, never a JS number, so no floating-point rounding. */
  amount: string;
  /** Calendar date, YYYY-MM-DD. */
  date: string;
  note?: string;
}

// Fixed ids (UUID format, `5eed` prefix) make re-runs update-or-skip instead of duplicating.
const TRANSACTIONS: SeedTransaction[] = [
  {
    id: '5eed0000-0000-4000-8000-000000000001',
    category: 'INCOME:Salary',
    amount: '85000.00',
    date: '2026-09-01',
    note: 'September salary',
  },
  {
    id: '5eed0000-0000-4000-8000-000000000002',
    category: 'EXPENSE:Rent',
    amount: '22000.00',
    date: '2026-09-02',
  },
  {
    id: '5eed0000-0000-4000-8000-000000000003',
    category: 'EXPENSE:Groceries',
    amount: '3450.75',
    date: '2026-09-05',
    note: 'Weekly groceries',
  },
  {
    id: '5eed0000-0000-4000-8000-000000000004',
    category: 'EXPENSE:Transport',
    amount: '640.00',
    date: '2026-09-08',
    note: 'Metro card top-up',
  },
  {
    id: '5eed0000-0000-4000-8000-000000000005',
    category: 'EXPENSE:Utilities',
    amount: '1899.50',
    date: '2026-09-12',
    note: 'Electricity bill',
  },
  {
    id: '5eed0000-0000-4000-8000-000000000006',
    category: 'INCOME:Freelance',
    amount: '12500.00',
    date: '2026-09-18',
    note: 'Logo design',
  },
  {
    id: '5eed0000-0000-4000-8000-000000000007',
    category: 'EXPENSE:Eating out',
    amount: '1240.10',
    date: '2026-09-21',
  },
  {
    id: '5eed0000-0000-4000-8000-000000000008',
    category: 'EXPENSE:Groceries',
    amount: '2875.20',
    date: '2026-09-30',
    note: 'Month-end groceries',
  },
  {
    id: '5eed0000-0000-4000-8000-000000000009',
    category: 'INCOME:Salary',
    amount: '85000.00',
    date: '2026-10-01',
    note: 'October salary',
  },
  {
    id: '5eed0000-0000-4000-8000-000000000010',
    category: 'EXPENSE:Rent',
    amount: '22000.00',
    date: '2026-10-02',
  },
  {
    id: '5eed0000-0000-4000-8000-000000000011',
    category: 'EXPENSE:Groceries',
    amount: '0.10',
    date: '2026-10-03',
    note: 'Decimal check: 0.10',
  },
  {
    id: '5eed0000-0000-4000-8000-000000000012',
    category: 'EXPENSE:Groceries',
    amount: '0.20',
    date: '2026-10-03',
    note: 'Decimal check: 0.20',
  },
  {
    id: '5eed0000-0000-4000-8000-000000000013',
    category: 'EXPENSE:Transport',
    amount: '450.00',
    date: '2026-10-06',
  },
  {
    id: '5eed0000-0000-4000-8000-000000000014',
    category: 'INCOME:Other',
    amount: '1500.00',
    date: '2026-10-09',
    note: 'Cashback',
  },
  {
    id: '5eed0000-0000-4000-8000-000000000015',
    category: 'EXPENSE:Other',
    amount: '999.99',
    date: '2026-10-10',
    note: 'Gift',
  },
];

/** 'YYYY-MM-DD' → a Date at UTC midnight, which Prisma stores as that exact DATE. */
function toUtcDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and run `npm run db:seed`.',
    );
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const categoryIds = new Map<CategoryKey, string>();
    for (const { name, type } of CATEGORIES) {
      const category = await prisma.category.upsert({
        where: { name_type: { name, type } },
        create: { name, type },
        update: {},
      });
      categoryIds.set(`${type}:${name}`, category.id);
    }

    for (const t of TRANSACTIONS) {
      const categoryId = categoryIds.get(t.category);
      if (!categoryId) throw new Error(`Seed bug: unknown category ${t.category}`);
      const type = t.category.startsWith('INCOME:') ? INCOME : EXPENSE;

      await prisma.transaction.upsert({
        where: { id: t.id },
        create: {
          id: t.id,
          type,
          amount: t.amount,
          date: toUtcDate(t.date),
          note: t.note ?? null,
          categoryId,
        },
        update: {},
      });
    }

    const [categories, transactions] = await Promise.all([
      prisma.category.count(),
      prisma.transaction.count(),
    ]);
    console.log(
      `Seed done: ${CATEGORIES.length} fixture categories and ${TRANSACTIONS.length} fixture transactions ensured. ` +
        `Database now has ${categories} categories and ${transactions} transactions.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
