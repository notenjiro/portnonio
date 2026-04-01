import type { NextFunction, Request, Response } from "express";
import { getCalendarData, parseCalendarScope } from "./calendar.service";

export async function getCalendarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = parseCalendarScope(req.query.scope);
    const result = await getCalendarData(scope);

    res.json({
      ok: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}