require('dotenv').config()

const express= require('express');
const cors= require('cors');

const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port=process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URL, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run(){

try{

        const db= client.db('decorDb');
        const servicesCollection=db.collection('services');

        //Create decoration service

        app.post('/service', async (req,res) => {
     
           const serviceData=req.body;
           console.log(serviceData);
           const result= await servicesCollection.insertOne(serviceData);
           res.send(result);


        })


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");


} finally {


}}

run().catch(console.dir);


app.get('/', (req,res) => {

     res.send('Server is running');
})

app.listen(port, () => {

    console.log(`Server is running on ${port}`)
})