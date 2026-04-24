import { Router } from "express";
import { db } from "@workspace/db";
import { boostCodesTable, playerBoostsTable, codeRedemptionsTable, playersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { CreateCodeBody, RedeemCodeBody } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/admin";

const router = Router();

// Admin-only: create a boost code. Supported boostType values:
//   - skip_parcours        (stored as a usable boost; value = parcours to skip)
//   - skip_level           (stored as a usable boost; value = levels to skip)
//   - coins                (instantly granted on redemption; value = coins added)
//   - protection_parcours  (stored as a usable boost; value = parcours protected)
//   - protection_level     (stored as a usable boost; value = levels protected)
router.post("/codes", requireAdmin, async (req, res) => {
  const parsed = CreateCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { code, boostType, value } = parsed.data;

  const existing = await db.select().from(boostCodesTable).where(eq(boostCodesTable.code, code)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Code already exists" });
    return;
  }

  const [created] = await db.insert(boostCodesTable).values({
    code,
    boostType,
    value: value || 1,
  }).returning();

  res.json(created);
});

router.post("/codes/redeem", async (req, res) => {
  const parsed = RedeemCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { playerId, code } = parsed.data;

  const [boostCode] = await db.select().from(boostCodesTable).where(eq(boostCodesTable.code, code)).limit(1);
  if (!boostCode) {
    res.json({ success: false, message: "Code invalide" });
    return;
  }

  const existingRedemption = await db.select().from(codeRedemptionsTable)
    .where(and(
      eq(codeRedemptionsTable.playerId, playerId),
      eq(codeRedemptionsTable.codeId, boostCode.id)
    ))
    .limit(1);

  if (existingRedemption.length > 0) {
    res.json({ success: false, message: "Tu as déjà utilisé ce code" });
    return;
  }

  await db.insert(codeRedemptionsTable).values({
    playerId,
    codeId: boostCode.id,
  });

  // Coins are credited immediately and no usable boost is recorded.
  if (boostCode.boostType === "coins") {
    await db.update(playersTable)
      .set({ coins: sql`${playersTable.coins} + ${boostCode.value}` })
      .where(eq(playersTable.id, playerId));
    res.json({
      success: true,
      message: `Code activé ! +${boostCode.value} coins`,
    });
    return;
  }

  const [boost] = await db.insert(playerBoostsTable).values({
    playerId,
    boostType: boostCode.boostType,
    value: boostCode.value,
    used: false,
    codeId: boostCode.id,
  }).returning();

  res.json({
    success: true,
    message: "Code activé avec succès !",
    boost,
  });
});

export default router;
