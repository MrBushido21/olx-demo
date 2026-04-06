CREATE DATABASE nestdb;
CREATE DATABASE listings_nestdb;
CREATE DATABASE users_nestdb;

\c listings_nestdb
  CREATE EXTENSION IF NOT EXISTS pg_trgm