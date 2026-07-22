import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const user = await prisma.user.upsert({ where: { email: "demo@example.com" }, update: {}, create: { email: "demo@example.com" } });
await prisma.avatarProfile.upsert({
  where: { userId: user.id }, update: {},
  create: { userId: user.id, config: { archetype: "seated_desk", palette: "ref_blue", parts: {} } },
});
console.log("seeded demo user", user.email);
await prisma.$disconnect();
