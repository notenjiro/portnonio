import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { apiRouter } from "../routes/index";
import { AppError } from "../shared/errors";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "portnonio-api",
    });
  });

  app.use("/api", apiRouter);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        ok: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
      return;
    }

    console.error(err);

    res.status(500).json({
      ok: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
    });
  });

  return app;
}