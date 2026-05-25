import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Clear in dependency order
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.product.deleteMany();
  await prisma.ingredient.deleteMany();

  // Reset sequences
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Product_id_seq" RESTART WITH 1`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Ingredient_id_seq" RESTART WITH 1`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Recipe_id_seq" RESTART WITH 1`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Order_id_seq" RESTART WITH 1`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "OrderItem_id_seq" RESTART WITH 1`);

  console.log('Seed complete (empty database). Use Dev Panel → Seed Basic or Seed Full to load fixtures.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
