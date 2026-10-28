const DATABASE_NAME = 'plansanction_documents';
const STORE_NAME = 'documents';

function openDocumentDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveUploadedDocument(key: string, file: File): Promise<void> {
  const database = await openDocumentDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ key, blob: file, name: file.name });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  database.close();
}

export async function getUploadedDocument(key: string): Promise<Blob | undefined> {
  const database = await openDocumentDatabase();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result?.blob);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return blob;
}