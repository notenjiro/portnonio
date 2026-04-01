import type { NextFunction, Request, Response } from "express";
import { getPositionsData } from "./positions.service";

export async function getPositionsHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getPositionsData();

    res.json({
      ok: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}