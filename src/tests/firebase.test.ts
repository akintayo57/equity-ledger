import { describe, it, expect, beforeEach, vi } from 'vitest';

// Pre-initialize offline auth mode so module evaluation picks it up
localStorage.setItem('harbour_auth_mode', 'offline');

import { 
  isOfflineMode, 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  signInAnonymously,
  signOut,
  onAuthStateChanged
} from '../firebase';

describe('offline mock database tests', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('harbour_auth_mode', 'offline');
  });

  it('should detect offline mode is active', () => {
    expect(isOfflineMode()).toBe(true);
  });

  it('should support offline collection and doc path references', () => {
    const colRef = collection(null as any, 'users', 'uid', 'transactions');
    expect(colRef.type).toBe('collection');
    expect(colRef.path).toBe('users/uid/transactions');

    const docRef = doc(null as any, 'users', 'uid', 'watchlist', 'default');
    expect(docRef.type).toBe('doc');
    expect(docRef.path).toBe('users/uid/watchlist/default');
  });

  it('should perform basic CRUD operations on mock database', async () => {
    const colRef = collection(null as any, 'test_collection');
    
    // Add a document
    const addResult = await addDoc(colRef, { name: 'Test Object', value: 42 });
    expect(addResult.id).toBeDefined();
    expect(addResult.id.startsWith('doc_')).toBe(true);

    // Retrieve collection to verify it was saved in localStorage
    const savedKey = 'harbour_data_test_collection';
    const savedData = JSON.parse(localStorage.getItem(savedKey) || '[]');
    expect(savedData.length).toBe(1);
    expect(savedData[0].name).toBe('Test Object');
    expect(savedData[0].value).toBe(42);
    expect(savedData[0].id).toBe(addResult.id);

    // Set doc (overwrite or add specific)
    const docRef = doc(null as any, 'test_collection', addResult.id);
    await setDoc(docRef, { name: 'Updated Object', value: 99 });
    
    const updatedData = JSON.parse(localStorage.getItem(savedKey) || '[]');
    expect(updatedData[0].name).toBe('Updated Object');
    expect(updatedData[0].value).toBe(99);

    // Update doc (partial update)
    await updateDoc(docRef, { value: 100 });
    const partialData = JSON.parse(localStorage.getItem(savedKey) || '[]');
    expect(partialData[0].name).toBe('Updated Object');
    expect(partialData[0].value).toBe(100);

    // Delete doc
    await deleteDoc(docRef);
    const afterDelete = JSON.parse(localStorage.getItem(savedKey) || '[]');
    expect(afterDelete.length).toBe(0);
  });

  it('should support reactive snapshot listener callback', async () => {
    const colRef = collection(null as any, 'reactive_col');
    let triggerCount = 0;
    let docsReceived: any[] = [];

    // Subscribe to snapshots
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      triggerCount++;
      docsReceived = snapshot.docs.map((d: any) => d.data());
    });

    // Wait for the async macro-task inside onSnapshot setup to fire
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(triggerCount).toBe(1);
    expect(docsReceived.length).toBe(0);

    // Add a doc to trigger listener
    await addDoc(colRef, { title: 'First Entry' });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(triggerCount).toBe(2);
    expect(docsReceived.length).toBe(1);
    expect(docsReceived[0].title).toBe('First Entry');

    unsubscribe();

    // After unsubscribe, adding more docs should not trigger callback
    await addDoc(colRef, { title: 'Second Entry' });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(triggerCount).toBe(2); // Still 2
  });

  it('should mock user auth sessions in offline mode', async () => {
    let currentUser: any = null;
    const unsub = onAuthStateChanged(null as any, (user) => {
      currentUser = user;
    });

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(currentUser).not.toBeNull();
    expect(currentUser.uid).toBe('guest-developer-uid');
    expect(currentUser.isAnonymous).toBe(true);

    const signResult = await signInAnonymously(null as any);
    expect(signResult.user.uid).toBe('guest-developer-uid');

    // Test sign out
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { reload: reloadMock },
    });

    await signOut(null as any);
    expect(reloadMock).toHaveBeenCalled();

    unsub();
  });
});
