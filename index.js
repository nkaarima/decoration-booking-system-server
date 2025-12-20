require('dotenv').config()

const express= require('express');
const cors= require('cors');

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        const usersCollection=db.collection('users');
        const bookingsCollection= db.collection('bookings');

        //Create decoration service

        app.post('/service', async (req,res) => {
     
           const serviceData=req.body;
           //console.log(serviceData);
           const result= await servicesCollection.insertOne(serviceData);
           res.send(result);
        })

        // Retrieve decoration service and display it in client side

        app.get('/services-top-3', async (req,res) => {
       
            const result= await servicesCollection.find().limit(3).toArray();
            res.send(result);

        })

        app.get('/all-services', async (req, res) => {
      
           const result = await servicesCollection.find().toArray();
           res.send(result);

        })


        //Save or update users

        app.post('/user', async (req,res) => {
    
            const userInfo= req.body;
            console.log(userInfo);

            const query= {email: userInfo.email};

            userInfo.created= new Date().toISOString();
            userInfo.last_loggedin = new Date().toISOString();

            userInfo.role="customer";

            const userExists= await usersCollection.findOne(query);

            if(userExists){
         
               const result = await usersCollection.updateOne(query, {

                 $set: {
                  last_loggedin: new Date().toISOString()
                 }
               })

               return res.send(result);
            
              }
       
                 const result= await usersCollection.insertOne(userInfo);
                 res.send(result);

        })

        //Get a user's role

        app.get('/user/role/:email', async (req,res) => {
       
           const email= req.params.email;

           const result= await usersCollection.findOne({email});
           res.send({role: result?.role});

        })



        //Create service detail

        app.get('/service-details/:id', async (req,res) => {

          const id= req.params.id;
          const result = await servicesCollection.findOne( {_id: new ObjectId(id)} );
          res.send(result);
        })

        //Get a user's role

        app.get('/user/role/:email', async (req,res) => {

          const email= req.params.email;
          const result= await usersCollection.findOne({email});
          res.send({role: result?.role});


        })

        //Book decoration service

        app.post('/my-bookings', async (req,res) => {
          
          const bookingInfo= req.body;
          const decorationServiceId=bookingInfo.decorationServiceId; 

           const requestExist= await bookingsCollection.findOne({decorationServiceId});
          
           if(requestExist)
          {
            return res.status(409).send({message:'Already booked,please wait'});
          }
          
          const result= await bookingsCollection.insertOne(bookingInfo);
          res.send(result);

        })

        //Retrieve booking service

        app.get('/my-bookings/:email', async (req,res) => {
    
           const email= req.params.email;
           const result= await bookingsCollection.find({'customer.email':email}).toArray();
           res.send(result);

        })

        //


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