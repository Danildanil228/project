import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use('/api/auth', toNodeHandler(auth));
app.listen(3000);