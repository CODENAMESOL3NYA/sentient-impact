import express from 'express';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import apiRoutes from './server/routes/api';
import { errorHandler,notFoundHandler } from './server/middleware/errorHandler';

//Load Environment variables
dotenv.config();

const app = express();

const PORT = process.env.PORT||3000;

//Load standard express middleware
app.use(express.json({ limit:'5mb'}));
app.use(express.urlencoded({extended:true}));

// Request logging middleware for audit trail
app.use((req,res,next)=>{
    const start = Date.now();
    res.on('finish',()=>{
        const duration = Date.now() - start;
        if(req.originalUrl.startsWith('/api')){
            console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${duration}ms`);
        }
    });
    next();
});

//Health Check endpoint
app.get('/api/health',(req,res)=>{
    res.json({
        status:'healthy',
        service:'Impact Sentinel API Bridge',
        version:'1.0.0',
        bobcoinReserve:'Protected (SHA-256 Deduplication Active)',
        timestamp: new Date().toISOString(),
    });
});

//Mount api route
app.use('/api',apiRoutes);

//Server
async function startServer(){
    const distPath = path.resolve(process.cwd(),'dist');
    const hasDist = fs.existsSync(distPath);

    if(process.env.NODE_ENV==='production' || hasDist){
        app.use(express.static(distPath));
        // Exclude /api/* from the SPA fallback so unknown API routes reach
        // the notFoundHandler below instead of returning index.html with a 200.
        app.get(/^(?!\/api\/).*$/, (_req, res) => {
            res.sendFile(path.join(distPath,'index.html'));
        });
    }else{
        try {
            const {createServer: createViteServer} = await import('vite');
            const vite = await createViteServer({
                server:{middlewareMode:true},
                appType:'spa',
            });
            app.use(vite.middlewares);
        } catch (err) {
            console.warn('[Vite Middleware] Running in API-only or standalone mode:',err);
        }
    }

    app.use('/api/*',notFoundHandler);
    app.use(errorHandler);

    app.listen(Number(PORT),'0.0.0.0',()=>{
    console.log(`================================================================`);
    console.log(`Impact Sentinel Backend Bridge listening on port ${PORT}`);
    console.log(`Bobcoin Safety Guard: Active (Deterministic SHA-256 Cache)`);
    console.log(`Subagent Orchestrator: Ready for Agent A & B Parallel Execution`);
    console.log(`================================================================`);
    })
}
startServer();