import { Router } from "express";
import { getHealthStatus } from "../modules/health/health.service";
import { bootstrapStoreHandler, getStoreHandler } from "../modules/store/store.controller";

export const apiRouter = Router();

apiRouter.get("/health", async (_req, res, next) => {
  try {
    const status = await getHealthStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/store", getStoreHandler);
apiRouter.post("/store/bootstrap", bootstrapStoreHandler);