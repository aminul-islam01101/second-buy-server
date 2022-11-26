/* eslint-disable no-param-reassign */
/* eslint-disable consistent-return */
/* eslint-disable no-empty */
import colors from 'colors';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import jwt from 'jsonwebtoken';
import { MongoClient, ObjectId } from 'mongodb';
import Stripe from 'stripe';

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
// stripe
const stripe = new Stripe(process.env.STRIPE_SECRET);

// Set up default mongoose connection
const mongoDB = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.dtbllhc.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(mongoDB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// JWT middleware
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    console.log(authHeader.error);

    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];
    console.log(token.warn);

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' });
        }
        req.decoded = decoded;
        console.log(req.decoded);
        next();
    });
}

const run = async () => {
    try {
        const productCollection = client.db('secondBuy').collection('books');
        const usersCollection = client.db('secondBuy').collection('users');
        const bookingsCollection = client.db('secondBuy').collection('bookings');
        const categoryCollection = client.db('secondBuy').collection('bookCategory');
        const paymentsCollection = client.db('secondBuy').collection('payments');

        // verify admin middleware
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            console.log(decodedEmail.error);

            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        };

        app.get('/categories', async (req, res) => {
            const query = {};
            const categories = await categoryCollection.find(query).toArray();
            const availableQuery = { status: 'available' };
            const availableProducts = await productCollection.find(availableQuery).toArray();

            categories.forEach(async (category) => {
                const { categoryId } = category;
                const products = availableProducts.filter(
                    (product) => product.categoryId === categoryId
                );
                const newFilter = { categoryId };
                const newOptions = { upsert: true };
                const newUpdatedDoc = {
                    $set: { products },
                };
                const updatedCategory = await categoryCollection.updateOne(
                    newFilter,
                    newUpdatedDoc,
                    newOptions
                );
                res.send(categories);
            });
        });

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

            const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
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

        // for dashboard user role
        app.get('/user', async (req, res) => {
            const { email } = req.query;
            const query = { email };
            const user = await usersCollection.findOne(query);
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
                isAdmin: user?.role === 'admin',
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

        //! check this route
        app.get('/bookcategory/:id', async (req, res) => {
            const { id } = req.params;

            const query = {
                categoryId: id,
                status: 'available',
            };
            const categories = await productCollection.find(query).toArray();

            const filter = { categoryId: id };
            const options = { upsert: true };
            const updatedDoc = {
                $set: { products: categories },
            };
            const result = await categoryCollection.updateOne(filter, updatedDoc, options);

            res.send(result);
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
            const addBook = await productCollection.insertOne(req.body);

            res.send(addBook);
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

            if (status === 'available') {
                console.log(status, advertised);
                const filter = { _id: ObjectId(id) };
                const options = { upsert: true };
                const updatedDoc = {
                    $set: { advertised: !advertised },
                };
                const result = await productCollection.updateOne(filter, updatedDoc, options);
                res.send(result);
                console.log(selectedProduct);

                return;
            }

            res.send('product is not available');
        });
        // myproduct DELETE:

        app.delete('/myproduct/:id', async (req, res) => {
            const { id } = req.params;
            const filter = { _id: ObjectId(id) };
            const result = await productCollection.deleteOne(filter);
            res.send(result);
        });

        // admin route work

        // GET all seller
        app.get('/users/sellers', verifyJWT, verifyAdmin, async (req, res) => {
            const query = { role: 'seller' };
            const myProducts = await usersCollection.find(query).toArray();
            res.send(myProducts);
        });

        // verify a seller

        app.put('/seller/:email', async (req, res) => {
            const { email } = req.params;
            const query = { email };
            const selectedSeller = await usersCollection.findOne(query);

            const { verified } = selectedSeller;

            const filter = { email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: { verified: !verified },
            };
            const result = await usersCollection.updateOne(filter, updatedDoc, options);

            res.send(result);
        });

        //  DELETE: a seller

        app.delete('/users/sellers', async (req, res) => {
            const { email } = req.query;
            const filter = { email };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        });

        // GET all seller
        app.get('/users/buyers', async (req, res) => {
            const query = { role: 'buyer' };
            const myProducts = await usersCollection.find(query).toArray();
            res.send(myProducts);
        });
        //  DELETE: a buyer
        app.delete('/users/buyers', async (req, res) => {
            const { email } = req.query;
            const filter = { email };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        });
        // reported page
        //!     "true"  should be true
        app.get('/products/reported', async (req, res) => {
            const query = { reported: 'true' };
            const reportedProducts = await productCollection.find(query).toArray();
            res.send(reportedProducts);
        });
        // DELETE reported products
        app.delete('/products/reported', async (req, res) => {
            const { id } = req.query;
            const filter = { _id: ObjectId(id) };
            const result = await productCollection.deleteOne(filter);
            res.send(result);
        });

        // buyer page routes
        // my orders page: GET all orders of a buyer
        app.get('/users/buyer', verifyJWT, async (req, res) => {
            const { email } = req.query;

            const query = { buyerEmail: email };
            const myOrders = await bookingsCollection.find(query).toArray();
            res.send(myOrders);
        });
        // payments

        app.get('/payment/:id', async (req, res) => {
            const { id } = req.params;
            console.log(id);

            const query = { _id: ObjectId(id) };
            const bookedProduct = await bookingsCollection.findOne(query);
            res.send(bookedProduct);
        });
        // payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const { price } = booking;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount,
                payment_method_types: ['card'],
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });
        // POST a payment
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const id = payment.bookingId;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                },
            };
            const updatedResult = await bookingsCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });

        // make product status sold
        app.put('/paid/:id', async (req, res) => {
            const { id } = req.params;

            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: { status: 'sold' },
            };
            const result = await productCollection.updateOne(filter, updatedDoc, options);

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
