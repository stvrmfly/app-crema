import { prisma } from '../prisma.js';

export async function listProducts(req, res, next) {
  try {
    const products = await prisma.product.findMany({
      orderBy: { id: 'asc' },
      include: {
        recipes: {
          include: { ingredient: { select: { id: true, name: true, unit: true } } },
        },
      },
    });
    res.json(products);
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req, res, next) {
  try {
    const { name, price, recipe } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }
    if (price == null || isNaN(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ error: 'price must be a non-negative number' });
    }
    if (recipe != null && !Array.isArray(recipe)) {
      return res.status(400).json({ error: 'recipe must be an array' });
    }

    const recipeLines = (recipe ?? []).map((r) => {
      if (!Number.isInteger(r.ingredientId) || isNaN(Number(r.quantityRequired)) || Number(r.quantityRequired) <= 0) {
        const err = new Error('Each recipe entry needs an integer ingredientId and positive quantityRequired');
        err.status = 400;
        throw err;
      }
      return { ingredientId: r.ingredientId, quantityRequired: Number(r.quantityRequired) };
    });

    const product = await prisma.product.create({
      data: {
        name,
        price: Number(price),
        recipes: { create: recipeLines },
      },
      include: {
        recipes: {
          include: { ingredient: { select: { id: true, name: true, unit: true } } },
        },
      },
    });
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'id must be an integer' });
    }
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const { name, price, recipe } = req.body;
    const data = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'name must be a non-empty string' });
      }
      data.name = name.trim();
    }
    if (price !== undefined) {
      if (isNaN(Number(price)) || Number(price) < 0) {
        return res.status(400).json({ error: 'price must be a non-negative number' });
      }
      data.price = Number(price);
    }

    if (recipe !== undefined) {
      if (!Array.isArray(recipe)) {
        return res.status(400).json({ error: 'recipe must be an array' });
      }
      const recipeLines = recipe.map((r) => {
        if (!Number.isInteger(r.ingredientId) || isNaN(Number(r.quantityRequired)) || Number(r.quantityRequired) <= 0) {
          const err = new Error('Each recipe entry needs an integer ingredientId and positive quantityRequired');
          err.status = 400;
          throw err;
        }
        return { ingredientId: r.ingredientId, quantityRequired: Number(r.quantityRequired) };
      });

      const product = await prisma.$transaction(async (tx) => {
        await tx.recipe.deleteMany({ where: { productId: id } });
        return tx.product.update({
          where: { id },
          data: { ...data, recipes: { create: recipeLines } },
          include: {
            recipes: { include: { ingredient: { select: { id: true, name: true, unit: true } } } },
          },
        });
      });
      return res.json(product);
    }

    const product = await prisma.product.update({
      where: { id },
      data,
      include: {
        recipes: {
          include: { ingredient: { select: { id: true, name: true, unit: true } } },
        },
      },
    });
    res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'id must be an integer' });
    }
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    // Check if any order items reference this product
    const orderItemCount = await prisma.orderItem.count({ where: { productId: id } });
    if (orderItemCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete product with existing orders. It has been used in ' + orderItemCount + ' order item(s).',
      });
    }

    // Delete recipes first, then the product
    await prisma.recipe.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
}
