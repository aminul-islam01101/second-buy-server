/* eslint-disable no-empty */
import colors from 'colors';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { MongoClient } from 'mongodb';

// port and env
dotenv.config();
const app = express();
const port = process.env.PORT;
// middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

// Set up default mongoose connection
const mongoDB = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.dtbllhc.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(mongoDB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const run = async () => {
    try {
        const productCollection = client.db('books').collection('books');
        app.post('/books', async (req, res) => {
            res.send(await productCollection.insertOne(req.body));
        });
    } finally {
    }
};
run().catch((err) => console.log(err));

colors.setTheme({
    info: 'green',
    help: 'cyan',
    warn: 'yellow',
    error: 'red',
});

app.get('/', (_req, res) => {
    res.send('First test server ');
});
// Error middleware
// 404 handlers

app.use((req, res) => {
    res.status(404).send('404 error! url does not exist');
});

app.use((err, req, res, next) => {
    if (res.headerSent) {
        return next(err);
    }

    return res.status(500).send('Something broke!');
});

app.listen(port, () => {
    console.log('Server running on ports'.warn.italic, port);
});
