import { prisma } from '../prisma.js';

export async function listIngredients(req, res, next) {
  try {
    const ingredients = await prisma.ingredient.findMany({ orderBy: { id: 'asc' } });
    res.json(ingredients);
  } catch (err) {
    next(err);
  }
}

export async function createIngredient(req, res, next) {
  try {
    const { name, unit, stockQuantity, costPerUnit, lowStockThreshold } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!['g', 'ml', 'pcs'].includes(unit)) {
      return res.status(400).json({ error: "unit must be one of 'g', 'ml', 'pcs'" });
    }
    if (stockQuantity == null || isNaN(Number(stockQuantity)) || Number(stockQuantity) < 0) {
      return res.status(400).json({ error: 'stockQuantity must be a non-negative number' });
    }

    const ingredient = await prisma.ingredient.create({
      data: {
        name,
        unit,
        stockQuantity: Number(stockQuantity),
        costPerUnit: costPerUnit != null ? Number(costPerUnit) : null,
        lowStockThreshold: lowStockThreshold != null ? Number(lowStockThreshold) : 100,
      },
    });
    res.status(201).json(ingredient);
  } catch (err) {
    next(err);
  }
}

export async function updateIngredientStock(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'id must be an integer' });
    }
    const { stockQuantity, lowStockThreshold, costPerUnit } = req.body;
    if (stockQuantity == null || isNaN(Number(stockQuantity)) || Number(stockQuantity) < 0) {
      return res.status(400).json({ error: 'stockQuantity must be a non-negative number' });
    }

    const existing = await prisma.ingredient.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Ingredient not found' });

    const data = { stockQuantity: Number(stockQuantity) };
    if (lowStockThreshold != null) {
      data.lowStockThreshold = Number(lowStockThreshold);
    }
    if (costPerUnit !== undefined) {
      if (costPerUnit === null || costPerUnit === '') {
        data.costPerUnit = null;
      } else if (isNaN(Number(costPerUnit)) || Number(costPerUnit) < 0) {
        return res.status(400).json({ error: 'costPerUnit must be a non-negative number or null' });
      } else {
        data.costPerUnit = Number(costPerUnit);
      }
    }

    const ingredient = await prisma.ingredient.update({
      where: { id },
      data,
    });
    res.json(ingredient);
  } catch (err) {
    next(err);
  }
}

export async function deleteIngredient(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'id must be an integer' });
    }
    const existing = await prisma.ingredient.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Ingredient not found' });

    // Check if any recipes reference this ingredient
    const recipeCount = await prisma.recipe.count({ where: { ingredientId: id } });
    if (recipeCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete ingredient used in ' + recipeCount + ' recipe(s). Remove it from those products first.',
      });
    }

    await prisma.ingredient.delete({ where: { id } });
    res.json({ message: 'Ingredient deleted' });
  } catch (err) {
    next(err);
  }
}
