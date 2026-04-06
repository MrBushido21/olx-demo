import 'dotenv/config';

export const envcheker = () => {
    const POSTGRES_DB = process.env.AUTH_POSTGRES_DB
    const LISTINGS_POSTGRES_DB = process.env.LISTINGS_POSTGRES_DB
    const AUTH_PORT = process.env.AUTH_PORT
    const LISTINGS_PORT = process.env.LISTINGS_PORT
    const USERS_PORT = process.env.USERS_PORT

    const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET
    const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET
    const POSTGRES_USER = process.env.POSTGRES_USER
    const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD
    const DB_HOST = process.env.DB_HOST
    const DB_PORT = process.env.DB_PORT
    const APP_PORT = process.env.APP_PORT
    const BASE_URL = process.env.BASE_URL

    if (JWT_ACCESS_SECRET === "" || !JWT_ACCESS_SECRET) {
        throw new Error("JWT_ACCESS_SECRET не задана")
    }
    if (JWT_REFRESH_SECRET === "" || !JWT_REFRESH_SECRET) {
        throw new Error("JWT_REFRESH_SECRET не задана")
    }
    if (POSTGRES_USER === "" || !POSTGRES_USER) {
        throw new Error("POSTGRES_USER не задана")
    }
    if (POSTGRES_PASSWORD === "" || !POSTGRES_PASSWORD) {
        throw new Error("POSTGRES_PASSWORD не задана")
    }
    if (POSTGRES_DB === "" || !POSTGRES_DB) {
        throw new Error("AUTH_POSTGRES_DB не задана")
    }
    if (DB_HOST === "" || !DB_HOST) {
        throw new Error("DB_HOST не задана")
    }
    if (DB_PORT === "" || !DB_PORT) {
        throw new Error("DB_PORT не задана")
    }
    if (APP_PORT === "" || !APP_PORT) {
        throw new Error("APP_PORT не задана")
    }
    if (BASE_URL === "" || !BASE_URL) {
        throw new Error("BASE_URL не задана")
    }
    if (LISTINGS_POSTGRES_DB === "" || !LISTINGS_POSTGRES_DB) {
        throw new Error("LISTINGS_POSTGRES_DB не задана")
    }
    if (AUTH_PORT === "" || !AUTH_PORT) {
        throw new Error("AUTH_PORT не задана")
    }
    if (LISTINGS_PORT === "" || !LISTINGS_PORT) {
        throw new Error("LISTINGS_PORT не задана")
    }
    if (USERS_PORT === "" || !USERS_PORT) {
        throw new Error("USERS_PORT не задана")
    }

    const RABBITMQ_URL = process.env.RABBITMQ_URL
    if (RABBITMQ_URL === "" || !RABBITMQ_URL) {
        throw new Error("RABBITMQ_URL не задана")
    }

    return {
        JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, POSTGRES_USER,
        POSTGRES_PASSWORD,
        POSTGRES_DB,
        DB_HOST,
        DB_PORT,
        APP_PORT,
        BASE_URL,
        LISTINGS_POSTGRES_DB,
        AUTH_PORT,
        LISTINGS_PORT,
        USERS_PORT,
        RABBITMQ_URL
    }
}

export const env = envcheker();