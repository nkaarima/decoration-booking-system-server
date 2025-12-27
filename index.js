require('dotenv').config()
const express= require('express');
const cors= require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port=process.env.PORT || 3000;
const app = express();

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
        const projectsCollection= db.collection('projects');

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
            const currentDate= new Date().toISOString();

            userInfo.created= currentDate;
            userInfo.last_loggedin = currentDate;

            const userExists= await usersCollection.findOne(query);
          
            //Check if the user is in decorationCollection

            const decorator= await decoratorsCollection.findOne(query);
            

            if(userExists){

               if(userExists.role === 'decorator')

                  {
                     if(!decorator)
                     {
                        return res.status(404).send({message: 'Profile not found'})
                     }

                     if(decorator.accountStatus === 'pending')
                     {
                        return res.status(403).send({message: 'Your account approval is pending'})
                     }

                     if(decorator.accountStatus === 'disenabled')
                     {
                        return res.status(403).send({message: 'Your account  is disabled'})
                     }
                  }
                  

               const result = await usersCollection.updateOne(query, {

                 $set: {
                  last_loggedin: new Date().toISOString()
                 }
               })

               return res.send(result);
            
              }

              if(decorator)
              {
                 if(decorator.accountStatus !== 'approved')
                  {
                    return res.status(403).send({message:'Your account needs to be approved'});

                 }
                
                 userInfo.role='decorator';
                 const result= await usersCollection.insertOne(userInfo);
                 return res.send(result);            
              }

                 userInfo.role="customer";
                 const result= await usersCollection.insertOne(userInfo);
                 res.send(result);      

        })

        //Get a user's role

        app.get('/user/role/:email', async (req,res) => {
       
           const email= req.params.email;

           const result= await usersCollection.findOne({email});
           res.send({role: result?.role});

        })

        //Get only customers

        app.get('/all-customers', async (req,res) => {
        
           const result= await usersCollection.find({role:'customer'}).toArray();
           res.send(result);

        })



        //Create service detail

        app.get('/service-details/:id', async (req,res) => {

          const id= req.params.id;
          const result = await servicesCollection.findOne( {_id: new ObjectId(id)} );
          res.send(result);
        })

        //Book decoration service

        app.post('/my-bookings/:email', async (req,res) => {
          
          const bookingInfo= req.body;
          const email = req.params.email;
          const decorationServiceId=bookingInfo.decorationServiceId; 

          const requestExist= await bookingsCollection.findOne({email,decorationServiceId});
          
           if(requestExist)
          {
            return res.status(409).send({message:'Already booked,please wait'});
          }
          
          const result= await bookingsCollection.insertOne(bookingInfo);
          res.send(result);

        })

         //Retrieve booking service of those who have paid

        app.get('/all-bookings', async (req,res) => {
       
          const result = await bookingsCollection.find().toArray();
          res.send(result);
 

        })


        //Retrieve booking service

        app.get('/my-bookings/:email', async (req,res) => {
    
           const email= req.params.email;
           console.log(email);
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

                     bookingId:paymentInfo?._id,
                     decorationId: paymentInfo?.decorationServiceId,
                     customer_email:paymentInfo?.customer?.email,
                     customer_name:paymentInfo?.customer?.name,
                     location:paymentInfo?.location,
                     serviceDate:paymentInfo?.serviceDate
                  },

                  success_url:`${process.env.CLIENT_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                  cancel_url:`${process.env.CLIENT_DOMAIN}/service-details/${paymentInfo.decorationServiceId}`

     


            })

            res.send({url:session.url})

            
        })

        //payment-success

        app.post('/payment-success', async (req,res) => {
            
           const {sessionId} =req.body;
           const session= await stripe.checkout.sessions.retrieve(sessionId);
           //console.log(session);

           const services= await servicesCollection.findOne({_id: new ObjectId(session.metadata.decorationId)})
         
           const bookedData= await paymentCollection.findOne({transactionId:session.payment_intent })


           if(session.payment_status === 'paid' && services && !bookedData)
           {

              
           const paymentStatus= await bookingsCollection.updateOne(

            {_id:new ObjectId(session.metadata.bookingId)},{

               $set: {
                isPaid:true
               }
            })
              const paymentDoneData= {
           
             bookingId: session.metadata.bookingId,
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
                
               serviceName:updatedData.serviceName,
               serviceCategory:updatedData.serviceCategory,
               cost:updatedData.price,
               unit:updatedData.unit
               
             }

           }


          const result = await servicesCollection.updateMany(query,update)
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

      // Get all decorators info

       app.get('/all-decorators', async (req,res) => {
         
         const result= await decoratorsCollection.find().toArray();
         res.send(result);
      })

      //Assign decorators to users who have paid

      app.post('/projects', async (req,res) => {
      
         const projectInfo = req.body;
         const bookingInfo= await projectsCollection.findOne({bookingId: projectInfo.bookingId});
         if(bookingInfo)
         {
            const result = await projectsCollection.updateOne({bookingId:bookingInfo.bookingId},{

               $set: {
                 decoratorName:projectInfo.decoratorName
               }
            } )

            return res.send(result);

         }
         const result = await projectsCollection.insertOne(projectInfo);
         res.send(result);

          
      })

      //Approve or disable decorator accounts
          
       app.put('/manage-decorator-account/:email', async (req,res) => {

         const email= req.params.email;

          const accountInfo = req.body;
         
          const result = await decoratorsCollection.updateOne({email}, {
             $set: {
                
                accountStatus:accountInfo.status
             }
          })

          res.send(result);
       })

       //update user role

       app.put('/make-user-decorator', async (req,res) => {

        const roleInfo=req.body;
        const result= await usersCollection.updateOne({email:roleInfo.email}, {
         
            $set:
            {
               role:roleInfo.role
            }
    
        })

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