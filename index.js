require('dotenv').config();
const cors = require('cors');
const express = require('express');
const { MongoClient } = require('mongodb');
// const ObjectId = require('mongodb').ObjectId;
const admin = require("firebase-admin");

const app = express();
const port = process.env.PORT || 5000;

// firebase admin init
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// midlewere
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.j92oy.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
// console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const idToken = req.headers.authorization.split(' ')[1];
        // console.log('inside separate function', idToken);
        try {
            const decodedUser = await admin.auth().verifyIdToken(idToken);
            console.log('email', decodedUser?.email);
            req.decodedUserEmail = decodedUser.email;
        }
        catch {

        }
    }
    next();
}

async function server() {
    try {
        await client.connect();
        console.log('Database is Connected.');

        const database = client.db('Doctors-Portal')
        const appointmentsCollection = database.collection('appointments');
        const usersCollection = database.collection('users');

        // appointments : POST
        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            console.log(appointment);
            const appointmentResult = await appointmentsCollection.insertOne(appointment);
            res.json(appointmentResult);
        });
        
        // // appointments : GET
        // app.get('/appointments', async (req, res) => {
        //     const cursor = appointmentsCollection.find({});
        //     const appointment = await cursor.toArray();
        //     res.send(appointment);
        // });
        
        // appointments : GET
        app.get('/appointments', verifyToken, async (req, res) => {
            const email = req.query.email;
            const date = new Date(req.query.date).toLocaleDateString();
            console.log(date);
            const query = { email: email, date: date};
            const cursor = appointmentsCollection.find(query);
            const appointment = await cursor.toArray();
            res.send(appointment);
        });

        // users : POST
        app.post('/users', async (req, res) => {
            const user = req.body;
            console.log(user);
            const userResult = await usersCollection.insertOne(user);
            res.json(userResult);
        });

        // admin : GET 
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            // console.log('put', user);
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            };
            res.json({ admin: isAdmin });
        });

        // users : PUT/Update
        app.put('/users', async (req, res) => {
            const user = req.body;
            // console.log('put', user);
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const userResult = await usersCollection.updateOne(filter, updateDoc, options );
            res.json(userResult);
        });

        // admin : PUT/Update
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedUserEmail;
            console.log('put', requester);

            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });

                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const userResult = await usersCollection.updateOne(filter, updateDoc);
                    res.json(userResult);
                };
            }
            else {
                res.status(403).json({message: 'you do not have access!'});
            };
        });

    }
    finally {
        // await client.close();
    };
};
server().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Doctors Portal Server is running!');
});

app.listen(port, () => {
    console.log('Listening, port no:', port);
});