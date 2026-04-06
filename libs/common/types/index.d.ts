interface Payload {
 id:string,
 username: string
}

declare namespace Express {
  interface Request {
    user?: Payload;
  }
}