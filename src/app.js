import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { Low, JSONFile } from "lowdb";

const app = express();
app.use(express.json());
app.use(cors());

const adapter = new JSONFile("db.json");
const db = new Low(adapter);

// Login
app.post("/login", async (req, res) => {
  await db.read();

  const user = db.data.users.find(
    (user) =>
      req.body.username === user.username && req.body.password === user.password
  );

  if (user) {
    res.send({ role: user.role, id: user.id });
  } else {
    res.sendStatus(401);
  }
});

// Get all swags (for User & Admin)
app.get("/swags", async (req, res) => {
  await db.read();

  res.send(db.data.swags);
});

// Get all order (for User & Admin)
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

  let orderedSwagMap = new Map();
  for (const swag of Object.values(req.body.swagOrders)) {
    orderedSwagMap.set(swag.id, swag);
  }
  db.data.swags = db.data.swags.map((swag) => {
    const orderedSwag = orderedSwagMap.get(swag.id);
    return orderedSwag
      ? { ...swag, quantity: swag.quantity - orderedSwag.quantity }
      : swag;
  });

  let orderInfo = {};
  orderInfo[uuidv4()] = Object.values(req.body.swagOrders);

  db.data.users = db.data.users.map((user) =>
    user.id === req.body.userId
      ? {
          ...user,
          orders: [...user.orders, { ...orderInfo }],
        }
      : user
  );
  await db.write();

  res.send(db.data.swags);
});

app.listen(5000, () => {
  console.log("listening on port 5000");
});
