import { Router } from "express";
import { db } from "@workspace/db";
import { boostCodesTable, playerBoostsTable, codeRedemptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateCodeBody, RedeemCodeBody } from "@workspace/api-zod";

const router = Router();

router.post("/codes", async (req, res) => {
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
    res.json({ success: false, message: "Tu as deja utilise ce code" });
    return;
  }

  await db.insert(codeRedemptionsTable).values({
    playerId,
    codeId: boostCode.id,
  });

  const [boost] = await db.insert(playerBoostsTable).values({
    playerId,
    boostType: boostCode.boostType,
    value: boostCode.value,
    used: false,
    codeId: boostCode.id,
  }).returning();

  res.json({
    success: true,
    message: "Code active avec succes !",
    boost,
  });
});

export default router;
