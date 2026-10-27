/*
  Vindex Hub — conexão com o Firebase (login Google + banco Firestore).
  Expõe window.VH para o app.js e avisa com o evento "vh:ready".
*/
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, doc, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, arrayUnion, query, where, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const cfg = window.VINDEX_FIREBASE_CONFIG;

if (!cfg) {
  window.VH = null;
} else {
  const app = initializeApp(cfg);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  window.VH = {
    onAuth: (cb) => onAuthStateChanged(auth, cb),
    signIn: () => signInWithPopup(auth, provider),
    signOut: () => signOut(auth),
    getUser: async (email) => {
      const s = await getDoc(doc(db, 'usuarios', email));
      return s.exists() ? s.data() : null;
    },
    // filter = [campo, valor] opcional: necessário quando as regras só liberam parte da coleção
    watch: (col, cb, onError, filter) => onSnapshot(
      filter ? query(collection(db, col), where(filter[0], '==', filter[1])) : collection(db, col),
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      onError),
    list: (col, filter) => getDocs(query(collection(db, col), where(filter[0], '==', filter[1])))
      .then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    add: (col, data) => addDoc(collection(db, col), data).then((r) => r.id),
    set: (col, id, data) => setDoc(doc(db, col, id), data),
    update: (col, id, patch) => updateDoc(doc(db, col, id), patch),
    remove: (col, id) => deleteDoc(doc(db, col, id)),
    // Adia para "hoje" um conteúdo cuja data de publicação passou sem ser publicado.
    // Em transação: se duas pessoas abrirem o Hub juntas, só uma grava.
    reschedule: (id, today, entry) => runTransaction(db, async (tx) => {
      const ref = doc(db, 'conteudos', id);
      const s = await tx.get(ref);
      if (!s.exists()) return null;
      const d = s.data();
      if (!d.publish || d.publish >= today || d.stage === 'publicado') return null;
      tx.update(ref, { publish: today, adiado: (d.adiado || 0) + 1, adiadoDe: d.adiadoDe || d.publish, history: arrayUnion(entry(d.publish)) });
      return d.publish;
    }),
    push: (col, id, field, item, patch = {}) => updateDoc(doc(db, col, id), { ...patch, [field]: arrayUnion(item) })
  };
}

window.dispatchEvent(new Event('vh:ready'));
