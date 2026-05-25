import { prisma } from '../prisma.js';
import { Prisma } from '@prisma/client';

export async function createOrder(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('Order must contain at least one item');
    err.status = 400;
    throw err;
  }

  for (const item of items) {
    if (!Number.isInteger(item.productId) || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      const err = new Error('Each item must have a valid productId and a positive integer quantity');
      err.status = 400;
      throw err;
    }
  }

  return prisma.$transaction(async (tx) => {
    const productIds = [...new Set(items.map((i) => i.productId))];
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      include: { recipes: { include: { ingredient: true } } },
    });

    if (products.length !== productIds.length) {
      const found = new Set(products.map((p) => p.id));
      const missing = productIds.filter((id) => !found.has(id));
      const err = new Error('Unknown productId');
      err.status = 400;
      err.details = { missing };
      throw err;
    }

    const productById = new Map(products.map((p) => [p.id, p]));

    // ingredientId -> { required, name, unit, available, costPerUnit }
    const requirements = new Map();
    for (const item of items) {
      const product = productById.get(item.productId);
      for (const recipe of product.recipes) {
        const required = Number(recipe.quantityRequired) * item.quantity;
        const existing = requirements.get(recipe.ingredientId);
        if (existing) {
          existing.required += required;
        } else {
          requirements.set(recipe.ingredientId, {
            ingredientId: recipe.ingredientId,
            name: recipe.ingredient.name,
            unit: recipe.ingredient.unit,
            required,
            available: Number(recipe.ingredient.stockQuantity),
            costPerUnit: Number(recipe.ingredient.costPerUnit || 0),
          });
        }
      }
    }

    const shortages = [];
    for (const r of requirements.values()) {
      if (r.available < r.required) {
        shortages.push({
          ingredientId: r.ingredientId,
          name: r.name,
          required: r.required,
          available: r.available,
          unit: r.unit,
        });
      }
    }

    if (shortages.length > 0) {
      const err = new Error('Insufficient stock');
      err.status = 400;
      err.details = { shortages };
      throw err;
    }

    for (const r of requirements.values()) {
      await tx.ingredient.update({
        where: { id: r.ingredientId },
        data: { stockQuantity: { decrement: r.required } },
      });
    }

    let total = 0;
    const orderItemsData = items.map((item) => {
      const product = productById.get(item.productId);
      const unitPrice = Number(product.price);
      total += unitPrice * item.quantity;

      // Snapshot ingredient cost at time of sale
      let ingredientCost = 0;
      for (const recipe of product.recipes) {
        const ing = requirements.get(recipe.ingredientId);
        ingredientCost += Number(recipe.quantityRequired) * item.quantity * (ing?.costPerUnit ?? 0);
      }

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        ingredientCost,
      };
    });

    const order = await tx.order.create({
      data: {
        total,
        items: { create: orderItemsData },
      },
      include: {
        items: { include: { product: { select: { id: true, name: true } } } },
      },
    });

    return order;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function voidOrder(id) {
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('Invalid order id');
    err.status = 400;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      include: { items: { include: { product: { include: { recipes: true } } } } },
    });
    if (!order) {
      const err = new Error('Order not found');
      err.status = 404;
      throw err;
    }

    // Refund stock per item's recipe.
    for (const item of order.items) {
      for (const recipe of item.product.recipes) {
        const refund = Number(recipe.quantityRequired) * item.quantity;
        await tx.ingredient.update({
          where: { id: recipe.ingredientId },
          data: { stockQuantity: { increment: refund } },
        });
      }
    }

    await tx.orderItem.deleteMany({ where: { orderId: id } });
    await tx.order.delete({ where: { id } });

    return { id, refunded: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listOrders({ from, to } = {}) {
  const where = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }
  return prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      items: { include: { product: { select: { id: true, name: true } } } },
    },
  });
}
