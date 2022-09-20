import express from "express";
import cors from "cors";
import { Low, JSONFile } from "lowdb";

const app = express();
app.use(express.json());
app.use(cors());

const adapter = new JSONFile("swagData.json");
const db = new Low(adapter);

// Get all swags (for User & Admin)
app.get("/swags", async (req, res) => {
  await db.read();

  res.send(db.data.swags);
});

// Add a swag (for Admin)
app.post("/swags", async (req, res, next) => {
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
app.post("/swags/:id", async (req, res, next) => {
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
app.delete("/swags/:id", async (req, res, next) => {
  await db.read();

  db.data.swags = db.data.swags.filter(
    (swag) => swag.id != parseInt(req.params.id)
  );

  await db.write();

  res.sendStatus(200);
});

// Update swag database after order (for User)
app.post("/commit-order", async (req, res, next) => {
  await db.read();

  let orderedSwagMap = new Map();
  for (const swag of req.body) {
    orderedSwagMap.set(swag.id, swag);
  }
  db.data.swags = db.data.swags.map((swag) => {
    const orderedSwag = orderedSwagMap.get(swag.id);
    return orderedSwag
      ? { ...swag, quantity: swag.quantity - orderedSwag.quantity }
      : swag;
  });

  await db.write();

  res.send(db.data.swags);
});

app.listen(5000, () => {
  console.log("listening on port 5000");
});
