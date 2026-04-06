/**
 * IndexedDB store for Anki-imported media files.
 *
 * Media files imported from .apkg archives (images, audio) are keyed by
 * `${deckId}/${filename}` and stored as raw Uint8Array bytes.
 *
 * DeckFact.imageAssetPath uses the prefix `anki-media://${deckId}/${filename}`
 * for imported media. At render time, the UI layer resolves this via getMediaUrl().
 *
 * No side effects outside this module — all functions are async and self-contained.
 */

const DB_NAME = 'rr-anki-media';
const STORE_NAME = 'media';
const DB_VERSION = 1;

/**
 * Open (or create) the IndexedDB database for media storage.
 * Creates the object store on first run.
 */
async function openMediaDB(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    req.onerror = (event) => {
      reject(new Error(`[ankiMediaStore] Failed to open IndexedDB: ${(event.target as IDBOpenDBRequest).error?.message}`));
    };
  });
}

/**
 * Store a media file for a personal deck.
 *
 * Key format: `${deckId}/${filename}`
 *
 * @param deckId - The personal deck ID this file belongs to.
 * @param filename - Original filename (e.g., "image.jpg").
 * @param data - Raw file bytes.
 */
export async function storeMedia(deckId: string, filename: string, data: Uint8Array): Promise<void> {
  const db = await openMediaDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const key = `${deckId}/${filename}`;
    const req = store.put(data, key);

    req.onsuccess = () => resolve();
    req.onerror = () =>
      reject(new Error(`[ankiMediaStore] Failed to store media: ${req.error?.message}`));

    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  });
}

/**
 * Retrieve a media file by deck ID and filename.
 *
 * @param deckId - The personal deck ID.
 * @param filename - Original filename.
 * @returns The raw file bytes, or null if not found.
 */
export async function getMedia(deckId: string, filename: string): Promise<Uint8Array | null> {
  const db = await openMediaDB();
  return new Promise<Uint8Array | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const key = `${deckId}/${filename}`;
    const req = store.get(key);

    req.onsuccess = () => {
      const result = req.result as Uint8Array | undefined;
      resolve(result ?? null);
    };
    req.onerror = () =>
      reject(new Error(`[ankiMediaStore] Failed to retrieve media: ${req.error?.message}`));

    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  });
}

/**
 * Delete all media files associated with a personal deck.
 * Called when a personal deck is deleted.
 *
 * @param deckId - The personal deck ID whose media to remove.
 */
export async function deleteMediaForDeck(deckId: string): Promise<void> {
  const db = await openMediaDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    // IDBKeyRange that covers all keys starting with `${deckId}/`.
    const prefix = `${deckId}/`;
    const range = IDBKeyRange.bound(prefix, prefix + '\uffff', false, false);
    const cursorReq = store.openCursor(range);

    cursorReq.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    cursorReq.onerror = () =>
      reject(new Error(`[ankiMediaStore] Failed to delete media for deck: ${cursorReq.error?.message}`));

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(new Error('[ankiMediaStore] Transaction error during deck media deletion'));
    };
  });
}

/**
 * Get an object URL for a media file suitable for use in `<img src>`.
 *
 * The caller is responsible for calling `URL.revokeObjectURL(url)` when done
 * to avoid memory leaks.
 *
 * @param deckId - The personal deck ID.
 * @param filename - Original filename.
 * @returns A blob object URL string, or null if the file is not found.
 */
export async function getMediaUrl(deckId: string, filename: string): Promise<string | null> {
  const data = await getMedia(deckId, filename);
  if (!data) return null;

  // Infer MIME type from extension for common image types.
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
  };
  const mime = mimeMap[ext] ?? 'application/octet-stream';

  // Copy into a plain ArrayBuffer to satisfy Blob's strict type requirements.
  const plainBuffer: ArrayBuffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(plainBuffer).set(data);
  const blob = new Blob([plainBuffer], { type: mime });
  return URL.createObjectURL(blob);
}

/**
 * Resolve an `anki-media://` URI to a blob object URL.
 *
 * Accepts URIs in the form `anki-media://${deckId}/${filename}`.
 * Returns null if the URI is not an anki-media URI or the file is not found.
 *
 * Caller must revoke the returned URL with URL.revokeObjectURL() when done.
 */
export async function resolveAnkiMediaUri(uri: string): Promise<string | null> {
  const SCHEME = 'anki-media://';
  if (!uri.startsWith(SCHEME)) return null;

  const path = uri.slice(SCHEME.length);
  const slashIdx = path.indexOf('/');
  if (slashIdx === -1) return null;

  const deckId = path.slice(0, slashIdx);
  const filename = path.slice(slashIdx + 1);
  return getMediaUrl(deckId, filename);
}
