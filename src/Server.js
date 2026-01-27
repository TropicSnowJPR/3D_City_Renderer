import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const app = express();


app.use(cors({
    origin: "http://localhost:5173"
}));
app.use(express.json({ limit: "50000mb" }));


const DATA_DIR = path.resolve("data");
const OBJ_DIR  = path.join(DATA_DIR, "objects");
const OBJ_INDEX    = path.join(DATA_DIR, "obj_index.json");
const POINT_DIR = path.join(DATA_DIR, "points");
const POINT_INDEX  = path.join(DATA_DIR, "points_index.json");

await fs.mkdir(OBJ_DIR, { recursive: true });
await fs.mkdir(POINT_DIR, { recursive: true });


async function loadObjIndex() {
    try {
        return JSON.parse(await fs.readFile(OBJ_INDEX, "utf8"));
    } catch {
        return { objects: {} };
    }
}

async function loadPointIndex() {
    try {
        return JSON.parse(await fs.readFile(OBJ_INDEX, "utf8"));
    } catch {
        return { objects: {} };
    }
}

async function saveObjIndex(index) {
    await fs.writeFile(OBJ_INDEX, JSON.stringify(index, null, 2));
}

async function savePointIndex(index) {
    await fs.writeFile(OBJ_INDEX, JSON.stringify(index, null, 2));
}

async function readJSON(relPath) {
    const abs = path.join(DATA_DIR, relPath.toString());
    const raw = await fs.readFile(abs, "utf-8");
    return JSON.parse(raw);
}



app.post("/api/object", async (req, res) => {
    const geo = req.body.GEOJSON;
    const data = req.body.DATA;


    if (!geo) {
        return res.status(400).json({ error: "Missing GEOJSON" });
    }
    if (!data) {
        return res.status(400).json({ error: "Missing DATA" });
    }

    const id = crypto.randomUUID().slice(0, 6);
    geo.id = id

    const dir = path.join(OBJ_DIR, id);

    await fs.mkdir(dir);

    await fs.writeFile(
        path.join(dir, "geo.json"),
        JSON.stringify(geo, null, 2)
    );

    await fs.writeFile(
        path.join(dir, "data.json"),
        JSON.stringify(data, null, 2)
    );

    const index = await loadObjIndex();
    index.objects[id] = {
        type: geo.type ?? geo.geometry?.type,
        path: `objects/${id}`
    };

    await saveObjIndex(index);

    res.json({ id });
});

app.get("/api/object/index", async (req, res) => {
    try {
        const index = await readJSON("obj_index.json");
        res.json(index);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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

app.get("/api/object/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const index = await readJSON("index.json");

        if (!index[id]) {
            return res.status(404).json({ error: "Unknown ID" });
        }

        const geo = await readJSON(index[id].geo);
        const data = await readJSON(index[id].data);

        res.json({ id, geo, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



app.post("/api/point", async (req, res) => {
    const geo = req.body.GEOJSON;
    const name = req.body.NAME;

    if (!geo) {
        return res.status(400).json({ error: "Missing GEOJSON" });
    }

    if (!name) {
        return res.status(400).json({ error: "Missing NAME" });
    }

    const id = crypto.randomUUID().slice(0, 6);
    geo.id = id
    geo.properties.__gm_id = name;

    const dir = path.join(POINT_DIR, id);

    await fs.mkdir(dir);

    await fs.writeFile(
        path.join(dir, "geo.json"),
        JSON.stringify(geo, null, 2)
    );

    const index = readJSON("points_index.json");
    index.objects[id] = {
        type: geo.type ?? geo.geometry?.type,
        path: `points/${id}`
    };

    await savePointIndex(index);

    res.json({ id });
});

app.get("api/point/index", async (req, res) => {
    try {
        const index = await readJSON("points_index.json");
        res.json(index);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/point/:id/geo", async (req, res) => {
    const file = path.join(POINT_DIR, req.params.id, "geo.json");
    try {
        res.json(JSON.parse(await fs.readFile(file, "utf8")));
    } catch {
        res.sendStatus(404);
    }
})

app.listen(3000, () => console.log("API running on http://localhost:3000"));
