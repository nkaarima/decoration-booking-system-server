require('dotenv').config()
const express= require('express');
const cors= require('cors');

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
        const paymentCollection= db.collection('payment');
        const decoratorsCollection=db.collection('decorators');

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

        // Payment api

        app.post('/create-checkout-session', async (req,res) => {
            
            const paymentInfo = req.body;
            //console.log(paymentInfo);
          
            const session= await stripe.checkout.sessions.create({
             
              line_items:[
                 
                     {
                        price_data: {
                                currency:'usd',
                                product_data: {
                               
                                     name:paymentInfo?.serviceName
                                   
                                       
                                     },

                                     unit_amount: paymentInfo?.decorationCost * 100
                           
                              },

                              quantity:1
                     }



                  ],

                  customer_email:paymentInfo?.customer?.email,

                  mode:'payment',
                  metadata: {

                     decorationId: paymentInfo?.decorationServiceId,
                     customer_email:paymentInfo?.customer?.email,
                     customer_name:paymentInfo?.customer?.name,
                     location:paymentInfo?.location,
                     serviceDate:paymentInfo?.serviceDate
                  },

                  success_url:'http://localhost:5173/payment-sucess?session_id={CHECKOUT_SESSION_ID}',
                  cancel_url:`http://localhost:5173/service-details/${paymentInfo.decorationServiceId}`

     


            })

            res.send({url:session.url})

            
        })

        //payment-success

        app.post('/payment-success', async (req,res) => {
            
           const {sessionId} =req.body;
           const session= await stripe.checkout.sessions.retrieve(sessionId);
           //console.log(session);

           const services= await servicesCollection.findOne({_id: new ObjectId(session.metadata.decorationId)})
           
           const paymentStatus= await bookingsCollection.updateOne(

            {decorationServiceId:session.metadata.decorationId},{

               $set: {
                isPaid:true
               }
            }


           )
           const bookedData= await paymentCollection.findOne({transactionId:session.payment_intent })


           if(session.status === 'complete' && services && !bookedData)
           {
              const paymentDoneData= {
           
             decorationServiceId: session.metadata.decorationId,
             transactionId:session.payment_intent,
             customer_name:session.metadata.customer_name,
             customer_email:session.metadata.customer_email,
             location:session.metadata.location,
             serviceDate:session.metadata.serviceDate,

             name:services.serviceName,
             category:services.serviceCategory,
             price:session.amount_total /100,
             
     
             }
             
             const result= await paymentCollection.insertOne(paymentDoneData);

             return res.send({
                  transactionId:session.payment_intent,
                  paymentId: result.insertedId
             })
             
           }
       
            else{
                res.send({
                  transactionId:session.payment_intent
            })


        }

      })

      //retrieve payment-info

      app.get('/payment-info/:email', async (req,res) => {
       
         const email = req.params.email;
         const result= await paymentCollection.find({customer_email:email}).toArray();
         res.send(result);
         
      })

      //Delete booking

      app.delete('/cancel-booking/:id', async (req,res) => {
         
          const id= req.params.id;
          const result = await bookingsCollection.deleteOne({_id: new ObjectId(id)});
          res.send(result);
      })

      //Edit service

      app.put('/edit-service/:id', async (req,res) => {
         
          const id = req.params.id;
          const updatedData= req.body;
          console.log(updatedData);
          const query= {_id: new ObjectId(id)}
       
           const update= {
             
             $set:{
                
               name:updatedData.serviceName,
               category:updatedData.serviceCategory,
               cost:updatedData.price,
               unit:updatedData.unit
               
             }

           }


          const result = await servicesCollection.updateOne(query,update)
          res.send(result);
      })

      //Delete Service

      app.delete('/delete-service/:id', async (req,res) => {
    
         const id= req.params.id;

         const result= await servicesCollection.deleteOne({_id:new ObjectId(id)})
         res.send(result);

      })

      //Create decorators

      app.post('/create-decorator', async (req,res) => {
         
         const decoratorInfo = req.body;
         const result= await decoratorsCollection.insertOne(decoratorInfo);
         res.send(result);
      })

      //Get users who have paid

      app.get('/all-payment-info', async (req,res) => {

        const result= await paymentCollection.find().toArray();
        res.send(result);
      })

     





        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

    //Save decorator Info


} finally {


}}

run().catch(console.dir);


app.get('/', (req,res) => {

     res.send('Server is running');
})

app.listen(port, () => {

    console.log(`Server is running on ${port}`)
})