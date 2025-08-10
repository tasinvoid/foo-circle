const { MongoClient, ServerApiVersion, ObjectId, Admin } = require("mongodb");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;
//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mlu0v9d.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// const serviceAccount = require("./firebase-admin-key.json");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const verifyFireBaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded = decoded;
    next();
  } catch (error) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
};
async function run() {
  try {
    await client.connect();
    const myDB = client.db("foodCircle");
    const allFoodsColl = myDB.collection("allFoods");
    // Create a transporter for SMTP
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    app.post("/nodeMailer", async (req, res) => {
      
      const userEmail = req.body.email; 
      const userName = req.body.name;
      const userMessage = req.body.message; 
      try {
        const info = await transporter.sendMail({
          from: `Sproutly User:${req.body.email}`,
          to: "shoaibmahmudtasin@gmail.com",
          subject: `New Message from ${userName} via Sproutly`,
          html: `
        <p>You have a new message from a Sproutly user:</p>
        <p><b>Name:</b> ${userName}</p>
        <p><b>Email:</b> ${userEmail}</p>
        <p><b>Message:</b></p>
        <p>${userMessage}</p>
      `,
        });

        console.log("Message sent: %s", info.messageId);
        console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
        // Send a success response
        res.status(200).json({
          message: "Email sent successfully!",
          messageId: info.messageId,
        });
      } catch (err) {
        console.error("Error while sending mail", err);
        // Send an error response
        res.status(500).json({ error: "Failed to send email" });
      }
    });
   app.get("/allFoods", async (req, res) => {
  const { sortOrder } = req.query; 
  const query = { availability: "available" };
  let sortOption = { expiredDate: 1 }; 

  if (sortOrder === "asc") {
    sortOption = { foodQuantity: 1 }; 
  } else if (sortOrder === "desc") {
    sortOption = { foodQuantity: -1 }; 
  }

  
  const cursor = allFoodsColl.find(query).sort(sortOption);
  const result = await cursor.toArray();
  res.send(result);
});
    app.get("/foods", async (req, res) => {
     
      const cursor = allFoodsColl.find().sort({ expiredDate: 1 });
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/featuredFoods", async (req, res) => {
      const query = { availability: "available" };
      const cursor = allFoodsColl
        .find(query)
        .sort({ foodQuantity: -1 })
        .limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/availableFoods/:id", async (req, res) => {
      const id = req.params.id;
      const cursor = allFoodsColl.find({ _id: new ObjectId(id) });
      const result = await cursor.toArray();
      res.send(result);
    });
    app.post("/addFood", async (req, res) => {
      const newFood = req.body;
      const result = await allFoodsColl.insertOne(newFood);
      res.send(result);
    });
    //update additional notes in modal
    app.patch("/updateAdditionalNotes/:id", async (req, res) => {
      const foodId = req.params.id;
      const { message, currentUserEmail, requestTime } = req.body;
      console.log(foodId, message);
      const filter = { _id: new ObjectId(foodId) };
      const updateDocument = {
        $set: {
          additionalNotes: `${message}`,
          availability: "requested",
          requestedBy: currentUserEmail,
          requestTime: requestTime,
        },
      };
      const result = await allFoodsColl.updateOne(filter, updateDocument);
      res.send(result);
    });
    //find requested food by the current user
    app.get("/requestedFoods", async (req, res) => {
      const email = req.query.Email;
      console.log(email);
      // if (email !== req.decoded.email) {
      //   return res.status(403).message({ message: "forbidden access" });
      // }
      const cursor = allFoodsColl.find({ requestedBy: email });
      const result = await cursor.toArray();
      console.log(email);
      res.send(result);
    });
    //manage my foods
    app.get("/manageMyFoods", async (req, res) => {
      const email = req.query.Email;
      const cursor = allFoodsColl.find({
        Email: email,
        availability: "available",
      });
      const result = await cursor.toArray();
      res.send(result);
    });
    //delete my food from manage food page
    app.delete("/manageMyFoods/:id", async (req, res) => {
      const id = req.params.id;
      const result = await allFoodsColl.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });
    //edit my food
    app.put("/editMyFood/:id", (req, res) => {
      const id = req.params.id;
      const doc = req.body;
      const updateDocument = {
        $set: doc,
      };
      const result = allFoodsColl.updateOne(
        { _id: new ObjectId(id) },
        updateDocument
      );
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Food Circle Running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
