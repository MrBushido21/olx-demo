import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken'
import { env } from 'libs/common/conf/env.checker';

@Injectable()
export class CheckAuthMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        try {
            const authHeader = req.headers.authorization;

            // Validate header existence and type
            if (!authHeader) {
                throw new UnauthorizedException('Authorization header missing or authHeader')
            }

            // Validate header existence and type
            if (typeof authHeader !== 'string') {
                throw new UnauthorizedException('Authorization header missing or invalid')
            }

            // Check if it starts with "Bearer "
            if (!authHeader.startsWith('Bearer ')) {
                throw new UnauthorizedException('Invalid authorization format')
            }

            // Slice out the token part
            const token = authHeader.split(' ')[1]; // Remove "Bearer " (7 chars)

            if (!token) {
                return res.status(401).json({ error: 'Token missing' });
            }

            const verified = jwt.verify(token, env.JWT_ACCESS_SECRET);
            if (verified) {
                const payload = jwt.decode(token)
                if (payload && typeof payload !== 'string') {
                    req.user = { id: payload.id, username: payload.username }
                }
                next();
            }

        } catch (err) {
            if (err instanceof jwt.TokenExpiredError) {
                return res.status(401).json({ error: 'Token expired' });
            }
            if (err instanceof UnauthorizedException) {
                return res.status(401).json({ error: err.message });
            }
            console.error('Error processing authorization header:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }
}
