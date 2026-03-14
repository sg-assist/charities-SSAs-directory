// Prisma client singleton using PrismaPg adapter (Prisma 7)

let prisma: any;

if (typeof window === "undefined" && process.env.DATABASE_URL) {
  try {
    const { PrismaClient } = require("@prisma/client");
    const { PrismaPg } = require("@prisma/adapter-pg");

    const globalForPrisma = globalThis as unknown as { prisma: any | undefined };

    if (!globalForPrisma.prisma) {
      const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
      globalForPrisma.prisma = new PrismaClient({ adapter });
    }

    prisma = globalForPrisma.prisma;
  } catch (error) {
    console.warn("PrismaClient not available:", error);
    prisma = createMockPrismaClient();
  }
} else {
  prisma = createMockPrismaClient();
}

function createMockPrismaClient() {
  const mockFindMany = () => Promise.resolve([]);
  const mockFindFirst = () => Promise.resolve(null);
  const mockFindUnique = () => Promise.resolve(null);
  const mockMutation = () => Promise.resolve(null);
  const mockCount = () => Promise.resolve(0);

  const createModelProxy = () => new Proxy({}, {
    get(_, method) {
      if (method === "findMany") return mockFindMany;
      if (method === "findFirst") return mockFindFirst;
      if (method === "findUnique") return mockFindUnique;
      if (method === "count") return mockCount;
      return (..._args: unknown[]) => mockMutation();
    }
  });

  return new Proxy({}, {
    get(_, prop) {
      if (prop === "$connect" || prop === "$disconnect") return () => Promise.resolve();
      if (prop === "$transaction") return (fn: (tx: unknown) => Promise<unknown>) => fn(createMockPrismaClient());
      if (prop === "$queryRawUnsafe" || prop === "$executeRawUnsafe") return () => Promise.resolve([]);
      return createModelProxy();
    }
  });
}

export { prisma };
export default prisma;
