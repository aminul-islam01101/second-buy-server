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
        const wishCollection = client.db('secondBuy').collection('wishlist');
        const blogsCollection = client.db('secondBuy').collection('blogs');

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

        // get advertised products
        app.get('/advertised', async (req, res) => {
            const query = { advertised: true, status: 'available' };
            const advertised = await productCollection.find(query).toArray();
            res.send(advertised);
        });

        // all books
        app.get('/books', async (req, res) => {
            const query = {};
            const books = await productCollection.find(query).toArray();
            res.send(books);
        });

        // searching category wise books
        app.get('/book/:id', async (req, res) => {
            const { id } = req.params;
            const query = { _id: ObjectId(id) };
            const book = await productCollection.findOne(query);
            res.send(book);
        });
        app.get('/booksold', async (req, res) => {
            const query = { status: 'sold' };
            const bookSold = await productCollection.find(query).toArray();
            res.send(bookSold);
        });
        // Book reported route
        app.put('/book/reported/:id', async (req, res) => {
            const { id } = req.params;

            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: { isReported: true },
            };
            console.log(id);

            const result = await productCollection.updateOne(filter, updatedDoc, options);

            res.send(result);
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
        app.get('/buyer/:email', async (req, res) => {
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

        // all categories
        app.get('/bookcategory', async (req, res) => {
            const query = {};
            const categories = await categoryCollection.find(query).toArray();
            res.send(categories);
        });

        //  category routes: products add to category collection
        app.get('/categories', async (req, res) => {
            const query = {};
            const categories = await categoryCollection.find(query).toArray();
            const availableQuery = { status: 'available' };
            const availableProducts = await productCollection.find(availableQuery).toArray();

            if (availableProducts) {
                categories.forEach(async (category) => {
                    const { categoryId } = category;
                    const products = availableProducts.filter(
                        (product) => product.categoryId === categoryId
                    );
                    const filter = { categoryId };
                    const options = { upsert: true };
                    const updatedDoc = {
                        $set: { products },
                    };
                    const updatedCategory = await categoryCollection.updateOne(
                        filter,
                        updatedDoc,
                        options
                    );
                });
                res.send(categories);
                return;
            }

            res.send('No products found');
        });

        // get a category data
        app.get('/category/:id', async (req, res) => {
            const { id } = req.params;
            const query = {
                categoryId: id,
            };
            const categories = await categoryCollection.findOne(query);
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
        // GET all seller stat
        app.get('/users/allseller', async (req, res) => {
            const query = { role: 'seller' };
            const myProducts = await usersCollection.find(query).toArray();
            res.send(myProducts);
        });

        
        // verify a seller

        app.put('/seller/:email', verifyJWT, verifyAdmin, async (req, res) => {
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

        // is seller verified
        app.get('/sellers/verified/:email', async (req, res) => {
            const { email } = req.params;

            const query = { email };
            const seller = await usersCollection.findOne(query);
            res.send(seller);
        });

        //  DELETE: a seller

        app.delete('/users/sellers', async (req, res) => {
            const { email } = req.query;
            const filter = { email };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        });

        // GET all buyer
        app.get('/users/buyers', async (req, res) => {
            const query = { role: 'buyer' };
            const buyers = await usersCollection.find(query).toArray();
            res.send(buyers);
        });
        // GET all buyer statt
        app.get('/users/allbuyer', async (req, res) => {
            const query = { role: 'buyer' };
            const buyers = await usersCollection.find(query).toArray();
            res.send(buyers);
        });
        //  DELETE: a buyer
        app.delete('/users/buyers', async (req, res) => {
            const { email } = req.query;
            const filter = { email };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        });
        // reported page

        app.get('/products/reported', async (req, res) => {
            const query = { isReported: true };
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
            const buyerInfo = req.body;
            const { buyerPhoneNumber, buyerLocation, buyerEmail } = buyerInfo;

            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: { status: 'sold', buyerPhoneNumber, buyerLocation, buyerEmail },
            };
            const result = await productCollection.updateOne(filter, updatedDoc, options);
            const wishlistResult = await wishCollection.updateOne(filter, updatedDoc, options);

            res.send(result);
        });
        // optional features
        // wish list
        // add to wishlist
        app.put('/addtowishlist/:id', async (req, res) => {
            const { id } = req.params;
            const product = req.body;
            console.log(id);
            console.log(product);

            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: product,
            };

            const result = await wishCollection.updateOne(filter, updatedDoc, options);

            res.send(result);
        });
        // my wishlist
        app.get('/mywishlist/:email', async (req, res) => {
            const { email } = req.params;

            const query = { buyerEmail: email };
            const myWishlist = await wishCollection.find(query).toArray();
            res.send(myWishlist);
        });

        // DELETE a wish
        app.delete('/wishlist/:id', async (req, res) => {
            const { id } = req.params;
            const filter = { _id: ObjectId(id) };
            const result = await wishCollection.deleteOne(filter);
            res.send(result);
        });
        // Mu buyers
        app.get('/mybuyers/:email', async (req, res) => {
            const { email } = req.params;
            console.log(email.error);

            const filter = { status: 'sold', sellerEmail: email };
            const result = await productCollection.find(filter).toArray();
            res.send(result);
        });

        // GET BLOGS
        app.get('/blogs', async (req, res) => {
            const filter = {};
            const result = await blogsCollection.find(filter).toArray();
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
