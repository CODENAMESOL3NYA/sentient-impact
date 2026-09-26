import type { Request, Response, NextFunction} from 'express';

/**
 * Standardized API Error interface
 */

export interface ApiErrorResponse{
    error:string;
    statusCode:number;
    message:string;
    details?:unknown;
    timestamp:string;
    path:string;
    bobcoinsRefunded:boolean;
}

/**
 * Custom application error with HTTP status code
 */
export class AppError extends Error{
    public statusCode:number;
    public details?:unknown;

    constructor(message:string, statusCode=500, details?:unknown){
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.details=details
    }
}

/**
 * Central Express Error Boundary Middleware
 * Catches unhandled rejections, JSON parse errors, network timeouts
 * and formats clean, predictable error payloads for the frontend
 */
export function errorHandler(err:Error|AppError,req:Request,res:Response,next:NextFunction):void{
    const statusCode = 'statusCode' in err ? err.statusCode: 500;
    const isTimeout = err.name === 'AbortError' || err.name === 'TimeoutError';

    const errorPayload:ApiErrorResponse={
        error:isTimeout?'AI_AGENT_TIMEOUT':err.name || 'INTERNAL_SERVER_ERROR',
        statusCode:isTimeout?504:statusCode,
        message:isTimeout
        ?'The subagent request timed out before receiving a response from the model.'
        :err.message||'An unexpected server error occured.',
        details:'details' in err ? err.details:undefined,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        bobcoinsRefunded:true
    };
    if(process.env.NODE_ENV !=='production'){
        console.error(`[Error Boundary] ${req.method} ${req.originalUrl}:`,err);
    }
    res.status(errorPayload.statusCode).json(errorPayload)
}
/**
 * 404 Route Not Found Middleware
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'NOT_FOUND',
    statusCode: 404,
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist on this server.`,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  });
}