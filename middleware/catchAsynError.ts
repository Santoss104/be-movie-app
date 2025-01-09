import { Request, Response, NextFunction } from "express";

export const CatchAsyncError = (theFunc: any) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await theFunc(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};
