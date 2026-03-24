import cors from "cors";
import express, { type Request, type Response } from "express";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { ParsedQs } from "qs";

const APP_PORT = 3000;
const MAX_ID_LENGTH = 64;
const MIN_ID_LENGTH = 1;
const INDEX_0 = 0
const RANDOM_ID_SLICE_MAX = 6
const RANDOM_ID_SLICE_MIN = 0
const JSON_SPACING = 2


// STATUS CODES
const INTERNAL_SERVER_ERROR = 500;
const CONFLICT = 409
const NOT_FOUND = 404;
const BAD_REQUEST = 400;


type JsonObject = Record<string, unknown>;

interface IndexEntry {
  path: string;
  type?: unknown;
}

interface IndexFile {
  objects: Record<string, IndexEntry>;
}

interface ObjectBody {
  GEOJSON?: JsonObject;
  DATA?: unknown;
}

interface RenameBody {
  newid?: unknown;
}

const app = express();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "5gb" }));

const DATA_DIR = path.resolve("server/data");
const OBJ_DIR = path.join(DATA_DIR, "objects");
const OBJ_INDEX = path.join(DATA_DIR, "obj_index.json");

const stringifyPretty = (value: unknown): string => JSON.stringify(value, undefined, JSON_SPACING);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && Boolean(value);

const safeErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

const makeId = (): string => crypto.randomUUID().slice(RANDOM_ID_SLICE_MIN, RANDOM_ID_SLICE_MAX);

const getGeoType = (geo: JsonObject): unknown => {
  if (geo.type !== undefined) {return geo.type;}

  const {geometry} = geo;
  if (isRecord(geometry) && "type" in geometry) {return geometry.type;}

  return undefined;
};

const getQueryString = (value: unknown): string | undefined => {
  if (typeof value === "string") {return value;}
  if (Array.isArray(value) && typeof value[INDEX_0] === "string") {return value[INDEX_0];}
  return undefined;
};

const validateNewId = (newId: string): string | undefined => {
  if (newId.length === MIN_ID_LENGTH) {return "Missing or invalid newId";}
  if (newId.length > MAX_ID_LENGTH) {return "newId too long";}
  if (!/^[\w-]+$/.test(newId)) {return "newId contains invalid characters";}
  return undefined;
};

const omitKey = <T extends Record<string, unknown>>(obj: T, key: string): T => {
  const { [key]: _omitted, ...rest } = obj;
  return rest as T;
};

const ensureDir = (dir: string): Promise<string | undefined> => fs.mkdir(dir, { recursive: true });

const ensureIndexFile = (filePath: string): Promise<void> =>
    fs
        .access(filePath)
        .then(() => {
          // PASS
        })
        .catch(async () => {
          const initial: IndexFile = {objects: {}};
          await fs.writeFile(filePath, stringifyPretty(initial), "utf8");
        });

const readJsonUnknown = (filePath: string): Promise<unknown> =>
    fs.readFile(filePath, "utf8").then((raw) => JSON.parse(raw) as unknown);

const parseIndexFile = (value: unknown): IndexFile => {
  if (!isRecord(value)) {return { objects: {} };}

  const {objects} = value;
  if (!isRecord(objects)) {return { objects: {} };}

  return { objects: objects as Record<string, IndexEntry> };
};

const readIndex = (filePath: string): Promise<IndexFile> =>
    readJsonUnknown(filePath)
        .then(parseIndexFile)
        .catch(() => ({ objects: {} } satisfies IndexFile));

const writeIndex = (filePath: string, index: IndexFile): Promise<void> =>
    fs.writeFile(filePath, stringifyPretty(index), "utf8");

const readJsonFromDataDir = (relPath: string): Promise<unknown> =>
    readJsonUnknown(path.join(DATA_DIR, relPath));

// ---- bootstrap (top-level await to match your original style) ----
await ensureDir(OBJ_DIR);
await ensureIndexFile(OBJ_INDEX);

// ---- routes: NO async handlers ----

app.post("/api/object", (req: Request<unknown, unknown, ObjectBody>, res: Response, next) => {
  const geo = req.body.GEOJSON;
  const data = req.body.DATA;

  if (!geo) {
    res.status(BAD_REQUEST).json({ error: "Missing GEOJSON" });
    return;
  }
  if (!data) {
    res.status(BAD_REQUEST).json({ error: "Missing DATA" });
    return;
  }

  const id = makeId();
  geo.id = id;

  const dir = path.join(OBJ_DIR, id);

  fs.mkdir(dir)
      .then(() => fs.writeFile(path.join(dir, "geo.json"), stringifyPretty(geo), "utf8"))
      .then(() => fs.writeFile(path.join(dir, "data.json"), stringifyPretty(data), "utf8"))
      .then(() => readIndex(OBJ_INDEX))
      .then((index) => {
        index.objects[id] = { path: `objects/${id}`, type: getGeoType(geo) };
        return writeIndex(OBJ_INDEX, index);
      })
      .then(() => {
        res.json({ id });
      })
      .catch(next);
});

app.get("/api/object/index", (_req: Request, res: Response) => {
  readJsonFromDataDir("obj_index.json")
      .then((index) => res.json(index))
      .catch((error: unknown) => {
        res.status(INTERNAL_SERVER_ERROR).json({ error: safeErrorMessage(error) });
      });
});

app.get("/api/object/:id/geo", (req: Request<{ id: string }>, res: Response, next) => {
  const file = path.join(OBJ_DIR, req.params.id, "geo.json");
  readJsonUnknown(file)
      .then((parsed) => res.json(parsed))
      .catch(() => {
        res.sendStatus(NOT_FOUND);
      })
      .catch(next);
});

app.get("/api/object/:id/data", (req: Request<{ id: string }>, res: Response, next) => {
  const file = path.join(OBJ_DIR, req.params.id, "data.json");
  readJsonUnknown(file)
      .then((parsed) => res.json(parsed))
      .catch(() => {
        res.sendStatus(NOT_FOUND);
      })
      .catch(next);
});

app.get("/api/object/:id/delete", (req: Request<{ id: string }>, res: Response, next) => {
  const { id } = req.params;
  const dir = path.join(OBJ_DIR, id);

  fs.rm(dir, { force: true, recursive: true })
      .then(() => readIndex(OBJ_INDEX))
      .then((index) => {
        index.objects = omitKey(index.objects, id);
        return writeIndex(OBJ_INDEX, index);
      })
      .then(() => res.json({ status: "deleted" }))
      .catch(next);
});

app.post(
    "/api/object/:id/rename",
    (req: Request<{ id: string }, unknown, RenameBody, ParsedQs>, res: Response, next) => {
      const { id } = req.params;

      const bodyNewId = typeof req.body.newid === "string" ? req.body.newid : undefined;
      const queryNewId = getQueryString(req.query.newid);
      const candidate = bodyNewId ?? queryNewId;

      if (candidate === undefined) {
        res.status(BAD_REQUEST).json({ error: "Missing or invalid newId" });
        return;
      }

      const msg = validateNewId(candidate);
      if (msg !== undefined) {
        res.status(BAD_REQUEST).json({ error: msg });
        return;
      }

      const newid = candidate;

      readIndex(OBJ_INDEX)
          .then((index) => {
            if (!Object.hasOwn(index.objects, id)) {
              res.status(NOT_FOUND).json({ error: "Object not found" });
              return;
            }
            if (Object.hasOwn(index.objects, newid)) {
              res.status(CONFLICT).json({ error: "newId already in use" });
              return;
            }

            const oldDir = path.join(OBJ_DIR, id);
            const newDir = path.join(OBJ_DIR, newid);

            return fs
                .access(oldDir)
                .then(() => fs.rename(oldDir, newDir))
                .then(() => {
                  const geoFile = path.join(newDir, "geo.json");
                  return readJsonUnknown(geoFile)
                      .then((parsed) => {
                        if (isRecord(parsed)) {
                          (parsed as Record<string, unknown>).id = newid;
                          return fs.writeFile(geoFile, stringifyPretty(parsed), "utf8").then(() => {
                            // PASS
                          });
                        }
                      })
                      .catch(() => {
                        // PASS
                      });
                })
                .then(() => {
                  const prior = index.objects[id];
                  index.objects[newid] = { ...prior, path: `objects/${newid}` };
                  index.objects = omitKey(index.objects, id);
                  return writeIndex(OBJ_INDEX, index);
                })
                .then(() => {
                  res.json({ id: newid, status: "renamed" });
                })
                .catch((error: unknown) => {
                  res.status(INTERNAL_SERVER_ERROR).json({ error: safeErrorMessage(error) });
                });
          })
          .catch(next);
    },
);

app.get("/api/config", (_req: Request, res: Response) => {
  readJsonFromDataDir("config.json")
      .then((config) => res.json(config))
      .catch((error: unknown) => res.status(INTERNAL_SERVER_ERROR).json({ error: safeErrorMessage(error) }));
});

app.use((error: unknown, _req: Request, res: Response, _next: (err?: unknown) => void) => {
  const message = safeErrorMessage(error);
  res.status(INTERNAL_SERVER_ERROR).json({ error: message });
});

app.listen(APP_PORT, () => {
  // oxlint-disable-next-line no-console
  console.log(`API running url: http://localhost:${APP_PORT}`);
});