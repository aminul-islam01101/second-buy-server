/* eslint-disable consistent-return */
/* eslint-disable no-empty */
import colors from 'colors';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import jwt from 'jsonwebtoken';
import { MongoClient, ObjectId } from 'mongodb';

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
        const productCollection = client.db('secondBuy').collection('books');

        const usersCollection = client.db('secondBuy').collection('users');
        const bookingsCollection = client.db('secondBuy').collection('bookings');
        const categoryCollection = client.db('secondBuy').collection('bookCategory');

        // searching category wise books
        app.get('/book/:id', async (req, res) => {
            const { id } = req.params;
            const query = { _id: ObjectId(id) };
            const book = await productCollection.findOne(query);
            res.send(book);
        });

        // saving buyer in USERS collection

        app.put('/user/:email', async (req, res) => {
            const { email } = req.params;
            const user = req.body;
            const filter = { email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: user,
            };

            const result = await usersCollection.updateOne(filter, updatedDoc, options);

            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '10d',
            });
            res.send({ result, token });
        });
        //  get user role by email from user collection
        app.get('/user/:email', async (req, res) => {
            const { email } = req.params;
            const query = { email };
            const user = await usersCollection.findOne(query);
            if (user.role === 'seller') {
                return res.send({ message: 'invalid user:this is a seller id ' });
            }
            res.send({ message: 'success', user });
        });

        // insert a new booking: PUT
        app.put('/booking/:email', async (req, res) => {
            const { email } = req.params;
            const { bookedProductId } = req.body;
            console.log(email, bookedProductId);

            const bookingInfo = req.body;
            const filter = { email, bookedProductId };
            const options = { upsert: true };
            const updatedDoc = {
                $set: bookingInfo,
            };

            const result = await bookingsCollection.updateOne(filter, updatedDoc, options);

            res.send(result);
        });
        // seller id finding
        app.get('/users/seller/:email', async (req, res) => {
            const { email } = req.params;
            const query = { email };
            console.log(email);
            const user = await usersCollection.findOne(query);
            res.send({ isSeller: user?.role === 'seller' });
        });
        // admin id finding
        app.get('/users/admin/:email', async (req, res) => {
            const { email } = req.params;
            const query = { email };
            const user = await usersCollection.findOne(query);
            res.send({
                isAdmin: user?.adminRole === 'yes',
            });
        });
        // buyer id finding
        app.get('/users/buyer/:email', async (req, res) => {
            const { email } = req.params;
            console.log(email);

            const query = { email };
            const user = await usersCollection.findOne(query);
            res.send({ isBuyer: user?.role === 'buyer' });
        });

        // dashboard sections routes

        // seller route
        // add product page: GET Category

        app.get('/bookcategory', async (req, res) => {
            const query = {};
            const categories = await categoryCollection.find(query).toArray();
            res.send(categories);
        });
        // add product page: POST a book
        app.post('/addbook', async (req, res) => {
            const { bookName, edition } = req.body;
            const query = { bookName, edition };
            const alreadyStored = await productCollection.findOne(query);
            if (alreadyStored) {
                res.send({ message: 'You Have already posted this book' });
                return;
            }
            res.send(await productCollection.insertOne(req.body));
        });

        // my product page: GET a sellers all product

        app.get('/users/seller', async (req, res) => {
            const { email } = req.query;

            const query = { sellerEmail: email };
            const myProducts = await productCollection.find(query).toArray();
            res.send(myProducts);
        });
        // myProduct Page: advertise functionality
        app.put('/myproduct/:id', async (req, res) => {
            const { id } = req.params;
            const query = { _id: ObjectId(id) };
            const selectedProduct = await productCollection.findOne(query);
            const { status, advertised } = selectedProduct;
            console.log(status, advertised);

            if (status === 'available') {
                const filter = { advertised };
                const options = { upsert: true };
                const updatedDoc = {
                    $set: { advertised: !advertised },
                };
                const result = await productCollection.updateOne(filter, updatedDoc, options);
                console.log(result);
            }

            const product = await productCollection.findOne(query);
            const advertiseStatus = product.advertised;
            res.send(advertiseStatus);
        });
// myproduct DELETE:

app.delete('/myproduct/:id', async (req, res) => {
    const { id } = req.params;
    const filter = { _id: ObjectId(id) };
    const result = await productCollection.deleteOne(filter);
    res.send(result);
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
