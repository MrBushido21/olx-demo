import { Users } from "apps/auth/entities/user.entity";

interface Payload {
 id:string,
 username: string
}

declare global {
  namespace Express {
    export interface Request {
      user?: Payload; // Make it optional if not always set
    }
  }
}