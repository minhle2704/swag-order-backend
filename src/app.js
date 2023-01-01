import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { Low, JSONFile } from "lowdb";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import moment from "moment";

import { generateTemporaryPassword } from "./helpers/index.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const adapter = new JSONFile("db.json");
const db = new Low(adapter);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
    clientId: process.env.OAUTH_CLIENTID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    refreshToken: process.env.OAUTH_REFRESH_TOKEN,
  },
});
transporter.verify((err, success) => {
  err ? console.log(err) : console.log("Transporter is ready");
});

// Sign up
app.post("/sign-up", async (req, res) => {
  await db.read();

  const existingUserWithEmail = db.data.users.find(
    (user) => user.email === req.body.email
  );
  const existingUserWithUsername = db.data.users.find(
    (user) => user.username === req.body.username
  );

  if (existingUserWithEmail) {
    res
      .status(401)
      .send(
        "This email has been registered before. Please use a different email or log in."
      );
    return;
  }
  if (existingUserWithUsername) {
    res
      .status(401)
      .send(
        "This username has been registered before. Please use a different username or log in."
      );
    return;
  }

  const ids = db.data.users.map((user) => user.id);
  const newUser = {
    ...req.body,
    id: Math.max(...ids) + 1,
    password: await bcrypt.hash(req.body.password, 10),
    role: "user",
    orders: [],
  };
  db.data.users.push(newUser);

  await db.write();

  res.send({
    firstName: newUser.firstName,
    lastName: newUser.lastName,
    username: newUser.username,
    role: newUser.role,
    id: newUser.id,
    email: newUser.email,
    orders: newUser.orders,
  });
});

// Login
app.post("/login", async (req, res) => {
  await db.read();

  const user = db.data.users.find(
    (user) => user.username === req.body.username
  );

  const isPasswordCorrect = await bcrypt.compare(
    req.body.password,
    user.password
  );

  if (user && isPasswordCorrect) {
    res.send({
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      role: user.role,
      id: user.id,
      email: user.email,
      orders: user.orders,
    });
  } else {
    res.sendStatus(401);
  }
});

// Change password
app.post("/change-password", async (req, res) => {
  await db.read();

  const user = db.data.users.find((user) => user.id === req.body.userId);
  const isPasswordCorrect = await bcrypt.compare(
    req.body.currentPassword,
    user.password
  );

  if (isPasswordCorrect) {
    const newHashedPassword = await bcrypt.hash(req.body.newPassword, 10);
    db.data.users = db.data.users.map((user) =>
      user.id === req.body.userId
        ? { ...user, password: newHashedPassword }
        : user
    );

    await db.write();

    res.sendStatus(200);
  } else {
    res.status(401).send("You have entered a wrong password. Please try again");
    return;
  }
});

// Forget password (generate a new password and send it to user)
app.post("/forget-password", async (req, res) => {
  await db.read();

  const temporaryPassword = generateTemporaryPassword();
  db.data.users = db.data.users.map((user) =>
    user.email === req.body.email
      ? {
          ...user,
          password: temporaryPassword,
          expirePasswordTimestamp: moment().add(24, "hours").format(),
        }
      : user
  );

  const mailOptions = {
    from: process.env.EMAIL,
    to: req.body.email,
    subject: "Swag Shop Order password reset",
    text: `Hi,

Your temporary password is: ${temporaryPassword}. Please note that this temporary password will expire in 24 hours. 
After logging in, you can change it to a new password in your profile.
    
Thanks`,
  };

  await transporter.sendMail(mailOptions);

  await db.write();

  res.sendStatus(200);
});

// Reset Password
app.post("/reset-password", async (req, res) => {
  await db.read();

  const user = db.data.users.find(
    (user) => user.username === req.body.username
  );

  if (
    user.password === req.body.temporaryPassword &&
    user.expirePasswordTimestamp >= moment().format()
  ) {
    const newHashedPassword = await bcrypt.hash(req.body.newPassword, 10);
    db.data.users = db.data.users.map((user) =>
      user.username === req.body.username
        ? { ...user, password: newHashedPassword }
        : user
    );

    await db.write();

    res.sendStatus(200);
  } else {
    res
      .status(401)
      .send(
        "You have entered a wrong password or your temporary password has expired. Please try again"
      );
  }
});

// Get all swags (for User & Admin)
app.get("/swags", async (req, res) => {
  await db.read();

  res.send(db.data.swags);
});

// Fetch all order (for User & Admin)
app.post("/my-order", async (req, res) => {
  await db.read();
  const user = db.data.users.find((user) => req.body.userId === user.id);

  res.send({ orders: user.orders });
});

// Add a swag (for Admin)
app.post("/swags", async (req, res) => {
  await db.read();

  const createdSwag = {
    ...req.body,
    id: Math.max(...db.data.swags.map((swag) => swag.id)) + 1,
  };
  db.data.swags = [...db.data.swags, createdSwag];

  await db.write();

  res.send(createdSwag);
});

// Edit a swag (for Admin)
app.post("/swags/:id", async (req, res) => {
  await db.read();

  const editedSwag = {
    id: parseInt(req.params.id),
    name: req.body.name,
    quantity: parseInt(req.body.quantity),
    category: req.body.category,
    image: req.body.image,
  };
  db.data.swags = db.data.swags.map((swag) =>
    swag.id === editedSwag.id ? editedSwag : swag
  );

  await db.write();

  res.send(editedSwag);
});

// Delete a swag (for Admin)
app.delete("/swags/:id", async (req, res) => {
  await db.read();

  db.data.swags = db.data.swags.filter(
    (swag) => swag.id != parseInt(req.params.id)
  );

  await db.write();

  res.sendStatus(200);
});

// Update swag and user database after order (for User and Admin)
app.post("/commit-order", async (req, res) => {
  await db.read();

  // Reduce inventory after ordering
  const orderedSwagMap = new Map();
  for (const swag of Object.values(req.body.swagOrders)) {
    orderedSwagMap.set(swag.id, swag);
  }
  db.data.swags = db.data.swags.map((swag) => {
    const orderedSwag = orderedSwagMap.get(swag.id);
    return orderedSwag
      ? { ...swag, quantity: swag.quantity - orderedSwag.quantity }
      : swag;
  });

  // Record user order
  const orderInfo = {};
  orderInfo[uuidv4()] = Object.values(req.body.swagOrders);
  db.data.users = db.data.users.map((user) =>
    user.id === req.body.userId
      ? {
          ...user,
          orders: [...user.orders, { ...orderInfo }],
        }
      : user
  );

  // Email user order info
  const user = db.data.users.find((user) => user.id === req.body.userId);
  const orderConfirmationNumber = Object.keys(orderInfo).toString();

  let mailOptions = {
    from: process.env.EMAIL,
    to: user.email,
    subject: `Order #${orderConfirmationNumber} is confirmed`,
    text: `Hi ${user.firstName},
    
You order #${orderConfirmationNumber} has been confirmed. 
It will be sent to ${req.body.deliveryAddress} by ${moment(
      req.body.date
    ).format("ll")}. 
We will contact you at this phone number ${req.body.phoneNumber}.

Thanks for using our Swag Shop Order platform.`,
  };

  await transporter.sendMail(mailOptions);

  await db.write();

  res.send(db.data.swags);
});

app.listen(5000, () => {
  console.log("listening on port 5000");
});
