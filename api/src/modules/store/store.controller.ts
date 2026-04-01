import type { Request, Response, NextFunction } from "express";
import { bootstrapStore, getStore } from "./store.service";

export async function getStoreHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const store = await getStore();
    res.json({
      ok: true,
      data: store
    });
  } catch (error) {
    next(error);
  }
}

export async function bootstrapStoreHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const store = await bootstrapStore();
    res.status(201).json({
      ok: true,
      data: store
    });
  } catch (error) {
    next(error);
  }
}