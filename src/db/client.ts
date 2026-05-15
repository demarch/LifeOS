import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'lifeos.db');

const sqliteClient = new Database(DB_PATH);
sqliteClient.pragma('journal_mode = WAL');
sqliteClient.pragma('foreign_keys = ON');

export const sqlite = sqliteClient;
export const db = drizzle(sqliteClient, { schema });
