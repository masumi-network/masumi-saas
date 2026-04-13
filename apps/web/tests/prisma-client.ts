if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env");
}

const { default: prisma } = await import("@masumi/database/client");

export default prisma;
