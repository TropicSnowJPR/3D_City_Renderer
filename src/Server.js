import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const app = express();

// ------------- CORS -------------
app.use(cors({
    origin: "http://localhost:5173"
}));
app.use(express.json({ limit: "50000mb" }));

// ------------- Data paths -------------
const DATA_DIR = path.resolve("data");
const OBJ_DIR  = path.join(DATA_DIR, "objects");
const INDEX    = path.join(DATA_DIR, "index.json");

await fs.mkdir(OBJ_DIR, { recursive: true });

// ------------- Helpers -------------
async function loadIndex() {
    try {
        return JSON.parse(await fs.readFile(INDEX, "utf8"));
    } catch {
        return { objects: {} };
    }
}

async function saveIndex(index) {
    await fs.writeFile(INDEX, JSON.stringify(index, null, 2));
}

// ------------- CRUD -------------
app.post("/api/object", async (req, res) => {
    if (!req.body.geo) return res.status(400).json({ error: "Missing geo" });
    if (!req.body.data) return res.status(400).json({ error: "Missing data" });

    const id = crypto.randomUUID().slice(0, 6);
    const dir = path.join(OBJ_DIR, id);

    await fs.mkdir(dir);

    await fs.writeFile(
        path.join(dir, "geo.json"),
        JSON.stringify(req.body.geo, null, 2)
    );

    await fs.writeFile(
        path.join(dir, "data.json"),
        JSON.stringify(req.body.data, null, 2)
    );

    const index = await loadIndex();
    index.objects[id] = {
        type: req.body.geo.type,
        path: `objects/${id}`
    };

    await saveIndex(index);
    res.json({ id });
});

app.get("/api/object", async (req, res) => {
    const index = await loadIndex();
    res.json(index.objects);
});

app.get("/api/object/:id/geo", async (req, res) => {
    const file = path.join(OBJ_DIR, req.params.id, "geo.json");
    try {
        res.json(JSON.parse(await fs.readFile(file, "utf8")));
    } catch {
        res.sendStatus(404);
    }
});

app.get("/api/object/:id/data", async (req, res) => {
    const file = path.join(OBJ_DIR, req.params.id, "data.json");
    try {
        res.json(JSON.parse(await fs.readFile(file, "utf8")));
    } catch {
        res.sendStatus(404);
    }
});

app.post("/api/object/:id/data", async (req, res) => {
    const file = path.join(OBJ_DIR, req.params.id, "data.json");
    await fs.writeFile(file, JSON.stringify(req.body, null, 2));
    res.sendStatus(200);
});

app.delete("/api/object/:id", async (req, res) => {
    const dir = path.join(OBJ_DIR, req.params.id);
    await fs.rm(dir, { recursive: true, force: true });

    const index = await loadIndex();
    delete index.objects[req.params.id];
    await saveIndex(index);

    res.sendStatus(200);
});

app.listen(3000, () => console.log("API running on http://localhost:3000"));
